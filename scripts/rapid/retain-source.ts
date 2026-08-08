import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, mkdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { join, relative, resolve } from "node:path";

export type RapidSourceRequest = Readonly<{
  sourceId: string;
  url: string;
  outputPath: string;
  expectedSha256?: string;
  expectedBytes?: number;
  allowedFinalUrl?: string;
  sourceLockBytes: Uint8Array;
}>;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
type Runtime = Readonly<{ workingDirectory?: string; fetch?: FetchLike }>;
export type RapidSourceResult = Readonly<{
  status: "retained" | "already_retained";
  finalUrl: string;
  sourceLockEntryCandidate: Readonly<{
    id: string;
    url: string;
    retainedPath: string;
    retainedStatus: "retained";
    byteSize: number;
    sha256: string;
    kind: "source";
    parentIds: readonly [];
  }>;
}>;

const fail = (code: string): never => { throw new Error(code); };
const isHttps = (value: string): boolean => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};
const exactUrl = (value: string): string => new URL(value).toString();
type LockEntry = Readonly<{ id: string; url: string; retainedStatus: "retained" | "nonretained"; retainedPath?: string | null; byteSize?: number | null; sha256?: string | null; kind: string; parentIds: readonly unknown[] }>;
type RetainedLockEntry = LockEntry & Readonly<{ retainedStatus: "retained"; retainedPath: string; byteSize: number; sha256: string }>;

function outputLocation(request: RapidSourceRequest, workingDirectory: string) {
  if (!request.sourceId || !request.outputPath || !request.sourceId.match(/^[a-z0-9][a-z0-9._-]*$/)) fail("RAPID_SOURCE_REQUEST_INVALID");
  if (request.expectedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(request.expectedSha256)) fail("RAPID_SOURCE_EXPECTED_SHA_INVALID");
  if (request.expectedBytes !== undefined && (!Number.isSafeInteger(request.expectedBytes) || request.expectedBytes < 0)) fail("RAPID_SOURCE_EXPECTED_BYTES_INVALID");
  const rapidRoot = resolve(workingDirectory, "data/source/rapid");
  const target = resolve(rapidRoot, request.outputPath);
  if (request.outputPath.startsWith("/") || relative(rapidRoot, target).startsWith("..") || target === rapidRoot) fail("RAPID_SOURCE_OUTPUT_OUTSIDE_RAPID_ROOT");
  return { rapidRoot, target, retainedPath: `data/source/rapid/${relative(rapidRoot, target).split("\\").join("/")}` };
}

function sourceLockEntries(sourceLockBytes: Uint8Array): readonly LockEntry[] {
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(sourceLockBytes).toString("utf8")); } catch { return fail("RAPID_SOURCE_LOCK_INVALID"); }
  if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1 || !Array.isArray((parsed as { entries?: unknown }).entries)) fail("RAPID_SOURCE_LOCK_INVALID");
  return (parsed as { entries: unknown[] }).entries.map((entry) => {
    if (!entry || typeof entry !== "object") fail("RAPID_SOURCE_LOCK_INVALID");
    const value = entry as Partial<LockEntry>;
    if (typeof value.id !== "string" || typeof value.url !== "string" || !["retained", "nonretained"].includes(String(value.retainedStatus)) || typeof value.kind !== "string" || !Array.isArray(value.parentIds)) fail("RAPID_SOURCE_LOCK_INVALID");
    if (value.retainedStatus === "retained" && (typeof value.retainedPath !== "string" || !value.retainedPath || !Number.isSafeInteger(value.byteSize) || (value.byteSize as number) < 0 || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256))) fail("RAPID_SOURCE_LOCK_INVALID");
    const invalidNonretained = (value.retainedPath !== undefined && value.retainedPath !== null) || (value.byteSize !== undefined && value.byteSize !== null && (!Number.isSafeInteger(value.byteSize) || (value.byteSize as number) < 0)) || (value.sha256 !== undefined && value.sha256 !== null && (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)));
    if (value.retainedStatus === "nonretained" && invalidNonretained) fail("RAPID_SOURCE_LOCK_INVALID");
    return value as LockEntry;
  });
}

function existingLockEntry(request: RapidSourceRequest, retainedPath: string, entries: readonly LockEntry[]): RetainedLockEntry | undefined {
  const sameId = entries.filter((entry) => entry.id === request.sourceId);
  if (sameId.some((entry) => entry.retainedStatus !== "retained" || entry.retainedPath !== retainedPath)) fail("RAPID_SOURCE_LOCK_ID_CONFLICT");
  const samePath = entries.filter((entry): entry is RetainedLockEntry => entry.retainedStatus === "retained" && entry.retainedPath === retainedPath);
  if (samePath.some((entry) => entry.id !== request.sourceId)) fail("RAPID_SOURCE_LOCK_PATH_CONFLICT");
  const expectedUrl = exactUrl(request.allowedFinalUrl ?? request.url);
  const matching = sameId.find((entry): entry is RetainedLockEntry => entry.retainedStatus === "retained" && entry.retainedPath === retainedPath && exactUrl(entry.url) === expectedUrl);
  if (sameId.length && !matching) fail("RAPID_SOURCE_LOCK_ID_CONFLICT");
  return matching;
}

async function digestFile(path: string): Promise<{ byteSize: number; sha256: string }> {
  const hash = createHash("sha256"); let byteSize = 0;
  for await (const chunk of createReadStream(path)) { const bytes = Buffer.from(chunk); byteSize += bytes.length; hash.update(bytes); }
  return { byteSize, sha256: hash.digest("hex") };
}

async function equalFiles(left: string, right: string): Promise<boolean> {
  const [leftStats, rightStats] = await Promise.all([stat(left), stat(right)]);
  if (leftStats.size !== rightStats.size) return false;
  const leftIterator = createReadStream(left)[Symbol.asyncIterator](), rightIterator = createReadStream(right)[Symbol.asyncIterator]();
  let leftBuffer = Buffer.alloc(0), rightBuffer = Buffer.alloc(0), leftDone = false, rightDone = false;
  while (!leftDone || !rightDone || leftBuffer.length || rightBuffer.length) {
    if (!leftBuffer.length && !leftDone) { const next = await leftIterator.next(); leftDone = next.done ?? false; leftBuffer = next.done ? Buffer.alloc(0) : Buffer.from(next.value); }
    if (!rightBuffer.length && !rightDone) { const next = await rightIterator.next(); rightDone = next.done ?? false; rightBuffer = next.done ? Buffer.alloc(0) : Buffer.from(next.value); }
    if (leftBuffer.length !== rightBuffer.length && (leftDone || rightDone)) return false;
    const length = Math.min(leftBuffer.length, rightBuffer.length);
    if (length && !leftBuffer.subarray(0, length).equals(rightBuffer.subarray(0, length))) return false;
    leftBuffer = leftBuffer.subarray(length); rightBuffer = rightBuffer.subarray(length);
  }
  return true;
}

async function download(url: string, allowedFinalUrl: string | undefined, fetcher: FetchLike): Promise<{ response: Response; finalUrl: string }> {
  if (!isHttps(url)) fail("RAPID_SOURCE_URL_NOT_HTTPS");
  let current = exactUrl(url), redirected = false;
  for (let redirects = 0; redirects < 2; redirects++) {
    const response = await fetcher(current, { redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.ok || !response.body) fail(`RAPID_SOURCE_DOWNLOAD_FAILED:${response.status}`);
      return { response, finalUrl: current };
    }
    const location = response.headers.get("location");
    if (!location) fail("RAPID_SOURCE_REDIRECT_LOCATION_MISSING");
    const next = exactUrl(new URL(location!, current).toString());
    if (!isHttps(next)) fail("RAPID_SOURCE_REDIRECT_NOT_HTTPS");
    if (!allowedFinalUrl || next !== exactUrl(allowedFinalUrl) || redirected) fail("RAPID_SOURCE_REDIRECT_NOT_ALLOWED");
    current = next;
    redirected = true;
  }
  return fail("RAPID_SOURCE_REDIRECT_LIMIT");
}

export async function retainRapidSource(request: RapidSourceRequest, runtime: Runtime = {}): Promise<RapidSourceResult> {
  const workingDirectory = runtime.workingDirectory ?? process.cwd();
  const fetcher = runtime.fetch ?? globalThis.fetch;
  const { rapidRoot, target, retainedPath } = outputLocation(request, workingDirectory);
  const lockEntry = existingLockEntry(request, retainedPath, sourceLockEntries(request.sourceLockBytes));
  try {
    await stat(target);
    if (request.expectedBytes === undefined || request.expectedSha256 === undefined) fail("RAPID_SOURCE_EXISTING_OUTPUT_EXPECTATION_REQUIRED");
    const existing = await digestFile(target);
    if (existing.byteSize !== request.expectedBytes || existing.sha256 !== request.expectedSha256) fail("RAPID_SOURCE_EXISTING_OUTPUT_MISMATCH");
    if (lockEntry && (lockEntry.byteSize !== existing.byteSize || lockEntry.sha256 !== existing.sha256)) fail("RAPID_SOURCE_LOCK_ENTRY_MISMATCH");
    const finalUrl = lockEntry?.url ?? exactUrl(request.allowedFinalUrl ?? request.url);
    return { status: "already_retained", finalUrl, sourceLockEntryCandidate: { id: request.sourceId, url: finalUrl, retainedPath, retainedStatus: "retained", ...existing, kind: "source", parentIds: [] } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const { response, finalUrl } = await download(request.url, request.allowedFinalUrl, fetcher);
  await mkdir(join(target, ".."), { recursive: true });
  const temporary = join(rapidRoot, `.retain-${request.sourceId}-${randomUUID()}`);
  const hash = createHash("sha256");
  let byteSize = 0;
  const digesting = new Transform({ transform(chunk: Buffer, _encoding, callback) { const bytes = Buffer.from(chunk); byteSize += bytes.length; hash.update(bytes); callback(null, bytes); } });
  try {
    await pipeline(Readable.fromWeb(response.body as never), digesting, createWriteStream(temporary, { flags: "wx" }));
    const sha256 = hash.digest("hex");
    if (request.expectedBytes !== undefined && byteSize !== request.expectedBytes) fail("RAPID_SOURCE_BYTE_SIZE_MISMATCH");
    if (request.expectedSha256 !== undefined && sha256 !== request.expectedSha256) fail("RAPID_SOURCE_SHA256_MISMATCH");
    if (lockEntry && (lockEntry.byteSize !== byteSize || lockEntry.sha256 !== sha256)) fail("RAPID_SOURCE_LOCK_ENTRY_MISMATCH");
    let status: "retained" | "already_retained" = "retained";
    try { await link(temporary, target); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!await equalFiles(temporary, target)) fail("RAPID_SOURCE_OUTPUT_CONFLICT");
      status = "already_retained";
    }
    return { status, finalUrl, sourceLockEntryCandidate: { id: request.sourceId, url: finalUrl, retainedPath, retainedStatus: "retained", byteSize, sha256, kind: "source", parentIds: [] } };
  } finally {
    await rm(temporary, { force: true });
  }
}
