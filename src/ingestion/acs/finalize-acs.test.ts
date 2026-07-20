import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import {
  assertPersistedTask7AcsInvariant,
  finalizeCandidateAcs,
  verifyPersistedTask7AcsCandidate,
} from "./finalize-acs";
import { ACS_INDICATOR_DICTIONARY } from "./indicator-dictionary";

const emptyResult = <T extends QueryResultRow>(rows: readonly T[] = []) => ({ rows, rowCount: rows.length });
const rawStore = { put: async () => { throw new Error("unexpected write"); }, read: async () => new Uint8Array() };
const sourceLockEntries = ACS_INDICATOR_DICTIONARY.map((definition, index) => ({ id: definition.lockId, url: definition.sourceUrl, sha256: String(index + 1).repeat(64), byteSize: index + 1 }));
const base = {
  pool: { connect: async () => { throw new Error("connect must not be called"); } } as unknown as Pool,
  rawStore, candidateReleaseId: "r2", sourceReleaseId: "r1", runIds: ["a", "b", "c"] as const,
  sourceLockSha256: "a".repeat(64),
  sourceLockEntries,
};

function recordingPool(respond: (sql: string) => ReturnType<typeof emptyResult>): { readonly pool: Pool; readonly calls: string[]; readonly parameters: unknown[][] } {
  const calls: string[] = [];
  const parameters: unknown[][] = [];
  const client = {
    query: async <T extends QueryResultRow>(sql: string, values: unknown[] = []) => {
      calls.push(sql);
      parameters.push(values);
      return respond(sql) as ReturnType<typeof emptyResult<T>>;
    },
    release: () => undefined,
  } as unknown as PoolClient;
  return { pool: { connect: async () => client } as unknown as Pool, calls, parameters };
}

describe("ACS Task 7 finalizer input boundary", () => {
  it("rejects duplicate runs before opening a transaction", async () => {
    await expect(finalizeCandidateAcs({ ...base, runIds: ["a", "a", "c"] })).rejects.toThrow("ACS_FINALIZE_INPUT_INVALID");
  });

  it("rejects a malformed complete source lock before opening a transaction", async () => {
    await expect(verifyPersistedTask7AcsCandidate({ ...base, sourceLockSha256: "bad" })).rejects.toThrow("ACS_FINALIZE_INPUT_INVALID");
  });
  it.each(["sha256", "byteSize", "url"] as const)("rejects an adversarial exact lock entry %s before opening a transaction", async (field) => {
    const entry = { ...sourceLockEntries[0]!, [field]: field === "sha256" ? "bad" : field === "byteSize" ? -1 : "https://wrong.example/table" };
    await expect(finalizeCandidateAcs({ ...base, sourceLockEntries: [entry, ...sourceLockEntries.slice(1)] })).rejects.toThrow("ACS_FINALIZE_INPUT_INVALID");
  });

  it("runs Task 6 before any ACS mutation and rolls back an initial mismatch", async () => {
    const fixture = recordingPool((sql) => sql.includes("FROM data_releases r JOIN") ? emptyResult([{ ok: true }]) : emptyResult());
    await expect(finalizeCandidateAcs({ ...base, pool: fixture.pool })).rejects.toThrow("ACS_FINALIZE_RUN_INVALID");
    expect(fixture.calls).toContain("ROLLBACK");
    expect(fixture.calls.some((sql) => sql.startsWith("COMMIT"))).toBe(false);
    expect(fixture.calls.some((sql) => /INSERT INTO acs_|UPDATE release_manifests/.test(sql))).toBe(false);
  });

  it("rejects a staged not_applicable MOE relabeled as another missing reason", async () => {
    const definition = ACS_INDICATOR_DICTIONARY[0]!;
    const geoids = Array.from({ length: 437 }, (_, i) => `${String(Math.floor(i / 100) + 1).padStart(2, "0")}${String(i % 100).padStart(2, "0")}`);
    const make = (definition: typeof ACS_INDICATOR_DICTIONARY[number]) => new TextEncoder().encode([`GEO_ID|${definition.sourceColumns.join("|")}`, ...geoids.map((geoid, i) => `5001900US${geoid}|${definition.sourceColumns.map(column => column === definition.estimateColumn ? "1" : column === definition.marginOfErrorColumn ? i === 0 ? "-555555555" : "2" : "0").join("|")}`)].join("\n"));
    const tables = ACS_INDICATOR_DICTIONARY.map((definition, i) => ({ definition, id: `run_${i}`, bytes: make(definition) })).map(value => ({ ...value, sha256: createHash("sha256").update(value.bytes).digest("hex") }));
    const stage = (table: typeof tables[number]) => geoids.map((geography, i) => ({ source_natural_key: `${table.definition.id}:5001900US${geography}`, snapshot_id: `snap_acs_v2_acs_2024_5yr_${table.definition.lockId}_${table.sha256.slice(0, 48)}`, geography, variable: table.definition.variableId, survey_period: table.definition.surveyPeriod, estimate: "1", margin_of_error: i === 0 ? null : "2", unit: table.definition.unit, redacted_extras: { schemaVersion: 1, sourceLockSha256: "a".repeat(64), lockId: table.definition.lockId, sourceTable: table.definition.sourceTable, estimateColumn: table.definition.estimateColumn, marginOfErrorColumn: table.definition.marginOfErrorColumn, label: table.definition.label, universe: table.definition.universe, stateFips: geography.slice(0, 2), districtCode: geography.slice(2), estimateMissingReason: null, marginOfErrorMissingReason: i === 0 && table.definition === definition ? "suppressed" : "not_applicable" } }));
    const runs = tables.map(table => ({ id: table.id, release_id: "r2", source_id: "src_acs_2024", snapshot_id: `snap_acs_v2_acs_2024_5yr_${table.definition.lockId}_${table.sha256.slice(0, 48)}`, adapter_version: "acs-direct-table-v2", upstream_release: "acs-2024-5yr", raw_store_kind: "local", raw_store_locator: ".raw", raw_object_key: table.id, raw_object_sha256: table.sha256, raw_object_byte_size: table.bytes.byteLength, raw_object_version_id: null, raw_object_etag: null, lease_token: "lease", status: "validated", extracted_count: 437, staged_count: 437, quarantined_count: 0, source_name: "acs", source_authority: "official", source_homepage_url: "https://www.census.gov/programs-surveys/acs.html", source_url: table.definition.sourceUrl, checksum_sha256: table.sha256, parser_version: "acs-direct-table-v2", published_at: null, retrieved_at: "2025-01-02T00:00:00.000Z", license: "public-domain", usage_status: "approved", source_cutoff: "2025-01-01T00:00:00.000Z" }));
    const fixture = recordingPool((sql) => sql.includes("FROM data_releases r JOIN") ? emptyResult([{ ok: true }]) : sql.includes("SELECT ir.*") ? emptyResult(runs) : sql.includes("FROM stg_acs") ? emptyResult(stage(tables.find(table => table.id === fixture.parameters.at(-1)?.[0])!)) : emptyResult());
    const rawStore = { put: async () => { throw new Error("unexpected write"); }, read: async (receipt: { sha256: string }) => tables.find(table => table.sha256 === receipt.sha256)!.bytes };
    await expect(finalizeCandidateAcs({ ...base, pool: fixture.pool, rawStore, runIds: tables.map(table => table.id) as [string, string, string], sourceLockEntries: tables.map(table => ({ id: table.definition.lockId, url: table.definition.sourceUrl, sha256: table.sha256, byteSize: table.bytes.byteLength })) })).rejects.toThrow("ACS_FINALIZE_STAGE_INVALID");
  });

  it("uses one query-only invariant proof", async () => {
    const fixture = recordingPool((sql) => sql.includes("WITH expected") ? emptyResult([{ valid: true }]) : emptyResult());
    await expect(assertPersistedTask7AcsInvariant(fixture.pool, "r2", "r1")).resolves.toBeUndefined();
    const invariantSql = fixture.calls.find((sql) => sql.includes("WITH expected"));
    expect(invariantSql).toContain("s.authority='official'");
    expect(invariantSql).toContain("ir.id AS run_id");
    expect(invariantSql).toContain("r.run_id IS NULL");
    expect(invariantSql).not.toContain("r.id IS NULL");
    expect(invariantSql).toContain("ss.usage_status='approved'");
    expect(invariantSql).toContain("ir.upstream_release='acs-2024-5yr'");
    expect(invariantSql).toContain("s.homepage_url='https://www.census.gov/programs-surveys/acs.html'");
    expect(invariantSql).toContain("ss.license='public-domain'");
    expect(invariantSql).toContain("SELECT source_url FROM expected");
    expect(invariantSql).toContain("SELECT source_url FROM runs");
    expect(invariantSql).not.toContain("status='loaded') >= 3");
    expect(fixture.parameters.find((values) => values.includes("published"))).toBeDefined();
  });

  it("does not issue placeholder ACS coverage deletes before Task 6 can reject", async () => {
    const fixture = recordingPool((sql) => sql.includes("FROM data_releases r JOIN") ? emptyResult([{ ok: true }]) : emptyResult());
    await expect(finalizeCandidateAcs({ ...base, pool: fixture.pool })).rejects.toThrow("ACS_FINALIZE_RUN_INVALID");
    expect(fixture.calls.some((sql) => sql.startsWith("DELETE FROM coverage_"))).toBe(false);
  });

  it("opens the loaded verifier in repeatable read and performs no writes when replay rejects", async () => {
    const fixture = recordingPool((sql) => sql.includes("FROM data_releases r JOIN") ? emptyResult([{ ok: true }]) : emptyResult());
    await expect(verifyPersistedTask7AcsCandidate({ ...base, pool: fixture.pool })).rejects.toThrow("ACS_FINALIZE_RUN_INVALID");
    expect(fixture.calls[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ");
    expect(fixture.calls[0]).not.toContain("READ ONLY");
    expect(fixture.calls.some((sql) => /INSERT|UPDATE|DELETE|FOR UPDATE/.test(sql))).toBe(false);
    expect(fixture.calls.some((sql) => sql.includes("FOR SHARE"))).toBe(true);
  });
});
