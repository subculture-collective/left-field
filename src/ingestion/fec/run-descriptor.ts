import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

const SHA = /^[a-f0-9]{64}$/;
const MAX_CANONICAL_BYTES = 256 * 1024 * 1024;
const MAX_ROW_BYTES = 64 * 1024;
const MAX_RECEIPTS = 2_020_001;
const MAX_PAGES = 20_000;
const MAX_ENTRIES = 2_000_000;
const MAX_LINEAGE = 4_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const compareText = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const invalid = (code: string): never => { throw new Error(code); };
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const jsonLine = (value: unknown): Uint8Array => encoder.encode(`${JSON.stringify(value)}\n`);

type Controls = Readonly<{ signal?: AbortSignal; deadlineMs?: number }>;
function live(options: Controls, prefix: string): void {
  if (options.signal?.aborted) invalid(`${prefix}_ABORTED`);
  if (options.deadlineMs !== undefined && (!Number.isSafeInteger(options.deadlineMs) || Date.now() >= options.deadlineMs)) invalid(`${prefix}_DEADLINE`);
}
function plain(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(code);
  if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length > 0) invalid(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) invalid(code);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid(code);
    result[key] = descriptor.value;
  }
  if (Object.keys(descriptors).some((key) => !keys.includes(key))) invalid(code);
  return result;
}
function dense(value: unknown, limit: number, code: string, options?: Controls, prefix = "FEC_V2_GRAPH"): unknown[] {
  if (!Array.isArray(value) || value.length > limit || Object.getOwnPropertySymbols(value).length > 0) invalid(code);
  const input = value as unknown[];
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const out: unknown[] = [];
  for (let index = 0; index < input.length; index++) {
    if (options) live(options, prefix);
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) invalid(code);
    out.push(descriptor.value);
  }
  if (Object.keys(descriptors).some((key) => key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= input.length))) invalid(code);
  return out;
}
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f]/.test(value);
const isRunId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(value);
const isSha = (value: unknown): value is string => typeof value === "string" && SHA.test(value);
const isPositive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isDecimal = (value: unknown): value is string => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const isInstant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function boundedLine(value: unknown): Uint8Array {
  const bytes = jsonLine(value);
  if (bytes.byteLength > MAX_ROW_BYTES) invalid("FEC_V2_GRAPH_INVALID");
  return bytes;
}

export type FecV2AcquisitionOutcome = Readonly<{ fileNumber: number; entryIdentitySha256: string; outcome: "source_unavailable" | "paper_filing_unreviewed" | "unsupported_layout" | "malformed_filing" }>;
export type FecV2RunDescriptorV1 = Readonly<{ schemaVersion: 1; originRunId: string; originReleaseId: string; acquisitionPlanSha256: string; receiptCutoff: "2026-07-18"; artifactReceiptIds: readonly string[]; sourceSnapshotId: string; acquisitionOutcomes: readonly FecV2AcquisitionOutcome[]; operationalFailures: readonly []; closureCandidates: readonly [] }>;

function normalizeDescriptor(value: unknown): FecV2RunDescriptorV1 {
  const root = plain(value, ["schemaVersion", "originRunId", "originReleaseId", "acquisitionPlanSha256", "receiptCutoff", "artifactReceiptIds", "sourceSnapshotId", "acquisitionOutcomes", "operationalFailures", "closureCandidates"], "FEC_V2_RUN_DESCRIPTOR_UNKNOWN_FIELD");
  if (root.schemaVersion !== 1 || !isRunId(root.originRunId) || !isId(root.originReleaseId) || !isSha(root.acquisitionPlanSha256) || root.receiptCutoff !== "2026-07-18" || !isId(root.sourceSnapshotId)) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
  const receiptValues = dense(root.artifactReceiptIds, MAX_RECEIPTS, "FEC_V2_RUN_DESCRIPTOR_INVALID");
  const receiptIds: string[] = []; let estimatedBytes = 1024;
  for (const receipt of receiptValues) if (!isId(receipt)) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID"); else { estimatedBytes += Buffer.byteLength(receipt) + 4; if (estimatedBytes > MAX_CANONICAL_BYTES) invalid("FEC_V2_RUN_DESCRIPTOR_TOO_LARGE"); receiptIds.push(receipt); }
  for (let index = 1; index < receiptIds.length; index++) if (compareText(receiptIds[index - 1]!, receiptIds[index]!) >= 0) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
  const outcomes: FecV2AcquisitionOutcome[] = [];
  for (const raw of dense(root.acquisitionOutcomes, MAX_ENTRIES, "FEC_V2_RUN_DESCRIPTOR_INVALID")) {
    const row = plain(raw, ["fileNumber", "entryIdentitySha256", "outcome"], "FEC_V2_RUN_DESCRIPTOR_INVALID");
    if (!isPositive(row.fileNumber) || !isSha(row.entryIdentitySha256) || typeof row.outcome !== "string" || !["source_unavailable", "paper_filing_unreviewed", "unsupported_layout", "malformed_filing"].includes(row.outcome)) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
    estimatedBytes += 180; if (estimatedBytes > MAX_CANONICAL_BYTES) invalid("FEC_V2_RUN_DESCRIPTOR_TOO_LARGE");
    outcomes.push({ fileNumber: row.fileNumber as number, entryIdentitySha256: row.entryIdentitySha256 as string, outcome: row.outcome as FecV2AcquisitionOutcome["outcome"] });
  }
  for (let index = 1; index < outcomes.length; index++) {
    const prior = outcomes[index - 1]!, current = outcomes[index]!;
    if (prior.fileNumber > current.fileNumber || (prior.fileNumber === current.fileNumber && compareText(prior.entryIdentitySha256, current.entryIdentitySha256) >= 0)) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
  }
  if (dense(root.operationalFailures, 0, "FEC_V2_RUN_DESCRIPTOR_INVALID").length || dense(root.closureCandidates, 0, "FEC_V2_RUN_DESCRIPTOR_INVALID").length) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
  return deepFreeze({ schemaVersion: 1, originRunId: root.originRunId as string, originReleaseId: root.originReleaseId as string, acquisitionPlanSha256: root.acquisitionPlanSha256 as string, receiptCutoff: "2026-07-18", artifactReceiptIds: receiptIds, sourceSnapshotId: root.sourceSnapshotId as string, acquisitionOutcomes: outcomes, operationalFailures: [], closureCandidates: [] });
}
export function encodeFecV2RunDescriptor(value: FecV2RunDescriptorV1): Uint8Array {
  const bytes = jsonLine(normalizeDescriptor(value));
  if (bytes.byteLength > MAX_CANONICAL_BYTES) invalid("FEC_V2_RUN_DESCRIPTOR_TOO_LARGE");
  return bytes;
}
export const fecV2RunDescriptorSha256 = (value: FecV2RunDescriptorV1): string => sha256(encodeFecV2RunDescriptor(value));
export function decodeFecV2RunDescriptor(bytes: Uint8Array): FecV2RunDescriptorV1 {
  if (!ArrayBuffer.isView(bytes) || bytes.BYTES_PER_ELEMENT !== 1 || utilTypes.isSharedArrayBuffer(bytes.buffer) || bytes.byteLength > MAX_CANONICAL_BYTES) invalid("FEC_V2_RUN_DESCRIPTOR_INVALID");
  let parsed: unknown;
  try { parsed = JSON.parse(decoder.decode(bytes)); } catch { return invalid("FEC_V2_RUN_DESCRIPTOR_INVALID_JSON"); }
  const result = normalizeDescriptor(parsed);
  if (!Buffer.from(bytes).equals(encodeFecV2RunDescriptor(result))) invalid("FEC_V2_RUN_DESCRIPTOR_NONCANONICAL");
  return result;
}
export function fecV2SnapshotId(originReleaseId: string, planSha256: string, originRunId: string): string {
  if (!isId(originReleaseId) || !isSha(planSha256) || !isRunId(originRunId)) invalid("FEC_V2_SNAPSHOT_ID_INVALID");
  return `fecv2snap_${sha256(jsonLine({ schemaVersion: 1, originReleaseId, planSha256, originRunId })).slice(0, 32)}`;
}

export type FecV2SnapshotGraphRow = Readonly<{ planSha256: string; id: string; sourceId: string; sourceUrl: string; publishedAt: null; retrievedAt: string; checksumSha256: string; parserVersion: string; license: string }>;
export type FecV2SnapshotMetadataGraphRow = Readonly<{ snapshotId: string; planSha256: string; originReleaseId: string; receiptSetDigestSha256: string }>;
export type FecV2ArtifactGraphRow = Readonly<{ planSha256: string; artifactSha256: string; artifactKind: "enumeration_page" | "filing_ledger" | "sanitized_filing"; canonicalByteSize: bigint; createdAt: string }>;
export type FecV2ReceiptGraphRow = Readonly<{ planSha256: string; receiptId: string; artifactSha256: string; artifactKind: "enumeration_page" | "filing_ledger" | "sanitized_filing"; canonicalByteSize: bigint; upstreamEntitySha256: string | null; objectKey: string; versionId: string; etag: string; byteSize: bigint; retrievedAt: string; snapshotId: string }>;
export type FecV2EnumerationPageGraphRow = Readonly<{ planSha256: string; artifactSha256: string; artifactKind: "enumeration_page"; pass: 1 | 2; formType: "F3" | "F3X" | "F24" | "F5"; receiptDate: string | null; requestedFileNumber: number | null; pageNumber: number; terminal: boolean }>;
export type FecV2LedgerHeaderGraphRow = Readonly<{ planSha256: string; ledgerSha256: string; artifactKind: "filing_ledger"; stable: true }>;
export type FecV2LedgerEntryGraphRow = Readonly<{ planSha256: string; ledgerSha256: string; fileNumber: number; entryIdentitySha256: string; canonicalFormType: "F3" | "F3X" | "F24" | "F5"; baseFormType: "F3" | "F3X" | "F24" | "F5"; reportType: string; reportDate: string | null; receiptDate: string; coverageStart: string | null; coverageEnd: string | null; amendmentIndicator: "N" | "A" | "T" | null; filerId: string | null; committeeId: string | null; electronicStatus: "electronic" | "paper" | "unknown"; rawSourceAvailability: "available" | "unavailable" | "paper" | "unknown" }>;
export type FecV2PageLineageGraphRow = Readonly<{ planSha256: string; ledgerSha256: string; fileNumber: number; entryIdentitySha256: string; pageSha256: string; pass: 1 | 2; occurrenceIndex: number }>;
export type FecV2AmendmentLinkGraphRow = Readonly<{ planSha256: string; ledgerSha256: string; fileNumber: number; entryIdentitySha256: string; predecessorFileNumber: number }>;
export type FecV2SanitizedFilingGraphRow = Readonly<{ planSha256: string; artifactSha256: string; artifactKind: "sanitized_filing"; fileNumber: number; ledgerSha256: string; ledgerIdentitySha256: string; reportDate: string | null }>;
export type FecV2AcquisitionOutcomeGraphRow = Readonly<{ planSha256: string; ledgerSha256: string; fileNumber: number; entryIdentitySha256: string; outcome: FecV2AcquisitionOutcome["outcome"] }>;
export type FecV2AcquisitionReceiptIdGraphRow = Readonly<{ receiptId: string }>;
export type FecV2AcquisitionGraphProjection = Readonly<{
  snapshot: readonly FecV2SnapshotGraphRow[]; snapshotMetadata: readonly FecV2SnapshotMetadataGraphRow[]; artifacts: readonly FecV2ArtifactGraphRow[]; receipts: readonly FecV2ReceiptGraphRow[]; enumerationPages: readonly FecV2EnumerationPageGraphRow[]; ledgerHeader: readonly FecV2LedgerHeaderGraphRow[]; ledgerEntries: readonly FecV2LedgerEntryGraphRow[]; pageLineage: readonly FecV2PageLineageGraphRow[]; amendmentLinks: readonly FecV2AmendmentLinkGraphRow[]; sanitizedFilings: readonly FecV2SanitizedFilingGraphRow[]; alternateScoping: readonly []; acquisitionOutcomes: readonly FecV2AcquisitionOutcomeGraphRow[]; acquisitionReceiptIds: readonly FecV2AcquisitionReceiptIdGraphRow[];
}>;

function encodeSnapshot(value: unknown): { row: FecV2SnapshotGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "id", "sourceId", "sourceUrl", "publishedAt", "retrievedAt", "checksumSha256", "parserVersion", "license"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isId(row.id) || row.sourceId !== "src_fec" || row.sourceUrl !== "https://api.open.fec.gov/v1/filings/" || row.publishedAt !== null || !isInstant(row.retrievedAt) || !isSha(row.checksumSha256) || row.parserVersion !== "fec-receipt-cutoff-v2" || row.license !== "public") invalid("FEC_V2_GRAPH_INVALID");
  const normalized = { planSha256: row.planSha256, id: row.id, sourceId: row.sourceId, sourceUrl: row.sourceUrl, publishedAt: null, retrievedAt: row.retrievedAt, checksumSha256: row.checksumSha256, parserVersion: row.parserVersion, license: row.license } as FecV2SnapshotGraphRow;
  return { row: normalized, bytes: boundedLine(normalized) };
}
function encodeSnapshotMetadata(value: unknown): { row: FecV2SnapshotMetadataGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["snapshotId", "planSha256", "originReleaseId", "receiptSetDigestSha256"], "FEC_V2_GRAPH_INVALID");
  if (!isId(row.snapshotId) || !isSha(row.planSha256) || !isId(row.originReleaseId) || !isSha(row.receiptSetDigestSha256)) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = { snapshotId: row.snapshotId, planSha256: row.planSha256, originReleaseId: row.originReleaseId, receiptSetDigestSha256: row.receiptSetDigestSha256 } as FecV2SnapshotMetadataGraphRow;
  return { row: normalized, bytes: boundedLine(normalized) };
}
function encodeArtifact(value: unknown): { row: FecV2ArtifactGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "artifactSha256", "artifactKind", "canonicalByteSize", "createdAt"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.artifactSha256) || typeof row.artifactKind !== "string" || !["enumeration_page", "filing_ledger", "sanitized_filing"].includes(row.artifactKind) || typeof row.canonicalByteSize !== "bigint" || row.canonicalByteSize <= BigInt(0) || !isInstant(row.createdAt)) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = { planSha256: row.planSha256, artifactSha256: row.artifactSha256, artifactKind: row.artifactKind, canonicalByteSize: row.canonicalByteSize, createdAt: row.createdAt } as FecV2ArtifactGraphRow;
  const wire = { planSha256: normalized.planSha256, artifactSha256: normalized.artifactSha256, artifactKind: normalized.artifactKind, canonicalByteSize: normalized.canonicalByteSize.toString(), createdAt: row.createdAt };
  return { row: normalized, bytes: boundedLine(wire) };
}
function encodeReceipt(value: unknown): { row: FecV2ReceiptGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "receiptId", "artifactSha256", "artifactKind", "canonicalByteSize", "upstreamEntitySha256", "objectKey", "versionId", "etag", "byteSize", "retrievedAt", "snapshotId"], "FEC_V2_GRAPH_INVALID");
  const kind = row.artifactKind;
  if (!isSha(row.planSha256) || !isId(row.receiptId) || !isSha(row.artifactSha256) || typeof kind !== "string" || !["enumeration_page", "filing_ledger", "sanitized_filing"].includes(kind) || typeof row.canonicalByteSize !== "bigint" || row.canonicalByteSize <= BigInt(0) || typeof row.byteSize !== "bigint" || row.byteSize !== row.canonicalByteSize || !isId(row.objectKey) || !isId(row.versionId) || row.versionId === "null" || !isId(row.etag) || !isInstant(row.retrievedAt) || !isId(row.snapshotId)) invalid("FEC_V2_GRAPH_INVALID");
  if ((kind === "filing_ledger" && row.upstreamEntitySha256 !== null) || (kind !== "filing_ledger" && !isSha(row.upstreamEntitySha256))) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = { planSha256: row.planSha256, receiptId: row.receiptId, artifactSha256: row.artifactSha256, artifactKind: kind, canonicalByteSize: row.canonicalByteSize, upstreamEntitySha256: row.upstreamEntitySha256, objectKey: row.objectKey, versionId: row.versionId, etag: row.etag, byteSize: row.byteSize, retrievedAt: row.retrievedAt, snapshotId: row.snapshotId } as FecV2ReceiptGraphRow;
  return { row: normalized, bytes: boundedLine({ ...normalized, canonicalByteSize: normalized.canonicalByteSize.toString(), byteSize: normalized.byteSize.toString() }) };
}
function encodePage(value: unknown): { row: FecV2EnumerationPageGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "artifactSha256", "artifactKind", "pass", "formType", "receiptDate", "requestedFileNumber", "pageNumber", "terminal"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.artifactSha256) || row.artifactKind !== "enumeration_page" || (row.pass !== 1 && row.pass !== 2) || typeof row.formType !== "string" || !["F3", "F3X", "F24", "F5"].includes(row.formType) || !isPositive(row.pageNumber) || typeof row.terminal !== "boolean") invalid("FEC_V2_GRAPH_INVALID");
  if ((row.receiptDate === null) === (row.requestedFileNumber === null) || (row.receiptDate !== null && !isDate(row.receiptDate)) || (row.requestedFileNumber !== null && !isPositive(row.requestedFileNumber))) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2EnumerationPageGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, artifactSha256: row.artifactSha256, artifactKind: "enumeration_page", pass: row.pass, formType: row.formType, receiptDate: row.receiptDate, requestedFileNumber: row.requestedFileNumber, pageNumber: row.pageNumber, terminal: row.terminal }) };
}
function encodeLedgerHeader(value: unknown): { row: FecV2LedgerHeaderGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "ledgerSha256", "artifactKind", "stable"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.ledgerSha256) || row.artifactKind !== "filing_ledger" || row.stable !== true) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2LedgerHeaderGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, ledgerSha256: row.ledgerSha256, artifactKind: "filing_ledger", stable: true }) };
}
function encodeLedgerEntry(value: unknown): { row: FecV2LedgerEntryGraphRow; bytes: Uint8Array } {
  const keys = ["planSha256", "ledgerSha256", "fileNumber", "entryIdentitySha256", "canonicalFormType", "baseFormType", "reportType", "reportDate", "receiptDate", "coverageStart", "coverageEnd", "amendmentIndicator", "filerId", "committeeId", "electronicStatus", "rawSourceAvailability"] as const;
  const row = plain(value, keys, "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.ledgerSha256) || !isPositive(row.fileNumber) || !isSha(row.entryIdentitySha256) || typeof row.canonicalFormType !== "string" || !["F3", "F3X", "F24", "F5"].includes(row.canonicalFormType) || typeof row.baseFormType !== "string" || !["F3", "F3X", "F24", "F5"].includes(row.baseFormType) || typeof row.reportType !== "string" || !/^[A-Z0-9]{1,8}$/.test(row.reportType) || (row.reportDate !== null && !isDate(row.reportDate)) || !isDate(row.receiptDate) || ((row.coverageStart === null) !== (row.coverageEnd === null)) || (row.coverageStart !== null && (!isDate(row.coverageStart) || !isDate(row.coverageEnd) || row.coverageStart > row.coverageEnd)) || (row.amendmentIndicator !== null && (typeof row.amendmentIndicator !== "string" || !["N", "A", "T"].includes(row.amendmentIndicator))) || (row.filerId !== null && (typeof row.filerId !== "string" || !/^[A-Z0-9]{9}$/.test(row.filerId))) || (row.committeeId !== null && (typeof row.committeeId !== "string" || !/^[A-Z0-9]{9}$/.test(row.committeeId))) || typeof row.electronicStatus !== "string" || !["electronic", "paper", "unknown"].includes(row.electronicStatus) || typeof row.rawSourceAvailability !== "string" || !["available", "unavailable", "paper", "unknown"].includes(row.rawSourceAvailability)) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2LedgerEntryGraphRow;
  const wire: Record<string, unknown> = {}; for (const key of keys) wire[key] = row[key];
  return { row: normalized, bytes: boundedLine(wire) };
}
function encodeLineage(value: unknown): { row: FecV2PageLineageGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "ledgerSha256", "fileNumber", "entryIdentitySha256", "pageSha256", "pass", "occurrenceIndex"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.ledgerSha256) || !isPositive(row.fileNumber) || !isSha(row.entryIdentitySha256) || !isSha(row.pageSha256) || (row.pass !== 1 && row.pass !== 2) || !isPositive(row.occurrenceIndex) || row.occurrenceIndex > 100) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2PageLineageGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, ledgerSha256: row.ledgerSha256, fileNumber: row.fileNumber, pageSha256: row.pageSha256, pass: row.pass, occurrenceIndex: row.occurrenceIndex }) };
}
function encodeAmendment(value: unknown): { row: FecV2AmendmentLinkGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "ledgerSha256", "fileNumber", "entryIdentitySha256", "predecessorFileNumber"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.ledgerSha256) || !isPositive(row.fileNumber) || !isSha(row.entryIdentitySha256) || !isPositive(row.predecessorFileNumber) || row.fileNumber === row.predecessorFileNumber) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2AmendmentLinkGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, ledgerSha256: row.ledgerSha256, fileNumber: row.fileNumber, predecessorFileNumber: row.predecessorFileNumber }) };
}
function encodeSanitized(value: unknown): { row: FecV2SanitizedFilingGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "artifactSha256", "artifactKind", "fileNumber", "ledgerSha256", "ledgerIdentitySha256", "reportDate"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.artifactSha256) || row.artifactKind !== "sanitized_filing" || !isPositive(row.fileNumber) || !isSha(row.ledgerSha256) || !isSha(row.ledgerIdentitySha256) || (row.reportDate !== null && !isDate(row.reportDate))) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2SanitizedFilingGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, artifactSha256: row.artifactSha256, artifactKind: "sanitized_filing", fileNumber: row.fileNumber, ledgerSha256: row.ledgerSha256, ledgerIdentitySha256: row.ledgerIdentitySha256, reportDate: row.reportDate }) };
}
function encodeOutcome(value: unknown): { row: FecV2AcquisitionOutcomeGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["planSha256", "ledgerSha256", "fileNumber", "entryIdentitySha256", "outcome"], "FEC_V2_GRAPH_INVALID");
  if (!isSha(row.planSha256) || !isSha(row.ledgerSha256) || !isPositive(row.fileNumber) || !isSha(row.entryIdentitySha256) || typeof row.outcome !== "string" || !["source_unavailable", "paper_filing_unreviewed", "unsupported_layout", "malformed_filing"].includes(row.outcome)) invalid("FEC_V2_GRAPH_INVALID");
  const normalized = row as FecV2AcquisitionOutcomeGraphRow;
  return { row: normalized, bytes: boundedLine({ planSha256: row.planSha256, ledgerSha256: row.ledgerSha256, fileNumber: row.fileNumber, entryIdentitySha256: row.entryIdentitySha256, outcome: row.outcome }) };
}
function encodeSelected(value: unknown): { row: FecV2AcquisitionReceiptIdGraphRow; bytes: Uint8Array } {
  const row = plain(value, ["receiptId"], "FEC_V2_GRAPH_INVALID"); if (!isId(row.receiptId)) invalid("FEC_V2_GRAPH_INVALID");
  const normalized: FecV2AcquisitionReceiptIdGraphRow = { receiptId: row.receiptId as string };
  return { row: normalized, bytes: boundedLine(normalized) };
}

const graphTables = ["snapshot", "snapshotMetadata", "artifacts", "receipts", "enumerationPages", "ledgerHeader", "ledgerEntries", "pageLineage", "amendmentLinks", "sanitizedFilings", "alternateScoping", "acquisitionOutcomes", "acquisitionReceiptIds"] as const;
type GraphTable = typeof graphTables[number];
function boundaryBytes(table: GraphTable): Uint8Array { return boundedLine({ schemaVersion: 1, table }); }
function chain(state: Uint8Array, unit: Uint8Array): Uint8Array { return createHash("sha256").update(state).update(createHash("sha256").update(unit).digest()).digest(); }
function numericThenText(aNumber: number, aText: string, bNumber: number, bText: string): number { return aNumber - bNumber || compareText(aText, bText); }
function encodeRows<T>(value: unknown, limit: number, encode: (row: unknown) => T, options: Controls): T[] {
  live(options, "FEC_V2_GRAPH");
  const source = dense(value, limit, "FEC_V2_GRAPH_INVALID", options), rows: T[] = [];
  for (const row of source) { live(options, "FEC_V2_GRAPH"); rows.push(encode(row)); }
  return rows;
}

export function fecV2AcquisitionGraphSha256(graph: FecV2AcquisitionGraphProjection, options: Controls = {}): string {
  const root = plain(graph, graphTables, "FEC_V2_GRAPH_INVALID");
  const snapshots = encodeRows(root.snapshot, 1, encodeSnapshot, options);
  const metadata = encodeRows(root.snapshotMetadata, 1, encodeSnapshotMetadata, options);
  const artifacts = encodeRows(root.artifacts, MAX_RECEIPTS, encodeArtifact, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return compareText(a.row.artifactSha256, b.row.artifactSha256); });
  const receipts = encodeRows(root.receipts, MAX_RECEIPTS, encodeReceipt, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return compareText(a.row.receiptId, b.row.receiptId); });
  const pages = encodeRows(root.enumerationPages, MAX_PAGES, encodePage, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return compareText(a.row.artifactSha256, b.row.artifactSha256); });
  const headers = encodeRows(root.ledgerHeader, 1, encodeLedgerHeader, options);
  const entries = encodeRows(root.ledgerEntries, MAX_ENTRIES, encodeLedgerEntry, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return numericThenText(a.row.fileNumber, a.row.entryIdentitySha256, b.row.fileNumber, b.row.entryIdentitySha256); });
  const lineage = encodeRows(root.pageLineage, MAX_LINEAGE, encodeLineage, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return a.row.fileNumber - b.row.fileNumber || a.row.pass - b.row.pass || compareText(a.row.pageSha256, b.row.pageSha256) || a.row.occurrenceIndex - b.row.occurrenceIndex; });
  const amendments = encodeRows(root.amendmentLinks, MAX_ENTRIES, encodeAmendment, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return a.row.fileNumber - b.row.fileNumber || a.row.predecessorFileNumber - b.row.predecessorFileNumber; });
  const sanitized = encodeRows(root.sanitizedFilings, MAX_ENTRIES, encodeSanitized, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return a.row.fileNumber - b.row.fileNumber || compareText(a.row.artifactSha256, b.row.artifactSha256); });
  if (dense(root.alternateScoping, 0, "FEC_V2_GRAPH_INVALID", options).length) invalid("FEC_V2_GRAPH_INVALID");
  const outcomes = encodeRows(root.acquisitionOutcomes, MAX_ENTRIES, encodeOutcome, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return numericThenText(a.row.fileNumber, a.row.entryIdentitySha256, b.row.fileNumber, b.row.entryIdentitySha256); });
  const selected = encodeRows(root.acquisitionReceiptIds, MAX_RECEIPTS, encodeSelected, options).sort((a, b) => { live(options, "FEC_V2_GRAPH"); return compareText(a.row.receiptId, b.row.receiptId); });
  live(options, "FEC_V2_GRAPH");
  if (snapshots.length !== 1 || metadata.length !== 1 || headers.length !== 1) invalid("FEC_V2_GRAPH_INVALID");
  const snapshot = snapshots[0]!.row, meta = metadata[0]!.row, header = headers[0]!.row;
  if (snapshot.planSha256 !== meta.planSha256 || snapshot.id !== meta.snapshotId || snapshot.checksumSha256 !== meta.receiptSetDigestSha256 || header.planSha256 !== snapshot.planSha256) invalid("FEC_V2_GRAPH_INVALID");
  const artifactByHash = new Map<string, FecV2ArtifactGraphRow>(); for (const item of artifacts) { live(options, "FEC_V2_GRAPH"); if (item.row.planSha256 !== snapshot.planSha256 || artifactByHash.has(item.row.artifactSha256)) invalid("FEC_V2_GRAPH_INVALID"); artifactByHash.set(item.row.artifactSha256, item.row); }
  const receiptIds = new Set<string>(), receiptArtifacts = new Set<string>();
  for (const item of receipts) { const row = item.row, artifact = artifactByHash.get(row.artifactSha256); if (!artifact || row.planSha256 !== snapshot.planSha256 || row.snapshotId !== snapshot.id || artifact.planSha256 !== snapshot.planSha256 || artifact.artifactKind !== row.artifactKind || artifact.canonicalByteSize !== row.canonicalByteSize || receiptIds.has(row.receiptId)) invalid("FEC_V2_GRAPH_INVALID"); receiptIds.add(row.receiptId); receiptArtifacts.add(row.artifactSha256); }
  if (receiptArtifacts.size !== artifactByHash.size || artifacts.some((item) => !receiptArtifacts.has(item.row.artifactSha256))) invalid("FEC_V2_GRAPH_INVALID");
  const selectedIds = new Set<string>(); for (const item of selected) { if (!receiptIds.has(item.row.receiptId) || selectedIds.has(item.row.receiptId)) invalid("FEC_V2_GRAPH_INVALID"); selectedIds.add(item.row.receiptId); }
  if (selectedIds.size !== receiptIds.size || receipts.some((item) => !selectedIds.has(item.row.receiptId))) invalid("FEC_V2_GRAPH_INVALID");
  const pageHashes = new Set<string>(); for (const item of pages) { live(options, "FEC_V2_GRAPH"); const artifact = artifactByHash.get(item.row.artifactSha256); if (!artifact || artifact.artifactKind !== "enumeration_page" || item.row.planSha256 !== snapshot.planSha256 || pageHashes.has(item.row.artifactSha256)) invalid("FEC_V2_GRAPH_INVALID"); pageHashes.add(item.row.artifactSha256); }
  const enumerationArtifacts = artifacts.filter((item) => item.row.artifactKind === "enumeration_page"); if (enumerationArtifacts.length !== pageHashes.size || enumerationArtifacts.some((item) => !pageHashes.has(item.row.artifactSha256))) invalid("FEC_V2_GRAPH_INVALID");
  const ledgerArtifact = artifactByHash.get(header.ledgerSha256); if (!ledgerArtifact || ledgerArtifact.planSha256 !== snapshot.planSha256 || ledgerArtifact.artifactKind !== "filing_ledger") invalid("FEC_V2_GRAPH_INVALID");
  if (artifacts.filter((item) => item.row.artifactKind === "filing_ledger").length !== 1) invalid("FEC_V2_GRAPH_INVALID");
  const entryByFile = new Map<number, FecV2LedgerEntryGraphRow>(); for (const item of entries) { live(options, "FEC_V2_GRAPH"); if (item.row.planSha256 !== snapshot.planSha256 || item.row.ledgerSha256 !== header.ledgerSha256 || entryByFile.has(item.row.fileNumber)) invalid("FEC_V2_GRAPH_INVALID"); entryByFile.set(item.row.fileNumber, item.row); }
  const lineageKeys = new Set<string>(); for (const item of lineage) { live(options, "FEC_V2_GRAPH"); const entry = entryByFile.get(item.row.fileNumber), natural = `${item.row.fileNumber}\0${item.row.pass}\0${item.row.pageSha256}\0${item.row.occurrenceIndex}`; if (!entry || lineageKeys.has(natural) || item.row.planSha256 !== snapshot.planSha256 || item.row.ledgerSha256 !== header.ledgerSha256 || item.row.entryIdentitySha256 !== entry.entryIdentitySha256 || !pageHashes.has(item.row.pageSha256)) invalid("FEC_V2_GRAPH_INVALID"); lineageKeys.add(natural); }
  const amendmentKeys = new Set<string>(); for (const item of amendments) { live(options, "FEC_V2_GRAPH"); const entry = entryByFile.get(item.row.fileNumber), natural = `${item.row.fileNumber}\0${item.row.predecessorFileNumber}`; if (!entry || amendmentKeys.has(natural) || item.row.planSha256 !== snapshot.planSha256 || item.row.ledgerSha256 !== header.ledgerSha256 || item.row.entryIdentitySha256 !== entry.entryIdentitySha256 || !entryByFile.has(item.row.predecessorFileNumber)) invalid("FEC_V2_GRAPH_INVALID"); amendmentKeys.add(natural); }
  const terminalByFile = new Set<number>();
  for (const item of sanitized) { live(options, "FEC_V2_GRAPH"); const row = item.row, entry = entryByFile.get(row.fileNumber), artifact = artifactByHash.get(row.artifactSha256); if (!entry || terminalByFile.has(row.fileNumber) || row.planSha256 !== snapshot.planSha256 || row.ledgerSha256 !== header.ledgerSha256 || row.ledgerIdentitySha256 !== entry.entryIdentitySha256 || !artifact || artifact.planSha256 !== snapshot.planSha256 || artifact.artifactKind !== "sanitized_filing") invalid("FEC_V2_GRAPH_INVALID"); terminalByFile.add(row.fileNumber); }
  const sanitizedArtifacts = artifacts.filter((item) => item.row.artifactKind === "sanitized_filing"); if (sanitizedArtifacts.length !== sanitized.length || sanitizedArtifacts.some((item) => !sanitized.some((row) => row.row.artifactSha256 === item.row.artifactSha256))) invalid("FEC_V2_GRAPH_INVALID");
  for (const item of outcomes) { live(options, "FEC_V2_GRAPH"); const row = item.row, entry = entryByFile.get(row.fileNumber); if (!entry || terminalByFile.has(row.fileNumber) || row.planSha256 !== snapshot.planSha256 || row.ledgerSha256 !== header.ledgerSha256 || row.entryIdentitySha256 !== entry.entryIdentitySha256) invalid("FEC_V2_GRAPH_INVALID"); terminalByFile.add(row.fileNumber); }
  if (terminalByFile.size !== entryByFile.size) invalid("FEC_V2_GRAPH_INVALID");
  for (const item of outcomes) { const entry = entryByFile.get(item.row.fileNumber)!; const eligible = entry.electronicStatus === "paper" ? item.row.outcome === "paper_filing_unreviewed" : entry.rawSourceAvailability !== "available" ? item.row.outcome === "source_unavailable" : item.row.outcome === "unsupported_layout" || item.row.outcome === "malformed_filing"; if (!eligible) invalid("FEC_V2_GRAPH_INVALID"); }
  const latestReceipt = receipts.reduce((latest, item) => compareText(latest, item.row.retrievedAt) < 0 ? item.row.retrievedAt : latest, receipts[0]?.row.retrievedAt ?? ""); if (snapshot.retrievedAt !== latestReceipt) invalid("FEC_V2_GRAPH_INVALID");
  const tableRows: readonly [GraphTable, readonly { bytes: Uint8Array }[]][] = [["snapshot", snapshots], ["snapshotMetadata", metadata], ["artifacts", artifacts], ["receipts", receipts], ["enumerationPages", pages], ["ledgerHeader", headers], ["ledgerEntries", entries], ["pageLineage", lineage], ["amendmentLinks", amendments], ["sanitizedFilings", sanitized], ["alternateScoping", []], ["acquisitionOutcomes", outcomes], ["acquisitionReceiptIds", selected]];
  let state: Uint8Array = createHash("sha256").update(Buffer.concat([Buffer.from("fec-v2-acquisition-graph-v1"), Buffer.from([0])])).digest();
  for (const [table, rows] of tableRows) { live(options, "FEC_V2_GRAPH"); state = chain(state, boundaryBytes(table)); for (const row of rows) { live(options, "FEC_V2_GRAPH"); state = chain(state, row.bytes); } }
  return Buffer.from(state).toString("hex");
}

export type FecV2AcquisitionTranscriptReceipt = Readonly<{ receiptId: string; artifactKind: "enumeration_page" | "filing_ledger" | "sanitized_filing"; artifactSha256: string; replaySha256: string; replayByteSize: string; canonicalSchema: string; canonicalDecodeVersion: string; decodedEvidenceSha256: string }>;
export type FecV2AcquisitionTranscriptV1 = Readonly<{ schemaVersion: 1; transcriptVersion: "fec-v2-acquisition-transcript-v1"; receipts: readonly FecV2AcquisitionTranscriptReceipt[] }>;
export function encodeFecV2AcquisitionTranscript(value: FecV2AcquisitionTranscriptV1, options: Controls = {}): Uint8Array {
  const root = plain(value, ["schemaVersion", "transcriptVersion", "receipts"], "FEC_V2_TRANSCRIPT_INVALID"); if (root.schemaVersion !== 1 || root.transcriptVersion !== "fec-v2-acquisition-transcript-v1") invalid("FEC_V2_TRANSCRIPT_INVALID");
  const rows: FecV2AcquisitionTranscriptReceipt[] = []; let estimatedBytes = 128;
  for (const raw of dense(root.receipts, MAX_RECEIPTS, "FEC_V2_TRANSCRIPT_INVALID", options, "FEC_V2_TRANSCRIPT")) {
    live(options, "FEC_V2_TRANSCRIPT");
    const row = plain(raw, ["receiptId", "artifactKind", "artifactSha256", "replaySha256", "replayByteSize", "canonicalSchema", "canonicalDecodeVersion", "decodedEvidenceSha256"], "FEC_V2_TRANSCRIPT_INVALID");
    if (!isId(row.receiptId) || typeof row.artifactKind !== "string" || !["enumeration_page", "filing_ledger", "sanitized_filing"].includes(row.artifactKind) || !isSha(row.artifactSha256) || !isSha(row.replaySha256) || !isDecimal(row.replayByteSize) || !isId(row.canonicalSchema) || !isId(row.canonicalDecodeVersion) || !isSha(row.decodedEvidenceSha256)) invalid("FEC_V2_TRANSCRIPT_INVALID");
    const receiptId = row.receiptId as string, artifactSha256 = row.artifactSha256 as string, replaySha256 = row.replaySha256 as string, replayByteSize = row.replayByteSize as string, canonicalSchema = row.canonicalSchema as string, canonicalDecodeVersion = row.canonicalDecodeVersion as string, decodedEvidenceSha256 = row.decodedEvidenceSha256 as string;
    estimatedBytes += Buffer.byteLength(receiptId) + Buffer.byteLength(canonicalSchema) + Buffer.byteLength(canonicalDecodeVersion) + 320;
    if (estimatedBytes > MAX_CANONICAL_BYTES) invalid("FEC_V2_TRANSCRIPT_TOO_LARGE");
    rows.push({ receiptId, artifactKind: row.artifactKind as FecV2AcquisitionTranscriptReceipt["artifactKind"], artifactSha256, replaySha256, replayByteSize, canonicalSchema, canonicalDecodeVersion, decodedEvidenceSha256 });
  }
  rows.sort((a, b) => { live(options, "FEC_V2_TRANSCRIPT"); return compareText(a.receiptId, b.receiptId) || compareText(a.artifactKind, b.artifactKind); });
  for (let index = 1; index < rows.length; index++) if (rows[index - 1]!.receiptId === rows[index]!.receiptId && rows[index - 1]!.artifactKind === rows[index]!.artifactKind) invalid("FEC_V2_TRANSCRIPT_INVALID");
  const wireRows: FecV2AcquisitionTranscriptReceipt[] = []; for (const row of rows) { live(options, "FEC_V2_TRANSCRIPT"); wireRows.push({ receiptId: row.receiptId, artifactKind: row.artifactKind, artifactSha256: row.artifactSha256, replaySha256: row.replaySha256, replayByteSize: row.replayByteSize, canonicalSchema: row.canonicalSchema, canonicalDecodeVersion: row.canonicalDecodeVersion, decodedEvidenceSha256: row.decodedEvidenceSha256 }); } const bytes = jsonLine({ schemaVersion: 1, transcriptVersion: "fec-v2-acquisition-transcript-v1", receipts: wireRows });
  live(options, "FEC_V2_TRANSCRIPT"); if (bytes.byteLength > MAX_CANONICAL_BYTES) invalid("FEC_V2_TRANSCRIPT_TOO_LARGE"); return bytes;
}
export const fecV2AcquisitionTranscriptSha256 = (value: FecV2AcquisitionTranscriptV1, options: Controls = {}): string => sha256(encodeFecV2AcquisitionTranscript(value, options));
export function fecV2TokenDigestSha256(token: Uint8Array): string { if (!ArrayBuffer.isView(token) || token.BYTES_PER_ELEMENT !== 1 || token.byteOffset !== 0 || token.byteLength !== 32 || utilTypes.isSharedArrayBuffer(token.buffer)) invalid("FEC_V2_TOKEN_INVALID"); return sha256(Buffer.concat([Buffer.from("fec-v2-run-owner-v1"), Buffer.from([0]), Buffer.from(token)])); }
export type FecV2OperationalFailureCode = "aborted" | "lease_expired" | "enumeration_unstable" | "store_failure" | "connection_lost" | "promotion_failed" | "internal_failure";
export function fecV2FailureSubjectSha256(value: Readonly<{ schemaVersion: 1; runId: string; failureCode: FecV2OperationalFailureCode; scopeSha256: string }>): string { const row = plain(value, ["schemaVersion", "runId", "failureCode", "scopeSha256"], "FEC_V2_FAILURE_SUBJECT_INVALID"); if (row.schemaVersion !== 1 || !isRunId(row.runId) || typeof row.failureCode !== "string" || !["aborted", "lease_expired", "enumeration_unstable", "store_failure", "connection_lost", "promotion_failed", "internal_failure"].includes(row.failureCode) || !isSha(row.scopeSha256)) invalid("FEC_V2_FAILURE_SUBJECT_INVALID"); return sha256(jsonLine({ schemaVersion: 1, runId: row.runId, failureCode: row.failureCode, scopeSha256: row.scopeSha256 })); }
