/** The single compiler for locked national TIGER inputs and canonical artifacts. */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { TIGER_2025_JURISDICTIONS, createNationalTigerManifest, normalizeRawNationalTigerCollection, parseNationalTigerArtifacts } from "../src/ingestion/tiger/national";

type LockEntry = { url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; sha256?: unknown; kind?: unknown };
type Lock = { version?: unknown; entries?: unknown };
type VerifyOptions = { testBaseUrl?: string };
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const canonical = (value: unknown) => `${JSON.stringify(value)}\n`;
const fail = (message: string): never => { throw new Error(`national TIGER compiler: ${message}`); };
const expectedNames = [...Object.keys(TIGER_2025_JURISDICTIONS).map((fips) => `tl_2025_${fips}_cd119.zip`), "tl_2025_us_state.zip"].sort();
const officialUrl = (name: string) => `https://www2.census.gov/geo/tiger/TIGER2025/${name === "tl_2025_us_state.zip" ? "STATE" : "CD"}/${name}`;

export async function readAndVerifySourceLock(lockPath: string, sourceDir: string, options: VerifyOptions = {}): Promise<Record<string, string>> {
  const value: unknown = JSON.parse(await readFile(lockPath, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("source lock must be a version-1 object");
  const lock = value as Lock;
  if (lock.version !== 1 || !Array.isArray(lock.entries)) fail("source lock must use the version-1 entries schema");
  const root = resolve(sourceDir);
  const sources = (lock.entries as LockEntry[]).filter((entry) =>
    entry.kind === "source"
    && entry.retainedStatus === "retained"
    && typeof entry.retainedPath === "string"
    && expectedNames.includes(basename(entry.retainedPath)),
  );
  if (sources.length !== 57) fail("source lock must contain exactly the 57 retained national TIGER archives");
  const seen = new Set<string>(); const result: [string, string][] = [];
  for (const entry of sources) {
    if (typeof entry.retainedPath !== "string" || typeof entry.url !== "string" || typeof entry.sha256 !== "string") fail("invalid retained TIGER source entry");
    const retainedPath = entry.retainedPath as string; const url = entry.url as string; const checksum = entry.sha256 as string;
    const name = basename(retainedPath);
    if (seen.has(name)) fail(`duplicate locked source ${name}`); seen.add(name);
    if (resolve(retainedPath) !== join(root, name)) fail(`retained path mismatch for ${name}`);
    if (url !== officialUrl(name) && (!options.testBaseUrl || url !== `${options.testBaseUrl.replace(/\/$/, "")}/${name}`)) fail(`official URL mismatch for ${name}`);
    if (!/^[a-f0-9]{64}$/.test(checksum)) fail(`invalid checksum for ${name}`);
    const bytes = await readFile(join(root, name)); if (sha(bytes) !== checksum) fail(`checksum mismatch for ${name}`);
    result.push([name, checksum]);
  }
  result.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (result.some(([name], index) => name !== expectedNames[index])) fail("source lock must contain exactly the expected national TIGER archives");
  return Object.fromEntries(result);
}

type CompilerOptions = { sourceLock: string; sourceDir: string; rawCd119: string; rawStates: string; bundleRoot: string; testBaseUrl?: string };
async function verifyBundle(destination: string, files: Readonly<Record<string, string>>): Promise<void> {
  let info: Awaited<ReturnType<typeof stat>> | undefined; try { info = await stat(destination); } catch { fail(`existing bundle is missing: ${destination}`); }
  if (!info?.isDirectory()) fail(`existing bundle is not a directory: ${destination}`);
  const names = (await readdir(destination)).sort(); const expected = Object.keys(files).sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) fail("existing bundle has unexpected files");
  await Promise.all(Object.entries(files).map(async ([name, bytes]) => { let existing: string | undefined; try { existing = await readFile(join(destination, name), "utf8"); } catch { fail(`existing bundle is missing ${name}`); } if (existing !== bytes) fail(`existing bundle has noncanonical ${name}`); }));
}
export async function compileNationalTigerArtifacts(options: CompilerOptions): Promise<{ bundleHash: string; bundlePath: string }> {
  const sources = await readAndVerifySourceLock(options.sourceLock, options.sourceDir, { testBaseUrl: options.testBaseUrl });
  const cd = normalizeRawNationalTigerCollection(JSON.parse(await readFile(options.rawCd119, "utf8")), "cd119"); const states = normalizeRawNationalTigerCollection(JSON.parse(await readFile(options.rawStates, "utf8")), "state");
  const parsed = parseNationalTigerArtifacts(cd, states); const cdBytes = canonical(cd); const statesBytes = canonical(states);
  const manifest = createNationalTigerManifest(sources, sha(cdBytes), sha(statesBytes), parsed); const manifestBytes = canonical(manifest);
  const bundleManifest = { schemaVersion: 1, nationalTigerManifestSha256: sha(manifestBytes), artifacts: manifest.artifacts }; const bundleBytes = canonical(bundleManifest); const bundleHash = sha(bundleBytes); const destination = join(options.bundleRoot, bundleHash);
  const files = { "tiger2025-national-cd119.geojson": cdBytes, "tiger2025-national-states.geojson": statesBytes, "tiger2025-national-manifest.json": manifestBytes, "bundle-manifest.json": bundleBytes };
  try { await stat(destination); await verifyBundle(destination, files); return { bundleHash, bundlePath: destination }; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(options.bundleRoot, { recursive: true }); const temporary = join(options.bundleRoot, `.${bundleHash}.tmp-${process.pid}-${Date.now()}`);
  try { await mkdir(temporary); await Promise.all(Object.entries(files).map(([name, bytes]) => writeFile(join(temporary, name), bytes))); try { await rename(temporary, destination); } catch (error) { if (!(["EEXIST", "ENOTEMPTY"] as string[]).includes((error as NodeJS.ErrnoException).code ?? "")) throw error; await verifyBundle(destination, files); } return { bundleHash, bundlePath: destination }; } finally { await rm(temporary, { recursive: true, force: true }); }
}
async function main(): Promise<void> { const args = process.argv.slice(2); const get = (name: string) => { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) fail(`missing ${name}`); return args[i + 1]!; }; const result = await compileNationalTigerArtifacts({ sourceLock: get("--source-lock"), sourceDir: get("--source-dir"), rawCd119: get("--raw-cd119"), rawStates: get("--raw-states"), bundleRoot: get("--bundle-root") }); process.stdout.write(`${result.bundleHash}\n`); }
if (process.argv[1]?.endsWith("compile-national-tiger-artifacts.ts")) void main();
