import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/extract-new-york-cd119-bef.mjs");
describe("New York CD119 block-equivalency extraction", () => {
  it("describes the exact New York member from the pinned Census bundle", () => {
    const run = spawnSync(process.execPath, [script], { env: { ...process.env, DSA_SEATS_NY_CD119_BEF_DESCRIBE: "1" }, encoding: "utf8" }); expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ member: "36_NY_CD119.txt", byteSize: 5776392, sha256: "670447571d72c0465cd27ac9769c2e969669d7decb06a4198c653b755ff2e46a", records: 288819 });
  });
  it("rejects parent bundle drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ny-bef-")), fake = join(work, "bundle.zip"); writeFileSync(fake, "drift");
    const run = spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_NY_CD119_BEF_BUNDLE_PATH: fake }, encoding: "utf8" }); expect(run.status).not.toBe(0); expect(run.stderr).toContain("NY_CD119_BEF_PARENT_DRIFT");
  });
});
