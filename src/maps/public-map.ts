import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { MapArtifactReceipt, MapArtifactStore } from "./map-artifact-store";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA = /^[a-f0-9]{64}$/;
export const MAX_MAP_ARTIFACT_BYTES = 32 * 1024 * 1024;
const denialHeaders = { "Cache-Control": "no-store" };

export interface MapPublicSqlClient { query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>; }
type Row = QueryResultRow & { rawStoreKind: "local" | "s3"; storeIdentity: string; objectKey: string; sha256: string; byteSize: number | string; versionId: string | null; etag: string | null };

/** The web role can read this security-barrier view, never its operational tables. */
export const publicMapStatement = `
  SELECT raw_store_kind AS "rawStoreKind",store_identity AS "storeIdentity",object_key AS "objectKey",sha256,byte_size AS "byteSize",version_id AS "versionId",etag
  FROM public_map_artifacts WHERE release_id=$1 AND geography_id=$2`;

function receipt(row: Row, releaseId: string, geographyId: string): MapArtifactReceipt | null {
  const byteSize = typeof row.byteSize === "number" ? row.byteSize : Number(row.byteSize);
  const expectedKey = `maps/${releaseId}/${geographyId}.geojson`;
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_MAP_ARTIFACT_BYTES || !SHA.test(row.sha256) || row.objectKey !== expectedKey || typeof row.storeIdentity !== "string" || row.storeIdentity.length < 1 || row.storeIdentity.length > 512) return null;
  if (row.rawStoreKind === "local" && row.versionId === null && row.etag === null) return { storeKind: "local", storeIdentity: row.storeIdentity, key: row.objectKey, sha256: row.sha256, byteSize };
  if (row.rawStoreKind === "s3" && typeof row.versionId === "string" && row.versionId.trim() && typeof row.etag === "string" && row.etag.trim()) return { storeKind: "s3", storeIdentity: row.storeIdentity, key: row.objectKey, sha256: row.sha256, byteSize, versionId: row.versionId, etag: row.etag };
  return null;
}

/** Exact, bounded district artifact wire format shared by publication and serving. */
export function isCanonicalDistrictGeoJson(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_MAP_ARTIFACT_BYTES) return false;
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { return false; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const feature = value as { type?: unknown; properties?: unknown; geometry?: { type?: unknown; coordinates?: unknown } };
  const exactKeys = (candidate: object, keys: readonly string[]) => { const actual = Object.keys(candidate).sort(); return actual.length === keys.length && actual.every((key, index) => key === keys[index]); };
  if (!exactKeys(feature, ["geometry", "properties", "type"]) || feature.type !== "Feature" || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties) || !exactKeys(feature.properties, []) || !feature.geometry || typeof feature.geometry !== "object" || !exactKeys(feature.geometry, ["coordinates", "type"]) || feature.geometry.type !== "MultiPolygon" || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length === 0) return false;
  const position = (candidate: unknown): candidate is readonly [number, number] => Array.isArray(candidate) && candidate.length === 2 && typeof candidate[0] === "number" && Number.isFinite(candidate[0]) && candidate[0] >= -180 && candidate[0] <= 180 && typeof candidate[1] === "number" && Number.isFinite(candidate[1]) && candidate[1] >= -90 && candidate[1] <= 90;
  for (const polygon of feature.geometry.coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every(position)) return false;
      const first = ring[0]!, last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) return false;
    }
  }
  return Buffer.from(JSON.stringify(value) + "\n").equals(Buffer.from(bytes));
}

export function mapNotFound(): Response { return new Response(null, { status: 404, headers: denialHeaders }); }

/** Serves only a persisted, fully linked immutable map artifact; all failures are intentionally indistinguishable. */
export async function servePublicMap(client: MapPublicSqlClient, store: MapArtifactStore, releaseId: string, geographyId: string): Promise<Response> {
  if (!ID.test(releaseId) || !ID.test(geographyId)) return mapNotFound();
  try {
    const result = await client.query<Row>(publicMapStatement, [releaseId, geographyId]);
    if (result.rows.length !== 1) return mapNotFound();
    const persistedReceipt = receipt(result.rows[0]!, releaseId, geographyId);
    if (!persistedReceipt) return mapNotFound();
    const bytes = await store.read(persistedReceipt);
    if (bytes.byteLength !== persistedReceipt.byteSize || createHash("sha256").update(bytes).digest("hex") !== persistedReceipt.sha256 || !isCanonicalDistrictGeoJson(bytes)) return mapNotFound();
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/geo+json", "X-Content-Type-Options": "nosniff", ETag: `"${persistedReceipt.sha256}"`, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return mapNotFound(); }
}
