import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/fetch-connecticut-primary-geography-authority.mjs");
const retained = resolve("data/source/tiger2022/tl_2022_09_cd118.zip");

describe("Connecticut primary geography authority acquisition", () => {
  it("replays exact Census bytes idempotently and rejects drift", () => {
    const work = mkdtempSync(join(tmpdir(), "dsa-seats-ct-geography-"));
    const run = (cache: string) => spawnSync(process.execPath, [script], { cwd: work, env: { ...process.env, DSA_SEATS_CT_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE: cache }, encoding: "utf8" });
    expect(run(retained).status).toBe(0);
    expect(readFileSync(join(work, "data/source/tiger2022/tl_2022_09_cd118.zip"))).toEqual(readFileSync(retained));
    const wrong = join(work, "wrong.zip"); writeFileSync(wrong, Buffer.from("PK\x03\x04drift"));
    const drift = run(wrong); expect(drift.status).not.toBe(0); expect(drift.stderr).toContain("CT_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
  });

  it("contains the complete five-district plus sentinel CD118 DBF inventory", () => {
    const bytes = execFileSync("unzip", ["-p", retained, "tl_2022_09_cd118.dbf"]);
    expect(bytes.length).toBe(1090);
    const count = bytes.readUInt32LE(4), headerLength = bytes.readUInt16LE(8), recordLength = bytes.readUInt16LE(10);
    expect(count).toBe(6);
    const fields: Array<{ name: string; length: number; offset: number }> = []; let offset = 1;
    for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) { const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim(), length = bytes[cursor + 16]!; fields.push({ name, length, offset }); offset += length; }
    const rows = Array.from({ length: count }, (_, index) => { const start = headerLength + index * recordLength; return Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()])); });
    expect(rows.map((row) => row.CD118FP).sort()).toEqual(["01","02","03","04","05","ZZ"]);
    expect(rows.every((row) => row.STATEFP20 === "09" && row.CDSESSN === "118")).toBe(true);
  });
});
