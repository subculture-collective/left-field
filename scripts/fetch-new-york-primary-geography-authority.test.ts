import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const script = resolve(repoRoot, "scripts/fetch-new-york-primary-geography-authority.mjs");
const retained = resolve(repoRoot, "data/source/tiger2022/tl_2022_36_cd118.zip");

describe("New York primary geography authority acquisition", () => {
  it("replays exact retained bytes idempotently and rejects cache drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ny-geography-test-"));
    const run = (cache: string) => spawnSync(process.execPath, [script], {
      cwd: work,
      env: { ...process.env, DSA_SEATS_NY_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE: cache },
      encoding: "utf8",
    });
    const first = run(retained);
    expect(first.status, first.stderr).toBe(0);
    const output = join(work, "data/source/tiger2022/tl_2022_36_cd118.zip");
    expect(readFileSync(output)).toEqual(readFileSync(retained));
    expect(run(retained).status).toBe(0);
    const wrong = join(work, "wrong.zip");
    writeFileSync(wrong, Buffer.from("PK\x03\x04wrong-source-bytes"));
    const drifted = run(wrong);
    expect(drifted.status).not.toBe(0);
    expect(drifted.stderr).toContain("NY_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
  }, 15_000);

  it("contains the complete 26-district CD118 DBF inventory", () => {
    const bytes = execFileSync("unzip", ["-p", retained, "tl_2022_36_cd118.dbf"]);
    expect(bytes.length).toBe(3_330);
    const count = bytes.readUInt32LE(4);
    const headerLength = bytes.readUInt16LE(8);
    const recordLength = bytes.readUInt16LE(10);
    const fields: Array<{ name: string; length: number; offset: number }> = [];
    let offset = 1;
    for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) {
      const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim();
      const length = bytes[cursor + 16]!;
      fields.push({ name, length, offset });
      offset += length;
    }
    const rows = Array.from({ length: count }, (_, index) => {
      const start = headerLength + index * recordLength;
      return Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()]));
    }).sort((left, right) => left.GEOID20.localeCompare(right.GEOID20));
    const districts = Array.from({ length: 26 }, (_, index) => String(index + 1).padStart(2, "0"));
    expect(rows).toHaveLength(26);
    expect(rows.map((row) => row.CD118FP)).toEqual(districts);
    expect(rows.every((row) => row.STATEFP20 === "36" && row.CDSESSN === "118" && row.GEOID20 === `36${row.CD118FP}`)).toBe(true);
  });
});
