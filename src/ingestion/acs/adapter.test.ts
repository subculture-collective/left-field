import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACS_INDICATOR_DICTIONARY } from "./indicator-dictionary";
import { AcsTableParserError, parseAcsSummaryTable } from "./table-parser";
import { ACS_SOURCE_LIMITS, createAcsAdapter, decodeAcsStagedExtras } from "./adapter";
import { LocalRawObjectStore } from "../core/raw-object-store";

const population = ACS_INDICATOR_DICTIONARY[0]!;
const header = "GEO_ID|B01003_E001|B01003_M001";
const row = (geoid: string, estimate = "100", moe = "5") => `${geoid}|${estimate}|${moe}`;
const parse = (text: string) => parseAcsSummaryTable(new TextEncoder().encode(text), population);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const collect = async <T>(items: AsyncIterable<T>) => { const result: T[] = []; for await (const item of items) result.push(item); return result; };

describe("bounded ACS indicator dictionary and summary table parser", () => {
  it("freezes exactly the three authorized direct indicators", () => {
    expect(ACS_INDICATOR_DICTIONARY.map(x => [x.lockId, x.variableId, x.estimateColumn, x.marginOfErrorColumn, x.unit])).toEqual([
      ["acs-b01003", "B01003_001E", "B01003_E001", "B01003_M001", "count"],
      ["acs-b01002", "B01002_001E", "B01002_E001", "B01002_M001", "years"],
      ["acs-b19013", "B19013_001E", "B19013_E001", "B19013_M001", "usd"],
    ]);
    expect(Object.isFrozen(ACS_INDICATOR_DICTIONARY)).toBe(true);
  });

  it("retains district rows, preserves zeroes, and emits FactValue fields", async () => {
    const rows = await parse(`${header}\n${row("5001900US0101")}\n${row("5001900US09ZZ")}\n0400000US01|1|1\n`);
    expect(rows).toEqual([{ sourceGeoid: "5001900US0101", stateFips: "01", districtCode: "01", indicatorDefinitionId: "acs-total-population", estimate: { kind: "value", value: 100 }, marginOfError: { kind: "value", value: 5 }, sourceNaturalKey: "acs-total-population:5001900US0101" }]);
  });

  it("maps all official sentinels explicitly", async () => {
    const rows = await parse(`${header}\n${row("5001900US0101", "", "-555555555")}\n${row("5001900US0102", "-888888888", "-999999999")}\n${row("5001900US0103", "-666666666", "-222222222")}\n${row("5001900US0104", "-333333333", "")}`);
    expect(rows.map(x => [x.estimate, x.marginOfError])).toEqual([
      [{ kind: "missing", reason: "not_reported" }, { kind: "missing", reason: "not_applicable" }],
      [{ kind: "missing", reason: "not_applicable" }, { kind: "missing", reason: "suppressed" }],
      [{ kind: "missing", reason: "not_reported" }, { kind: "missing", reason: "not_reported" }],
      [{ kind: "missing", reason: "not_reported" }, { kind: "missing", reason: "not_reported" }],
    ]);
  });

  it("accepts the exact full B01002 table header while publishing only its authorized pair", async () => {
    const age = ACS_INDICATOR_DICTIONARY[1]!;
    const text = `GEO_ID|${age.sourceColumns.join("|")}\n5001900US0101|39.1|0.4|37.8|0.5|40.2|0.6`;
    await expect(parseAcsSummaryTable(new TextEncoder().encode(text), age)).resolves.toEqual([
      expect.objectContaining({ stateFips: "01", districtCode: "01", estimate: { kind: "value", value: 39.1 }, marginOfError: { kind: "value", value: 0.4 } }),
    ]);
  });

  it("rejects invalid headers, rows, numbers, GEOIDs, duplicates, and unknown sentinels", async () => {
    await expect(parse(`GEO_ID|B01003_E001\n`)).rejects.toMatchObject({ code: "ACS_HEADER_INVALID" });
    await expect(parse(`GEO_ID|NAME|B01003_E001|B01003_M001\n`)).rejects.toMatchObject({ code: "ACS_HEADER_INVALID" });
    await expect(parse(`${header}\n5001900US0101|1`)).rejects.toMatchObject({ code: "ACS_ROW_WIDTH" });
    await expect(parse(`${header}\n${row("5001900US01AA")}`)).rejects.toMatchObject({ code: "ACS_GEOID_INVALID" });
    await expect(parse(`${header}\n${row("5001900US0101", "NaN")}\n`)).rejects.toMatchObject({ code: "ACS_NUMERIC_INVALID" });
    await expect(parse(`${header}\n${row("5001900US0101")}\n${row("5001900US0101")}`)).rejects.toMatchObject({ code: "ACS_GEOID_DUPLICATE" });
    await expect(parse(`${header}\n${row("5001900US0101", "-1")}`)).rejects.toMatchObject({ code: "ACS_UNKNOWN_SENTINEL" });
    await expect(parse(`${header}\n${row("5001900US0101", "-555555555")}`)).rejects.toMatchObject({ code: "ACS_UNKNOWN_SENTINEL" });
    expect(new AcsTableParserError("ACS_UNKNOWN_SENTINEL", "x")).toBeInstanceOf(Error);
  });

  it("streams across chunk boundaries and returns bytewise deterministic order", async () => {
    const text = `${header}\n${row("5001900US0201")}\n${row("5001900US0101")}`;
    async function* input(): AsyncIterable<Uint8Array> { const bytes = new TextEncoder().encode(text); yield bytes.slice(0, 7); yield bytes.slice(7, 31); yield bytes.slice(31); }
    const locale = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => { throw new Error("locale ordering must not be used"); });
    const rows = await parseAcsSummaryTable(input(), population);
    locale.mockRestore();
    expect(rows.map(x => x.sourceGeoid)).toEqual(["5001900US0101", "5001900US0201"]);
  });
});

describe("validated-only ACS source adapter", () => {
  const source = `${header}\n${row("5001900US0101", "", "-999999999")}\n${row("5001900US0102", "-1", "5")}`;
  const options = (root: string, bytes = new TextEncoder().encode(source)) => ({ rawStore: new LocalRawObjectStore(root), sourceLockSha256: "a".repeat(64), definition: population, lockId: population.lockId, sourceBytes: bytes, sourceUrl: population.sourceUrl, sourceChecksumSha256: digest(bytes), sourceByteSize: bytes.byteLength, snapshotId: "snap_acs" as never, parserVersion: "acs-test-1", upstreamRelease: "2024-5yr" });
  it("binds the exact direct-table receipt, emits private quarantines, and preserves missing reasons", async () => {
    const root = await mkdtemp(join(tmpdir(), "acs-adapter-"));
    try {
      const adapter = createAcsAdapter(options(root));
      const raw = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "acs" as never, cutoff: new Date() })))[0]!;
      expect(raw.receipt.sha256).toBe(raw.snapshot.checksumSha256);
      expect(raw.snapshot.license).toBe("public-domain");
      expect(raw.expectedRecordCount).toBe(2);
      const parsed = await collect(adapter.parse(raw));
      expect(parsed).toHaveLength(2);
      expect(parsed[1]).toMatchObject({ kind: "quarantine", errorCode: "ACS_UNKNOWN_SENTINEL", sourceNaturalKey: expect.stringMatching(/^[a-f0-9]{64}$/), payloadChecksum: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(JSON.stringify(parsed[1])).not.toContain("District");
      const staged = parsed[0]!; if (staged.kind !== "row") throw new Error("expected row");
      expect(staged.row.geography).toBe("0101"); expect(staged.row.estimate).toBeNull(); expect(staged.row.marginOfError).toBeNull();
      expect(decodeAcsStagedExtras(staged.row.redactedExtras)).toMatchObject({ estimateMissingReason: "not_reported", marginOfErrorMissingReason: "suppressed", stateFips: "01", districtCode: "01" });
      expect(() => decodeAcsStagedExtras({ ...staged.row.redactedExtras, NAME: "District" })).toThrow("ACS_EXTRAS_INVALID");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("uses one parameterized staging call, validates finite aggregate results, and cannot load", async () => {
    const root = await mkdtemp(join(tmpdir(), "acs-adapter-"));
    try {
      const adapter = createAcsAdapter(options(root)); const raw = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "acs" as never, cutoff: new Date() })))[0]!;
      const parsed = await collect(adapter.parse(raw)); const rows = parsed.filter((x): x is Extract<typeof x, { kind: "row" }> => x.kind === "row").map(x => x.row);
      const query = vi.fn().mockResolvedValue({ rows: [{ valid: true }] });
      await adapter.stage({ query } as never, "run", rows);
      expect(query).toHaveBeenCalledTimes(1); expect(query.mock.calls[0]![0]).toContain("INSERT INTO stg_acs");
      expect((query.mock.calls[0]![1] as unknown[])[8]).toEqual([expect.stringContaining('"schemaVersion":1')]);
      expect(await adapter.validateStaged({ query } as never, "run")).toEqual([]);
      query.mockResolvedValueOnce({ rows: [{ valid: false }] });
      expect((await adapter.validateStaged({ query } as never, "run"))[0]?.code).toBe("ACS_STAGE_INVALID");
      await expect(adapter.loadFromStage({} as never, "run", "release" as never)).rejects.toThrow("ACS_FINALIZE_REQUIRED");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("rejects mismatched lock, URL, size, hash, and oversized sources", async () => {
    const root = await mkdtemp(join(tmpdir(), "acs-adapter-"));
    try {
      expect(() => createAcsAdapter({ ...options(root), lockId: "acs-b01002" })).toThrow("ACS_SOURCE_RECEIPT_MISMATCH");
      expect(() => createAcsAdapter({ ...options(root), sourceUrl: "https://example.test/not-authorized" })).toThrow("ACS_SOURCE_RECEIPT_MISMATCH");
      expect(() => createAcsAdapter({ ...options(root), sourceByteSize: 1 })).toThrow("ACS_SOURCE_RECEIPT_MISMATCH");
      expect(() => createAcsAdapter({ ...options(root), sourceChecksumSha256: "b".repeat(64) })).toThrow("ACS_SOURCE_RECEIPT_MISMATCH");
      expect(ACS_SOURCE_LIMITS.tableBytes).toBe(32 * 1024 * 1024);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
