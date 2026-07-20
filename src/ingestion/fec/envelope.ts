import { createHash } from "node:crypto";
import type { FecCandidateMapping, FinanceScope, OutsideSpendingRecord } from "./aggregates";
import {
  resolveFecAmendments,
  type FecReportVersion,
} from "./amendments";

export const FEC_SANITIZED_ADAPTER_VERSION = "openfec-sanitized-v1";
export const FEC_OPENFEC_ORIGIN = "https://api.open.fec.gov";
export const FEC_ENVELOPE_LIMITS = Object.freeze({
  bytes: 32 * 1024 * 1024,
  string: 1024,
  records: 100_000,
  committees: 500,
  query: 8,
});

export type FecEndpoint =
  | "candidate_committees"
  | "committee_reports"
  | "schedule_e_by_candidate";
export type FecSanitizedCommittee = Readonly<{
  committeeId: string;
  name: string;
  designation: string | null;
  committeeType: string | null;
  cycles: readonly number[];
}>;
export type FecPageReceipt = Readonly<{
  endpoint: FecEndpoint;
  path: string;
  query: readonly Readonly<{ key: string; value: string }>[];
  page: number;
  perPage: number;
  reportedCount: number;
  reportedPages: number;
  countExact: boolean;
  requestSha256: string;
  responseSha256: string;
  responseByteSize: number;
  resultCount: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}>;
export type FecCompletenessAttestation = Readonly<{
  complete: true;
  pageCount: number;
  firstPagePresent: boolean;
  lastPagePresent: boolean;
}>;
export type FecNoRetentionAttestation = Readonly<{
  originalBodiesNotStored: true;
  secretUrlsNotStored: true;
  originalBodiesNotLogged: true;
  originalBodiesNotCached: true;
  originalBodiesNotQuarantined: true;
}>;
export type FecSanitizedEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  adapterVersion: typeof FEC_SANITIZED_ADAPTER_VERSION;
  sourceLockSha256: string;
  releaseCutoff: string;
  candidateId: string;
  electionCycle: number;
  /** Reviewed target election identity. Schedule E cannot substantiate it. */
  electionKey: string;
  /** The single reviewed reporting window used for the finance aggregate. */
  financeScope: FinanceScope;
  mapping: FecCandidateMapping;
  /** Every officially enumerated association, not only the reviewed subset. */
  committees: readonly FecSanitizedCommittee[];
  reports: readonly FecReportVersion[];
  candidateTotalsStatus: "not_collected_historical_cutoff_unsupported";
  /** Official committee-scoped, two-year-cycle rows; not exact-election facts. */
  outsideSpending: readonly OutsideSpendingRecord[];
  pageReceipts: readonly FecPageReceipt[];
  noRetention: FecNoRetentionAttestation;
  completeness: Readonly<{
    committees: FecCompletenessAttestation;
    reports: FecCompletenessAttestation;
    scheduleE: FecCompletenessAttestation;
  }>;
}>;

const bytewise = (a: string, b: string) =>
  Buffer.compare(Buffer.from(a), Buffer.from(b));
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const safeInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= minimum;
const validText = (
  value: unknown,
  maximum: number = FEC_ENVELOPE_LIMITS.string,
) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f\u007f]/.test(value);
const validMoney = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value))
    return false;
  const [whole, fraction = ""] = value.split(".");
  const cents = `${whole.replace(/^0+(?=\d)/, "")}${(fraction + "00").slice(0, 2)}`.replace(
    /^0+(?=\d)/,
    "",
  );
  return (
    cents.length < 16 ||
    (cents.length === 16 && cents <= "9007199254740991")
  );
};
const canonicalMoney = (value: string): string => {
  if (!validMoney(value)) throw new Error("FEC_MONEY_INVALID");
  const [whole, fraction = ""] = value.split(".");
  const cents = `${whole.replace(/^0+(?=\d)/, "")}${(fraction + "00").slice(0, 2)}`
    .replace(/^0+(?=\d)/, "")
    .padStart(3, "0");
  return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
};
const validCandidateId = (value: unknown): value is string =>
  typeof value === "string" && /^[HS]\d{8}$/.test(value);
const validCommitteeId = (value: unknown): value is string =>
  typeof value === "string" && /^C\d{8}$/.test(value);
const validCycle = (value: unknown): value is number =>
  safeInteger(value, 1000) && value <= 9999 && value % 2 === 0;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("FEC_ENVELOPE_INVALID");
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value)) ||
    Object.keys(value).some((key) =>
      /contact|address|treasurer|email|phone|custodian|agent/i.test(key),
    )
  )
    throw new Error("FEC_ENVELOPE_UNKNOWN_FIELD");
};
const audited = (value: unknown, keys: readonly string[]) => {
  const result = object(value);
  exact(result, keys);
  return result;
};
const sorted = <T>(values: readonly T[], key: (value: T) => string) =>
  [...values].sort((a, b) => bytewise(key(a), key(b)));

function auditShape(envelope: Record<string, unknown>): void {
  audited(envelope.financeScope, [
    "reportForm",
    "reportType",
    "coverageStartDate",
    "coverageEndDate",
    "asOf",
    "cutoff",
  ]);
  const mapping = audited(envelope.mapping, [
    "candidateId",
    "electionCycle",
    "candidacyId",
    "seatCycleId",
    "snapshotId",
    "committees",
  ]);
  if (!Array.isArray(mapping.committees)) throw new Error("FEC_ENVELOPE_INVALID");
  for (const item of mapping.committees)
    audited(item, [
      "committeeId",
      "relationshipType",
      "effectiveFrom",
      "effectiveTo",
    ]);
  const lists: readonly [string, readonly string[]][] = [
    ["committees", ["committeeId", "name", "designation", "committeeType", "cycles"]],
    [
      "reports",
      [
        "candidateId",
        "electionCycle",
        "committeeId",
        "reportForm",
        "reportType",
        "coverageStartDate",
        "coverageEndDate",
        "receiptDate",
        "fileNumber",
        "previousFileNumber",
        "amendmentIndicator",
        "amendmentChain",
        "mostRecent",
        "mostRecentFileNumber",
        "cashOnHandEndPeriod",
        "totalReceiptsYtd",
        "totalDisbursementsYtd",
      ],
    ],
    [
      "outsideSpending",
      ["candidateId", "committeeId", "cycle", "disposition", "electionFull", "amount"],
    ],
  ];
  for (const [name, keys] of lists) {
    if (!Array.isArray(envelope[name])) throw new Error("FEC_ENVELOPE_INVALID");
    for (const item of envelope[name] as unknown[]) audited(item, keys);
  }
  if (!Array.isArray(envelope.pageReceipts))
    throw new Error("FEC_ENVELOPE_INVALID");
  for (const item of envelope.pageReceipts) {
    const page = audited(item, [
      "endpoint",
      "path",
      "query",
      "page",
      "perPage",
      "reportedCount",
      "reportedPages",
      "countExact",
      "requestSha256",
      "responseSha256",
      "responseByteSize",
      "resultCount",
      "isFirstPage",
      "isLastPage",
    ]);
    if (!Array.isArray(page.query)) throw new Error("FEC_ENVELOPE_INVALID");
    for (const query of page.query) audited(query, ["key", "value"]);
  }
  audited(envelope.noRetention, [
    "originalBodiesNotStored",
    "secretUrlsNotStored",
    "originalBodiesNotLogged",
    "originalBodiesNotCached",
    "originalBodiesNotQuarantined",
  ]);
  const completeness = audited(envelope.completeness, [
    "committees",
    "reports",
    "scheduleE",
  ]);
  for (const value of Object.values(completeness))
    audited(value, [
      "complete",
      "pageCount",
      "firstPagePresent",
      "lastPagePresent",
    ]);
}

/** Validate and normalize the reviewed finance window at every trust boundary. */
export function canonicalizeFecFinanceScope(value: unknown): FinanceScope {
  const scope = audited(value, [
    "reportForm",
    "reportType",
    "coverageStartDate",
    "coverageEndDate",
    "asOf",
    "cutoff",
  ]);
  if (
    !validText(scope.reportForm) ||
    !validText(scope.reportType) ||
    !validDate(scope.coverageStartDate) ||
    !validDate(scope.coverageEndDate) ||
    !validDate(scope.asOf) ||
    !validDate(scope.cutoff) ||
    scope.coverageStartDate > scope.coverageEndDate ||
    scope.asOf < scope.coverageEndDate ||
    scope.cutoff < scope.asOf
  )
    throw new Error("FEC_FINANCE_SCOPE_INVALID");
  return {
    reportForm: scope.reportForm as string,
    reportType: scope.reportType as string,
    coverageStartDate: scope.coverageStartDate as string,
    coverageEndDate: scope.coverageEndDate as string,
    asOf: scope.asOf as string,
    cutoff: scope.cutoff as string,
  };
}

const expectedQueryKeys = (endpoint: FecEndpoint): readonly string[] => {
  if (endpoint === "schedule_e_by_candidate")
    return ["candidate_id", "cycle", "election_full", "page", "per_page"];
  if (endpoint === "committee_reports")
    return [
      "committee_id",
      "cycle",
      "max_receipt_date",
      "page",
      "per_page",
      "sort",
    ];
  return ["cycle", "page", "per_page"];
};
const pageScope = (page: FecPageReceipt) =>
  `${page.endpoint}\0${page.path}\0${page.query
    .filter((query) => query.key !== "page" && query.key !== "per_page")
    .map((query) => `${query.key}\0${query.value}`)
    .join("\0")}`;

function validatePageGroups(
  allPages: readonly FecPageReceipt[],
  endpoint: FecEndpoint,
  attestation: FecCompletenessAttestation,
  expectedGroups: number,
  expectedProjectionCount: number,
  allowNoRequests = false,
): void {
  const pages = allPages.filter((page) => page.endpoint === endpoint);
  if (allowNoRequests && pages.length === 0) {
    if (
      attestation.complete !== true ||
      attestation.pageCount !== 0 ||
      attestation.firstPagePresent ||
      attestation.lastPagePresent ||
      expectedGroups !== 0 ||
      expectedProjectionCount !== 0
    )
      throw new Error("FEC_PAGINATION_INCOMPLETE");
    return;
  }
  if (
    pages.length === 0 ||
    attestation.complete !== true ||
    attestation.pageCount !== pages.length ||
    !attestation.firstPagePresent ||
    !attestation.lastPagePresent
  )
    throw new Error("FEC_PAGINATION_INCOMPLETE");
  const groups = new Map<string, FecPageReceipt[]>();
  for (const page of pages) {
    const key = pageScope(page);
    groups.set(key, [...(groups.get(key) ?? []), page]);
  }
  if (groups.size !== expectedGroups)
    throw new Error("FEC_PAGINATION_INCOMPLETE");
  let actualResultCount = 0;
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.page - b.page);
    if (ordered.length > 1_000) throw new Error("FEC_PAGINATION_INCOMPLETE");
    const first = ordered[0]!;
    for (const [index, page] of ordered.entries()) {
      const terminal = index === ordered.length - 1;
      if (
        page.page !== index + 1 ||
        page.perPage !== first.perPage ||
        page.reportedCount !== first.reportedCount ||
        page.reportedPages !== first.reportedPages ||
        page.countExact !== first.countExact ||
        page.isFirstPage !== (index === 0) ||
        page.isLastPage !== terminal ||
        (terminal ? page.resultCount !== 0 : page.resultCount === 0)
      )
        throw new Error("FEC_PAGINATION_INCOMPLETE");
      if (!terminal) actualResultCount += page.resultCount;
    }
    const nonTerminalPages = ordered.length - 1;
    if (
      first.countExact &&
      (first.reportedCount !==
        ordered.slice(0, -1).reduce((sum, page) => sum + page.resultCount, 0) ||
        first.reportedPages !== nonTerminalPages)
    )
      throw new Error("FEC_PAGINATION_INCOMPLETE");
  }
  if (actualResultCount !== expectedProjectionCount)
    throw new Error("FEC_PAGINATION_RECONCILIATION");
}

function validatePageReceipt(
  page: FecPageReceipt,
  envelope: FecSanitizedEnvelopeV1,
  mappedCommitteeIds: ReadonlySet<string>,
): void {
  if (
    ![
      "candidate_committees",
      "committee_reports",
      "schedule_e_by_candidate",
    ].includes(page.endpoint) ||
    !safeInteger(page.page, 1) ||
    !safeInteger(page.perPage, 1) ||
    page.perPage !== 100 ||
    !safeInteger(page.reportedCount) ||
    !safeInteger(page.reportedPages) ||
    typeof page.countExact !== "boolean" ||
    !/^[a-f0-9]{64}$/.test(page.requestSha256) ||
    !/^[a-f0-9]{64}$/.test(page.responseSha256) ||
    !safeInteger(page.responseByteSize) ||
    !safeInteger(page.resultCount) ||
    page.resultCount > page.perPage ||
    typeof page.isFirstPage !== "boolean" ||
    typeof page.isLastPage !== "boolean" ||
    page.query.length > FEC_ENVELOPE_LIMITS.query
  )
    throw new Error("FEC_PAGE_INVALID");
  const expectedPath =
    page.endpoint === "candidate_committees"
      ? `/v1/candidate/${envelope.candidateId}/committees/`
      : page.endpoint === "schedule_e_by_candidate"
          ? "/v1/schedules/schedule_e/by_candidate/"
          : "/v1/reports/house-senate/";
  if (!expectedPath || page.path !== expectedPath)
    throw new Error("FEC_PAGE_INVALID");
  const query = new Map<string, string>();
  let previous = "";
  for (const item of page.query) {
    const key = `${item.key}\0${item.value}`;
    if (
      !validText(item.key, 64) ||
      !validText(item.value, 256) ||
      /api[_-]?key/i.test(item.key) ||
      query.has(item.key) ||
      bytewise(key, previous) <= 0
    )
      throw new Error("FEC_QUERY_INVALID");
    query.set(item.key, item.value);
    previous = key;
  }
  if (
    page.query.map((item) => item.key).join("\0") !==
      expectedQueryKeys(page.endpoint).join("\0") ||
    query.get("cycle") !== String(envelope.electionCycle) ||
    query.get("page") !== String(page.page) ||
    query.get("per_page") !== String(page.perPage) ||
    (page.endpoint === "committee_reports" &&
      (query.get("sort") !== "-receipt_date" ||
        query.get("max_receipt_date") !== envelope.releaseCutoff ||
        !mappedCommitteeIds.has(query.get("committee_id") ?? ""))) ||
    (page.endpoint === "schedule_e_by_candidate" &&
      (query.get("candidate_id") !== envelope.candidateId ||
        query.get("election_full") !== "false"))
  )
    throw new Error("FEC_QUERY_INVALID");
  if (page.requestSha256 !== fecPageRequestSha256(page.path, page.query))
    throw new Error("FEC_REQUEST_INVALID");
}

/** Hash the redacted, canonical OpenFEC GET target; credentials are never included. */
export function fecPageRequestSha256(
  path: string,
  query: readonly Readonly<{ key: string; value: string }>[],
): string {
  const url = new URL(path, FEC_OPENFEC_ORIGIN);
  const params = new URLSearchParams();
  for (const { key, value } of [...query].sort((a, b) =>
    bytewise(`${a.key}\0${a.value}`, `${b.key}\0${b.value}`),
  )) if (key !== "api_key") params.append(key, value);
  return createHash("sha256").update(`GET\n${url.pathname}?${params.toString()}`).digest("hex");
}

function validateEnvelope(envelope: FecSanitizedEnvelopeV1): FecSanitizedEnvelopeV1 {
  auditShape(envelope as unknown as Record<string, unknown>);
  if (
    envelope.schemaVersion !== 1 ||
    envelope.adapterVersion !== FEC_SANITIZED_ADAPTER_VERSION ||
    !/^[a-f0-9]{64}$/.test(envelope.sourceLockSha256) ||
    !validDate(envelope.releaseCutoff) ||
    !validCandidateId(envelope.candidateId) ||
    !validCycle(envelope.electionCycle) ||
    !validText(envelope.electionKey)
  )
    throw new Error("FEC_ENVELOPE_INVALID");
  const financeScope = canonicalizeFecFinanceScope(envelope.financeScope);
  if (financeScope.cutoff !== envelope.releaseCutoff)
    throw new Error("FEC_FINANCE_SCOPE_INVALID");
  const totalRecords = [
    envelope.committees,
    envelope.reports,
    envelope.outsideSpending,
    envelope.pageReceipts,
  ].reduce((sum, values) => sum + values.length, 0);
  if (
    totalRecords > FEC_ENVELOPE_LIMITS.records ||
    envelope.committees.length > FEC_ENVELOPE_LIMITS.committees ||
    envelope.pageReceipts.length > 10_000 ||
    envelope.pageReceipts.some((page) => page.responseByteSize > 8 * 1024 * 1024) ||
    envelope.pageReceipts.reduce((sum, page) => sum + page.responseByteSize, 0) >
      32 * 1024 * 1024
  )
    throw new Error("FEC_ENVELOPE_TOO_LARGE");

  const mapping = envelope.mapping;
  if (
    mapping.candidateId !== envelope.candidateId ||
    mapping.electionCycle !== envelope.electionCycle ||
    !validText(mapping.candidacyId) ||
    !validText(mapping.seatCycleId) ||
    !validText(mapping.snapshotId)
  )
    throw new Error("FEC_MAPPING_INVALID");
  const mappedCommitteeIds = new Set<string>();
  for (const item of mapping.committees) {
    if (
      !validCommitteeId(item.committeeId) ||
      !["principal_campaign_committee", "authorized"].includes(
        item.relationshipType,
      ) ||
      !validDate(item.effectiveFrom) ||
      (item.effectiveTo !== null &&
        (!validDate(item.effectiveTo) || item.effectiveTo <= item.effectiveFrom)) ||
      mappedCommitteeIds.has(item.committeeId)
    )
      throw new Error("FEC_MAPPING_INVALID");
    mappedCommitteeIds.add(item.committeeId);
  }

  const enumeratedCommitteeIds = new Set<string>();
  for (const item of envelope.committees) {
    if (
      !validCommitteeId(item.committeeId) ||
      !validText(item.name) ||
      !(item.designation === null || validText(item.designation)) ||
      !(item.committeeType === null || validText(item.committeeType)) ||
      item.cycles.length === 0 ||
      item.cycles.length > 20 ||
      item.cycles.some((value) => !validCycle(value)) ||
      new Set(item.cycles).size !== item.cycles.length ||
      !item.cycles.includes(envelope.electionCycle) ||
      enumeratedCommitteeIds.has(item.committeeId)
    )
      throw new Error("FEC_COMMITTEE_INVALID");
    enumeratedCommitteeIds.add(item.committeeId);
  }
  if ([...mappedCommitteeIds].some((id) => !enumeratedCommitteeIds.has(id)))
    throw new Error("FEC_MAPPING_COMMITTEE_MISMATCH");

  const fileNumbers = new Set<number>();
  for (const report of envelope.reports) {
    if (
      report.candidateId !== envelope.candidateId ||
      report.electionCycle !== envelope.electionCycle ||
      !mappedCommitteeIds.has(report.committeeId) ||
      !validText(report.reportForm) ||
      !validText(report.reportType) ||
      !validDate(report.coverageStartDate) ||
      !validDate(report.coverageEndDate) ||
      report.coverageStartDate > report.coverageEndDate ||
      report.coverageEndDate > envelope.releaseCutoff ||
      !validDate(report.receiptDate) ||
      report.receiptDate > envelope.releaseCutoff ||
      !safeInteger(report.fileNumber, 1) ||
      fileNumbers.has(report.fileNumber) ||
      ![
        report.cashOnHandEndPeriod,
        report.totalReceiptsYtd,
        report.totalDisbursementsYtd,
      ].every((value) => value === null || validMoney(value))
    )
      throw new Error("FEC_REPORT_INVALID");
    fileNumbers.add(report.fileNumber);
  }
  resolveFecAmendments(envelope.reports);

  if (envelope.candidateTotalsStatus !== "not_collected_historical_cutoff_unsupported")
    throw new Error("FEC_TOTAL_STATUS_INVALID");

  const scheduleEKeys = new Set<string>();
  for (const item of envelope.outsideSpending) {
    const key = `${item.candidateId}\0${item.committeeId}\0${item.cycle}\0${item.disposition}`;
    if (
      item.candidateId !== envelope.candidateId ||
      item.cycle !== envelope.electionCycle ||
      !validCommitteeId(item.committeeId) ||
      !["support", "oppose"].includes(item.disposition) ||
      item.electionFull !== false ||
      !validMoney(item.amount) ||
      scheduleEKeys.has(key)
    )
      throw new Error("FEC_OUTSIDE_SPENDING_INVALID");
    scheduleEKeys.add(key);
  }

  for (const page of envelope.pageReceipts)
    validatePageReceipt(page, envelope, mappedCommitteeIds);
  if (Object.values(envelope.noRetention).some((value) => value !== true))
    throw new Error("FEC_NO_RETENTION_REQUIRED");
  validatePageGroups(
    envelope.pageReceipts,
    "candidate_committees",
    envelope.completeness.committees,
    1,
    envelope.committees.length,
  );
  validatePageGroups(
    envelope.pageReceipts,
    "committee_reports",
    envelope.completeness.reports,
    mappedCommitteeIds.size,
    envelope.reports.length,
    mappedCommitteeIds.size === 0,
  );
  for (const committeeId of mappedCommitteeIds) {
    const pageCount = envelope.pageReceipts
      .filter(
        (page) =>
          page.endpoint === "committee_reports" &&
          page.query.some(
            (query) => query.key === "committee_id" && query.value === committeeId,
          ) &&
          !page.isLastPage,
      )
      .reduce((sum, page) => sum + page.resultCount, 0);
    const reportCount = envelope.reports.filter(
      (report) => report.committeeId === committeeId,
    ).length;
    if (pageCount !== reportCount)
      throw new Error("FEC_PAGINATION_RECONCILIATION");
  }
  validatePageGroups(
    envelope.pageReceipts,
    "schedule_e_by_candidate",
    envelope.completeness.scheduleE,
    1,
    envelope.outsideSpending.length,
  );
  return envelope;
}

const canonicalMapping = (mapping: FecCandidateMapping): FecCandidateMapping => ({
  candidateId: mapping.candidateId,
  electionCycle: mapping.electionCycle,
  candidacyId: mapping.candidacyId,
  seatCycleId: mapping.seatCycleId,
  snapshotId: mapping.snapshotId,
  committees: sorted(
    mapping.committees,
    (item) =>
      `${item.committeeId}\0${item.relationshipType}\0${item.effectiveFrom}\0${item.effectiveTo ?? ""}`,
  ).map((item) => ({
    committeeId: item.committeeId,
    relationshipType: item.relationshipType,
    effectiveFrom: item.effectiveFrom,
    effectiveTo: item.effectiveTo,
  })),
});
const canonicalReport = (report: FecReportVersion): FecReportVersion => ({
  candidateId: report.candidateId,
  electionCycle: report.electionCycle,
  committeeId: report.committeeId,
  reportForm: report.reportForm,
  reportType: report.reportType,
  coverageStartDate: report.coverageStartDate,
  coverageEndDate: report.coverageEndDate,
  receiptDate: report.receiptDate,
  fileNumber: report.fileNumber,
  previousFileNumber: report.previousFileNumber,
  amendmentIndicator: report.amendmentIndicator,
  amendmentChain: [...report.amendmentChain],
  mostRecent: report.mostRecent,
  mostRecentFileNumber: report.mostRecentFileNumber,
  cashOnHandEndPeriod:
    report.cashOnHandEndPeriod === null
      ? null
      : canonicalMoney(report.cashOnHandEndPeriod),
  totalReceiptsYtd:
    report.totalReceiptsYtd === null
      ? null
      : canonicalMoney(report.totalReceiptsYtd),
  totalDisbursementsYtd:
    report.totalDisbursementsYtd === null
      ? null
      : canonicalMoney(report.totalDisbursementsYtd),
});
const canonicalScheduleE = (item: OutsideSpendingRecord): OutsideSpendingRecord => ({
  candidateId: item.candidateId,
  committeeId: item.committeeId,
  cycle: item.cycle,
  disposition: item.disposition,
  electionFull: false,
  amount: canonicalMoney(item.amount),
});
const canonicalPage = (page: FecPageReceipt): FecPageReceipt => ({
  endpoint: page.endpoint,
  path: page.path,
  query: page.query.map((item) => ({ key: item.key, value: item.value })),
  page: page.page,
  perPage: page.perPage,
  reportedCount: page.reportedCount,
  reportedPages: page.reportedPages,
  countExact: page.countExact,
  requestSha256: page.requestSha256,
  responseSha256: page.responseSha256,
  responseByteSize: page.responseByteSize,
  resultCount: page.resultCount,
  isFirstPage: page.isFirstPage,
  isLastPage: page.isLastPage,
});
const canonicalAttestation = (
  value: FecCompletenessAttestation,
): FecCompletenessAttestation => ({
  complete: true,
  pageCount: value.pageCount,
  firstPagePresent: value.firstPagePresent,
  lastPagePresent: value.lastPagePresent,
});

export function encodeFecSanitizedEnvelope(
  value: FecSanitizedEnvelopeV1,
): Uint8Array {
  const envelope = validateEnvelope(value);
  const canonical: FecSanitizedEnvelopeV1 = {
    schemaVersion: 1,
    adapterVersion: FEC_SANITIZED_ADAPTER_VERSION,
    sourceLockSha256: envelope.sourceLockSha256,
    releaseCutoff: envelope.releaseCutoff,
    candidateId: envelope.candidateId,
    electionCycle: envelope.electionCycle,
    electionKey: envelope.electionKey,
    financeScope: canonicalizeFecFinanceScope(envelope.financeScope),
    mapping: canonicalMapping(envelope.mapping),
    committees: sorted(envelope.committees, (item) => item.committeeId).map(
      (item) => ({
        committeeId: item.committeeId,
        name: item.name,
        designation: item.designation,
        committeeType: item.committeeType,
        cycles: [...item.cycles].sort((a, b) => a - b),
      }),
    ),
    reports: sorted(
      envelope.reports,
      (item) =>
        `${item.candidateId}\0${item.electionCycle}\0${item.committeeId}\0${item.reportForm}\0${item.reportType}\0${item.coverageStartDate}\0${item.coverageEndDate}\0${String(item.fileNumber).padStart(16, "0")}`,
    ).map(canonicalReport),
    candidateTotalsStatus: "not_collected_historical_cutoff_unsupported",
    outsideSpending: sorted(
      envelope.outsideSpending,
      (item) =>
        `${item.candidateId}\0${item.committeeId}\0${item.cycle}\0${item.disposition}`,
    ).map(canonicalScheduleE),
    pageReceipts: sorted(
      envelope.pageReceipts,
      (item) => `${pageScope(item)}\0${String(item.page).padStart(10, "0")}`,
    ).map(canonicalPage),
    noRetention: {
      originalBodiesNotStored: true,
      secretUrlsNotStored: true,
      originalBodiesNotLogged: true,
      originalBodiesNotCached: true,
      originalBodiesNotQuarantined: true,
    },
    completeness: {
      committees: canonicalAttestation(envelope.completeness.committees),
      reports: canonicalAttestation(envelope.completeness.reports),
      scheduleE: canonicalAttestation(envelope.completeness.scheduleE),
    },
  };
  const bytes = Buffer.from(JSON.stringify(canonical));
  if (bytes.byteLength > FEC_ENVELOPE_LIMITS.bytes)
    throw new Error("FEC_ENVELOPE_TOO_LARGE");
  return bytes;
}

export function decodeFecSanitizedEnvelope(
  bytes: Uint8Array,
): FecSanitizedEnvelopeV1 {
  if (bytes.byteLength > FEC_ENVELOPE_LIMITS.bytes)
    throw new Error("FEC_ENVELOPE_TOO_LARGE");
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("FEC_ENVELOPE_INVALID_JSON");
  }
  const envelope = object(raw);
  exact(envelope, [
    "schemaVersion",
    "adapterVersion",
    "sourceLockSha256",
    "releaseCutoff",
    "candidateId",
    "electionCycle",
    "electionKey",
    "financeScope",
    "mapping",
    "committees",
    "reports",
    "candidateTotalsStatus",
    "outsideSpending",
    "pageReceipts",
    "noRetention",
    "completeness",
  ]);
  const result = validateEnvelope(envelope as unknown as FecSanitizedEnvelopeV1);
  if (!Buffer.from(bytes).equals(Buffer.from(encodeFecSanitizedEnvelope(result))))
    throw new Error("FEC_ENVELOPE_NONCANONICAL");
  return result;
}

export const fecEnvelopeSha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
