import { createHash } from "node:crypto";

export type FecEfoPosition = number | null;
export type FecEfoVariant = Readonly<{ recordType: string; fields: Readonly<Record<string, FecEfoPosition>> }>;
type Position = FecEfoPosition;
type Variant = FecEfoVariant;
export type FecEfoLayout = Readonly<{ formatVersion: "8.5"; hdr: Readonly<Record<"recordType" | "efType" | "fecVersion" | "reportId" | "reportNumber", number>>; coverRecords: Readonly<Record<"F3" | "F3X" | "F24" | "F5", readonly Variant[]>>; scheduleERecords: Readonly<Record<"F3X" | "F24" | "F5", readonly Variant[]>> }>;

const MAX_BYTES = 64 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const HDR_POSITIONS = { recordType: 1, efType: 2, fecVersion: 3, reportId: 6, reportNumber: 7 } as const;
const DELIMITER_SOURCE = "https://www.fec.gov/help-candidates-and-committees/filing-reports/data-conversion-tools/";
const EVIDENCE = {
  observed: "F3X/F24 Schedule E applicability corroborated live; F5 Schedule 5-E is supported as F57.",
  specification: "Workbook supplies only listed positions; it does not supply file number, receipt date, predecessor, generic report date, delimiter, or encoding.",
} as const;
const validatedLayouts = new WeakSet<object>();
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const fail = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail("FEC_EFO_LAYOUT_INVALID");
const exact = (value: unknown, keys: readonly string[]): Record<string, unknown> => { const record = object(value); if (Object.keys(record).length !== keys.length || keys.some(key => !(key in record))) fail("FEC_EFO_LAYOUT_INVALID"); return record; };
const sorted = (values: readonly Variant[]): boolean => values.every((value, index) => index === 0 || values[index - 1]!.recordType < value.recordType);
const coverFields = ["coverageFromDate", "coverageThroughDate", "dateSigned", "electionCode", "filerId", "formType", "originalAmendmentDate", "report24Hour48HourCode", "reportCode"] as const;
const scheduleFields = ["amount", "backReferenceSchedule", "backReferenceTransactionId", "candidateId", "disseminationDate", "electionCode", "expenditureDate", "filerId", "formType", "memoCode", "supportOppose", "transactionId"] as const;
const records = (value: unknown, expectedTypes: readonly string[], fields: readonly string[], expected: Readonly<Record<string, Position>>): readonly Variant[] => {
  if (!Array.isArray(value) || value.length !== expectedTypes.length) fail("FEC_EFO_LAYOUT_INVALID");
  const result: Variant[] = (value as unknown[]).map((raw: unknown): Variant => { const record = exact(raw, ["fields", "recordType"]); if (typeof record.recordType !== "string") fail("FEC_EFO_LAYOUT_INVALID"); const recordType = record.recordType as string; const map = exact(record.fields, fields); for (const field of fields) if (map[field] !== expected[field]) fail("FEC_EFO_LAYOUT_INVALID"); return { recordType, fields: map as Record<string, Position> }; });
  if (!sorted(result) || result.some((item, index) => item.recordType !== expectedTypes[index])) fail("FEC_EFO_LAYOUT_INVALID"); return result;
};
const f3 = { coverageFromDate: 16, coverageThroughDate: 17, dateSigned: 23, electionCode: 13, filerId: 2, formType: 1, originalAmendmentDate: null, report24Hour48HourCode: null, reportCode: 12 };
const f3x = { coverageFromDate: 14, coverageThroughDate: 15, dateSigned: 22, electionCode: 11, filerId: 2, formType: 1, originalAmendmentDate: null, report24Hour48HourCode: null, reportCode: 10 };
const f24 = { coverageFromDate: null, coverageThroughDate: null, dateSigned: 16, electionCode: null, filerId: 2, formType: 1, originalAmendmentDate: 4, report24Hour48HourCode: 3, reportCode: null };
const f5 = { coverageFromDate: 21, coverageThroughDate: 22, dateSigned: 30, electionCode: null, filerId: 2, formType: 1, originalAmendmentDate: 20, report24Hour48HourCode: 19, reportCode: 18 };
const se = { amount: 21, backReferenceSchedule: 5, backReferenceTransactionId: 4, candidateId: 28, disseminationDate: 20, electionCode: 18, expenditureDate: 22, filerId: 2, formType: 1, memoCode: 43, supportOppose: 27, transactionId: 3 };
const f57 = { amount: 19, backReferenceSchedule: null, backReferenceTransactionId: null, candidateId: 25, disseminationDate: 18, electionCode: 16, expenditureDate: null, filerId: 2, formType: 1, memoCode: null, supportOppose: 24, transactionId: 3 };

/** Strictly decodes the canonical, workbook-bound EFO 8.5 allowlist. */
export function loadFecEfoLayouts(bytes: Uint8Array, expectedWorkbookSha256: string): FecEfoLayout {
  if (bytes.byteLength > MAX_BYTES || !SHA256.test(expectedWorkbookSha256)) fail("FEC_EFO_LAYOUT_UNSUPPORTED");
  let raw: unknown; try { raw = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { return fail("FEC_EFO_LAYOUT_INVALID"); }
  const root = exact(raw, ["characterEncoding", "coverRecords", "delimiter", "evidence", "formatVersion", "hdr", "schemaVersion", "scheduleERecords", "workbookSha256", "workbookSourceLockId"]);
  if (root.schemaVersion !== 1 || root.formatVersion !== "8.5" || root.workbookSha256 !== expectedWorkbookSha256 || root.workbookSourceLockId !== "fec-efo-workbook-v85") fail("FEC_EFO_LAYOUT_UNSUPPORTED");
  if (Buffer.compare(Buffer.from(bytes), encodeFecEfoLayouts(raw)) !== 0) fail("FEC_EFO_LAYOUT_INVALID");
  const encoding = exact(root.characterEncoding, ["structuralFields", "wholeFile"]);
  const delimiter = exact(root.delimiter, ["byte", "source"]);
  const evidence = exact(root.evidence, ["observed", "specification"]);
  if (encoding.structuralFields !== "ASCII" || encoding.wholeFile !== "unspecified") fail("FEC_EFO_LAYOUT_UNSUPPORTED");
  if (delimiter.byte !== 28 || delimiter.source !== DELIMITER_SOURCE) fail("FEC_EFO_LAYOUT_UNSUPPORTED");
  if (evidence.observed !== EVIDENCE.observed || evidence.specification !== EVIDENCE.specification) fail("FEC_EFO_LAYOUT_UNSUPPORTED");
  const hdr = exact(root.hdr, ["fecVersion", "efType", "recordType", "reportId", "reportNumber"]);
  for (const [field, position] of Object.entries(HDR_POSITIONS)) if (hdr[field] !== position) fail("FEC_EFO_LAYOUT_INVALID");
  const covers = exact(root.coverRecords, ["F24", "F3", "F3X", "F5"]); const schedules = exact(root.scheduleERecords, ["F24", "F3X", "F5"]);
  const layout = freeze({ formatVersion: "8.5" as const, hdr: hdr as FecEfoLayout["hdr"], coverRecords: { F3: records(covers.F3, ["F3A", "F3N", "F3T"], coverFields, f3), F3X: records(covers.F3X, ["F3XA", "F3XN", "F3XT"], coverFields, f3x), F24: records(covers.F24, ["F24A", "F24N"], coverFields, f24), F5: records(covers.F5, ["F5A", "F5N", "F5T"], coverFields, f5) }, scheduleERecords: { F3X: records(schedules.F3X, ["SE"], scheduleFields, se), F24: records(schedules.F24, ["SE"], scheduleFields, se), F5: records(schedules.F5, ["F57"], scheduleFields, f57) } });
  validatedLayouts.add(layout);
  return layout;
}

/** True only for the immutable object issued by loadFecEfoLayouts. */
export const isValidatedFecEfoLayout = (value: unknown): value is FecEfoLayout => value !== null && typeof value === "object" && validatedLayouts.has(value);

const moveBefore = (keys: string[], earlier: string, later: string): void => {
  const from = keys.indexOf(earlier), to = keys.indexOf(later);
  if (from >= 0 && to >= 0 && from > to) keys.splice(to, 0, keys.splice(from, 1)[0]!);
};
const canonicalKeys = (record: Record<string, unknown>): string[] => {
  const keys = Object.keys(record).sort();
  moveBefore(keys, "schemaVersion", "scheduleERecords");
  moveBefore(keys, "fecVersion", "efType");
  return keys;
};
const canonicalize = (input: unknown): unknown => {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input === null || typeof input !== "object") return input;
  const record = input as Record<string, unknown>;
  return Object.fromEntries(canonicalKeys(record).map(key => [key, canonicalize(record[key])]));
};

/** Serializes only sorted plain-object JSON, so decoder byte equality rejects coercion and reordering. */
export function encodeFecEfoLayouts(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(canonicalize(value))}\n`);
}
export const fecEfoLayoutsSha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
