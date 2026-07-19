import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NATIONWIDE_SEAT_POLICY } from "../src/domain/validate-manifest";
import { TIGER_2025_JURISDICTIONS } from "../src/ingestion/tiger/national";
import { compileNationalTigerArtifacts, readAndVerifySourceLock } from "./compile-national-tiger-artifacts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildScript = join(repositoryRoot, "scripts/build-national-tiger-artifacts.sh");
const localTsx = join(repositoryRoot, "node_modules/.bin/tsx");
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const geometry = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] };
const artifactNames = [
  "bundle-manifest.json",
  "tiger2025-national-cd119.geojson",
  "tiger2025-national-manifest.json",
  "tiger2025-national-states.geojson",
];

function fixture(kind: "cd119" | "state"): { type: string; features: unknown[] } {
  const features: unknown[] = [];
  for (const [STATEFP, STUSPS] of Object.entries(TIGER_2025_JURISDICTIONS)) {
    if (kind === "state") features.push({ type: "Feature", properties: { GEOID: STATEFP, STATEFP, STUSPS }, geometry });
    else {
      const count = NATIONWIDE_SEAT_POLICY[STUSPS as keyof typeof NATIONWIDE_SEAT_POLICY]?.[0] ?? 1;
      for (let index = 0; index < count; index += 1) {
        const CD119FP = ["DC", "AS", "GU", "MP", "PR", "VI"].includes(STUSPS) ? "98" : count === 1 ? "00" : String(index + 1).padStart(2, "0");
        features.push({ type: "Feature", properties: { GEOID: `${STATEFP}${CD119FP}`, STATEFP, CD119FP, CDSESSN: "119", NAMELSAD: "District" }, geometry });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

const sourceNames = [...Object.keys(TIGER_2025_JURISDICTIONS).map((fips) => `tl_2025_${fips}_cd119.zip`), "tl_2025_us_state.zip"];

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function waitForFile(path: string, description: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!(await exists(path))) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

function runBuilder(args: string[], env: Record<string, string> = {}): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn("bash", [buildScript, ...args], { env: { ...process.env, ...env } as NodeJS.ProcessEnv, stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`builder was terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

async function assertNoTransientFiles(output: string): Promise<void> {
  expect((await readdir(output)).filter((name) => name.startsWith(".national-tiger-") || name.startsWith(".current-"))).toEqual([]);
}

describe("national TIGER compiler", () => {
  it("uses only v1 entries and rejects malformed source locks and tampered reuse", async () => {
    const root = await mkdtemp(join(tmpdir(), "national-tiger-"));
    const source = join(root, "source");
    const bundles = join(root, "bundles");
    const lock = join(root, "lock.json");
    await Promise.all([mkdir(source), mkdir(bundles)]);
    try {
      await Promise.all(sourceNames.map((name) => writeFile(join(source, name), name)));
      const entries = sourceNames.map((name) => ({ url: `https://fixture.invalid/${name}`, retainedPath: join(source, name), retainedStatus: "retained", sha256: hash(name), kind: "source" }));
      const write = (value: unknown) => writeFile(lock, JSON.stringify(value));
      await write({ sourceArchives: {} });
      await expect(readAndVerifySourceLock(lock, source)).rejects.toThrow("version-1");
      for (const bad of [
        [...entries, entries[0]],
        entries.map((entry, index) => index ? entry : { ...entry, url: "https://evil.invalid/x" }),
        entries.map((entry, index) => index ? entry : { ...entry, retainedPath: join(root, "wrong.zip") }),
        entries.map((entry, index) => index ? entry : { ...entry, sha256: "0".repeat(64) }),
      ]) {
        await write({ version: 1, entries: bad });
        await expect(readAndVerifySourceLock(lock, source, { testBaseUrl: "https://fixture.invalid" })).rejects.toThrow();
      }
      await write({ version: 1, entries });
      await writeFile(join(root, "cd.json"), JSON.stringify(fixture("cd119")));
      await writeFile(join(root, "states.json"), JSON.stringify(fixture("state")));
      const options = { sourceLock: lock, sourceDir: source, rawCd119: join(root, "cd.json"), rawStates: join(root, "states.json"), bundleRoot: bundles, testBaseUrl: "https://fixture.invalid" };
      const first = await compileNationalTigerArtifacts(options);
      expect(await compileNationalTigerArtifacts(options)).toEqual(first);
      expect(JSON.parse(await readFile(join(first.bundlePath, "tiger2025-national-manifest.json"), "utf8")).sourceArchives).toHaveProperty(sourceNames[0]!);
      await writeFile(join(first.bundlePath, "bundle-manifest.json"), "tampered\n");
      await expect(compileNationalTigerArtifacts(options)).rejects.toThrow("noncanonical");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("national TIGER artifact builder", () => {
  it("filters ZZ CD119 features before compilation", async () => {
    await expect(readFile(buildScript, "utf8")).resolves.toContain('CDSESSN == "119" && CD119FP != "ZZ"');
  });
  it("publishes immutable bundles, preserves the current pointer on failure, and serializes builders", async () => {
    const root = await mkdtemp(join(tmpdir(), "national-tiger-builder-"));
    const source = join(root, "source");
    const output = join(root, "output");
    const lock = join(root, "source-lock.json");
    const rawCd = join(root, "raw-cd119.json");
    const rawStates = join(root, "raw-states.json");
    const mapshaper = join(root, "mapshaper");
    const args = ["--source-dir", source, "--output-dir", output, "--source-lock", lock, "--mapshaper", mapshaper, "--tsx", localTsx];
    expect(sourceNames).toHaveLength(57);
    await Promise.all([mkdir(source), mkdir(output)]);
    await Promise.all([writeFile(rawCd, JSON.stringify(fixture("cd119"))), writeFile(rawStates, JSON.stringify(fixture("state")))]);
    try {
      await Promise.all(sourceNames.map((name) => writeFile(join(source, name), `tiny official fixture: ${name}`)));
      await writeFile(lock, JSON.stringify({
        version: 1,
        entries: await Promise.all(sourceNames.map(async (name) => ({
          url: `https://www2.census.gov/geo/tiger/TIGER2025/${name === "tl_2025_us_state.zip" ? "STATE" : "CD"}/${name}`,
          retainedPath: join(source, name),
          retainedStatus: "retained",
          sha256: hash(await readFile(join(source, name))),
          kind: "source",
        }))),
      }));
      await writeFile(mapshaper, `#!/usr/bin/env bash
set -euo pipefail
[[ "\${FAKE_MAPSHAPER_FAIL:-}" != 1 ]] || exit 42
if [[ -n "\${FAKE_MAPSHAPER_READY:-}" ]]; then
  : > "$FAKE_MAPSHAPER_READY"
  while [[ ! -e "$FAKE_MAPSHAPER_RELEASE" ]]; do sleep 0.01; done
fi
output="\${!#}"
if [[ "$1" == *us_state.zip ]]; then cp "$FAKE_RAW_STATES" "$output"; else cp "$FAKE_RAW_CD" "$output"; fi
`);
      await chmod(mapshaper, 0o755);
      const environment = { FAKE_RAW_CD: rawCd, FAKE_RAW_STATES: rawStates };

      expect(await runBuilder(args, environment)).toBe(0);
      const bundleName = await readlink(join(output, "current"));
      expect(bundleName).toMatch(/^versions\/[a-f0-9]{64}$/);
      expect((await lstat(join(output, "current"))).isSymbolicLink()).toBe(true);
      expect((await stat(join(output, "current"))).isDirectory()).toBe(true);
      const bundle = join(output, bundleName);
      expect((await readdir(bundle)).sort()).toEqual(artifactNames);
      expect(await Promise.all(artifactNames.map((name) => readFile(join(bundle, name))))).toEqual(expect.any(Array));
      const originalBytes = await Promise.all(artifactNames.map(async (name) => [name, await readFile(join(bundle, name), "utf8")] as const));
      expect(await runBuilder(args, environment)).toBe(0);
      expect(await readlink(join(output, "current"))).toBe(bundleName);
      await Promise.all(originalBytes.map(async ([name, bytes]) => expect(await readFile(join(bundle, name), "utf8")).toBe(bytes)));
      expect((await readdir(output)).filter((name) => artifactNames.includes(name))).toEqual([]);
      await assertNoTransientFiles(output);

      await mkdir(join(output, ".national-tiger.lock"));
      expect(await runBuilder(args, environment)).toBe(75);
      expect(await readlink(join(output, "current"))).toBe(bundleName);
      await rm(join(output, ".national-tiger.lock"), { recursive: true });

      expect(await runBuilder(args, { ...environment, FAKE_MAPSHAPER_FAIL: "1" })).toBe(42);
      expect(await readlink(join(output, "current"))).toBe(bundleName);
      await writeFile(join(source, sourceNames[0]!), "checksum failure");
      expect(await runBuilder(args, environment)).not.toBe(0);
      expect(await readlink(join(output, "current"))).toBe(bundleName);
      await Promise.all(originalBytes.map(async ([name, bytes]) => expect(await readFile(join(bundle, name), "utf8")).toBe(bytes)));
      await assertNoTransientFiles(output);

      await writeFile(join(source, sourceNames[0]!), `tiny official fixture: ${sourceNames[0]}`);
      const ready = join(root, "mapshaper-ready");
      const release = join(root, "mapshaper-release");
      const first = runBuilder(args, { ...environment, FAKE_MAPSHAPER_READY: ready, FAKE_MAPSHAPER_RELEASE: release });
      await waitForFile(ready, "the first builder to enter mapshaper");
      expect(await runBuilder(args, environment)).toBe(75);
      await writeFile(release, "release");
      expect(await first).toBe(0);
      expect(await readlink(join(output, "current"))).toBe(bundleName);
      await assertNoTransientFiles(output);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
