import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

export const FEC_BULK_BOOTSTRAP_ADAPTER_VERSION = "fec-bulk-bootstrap-v1";

const MAX_COMPRESSED_BYTES = 4 * 1024 * 1024;
/** Canonical bootstrap artifacts contain projected rows and receipts, not source ZIPs. */
export const MAX_FEC_BULK_BOOTSTRAP_BYTES = 32 * 1024 * 1024;
export const MAX_FEC_BULK_MANIFEST_BYTES = 64 * 1024;
const MAX_UNCOMPRESSED_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 25_000;
const MAX_LINE_BYTES = 8 * 1024;
const MAX_FIELD_BYTES = 1024;
const MAX_SAFE_CENTS = "9007199254740991";
const SHA256 = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^[HSP][A-Z0-9]{8}$/;
const COMMITTEE_ID = /^C\d{8}$/;
const YEAR = /^\d{4}$/;

function fail(code: string): never {
  throw new Error(code);
}
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const bytewise = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left), Buffer.from(right));
const record = (value: unknown, code = "FEC_BULK_INVALID"): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(code);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[], code = "FEC_BULK_INVALID"): void => {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  ) fail(code);
};
const validIsoInstant = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};
const validIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const safeText = (value: unknown, maximum = MAX_FIELD_BYTES): string =>
  typeof value === "string" &&
  value.length > 0 &&
  Buffer.byteLength(value) <= maximum &&
  !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : fail("FEC_BULK_FIELD_INVALID");
const assertCandidateId = (value: unknown): string =>
  typeof value === "string" && CANDIDATE_ID.test(value) ? value : fail("FEC_BULK_FIELD_INVALID");
const assertCommitteeId = (value: unknown): string =>
  typeof value === "string" && COMMITTEE_ID.test(value) ? value : fail("FEC_BULK_FIELD_INVALID");
const assertYear = (value: unknown): string =>
  typeof value === "string" && YEAR.test(value) ? value : fail("FEC_BULK_FIELD_INVALID");

export type BulkKind =
  | "candidate_master"
  | "committee_master"
  | "candidate_committee_linkage"
  | "candidate_summary";
export type BulkManifestEntry = Readonly<{
  kind: BulkKind;
  officialUrl: string;
  fileName: string;
  retrievedAt: string;
  byteSize: number;
  sha256: string;
  finalUrl: string;
  etag: string | null;
  lastModified: string | null;
}>;
export type BulkManifest = Readonly<{
  version: 1;
  cycle: 2026;
  cutoff: "2026-07-18";
  publicationEligible: false;
  reviewStatus: "unreviewed";
  entries: readonly BulkManifestEntry[];
}>;

const ARCHIVE_NAMES: Readonly<Record<BulkKind, string>> = {
  candidate_master: "cn26.zip",
  committee_master: "cm26.zip",
  candidate_committee_linkage: "ccl26.zip",
  candidate_summary: "weball26.zip",
};
const MEMBER_NAMES: Readonly<Record<BulkKind, string>> = {
  candidate_master: "cn.txt",
  committee_master: "cm.txt",
  candidate_committee_linkage: "ccl.txt",
  candidate_summary: "weball26.txt",
};
const MEMBER_FIELD_COUNTS: Readonly<Record<BulkKind, number>> = {
  candidate_master: 15,
  committee_master: 15,
  candidate_committee_linkage: 7,
  candidate_summary: 30,
};
const officialUrl = (fileName: string): string =>
  `https://www.fec.gov/files/bulk-downloads/2026/${fileName}`;

function assertOfficialUrl(value: unknown, expected: string): string {
  if (typeof value !== "string") fail("FEC_BULK_MANIFEST_INVALID");
  let actual: URL;
  try {
    actual = new URL(value);
  } catch {
    return fail("FEC_BULK_MANIFEST_INVALID");
  }
  const wanted = new URL(expected);
  if (
    actual.protocol !== "https:" ||
    actual.hostname !== "www.fec.gov" ||
    actual.port ||
    actual.username ||
    actual.password ||
    actual.search ||
    actual.hash ||
    actual.pathname !== wanted.pathname
  ) fail("FEC_BULK_MANIFEST_INVALID");
  return value;
}

function optionalHeader(value: unknown): string | null {
  if (value === null) return null;
  const text = safeText(value, 256);
  if (/placeholder|operator[_ .-]?fill|example\.invalid/i.test(text))
    fail("FEC_BULK_MANIFEST_INVALID");
  return text;
}

export function encodeFecBulkManifest(value: BulkManifest): Uint8Array {
  const manifest = record(value, "FEC_BULK_MANIFEST_INVALID");
  exactKeys(
    manifest,
    ["version", "cycle", "cutoff", "publicationEligible", "reviewStatus", "entries"],
    "FEC_BULK_MANIFEST_INVALID",
  );
  if (
    manifest.version !== 1 ||
    manifest.cycle !== 2026 ||
    manifest.cutoff !== "2026-07-18" ||
    manifest.publicationEligible !== false ||
    manifest.reviewStatus !== "unreviewed" ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length !== 4
  ) fail("FEC_BULK_MANIFEST_INVALID");

  const seen = new Set<BulkKind>();
  const entries = (manifest.entries as unknown[]).map((raw): BulkManifestEntry => {
    const entry = record(raw, "FEC_BULK_MANIFEST_INVALID");
    exactKeys(
      entry,
      ["kind", "officialUrl", "fileName", "retrievedAt", "byteSize", "sha256", "finalUrl", "etag", "lastModified"],
      "FEC_BULK_MANIFEST_INVALID",
    );
    const kind = entry.kind as BulkKind;
    const fileName = ARCHIVE_NAMES[kind];
    if (
      !fileName ||
      seen.has(kind) ||
      entry.fileName !== fileName ||
      entry.officialUrl !== officialUrl(fileName) ||
      !validIsoInstant(entry.retrievedAt) ||
      !Number.isSafeInteger(entry.byteSize) ||
      Number(entry.byteSize) < 1 ||
      Number(entry.byteSize) > MAX_COMPRESSED_BYTES ||
      typeof entry.sha256 !== "string" ||
      !SHA256.test(entry.sha256)
    ) fail("FEC_BULK_MANIFEST_INVALID");
    seen.add(kind);
    return {
      kind,
      officialUrl: entry.officialUrl,
      fileName,
      retrievedAt: entry.retrievedAt,
      byteSize: entry.byteSize as number,
      sha256: entry.sha256,
      finalUrl: assertOfficialUrl(entry.finalUrl, officialUrl(fileName)),
      etag: optionalHeader(entry.etag),
      lastModified: optionalHeader(entry.lastModified),
    };
  }).sort((left, right) => bytewise(left.kind, right.kind));

  return Buffer.from(JSON.stringify({
    version: 1,
    cycle: 2026,
    cutoff: "2026-07-18",
    publicationEligible: false,
    reviewStatus: "unreviewed",
    entries,
  }));
}

export function decodeFecBulkManifest(bytes: Uint8Array): BulkManifest {
  if (bytes.byteLength > MAX_FEC_BULK_MANIFEST_BYTES) fail("FEC_BULK_MANIFEST_INPUT_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return fail("FEC_BULK_MANIFEST_INVALID");
  }
  const canonical = Buffer.from(encodeFecBulkManifest(parsed as BulkManifest));
  if (!Buffer.from(bytes).equals(canonical)) fail("FEC_BULK_MANIFEST_NONCANONICAL");
  return JSON.parse(canonical.toString("utf8")) as BulkManifest;
}

export const fecBulkManifestSha256 = (bytes: Uint8Array): string => sha256(bytes);

function sameRegularFile(
  left: { dev: number; ino: number; isFile(): boolean },
  right: { dev: number; ino: number; isFile(): boolean },
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.isFile() && right.isFile();
}

function secureReadArchive(root: string, fileName: string, expectedSize: number, expectedSha256: string): Buffer {
  const realRoot = realpathSync(root);
  const rootBefore = statSync(realRoot);
  if (!rootBefore.isDirectory() || !/^[a-z0-9]+\.zip$/.test(fileName))
    fail("FEC_BULK_FILE_INVALID");
  const path = resolve(realRoot, fileName);
  if (relative(realRoot, path) !== fileName) fail("FEC_BULK_FILE_INVALID");

  const namedBefore = lstatSync(path);
  let descriptor = -1;
  try {
    descriptor = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const openedBefore = fstatSync(descriptor);
    if (
      !sameRegularFile(namedBefore, openedBefore) ||
      openedBefore.size !== expectedSize ||
      openedBefore.size > MAX_COMPRESSED_BYTES
    ) fail("FEC_BULK_FILE_INVALID");
    const bytes = Buffer.alloc(openedBefore.size);
    for (let offset = 0; offset < bytes.length;) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (!count) fail("FEC_BULK_FILE_CHANGED");
      offset += count;
    }
    const openedAfter = fstatSync(descriptor);
    const namedAfter = lstatSync(path);
    const rootAfter = statSync(realRoot);
    if (
      !sameRegularFile(openedBefore, openedAfter) ||
      !sameRegularFile(namedAfter, openedAfter) ||
      rootBefore.dev !== rootAfter.dev ||
      rootBefore.ino !== rootAfter.ino ||
      sha256(bytes) !== expectedSha256
    ) fail("FEC_BULK_FILE_CHANGED");
    return bytes;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FEC_BULK_FILE_")) throw error;
    return fail("FEC_BULK_FILE_INVALID");
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

const readU16 = (bytes: Buffer, offset: number): number => {
  if (offset < 0 || offset + 2 > bytes.length) fail("FEC_BULK_ZIP_INVALID");
  return bytes.readUInt16LE(offset);
};
const readU32 = (bytes: Buffer, offset: number): number => {
  if (offset < 0 || offset + 4 > bytes.length) fail("FEC_BULK_ZIP_INVALID");
  return bytes.readUInt32LE(offset);
};
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();
const crc32 = (bytes: Buffer): number => {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

/** Allow only the timestamp and Unix UID/GID extras emitted by official FEC ZIPs. */
function validateZipExtra(extra: Buffer, location: "central" | "local"): void {
  const seen = new Set<number>();
  for (let offset = 0; offset < extra.length;) {
    if (offset + 4 > extra.length) fail("FEC_BULK_ZIP_EXTRA_INVALID");
    const id = readU16(extra, offset);
    const length = readU16(extra, offset + 2);
    const start = offset + 4;
    const end = start + length;
    if (end > extra.length || seen.has(id)) fail("FEC_BULK_ZIP_EXTRA_INVALID");
    seen.add(id);
    const value = extra.subarray(start, end);
    if (id === 0x5455) {
      if (value.length < 5 || (value[0]! & ~0x07) !== 0 || (value[0]! & 0x01) === 0)
        fail("FEC_BULK_ZIP_EXTRA_INVALID");
      const expected = location === "central"
        ? 5
        : 1 + 4 * ((value[0]! & 1 ? 1 : 0) + (value[0]! & 2 ? 1 : 0) + (value[0]! & 4 ? 1 : 0));
      if (value.length !== expected) fail("FEC_BULK_ZIP_EXTRA_INVALID");
    } else if (id === 0x7875) {
      if (value.length < 5 || value[0] !== 1) fail("FEC_BULK_ZIP_EXTRA_INVALID");
      const uidLength = value[1]!;
      const gidSizeOffset = 2 + uidLength;
      if (uidLength < 1 || uidLength > 4 || gidSizeOffset >= value.length)
        fail("FEC_BULK_ZIP_EXTRA_INVALID");
      const gidLength = value[gidSizeOffset]!;
      if (gidLength < 1 || gidLength > 4 || gidSizeOffset + 1 + gidLength !== value.length)
        fail("FEC_BULK_ZIP_EXTRA_INVALID");
    } else {
      fail("FEC_BULK_ZIP_EXTRA_INVALID");
    }
    offset = end;
  }
}

function decodeZipMember(zip: Buffer, expectedName: string): Buffer {
  try {
    if (zip.length < 22) fail("FEC_BULK_ZIP_EOCD_INVALID");
    const eocd = zip.length - 22;
    if (
      readU32(zip, eocd) !== 0x06054b50 ||
      readU16(zip, eocd + 4) !== 0 ||
      readU16(zip, eocd + 6) !== 0 ||
      readU16(zip, eocd + 8) !== 1 ||
      readU16(zip, eocd + 10) !== 1 ||
      readU16(zip, eocd + 20) !== 0
    ) fail("FEC_BULK_ZIP_EOCD_INVALID");
    const centralSize = readU32(zip, eocd + 12);
    const centralOffset = readU32(zip, eocd + 16);
    if (
      centralSize === 0xffffffff ||
      centralOffset === 0xffffffff ||
      centralSize < 46 ||
      centralOffset + centralSize !== eocd ||
      readU32(zip, centralOffset) !== 0x02014b50
    ) fail("FEC_BULK_ZIP_CENTRAL_INVALID");

    const flags = readU16(zip, centralOffset + 8);
    const method = readU16(zip, centralOffset + 10);
    const expectedCrc = readU32(zip, centralOffset + 16);
    const compressedSize = readU32(zip, centralOffset + 20);
    const uncompressedSize = readU32(zip, centralOffset + 24);
    const nameLength = readU16(zip, centralOffset + 28);
    const extraLength = readU16(zip, centralOffset + 30);
    const commentLength = readU16(zip, centralOffset + 32);
    const disk = readU16(zip, centralOffset + 34);
    const externalAttributes = readU32(zip, centralOffset + 38);
    const localOffset = readU32(zip, centralOffset + 42);
    if (
      (flags !== 0 && flags !== 0x800) ||
      (method !== 0 && method !== 8) ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff ||
      compressedSize > MAX_COMPRESSED_BYTES ||
      uncompressedSize > MAX_UNCOMPRESSED_BYTES ||
      (compressedSize === 0 ? uncompressedSize !== 0 : uncompressedSize / compressedSize > 20) ||
      (method === 0 && compressedSize !== uncompressedSize) ||
      commentLength !== 0 ||
      disk !== 0 ||
      ((externalAttributes >>> 16) & 0o170000) === 0o120000 ||
      (externalAttributes & 0x10) !== 0 ||
      centralOffset + 46 + nameLength + extraLength !== eocd
    ) fail("FEC_BULK_ZIP_ENTRY_INVALID");
    const centralName = new TextDecoder("utf-8", { fatal: true }).decode(
      zip.subarray(centralOffset + 46, centralOffset + 46 + nameLength),
    );
    if (
      centralName !== expectedName ||
      /[\\/\u0000-\u001f\u007f]/.test(centralName) ||
      centralName === "." ||
      centralName === ".."
    ) fail("FEC_BULK_ZIP_NAME_INVALID");
    validateZipExtra(
      zip.subarray(
        centralOffset + 46 + nameLength,
        centralOffset + 46 + nameLength + extraLength,
      ),
      "central",
    );

    if (localOffset + 30 > centralOffset || readU32(zip, localOffset) !== 0x04034b50)
      fail("FEC_BULK_ZIP_LOCAL_INVALID");
    const localNameLength = readU16(zip, localOffset + 26);
    const localExtraLength = readU16(zip, localOffset + 28);
    if (
      readU16(zip, localOffset + 6) !== flags ||
      readU16(zip, localOffset + 8) !== method ||
      readU32(zip, localOffset + 14) !== expectedCrc ||
      readU32(zip, localOffset + 18) !== compressedSize ||
      readU32(zip, localOffset + 22) !== uncompressedSize ||
      localNameLength !== nameLength
    ) fail("FEC_BULK_ZIP_LOCAL_INVALID");
    const localName = zip.subarray(localOffset + 30, localOffset + 30 + localNameLength);
    if (!localName.equals(Buffer.from(expectedName))) fail("FEC_BULK_ZIP_NAME_INVALID");
    validateZipExtra(
      zip.subarray(
        localOffset + 30 + localNameLength,
        localOffset + 30 + localNameLength + localExtraLength,
      ),
      "local",
    );
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize !== centralOffset) fail("FEC_BULK_ZIP_LOCAL_INVALID");
    const compressed = zip.subarray(dataOffset, centralOffset);
    const output = method === 0
      ? Buffer.from(compressed)
      : inflateRawSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (output.length !== uncompressedSize || crc32(output) !== expectedCrc)
      fail("FEC_BULK_ZIP_CRC_INVALID");
    return output;
  } catch (error) {
    if (error instanceof Error && error.message === "FEC_BULK_ZIP_INVALID") throw error;
    return fail("FEC_BULK_ZIP_INVALID");
  }
}

type Candidate = {
  candidateId: string;
  candidateElectionYear: string;
  office: "H" | "S" | "P";
  officeState: string | null;
  officeDistrict: string | null;
  status: string | null;
  principalCommitteeId: string | null;
};
type Committee = {
  committeeId: string;
  committeeType: string | null;
  designation: string | null;
};
type Linkage = {
  linkageId: string;
  candidateId: string;
  candidateElectionYear: string;
  fecElectionYear: 2026;
  committeeId: string | null;
  committeeType: string | null;
  designation: string | null;
};
type Summary = {
  candidateId: string;
  totalReceipts: string | null;
  totalDisbursements: string | null;
  cashOnHandCloseOfPeriod: string | null;
  coverageEndDate: string | null;
};
type SourceReceipt = {
  archive: string;
  archiveOfficialUrl: string;
  archiveSha256: string;
  archiveByteSize: number;
  member: string;
  memberSha256: string;
  memberByteSize: number;
  memberRows: number;
  projectedRows: number;
  memberFieldCount: number;
  retrievedAt: string;
  finalUrl: string;
  etag: string | null;
  lastModified: string | null;
};
type Coherence = {
  complete: boolean;
  unsupportedLinkageRows: number;
  unresolvedPrincipalCommittees: readonly { candidateId: string; committeeId: string }[];
  unresolvedLinkageCandidates: readonly { linkageId: string; candidateId: string }[];
  unresolvedLinkageCommittees: readonly { linkageId: string; committeeId: string }[];
  unresolvedSummaryCandidates: readonly string[];
};
export type FecBulkBootstrap = Readonly<{
  schemaVersion: 1;
  adapterVersion: typeof FEC_BULK_BOOTSTRAP_ADAPTER_VERSION;
  cycle: 2026;
  cutoff: "2026-07-18";
  acquisitionManifestSha256: string;
  publicationEligible: false;
  reviewStatus: "unreviewed";
  sourceReceipts: readonly SourceReceipt[];
  candidates: readonly Candidate[];
  committees: readonly Committee[];
  linkages: readonly Linkage[];
  summaries: readonly Summary[];
  coherence: Coherence;
  limitations: readonly string[];
}>;

const LIMITATIONS = [
  "Local hashes do not prove official origin or cutoff eligibility.",
  "Bulk summaries are reconciliation hints, not filing or amendment closure.",
  "Signed review is required before publication or downstream use.",
] as const;

function canonicalMoney(value: unknown): string | null {
  if (typeof value !== "string") fail("FEC_BULK_FIELD_INVALID");
  if (value === "") return null;
  const match = /^(-?)(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(value);
  if (!match) fail("FEC_BULK_FIELD_INVALID");
  const negative = match[1] === "-";
  const whole = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? match[4] ?? "").padEnd(2, "0");
  const cents = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  if (
    cents.length > MAX_SAFE_CENTS.length ||
    (cents.length === MAX_SAFE_CENTS.length && cents > MAX_SAFE_CENTS)
  ) fail("FEC_BULK_FIELD_INVALID");
  const isZero = !/[1-9]/.test(cents);
  return `${negative && !isZero ? "-" : ""}${whole}.${fraction}`;
}

function canonicalFecDate(value: unknown): string {
  if (typeof value !== "string") fail("FEC_BULK_FIELD_INVALID");
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) fail("FEC_BULK_FIELD_INVALID");
  const result = `${match[3]}-${match[1]}-${match[2]}`;
  return validIsoDate(result) ? result : fail("FEC_BULK_FIELD_INVALID");
}

function parseRows(
  bytes: Buffer,
  expectedFields: number,
  visit: (fields: string[]) => boolean,
): { total: number; projected: number } {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("FEC_BULK_UTF8_INVALID");
  }
  if (!text.endsWith("\n")) fail("FEC_BULK_ROWS_INVALID");
  let total = 0;
  let projected = 0;
  for (const raw of text.slice(0, -1).split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (
      !line ||
      Buffer.byteLength(line) > MAX_LINE_BYTES ||
      /[\u0000-\u001f\u007f]/.test(line)
    ) fail("FEC_BULK_ROWS_INVALID");
    const fields = line.split("|");
    total += 1;
    if (
      total > MAX_ROWS ||
      fields.length !== expectedFields ||
      fields.some((field) => Buffer.byteLength(field) > MAX_FIELD_BYTES)
    ) fail("FEC_BULK_FIELD_INVALID");
    if (visit(fields)) projected += 1;
  }
  return { total, projected };
}

function addUnique<T>(map: Map<string, T>, key: string, value: T): void {
  if (map.has(key)) fail("FEC_BULK_DUPLICATE_KEY");
  map.set(key, value);
}

export function createFecBulkBootstrap(root: string, manifestBytes: Uint8Array): FecBulkBootstrap {
  const manifest = decodeFecBulkManifest(manifestBytes);
  const candidates = new Map<string, Candidate>();
  const committees = new Map<string, Committee>();
  const linkages = new Map<string, Linkage>();
  const summaries = new Map<string, Summary>();
  const sourceReceipts: SourceReceipt[] = [];
  let unsupportedLinkageRows = 0;

  for (const entry of manifest.entries) {
    const archive = secureReadArchive(root, entry.fileName, entry.byteSize, entry.sha256);
    const memberName = MEMBER_NAMES[entry.kind];
    const member = decodeZipMember(archive, memberName);
    let fieldCount: number;
    let counts: { total: number; projected: number };

    if (entry.kind === "candidate_master") {
      fieldCount = 15;
      counts = parseRows(member, fieldCount, (fields) => {
        const rawOffice = fields[5];
        if (rawOffice !== "H" && rawOffice !== "S" && rawOffice !== "P")
          fail("FEC_BULK_FIELD_INVALID");
        const office: Candidate["office"] = rawOffice;
        const candidate: Candidate = {
          candidateId: assertCandidateId(fields[0]!),
          candidateElectionYear: assertYear(fields[3]!),
          office,
          officeState: fields[4] ? safeText(fields[4]) : null,
          officeDistrict: fields[6] ? safeText(fields[6]) : null,
          status: fields[8] ? safeText(fields[8]) : null,
          principalCommitteeId: fields[9] ? assertCommitteeId(fields[9]) : null,
        };
        addUnique(candidates, candidate.candidateId, candidate);
        return true;
      });
    } else if (entry.kind === "committee_master") {
      fieldCount = 15;
      counts = parseRows(member, fieldCount, (fields) => {
        const committee: Committee = {
          committeeId: assertCommitteeId(fields[0]!),
          designation: fields[8] ? safeText(fields[8]) : null,
          committeeType: fields[9] ? safeText(fields[9]) : null,
        };
        addUnique(committees, committee.committeeId, committee);
        return true;
      });
    } else if (entry.kind === "candidate_committee_linkage") {
      fieldCount = 7;
      counts = parseRows(member, fieldCount, (fields) => {
        if (fields[2] !== "2026") return false;
        if (!CANDIDATE_ID.test(fields[0]!)) { unsupportedLinkageRows += 1; return false; }
        const linkageId = fields[6]!.replace(/^0+(?=\d)/, "");
        if (!/^\d+$/.test(linkageId)) fail("FEC_BULK_FIELD_INVALID");
        const linkage: Linkage = {
          linkageId,
          candidateId: assertCandidateId(fields[0]!),
          candidateElectionYear: assertYear(fields[1]!),
          fecElectionYear: 2026,
          committeeId: fields[3] ? assertCommitteeId(fields[3]) : null,
          committeeType: fields[4] ? safeText(fields[4]) : null,
          designation: fields[5] ? safeText(fields[5]) : null,
        };
        addUnique(linkages, linkage.linkageId, linkage);
        return true;
      });
    } else {
      fieldCount = 30;
      counts = parseRows(member, fieldCount, (fields) => {
        const summary: Summary = {
          candidateId: assertCandidateId(fields[0]!),
          totalReceipts: canonicalMoney(fields[5]!),
          totalDisbursements: canonicalMoney(fields[7]!),
          cashOnHandCloseOfPeriod: canonicalMoney(fields[10]!),
          coverageEndDate: fields[27] ? canonicalFecDate(fields[27]!) : null,
        };
        addUnique(summaries, summary.candidateId, summary);
        return true;
      });
    }

    sourceReceipts.push({
      archive: entry.fileName,
      archiveOfficialUrl: entry.officialUrl,
      archiveSha256: entry.sha256,
      archiveByteSize: entry.byteSize,
      member: memberName,
      memberSha256: sha256(member),
      memberByteSize: member.byteLength,
      memberRows: counts.total,
      projectedRows: counts.projected,
      memberFieldCount: fieldCount,
      retrievedAt: entry.retrievedAt,
      finalUrl: entry.finalUrl,
      etag: entry.etag,
      lastModified: entry.lastModified,
    });
  }

  const coherence = buildCoherence(candidates, committees, linkages, summaries, unsupportedLinkageRows);

  const output: FecBulkBootstrap = {
    schemaVersion: 1,
    adapterVersion: FEC_BULK_BOOTSTRAP_ADAPTER_VERSION,
    cycle: 2026,
    cutoff: "2026-07-18",
    acquisitionManifestSha256: sha256(manifestBytes),
    publicationEligible: false,
    reviewStatus: "unreviewed",
    sourceReceipts: sourceReceipts.sort((left, right) => bytewise(left.archive, right.archive)),
    candidates: [...candidates.values()].sort((left, right) => bytewise(left.candidateId, right.candidateId)),
    committees: [...committees.values()].sort((left, right) => bytewise(left.committeeId, right.committeeId)),
    linkages: [...linkages.values()].sort((left, right) => bytewise(left.linkageId, right.linkageId)),
    summaries: [...summaries.values()].sort((left, right) => bytewise(left.candidateId, right.candidateId)),
    coherence,
    limitations: LIMITATIONS,
  };
  validateBootstrap(output);
  return output;
}

function buildCoherence(
  candidates: ReadonlyMap<string, Candidate>,
  committees: ReadonlyMap<string, Committee>,
  linkages: ReadonlyMap<string, Linkage>,
  summaries: ReadonlyMap<string, Summary>,
  unsupportedLinkageRows: number,
): Coherence {
  const unresolvedPrincipalCommittees = [...candidates.values()]
    .filter((candidate) => candidate.principalCommitteeId && !committees.has(candidate.principalCommitteeId))
    .map((candidate) => ({ candidateId: candidate.candidateId, committeeId: candidate.principalCommitteeId! }))
    .sort((left, right) => bytewise(`${left.candidateId}\0${left.committeeId}`, `${right.candidateId}\0${right.committeeId}`));
  const unresolvedLinkageCandidates = [...linkages.values()]
    .filter((linkage) => !candidates.has(linkage.candidateId))
    .map((linkage) => ({ linkageId: linkage.linkageId, candidateId: linkage.candidateId }))
    .sort((left, right) => bytewise(left.linkageId, right.linkageId));
  const unresolvedLinkageCommittees = [...linkages.values()]
    .filter((linkage) => linkage.committeeId && !committees.has(linkage.committeeId))
    .map((linkage) => ({ linkageId: linkage.linkageId, committeeId: linkage.committeeId! }))
    .sort((left, right) => bytewise(left.linkageId, right.linkageId));
  const unresolvedSummaryCandidates = [...summaries.values()]
    .filter((summary) => !candidates.has(summary.candidateId))
    .map((summary) => summary.candidateId)
    .sort(bytewise);
  const complete = unsupportedLinkageRows === 0 &&
    unresolvedPrincipalCommittees.length === 0 &&
    unresolvedLinkageCandidates.length === 0 &&
    unresolvedLinkageCommittees.length === 0 &&
    unresolvedSummaryCandidates.length === 0;
  return {
    complete,
    unsupportedLinkageRows,
    unresolvedPrincipalCommittees,
    unresolvedLinkageCandidates,
    unresolvedLinkageCommittees,
    unresolvedSummaryCandidates,
  };
}

function assertSortedUnique<T extends Record<string, unknown>>(
  values: unknown,
  keys: readonly string[],
  identity: keyof T,
  validate: (value: T) => void,
): T[] {
  if (!Array.isArray(values)) fail("FEC_BULK_INVALID");
  const rows = values.map((value) => {
    const row = record(value);
    exactKeys(row, keys);
    validate(row as T);
    return row as T;
  });
  for (let index = 0; index < rows.length; index += 1) {
    const key = rows[index]![identity];
    if (typeof key !== "string") fail("FEC_BULK_INVALID");
    const prior = index > 0 ? rows[index - 1]![identity] : undefined;
    if (typeof prior !== "undefined" && (typeof prior !== "string" || bytewise(prior, key) >= 0))
      fail("FEC_BULK_INVALID");
  }
  return rows;
}

function validateBootstrap(value: FecBulkBootstrap): void {
  const root = record(value);
  exactKeys(root, [
    "schemaVersion", "adapterVersion", "cycle", "cutoff", "acquisitionManifestSha256",
    "publicationEligible", "reviewStatus", "sourceReceipts", "candidates", "committees",
    "linkages", "summaries", "coherence", "limitations",
  ]);
  if (
    root.schemaVersion !== 1 ||
    root.adapterVersion !== FEC_BULK_BOOTSTRAP_ADAPTER_VERSION ||
    root.cycle !== 2026 ||
    root.cutoff !== "2026-07-18" ||
    typeof root.acquisitionManifestSha256 !== "string" ||
    !SHA256.test(root.acquisitionManifestSha256) ||
    root.publicationEligible !== false ||
    root.reviewStatus !== "unreviewed" ||
    JSON.stringify(root.limitations) !== JSON.stringify(LIMITATIONS)
  ) fail("FEC_BULK_INVALID");

  const receipts = assertSortedUnique<SourceReceipt>(
    root.sourceReceipts,
    ["archive", "archiveOfficialUrl", "archiveSha256", "archiveByteSize", "member", "memberSha256", "memberByteSize", "memberRows", "projectedRows", "memberFieldCount", "retrievedAt", "finalUrl", "etag", "lastModified"],
    "archive",
    (receipt) => {
      const kind = (Object.keys(ARCHIVE_NAMES) as BulkKind[]).find(
        (candidate) => ARCHIVE_NAMES[candidate] === receipt.archive,
      );
      if (
        !kind ||
        receipt.member !== MEMBER_NAMES[kind] ||
        receipt.archiveOfficialUrl !== officialUrl(receipt.archive) ||
        !SHA256.test(receipt.archiveSha256) ||
        !SHA256.test(receipt.memberSha256) ||
        !Number.isSafeInteger(receipt.archiveByteSize) ||
        receipt.archiveByteSize < 1 || receipt.archiveByteSize > MAX_COMPRESSED_BYTES ||
        !Number.isSafeInteger(receipt.memberByteSize) ||
        receipt.memberByteSize < 1 || receipt.memberByteSize > MAX_UNCOMPRESSED_BYTES ||
        !Number.isSafeInteger(receipt.memberRows) ||
        receipt.memberRows < 1 || receipt.memberRows > MAX_ROWS ||
        !Number.isSafeInteger(receipt.projectedRows) ||
        receipt.projectedRows < 0 ||
        receipt.projectedRows > receipt.memberRows ||
        !Number.isSafeInteger(receipt.memberFieldCount) || receipt.memberFieldCount !== MEMBER_FIELD_COUNTS[kind] ||
        !validIsoInstant(receipt.retrievedAt)
      ) fail("FEC_BULK_INVALID");
      assertOfficialUrl(receipt.finalUrl, receipt.archiveOfficialUrl);
      optionalHeader(receipt.etag);
      optionalHeader(receipt.lastModified);
    },
  );
  if (receipts.length !== 4) fail("FEC_BULK_INVALID");

  const candidates = assertSortedUnique<Candidate>(
    root.candidates,
    ["candidateId", "candidateElectionYear", "office", "officeState", "officeDistrict", "status", "principalCommitteeId"],
    "candidateId",
    (candidate) => {
      assertCandidateId(candidate.candidateId);
      assertYear(candidate.candidateElectionYear);
      if (!(["H", "S", "P"] as unknown[]).includes(candidate.office)) fail("FEC_BULK_INVALID");
      if (candidate.officeState !== null && !/^[A-Z]{2}$/.test(candidate.officeState)) fail("FEC_BULK_INVALID");
      if (candidate.officeDistrict !== null && !/^\d{1,2}$/.test(candidate.officeDistrict)) fail("FEC_BULK_INVALID");
      if (candidate.status !== null && !/^[A-Z]$/.test(candidate.status)) fail("FEC_BULK_INVALID");
      if (candidate.principalCommitteeId !== null) assertCommitteeId(candidate.principalCommitteeId);
    },
  );
  const committees = assertSortedUnique<Committee>(
    root.committees,
    ["committeeId", "committeeType", "designation"],
    "committeeId",
    (committee) => {
      assertCommitteeId(committee.committeeId);
      if (committee.committeeType !== null && !/^[A-Z]$/.test(committee.committeeType)) fail("FEC_BULK_INVALID");
      if (committee.designation !== null && !/^[A-Z]$/.test(committee.designation)) fail("FEC_BULK_INVALID");
    },
  );
  const linkages = assertSortedUnique<Linkage>(
    root.linkages,
    ["linkageId", "candidateId", "candidateElectionYear", "fecElectionYear", "committeeId", "committeeType", "designation"],
    "linkageId",
    (linkage) => {
      if (!/^\d+$/.test(linkage.linkageId)) fail("FEC_BULK_INVALID");
      assertCandidateId(linkage.candidateId);
      assertYear(linkage.candidateElectionYear);
      if (linkage.fecElectionYear !== 2026) fail("FEC_BULK_INVALID");
      if (linkage.committeeId !== null) assertCommitteeId(linkage.committeeId);
      if (linkage.committeeType !== null && !/^[A-Z]$/.test(linkage.committeeType)) fail("FEC_BULK_INVALID");
      if (linkage.designation !== null && !/^[A-Z]$/.test(linkage.designation)) fail("FEC_BULK_INVALID");
    },
  );
  const summaries = assertSortedUnique<Summary>(
    root.summaries,
    ["candidateId", "totalReceipts", "totalDisbursements", "cashOnHandCloseOfPeriod", "coverageEndDate"],
    "candidateId",
    (summary) => {
      assertCandidateId(summary.candidateId);
      for (const amount of [summary.totalReceipts, summary.totalDisbursements, summary.cashOnHandCloseOfPeriod])
        if (amount !== null && canonicalMoney(amount) !== amount) fail("FEC_BULK_INVALID");
      if (summary.coverageEndDate !== null && !validIsoDate(summary.coverageEndDate)) fail("FEC_BULK_INVALID");
    },
  );
  const projectedByArchive: Readonly<Record<string, number>> = {
    "cn26.zip": candidates.length,
    "cm26.zip": committees.length,
    "ccl26.zip": linkages.length,
    "weball26.zip": summaries.length,
  };
  if (receipts.some((receipt) => receipt.projectedRows !== projectedByArchive[receipt.archive])) fail("FEC_BULK_INVALID");
  if (receipts.some((receipt) =>
    receipt.archive !== ARCHIVE_NAMES.candidate_committee_linkage &&
    receipt.memberRows !== receipt.projectedRows
  )) fail("FEC_BULK_INVALID");

  const coherenceValue = record(root.coherence);
  exactKeys(coherenceValue, ["complete", "unsupportedLinkageRows", "unresolvedPrincipalCommittees", "unresolvedLinkageCandidates", "unresolvedLinkageCommittees", "unresolvedSummaryCandidates"]);
  if (typeof coherenceValue.complete !== "boolean" || !Number.isSafeInteger(coherenceValue.unsupportedLinkageRows) || Number(coherenceValue.unsupportedLinkageRows) < 0)
    fail("FEC_BULK_INVALID");
  const linkageReceipt = receipts.find((receipt) => receipt.archive === ARCHIVE_NAMES.candidate_committee_linkage)!;
  if (Number(coherenceValue.unsupportedLinkageRows) > linkageReceipt.memberRows - linkageReceipt.projectedRows)
    fail("FEC_BULK_INVALID");
  const unresolvedPrincipalCommittees = assertSortedUnique<{ candidateId: string; committeeId: string }>(coherenceValue.unresolvedPrincipalCommittees, ["candidateId", "committeeId"], "candidateId", (item) => { assertCandidateId(item.candidateId); assertCommitteeId(item.committeeId); });
  const unresolvedLinkageCandidates = assertSortedUnique<{ linkageId: string; candidateId: string }>(coherenceValue.unresolvedLinkageCandidates, ["linkageId", "candidateId"], "linkageId", (item) => { if (!/^\d+$/.test(item.linkageId)) fail("FEC_BULK_INVALID"); assertCandidateId(item.candidateId); });
  const unresolvedLinkageCommittees = assertSortedUnique<{ linkageId: string; committeeId: string }>(coherenceValue.unresolvedLinkageCommittees, ["linkageId", "committeeId"], "linkageId", (item) => { if (!/^\d+$/.test(item.linkageId)) fail("FEC_BULK_INVALID"); assertCommitteeId(item.committeeId); });
  if (!Array.isArray(coherenceValue.unresolvedSummaryCandidates)) fail("FEC_BULK_INVALID");
  const unresolvedSummaryCandidates = coherenceValue.unresolvedSummaryCandidates.map((item) => assertCandidateId(safeText(item)));
  if (unresolvedSummaryCandidates.some((item, index) => index > 0 && bytewise(unresolvedSummaryCandidates[index - 1]!, item) >= 0)) fail("FEC_BULK_INVALID");
  const suppliedCoherence: Coherence = {
    complete: coherenceValue.complete,
    unsupportedLinkageRows: coherenceValue.unsupportedLinkageRows as number,
    unresolvedPrincipalCommittees,
    unresolvedLinkageCandidates,
    unresolvedLinkageCommittees,
    unresolvedSummaryCandidates,
  };
  const expectedCoherence = buildCoherence(
    new Map(candidates.map((candidate) => [candidate.candidateId, candidate])),
    new Map(committees.map((committee) => [committee.committeeId, committee])),
    new Map(linkages.map((linkage) => [linkage.linkageId, linkage])),
    new Map(summaries.map((summary) => [summary.candidateId, summary])),
    suppliedCoherence.unsupportedLinkageRows,
  );
  if (JSON.stringify(suppliedCoherence) !== JSON.stringify(expectedCoherence)) fail("FEC_BULK_INVALID");

  for (const key of Object.keys(root))
    if (/name|address|treasurer|party|email|phone|contributor|employer|occupation/i.test(key))
      fail("FEC_BULK_PRIVACY_INVALID");
}

export function encodeFecBulkBootstrap(value: FecBulkBootstrap): Uint8Array {
  validateBootstrap(value);
  return Buffer.from(JSON.stringify({
    schemaVersion: value.schemaVersion,
    adapterVersion: value.adapterVersion,
    cycle: value.cycle,
    cutoff: value.cutoff,
    acquisitionManifestSha256: value.acquisitionManifestSha256,
    publicationEligible: value.publicationEligible,
    reviewStatus: value.reviewStatus,
    sourceReceipts: value.sourceReceipts.map((receipt) => ({
      archive: receipt.archive,
      archiveOfficialUrl: receipt.archiveOfficialUrl,
      archiveSha256: receipt.archiveSha256,
      archiveByteSize: receipt.archiveByteSize,
      member: receipt.member,
      memberSha256: receipt.memberSha256,
      memberByteSize: receipt.memberByteSize,
      memberRows: receipt.memberRows,
      projectedRows: receipt.projectedRows,
      memberFieldCount: receipt.memberFieldCount,
      retrievedAt: receipt.retrievedAt,
      finalUrl: receipt.finalUrl,
      etag: receipt.etag,
      lastModified: receipt.lastModified,
    })),
    candidates: value.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      candidateElectionYear: candidate.candidateElectionYear,
      office: candidate.office,
      officeState: candidate.officeState,
      officeDistrict: candidate.officeDistrict,
      status: candidate.status,
      principalCommitteeId: candidate.principalCommitteeId,
    })),
    committees: value.committees.map((committee) => ({
      committeeId: committee.committeeId,
      committeeType: committee.committeeType,
      designation: committee.designation,
    })),
    linkages: value.linkages.map((linkage) => ({
      linkageId: linkage.linkageId,
      candidateId: linkage.candidateId,
      candidateElectionYear: linkage.candidateElectionYear,
      fecElectionYear: linkage.fecElectionYear,
      committeeId: linkage.committeeId,
      committeeType: linkage.committeeType,
      designation: linkage.designation,
    })),
    summaries: value.summaries.map((summary) => ({
      candidateId: summary.candidateId,
      totalReceipts: summary.totalReceipts,
      totalDisbursements: summary.totalDisbursements,
      cashOnHandCloseOfPeriod: summary.cashOnHandCloseOfPeriod,
      coverageEndDate: summary.coverageEndDate,
    })),
    coherence: {
      complete: value.coherence.complete,
      unsupportedLinkageRows: value.coherence.unsupportedLinkageRows,
      unresolvedPrincipalCommittees: value.coherence.unresolvedPrincipalCommittees.map((item) => ({ candidateId: item.candidateId, committeeId: item.committeeId })),
      unresolvedLinkageCandidates: value.coherence.unresolvedLinkageCandidates.map((item) => ({ linkageId: item.linkageId, candidateId: item.candidateId })),
      unresolvedLinkageCommittees: value.coherence.unresolvedLinkageCommittees.map((item) => ({ linkageId: item.linkageId, committeeId: item.committeeId })),
      unresolvedSummaryCandidates: [...value.coherence.unresolvedSummaryCandidates],
    },
    limitations: [...LIMITATIONS],
  }));
}

export function decodeFecBulkBootstrap(bytes: Uint8Array): FecBulkBootstrap {
  if (bytes.byteLength > MAX_FEC_BULK_BOOTSTRAP_BYTES) fail("FEC_BULK_INPUT_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return fail("FEC_BULK_INVALID_JSON");
  }
  validateBootstrap(parsed as FecBulkBootstrap);
  const canonical = Buffer.from(encodeFecBulkBootstrap(parsed as FecBulkBootstrap));
  if (!Buffer.from(bytes).equals(canonical)) fail("FEC_BULK_NONCANONICAL");
  return parsed as FecBulkBootstrap;
}

export const fecBulkBootstrapSha256 = (bytes: Uint8Array): string => sha256(bytes);
