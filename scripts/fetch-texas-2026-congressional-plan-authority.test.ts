import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const script = join(root, "scripts/fetch-texas-2026-congressional-plan-authority.mjs");
const retained = {
  "current-districts.html": "data/source/elections/primary-results/geography/texas/2026/texas-current-districts-status.html",
  "hb4-enrolled.html": "data/source/elections/primary-results/geography/texas/2026/hb4-enrolled.html",
  "planc2333-dataset.json": "data/source/elections/primary-results/geography/texas/2026/planc2333-dataset.json",
  "planc2333-block.zip": "data/source/elections/primary-results/geography/texas/2026/PLANC2333_blk.zip",
} as const;

function cache() {
  const dir = mkdtempSync(join(tmpdir(), "dsa-seats-tx-plan-cache-"));
  for (const [name, path] of Object.entries(retained)) writeFileSync(join(dir, name), readFileSync(join(root, path)));
  return dir;
}

describe("Texas 2026 congressional plan authority acquisition", () => {
  it("describes four immutable official inputs and two deterministic extracts", () => {
    const output = execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, DSA_SEATS_TX_2026_PLAN_AUTHORITY_DESCRIBE: "1" }, encoding: "utf8" });
    const value = JSON.parse(output);
    expect(value).toMatchObject({ verifiedSources: 4, retainedSources: 4, derivedExtracts: 2 });
    expect(value.sources.map((row: { id: string }) => row.id)).toEqual([
      "tx-plan-c2333-current-election-use-status-20260806",
      "tx-hb4-enrolled-plan-c2333-2025",
      "tx-planc2333-dataset-metadata-20260806",
      "tx-planc2333-block-equivalency-20250818",
    ]);
  });

  it("replays verified cached bytes and emits exact block extracts", () => {
    const out = mkdtempSync(join(tmpdir(), "dsa-seats-tx-plan-output-"));
    const currentBundle = join(root, "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
    const result = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, DSA_SEATS_TX_2026_PLAN_AUTHORITY_CACHE_DIR: cache(), DSA_SEATS_TX_2026_PLAN_AUTHORITY_OUTPUT_DIR: out, DSA_SEATS_TX_2026_PLAN_AUTHORITY_CD119_BUNDLE: currentBundle }, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value).toMatchObject({ verifiedSources: 4, retainedSources: 4, planBlocks: 668757, currentBlocks: 668757, planDistricts: 38, currentDistricts: 38 });
    expect(readFileSync(join(out, "PLANC2333.csv"))).toEqual(readFileSync(join(root, "data/source/elections/primary-results/geography/texas/2026/PLANC2333.csv")));
    expect(readFileSync(join(out, "48_TX_CD119.txt"))).toEqual(readFileSync(join(root, "data/source/elections/primary-results/geography/texas/current/48_TX_CD119.txt")));
  }, 120_000);

  it("rejects source drift and conflicting outputs", () => {
    const drift = cache();
    writeFileSync(join(drift, "current-districts.html"), "drift");
    const driftRun = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, DSA_SEATS_TX_2026_PLAN_AUTHORITY_CACHE_DIR: drift, DSA_SEATS_TX_2026_PLAN_AUTHORITY_OUTPUT_DIR: mkdtempSync(join(tmpdir(), "dsa-seats-tx-plan-drift-")) }, encoding: "utf8" });
    expect(driftRun.status).not.toBe(0);
    expect(driftRun.stderr).toContain("TX_2026_PLAN_AUTHORITY_SOURCE_DRIFT");

    const out = mkdtempSync(join(tmpdir(), "dsa-seats-tx-plan-conflict-"));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "PLANC2333.csv"), "conflict");
    const conflict = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, DSA_SEATS_TX_2026_PLAN_AUTHORITY_CACHE_DIR: cache(), DSA_SEATS_TX_2026_PLAN_AUTHORITY_OUTPUT_DIR: out }, encoding: "utf8" });
    expect(conflict.status).not.toBe(0);
    expect(conflict.stderr).toContain("TX_2026_PLAN_AUTHORITY_OUTPUT_CONFLICT");
  });
});
