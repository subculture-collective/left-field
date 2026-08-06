import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/fetch-new-york-2022-primary-block-authority.mjs");
describe("New York 2022 court-ordered congressional block authority acquisition", () => {
  it("describes the pinned official landing page and block assignment", () => {
    const run = spawnSync(process.execPath, [script], { env: { ...process.env, DSA_SEATS_NY_2022_BLOCK_AUTHORITY_DESCRIBE: "1" }, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0); const value = JSON.parse(run.stdout);
    expect(value.verifiedSources).toBe(2); expect(value.retainedSources).toBe(2);
    expect(value.sources.map((source: { id: string }) => source.id)).toEqual(["ny-latfor-2022-congressional-map-authority", "ny-2022-court-ordered-congressional-block-assignment"]);
  });
  it("rejects source drift before writing", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ny-block-authority-")), cache = join(work, "cache"); mkdirSync(cache); writeFileSync(join(cache, "index.html"), "drift");
    const run = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_NY_2022_BLOCK_AUTHORITY_CACHE_DIR: cache }, encoding: "utf8" });
    expect(run.status).not.toBe(0); expect(run.stderr).toContain("NY_2022_BLOCK_AUTHORITY_SOURCE_DRIFT:ny-latfor-2022-congressional-map-authority");
  });
});
