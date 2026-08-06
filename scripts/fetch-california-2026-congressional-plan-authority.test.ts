import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const script = join(root, "scripts/fetch-california-2026-congressional-plan-authority.mjs");
const retained = {
  "california-redistricting-status.html": "data/source/elections/primary-results/geography/california/2026/california-redistricting-status.html",
  "prop50-official-voter-guide.pdf": "data/source/elections/primary-results/geography/california/2026/prop50-official-voter-guide.pdf",
  "2025-congressional-districts.html": "data/source/elections/primary-results/geography/california/2026/2025-congressional-districts.html",
  "ab604.csv": "data/source/elections/primary-results/geography/california/2026/ab604.csv",
} as const;

function cache() {
  const dir = mkdtempSync(join(tmpdir(), "dsa-seats-ca-plan-cache-"));
  for (const [name, path] of Object.entries(retained)) {
    writeFileSync(join(dir, name), readFileSync(join(root, path)));
  }
  return dir;
}

describe("California 2026 congressional plan authority acquisition", () => {
  it("describes four immutable official inputs and two deterministic block extracts", () => {
    const output = execFileSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_DESCRIBE: "1",
      },
      encoding: "utf8",
    });
    const value = JSON.parse(output);

    expect(value).toMatchObject({
      verifiedSources: 4,
      retainedSources: 4,
      derivedExtracts: 2,
    });
    expect(value.sources.map((row: { id: string }) => row.id)).toEqual([
      "ca-proposition-50-current-election-use-status-20260806",
      "ca-proposition-50-official-voter-guide-2025",
      "ca-ab604-official-plan-source-page-20260806",
      "ca-ab604-block-equivalency-20250818",
    ]);
  });

  it("replays verified cached bytes and emits exact complete block extracts", () => {
    const out = mkdtempSync(join(tmpdir(), "dsa-seats-ca-plan-output-"));
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_CACHE_DIR: cache(),
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_OUTPUT_DIR: out,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_CD119_BUNDLE: join(root, "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip"),
      },
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      verifiedSources: 4,
      retainedSources: 4,
      derivedExtracts: 2,
      planBlocks: 519723,
      currentBlocks: 519723,
      commonBlocks: 519723,
      changedAssignments: 133426,
      planDistricts: 52,
      currentDistricts: 52,
    });
    expect(readFileSync(join(out, "06_CA_CD120_AB604.txt"))).toEqual(readFileSync(join(root, "data/source/elections/primary-results/geography/california/2026/06_CA_CD120_AB604.txt")));
    expect(readFileSync(join(out, "06_CA_CD119.txt"))).toEqual(readFileSync(join(root, "data/source/elections/primary-results/geography/california/current/06_CA_CD119.txt")));
  }, 120_000);

  it("rejects source drift and conflicting outputs", () => {
    const drift = cache();
    writeFileSync(join(drift, "california-redistricting-status.html"), "drift");
    const driftRun = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_CACHE_DIR: drift,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_OUTPUT_DIR: mkdtempSync(join(tmpdir(), "dsa-seats-ca-plan-drift-")),
      },
      encoding: "utf8",
    });
    expect(driftRun.status).not.toBe(0);
    expect(driftRun.stderr).toContain("CA_2026_PLAN_AUTHORITY_SOURCE_DRIFT");

    const out = mkdtempSync(join(tmpdir(), "dsa-seats-ca-plan-conflict-"));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "06_CA_CD120_AB604.txt"), "conflict");
    const conflictRun = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_CACHE_DIR: cache(),
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_OUTPUT_DIR: out,
        DSA_SEATS_CA_2026_PLAN_AUTHORITY_CD119_BUNDLE: join(root, "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip"),
      },
      encoding: "utf8",
    });
    expect(conflictRun.status).not.toBe(0);
    expect(conflictRun.stderr).toContain("CA_2026_PLAN_AUTHORITY_OUTPUT_CONFLICT");
  }, 120_000);
});
