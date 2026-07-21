import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, posix, relative, resolve } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import type { Pool } from "pg";
import { LocalRawObjectStore, S3RawObjectStore, type RawObjectStore } from "@/ingestion/core/raw-object-store";
import { createIdentityAdapter } from "@/ingestion/identity/adapter";
import { parseSenateRoster, parseSenateServiceStartsArtifact } from "@/ingestion/identity/senate";
import type { SenateSeat } from "@/ingestion/identity/senate";
import type { HouseSeat } from "@/ingestion/identity/house";
import { createTigerAdapter } from "@/ingestion/tiger/adapter";
import { parseNationalTigerArtifacts, type NationalTigerArtifactManifest } from "@/ingestion/tiger/national";
import { runSource, type RunSourceResult } from "@/ingestion/core/run-source";
import { ACS_ADAPTER_VERSION, ACS_SOURCE_LIMITS, createAcsAdapter } from "@/ingestion/acs/adapter";
import { ACS_INDICATOR_DICTIONARY } from "@/ingestion/acs/indicator-dictionary";

export type ConfiguredSource = "identity" | "tiger" | "acs";
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const hashPattern = /^[a-f0-9]{64}$/;
export type LockEntry = { readonly id: string; readonly url: string; readonly retainedPath: string | null; readonly retainedStatus: "retained" | "nonretained"; readonly byteSize: number; readonly sha256: string; readonly kind: string; readonly parentIds: readonly string[] };
type SourceLock = { readonly version: 1; readonly entries: readonly LockEntry[] };
type LockedArtifact = { readonly bytes: Uint8Array; readonly url: string; readonly sha256: string; readonly target: string; readonly entry: LockEntry };

const fail = (message: string): never => { throw new Error(message); };
const isInside = (root: string, target: string): boolean => { const path = relative(root, target); return path !== "" && !path.startsWith("..") && !path.includes(`..${posix.sep}`); };
const retainedPathIsExact = (path: string): boolean => path.startsWith("data/") && posix.normalize(path) === path && !path.includes("//") && !path.endsWith("/");
const lockPath = (entry: LockEntry): string => entry.retainedPath!.slice("data/".length);

async function confinedFile(root: string, path: string): Promise<string> {
  const target = await realpath(resolve(root, path));
  if (!isInside(root, target) || !(await stat(target)).isFile()) fail("INGESTION_PATH_INVALID");
  return target;
}
export function parseSourceLock(bytes: Uint8Array): SourceLock {
  let raw: unknown;
  try { raw = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { return fail("SOURCE_LOCK_INVALID"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("SOURCE_LOCK_INVALID");
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !("version" in record) || !("entries" in record) || record.version !== 1 || !Array.isArray(record.entries)) return fail("SOURCE_LOCK_INVALID");
  const entries = record.entries.map((value): LockEntry => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail("SOURCE_LOCK_INVALID");
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).length !== 8 || !["id", "url", "retainedPath", "retainedStatus", "byteSize", "sha256", "kind", "parentIds"].every(key => key in entry)) return fail("SOURCE_LOCK_INVALID");
    const retained = entry.retainedStatus === "retained";
    if (typeof entry.id !== "string" || !entry.id || typeof entry.url !== "string" || !entry.url || typeof entry.kind !== "string" || !entry.kind || !Number.isSafeInteger(entry.byteSize) || (entry.byteSize as number) < 0 || typeof entry.sha256 !== "string" || !hashPattern.test(entry.sha256) || !Array.isArray(entry.parentIds) || entry.parentIds.some(id => typeof id !== "string" || !id) || new Set(entry.parentIds).size !== entry.parentIds.length || (!retained && entry.retainedStatus !== "nonretained") || (retained ? typeof entry.retainedPath !== "string" || !retainedPathIsExact(entry.retainedPath) : entry.retainedPath !== null)) return fail("SOURCE_LOCK_INVALID");
    return entry as unknown as LockEntry;
  });
  if (new Set(entries.map(entry => entry.id)).size !== entries.length || new Set(entries.flatMap(entry => entry.retainedPath ? [entry.retainedPath] : [])).size !== entries.filter(entry => entry.retainedPath).length || entries.some(entry => entry.parentIds.includes(entry.id) || entry.parentIds.some(parent => !entries.some(candidate => candidate.id === parent)))) return fail("SOURCE_LOCK_INVALID");
  const visiting = new Set<string>(); const visited = new Set<string>(); const visit = (id: string): void => { if (visiting.has(id)) fail("SOURCE_LOCK_INVALID"); if (visited.has(id)) return; visiting.add(id); for (const parent of entries.find(entry => entry.id === id)!.parentIds) visit(parent); visiting.delete(id); visited.add(id); }; for (const entry of entries) visit(entry.id);
  return { version: 1, entries };
}
export async function loadSourceLock(dataRoot: string, env: NodeJS.ProcessEnv): Promise<{ readonly root: string; readonly lock: SourceLock; readonly sha256: string }> {
  const root = await realpath(dataRoot);
  if (!(await stat(root)).isDirectory()) fail("PROJECT_DATA_ROOT_INVALID");
  const bytes = await readFile(await confinedFile(root, "source-lock.json"));
  const actual = sha(bytes);
  if (env.NODE_ENV === "production" && (!env.SOURCE_LOCK_SHA256 || !hashPattern.test(env.SOURCE_LOCK_SHA256) || env.SOURCE_LOCK_SHA256 !== actual)) fail("SOURCE_LOCK_SHA256_REQUIRED_OR_MISMATCH");
  return { root, lock: parseSourceLock(bytes), sha256: actual };
}
export async function verifyConfiguredSourceLock(env: NodeJS.ProcessEnv, projectRoot = process.cwd()): Promise<{ readonly root: string; readonly lock: SourceLock; readonly sha256: string }> {
  const project = await realpath(projectRoot); const root = await realpath(resolve(project, env.PROJECT_DATA_ROOT ?? "data"));
  if (!isInside(project, root)) fail("PROJECT_DATA_ROOT_ESCAPE");
  return loadSourceLock(root, env);
}
async function locked(root: string, lock: SourceLock, id: string, override?: string): Promise<LockedArtifact> {
  const entry = lock.entries.find(value => value.id === id);
  if (!entry || entry.retainedStatus !== "retained" || !entry.retainedPath) fail("SOURCE_LOCK_ENTRY_INVALID");
  const selected = entry as LockEntry & { readonly retainedPath: string };
  const target = await confinedFile(root, override ?? lockPath(selected));
  const bytes = await readFile(target);
  if (bytes.byteLength !== selected.byteSize || sha(bytes) !== selected.sha256) fail("SOURCE_LOCK_ARTIFACT_MISMATCH");
  return { bytes, url: selected.url, sha256: selected.sha256, target, entry: selected };
}

/** Read one named retained object only after validating its lock entry and bytes. */
export async function loadLockedArtifact(env: NodeJS.ProcessEnv, id: string, projectRoot = process.cwd()): Promise<{ readonly bytes: Uint8Array; readonly sha256: string }> {
  const { root, lock } = await verifyConfiguredSourceLock(env, projectRoot);
  const artifact = await locked(root, lock, id);
  return { bytes: artifact.bytes, sha256: artifact.sha256 };
}
async function verifyTigerBundle(root: string, lock: SourceLock, env: NodeJS.ProcessEnv): Promise<readonly [LockedArtifact, LockedArtifact, LockedArtifact, LockedArtifact]> {
  const [cd119, states, manifest, bundle] = await Promise.all([locked(root, lock, "geo-national-cd119", env.TIGER_CD119_PATH), locked(root, lock, "geo-national-states", env.TIGER_STATES_PATH), locked(root, lock, "geo-national-manifest", env.TIGER_MANIFEST_PATH), locked(root, lock, "geo-national-bundle", env.TIGER_BUNDLE_PATH)]);
  const directory = await realpath(resolve(bundle.target, ".."));
  if (!isInside(root, directory) || basename(directory) !== bundle.sha256) fail("TIGER_BUNDLE_LOCK_MISMATCH");
  const expected = [cd119, states, manifest, bundle];
  const names = (await readdir(directory)).sort(); const expectedNames = expected.map(value => basename(value.entry.retainedPath!)).sort();
  if (names.length !== expectedNames.length || names.some((name, index) => name !== expectedNames[index])) fail("TIGER_BUNDLE_LOCK_MISMATCH");
  await Promise.all(expected.map(async value => {
    const bytes = await readFile(await confinedFile(root, resolve(directory, basename(value.entry.retainedPath!))));
    if (bytes.byteLength !== value.entry.byteSize || sha(bytes) !== value.sha256) fail("TIGER_BUNDLE_LOCK_MISMATCH");
  }));
  let value: { schemaVersion?: unknown; nationalTigerManifestSha256?: unknown; artifacts?: { cd119Sha256?: unknown; statesSha256?: unknown } };
  try { value = JSON.parse(Buffer.from(bundle.bytes).toString("utf8")) as typeof value; } catch { return fail("TIGER_BUNDLE_LOCK_MISMATCH"); }
  if (value.schemaVersion !== 1 || value.nationalTigerManifestSha256 !== manifest.sha256 || value.artifacts?.cd119Sha256 !== cd119.sha256 || value.artifacts?.statesSha256 !== states.sha256 || new Set(bundle.entry.parentIds).size !== 3 || !["geo-national-cd119", "geo-national-states", "geo-national-manifest"].every(id => bundle.entry.parentIds.includes(id))) fail("TIGER_BUNDLE_LOCK_MISMATCH");
  return [cd119, states, manifest, bundle];
}
const houseTerm = (stateCode: string) => ({ termStartsAt: "2025-01-03", termEndsAt: stateCode === "PR" ? "2029-01-03" : "2027-01-03" } as const);
const senateTerm = (senateClass: SenateSeat["senateClass"]) => senateClass === 1 ? { termStartsAt: "2025-01-03", termEndsAt: "2031-01-03" } as const : senateClass === 2 ? { termStartsAt: "2021-01-03", termEndsAt: "2027-01-03" } as const : { termStartsAt: "2023-01-03", termEndsAt: "2029-01-03" } as const;

export function assertProductionIngestionEnv(env: NodeJS.ProcessEnv): void { if (env.NODE_ENV === "production" && (!env.RAW_OBJECT_BUCKET || !env.DATABASE_URL || !env.SOURCE_LOCK_SHA256 || !hashPattern.test(env.SOURCE_LOCK_SHA256))) fail("Production ingestion requires RAW_OBJECT_BUCKET, DATABASE_URL, and SOURCE_LOCK_SHA256"); }
export function createRawObjectStore(env: NodeJS.ProcessEnv, projectRoot = process.cwd()): RawObjectStore {
  if (env.NODE_ENV === "production") { assertProductionIngestionEnv(env); if (!!env.AWS_ACCESS_KEY_ID !== !!env.AWS_SECRET_ACCESS_KEY) fail("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be supplied together"); return new S3RawObjectStore(new S3Client({ region: env.AWS_REGION, endpoint: env.RAW_OBJECT_ENDPOINT, forcePathStyle: env.RAW_OBJECT_FORCE_PATH_STYLE === "true", ...(env.AWS_ACCESS_KEY_ID ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY! } } : {}) }), env.RAW_OBJECT_BUCKET!); }
  const rawRoot = env.RAW_OBJECT_ROOT; if (!rawRoot) fail("Nonproduction ingestion requires explicit RAW_OBJECT_ROOT"); return new LocalRawObjectStore(resolve(projectRoot, rawRoot!));
}
export async function sourceId(pool: Pool, release: string, name: ConfiguredSource): Promise<string> {
  if (name !== "acs") { const result = await pool.query<{ id: string }>("SELECT id FROM sources WHERE release_id=$1 AND name=$2", [release, name]); if (result.rowCount !== 1) fail(`Expected exactly one preregistered ${name} source for release ${release}`); return result.rows[0]!.id; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const releaseRow = await client.query<{ status: string }>("SELECT status FROM data_releases WHERE id=$1 FOR UPDATE", [release]);
    if (releaseRow.rowCount !== 1 || releaseRow.rows[0]!.status !== "candidate") fail("ACS_SOURCE_RELEASE_NOT_CANDIDATE");
    const rows = await client.query<{ id: string; name: string; authority: string; homepage_url: string }>("SELECT id,name,authority,homepage_url FROM sources WHERE release_id=$1 AND (name='acs' OR id='src_acs_2024') FOR UPDATE", [release]);
    if (!rows.rowCount) await client.query("INSERT INTO sources(id,release_id,name,authority,homepage_url) VALUES('src_acs_2024',$1,'acs','official','https://www.census.gov/programs-surveys/acs.html')", [release]);
    else if (rows.rowCount !== 1 || rows.rows[0]!.id !== "src_acs_2024" || rows.rows[0]!.name !== "acs" || rows.rows[0]!.authority !== "official" || rows.rows[0]!.homepage_url !== "https://www.census.gov/programs-surveys/acs.html") fail("ACS_SOURCE_MISMATCH");
    await client.query("UPDATE release_manifests SET validated_at=NULL WHERE release_id=$1", [release]);
    await client.query("COMMIT"); return "src_acs_2024";
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}
export type AcsFetch = (input: string, init: RequestInit) => Promise<Response>;
async function fetchAcsTable(entry: LockEntry, expectedUrl: string, fetcher: AcsFetch, signal?: AbortSignal): Promise<Uint8Array> {
  const url = new URL(entry.url), expected = new URL(expectedUrl);
  if (entry.url !== expectedUrl || url.protocol !== "https:" || url.origin !== expected.origin || url.pathname !== expected.pathname || url.search || url.hash || entry.retainedStatus !== "nonretained" || entry.retainedPath !== null || entry.kind !== "raw_table" || !Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0 || entry.byteSize > ACS_SOURCE_LIMITS.tableBytes || !hashPattern.test(entry.sha256)) fail("ACS_SOURCE_LOCK_ENTRY_INVALID");
  const timeout = AbortSignal.timeout(30_000), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response | undefined;
  try { response = await fetcher(expectedUrl, { redirect: "error", cache: "no-store", signal: combined }); } catch { fail(combined.aborted ? "ACS_FETCH_TIMEOUT" : "ACS_FETCH_FAILED"); }
  const body = response?.ok ? response.body : undefined;
  if (!body) throw new Error("ACS_FETCH_RESPONSE_INVALID");
  const reader = body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > ACS_SOURCE_LIMITS.tableBytes || length > entry.byteSize) fail("ACS_FETCH_SIZE_MISMATCH"); chunks.push(part.value); } } catch (error) { await reader.cancel().catch(() => undefined); if (error instanceof Error && error.message === "ACS_FETCH_SIZE_MISMATCH") throw error; fail(combined.aborted ? "ACS_FETCH_TIMEOUT" : "ACS_FETCH_FAILED"); }
  const bytes = Buffer.concat(chunks, length);
  if (bytes.byteLength !== entry.byteSize || sha(bytes) !== entry.sha256) fail("ACS_FETCH_RECEIPT_MISMATCH");
  return bytes;
}
export async function runConfiguredSource(source: ConfiguredSource, args: { release: string; cutoff: string; dryRun: boolean; signal?: AbortSignal }, pool: Pool, rawStore: RawObjectStore, env: NodeJS.ProcessEnv, projectRoot = process.cwd(), fetcher: AcsFetch = fetch): Promise<RunSourceResult> {
  const { root, lock, sha256: sourceLockSha256 } = await verifyConfiguredSourceLock(env, projectRoot);
  const sourceKey = await sourceId(pool, args.release, source); const cutoff = new Date(`${args.cutoff}T00:00:00.000Z`);
  if (source === "acs") {
    if (!args.dryRun) fail("ACS_STAGING_REQUIRES_DRY_RUN");
    const runIds: string[] = [], reusedRunIds: string[] = [];
    for (const definition of ACS_INDICATOR_DICTIONARY) {
      const entry = lock.entries.find(value => value.id === definition.lockId);
      if (!entry) throw new Error("ACS_SOURCE_LOCK_ENTRY_INVALID");
      const bytes = await fetchAcsTable(entry, definition.sourceUrl, fetcher, args.signal);
      const adapter = createAcsAdapter({ rawStore, sourceLockSha256, definition, lockId: definition.lockId, sourceBytes: bytes, sourceUrl: definition.sourceUrl, sourceChecksumSha256: entry.sha256, sourceByteSize: entry.byteSize, snapshotId: `snap_acs_v2_acs_2024_5yr_${definition.lockId}_${entry.sha256.slice(0, 48)}` as never, parserVersion: ACS_ADAPTER_VERSION, upstreamRelease: "acs-2024-5yr" });
      const result = await runSource(adapter, { pool, releaseId: args.release as never, sourceId: sourceKey as never, cutoff, dryRun: true, signal: args.signal }); runIds.push(...result.runIds); reusedRunIds.push(...result.reusedRunIds);
    }
    return { runIds, reusedRunIds };
  }
  const [cd119, states, nationalManifest, bundle] = await verifyTigerBundle(root, lock, env);
  if (source === "tiger") { const manifest = JSON.parse(Buffer.from(nationalManifest.bytes).toString("utf8")) as NationalTigerArtifactManifest; const adapter = createTigerAdapter({ rawStore, snapshotId: `snap_tiger_${sha(nationalManifest.bytes).slice(0, 48)}` as never, upstreamRelease: "tiger2025-national", parserVersion: "tiger-national-v1", sourceLockSha256, lockIds: { cd119: "geo-national-cd119", states: "geo-national-states", manifest: "geo-national-manifest", bundle: "geo-national-bundle" }, manifest, cd119Bytes: cd119.bytes, statesBytes: states.bytes, sourceUrl: bundle.url }); return runSource(adapter, { pool, releaseId: args.release as never, sourceId: sourceKey as never, cutoff, dryRun: args.dryRun }); }
  const [house, senate, starts] = await Promise.all([locked(root, lock, "house-xml", env.IDENTITY_HOUSE_PATH), locked(root, lock, "senate-xml", env.IDENTITY_SENATE_PATH), locked(root, lock, "senate-service-starts", env.IDENTITY_SENATE_SERVICE_STARTS_PATH)]);
  const tiger = parseNationalTigerArtifacts(JSON.parse(Buffer.from(cd119.bytes).toString("utf8")), JSON.parse(Buffer.from(states.bytes).toString("utf8"))); const startsMap = parseSenateServiceStartsArtifact(Buffer.from(starts.bytes).toString("utf8")); const senateRows = parseSenateRoster(Buffer.from(senate.bytes).toString("utf8"), startsMap); if (senateRows.errors.length) fail("IDENTITY_SENATE_UNIVERSE_INVALID");
  const houseUniverse: HouseSeat[] = tiger.cd119.map(row => ({ stateCode: row.stateCode, districtCode: row.districtCode! as HouseSeat["districtCode"], kind: row.stateCode === "DC" || ["AS", "GU", "MP", "VI"].includes(row.stateCode) ? "delegate" : row.stateCode === "PR" ? "resident_commissioner" : "representative", ...houseTerm(row.stateCode) })); const senateUniverse: SenateSeat[] = senateRows.records.map(row => ({ stateCode: row.office.stateCode, senateClass: row.office.senateClass!, ...senateTerm(row.office.senateClass!) })); const adapter = createIdentityAdapter({ rawStore, snapshotId: `snap_identity_${sha(Buffer.concat([house.bytes, senate.bytes, starts.bytes])).slice(0, 48)}` as never, upstreamRelease: "identity-retained-v1", parserVersion: "identity-national-v1", releaseCutoff: args.cutoff, sourceLockSha256, house: { ...house, checksumSha256: house.sha256, lockId: house.entry.id }, senate: { ...senate, checksumSha256: senate.sha256, lockId: senate.entry.id }, senateServiceStarts: { ...starts, checksumSha256: starts.sha256, lockId: starts.entry.id }, houseUniverse, senateUniverse, senatePolicy: { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) } }); return runSource(adapter, { pool, releaseId: args.release as never, sourceId: sourceKey as never, cutoff, dryRun: args.dryRun });
}
