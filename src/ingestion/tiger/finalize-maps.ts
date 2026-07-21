/** Atomic publication of the already simplified, whole CD119 TIGER layer. */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { computeReleaseDigest, contentDomains, expectedContentChecksum, recheckNationwideValidationGateShared, validateNationwideCandidateReleaseWithClient } from "@/db/catalog-release";
import { canonicalCoverageScopeKey, loadNationwideManifest, loadNationwideManifestForFinalization } from "@/db/manifest";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";
import type { MapArtifactReceipt, MapArtifactStore } from "@/maps/map-artifact-store";
import { isCanonicalDistrictGeoJson } from "@/maps/public-map";
import { simplifyNationalTigerDistrictLayer, TIGER_SIMPLIFY_MAX_INPUT_BYTES, TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES, TIGER_SIMPLIFY_MAX_VERTICES, type SimplifiedTigerLayer } from "./simplify";

export interface FinalizeMapsInput { readonly pool: Pool; readonly store: MapArtifactStore; readonly candidateReleaseId: string; readonly sourceReleaseId: string; readonly layer: SimplifiedTigerLayer; }
type Geography = { id: string; source_geoid: string; geometry_artifact_id: string; original_snapshot_id: string; original_checksum: string; original_retrieved_at: Date; original_published_at: Date | null; authority: string; license: string; usage_status: string };
const fail = (code: string): never => { throw new Error(code); };
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const id = (prefix: string, value: string) => `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
/** Constant-time where lengths agree; never serialize binary data as JSON. */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => a.byteLength === b.byteLength && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const compareBytewise = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const MAP_SCOPE_KEY = canonicalCoverageScopeKey({ kind: "release" });
type CanonicalFeature = { type: "Feature"; properties: Record<string, never>; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } };
function strictFeature(bytes: Uint8Array): CanonicalFeature {
  let value: unknown; try { value = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { return fail("MAP_FINALIZE_FEATURE_INVALID"); }
  if (!value || typeof value !== "object") return fail("MAP_FINALIZE_FEATURE_INVALID");
  const feature = value as CanonicalFeature;
  if (!isCanonicalDistrictGeoJson(bytes)) fail("MAP_FINALIZE_FEATURE_INVALID");
  return feature;
}

function assertInput(input: FinalizeMapsInput): void {
  const districts = input.layer.districts;
  const joined = Buffer.concat(districts.flatMap(({ geoid, bytes }) => [Buffer.from(`${geoid}\n`), Buffer.from(bytes)]));
  const m = input.layer.metrics;
  if (!ArrayBuffer.isView(input.layer.sourceBytes) || input.layer.sourceBytes.BYTES_PER_ELEMENT !== 1 || input.layer.sourceBytes.byteLength < 1 || input.layer.sourceBytes.byteLength > TIGER_SIMPLIFY_MAX_INPUT_BYTES || !/^[A-Za-z0-9_-]{1,128}$/.test(input.candidateReleaseId) || !/^[A-Za-z0-9_-]{1,128}$/.test(input.sourceReleaseId) || input.candidateReleaseId === input.sourceReleaseId || m.featureCount !== 441 || districts.length !== 441 || new Set(districts.map((d) => d.geoid)).size !== 441 || !/^[a-f0-9]{64}$/.test(m.sourceSha256) || sha(input.layer.sourceBytes) !== m.sourceSha256 || m.outputSha256 !== sha(joined) || !Number.isSafeInteger(m.sourceVertices) || !Number.isSafeInteger(m.outputVertices) || m.sourceVertices <= 0 || m.sourceVertices > TIGER_SIMPLIFY_MAX_VERTICES || m.outputVertices <= 0 || m.outputVertices >= m.sourceVertices || m.vertexReduction !== m.sourceVertices - m.outputVertices || m.vertexReduction <= 0 || !Number.isFinite(m.maxSymmetricVertexBoundaryMetres) || m.maxSymmetricVertexBoundaryMetres < 0 || m.maxSymmetricVertexBoundaryMetres > TIGER_SIMPLIFY_MAX_SYMMETRIC_ERROR_METRES || !Number.isSafeInteger(m.adjacencyPairCount) || m.adjacencyPairCount < 0 || districts.some((d, index) => !/^\d{4}$/.test(d.geoid) || (index > 0 && compareBytewise(districts[index - 1]!.geoid, d.geoid) >= 0) || d.bytes.byteLength < 1 || d.bytes.byteLength > TIGER_SIMPLIFY_MAX_INPUT_BYTES)) fail("MAP_FINALIZE_INPUT_INVALID");
  districts.forEach((district) => strictFeature(district.bytes));
}
async function assertReplay(input: FinalizeMapsInput): Promise<void> {
  const replay = await simplifyNationalTigerDistrictLayer(input.layer.sourceBytes, { expectedSourceSha256: input.layer.metrics.sourceSha256 });
  const supplied = input.layer;
  if (JSON.stringify(replay.metrics) !== JSON.stringify(supplied.metrics) || replay.districts.length !== supplied.districts.length || replay.districts.some((district, index) => district.geoid !== supplied.districts[index]?.geoid || !equalBytes(district.bytes, supplied.districts[index]!.bytes))) fail("MAP_FINALIZE_REPLAY_MISMATCH");
}
async function lockLineage(client: PoolClient, input: FinalizeMapsInput, statuses: readonly string[]): Promise<void> {
  // The caller holds both sorted release advisory locks.  Do not add a row lock
  // here: ingest deliberately has no UPDATE privilege on data_releases.
  const rows = await client.query<{ id: string }>(`SELECT r.id FROM data_releases r JOIN data_releases p ON p.id=r.previous_release_id JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1 AND r.previous_release_id=$2 AND r.status=ANY($3) AND p.status IN ('published','retired') AND r.source_cutoff=p.source_cutoff AND m.schema_version=2`, [input.candidateReleaseId, input.sourceReleaseId, statuses]);
  if (rows.rowCount !== 1) fail("MAP_FINALIZE_LINEAGE_INVALID");
}
async function geographies(client: PoolClient, releaseId: string, lock: "FOR UPDATE" | "FOR SHARE" | ""): Promise<Geography[]> {
  const result = await client.query<Geography>(`SELECT g.id,g.source_geoid,g.geometry_artifact_id,a.snapshot_id original_snapshot_id,a.checksum_sha256 original_checksum,os.retrieved_at original_retrieved_at,os.published_at original_published_at,s.authority,os.license,os.usage_status FROM geography_versions g JOIN geometry_artifacts a ON a.release_id=g.release_id AND a.id=g.geometry_artifact_id JOIN source_snapshots os ON os.release_id=a.release_id AND os.id=a.snapshot_id JOIN sources s ON s.release_id=os.release_id AND s.id=os.source_id JOIN district_plans p ON p.release_id=g.release_id AND p.id=g.district_plan_id JOIN seat_cycles sc ON sc.release_id=g.release_id AND sc.geography_version_id=g.id JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id JOIN data_releases r ON r.id=g.release_id WHERE g.release_id=$1 AND g.kind='house_district' AND p.effective_from <= (r.source_cutoff AT TIME ZONE 'UTC')::date AND (p.effective_to IS NULL OR (r.source_cutoff AT TIME ZONE 'UTC')::date < p.effective_to) AND ot.starts_at <= (r.source_cutoff AT TIME ZONE 'UTC')::date AND (ot.ends_at IS NULL OR (r.source_cutoff AT TIME ZONE 'UTC')::date < ot.ends_at) ${lock}`, [releaseId]);
  if (result.rowCount !== 441 || new Set(result.rows.map((row) => row.source_geoid)).size !== 441 || result.rows.some((row) => !/^\d{4}$/.test(row.source_geoid))) fail("MAP_FINALIZE_GEOGRAPHY_CLOSURE_INVALID");
  return result.rows.sort((a, b) => compareBytewise(a.source_geoid, b.source_geoid));
}
export function assertMapOnlyInheritance(source: Record<string, unknown>, candidate: Record<string, unknown>, sourceReleaseId: string, candidateReleaseId: string, sourceId: string): void {
  const normalize = (manifest: Record<string, unknown>, releaseId: string): Record<string, unknown> => {
    const value = structuredClone(manifest) as Record<string, unknown>;
    const entries = (name: string) => Array.isArray(value[name]) ? value[name] as Array<Record<string, unknown>> : fail("MAP_FINALIZE_BASELINE_INVALID");
    value.sources = entries("sources").filter(row => row.id !== sourceId);
    value.snapshots = entries("snapshots").filter(row => typeof row.id !== "string" || !row.id.startsWith("snap_map_"));
    value.geometryArtifacts = entries("geometryArtifacts").filter(row => typeof row.id !== "string" || !row.id.startsWith("artifact_map_"));
    value.mapArtifacts = [];
    value.snapshotDerivations = entries("snapshotDerivations").filter(row => typeof row.outputSnapshotId !== "string" || !row.outputSnapshotId.startsWith("snap_map_"));
    value.coverageRecords = entries("coverageRecords").filter(row => row.domain !== "maps");
    delete value.release; delete value.canonicalDataChecksumSha256;
    const rewrite = (item: unknown): void => { if (Array.isArray(item)) item.forEach(rewrite); else if (item && typeof item === "object") { const row = item as Record<string, unknown>; if (row.releaseId === releaseId) row.releaseId = sourceReleaseId; Object.values(row).forEach(rewrite); } };
    rewrite(value);
    for (const entry of Object.values(value)) if (Array.isArray(entry)) entry.sort((a, b) => compareBytewise(JSON.stringify(a), JSON.stringify(b)));
    return value;
  };
  const left = normalize(source, sourceReleaseId); const right = normalize(candidate, candidateReleaseId);
  const differing = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
  if (differing.length) fail(`MAP_FINALIZE_INHERITANCE_INVALID:${differing.join(",")}`);
}
function receiptRow(receipt: MapArtifactReceipt): readonly unknown[] { return [receipt.storeKind, receipt.storeIdentity, receipt.key, receipt.sha256, receipt.byteSize, receipt.versionId ?? null, receipt.etag ?? null]; }
async function assertMaplessBaseline(client: PoolClient, input: FinalizeMapsInput): Promise<void> {
  const absent = await client.query("SELECT EXISTS(SELECT 1 FROM map_artifacts WHERE release_id=$1) maps, EXISTS(SELECT 1 FROM map_artifact_receipts WHERE release_id=$1) receipts", [input.sourceReleaseId]);
  if (absent.rows[0]?.maps || absent.rows[0]?.receipts) fail("MAP_FINALIZE_SOURCE_NOT_MAPLESS");
  const source = await loadNationwideManifest(client, input.sourceReleaseId);
  const candidate = await loadNationwideManifest(client, input.candidateReleaseId);
  if (source.mapArtifacts.length || candidate.mapArtifacts.length || !validateReleaseManifest(source).success || !validateReleaseManifest(candidate).success) fail("MAP_FINALIZE_BASELINE_INVALID");
  for (const domain of Object.keys(contentDomains) as Array<keyof typeof contentDomains>) {
    const left = await computeReleaseDigest(client, input.sourceReleaseId, domain);
    const right = await computeReleaseDigest(client, input.candidateReleaseId, domain);
    const stored = await client.query<{ release_id: string; row_count: number; sha256: string }>("SELECT release_id,row_count,sha256 FROM release_content_digests WHERE release_id=ANY($1) AND domain=$2", [[input.sourceReleaseId, input.candidateReleaseId], domain]);
    if (left.rowCount !== right.rowCount || left.sha256 !== right.sha256 || stored.rowCount !== 2 || stored.rows.some((r) => Number(r.row_count) !== left.rowCount || r.sha256 !== left.sha256)) fail("MAP_FINALIZE_BASELINE_DIGEST_INVALID");
  }
  await recheckNationwideValidationGateShared(client, input.sourceReleaseId);
  // Generic baselining deliberately clears the destination gate.  Exact digest
  // equality above proves this is still the source release before this
  // finalizer recreates the mapless candidate gate, prior to object writes.
  await validateNationwideCandidateReleaseWithClient(client, input.candidateReleaseId);
  await recheckNationwideValidationGateShared(client, input.candidateReleaseId);
}

/** The object store is immutable: an object written before a rolled-back DB transaction is an orphan, never reusable evidence. */
async function assertExactPersistedMaps(client: PoolClient, input: FinalizeMapsInput): Promise<void> {
  // No row lock here: the verifier runs in a READ ONLY transaction, and the
  // caller's sorted advisory locks provide the required stable lineage.
  const expected = await geographies(client, input.candidateReleaseId, "");
  const source = await geographies(client, input.sourceReleaseId, "");
  const layer = new Map(input.layer.districts.map((d) => [d.geoid, d.bytes]));
  if (source.length !== expected.length || expected.some((g, i) => g.source_geoid !== source[i]?.source_geoid || g.geometry_artifact_id !== source[i]?.geometry_artifact_id) || new Set(expected.map(g => g.geometry_artifact_id)).size !== 1 || new Set(expected.map(g => g.original_snapshot_id)).size !== 1 || expected.some(g => g.original_checksum !== input.layer.metrics.sourceSha256 || g.authority !== "derived" || g.license !== "public-domain" || g.usage_status !== "approved")) fail("MAP_FINALIZE_SOURCE_IDENTITY_INVALID");
  const sourceId = id("src_maps", input.layer.metrics.sourceSha256);
  const loadExactManifest = async (releaseId: string): Promise<Awaited<ReturnType<typeof loadNationwideManifest>>> => {
    try { return await loadNationwideManifest(client, releaseId); } catch { return fail("MAP_FINALIZE_PERSISTED_INVARIANT"); }
  };
  const sourceManifest = await loadExactManifest(input.sourceReleaseId);
  const candidateManifest = await loadExactManifest(input.candidateReleaseId);
  if (sourceManifest.mapArtifacts.length || !validateReleaseManifest(sourceManifest).success || !validateReleaseManifest(candidateManifest).success) fail("MAP_FINALIZE_INHERITANCE_INVALID");
  assertMapOnlyInheritance(sourceManifest as unknown as Record<string, unknown>, candidateManifest as unknown as Record<string, unknown>, input.sourceReleaseId, input.candidateReleaseId, sourceId);
  const expectedRows = expected.map((geography) => {
    const bytes = layer.get(geography.source_geoid)!; const checksum = sha(bytes); const snapshotId = id("snap_map", `${geography.id}:${checksum}`); const artifactId = id("artifact_map", `${geography.id}:${checksum}`); const mapId = id("map", geography.id);
    return { geography, bytes, checksum, snapshotId, artifactId, mapId };
  });
  const exact = (actual: readonly Record<string, unknown>[], wanted: readonly Record<string, unknown>[]): void => {
    const canonical = (row: Record<string, unknown>) => JSON.stringify(Object.keys(row).sort(compareBytewise).map((key) => [key, row[key] instanceof Date ? (row[key] as Date).toISOString() : row[key]]));
    const left = actual.map(canonical).sort(compareBytewise); const right = wanted.map(canonical).sort(compareBytewise);
    if (left.length !== right.length || left.some((value, index) => value !== right[index])) fail("MAP_FINALIZE_PERSISTED_INVARIANT");
  };
  const sourceRows = await client.query<Record<string, unknown>>("SELECT id,name,authority,homepage_url FROM sources WHERE release_id=$1 AND (id=$2 OR name='tiger-cd119-simplified')", [input.candidateReleaseId, sourceId]);
  exact(sourceRows.rows, [{ id: sourceId, name: "tiger-cd119-simplified", authority: "derived", homepage_url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" }]);
  const snapshots = await client.query<Record<string, unknown>>("SELECT id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status FROM source_snapshots WHERE release_id=$1 AND (source_id=$2 OR id LIKE 'snap_map_%')", [input.candidateReleaseId, sourceId]);
  exact(snapshots.rows, expectedRows.map(({ geography, checksum, snapshotId }) => ({ id: snapshotId, source_id: sourceId, source_url: `https://maps.dsa-seats.org/tiger/cd119/${input.layer.metrics.sourceSha256}/${geography.source_geoid}.geojson`, published_at: geography.original_published_at, retrieved_at: geography.original_retrieved_at, checksum_sha256: checksum, parser_version: "tiger-mapshaper-0.6.113-dp25m", license: "public-domain", usage_status: "approved" })));
  const artifacts = await client.query<Record<string, unknown>>("SELECT id,snapshot_id,object_key,format,srid,checksum_sha256 FROM geometry_artifacts WHERE release_id=$1 AND (snapshot_id=ANY($2) OR object_key LIKE 'maps/' || $1 || '/%')", [input.candidateReleaseId, expectedRows.map(({ snapshotId }) => snapshotId)]);
  exact(artifacts.rows, expectedRows.map(({ checksum, snapshotId, artifactId, geography }) => ({ id: artifactId, snapshot_id: snapshotId, object_key: `maps/${input.candidateReleaseId}/${geography.id}.geojson`, format: "geojson", srid: 4326, checksum_sha256: checksum })));
  const maps = await client.query<Record<string, unknown>>("SELECT id,geography_version_id,artifact_id FROM map_artifacts WHERE release_id=$1", [input.candidateReleaseId]);
  exact(maps.rows, expectedRows.map(({ geography, artifactId, mapId }) => ({ id: mapId, geography_version_id: geography.id, artifact_id: artifactId })));
  const mapInputs = await client.query<Record<string, unknown>>("SELECT map_artifact_id,snapshot_id FROM map_artifact_inputs WHERE release_id=$1", [input.candidateReleaseId]);
  exact(mapInputs.rows, expectedRows.map(({ mapId, snapshotId }) => ({ map_artifact_id: mapId, snapshot_id: snapshotId })));
  const derivations = await client.query<Record<string, unknown>>("SELECT output_snapshot_id,methodology_version FROM snapshot_derivations WHERE release_id=$1 AND (methodology_version='tiger-mapshaper-0.6.113-dp25m' OR output_snapshot_id LIKE 'snap_map_%')", [input.candidateReleaseId]);
  exact(derivations.rows, expectedRows.map(({ snapshotId }) => ({ output_snapshot_id: snapshotId, methodology_version: "tiger-mapshaper-0.6.113-dp25m" })));
  const derivationInputs = await client.query<Record<string, unknown>>("SELECT output_snapshot_id,input_snapshot_id FROM snapshot_derivation_inputs WHERE release_id=$1 AND output_snapshot_id LIKE 'snap_map_%'", [input.candidateReleaseId]);
  exact(derivationInputs.rows, expectedRows.map(({ geography, snapshotId }) => ({ output_snapshot_id: snapshotId, input_snapshot_id: geography.original_snapshot_id })));
  const rows = await client.query<{ map_artifact_id: string; geography_version_id: string; raw_store_kind: "local" | "s3"; store_identity: string; object_key: string; sha256: string; byte_size: number; version_id: string | null; etag: string | null }>("SELECT mr.map_artifact_id,ma.geography_version_id,mr.raw_store_kind,mr.store_identity,mr.object_key,mr.sha256,mr.byte_size,mr.version_id,mr.etag FROM map_artifact_receipts mr JOIN map_artifacts ma ON ma.release_id=mr.release_id AND ma.id=mr.map_artifact_id WHERE mr.release_id=$1", [input.candidateReleaseId]);
  if (rows.rowCount !== 441 || new Set(rows.rows.map(r => r.map_artifact_id)).size !== 441 || new Set(rows.rows.map(r => r.geography_version_id)).size !== 441) fail("MAP_FINALIZE_PERSISTED_INVARIANT");
  for (const row of rows.rows) {
    const geography = expected.find(g => g.id === row.geography_version_id); const bytes = geography && layer.get(geography.source_geoid);
    const receipt = { storeKind: row.raw_store_kind, storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize: Number(row.byte_size), ...(row.version_id === null ? {} : { versionId: row.version_id }), ...(row.etag === null ? {} : { etag: row.etag }) } as MapArtifactReceipt;
    if (!bytes || receipt.key !== `maps/${input.candidateReleaseId}/${geography.id}.geojson` || receipt.sha256 !== sha(bytes) || receipt.byteSize !== bytes.byteLength || !equalBytes(await input.store.read(receipt), bytes)) fail("MAP_FINALIZE_PERSISTED_INVARIANT");
  }
  const coverage = await client.query<Record<string, unknown>>("SELECT scope_key,scope_kind,jurisdiction_code,seat_cycle_id,variable,survey_period,election_year,funding_kind,status,expected_count,observed_count,quarantined_count,incompatible_count FROM coverage_records WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]);
  exact(coverage.rows, [{ scope_key: MAP_SCOPE_KEY, scope_kind: "release", jurisdiction_code: null, seat_cycle_id: null, variable: null, survey_period: null, election_year: null, funding_kind: null, status: "complete", expected_count: 441, observed_count: 441, quarantined_count: 0, incompatible_count: 0 }]);
  const missing = await client.query<Record<string, unknown>>("SELECT scope_key,reason,count FROM coverage_missing_reasons WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]);
  exact(missing.rows, []);
  const coverageInputs = await client.query<Record<string, unknown>>("SELECT scope_key,snapshot_id FROM coverage_input_snapshots WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]);
  exact(coverageInputs.rows, expectedRows.map(({ snapshotId }) => ({ scope_key: MAP_SCOPE_KEY, snapshot_id: snapshotId })));
}

/** Writes immutable objects before their DB references, then commits all DB edges as one transaction. */
export async function finalizeCandidateMaps(input: FinalizeMapsInput): Promise<void> {
  assertInput(input); await assertReplay(input); const client = await input.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN"); begun = true;
    for (const releaseId of [input.candidateReleaseId, input.sourceReleaseId].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [releaseId]);
    await lockLineage(client, input, ["candidate"]);
    // Lost-response retries must not insert a second source or alter the
    // already digest-bound candidate.  Receipt reads remain mandatory.
    const existing = await client.query<{ raw_store_kind: "local" | "s3"; store_identity: string; object_key: string; sha256: string; byte_size: number; version_id: string | null; etag: string | null }>("SELECT mr.raw_store_kind,mr.store_identity,mr.object_key,mr.sha256,mr.byte_size,mr.version_id,mr.etag FROM map_artifact_receipts mr WHERE mr.release_id=$1", [input.candidateReleaseId]);
    if ((existing.rowCount ?? 0) > 0) {
      if (existing.rowCount !== 441) fail("MAP_FINALIZE_PERSISTED_INVARIANT");
      const expectedBytes = new Map(input.layer.districts.map((district) => [district.geoid, district.bytes]));
      const expectedRows = await geographies(client, input.candidateReleaseId, "");
      for (const row of existing.rows) { const geography = expectedRows.find((item) => `maps/${input.candidateReleaseId}/${item.id}.geojson` === row.object_key); const value = geography && expectedBytes.get(geography.source_geoid); if (!value || row.sha256 !== sha(value) || Number(row.byte_size) !== value.byteLength || !equalBytes(await input.store.read({ storeKind: row.raw_store_kind, storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize: Number(row.byte_size), ...(row.version_id === null ? {} : { versionId: row.version_id }), ...(row.etag === null ? {} : { etag: row.etag }) } as MapArtifactReceipt), value)) fail("MAP_FINALIZE_PERSISTED_INVARIANT"); }
      await assertExactPersistedMaps(client, input); await recheckNationwideValidationGateShared(client, input.candidateReleaseId); await client.query("COMMIT"); begun = false; return;
    }
    await assertMaplessBaseline(client, input);
    const expected = await geographies(client, input.candidateReleaseId, "");
    const originals = await geographies(client, input.sourceReleaseId, "");
    if (expected.some((g, i) => g.geometry_artifact_id !== originals[i]?.geometry_artifact_id || g.original_checksum !== input.layer.metrics.sourceSha256 || g.authority !== "derived" || g.license !== "public-domain" || g.usage_status !== "approved") || new Set(expected.map(g => g.geometry_artifact_id)).size !== 1 || new Set(expected.map(g => g.original_snapshot_id)).size !== 1) fail("MAP_FINALIZE_SOURCE_IDENTITY_INVALID");
    const bytes = new Map(input.layer.districts.map((item) => [item.geoid, item.bytes]));
    if (expected.some((item) => !bytes.has(item.source_geoid))) fail("MAP_FINALIZE_GEOID_CLOSURE_INVALID");
    const receipts = new Map<string, MapArtifactReceipt>();
    for (const geography of expected) { const value = bytes.get(geography.source_geoid)!; const receipt = await input.store.put({ releaseId: input.candidateReleaseId, geographyId: geography.id, bytes: value }); if (receipt.key !== `maps/${input.candidateReleaseId}/${geography.id}.geojson` || receipt.sha256 !== sha(value) || receipt.byteSize !== value.byteLength || !equalBytes(await input.store.read(receipt), value)) fail("MAP_FINALIZE_RECEIPT_INVALID"); receipts.set(geography.id, receipt); }
    const sourceId = id("src_maps", input.layer.metrics.sourceSha256);
    await client.query("INSERT INTO sources(release_id,id,name,authority,homepage_url) VALUES($1,$2,'tiger-cd119-simplified','derived','https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html')", [input.candidateReleaseId, sourceId]);
    for (const geography of expected) {
      const value = bytes.get(geography.source_geoid)!; const feature = strictFeature(value); const checksum = sha(value); const snapshotId = id("snap_map", `${geography.id}:${checksum}`); const artifactId = id("artifact_map", `${geography.id}:${checksum}`); const mapId = id("map", geography.id); const receipt = receipts.get(geography.id)!;
      await client.query("INSERT INTO source_snapshots(release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES($1,$2,$3,$4,$5,$6,$7,'tiger-mapshaper-0.6.113-dp25m','public-domain','approved')", [input.candidateReleaseId, snapshotId, sourceId, `https://maps.dsa-seats.org/tiger/cd119/${input.layer.metrics.sourceSha256}/${geography.source_geoid}.geojson`, geography.original_published_at, geography.original_retrieved_at, checksum]);
      await client.query("INSERT INTO snapshot_derivations(release_id,output_snapshot_id,methodology_version) VALUES($1,$2,'tiger-mapshaper-0.6.113-dp25m')", [input.candidateReleaseId, snapshotId]);
      await client.query("INSERT INTO snapshot_derivation_inputs(release_id,output_snapshot_id,input_snapshot_id) VALUES($1,$2,$3)", [input.candidateReleaseId, snapshotId, geography.original_snapshot_id]);
      const valid = await client.query<{ valid: boolean }>("SELECT ST_IsValid(g) valid FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) g) q WHERE NOT ST_IsEmpty(g) AND GeometryType(g)='MULTIPOLYGON'", [JSON.stringify(feature.geometry)]);
      if (valid.rowCount !== 1 || !valid.rows[0]?.valid) fail("MAP_FINALIZE_GEOMETRY_INVALID");
      await client.query("INSERT INTO geometry_artifacts(release_id,id,snapshot_id,object_key,format,srid,checksum_sha256) VALUES($1,$2,$3,$4,'geojson',4326,$5)", [input.candidateReleaseId, artifactId, snapshotId, receipt.key, checksum]);
      await client.query("INSERT INTO map_artifacts(release_id,id,geography_version_id,artifact_id) VALUES($1,$2,$3,$4)", [input.candidateReleaseId, mapId, geography.id, artifactId]);
      await client.query("INSERT INTO map_artifact_inputs(release_id,map_artifact_id,snapshot_id) VALUES($1,$2,$3)", [input.candidateReleaseId, mapId, snapshotId]);
      await client.query("INSERT INTO map_artifact_receipts(release_id,map_artifact_id,raw_store_kind,store_identity,object_key,sha256,byte_size,version_id,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [input.candidateReleaseId, mapId, ...receiptRow(receipt)]);
    }
    await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]); await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]); await client.query("DELETE FROM coverage_records WHERE release_id=$1 AND domain='maps'", [input.candidateReleaseId]);
    await client.query("INSERT INTO coverage_records(release_id,domain,scope_key,scope_kind,status,expected_count,observed_count,quarantined_count,incompatible_count) VALUES($1,'maps',$2,'release','complete',441,441,0,0)", [input.candidateReleaseId, MAP_SCOPE_KEY]);
    for (const geography of expected) await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,'maps',$2,$3)", [input.candidateReleaseId, MAP_SCOPE_KEY, id("snap_map", `${geography.id}:${sha(bytes.get(geography.source_geoid)!)}`)]);
    const manifest = (await loadNationwideManifestForFinalization(client, input.candidateReleaseId)).manifest; const canonical = computeCanonicalDataChecksum(manifest); if (!validateReleaseManifest({ ...manifest, canonicalDataChecksumSha256: canonical }).success) fail("MAP_FINALIZE_MANIFEST_INVALID");
    const metadata = await client.query<{ geometry_checksum_sha256: string }>("SELECT geometry_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR UPDATE", [input.candidateReleaseId]); if (metadata.rowCount !== 1) fail("MAP_FINALIZE_MANIFEST_INVALID");
    await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [input.candidateReleaseId, canonical, expectedContentChecksum({ canonical_data_checksum_sha256: canonical, geometry_checksum_sha256: metadata.rows[0]!.geometry_checksum_sha256 } as never)]);
    await validateNationwideCandidateReleaseWithClient(client, input.candidateReleaseId); await assertExactPersistedMaps(client, input); await loadNationwideManifest(client, input.candidateReleaseId); await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && /^MAP_FINALIZE_/.test(error.message)) throw error; const wrapped = new Error("MAP_FINALIZE_FAILED") as Error & { cause?: unknown }; wrapped.cause = error; throw wrapped; } finally { client.release(); }
}

/** Read-compatible verifier: shared advisory lock and repeatable snapshot permit concurrent callers. */
export async function verifyPersistedCandidateMaps(input: FinalizeMapsInput): Promise<void> {
  assertInput(input); await assertReplay(input); const client = await input.pool.connect(); let begun = false;
  try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); begun = true; for (const releaseId of [input.candidateReleaseId, input.sourceReleaseId].sort()) await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:' || $1))", [releaseId]); await lockLineage(client, input, ["candidate", "published", "retired"]); await assertExactPersistedMaps(client, input); await recheckNationwideValidationGateShared(client, input.candidateReleaseId); await client.query("COMMIT"); begun = false; } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && /^MAP_FINALIZE_/.test(error.message)) throw error; throw new Error("MAP_FINALIZE_FAILED"); } finally { client.release(); }
}
