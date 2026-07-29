import { createHash } from "node:crypto";
import type { FecCandidateMapping, FinanceScope, OutsideSpendingRecord } from "./aggregates";
import type { DecimalMoney, FecReportVersion } from "./amendments";
import { loadFecApiCredential } from "./credential";
import { isFecCandidateId, isFecCommitteeId, normalizeFecMoney, openFecTimestampDate } from "./values";
import {
  encodeFecSanitizedEnvelope,
  canonicalizeFecFinanceScope,
  FEC_SANITIZED_ADAPTER_VERSION,
  FEC_OPENFEC_ORIGIN,
  fecPageRequestSha256,
  type FecCompletenessAttestation,
  type FecEndpoint,
  type FecPageReceipt,
  type FecSanitizedCommittee,
  type FecSanitizedEnvelopeV1,
} from "./envelope";

const PAGE_BYTES_LIMIT = 8 * 1024 * 1024;
const TOTAL_BYTES_LIMIT = 32 * 1024 * 1024;
const PAGE_LIMIT = 1_000;
const REQUEST_LIMIT = 10_000;
const TOTAL_DURATION_MS = 5 * 60_000;
const PER_PAGE = 100;
const ATTEMPTS = 3;
type AcquisitionBudget = {
  bytes: number;
  requests: number;
  records: number;
  deadline: number;
};

export type OpenFecFetch = (
  input: string | URL,
  init: RequestInit,
) => Promise<Response>;
export interface FetchFecEnvelopeOptions {
  readonly apiKey: string;
  readonly sourceLockSha256: string;
  readonly releaseCutoff: string;
  readonly electionKey: string;
  /** Required by production callers; legacy test callers retain the reviewed year-end default. */
  readonly financeScope?: FinanceScope;
  readonly mapping: FecCandidateMapping;
  readonly fetcher?: OpenFecFetch;
  readonly signal?: AbortSignal;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

type PagePayload = Readonly<{
  results: readonly unknown[];
  pagination: Readonly<{
    count: number;
    pages: number;
    perPage: number;
    countExact: boolean;
  }>;
  sha256: string;
  byteSize: number;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};
const record = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
};
const text = (value: unknown, code: string, maximum: number = 1024): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail(code);
  return value as string;
};
const nullableText = (value: unknown, code: string): string | null =>
  value === null || value === undefined ? null : text(value, code);
const integer = (value: unknown, code: string, minimum = 0): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    fail(code);
  return value as number;
};
const date = (value: unknown, code: string): string => {
  const candidate = text(value, code, 64);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== candidate
  )
    fail(code);
  return candidate;
};
const responseDate = (value: unknown, code: string): string => {
  return openFecTimestampDate(value) ?? fail(code);
};
const money = (value: unknown, code: string): DecimalMoney | null => {
  const normalized = normalizeFecMoney(value);
  return normalized === undefined ? fail(code) : normalized;
};
const numericId = (value: unknown, prefix: "C" | "HSP", code: string) => {
  const candidate = text(value, code, 16);
  if (prefix === "C" ? !isFecCommitteeId(candidate) : !isFecCandidateId(candidate)) fail(code);
  return candidate;
};
const booleanOrNull = (value: unknown, code: string): boolean | null => {
  if (value === null || typeof value === "boolean")
    return value as boolean | null;
  return fail(code);
};
const fileNumber = (value: unknown, code: string): number => {
  if (typeof value === "string" && /^\d+$/.test(value)) return integer(Number(value), code, 1);
  return integer(value, code, 1);
};
const amendmentIndicator = (
  value: unknown,
): "N" | "A" | "T" | "C" | "M" | "S" | null => {
  if (value === null) return null;
  if (!["N", "A", "T", "C", "M", "S"].includes(String(value)))
    fail("FEC_RESPONSE_REPORT_INVALID");
  return value as "N" | "A" | "T" | "C" | "M" | "S";
};
const queryEntries = (query: Readonly<Record<string, string>>) =>
  Object.entries(query)
    .filter(([key]) => key !== "api_key")
    .sort(([a, av], [b, bv]) =>
      Buffer.compare(Buffer.from(`${a}\0${av}`), Buffer.from(`${b}\0${bv}`)),
    )
    .map(([key, value]) => ({ key, value }));

async function withinDeadline<T>(
  promise: Promise<T>,
  budget: AcquisitionBudget,
  outerSignal?: AbortSignal,
): Promise<T> {
  const remaining = budget.deadline - Date.now();
  if (remaining <= 0) fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
  if (outerSignal?.aborted) fail("FEC_FETCH_TIMEOUT");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", abort);
      callback();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new Error("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED")));
    }, remaining);
    const abort = () => finish(() => reject(new Error("FEC_FETCH_TIMEOUT")));
    outerSignal?.addEventListener("abort", abort, { once: true });
    if (outerSignal?.aborted) abort();
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

async function collectBody(
  response: Response,
  signal: AbortSignal,
  outerSignal: AbortSignal | undefined,
  budget: AcquisitionBudget,
  consumeBytes: (count: number) => void,
): Promise<Uint8Array> {
  if (!response.body) fail("FEC_FETCH_RESPONSE_INVALID");
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (signal.aborted) fail("FEC_FETCH_TIMEOUT");
      const part = await withinDeadline(reader.read(), budget, outerSignal);
      if (part.done) break;
      size += part.value.byteLength;
      consumeBytes(part.value.byteLength);
      if (size > PAGE_BYTES_LIMIT) fail("FEC_FETCH_PAGE_TOO_LARGE");
      chunks.push(part.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof Error && error.message.startsWith("FEC_")) throw error;
    fail(signal.aborted ? "FEC_FETCH_TIMEOUT" : "FEC_FETCH_FAILED");
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

function parsePayload(bytes: Uint8Array): PagePayload {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("FEC_RESPONSE_INVALID_JSON");
  }
  const root = record(value, "FEC_RESPONSE_INVALID");
  if (!Array.isArray(root.results)) fail("FEC_RESPONSE_INVALID");
  const results = root.results as unknown[];
  if (results.length > PER_PAGE) fail("FEC_RESPONSE_TOO_MANY_RESULTS");
  const pagination = record(root.pagination, "FEC_RESPONSE_PAGINATION_INVALID");
  return {
    results,
    pagination: {
      count: integer(pagination.count, "FEC_RESPONSE_PAGINATION_INVALID"),
      pages: integer(pagination.pages, "FEC_RESPONSE_PAGINATION_INVALID"),
      perPage: integer(
        pagination.per_page,
        "FEC_RESPONSE_PAGINATION_INVALID",
        1,
      ),
      countExact:
        typeof pagination.is_count_exact === "boolean"
          ? pagination.is_count_exact
          : fail("FEC_RESPONSE_PAGINATION_INVALID"),
    },
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
  };
}

const retryDelay = (response: Response, attempt: number): number => {
  const header = response.headers.get("retry-after");
  if (header) {
    const milliseconds = /^\d+$/.test(header)
      ? Number(header) * 1000
      : Date.parse(header) - Date.now();
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      fail("FEC_RETRY_AFTER_INVALID");
    if (milliseconds > 30_000) fail("FEC_RETRY_AFTER_EXCEEDS_LIMIT");
    return milliseconds;
  }
  return Math.min(250 * 2 ** attempt, 2_000);
};

async function fetchPage(
  fetcher: OpenFecFetch,
  url: URL,
  apiKey: string,
  outerSignal: AbortSignal | undefined,
  sleep: (milliseconds: number) => Promise<void>,
  budget: AcquisitionBudget,
): Promise<PagePayload> {
  const sleepWithinDeadline = async (milliseconds: number) => {
    if (milliseconds > budget.deadline - Date.now())
      fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
    await withinDeadline(sleep(milliseconds), budget, outerSignal);
    if (Date.now() >= budget.deadline)
      fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
  };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    budget.requests += 1;
    const remaining = budget.deadline - Date.now();
    if (budget.requests > REQUEST_LIMIT || remaining <= 0)
      fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
    if (outerSignal?.aborted) fail("FEC_FETCH_TIMEOUT");
    const timeout = AbortSignal.timeout(Math.min(15_000, remaining));
    const signal = outerSignal ? AbortSignal.any([outerSignal, timeout]) : timeout;
    let response: Response;
    try {
      response = await withinDeadline(
        fetcher(url, {
          method: "GET",
          headers: { accept: "application/json", "X-Api-Key": apiKey },
          redirect: "error",
          cache: "no-store",
          signal,
        }),
        budget,
        outerSignal,
      );
    } catch {
      if (outerSignal?.aborted) fail("FEC_FETCH_TIMEOUT");
      if (Date.now() >= budget.deadline)
        fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
      if (attempt + 1 === ATTEMPTS)
        fail(signal.aborted ? "FEC_FETCH_TIMEOUT" : "FEC_FETCH_FAILED");
      await sleepWithinDeadline(Math.min(250 * 2 ** attempt, 2_000));
      continue;
    }
    if (response.ok) {
      let bytes: Uint8Array;
      try {
        bytes = await collectBody(response, signal, outerSignal, budget, (count) => {
          budget.bytes += count;
          if (budget.bytes > TOTAL_BYTES_LIMIT)
            fail("FEC_FETCH_TOTAL_TOO_LARGE");
        });
      } catch (error) {
        if (
          error instanceof Error &&
          [
            "FEC_FETCH_PAGE_TOO_LARGE",
            "FEC_FETCH_RESPONSE_INVALID",
            "FEC_FETCH_TOTAL_TOO_LARGE",
            "FEC_FETCH_GLOBAL_LIMIT_EXCEEDED",
          ].includes(error.message)
        )
          throw error;
        if (outerSignal?.aborted) fail("FEC_FETCH_TIMEOUT");
        if (attempt + 1 === ATTEMPTS) fail("FEC_FETCH_FAILED");
        await sleepWithinDeadline(Math.min(250 * 2 ** attempt, 2_000));
        continue;
      }
      if (Date.now() >= budget.deadline)
        fail("FEC_FETCH_GLOBAL_LIMIT_EXCEEDED");
      return parsePayload(bytes);
    }
    const retryable = response.status === 429 || response.status >= 500;
    void response.body?.cancel().catch(() => undefined);
    if (!retryable || attempt + 1 === ATTEMPTS) fail("FEC_FETCH_HTTP_ERROR");
    await sleepWithinDeadline(retryDelay(response, attempt));
  }
  return fail("FEC_FETCH_FAILED");
}

async function fetchGroup<T>(
  endpoint: FecEndpoint,
  path: string,
  baseQuery: Readonly<Record<string, string>>,
  project: (value: unknown) => T,
  options: Required<Pick<FetchFecEnvelopeOptions, "apiKey">> &
    Pick<FetchFecEnvelopeOptions, "fetcher" | "signal" | "sleep">,
  budget: AcquisitionBudget,
): Promise<{ rows: readonly T[]; receipts: readonly FecPageReceipt[] }> {
  const rows: T[] = [];
  const receipts: FecPageReceipt[] = [];
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const query = {
      ...baseQuery,
      page: String(page),
      per_page: String(PER_PAGE),
    };
    const url = new URL(path, FEC_OPENFEC_ORIGIN);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const payload = await fetchPage(fetcher, url, options.apiKey, options.signal, sleep, budget);
    if (payload.pagination.perPage !== PER_PAGE)
      fail("FEC_RESPONSE_PAGINATION_INVALID");
    const projected = payload.results.map(project);
    rows.push(...projected);
    budget.records += projected.length;
    if (rows.length > 100_000 || budget.records > 100_000)
      fail("FEC_RESPONSE_TOO_MANY_RESULTS");
    receipts.push({
      endpoint,
      path,
      query: queryEntries(query),
      page,
      perPage: PER_PAGE,
      reportedCount: payload.pagination.count,
      reportedPages: payload.pagination.pages,
      countExact: payload.pagination.countExact,
      requestSha256: fecPageRequestSha256(path, queryEntries(query)),
      responseSha256: payload.sha256,
      responseByteSize: payload.byteSize,
      resultCount: projected.length,
      isFirstPage: page === 1,
      isLastPage: projected.length === 0,
    });
    if (projected.length === 0) return { rows, receipts };
  }
  return fail("FEC_PAGINATION_LIMIT_EXCEEDED");
}

const completeness = (pageCount: number): FecCompletenessAttestation => ({
  complete: true,
  pageCount,
  firstPagePresent: pageCount > 0,
  lastPagePresent: pageCount > 0,
});

export async function fetchFecSanitizedEnvelope(
  options: FetchFecEnvelopeOptions,
): Promise<Uint8Array> {
  if (
    !options.apiKey ||
    options.apiKey.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(options.apiKey)
  )
    fail("FEC_API_KEY_REQUIRED");
  if (!/^[a-f0-9]{64}$/.test(options.sourceLockSha256))
    fail("FEC_SOURCE_LOCK_INVALID");
  const { candidateId, electionCycle } = options.mapping;
  numericId(candidateId, "HSP", "FEC_MAPPING_INVALID");
  if (
    !Number.isSafeInteger(electionCycle) ||
    electionCycle < 1000 ||
    electionCycle > 9999 ||
    electionCycle % 2 !== 0
  )
    fail("FEC_MAPPING_INVALID");
  date(options.releaseCutoff, "FEC_CUTOFF_INVALID");
  text(options.electionKey, "FEC_ELECTION_KEY_INVALID");
  const financeScope = (() => {
    try {
      return canonicalizeFecFinanceScope(options.financeScope ?? { reportForm: "F3", reportType: "YE", coverageStartDate: "2024-01-01", coverageEndDate: options.releaseCutoff, asOf: options.releaseCutoff, cutoff: options.releaseCutoff });
    } catch {
      return fail("FEC_FINANCE_SCOPE_INVALID");
    }
  })();
  if (financeScope.cutoff !== options.releaseCutoff)
    fail("FEC_FINANCE_SCOPE_INVALID");
  const common = {
    apiKey: options.apiKey,
    fetcher: options.fetcher,
    signal: options.signal,
    sleep: options.sleep,
  };
  if (
    !["H", "S"].includes(candidateId[0] ?? "") ||
    !Array.isArray(options.mapping.committees) ||
    options.mapping.committees.length > 500 ||
    new Set(options.mapping.committees.map((item) => item.committeeId)).size !==
      options.mapping.committees.length
  )
    fail("FEC_MAPPING_INVALID");
  const mappingValue = options.mapping as unknown as Record<string, unknown>;
  if (
    Object.keys(mappingValue).sort().join("\0") !==
    [
      "candidateId",
      "candidacyId",
      "committees",
      "electionCycle",
      "seatCycleId",
      "snapshotId",
    ]
      .sort()
      .join("\0")
  )
    fail("FEC_MAPPING_INVALID");
  if (
    !text(options.mapping.candidacyId, "FEC_MAPPING_INVALID") ||
    !text(options.mapping.seatCycleId, "FEC_MAPPING_INVALID") ||
    !text(options.mapping.snapshotId, "FEC_MAPPING_INVALID")
  )
    fail("FEC_MAPPING_INVALID");
  for (const item of options.mapping.committees) {
    const itemValue = item as unknown as Record<string, unknown>;
    if (
      Object.keys(itemValue).sort().join("\0") !==
      ["committeeId", "effectiveFrom", "effectiveTo", "relationshipType"]
        .sort()
        .join("\0")
    )
      fail("FEC_MAPPING_INVALID");
    numericId(item.committeeId, "C", "FEC_MAPPING_INVALID");
    if (!['principal_campaign_committee', 'authorized'].includes(item.relationshipType))
      fail("FEC_MAPPING_INVALID");
    const effectiveFrom = date(item.effectiveFrom, "FEC_MAPPING_INVALID");
    if (item.effectiveTo !== null) {
      const effectiveTo = date(item.effectiveTo, "FEC_MAPPING_INVALID");
      if (effectiveTo <= effectiveFrom) fail("FEC_MAPPING_INVALID");
    }
  }
  const budget = {
    bytes: 0,
    requests: 0,
    records: 0,
    deadline: Date.now() + TOTAL_DURATION_MS,
  };
  const committeesResult = await fetchGroup(
    "candidate_committees",
    `/v1/candidate/${candidateId}/committees/`,
    { cycle: String(electionCycle) },
    (value): FecSanitizedCommittee => {
      const row = record(value, "FEC_RESPONSE_COMMITTEE_INVALID");
      const candidateIds = Array.isArray(row.candidate_ids)
        ? row.candidate_ids.map((id) =>
            numericId(id, "HSP", "FEC_RESPONSE_COMMITTEE_INVALID"),
          )
        : fail("FEC_RESPONSE_COMMITTEE_INVALID");
      if (!candidateIds.includes(candidateId)) fail("FEC_RESPONSE_COMMITTEE_INVALID");
      const cycles = Array.isArray(row.cycles)
        ? row.cycles.map((cycle) =>
            integer(cycle, "FEC_RESPONSE_COMMITTEE_INVALID", 1000),
          )
        : fail("FEC_RESPONSE_COMMITTEE_INVALID");
      return {
        committeeId: numericId(
          row.committee_id,
          "C",
          "FEC_RESPONSE_COMMITTEE_INVALID",
        ),
        name: text(row.name, "FEC_RESPONSE_COMMITTEE_INVALID"),
        designation: nullableText(
          row.designation,
          "FEC_RESPONSE_COMMITTEE_INVALID",
        ),
        committeeType: nullableText(
          row.committee_type,
          "FEC_RESPONSE_COMMITTEE_INVALID",
        ),
        cycles,
      };
    },
    common,
    budget,
  );
  const enumerated = new Set(committeesResult.rows.map((row) => row.committeeId));
  if (
    options.mapping.committees.some(
      (item) => !enumerated.has(item.committeeId),
    )
  )
    fail("FEC_MAPPING_COMMITTEE_MISMATCH");

  const reportRows: FecReportVersion[] = [];
  const reportReceipts: FecPageReceipt[] = [];
  for (const mapped of options.mapping.committees) {
    const result = await fetchGroup(
      "committee_reports",
      "/v1/reports/house-senate/",
      {
        committee_id: mapped.committeeId,
        cycle: String(electionCycle),
        max_receipt_date: options.releaseCutoff,
        sort: "-receipt_date",
      },
      (value): FecReportVersion => {
        const row = record(value, "FEC_RESPONSE_REPORT_INVALID");
        const chain = Array.isArray(row.amendment_chain)
          ? row.amendment_chain.map((item) =>
              fileNumber(item, "FEC_RESPONSE_REPORT_INVALID"),
            )
          : fail("FEC_RESPONSE_REPORT_INVALID");
        const previous =
          row.previous_file_number === null || row.previous_file_number === undefined
            ? null
            : fileNumber(row.previous_file_number, "FEC_RESPONSE_REPORT_INVALID");
        const recent =
          row.most_recent_file_number === null ||
          row.most_recent_file_number === undefined
            ? null
            : fileNumber(
                row.most_recent_file_number,
                "FEC_RESPONSE_REPORT_INVALID",
              );
        return {
          candidateId,
          electionCycle,
          committeeId: numericId(
            row.committee_id,
            "C",
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          reportForm: text(row.report_form, "FEC_RESPONSE_REPORT_INVALID"),
          reportType: text(row.report_type, "FEC_RESPONSE_REPORT_INVALID"),
          coverageStartDate: responseDate(
            row.coverage_start_date,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          coverageEndDate: responseDate(
            row.coverage_end_date,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          receiptDate: responseDate(
            row.receipt_date,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          fileNumber: fileNumber(row.file_number, "FEC_RESPONSE_REPORT_INVALID"),
          previousFileNumber: previous,
          amendmentIndicator: amendmentIndicator(row.amendment_indicator),
          amendmentChain: chain,
          mostRecent: booleanOrNull(
            row.most_recent,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          mostRecentFileNumber: recent,
          cashOnHandEndPeriod: money(
            row.cash_on_hand_end_period,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          totalReceiptsYtd: money(
            row.total_receipts_ytd,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
          totalDisbursementsYtd: money(
            row.total_disbursements_ytd,
            "FEC_RESPONSE_REPORT_INVALID",
          ),
        };
      },
      common,
      budget,
    );
    if (result.rows.some((row) => row.committeeId !== mapped.committeeId))
      fail("FEC_RESPONSE_REPORT_SCOPE_MISMATCH");
    reportRows.push(...result.rows);
    reportReceipts.push(...result.receipts);
  }

  const scheduleResult = await fetchGroup(
    "schedule_e_by_candidate",
    "/v1/schedules/schedule_e/by_candidate/",
    {
      candidate_id: candidateId,
      cycle: String(electionCycle),
      election_full: "false",
    },
    (value): OutsideSpendingRecord => {
      const row = record(value, "FEC_RESPONSE_SCHEDULE_E_INVALID");
      if (
        numericId(row.candidate_id, "HSP", "FEC_RESPONSE_SCHEDULE_E_INVALID") !==
          candidateId ||
        integer(row.cycle, "FEC_RESPONSE_SCHEDULE_E_INVALID", 1000) !==
          electionCycle
      )
        fail("FEC_RESPONSE_SCHEDULE_E_INVALID");
      const disposition =
        row.support_oppose_indicator === "S"
          ? "support"
          : row.support_oppose_indicator === "O"
            ? "oppose"
            : fail("FEC_RESPONSE_SCHEDULE_E_INVALID");
      const amount = money(row.total, "FEC_RESPONSE_SCHEDULE_E_INVALID");
      if (amount === null) return fail("FEC_RESPONSE_SCHEDULE_E_INVALID");
      return {
        candidateId,
        committeeId: numericId(
          row.committee_id,
          "C",
          "FEC_RESPONSE_SCHEDULE_E_INVALID",
        ),
        cycle: electionCycle,
        disposition,
        electionFull: false,
        amount,
      };
    },
    common,
    budget,
  );

  const pageReceipts = [
    ...committeesResult.receipts,
    ...reportReceipts,
    ...scheduleResult.receipts,
  ];
  const envelope: FecSanitizedEnvelopeV1 = {
    schemaVersion: 1,
    adapterVersion: FEC_SANITIZED_ADAPTER_VERSION,
    sourceLockSha256: options.sourceLockSha256,
    releaseCutoff: options.releaseCutoff,
    candidateId,
    electionCycle,
    electionKey: options.electionKey,
    financeScope,
    mapping: options.mapping,
    committees: committeesResult.rows,
    reports: reportRows,
    candidateTotalsStatus: "not_collected_historical_cutoff_unsupported",
    outsideSpending: scheduleResult.rows,
    pageReceipts,
    noRetention: {
      originalBodiesNotStored: true,
      secretUrlsNotStored: true,
      originalBodiesNotLogged: true,
      originalBodiesNotCached: true,
      originalBodiesNotQuarantined: true,
    },
    completeness: {
      committees: completeness(committeesResult.receipts.length),
      reports:
        reportReceipts.length === 0
          ? {
              complete: true,
              pageCount: 0,
              firstPagePresent: false,
              lastPagePresent: false,
            }
          : completeness(reportReceipts.length),
      scheduleE: completeness(scheduleResult.receipts.length),
    },
  };
  return encodeFecSanitizedEnvelope(envelope);
}

export async function fetchFecSanitizedEnvelopeFromEnv(
  options: Omit<FetchFecEnvelopeOptions, "apiKey">,
  env: NodeJS.ProcessEnv,
): Promise<Uint8Array> {
  return fetchFecSanitizedEnvelope({ ...options, apiKey: loadFecApiCredential(env) });
}
