import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isCanonicalDistrictGeoJson, publicMapStatement, servePublicMap, type MapPublicSqlClient } from "./public-map";
import type { MapArtifactReceipt, MapArtifactStore } from "./map-artifact-store";

const bytes = Buffer.from('{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,1],[0,0]]]]}}\n');
const sha256 = createHash("sha256").update(bytes).digest("hex");
const row = { rawStoreKind: "local" as const, storeIdentity: "/configured/maps", objectKey: "maps/rel_1/geo_1.geojson", sha256, byteSize: bytes.length, versionId: null, etag: null };

function dependencies(rows = [row], read = async (_receipt: MapArtifactReceipt) => { void _receipt; return bytes; }) {
  const calls: unknown[][] = [];
  const client: MapPublicSqlClient = { query: async <T extends import("pg").QueryResultRow>(_text: string, values?: readonly unknown[]) => { void _text; calls.push([...(values ?? [])]); return { rows: rows as unknown as T[] }; } };
  const store: MapArtifactStore = { put: async () => { throw new Error("writes are forbidden"); }, read };
  return { client, store, calls };
}

describe("public map artifacts", () => {
  it("queries only the narrow publication-owned serving view", () => {
    expect(publicMapStatement).toContain("FROM public_map_artifacts");
    expect(publicMapStatement).not.toContain("map_artifact_receipts");
    expect(publicMapStatement).not.toContain("data_releases");
  });
  it("serves persisted published and previously-published retired bytes with stable immutable headers", async () => {
    for (const releaseId of ["rel_1", "rel_retired"]) {
      const d = dependencies([releaseId === "rel_1" ? row : { ...row, objectKey: `maps/${releaseId}/geo_1.geojson` }]);
      const response = await servePublicMap(d.client, d.store, releaseId, "geo_1");
      expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      expect(response.headers.get("etag")).toBe(`"${sha256}"`); expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable"); expect(response.headers.get("content-type")).toBe("application/geo+json"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
  it("makes malformed and encoded traversal requests indistinguishable without querying", async () => {
    for (const id of ["", "../geo", "%2e%2e%2fgeo", "geo/1", "a".repeat(129)]) {
      const d = dependencies(); const response = await servePublicMap(d.client, d.store, "rel_1", id);
      expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store"); expect(d.calls).toEqual([]);
    }
  });
  it("returns uniform no-store denials for missing, duplicate, tampered, and store failures", async () => {
    const cases = [
      dependencies([]), dependencies([{ ...row, sha256: "0".repeat(64) }]), dependencies([{ ...row, byteSize: bytes.length + 1 }]), dependencies([{ ...row, objectKey: "maps/rel_1/other.geojson" }]), dependencies([row, row]), dependencies([row], async () => { throw new Error("store unavailable"); }), dependencies([row], async () => Buffer.from("{}\n")),
    ];
    for (const d of cases) { const response = await servePublicMap(d.client, d.store, "rel_1", "geo_1"); expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store"); }
  });
  it("rejects noncanonical geometry nesting, positions, rings, bounds, and extra fields", async () => {
    const invalid = [
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,1]]]]}}\n',
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0,1],[0,1],[1,1],[0,0]]]]}}\n',
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[181,1],[0,0]]]]}}\n',
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,1],[1,0]]]]}}\n',
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[0,0],[0,1],[1,1],[0,0]]]}}\n',
      '{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,1],[0,0]]]]},"extra":true}\n',
    ];
    for (const text of invalid) {
      const value = Buffer.from(text); const digest = createHash("sha256").update(value).digest("hex");
      const d = dependencies([{ ...row, sha256: digest, byteSize: value.length }], async () => value);
      expect((await servePublicMap(d.client, d.store, "rel_1", "geo_1")).status).toBe(404);
    }
  });
  it("exports the same strict canonical district validator used by serving", () => {
    expect(isCanonicalDistrictGeoJson(bytes)).toBe(true);
    for (const value of [Buffer.from('{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[]} }\n'), Buffer.from('{"type":"Feature","properties":{"district":"x"},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,1],[0,0]]]]}}\n'), Buffer.from('{"type":"Feature","properties":{},"geometry":{"type":"MultiPolygon","coordinates":[[[[0,0],[0,1],[1,null],[0,0]]]]}}\n')]) expect(isCanonicalDistrictGeoJson(value)).toBe(false);
  });
  it("does not expose candidate, never-published retired, or unknown releases", async () => {
    for (const releaseId of ["candidate", "retired_never_published", "unknown"]) { const d = dependencies([]); const response = await servePublicMap(d.client, d.store, releaseId, "geo_1"); expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store"); }
  });
});
