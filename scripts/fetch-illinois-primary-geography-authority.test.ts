import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const script = resolve(repoRoot, "scripts/fetch-illinois-primary-geography-authority.mjs");
const retained = resolve(repoRoot, "data/source/tiger2022/tl_2022_17_cd118.zip");

describe("Illinois primary geography authority acquisition", () => {
  it("replays exact retained bytes idempotently and rejects cache drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-il-geography-test-"));
    const run = (cache: string) => spawnSync(process.execPath, [script], {
      cwd: work,
      env: { ...process.env, DSA_SEATS_IL_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE: cache },
      encoding: "utf8",
    });

    const first = run(retained);
    expect(first.status, first.stderr).toBe(0);
    const output = join(work, "data/source/tiger2022/tl_2022_17_cd118.zip");
    expect(readFileSync(output)).toEqual(readFileSync(retained));
    expect(run(retained).status).toBe(0);

    const wrong = join(work, "wrong.zip");
    writeFileSync(wrong, Buffer.from("PK\x03\x04wrong-source-bytes"));
    const drifted = run(wrong);
    expect(drifted.status).not.toBe(0);
    expect(drifted.stderr).toContain("IL_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
  }, 15_000);
});
