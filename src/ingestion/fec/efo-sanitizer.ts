import { createHash } from "node:crypto";
import { types } from "node:util";
import { isValidatedFecEfoLayout, type FecEfoLayout, type FecEfoVariant } from "./efo-layout";
import { decodeFecFilingIdentityV1, encodeFecFilingIdentityV1, fecFilingIdentitySha256, type FecFilingIdentityV1 } from "./filing-ledger";
import { parseSanitizedScheduleERecord, type SanitizedScheduleERecord, validateSanitizedScheduleERecord } from "./schedule-e";
import { isFecReportType } from "./values";

export const FEC_SANITIZED_FILING_SCHEMA = "fec-v2-sanitized-filing-v2" as const;
export type FecSanitizedFilingArtifactV2 = Readonly<{ schemaVersion: 2; artifactKind: "sanitized_filing"; acquisitionPlanSha256: string; fileNumber: number; formatVersion: "8.5"; ledgerIdentitySha256: string; reportDate: string | null; records: readonly SanitizedScheduleERecord[]; noRetention: Readonly<{ rawFilingNotStored: true; nonScheduleERecordsDiscarded: true; piiFieldsDiscarded: true }> }>;
export type FecEfoSanitizerOptions = Readonly<{ planSha256: string; ledgerIdentitySha256: string; layout: FecEfoLayout; identity: FecFilingIdentityV1; fileNumber?: number; reportDate?: string | null; artifactByteLimit?: number; rawByteLimit?: number }>;
export type FecSanitizerContext = Readonly<{ signal: AbortSignal; deadlineMs: number }>;
export type FecEfoSanitizerResult = Readonly<{ artifact: FecSanitizedFilingArtifactV2; upstreamEntitySha256: string; rawByteSize: number }>;
export type FecEfoSanitizer = Readonly<{ consume(chunk: Uint8Array, context?: FecSanitizerContext): void; finalize(context?: FecSanitizerContext): FecEfoSanitizerResult }>;

export const fecEfoSanitizerErrorCodes = ["FEC_EFO_SANITIZER_ABORTED", "FEC_EFO_SANITIZER_DEADLINE", "FEC_EFO_SANITIZER_INVALID", "FEC_EFO_SANITIZER_MALFORMED", "FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT", "FEC_EFO_SANITIZER_LIMIT", "FEC_EFO_SANITIZER_FAILED"] as const;
export type FecEfoSanitizerErrorCode = (typeof fecEfoSanitizerErrorCodes)[number];

const MAX_RAW_BYTES = 16 * 1024 * 1024;
const MAX_RECORD_BYTES = 256 * 1024;
const MAX_FIELD_BYTES = 16 * 1024;
const MAX_RECORDS = 1_000_000;
const MAX_RETAINED_RECORDS = 250_000;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const artifactKeys = ["schemaVersion", "artifactKind", "acquisitionPlanSha256", "fileNumber", "formatVersion", "ledgerIdentitySha256", "reportDate", "records", "noRetention"] as const;
const recordKeys = ["fileNumber", "filerId", "canonicalFormType", "electionCode", "candidateId", "supportOppose", "disseminationDate", "expenditureDate", "amountCents", "transactionIdSha256", "backReferenceIdSha256", "backReferenceScheduleSha256", "memoCode", "noticeCode", "isNotice"] as const;

const fail = (code: FecEfoSanitizerErrorCode): never => { throw new Error(code); };
const isSanitizerCode = (value: unknown): value is FecEfoSanitizerErrorCode => typeof value === "string" && (fecEfoSanitizerErrorCodes as readonly string[]).includes(value);
const errorCode = (error: unknown, fallback: FecEfoSanitizerErrorCode): FecEfoSanitizerErrorCode => error instanceof Error && isSanitizerCode(error.message) ? error.message : fallback;
const checkContext = (context: FecSanitizerContext): void => {
  if (context.signal.aborted) fail("FEC_EFO_SANITIZER_ABORTED");
  if (!Number.isFinite(context.deadlineMs) || Date.now() > context.deadlineMs) fail("FEC_EFO_SANITIZER_DEADLINE");
};
const isDate = (value: unknown): value is string => { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; try { const date = new Date(`${value}T00:00:00.000Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; } catch { return false; } };
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const denseArray = (value: unknown): value is unknown[] => Array.isArray(value) && Object.keys(value).length === value.length && Object.keys(value).every((key, index) => key === String(index));
const ascii = (bytes: Uint8Array): string => {
  let result = "";
  for (const byte of bytes) {
    if (byte < 0x20 || byte > 0x7e) fail("FEC_EFO_SANITIZER_MALFORMED");
    result += String.fromCharCode(byte);
  }
  return result;
};
const field = (fields: readonly Uint8Array[], position: number | null): string | null => {
  if (position === null) return null;
  if (!Number.isSafeInteger(position) || position < 1 || position > fields.length) fail("FEC_EFO_SANITIZER_MALFORMED");
  return ascii(fields[position - 1]!);
};
const isoDate = (value: string): string | null => {
  if (value === "") return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const result = `${value.slice(6)}-${value.slice(0, 2)}-${value.slice(3, 5)}`;
  return isDate(result) ? result : null;
};

const recordWire = (r: SanitizedScheduleERecord) => ({ fileNumber: r.fileNumber, filerId: r.filerId, canonicalFormType: r.canonicalFormType, electionCode: r.electionCode, candidateId: r.candidateId, supportOppose: r.supportOppose, disseminationDate: r.disseminationDate, expenditureDate: r.expenditureDate, amountCents: r.amountCents.toString(), transactionIdSha256: r.transactionIdSha256, backReferenceIdSha256: r.backReferenceIdSha256, backReferenceScheduleSha256: r.backReferenceScheduleSha256, memoCode: r.memoCode, noticeCode: r.noticeCode, isNotice: r.isNotice });
const artifactWire = (a: FecSanitizedFilingArtifactV2) => ({ schemaVersion: a.schemaVersion, artifactKind: a.artifactKind, acquisitionPlanSha256: a.acquisitionPlanSha256, fileNumber: a.fileNumber, formatVersion: a.formatVersion, ledgerIdentitySha256: a.ledgerIdentitySha256, reportDate: a.reportDate, records: a.records.map(recordWire), noRetention: { rawFilingNotStored: true, nonScheduleERecordsDiscarded: true, piiFieldsDiscarded: true } });
const sortKey = (record: SanitizedScheduleERecord): string => JSON.stringify(recordWire(record));

function validateArtifact(raw: unknown, context?: FecSanitizerContext): FecSanitizedFilingArtifactV2 {
  if (context) checkContext(context);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail("FEC_EFO_SANITIZER_INVALID");
  const value = raw as Record<string, unknown>;
  if (!exactKeys(value, artifactKeys) || value.schemaVersion !== 2 || value.artifactKind !== "sanitized_filing" || typeof value.acquisitionPlanSha256 !== "string" || !SHA256.test(value.acquisitionPlanSha256) || !Number.isSafeInteger(value.fileNumber) || (value.fileNumber as number) <= 0 || value.formatVersion !== "8.5" || typeof value.ledgerIdentitySha256 !== "string" || !SHA256.test(value.ledgerIdentitySha256) || !(value.reportDate === null || isDate(value.reportDate)) || !denseArray(value.records) || value.records.length > MAX_RETAINED_RECORDS) fail("FEC_EFO_SANITIZER_INVALID");
  const retention = value.noRetention;
  if (retention === null || typeof retention !== "object" || Array.isArray(retention) || !exactKeys(retention as Record<string, unknown>, ["rawFilingNotStored", "nonScheduleERecordsDiscarded", "piiFieldsDiscarded"]) || (retention as Record<string, unknown>).rawFilingNotStored !== true || (retention as Record<string, unknown>).nonScheduleERecordsDiscarded !== true || (retention as Record<string, unknown>).piiFieldsDiscarded !== true) fail("FEC_EFO_SANITIZER_INVALID");
  const records = (value.records as unknown[]).map((rawRecord: unknown): SanitizedScheduleERecord => {
    if (context) checkContext(context);
    if (rawRecord === null || typeof rawRecord !== "object" || Array.isArray(rawRecord) || !exactKeys(rawRecord as Record<string, unknown>, recordKeys)) fail("FEC_EFO_SANITIZER_INVALID");
    const amount = (rawRecord as Record<string, unknown>).amountCents;
    let normalizedAmount: bigint | undefined;
    if (typeof amount === "bigint" && amount >= BigInt(0)) normalizedAmount = amount;
    else if (typeof amount === "string" && /^(0|[1-9]\d*)$/.test(amount) && amount.length <= 19 && (amount.length < 19 || amount <= "9223372036854775807")) normalizedAmount = BigInt(amount);
    else fail("FEC_EFO_SANITIZER_INVALID");
    if (normalizedAmount === undefined) fail("FEC_EFO_SANITIZER_INVALID");
    try { const r = rawRecord as Record<string, unknown>; return validateSanitizedScheduleERecord({ fileNumber: r.fileNumber, filerId: r.filerId, canonicalFormType: r.canonicalFormType, electionCode: r.electionCode, candidateId: r.candidateId, supportOppose: r.supportOppose, disseminationDate: r.disseminationDate, expenditureDate: r.expenditureDate, amountCents: normalizedAmount, transactionIdSha256: r.transactionIdSha256, backReferenceIdSha256: r.backReferenceIdSha256, backReferenceScheduleSha256: r.backReferenceScheduleSha256, memoCode: r.memoCode, noticeCode: r.noticeCode, isNotice: r.isNotice }); } catch { return fail("FEC_EFO_SANITIZER_INVALID"); }
  });
  if (records.some((record, index) => record.fileNumber !== value.fileNumber || index > 0 && sortKey(records[index - 1]!) > sortKey(record))) fail("FEC_EFO_SANITIZER_INVALID");
  return Object.freeze({ schemaVersion: 2, artifactKind: "sanitized_filing", acquisitionPlanSha256: value.acquisitionPlanSha256 as string, fileNumber: value.fileNumber as number, formatVersion: "8.5", ledgerIdentitySha256: value.ledgerIdentitySha256 as string, reportDate: value.reportDate as string | null, records: Object.freeze(records.map(record => Object.freeze({ ...record }))), noRetention: Object.freeze({ rawFilingNotStored: true, nonScheduleERecordsDiscarded: true, piiFieldsDiscarded: true }) });
}

export function encodeFecSanitizedFilingArtifact(value: FecSanitizedFilingArtifactV2, context?: FecSanitizerContext): Uint8Array {
  const bytes = Buffer.from(`${JSON.stringify(artifactWire(validateArtifact(value, context)))}\n`);
  if (context) checkContext(context);
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) fail("FEC_EFO_SANITIZER_LIMIT");
  return bytes;
}
export function decodeFecSanitizedFilingArtifact(input: Uint8Array, context?: FecSanitizerContext): FecSanitizedFilingArtifactV2 {
  if (context) checkContext(context);
  if (input.byteLength > MAX_ARTIFACT_BYTES) fail("FEC_EFO_SANITIZER_LIMIT");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input)); } catch { fail("FEC_EFO_SANITIZER_INVALID"); }
  const artifact = validateArtifact(raw, context);
  if (!Buffer.from(input).equals(encodeFecSanitizedFilingArtifact(artifact, context))) fail("FEC_EFO_SANITIZER_INVALID");
  return artifact;
}
export const fecSanitizedFilingArtifactSha256 = (value: FecSanitizedFilingArtifactV2, context?: FecSanitizerContext): string => createHash("sha256").update(encodeFecSanitizedFilingArtifact(value, context)).digest("hex");
export const fecSanitizedFilingSha256 = fecSanitizedFilingArtifactSha256;

const optionKeys = ["planSha256", "ledgerIdentitySha256", "layout", "identity", "fileNumber", "reportDate", "artifactByteLimit", "rawByteLimit"] as const;
const contextKeys = ["signal", "deadlineMs"] as const;
/** Read only own data descriptors: accessors and inherited values are never part of a sanitizer capability. */
function plainOwnData(value: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("FEC_EFO_SANITIZER_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  if (Reflect.ownKeys(value as object).some(key => typeof key !== "string" || !allowed.includes(key)) || required.some(key => !(key in descriptors)) || Object.values(descriptors).some(descriptor => !("value" in descriptor) || !descriptor.enumerable)) fail("FEC_EFO_SANITIZER_INVALID");
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}
function snapshotContext(value: FecSanitizerContext): FecSanitizerContext {
  const context = plainOwnData(value, contextKeys, contextKeys);
  if (!context.signal || typeof context.signal !== "object" || typeof (context.signal as AbortSignal).aborted !== "boolean" || !Number.isFinite(context.deadlineMs)) fail("FEC_EFO_SANITIZER_INVALID");
  return Object.freeze({ signal: context.signal as AbortSignal, deadlineMs: context.deadlineMs as number });
}
function validateOptions(options: FecEfoSanitizerOptions): void {
  if (!SHA256.test(options.planSha256) || !SHA256.test(options.ledgerIdentitySha256) || !isValidatedFecEfoLayout(options.layout) || options.ledgerIdentitySha256 !== fecFilingIdentitySha256(options.identity) || !isFecReportType(options.identity.reportType) || !isDate(options.identity.reportDate) && options.identity.reportDate !== null || options.fileNumber !== undefined && options.fileNumber !== options.identity.fileNumber || options.reportDate !== undefined && options.reportDate !== options.identity.reportDate || options.artifactByteLimit !== undefined && (!Number.isSafeInteger(options.artifactByteLimit) || options.artifactByteLimit < 1 || options.artifactByteLimit > MAX_ARTIFACT_BYTES) || options.rawByteLimit !== undefined && (!Number.isSafeInteger(options.rawByteLimit) || options.rawByteLimit < 1 || options.rawByteLimit > MAX_RAW_BYTES)) fail("FEC_EFO_SANITIZER_INVALID");
}
function snapshotOptions(value: FecEfoSanitizerOptions): Readonly<Required<FecEfoSanitizerOptions>> {
  const raw = plainOwnData(value, optionKeys, ["planSha256", "ledgerIdentitySha256", "layout", "identity"]);
  // Reject nested accessors before the identity codec touches it, then detach it canonically.
  const identityRaw = plainOwnData(raw.identity, ["fileNumber", "previousFileNumber", "canonicalFormType", "baseFormType", "reportType", "reportDate", "receiptDate", "coverageStartDate", "coverageEndDate", "amendmentIndicator", "filerId", "committeeId", "electronicStatus", "rawAvailability", "authoritativeAmendmentChain"], ["fileNumber", "previousFileNumber", "canonicalFormType", "baseFormType", "reportType", "reportDate", "receiptDate", "coverageStartDate", "coverageEndDate", "amendmentIndicator", "filerId", "committeeId", "electronicStatus", "rawAvailability", "authoritativeAmendmentChain"]);
  const chain: unknown = identityRaw.authoritativeAmendmentChain;
  if (!Array.isArray(chain) || Object.keys(chain).length !== chain.length || Object.values(Object.getOwnPropertyDescriptors(chain)).some(descriptor => !("value" in descriptor))) fail("FEC_EFO_SANITIZER_INVALID");
  const chainArray = chain as unknown[];
  const identity = decodeFecFilingIdentityV1(encodeFecFilingIdentityV1({ ...identityRaw, authoritativeAmendmentChain: Object.values(Object.getOwnPropertyDescriptors(chainArray)).filter((_, index) => index < chainArray.length).map(descriptor => descriptor.value) } as unknown as FecFilingIdentityV1));
  const options = Object.freeze({ planSha256: raw.planSha256, ledgerIdentitySha256: raw.ledgerIdentitySha256, layout: raw.layout, identity, fileNumber: raw.fileNumber, reportDate: raw.reportDate, artifactByteLimit: raw.artifactByteLimit, rawByteLimit: raw.rawByteLimit }) as FecEfoSanitizerOptions;
  validateOptions(options);
  return Object.freeze({ ...options, fileNumber: options.fileNumber ?? identity.fileNumber, reportDate: options.reportDate ?? identity.reportDate, artifactByteLimit: options.artifactByteLimit ?? MAX_ARTIFACT_BYTES, rawByteLimit: options.rawByteLimit ?? MAX_RAW_BYTES });
}

function splitFields(raw: Uint8Array, check: () => void): Uint8Array[] {
  const fields: Uint8Array[] = [];
  let start = 0;
  for (let index = 0; index <= raw.length; index += 1) {
    if (index % 1024 === 0) check();
    if (index === raw.length || raw[index] === 0x1c) {
      const value = raw.subarray(start, index);
      if (value.length > MAX_FIELD_BYTES) fail("FEC_EFO_SANITIZER_LIMIT");
      fields.push(value);
      start = index + 1;
    }
  }
  return fields;
}

export function createFecEfoSanitizer(options: FecEfoSanitizerOptions, created: FecSanitizerContext): FecEfoSanitizer {
  let creation: FecSanitizerContext; let snapshot: Readonly<Required<FecEfoSanitizerOptions>>;
  try { creation = snapshotContext(created); checkContext(creation); snapshot = snapshotOptions(options); } catch (error) { fail(errorCode(error, "FEC_EFO_SANITIZER_INVALID")); }
  const { identity, layout, planSha256, ledgerIdentitySha256, artifactByteLimit, rawByteLimit } = snapshot!;
  let failed: FecEfoSanitizerErrorCode | undefined;
  let finalized = false;
  let totalBytes = 0;
  const rawHash = createHash("sha256");
  let recordCount = 0;
  let pendingCarriageReturn = false;
  let seenHeader = false;
  let cover: "F3" | "F3X" | "F24" | "F5" | null = null;
  let noticeCode: null | "24" | "48" = null;
  let line: number[] = [];
  const emptyArtifact = { schemaVersion: 2 as const, artifactKind: "sanitized_filing" as const, acquisitionPlanSha256: planSha256, fileNumber: identity.fileNumber, formatVersion: "8.5" as const, ledgerIdentitySha256, reportDate: identity.reportDate, records: [] as SanitizedScheduleERecord[], noRetention: { rawFilingNotStored: true as const, nonScheduleERecordsDiscarded: true as const, piiFieldsDiscarded: true as const } };
  const emptyWire = Buffer.from(`${JSON.stringify(artifactWire(emptyArtifact))}\n`);
  const recordsAt = emptyWire.indexOf("[]", emptyWire.indexOf('"records":'));
  if (recordsAt < 0) fail("FEC_EFO_SANITIZER_FAILED");
  const wirePrefix = Buffer.from(emptyWire.subarray(0, recordsAt + 1));
  const wireSuffix = Buffer.from(emptyWire.subarray(recordsAt + 1));
  emptyWire.fill(0);
  let projectedBytes = wirePrefix.byteLength + wireSuffix.byteLength;
  const retained: { record: SanitizedScheduleERecord; key: Buffer }[] = [];
  const contextFor = (context?: FecSanitizerContext): FecSanitizerContext => context ? snapshotContext(context) : creation!;
  const attempt = (context?: FecSanitizerContext): void => {
    if (failed) fail(failed);
    try { const call = contextFor(context); checkContext(creation!); checkContext(call); if (call.deadlineMs > creation!.deadlineMs) checkContext(creation!); } catch (error) { clearLive(); failed ??= errorCode(error, "FEC_EFO_SANITIZER_FAILED"); fail(failed); }
  };
  const clearLive = (): void => { line.fill(0); line = []; };
  const clearRetained = (): void => { for (const item of retained) item.key.fill(0); retained.length = 0; projectedBytes = wirePrefix.byteLength + wireSuffix.byteLength; };
  const poison = (code: FecEfoSanitizerErrorCode): never => { clearLive(); clearRetained(); failed ??= code; return fail(failed); };
  const coverVariant = (type: "F3" | "F3X" | "F24" | "F5", recordType: string): FecEfoVariant | undefined => layout.coverRecords[type].find(variant => variant.recordType === recordType);
  const scheduleVariant = (type: "F3X" | "F24" | "F5", recordType: string): FecEfoVariant | undefined => layout.scheduleERecords[type].find(variant => variant.recordType === recordType);
  const processCover = (recordType: string, fields: readonly Uint8Array[]): void => {
    const base = recordType.replace(/[NAT]$/, "") as "F3" | "F3X" | "F24" | "F5";
    if (cover) poison("FEC_EFO_SANITIZER_MALFORMED");
    const variant = coverVariant(base, recordType);
    if (!variant) return poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
    const positions = variant.fields;
    if (field(fields, positions.formType) !== recordType || field(fields, positions.filerId) !== identity.filerId || identity.canonicalFormType !== base || identity.baseFormType !== base || identity.amendmentIndicator !== recordType.slice(-1)) poison("FEC_EFO_SANITIZER_MALFORMED");
    if (positions.reportCode !== null && field(fields, positions.reportCode) !== identity.reportType) poison("FEC_EFO_SANITIZER_MALFORMED");
    const from = field(fields, positions.coverageFromDate);
    const through = field(fields, positions.coverageThroughDate);
    const parsedFrom = from === null ? null : isoDate(from), parsedThrough = through === null ? null : isoDate(through);
    if ((from === null) !== (through === null) || from !== null && (parsedFrom === null || parsedThrough === null || parsedFrom !== identity.coverageStartDate || parsedThrough !== identity.coverageEndDate)) poison("FEC_EFO_SANITIZER_MALFORMED");
    const coverNoticeCode = field(fields, positions.report24Hour48HourCode) ?? "";
    if ((base === "F3X" && coverNoticeCode !== "") || (base === "F24" && ((coverNoticeCode !== "24" && coverNoticeCode !== "48") || identity.reportType !== coverNoticeCode)) || (base === "F5" && coverNoticeCode !== "" && coverNoticeCode !== "24" && coverNoticeCode !== "48")) poison("FEC_EFO_SANITIZER_MALFORMED");
    const original = field(fields, positions.originalAmendmentDate);
    if ((original !== null && original !== "" && isoDate(original) === null) || (recordType.endsWith("A") && original === "")) poison("FEC_EFO_SANITIZER_MALFORMED");
    noticeCode = base === "F24" || base === "F5" && coverNoticeCode !== "" ? coverNoticeCode as "24" | "48" : null;
    cover = base;
  };
  const processSchedule = (recordType: string, fields: readonly Uint8Array[]): void => {
    const activeCover = cover;
    if (!activeCover) return poison("FEC_EFO_SANITIZER_MALFORMED");
    if (activeCover === "F3") return poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
    const scheduleCover: "F3X" | "F24" | "F5" = activeCover;
    const variant = scheduleVariant(scheduleCover, recordType);
    if (!variant) return poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
    try {
      const record = parseSanitizedScheduleERecord({ fields, positions: variant.fields, fileNumber: identity.fileNumber, canonicalFormType: scheduleCover, noticeCode });
      if (record.filerId !== identity.filerId || retained.length >= MAX_RETAINED_RECORDS) poison(retained.length >= MAX_RETAINED_RECORDS ? "FEC_EFO_SANITIZER_LIMIT" : "FEC_EFO_SANITIZER_MALFORMED");
      const key = Buffer.from(JSON.stringify(recordWire(record)));
      const nextBytes = projectedBytes + key.byteLength + (retained.length ? 1 : 0);
      if (nextBytes > artifactByteLimit) { key.fill(0); poison("FEC_EFO_SANITIZER_LIMIT"); }
      projectedBytes = nextBytes;
      retained.push({ record, key });
    } catch (error) { poison(errorCode(error, "FEC_EFO_SANITIZER_MALFORMED")); }
  };
  const processRecord = (raw: Uint8Array, context?: FecSanitizerContext): void => {
    attempt(context);
    if (!raw.length) poison("FEC_EFO_SANITIZER_MALFORMED");
    if (++recordCount > MAX_RECORDS) poison("FEC_EFO_SANITIZER_LIMIT");
    const fields = splitFields(raw, () => attempt(context));
    const type = ascii(fields[0] ?? new Uint8Array());
    if (!seenHeader) {
      const header = layout.hdr;
      if (type !== "HDR" || field(fields, header.recordType) !== "HDR" || field(fields, header.efType) !== "FEC" || !/^[-A-Za-z0-9_]{1,128}$/.test(field(fields, header.reportId) ?? "") || !/^[-A-Za-z0-9_]{1,128}$/.test(field(fields, header.reportNumber) ?? "")) poison("FEC_EFO_SANITIZER_MALFORMED");
      const fecVersion = field(fields, header.fecVersion);
      if (!/^\d+\.\d+$/.test(fecVersion ?? "")) poison("FEC_EFO_SANITIZER_MALFORMED");
      if (fecVersion !== "8.5") poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
      seenHeader = true;
    } else if (type === "HDR") poison("FEC_EFO_SANITIZER_MALFORMED");
    else if (type === "SE" || type === "F57") processSchedule(type, fields);
    else if (["F3", "F3X", "F24", "F5"].includes(type.replace(/[NAT]$/, ""))) processCover(type, fields);
    else if (type.startsWith("F3") || type.startsWith("F24") || type.startsWith("F5")) poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
    else if (type.startsWith("SE") || type.startsWith("F57")) poison("FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT");
    else if (type.startsWith("S")) return;
  };
  return {
    consume(chunk, context) {
      if (failed) fail(failed);
      let owned: Uint8Array | undefined;
      try {
        attempt(context);
        if (finalized || !ArrayBuffer.isView(chunk) || Object.prototype.toString.call(chunk) !== "[object Uint8Array]" || types.isSharedArrayBuffer(chunk.buffer)) fail("FEC_EFO_SANITIZER_INVALID");
        if (chunk.byteLength > rawByteLimit - totalBytes) fail("FEC_EFO_SANITIZER_LIMIT");
        owned = Uint8Array.from(chunk);
        rawHash.update(owned); totalBytes += owned.length;
        for (const byte of owned) {
          attempt(context);
          if (pendingCarriageReturn) {
            if (byte !== 0x0a) fail("FEC_EFO_SANITIZER_MALFORMED");
            const detached = Uint8Array.from(line); clearLive(); pendingCarriageReturn = false;
            try { processRecord(detached, context); } finally { detached.fill(0); } continue;
          }
          if (byte === 0x0d) { pendingCarriageReturn = true; continue; }
          if (byte === 0x0a) { const detached = Uint8Array.from(line); clearLive(); try { processRecord(detached, context); } finally { detached.fill(0); } continue; }
          if (byte === 0) fail("FEC_EFO_SANITIZER_MALFORMED");
          line.push(byte);
          if (line.length > MAX_RECORD_BYTES) fail("FEC_EFO_SANITIZER_LIMIT");
        }
      } catch (error) { poison(errorCode(error, "FEC_EFO_SANITIZER_FAILED"));
      } finally { owned?.fill(0); }
    },
    finalize(context) {
      if (failed) fail(failed);
      let canonical: Buffer | undefined;
      try {
        attempt(context);
        if (finalized || pendingCarriageReturn || line.length || !seenHeader || !cover) fail("FEC_EFO_SANITIZER_MALFORMED");
        retained.sort((left, right) => { attempt(context); return Buffer.compare(left.key, right.key); });
        canonical = Buffer.concat([wirePrefix, ...retained.flatMap((item, index) => index ? [Buffer.from(","), item.key] : [item.key]), wireSuffix], projectedBytes);
        if (canonical.byteLength > artifactByteLimit) fail("FEC_EFO_SANITIZER_LIMIT");
        const artifact: FecSanitizedFilingArtifactV2 = Object.freeze({ schemaVersion: 2, artifactKind: "sanitized_filing", acquisitionPlanSha256: planSha256 as string, fileNumber: identity.fileNumber, formatVersion: "8.5", ledgerIdentitySha256: ledgerIdentitySha256 as string, reportDate: identity.reportDate, records: Object.freeze(retained.map(item => Object.freeze({ ...item.record }))), noRetention: Object.freeze({ rawFilingNotStored: true, nonScheduleERecordsDiscarded: true, piiFieldsDiscarded: true }) });
        validateArtifact(artifact, contextFor(context));
        const result = Object.freeze({ artifact, upstreamEntitySha256: rawHash.digest("hex"), rawByteSize: totalBytes });
        finalized = true;
        clearLive(); clearRetained();
        return result;
      } catch (error) { return poison(errorCode(error, "FEC_EFO_SANITIZER_FAILED"));
      } finally { canonical?.fill(0); }
    },
  };
}
