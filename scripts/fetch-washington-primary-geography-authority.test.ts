import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const script = resolve(repoRoot, "scripts/fetch-washington-primary-geography-authority.mjs");
const retained = resolve(repoRoot, "data/source/tiger2022/tl_2022_53_cd118.zip");

describe("Washington primary geography authority acquisition", () => {
  it("replays exact retained bytes idempotently and rejects cache drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-wa-geography-test-"));
    const run = (cache: string) => spawnSync(process.execPath, [script], {
      cwd: work,
      env: { ...process.env, DSA_SEATS_WA_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE: cache },
      encoding: "utf8",
    });
    const first = run(retained);
    expect(first.status, first.stderr).toBe(0);
    const output = join(work, "data/source/tiger2022/tl_2022_53_cd118.zip");
    expect(readFileSync(output)).toEqual(readFileSync(retained));
    expect(run(retained).status).toBe(0);
    writeFileSync(output, Buffer.from("PK\x03\x04conflicting-output-bytes"));
    const conflict = run(retained);
    expect(conflict.status).not.toBe(0);
    expect(conflict.stderr).toContain("WA_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT");
    const wrong = join(work, "wrong.zip");
    writeFileSync(wrong, Buffer.from("PK\x03\x04wrong-source-bytes"));
    const drifted = run(wrong);
    expect(drifted.status).not.toBe(0);
    expect(drifted.stderr).toContain("WA_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
  }, 15_000);

  it("contains the complete ten-district CD118 DBF inventory", () => {
    const bytes = execFileSync("unzip", ["-p", retained, "tl_2022_53_cd118.dbf"]);
    expect(bytes.length).toBe(1_538);
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
    const districts = Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0"));
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.CD118FP)).toEqual(districts);
    expect(rows.every((row) => row.STATEFP20 === "53" && row.CDSESSN === "118" && row.GEOID20 === `53${row.CD118FP}`)).toBe(true);
  });
});
