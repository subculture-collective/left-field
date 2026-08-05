import { createHash } from "node:crypto";
import { z } from "zod";
import { aipacEvidenceSchema, type AipacEvidence } from "../../domain/dsa-target-evaluator";

export const AIPAC_PAC_COMMITTEE_ID = "C00797670" as const;
export const UNITED_DEMOCRACY_PROJECT_COMMITTEE_ID = "C00799031" as const;
export const AIPAC_NETWORK_CLASSIFICATION_ID = "org-classification-aipac-network-v1" as const;

const isoDate = z.iso.date();
const fecCycleYear = z.number().int().min(2010).max(2100).refine((year) => year % 2 === 0, "FEC cycle years must be even");
const evaluationCycleYear = fecCycleYear.refine((year) => year >= 2022, "Evaluation cycle must be 2022 or later");
const amendmentIndicator = z.enum(["N", "A", "T"]);

export const pas2TransactionSchema = z.strictObject({
  snapshotId: z.string().min(1),
  cycleYear: fecCycleYear,
  committeeId: z.string().min(1),
  amendmentIndicator,
  reportType: z.string().min(1),
  transactionPgi: z.string().regex(/^[PGOCRSE]\d{4}$/),
  transactionType: z.string().min(1),
  transactionDate: isoDate,
  filingReceiptDate: isoDate,
  transactionAmount: z.number().finite().refine((amount) => amount !== 0, "Transaction amount must be nonzero"),
  recipientCommitteeId: z.string().min(1),
  candidateId: z.string().min(1),
  transactionIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileNumber: z.number().int().positive(),
  memoCode: z.string().max(1).nullable(),
  subId: z.string().min(1),
});

export const independentExpenditureSchema = z.strictObject({
  snapshotId: z.string().min(1),
  cycleYear: fecCycleYear,
  candidateId: z.string().min(1),
  spenderId: z.string().min(1),
  electionType: z.string().regex(/^[PGS]\d{4}$/),
  amount: z.number().finite().refine((amount) => amount !== 0, "Expenditure amount must be nonzero"),
  expenditureDate: isoDate,
  filingReceiptDate: isoDate,
  supportOppose: z.enum(["S", "O"]),
  fileNumber: z.number().int().positive(),
  amendmentIndicator,
  transactionIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
  previousFileNumber: z.number().int().positive().nullable(),
});

export const aipacCandidateMappingSchema = z.strictObject({
  candidateId: z.string().min(1),
  seatCycleId: z.string().min(1),
  relationship: z.enum(["incumbent", "democratic_primary_challenger"]),
  authorizedCommitteeIds: z.array(z.string().min(1)),
  effectiveCycleYears: z.array(fecCycleYear).min(1),
  mappingSnapshotId: z.string().min(1),
  mappingArtifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewId: z.string().min(1),
  reviewedAt: isoDate,
});

export const aipacCoverageSchema = z.strictObject({
  cycleYear: evaluationCycleYear,
  directContributionsComplete: z.boolean(),
  independentExpendituresComplete: z.boolean(),
  directContributionSnapshotIds: z.array(z.string().min(1)),
  independentExpenditureSnapshotIds: z.array(z.string().min(1)),
  directContributionArtifactSha256s: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  independentExpenditureArtifactSha256s: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
}).superRefine((row, ctx) => {
  if (row.directContributionsComplete && (row.directContributionSnapshotIds.length === 0 || row.directContributionArtifactSha256s.length === 0)) ctx.addIssue({ code: "custom", message: "Complete direct-contribution coverage requires a source snapshot and artifact hash" });
  if (row.independentExpendituresComplete && (row.independentExpenditureSnapshotIds.length === 0 || row.independentExpenditureArtifactSha256s.length === 0)) ctx.addIssue({ code: "custom", message: "Complete independent-expenditure coverage requires a source snapshot and artifact hash" });
});

export type Pas2Transaction = Readonly<z.infer<typeof pas2TransactionSchema>>;
export type IndependentExpenditure = Readonly<z.infer<typeof independentExpenditureSchema>>;
export type AipacCandidateMapping = Readonly<z.infer<typeof aipacCandidateMappingSchema>>;
export type AipacCoverage = Readonly<z.infer<typeof aipacCoverageSchema>>;

export type BuildAipacEvidenceInput = Readonly<{
  sourceCutoff: string;
  currentCycleYear: number;
  pas2Transactions: readonly unknown[];
  independentExpenditures: readonly unknown[];
  candidateMappings: readonly unknown[];
  coverage: readonly unknown[];
  classificationSnapshotIds: readonly string[];
}>;

export type AipacEvidenceBundle = Readonly<{
  evidence: readonly AipacEvidence[];
  coverage: readonly AipacCoverage[];
  inputSnapshotIds: readonly string[];
}>;

const directTransactionTypes = new Set(["24K", "24P", "24Z"]);
const bytes = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort(bytes);
const hashIdentity = (domain: string, value: string): string => createHash("sha256").update(domain, "ascii").update(value, "utf8").digest("hex");

function indexedRow(row: Readonly<Record<string, unknown>>): Map<string, unknown> {
  return new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
}

function requiredField(row: Map<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    const value = row.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  throw new Error(`FEC_AIPAC_FIELD_MISSING:${names[0]}`);
}

function optionalField(row: Map<string, unknown>, ...names: string[]): unknown | null {
  for (const name of names) {
    const value = row.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function textField(row: Map<string, unknown>, ...names: string[]): string {
  return String(requiredField(row, ...names)).trim();
}

function numericField(row: Map<string, unknown>, ...names: string[]): number {
  const raw = String(requiredField(row, ...names)).trim().replace(/[$,]/g, "");
  const accounting = /^\((.+)\)$/.exec(raw);
  const parsed = Number(accounting ? `-${accounting[1]}` : raw);
  if (!Number.isFinite(parsed)) throw new Error(`FEC_AIPAC_NUMBER_INVALID:${names[0]}`);
  return parsed;
}

function integerField(row: Map<string, unknown>, ...names: string[]): number {
  const parsed = numericField(row, ...names);
  if (!Number.isInteger(parsed)) throw new Error(`FEC_AIPAC_INTEGER_INVALID:${names[0]}`);
  return parsed;
}

function normalizedAmendmentIndicator(row: Map<string, unknown>, ...names: string[]): "N" | "A" | "T" {
  const value = textField(row, ...names).toUpperCase();
  if (value === "N" || value === "T") return value;
  if (/^A\d*$/.test(value)) return "A";
  throw new Error(`FEC_AIPAC_AMENDMENT_INDICATOR_INVALID:${names[0]}`);
}

function normalizedDate(rawValue: unknown, field: string, compactOrder: "mdy" | "ymd"): string {
  const raw = String(rawValue).trim();
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const dash = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const fecCsv = /^(\d{2})-([A-Za-z]{3})-(\d{2})$/.exec(raw);
  const compact = /^(\d{8})$/.exec(raw);
  const month = fecCsv ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(fecCsv[2]!.toUpperCase()) + 1 : 0;
  const value = dash
    ? raw
    : slash
      ? `${slash[3]}-${slash[1]!.padStart(2, "0")}-${slash[2]!.padStart(2, "0")}`
      : fecCsv && month > 0
        ? `20${fecCsv[3]}-${String(month).padStart(2, "0")}-${fecCsv[1]}`
      : compact && compactOrder === "mdy"
        ? `${raw.slice(4)}-${raw.slice(0, 2)}-${raw.slice(2, 4)}`
        : compact
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error(`FEC_AIPAC_DATE_INVALID:${field}`);
  return value;
}

/** Projects one official PAS2 keyed row without retaining names, addresses, or employment fields. */
export function projectPas2BulkRow(raw: Readonly<Record<string, unknown>>, snapshotId: string, cycle: number, filingReceiptDate: string): Pas2Transaction {
  const row = indexedRow(raw);
  const memo = optionalField(row, "MEMO_CD");
  return pas2TransactionSchema.parse({
    snapshotId,
    cycleYear: cycle,
    committeeId: textField(row, "CMTE_ID"),
    amendmentIndicator: normalizedAmendmentIndicator(row, "AMNDT_IND"),
    reportType: textField(row, "RPT_TP"),
    transactionPgi: textField(row, "TRANSACTION_PGI"),
    transactionType: textField(row, "TRANSACTION_TP"),
    transactionDate: normalizedDate(requiredField(row, "TRANSACTION_DT"), "TRANSACTION_DT", "mdy"),
    filingReceiptDate,
    transactionAmount: numericField(row, "TRANSACTION_AMT"),
    recipientCommitteeId: textField(row, "OTHER_ID"),
    candidateId: textField(row, "CAND_ID"),
    transactionIdSha256: hashIdentity("fec-aipac-pas2:transaction-id:v1\0", textField(row, "TRAN_ID")),
    fileNumber: integerField(row, "FILE_NUM"),
    memoCode: memo === null ? null : String(memo).trim(),
    subId: textField(row, "SUB_ID"),
  });
}

/** Projects one official FEC independent-expenditure keyed row into the retained evidence fields. */
export function projectIndependentExpenditureBulkRow(raw: Readonly<Record<string, unknown>>, snapshotId: string, cycle: number): IndependentExpenditure {
  const row = indexedRow(raw);
  const previous = optionalField(row, "PREV_FILE_NUM");
  const date = requiredField(row, "EXP_DAT", "EXP_DATE", "DISSEM_DT");
  const electionType = textField(row, "ELE_TYP", "ELE_TYPE");
  const electionYear = optionalField(row, "FEC_ELECTION_YR");
  const normalizedElectionType = /^[PGS]\d{4}$/.test(electionType)
    ? electionType
    : `${electionType}${String(electionYear ?? cycle).trim()}`;
  return independentExpenditureSchema.parse({
    snapshotId,
    cycleYear: cycle,
    candidateId: textField(row, "CAN_ID", "CAND_ID"),
    spenderId: textField(row, "SPE_ID"),
    electionType: normalizedElectionType,
    amount: numericField(row, "EXP_AMO"),
    expenditureDate: normalizedDate(date, "EXP_DAT", "mdy"),
    filingReceiptDate: normalizedDate(requiredField(row, "RECEIPT_DAT"), "RECEIPT_DAT", "mdy"),
    supportOppose: textField(row, "SUP_OPP"),
    fileNumber: integerField(row, "FILE_NUM"),
    amendmentIndicator: normalizedAmendmentIndicator(row, "AMN_IND", "AMNDT_IND"),
    transactionIdSha256: hashIdentity("fec-udp-schedule-e:transaction-id:v1\0", textField(row, "TRA_ID", "TRAN_ID")),
    previousFileNumber: previous === null ? null : Number(previous),
  });
}

function latestByIdentity<T>(rows: readonly T[], identity: (row: T) => string, fileNumber: (row: T) => number): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = identity(row);
    const prior = latest.get(key);
    if (!prior || fileNumber(row) > fileNumber(prior)) latest.set(key, row);
    else if (fileNumber(row) === fileNumber(prior) && JSON.stringify(row) !== JSON.stringify(prior)) throw new Error(`FEC_AIPAC_REVISION_CONFLICT:${key}:${fileNumber(row)}`);
  }
  return [...latest.entries()].sort(([left], [right]) => bytes(left, right)).map(([, row]) => row);
}

function terminalIndependentExpenditures(rows: readonly IndependentExpenditure[]): IndependentExpenditure[] {
  const filingMetadata = new Map<string, { previous: number | null; indicator: "N" | "A" | "T" }>();
  for (const row of rows) {
    const key = `${row.spenderId}\0${row.fileNumber}`;
    const prior = filingMetadata.get(key);
    if (prior && (prior.previous !== row.previousFileNumber || prior.indicator !== row.amendmentIndicator)) throw new Error(`FEC_AIPAC_IE_FILING_CONFLICT:${row.spenderId}:${row.fileNumber}`);
    filingMetadata.set(key, { previous: row.previousFileNumber, indicator: row.amendmentIndicator });
  }
  const superseded = new Set<string>();
  for (const [key, metadata] of filingMetadata) {
    const spenderId = key.split("\0")[0]!;
    if (metadata.indicator === "A" && metadata.previous === null) throw new Error(`FEC_AIPAC_IE_AMENDMENT_PREDECESSOR_MISSING:${key.replace("\0", ":")}`);
    if (metadata.previous !== null) {
      const predecessor = `${spenderId}\0${metadata.previous}`;
      if (!filingMetadata.has(predecessor)) throw new Error(`FEC_AIPAC_IE_AMENDMENT_CHAIN_INCOMPLETE:${spenderId}:${metadata.previous}`);
      superseded.add(predecessor);
    }
  }
  const terminal = rows.filter((row) => !superseded.has(`${row.spenderId}\0${row.fileNumber}`));
  return latestByIdentity(terminal, (row) => [row.spenderId, row.fileNumber, row.transactionIdSha256].join("\0"), (row) => row.fileNumber);
}

function validateMappings(rows: readonly AipacCandidateMapping[]): Map<string, AipacCandidateMapping> {
  const result = new Map<string, AipacCandidateMapping>();
  for (const row of rows) {
    if (result.has(row.candidateId)) throw new Error(`FEC_AIPAC_CANDIDATE_MAPPING_DUPLICATE:${row.candidateId}`);
    if (new Set(row.effectiveCycleYears).size !== row.effectiveCycleYears.length) throw new Error(`FEC_AIPAC_CANDIDATE_MAPPING_CYCLE_DUPLICATE:${row.candidateId}`);
    if (row.relationship === "incumbent" && row.authorizedCommitteeIds.length === 0) throw new Error(`FEC_AIPAC_INCUMBENT_COMMITTEE_MAPPING_MISSING:${row.candidateId}`);
    result.set(row.candidateId, row);
  }
  return result;
}

type EvidenceAccumulator = {
  amount: number;
  observedAt: string;
  inputSnapshotIds: string[];
  sourceTransactionIdSha256s: string[];
  latestRevisionFileNumber: number;
};

function accumulate(groups: Map<string, EvidenceAccumulator>, key: string, amount: number, observedAt: string, snapshotId: string, transactionIdSha256: string, fileNumber: number): void {
  const group = groups.get(key) ?? { amount: 0, observedAt, inputSnapshotIds: [], sourceTransactionIdSha256s: [], latestRevisionFileNumber: 0 };
  group.amount += amount;
  if (observedAt > group.observedAt) group.observedAt = observedAt;
  group.inputSnapshotIds.push(snapshotId);
  group.sourceTransactionIdSha256s.push(transactionIdSha256);
  group.latestRevisionFileNumber = Math.max(group.latestRevisionFileNumber, fileNumber);
  groups.set(key, group);
}

/**
 * Builds seat-level evidence from official FEC PAS2 and independent-expenditure rows.
 * It deliberately accepts candidate/committee mappings as reviewed inputs and never
 * consumes contributor-person records. Evidence is omitted unless the latest
 * revisions net to a positive amount for an exact primary candidate relationship.
 */
export function buildAipacEvidence(raw: BuildAipacEvidenceInput): AipacEvidenceBundle {
  const sourceCutoff = isoDate.parse(raw.sourceCutoff);
  const currentCycleYear = evaluationCycleYear.parse(raw.currentCycleYear);
  const eligibleCycles = new Set([currentCycleYear, currentCycleYear - 2, currentCycleYear - 4]);
  const mappings = validateMappings(raw.candidateMappings.map((row) => aipacCandidateMappingSchema.parse(row)));
  const coverage = raw.coverage.map((row) => aipacCoverageSchema.parse(row));
  if (new Set(coverage.map((row) => row.cycleYear)).size !== coverage.length) throw new Error("FEC_AIPAC_COVERAGE_CYCLE_DUPLICATE");
  if (coverage.some((row) => !eligibleCycles.has(row.cycleYear))) throw new Error("FEC_AIPAC_COVERAGE_CYCLE_OUT_OF_SCOPE");

  const pas2 = raw.pas2Transactions.map((row) => pas2TransactionSchema.parse(row)).filter((row) => row.transactionDate <= sourceCutoff && row.filingReceiptDate <= sourceCutoff && eligibleCycles.has(row.cycleYear));
  const independent = raw.independentExpenditures.map((row) => independentExpenditureSchema.parse(row)).filter((row) => row.expenditureDate <= sourceCutoff && row.filingReceiptDate <= sourceCutoff && eligibleCycles.has(row.cycleYear));
  const directLatest = latestByIdentity(pas2, (row) => [row.committeeId, row.cycleYear, row.reportType, row.transactionIdSha256].join("\0"), (row) => row.fileNumber);
  const independentLatest = terminalIndependentExpenditures(independent);

  const directGroups = new Map<string, EvidenceAccumulator>();
  for (const row of directLatest) {
    if (row.committeeId !== AIPAC_PAC_COMMITTEE_ID || !row.transactionPgi.startsWith("P") || !directTransactionTypes.has(row.transactionType)) continue;
    const mapping = mappings.get(row.candidateId);
    if (!mapping || !mapping.effectiveCycleYears.includes(row.cycleYear) || mapping.relationship !== "incumbent" || !mapping.authorizedCommitteeIds.includes(row.recipientCommitteeId)) continue;
    const key = [row.cycleYear, row.candidateId, row.recipientCommitteeId].join("\0");
    accumulate(directGroups, key, row.transactionAmount, row.transactionDate, row.snapshotId, row.transactionIdSha256, row.fileNumber);
  }

  const independentGroups = new Map<string, EvidenceAccumulator>();
  for (const row of independentLatest) {
    if (row.spenderId !== UNITED_DEMOCRACY_PROJECT_COMMITTEE_ID || !row.electionType.startsWith("P")) continue;
    const mapping = mappings.get(row.candidateId);
    if (!mapping || !mapping.effectiveCycleYears.includes(row.cycleYear)) continue;
    const qualifying = row.supportOppose === "S" && mapping.relationship === "incumbent"
      ? "independent_support_incumbent"
      : row.supportOppose === "O" && mapping.relationship === "democratic_primary_challenger"
        ? "independent_oppose_challenger"
        : null;
    if (!qualifying) continue;
    const key = [qualifying, row.cycleYear, row.candidateId, mapping.seatCycleId].join("\0");
    accumulate(independentGroups, key, row.amount, row.expenditureDate, row.snapshotId, row.transactionIdSha256, row.fileNumber);
  }

  const evidence: AipacEvidence[] = [];
  for (const [key, group] of [...directGroups.entries()].sort(([left], [right]) => bytes(left, right))) {
    if (group.amount <= 0) continue;
    const [cycle, candidateId, recipientCommitteeId] = key.split("\0") as [string, string, string];
    evidence.push(aipacEvidenceSchema.parse({ kind: "direct_contribution", committeeId: AIPAC_PAC_COMMITTEE_ID, recipientCommitteeId, recipientCandidateId: candidateId, recipientRelationship: "authorized", netAmount: group.amount, cycleYear: Number(cycle), observedAt: group.observedAt, inputSnapshotIds: uniqueSorted(group.inputSnapshotIds), sourceTransactionIdSha256s: uniqueSorted(group.sourceTransactionIdSha256s), latestRevisionFileNumber: group.latestRevisionFileNumber, revisionStatus: "latest_net_positive" }));
  }
  const classificationSnapshotIds = uniqueSorted(raw.classificationSnapshotIds);
  for (const [key, group] of [...independentGroups.entries()].sort(([left], [right]) => bytes(left, right))) {
    if (group.amount <= 0) continue;
    if (classificationSnapshotIds.length === 0) throw new Error("FEC_AIPAC_NETWORK_CLASSIFICATION_SNAPSHOT_MISSING");
    const [kind, cycle, candidateId, seatCycleId] = key.split("\0") as ["independent_support_incumbent" | "independent_oppose_challenger", string, string, string];
    const relationship = kind === "independent_support_incumbent" ? "incumbent" : "democratic_primary_challenger";
    evidence.push(aipacEvidenceSchema.parse({ kind, committeeId: UNITED_DEMOCRACY_PROJECT_COMMITTEE_ID, targetCandidateId: candidateId, targetSeatCycleId: seatCycleId, electionType: "primary", supportOppose: kind === "independent_support_incumbent" ? "S" : "O", targetRelationship: relationship, networkClassificationId: AIPAC_NETWORK_CLASSIFICATION_ID, classificationSnapshotIds, netAmount: group.amount, cycleYear: Number(cycle), observedAt: group.observedAt, inputSnapshotIds: uniqueSorted(group.inputSnapshotIds), sourceTransactionIdSha256s: uniqueSorted(group.sourceTransactionIdSha256s), latestRevisionFileNumber: group.latestRevisionFileNumber, revisionStatus: "latest_net_positive" }));
  }

  return {
    evidence,
    coverage: [...coverage].sort((left, right) => right.cycleYear - left.cycleYear),
    inputSnapshotIds: uniqueSorted([
      ...pas2.map((row) => row.snapshotId),
      ...independent.map((row) => row.snapshotId),
      ...coverage.flatMap((row) => [...row.directContributionSnapshotIds, ...row.independentExpenditureSnapshotIds]),
      ...[...mappings.values()].map((row) => row.mappingSnapshotId),
      ...classificationSnapshotIds,
    ]),
  };
}
