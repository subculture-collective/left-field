import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { assertElectionPublicationReadiness, rollbackPublishedRelease, verifyPublishedMapObjectsWithClient } from "./releases";

const client = (row: Record<string, string | number>) => ({
  query: vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }),
});

describe("election publication readiness", () => {
  it("preserves publication compatibility for legacy all-unassessed releases", async () => {
    const connection = client({ reviewed_any: "0", unassessed_any: "158", reviewed: "0", unassessed: "102", alaska_approved: "0", approved_without_results: "0" });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_legacy")).resolves.toBe(false);
  });

  it("rejects a partially reviewed cohort", async () => {
    const connection = client({ reviewed_any: "1", unassessed_any: "157", reviewed: "1", unassessed: "101", alaska_approved: "1", approved_without_results: "0" });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_partial")).rejects.toThrow("failed election publication readiness");
  });

  it("rejects a reviewed 2022 decision when the complete cohort remains unreviewed", async () => {
    const connection = client({ reviewed_any: 1, unassessed_any: 157, reviewed: 0, unassessed: 102, alaska_approved: 0, approved_without_results: 0 });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_2022_partial")).rejects.toThrow("failed election publication readiness");
  });

  it("rejects reviewed closure without both Alaska cycles and approved-result closure", async () => {
    for (const row of [
      { reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 1, approved_without_results: 0 },
      { reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 2, approved_without_results: 1 },
    ]) {
      await expect(assertElectionPublicationReadiness(client(row) as never, "rel_incomplete")).rejects.toThrow("failed election publication readiness");
    }
  });

  it("accepts the fully reviewed cohort with approved-result closure", async () => {
    const connection = client({ reviewed_any: 158, unassessed_any: 0, reviewed: 102, unassessed: 0, alaska_approved: 2, approved_without_results: 0 });
    await expect(assertElectionPublicationReadiness(connection as never, "rel_r3")).resolves.toBe(true);
  });
});

describe("map publication preflight", () => {
  const bytes = Buffer.from('{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[1,0],[1,1],[0,0]]]]}}\n'); const sha256 = createHash("sha256").update(bytes).digest("hex");
  const rows = Array.from({ length: 441 }, (_, index) => ({ geography_id: `geo_${index}`, raw_store_kind: "local" as const, store_identity: "configured", object_key: `maps/rel_maps/geo_${index}.geojson`, sha256, byte_size: bytes.length, version_id: null, etag: null }));
  const database = { query: vi.fn().mockResolvedValue({ rows }) };
  it("rejects deleted and replaced objects before a map-bearing transition", async () => {
    const deleted = { put: async () => { throw new Error("unused"); }, read: async () => { throw new Error("deleted"); } };
    const replaced = { put: async () => { throw new Error("unused"); }, read: async () => Buffer.from("wrong") };
    await expect(verifyPublishedMapObjectsWithClient(database as never, deleted, "rel_maps")).rejects.toThrow("deleted");
    await expect(verifyPublishedMapObjectsWithClient(database as never, replaced, "rel_maps")).rejects.toThrow("verification failed");
  });
  it("accepts only the complete exact receipt set", async () => {
    const store = { put: async () => { throw new Error("unused"); }, read: async () => bytes };
    await expect(verifyPublishedMapObjectsWithClient(database as never, store, "rel_maps")).resolves.toBeUndefined();
    await expect(verifyPublishedMapObjectsWithClient({ query: vi.fn().mockResolvedValue({ rows: rows.slice(1) }) } as never, store, "rel_maps")).rejects.toThrow("incomplete");
  });
  it("rejects non-GeoJSON bytes even when their receipt hash and size match", async () => {
    const invalid = Buffer.from("not geojson");
    const invalidSha = createHash("sha256").update(invalid).digest("hex");
    const invalidRows = rows.map((row) => ({ ...row, sha256: invalidSha, byte_size: invalid.length }));
    const store = { put: async () => { throw new Error("unused"); }, read: async () => invalid };
    await expect(verifyPublishedMapObjectsWithClient({ query: vi.fn().mockResolvedValue({ rows: invalidRows }) } as never, store, "rel_maps")).rejects.toThrow("verification failed");
  });
});

describe("rollback lifecycle pools", () => {
  const pool = (queries: string[], failure?: Error) => {
    const validation = {
      query: vi.fn(async (sql: string) => {
        queries.push(`validation:${sql}`);
        if (sql.includes("WHERE status = 'published'")) return { rows: [{ id: "current", previous_release_id: "previous" }], rowCount: 1 };
        if (sql.includes("WHERE id = $1 AND status = 'retired'")) return { rows: [{ id: "previous" }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }), release: vi.fn(),
    };
    const operator = { query: vi.fn(async (sql: string) => { queries.push(`operator:${sql}`); if (failure) throw failure; return { rows: [], rowCount: 1 }; }), release: vi.fn() };
    return { validation, operator, validationPool: { connect: vi.fn().mockResolvedValue(validation) }, operatorPool: { connect: vi.fn().mockResolvedValue(operator) } };
  };

  it("commits SELECT-only validation before the separate operator consumes rollback", async () => {
    const queries: string[] = []; const fixture = pool(queries);
    await expect(rollbackPublishedRelease(fixture.validationPool as never, 1, { preflightPool: fixture.validationPool as never, operatorPool: fixture.operatorPool as never })).resolves.toEqual({ publishedReleaseId: "previous", retiredReleaseId: "current" });
    expect(queries.findIndex(sql => sql === "validation:COMMIT")).toBeLessThan(queries.findIndex(sql => sql.startsWith("operator:SELECT public.lifecycle_rollback")));
    expect(queries.filter(sql => sql.startsWith("validation:")).some(sql => /FOR UPDATE|FOR SHARE/.test(sql))).toBe(false);
  });

  it("releases the validation connection and surfaces an operator failure", async () => {
    const queries: string[] = []; const fixture = pool(queries, new Error("operator denied"));
    await expect(rollbackPublishedRelease(fixture.validationPool as never, 1, { preflightPool: fixture.validationPool as never, operatorPool: fixture.operatorPool as never })).rejects.toThrow("operator denied");
    expect(fixture.validation.release).toHaveBeenCalledOnce();
    expect(fixture.operator.release).toHaveBeenCalledOnce();
  });

  it("also commits before consuming on the legacy single pool", async () => {
    const queries: string[] = []; const fixture = pool(queries);
    fixture.validationPool.connect.mockResolvedValueOnce(fixture.validation).mockResolvedValueOnce(fixture.operator);
    await expect(rollbackPublishedRelease(fixture.validationPool as never, 1)).resolves.toEqual({ publishedReleaseId: "previous", retiredReleaseId: "current" });
    expect(queries.findIndex(sql => sql === "validation:COMMIT")).toBeLessThan(queries.findIndex(sql => sql.startsWith("operator:SELECT public.lifecycle_rollback")));
  });
});
