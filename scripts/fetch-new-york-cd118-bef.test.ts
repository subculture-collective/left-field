import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
const script = resolve("scripts/fetch-new-york-cd118-bef.mjs");
describe("New York CD118 Census block-equivalency acquisition", () => {
  it("describes the pinned national bundle and New York member", () => { const run = spawnSync(process.execPath, [script], { env: { ...process.env, DSA_SEATS_NY_CD118_BEF_DESCRIBE: "1" }, encoding: "utf8" }); expect(run.status, run.stderr).toBe(0); const value = JSON.parse(run.stdout); expect(value.bundle.byteSize).toBe(25922515); expect(value.member).toEqual({ name: "36_NY_CD118.txt", byteSize: 5776393, sha256: "359d8ec177dacf6511baf68c734a999ca9ff21ec4ef9897b85213838ed5c218a", records: 288819 }); });
  it("rejects bundle drift", () => { const work = mkdtempSync(join(tmpdir(), "dsa-seats-ny-cd118-")), fake = join(work, "bundle.zip"); writeFileSync(fake, "drift"); const run = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_NY_CD118_BEF_CACHE_PATH: fake }, encoding: "utf8" }); expect(run.status).not.toBe(0); expect(run.stderr).toContain("NY_CD118_BEF_BUNDLE_DRIFT"); });
});
