import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const script = resolve(repoRoot, "scripts/fetch-colorado-primary-geography-authority.mjs");
const retained = resolve(repoRoot, "data/source/tiger2022/tl_2022_08_cd118.zip");

describe("Colorado primary geography authority acquisition", () => {
  it("replays exact retained bytes idempotently and rejects cache drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-co-geography-test-"));
    const run = (cache: string) => spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CO_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE: cache }, encoding: "utf8" });
    const first = run(retained); expect(first.status, first.stderr).toBe(0);
    const output = join(work, "data/source/tiger2022/tl_2022_08_cd118.zip"); expect(readFileSync(output)).toEqual(readFileSync(retained)); expect(run(retained).status).toBe(0);
    const wrong = join(work, "wrong.zip"); writeFileSync(wrong, Buffer.from("PK\x03\x04wrong-source-bytes")); const drifted = run(wrong);
    expect(drifted.status).not.toBe(0); expect(drifted.stderr).toContain("CO_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
  }, 15_000);

  it("contains the complete eight-district CD118 DBF inventory", () => {
    const bytes = execFileSync("unzip", ["-p", retained, "tl_2022_08_cd118.dbf"]);
    expect(bytes.length).toBe(1314);
    const count = bytes.readUInt32LE(4), headerLength = bytes.readUInt16LE(8), recordLength = bytes.readUInt16LE(10);
    const fields: Array<{ name: string; length: number; offset: number }> = []; let offset = 1;
    for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) { const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim(), length = bytes[cursor + 16]!; fields.push({ name, length, offset }); offset += length; }
    const rows = Array.from({ length: count }, (_, index) => { const start = headerLength + index * recordLength; return Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()])); }).sort((left, right) => left.GEOID20.localeCompare(right.GEOID20));
    expect(rows).toHaveLength(8); expect(rows.map((row) => row.CD118FP)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    expect(rows.every((row) => row.STATEFP20 === "08" && row.CDSESSN === "118" && row.GEOID20 === `08${row.CD118FP}`)).toBe(true);
  });
});
