import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/fetch-connecticut-primary-nomination-authority.mjs");
describe("Connecticut primary nomination authority acquisition", () => {
  it("describes fourteen pinned sources with only three privacy-safe retained indexes", () => {
    const run = spawnSync(process.execPath, [script], { env: { ...process.env, DSA_SEATS_CT_NOMINATION_AUTHORITY_DESCRIBE: "1" }, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const description = JSON.parse(run.stdout) as { verifiedSources: number; retainedSources: number; sources: Array<{ id: string; retained: boolean }> };
    expect(description.verifiedSources).toBe(14);
    expect(description.retainedSources).toBe(3);
    expect(description.sources.filter((source) => source.retained).map((source) => source.id)).toEqual(["2022-index", "2024-index", "2024-list-index"]);
    expect(description.sources.filter((source) => !source.retained)).toHaveLength(11);
  });

  it("rejects drift before writing protected source derivatives", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ct-nomination-"));
    const cache = join(work, "cache");
    mkdirSync(cache);
    writeFileSync(join(cache, "2022.html"), Buffer.from("drift"));
    const drift = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CT_NOMINATION_AUTHORITY_CACHE_DIR: cache }, encoding: "utf8" });
    expect(drift.status).not.toBe(0);
    expect(drift.stderr).toContain("CT_NOMINATION_AUTHORITY_SOURCE_DRIFT");
  });
});
