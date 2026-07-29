import { createHash } from "node:crypto";
import { isFecReportType } from "./values";

export const FEC_ENUMERATION_PAGE_SCHEMA = "fec-v2-enumeration-page-v1" as const;
export const FEC_FILING_LEDGER_SCHEMA = "fec-v2-filing-ledger-v1" as const;
export type FecFormType = "F3" | "F3X" | "F24" | "F5";
export type FecPass = 1 | 2;
export type FecFilingIdentityV1 = Readonly<{ fileNumber: number; previousFileNumber: number | null; canonicalFormType: FecFormType; baseFormType: FecFormType; reportType: string; reportDate: string | null; receiptDate: string; coverageStartDate: string | null; coverageEndDate: string | null; amendmentIndicator: "N" | "A" | "T" | null; filerId: string | null; committeeId: string | null; electronicStatus: "electronic" | "paper" | "unknown"; rawAvailability: "available" | "unavailable" | "paper" | "unknown"; authoritativeAmendmentChain: readonly number[] }>;
export type FecEnumerationRecordV1 = Readonly<{ identity: FecFilingIdentityV1; occurrenceIndex: number }>;
export type FecMultiplicity = Readonly<{ entryIdentitySha256: string; count: number }>;
export type FecEnumerationPageV1 = Readonly<{ schema: typeof FEC_ENUMERATION_PAGE_SCHEMA; version: 1; planSha256: string; provenance: { kind: "daily_partition"; formType: FecFormType; receiptDate: string } | { kind: "predecessor_lookup"; formType: FecFormType; requestedFileNumber: number }; pass: FecPass; pageNumber: number; terminal: boolean; records: readonly FecEnumerationRecordV1[]; recordMultiplicity: readonly FecMultiplicity[] }>;
export type FecFilingLedgerEntryV1 = Readonly<{ identity: FecFilingIdentityV1; entryIdentitySha256: string }>;
export type FecFilingLedgerV1 = Readonly<{ schema: typeof FEC_FILING_LEDGER_SCHEMA; version: 1; planSha256: string; entries: readonly FecFilingLedgerEntryV1[]; sourcePageIdentities: readonly string[]; pass1DigestSha256: string; pass2DigestSha256: string; stable: true }>;
export type FecCodecOptions = Readonly<{ signal?: AbortSignal; deadlineMs?: number }>;

const MAX_PAGE_BYTES = 2 * 1024 * 1024, MAX_LEDGER_BYTES = 64 * 1024 * 1024, MAX_RECORDS = 100, MAX_ENTRIES = 2_000_000, MAX_CHAIN = 100, MAX_PAGES = 20_000;
const sha = /^[a-f0-9]{64}$/, date = /^\d{4}-\d{2}-\d{2}$/, identifier = /^[A-Z0-9]{9}$/;
const forms = new Set<FecFormType>(["F3", "F3X", "F24", "F5"]), indicators = new Set(["N", "A", "T"]), statuses = new Set(["electronic", "paper", "unknown"]), availability = new Set(["available", "unavailable", "paper", "unknown"]);
const fail = (code: string): never => { throw new Error(`FEC_LEDGER_${code}`); };
const check = (options?: FecCodecOptions): void => { if (options?.signal?.aborted) fail("ABORTED"); if (options?.deadlineMs !== undefined && (!Number.isFinite(options.deadlineMs) || Date.now() > options.deadlineMs)) fail("DEADLINE"); };
const bytes = (s: string) => Buffer.from(s, "utf8");
const order = (a: string, b: string) => Buffer.compare(bytes(a), bytes(b));
const dense = (x: unknown): x is unknown[] => Array.isArray(x) && Object.keys(x).length === x.length && Object.keys(x).every((k, i) => k === String(i));
const obj = (x: unknown): Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : fail("INVALID");
const exact = (x: Record<string, unknown>, keys: readonly string[]) => { if (Object.keys(x).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(x, k))) fail("UNKNOWN_FIELD"); };
const positive = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
const validDate = (x: unknown, nullable = false): x is string | null => {
  if (nullable && x === null) return true;
  if (typeof x !== "string" || !date.test(x)) return false;
  try { const parsed = new Date(`${x}T00:00:00.000Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === x; } catch { return false; }
};

function identity(raw: unknown, options?: FecCodecOptions): FecFilingIdentityV1 {
  check(options); const x = obj(raw); exact(x, ["fileNumber", "previousFileNumber", "canonicalFormType", "baseFormType", "reportType", "reportDate", "receiptDate", "coverageStartDate", "coverageEndDate", "amendmentIndicator", "filerId", "committeeId", "electronicStatus", "rawAvailability", "authoritativeAmendmentChain"]);
  if (!positive(x.fileNumber) || !(x.previousFileNumber === null || positive(x.previousFileNumber)) || !forms.has(x.canonicalFormType as FecFormType) || !forms.has(x.baseFormType as FecFormType) || !isFecReportType(x.reportType) || !validDate(x.reportDate, true) || !validDate(x.receiptDate) || !validDate(x.coverageStartDate, true) || !validDate(x.coverageEndDate, true) || !(x.amendmentIndicator === null || typeof x.amendmentIndicator === "string" && indicators.has(x.amendmentIndicator)) || !(x.filerId === null || typeof x.filerId === "string" && identifier.test(x.filerId)) || !(x.committeeId === null || typeof x.committeeId === "string" && identifier.test(x.committeeId)) || !statuses.has(x.electronicStatus as string) || !availability.has(x.rawAvailability as string) || !dense(x.authoritativeAmendmentChain) || x.authoritativeAmendmentChain.length > MAX_CHAIN || x.authoritativeAmendmentChain.some(v => !positive(v))) fail("INVALID");
  if ((x.coverageStartDate === null) !== (x.coverageEndDate === null) || (typeof x.coverageStartDate === "string" && typeof x.coverageEndDate === "string" && x.coverageStartDate > x.coverageEndDate)) fail("INVALID");
  const chain = x.authoritativeAmendmentChain as number[]; if (!chain.length || new Set(chain).size !== chain.length || chain.at(-1) !== x.fileNumber || x.previousFileNumber !== (chain.length === 1 ? null : chain.at(-2)!)) fail("INVALID"); check(options);
  return { fileNumber: x.fileNumber as number, previousFileNumber: x.previousFileNumber as number | null, canonicalFormType: x.canonicalFormType as FecFormType, baseFormType: x.baseFormType as FecFormType, reportType: x.reportType as string, reportDate: x.reportDate as string | null, receiptDate: x.receiptDate as string, coverageStartDate: x.coverageStartDate as string | null, coverageEndDate: x.coverageEndDate as string | null, amendmentIndicator: x.amendmentIndicator as "N" | "A" | "T" | null, filerId: x.filerId as string | null, committeeId: x.committeeId as string | null, electronicStatus: x.electronicStatus as FecFilingIdentityV1["electronicStatus"], rawAvailability: x.rawAvailability as FecFilingIdentityV1["rawAvailability"], authoritativeAmendmentChain: [...chain] };
}
const hashed = (domain: string, value: unknown) => createHash("sha256").update(bytes(`${domain}\n${JSON.stringify(value)}\n`)).digest("hex");
/** Canonical identity bytes use this exact key order and end in one newline. */
export function encodeFecFilingIdentityV1(value: FecFilingIdentityV1, options?: FecCodecOptions): Uint8Array { const x = identity(value, options); return bytes(`${JSON.stringify({ fileNumber: x.fileNumber, previousFileNumber: x.previousFileNumber, canonicalFormType: x.canonicalFormType, baseFormType: x.baseFormType, reportType: x.reportType, receiptDate: x.receiptDate, reportDate: x.reportDate, coverageStartDate: x.coverageStartDate, coverageEndDate: x.coverageEndDate, authoritativeAmendmentChain: [...x.authoritativeAmendmentChain], amendmentIndicator: x.amendmentIndicator, filerId: x.filerId, committeeId: x.committeeId, electronicStatus: x.electronicStatus, rawAvailability: x.rawAvailability })}\n`); }
/** Strictly decodes canonical identity bytes and returns a detached immutable snapshot. */
export function decodeFecFilingIdentityV1(input: Uint8Array, options?: FecCodecOptions): FecFilingIdentityV1 {
  check(options); let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)); } catch { return fail("INVALID_JSON"); }
  const parsed = identity(raw, options);
  if (!Buffer.from(input).equals(Buffer.from(encodeFecFilingIdentityV1(parsed, options)))) fail("NONCANONICAL");
  return Object.freeze({ ...parsed, authoritativeAmendmentChain: Object.freeze([...parsed.authoritativeAmendmentChain]) });
}
/** SHA-256 of canonical identity bytes (no domain prefix). */
export const fecFilingIdentitySha256 = (value: FecFilingIdentityV1, options?: FecCodecOptions): string => { check(options); return createHash("sha256").update(encodeFecFilingIdentityV1(value, options)).digest("hex"); };
/** Page identity is deliberately the immutable artifact digest, never its URL or receipt id. */
export const fecSourcePageIdentitySha256 = (artifactSha256: string): string => { if (!sha.test(artifactSha256)) fail("INVALID"); return artifactSha256; };
const multiplicity = (records: readonly FecEnumerationRecordV1[], options?: FecCodecOptions): FecMultiplicity[] => { const counts = new Map<string, number>(); for (const record of records) { check(options); const key = fecFilingIdentitySha256(record.identity, options); counts.set(key, (counts.get(key) ?? 0) + 1); } return [...counts].sort(([a], [b]) => order(a, b)).map(([entryIdentitySha256, count]) => ({ entryIdentitySha256, count })); };
function page(raw: unknown, options?: FecCodecOptions): FecEnumerationPageV1 {
  check(options); const x = obj(raw); exact(x, ["schema", "version", "planSha256", "provenance", "pass", "pageNumber", "terminal", "records", "recordMultiplicity"]); if (x.schema !== FEC_ENUMERATION_PAGE_SCHEMA || x.version !== 1 || typeof x.planSha256 !== "string" || !sha.test(x.planSha256) || (x.pass !== 1 && x.pass !== 2) || !positive(x.pageNumber) || x.pageNumber > 1000 || typeof x.terminal !== "boolean" || !dense(x.records) || x.records.length > MAX_RECORDS || !dense(x.recordMultiplicity) || x.recordMultiplicity.length > MAX_RECORDS) fail("INVALID");
  const p = obj(x.provenance); let provenance: FecEnumerationPageV1["provenance"]; if (p.kind === "daily_partition") { exact(p, ["kind", "formType", "receiptDate"]); if (!forms.has(p.formType as FecFormType) || !validDate(p.receiptDate)) fail("INVALID"); provenance = { kind: "daily_partition", formType: p.formType as FecFormType, receiptDate: p.receiptDate as string }; } else { exact(p, ["kind", "formType", "requestedFileNumber"]); if (p.kind !== "predecessor_lookup" || !forms.has(p.formType as FecFormType) || !positive(p.requestedFileNumber)) fail("INVALID"); provenance = { kind: "predecessor_lookup", formType: p.formType as FecFormType, requestedFileNumber: p.requestedFileNumber as number }; }
  const records = (x.records as unknown[]).map((item, i) => { const r = obj(item); exact(r, ["identity", "occurrenceIndex"]); if (r.occurrenceIndex !== i + 1) fail("INVALID"); return { identity: identity(r.identity, options), occurrenceIndex: r.occurrenceIndex as number }; });
  if (!x.terminal && records.some(record => provenance.kind === "daily_partition"
    ? record.identity.canonicalFormType !== provenance.formType || record.identity.receiptDate !== provenance.receiptDate
    : record.identity.canonicalFormType !== provenance.formType || record.identity.fileNumber !== provenance.requestedFileNumber)) fail("INVALID");
  const expected = multiplicity(records, options), supplied = (x.recordMultiplicity as unknown[]).map(item => { const r = obj(item); exact(r, ["entryIdentitySha256", "count"]); if (typeof r.entryIdentitySha256 !== "string" || !sha.test(r.entryIdentitySha256) || !positive(r.count)) fail("INVALID"); return { entryIdentitySha256: r.entryIdentitySha256, count: r.count }; });
  if (x.terminal !== (records.length === 0 && supplied.length === 0) || JSON.stringify(supplied) !== JSON.stringify(expected)) fail("INVALID"); check(options); return { schema: FEC_ENUMERATION_PAGE_SCHEMA, version: 1, planSha256: x.planSha256 as string, provenance, pass: x.pass as FecPass, pageNumber: x.pageNumber as number, terminal: x.terminal as boolean, records, recordMultiplicity: supplied as FecMultiplicity[] };
}
export function encodeFecEnumerationPage(value: FecEnumerationPageV1, options?: FecCodecOptions): Uint8Array { const parsed = page(value, options); const out = bytes(`${JSON.stringify(parsed)}\n`); check(options); if (out.byteLength > MAX_PAGE_BYTES) fail("INPUT_TOO_LARGE"); return out; }
export function decodeFecEnumerationPage(input: Uint8Array, options?: FecCodecOptions): FecEnumerationPageV1 { check(options); if (input.byteLength > MAX_PAGE_BYTES) fail("INPUT_TOO_LARGE"); let raw: unknown; try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)); } catch { fail("INVALID_JSON"); } check(options); const result = page(raw, options); if (!Buffer.from(input).equals(Buffer.from(encodeFecEnumerationPage(result, options)))) fail("NONCANONICAL"); return result; }
export const fecEnumerationPageSha256 = (value: FecEnumerationPageV1, options?: FecCodecOptions) => createHash("sha256").update(encodeFecEnumerationPage(value, options)).digest("hex");
function ledger(raw: unknown, options?: FecCodecOptions): FecFilingLedgerV1 { check(options); const x = obj(raw); exact(x, ["schema", "version", "planSha256", "entries", "sourcePageIdentities", "pass1DigestSha256", "pass2DigestSha256", "stable"]); if (x.schema !== FEC_FILING_LEDGER_SCHEMA || x.version !== 1 || typeof x.planSha256 !== "string" || !sha.test(x.planSha256) || x.stable !== true || !dense(x.entries) || x.entries.length > MAX_ENTRIES || !dense(x.sourcePageIdentities) || x.sourcePageIdentities.length > MAX_PAGES || typeof x.pass1DigestSha256 !== "string" || !sha.test(x.pass1DigestSha256) || typeof x.pass2DigestSha256 !== "string" || x.pass1DigestSha256 !== x.pass2DigestSha256) fail("INVALID"); let prior = 0; const entries = (x.entries as unknown[]).map(item => { const e = obj(item); exact(e, ["identity", "entryIdentitySha256"]); const i = identity(e.identity, options), hash = fecFilingIdentitySha256(i, options); if (e.entryIdentitySha256 !== hash || (prior && prior >= i.fileNumber)) fail("INVALID"); prior = i.fileNumber; return { identity: i, entryIdentitySha256: hash }; }); const sources = x.sourcePageIdentities as unknown[]; if (sources.some((item, i) => typeof item !== "string" || !sha.test(item) || i && order(sources[i - 1] as string, item) >= 0)) fail("INVALID"); return { schema: FEC_FILING_LEDGER_SCHEMA, version: 1, planSha256: x.planSha256 as string, entries, sourcePageIdentities: [...sources] as string[], pass1DigestSha256: x.pass1DigestSha256 as string, pass2DigestSha256: x.pass2DigestSha256 as string, stable: true }; }
export function encodeFecFilingLedger(value: FecFilingLedgerV1, options?: FecCodecOptions): Uint8Array { const parsed = ledger(value, options), out = bytes(`${JSON.stringify(parsed)}\n`); check(options); if (out.byteLength > MAX_LEDGER_BYTES) fail("INPUT_TOO_LARGE"); return out; }
export function decodeFecFilingLedger(input: Uint8Array, options?: FecCodecOptions): FecFilingLedgerV1 { check(options); if (input.byteLength > MAX_LEDGER_BYTES) fail("INPUT_TOO_LARGE"); let raw: unknown; try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)); } catch { fail("INVALID_JSON"); } const result = ledger(raw, options); if (!Buffer.from(input).equals(Buffer.from(encodeFecFilingLedger(result, options)))) fail("NONCANONICAL"); return result; }
export const fecFilingLedgerSha256 = (value: FecFilingLedgerV1, options?: FecCodecOptions) => createHash("sha256").update(encodeFecFilingLedger(value, options)).digest("hex");
export const occurrenceMultisetEqual = (a: readonly FecEnumerationRecordV1[], b: readonly FecEnumerationRecordV1[]) => JSON.stringify(multiplicity(a)) === JSON.stringify(multiplicity(b));
/**
 * The pass commitment is a multiset commitment: page order and occurrence order
 * cannot affect it, while repeated occurrences remain observable.
 */
export const fecPassOccurrenceDigestSha256 = (records: readonly FecEnumerationRecordV1[], options?: FecCodecOptions): string => {
  check(options);
  return hashed("fec-v2-pass-occurrence-multiset-v1", multiplicity(records, options));
};
/** Compact pass commitment for streaming enumerators: sorted identity multiplicities only. */
export const fecPassMultiplicityDigestSha256 = (counts: ReadonlyMap<string, number>, options?: FecCodecOptions): string => {
  check(options); const value = [...counts].sort(([a], [b]) => order(a, b)).map(([entryIdentitySha256, count]) => {
    if (!sha.test(entryIdentitySha256) || !positive(count)) fail("INVALID"); return { entryIdentitySha256, count };
  });
  return hashed("fec-v2-pass-occurrence-multiset-v1", value);
};
/** Per-page pass-stability commitment; preserves ordered occurrence and URL evidence. */
export const fecPageComparisonDigestSha256 = (value: Readonly<{ provenance: FecEnumerationPageV1["provenance"]; pageNumber: number; terminal: boolean; records: readonly Readonly<{ occurrenceIndex: number; identityHash: string; fecUrl: string | null }>[]; multiplicity: readonly FecMultiplicity[] }>): string => hashed("fec-v2-page-comparison-v1", value);
