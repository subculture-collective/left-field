import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { adoptNationwideCandidateManifest } from "@/db/manifest";
import { recheckNationwideValidationGate, validateNationwideCandidateReleaseWithClient } from "@/db/catalog-release";
import { markLoaded } from "@/db/ingestion";
import { decodeIdentityEnvelope, type IdentityEnvelopeV1 } from "@/ingestion/identity/adapter";
import { decodeTigerEnvelope, readTigerComponents, type TigerEnvelopeV1 } from "@/ingestion/tiger/adapter";
import { parseNationalTigerArtifacts } from "@/ingestion/tiger/national";
import type { RawObjectResult, RawObjectStore } from "@/ingestion/core/raw-object-store";
import { compileNationwideCandidate } from "./nationwide-candidate";

export interface FinalizeNationwideCandidateInput { readonly pool: Pool; readonly rawStore: RawObjectStore; readonly releaseId: string; readonly identityRunId: string; readonly tigerRunId: string; readonly sourceLockSha256: string; readonly signal?: AbortSignal; }
type Run = { id: string; release_id: string; source_id: string; snapshot_id: string; adapter_version: string; upstream_release: string; raw_store_kind: "local" | "s3"; raw_store_locator: string; raw_object_key: string; raw_object_sha256: string; raw_object_byte_size: unknown; raw_object_version_id: string | null; raw_object_etag: string | null; lease_token: string; status: string; extracted_count: unknown; staged_count: unknown; quarantined_count: unknown; source_name: string; source_authority: string; source_homepage_url: string; snapshot_checksum: string; snapshot_parser_version: string; source_url: string; published_at: Date | string | null; retrieved_at: Date | string; license: string; usage_status: string; release_label: string; source_cutoff: Date | string; created_at: Date | string };
type StageRow = QueryResultRow & Record<string, unknown>;

function fail(code: string): never { throw new Error(code); }
const finite = (value: unknown): number => {
  const n = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(n) || n < 0) fail("NATIONWIDE_FINALIZE_INVALID_COUNT");
  return n;
};
const iso = (value: Date | string | null): string | null => value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const abort = (signal?: AbortSignal): void => { if (signal?.aborted) fail("NATIONWIDE_FINALIZE_ABORTED"); };
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const equal = (left: unknown, right: unknown): boolean => String(left) === String(right);
export function requireDerivedAuthority(value: string): "derived" { if (value === "derived") return value; return fail("NATIONWIDE_FINALIZE_SOURCE_INVALID"); }

function receipt(run: Run): RawObjectResult {
  return { storeKind: run.raw_store_kind, storeLocator: run.raw_store_locator, objectKey: run.raw_object_key, sha256: run.raw_object_sha256, byteSize: finite(run.raw_object_byte_size), ...(run.raw_object_version_id ? { versionId: run.raw_object_version_id } : {}), ...(run.raw_object_etag ? { etag: run.raw_object_etag } : {}) };
}
function assertRun(run: Run, id: string, source: "identity" | "tiger", status: "validated" | "loaded"): void {
  if (run.id !== id || run.release_id === "" || run.status !== status || run.source_name !== source || run.source_authority !== "derived" || run.usage_status !== "approved" || run.snapshot_id === "" || run.raw_object_sha256 === "" || run.snapshot_checksum !== run.raw_object_sha256 || run.snapshot_parser_version !== run.adapter_version || finite(run.extracted_count) !== finite(run.staged_count) || finite(run.quarantined_count) !== 0) fail("NATIONWIDE_FINALIZE_RUN_INVALID");
}
function identityRows(envelope: IdentityEnvelopeV1): readonly (readonly unknown[])[] { return envelope.rows.map(row => [row.sourceNaturalKey, row.entityId, row.sourceEntityId, row.displayName, row.officeChamber, row.officeStateCode, row.officeDistrictCode]); }
function tigerRows(envelope: TigerEnvelopeV1, components: { readonly cd119Bytes: Uint8Array; readonly statesBytes: Uint8Array }): readonly (readonly unknown[])[] {
  const cd = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(components.cd119Bytes)); const states = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(components.statesBytes));
  const parsed = parseNationalTigerArtifacts(cd, states);
  return [...parsed.cd119.map(row => [`cd119:${row.sourceGeoid}`, "cd119", row.sourceGeoid, row.stateCode, row.districtCode, "2025", envelope.components.cd119.sha256]), ...parsed.states.map(row => [`states:${row.sourceGeoid}`, "states", row.sourceGeoid, row.stateCode, row.districtCode, "2025", envelope.components.states.sha256])];
}
function assertStage(actual: readonly StageRow[], expected: readonly (readonly unknown[])[], fields: readonly string[], code: string): void {
  if (actual.length !== expected.length || new Set(actual.map(row => String(row.source_natural_key))).size !== actual.length) fail(code);
  const expectedByKey = new Map(expected.map(row => [String(row[0]), row]));
  for (const actualRow of actual) { const expectedRow = expectedByKey.get(String(actualRow.source_natural_key)); if (!expectedRow || fields.some((field, index) => !equal(actualRow[field], expectedRow[index]))) fail(code); }
}

/** Finalizes exactly the two already-validated nationwide ingestion runs in one transaction. */
export async function finalizeNationwideCandidate(input: FinalizeNationwideCandidateInput): Promise<void> {
  if (!input.releaseId || !input.identityRunId || !input.tigerRunId || input.identityRunId === input.tigerRunId || !/^[a-f0-9]{64}$/.test(input.sourceLockSha256)) fail("NATIONWIDE_FINALIZE_INPUT_INVALID");
  const client = await input.pool.connect(); let begun = false;
  try {
    abort(input.signal); await client.query("BEGIN"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [input.releaseId]);
    const result = await client.query<Run>(`SELECT ir.*, s.name source_name, s.authority source_authority, s.homepage_url source_homepage_url, ss.checksum_sha256 snapshot_checksum, ss.parser_version snapshot_parser_version, ss.source_url, ss.published_at, ss.retrieved_at, ss.license, ss.usage_status, r.label release_label, r.source_cutoff, r.created_at FROM ingest_runs ir JOIN data_releases r ON r.id=ir.release_id JOIN sources s ON s.release_id=ir.release_id AND s.id=ir.source_id JOIN source_snapshots ss ON ss.release_id=ir.release_id AND ss.id=ir.snapshot_id AND ss.source_id=ir.source_id WHERE ir.release_id=$1 AND ir.id IN ($2,$3) FOR UPDATE`, [input.releaseId, input.identityRunId, input.tigerRunId]);
    const identityRun = result.rows.find(row => row.id === input.identityRunId); const tigerRun = result.rows.find(row => row.id === input.tigerRunId);
    const release = await client.query("SELECT 1 FROM data_releases WHERE id=$1 AND status='candidate' FOR UPDATE", [input.releaseId]);
    if (release.rowCount !== 1 || result.rowCount !== 2) fail("NATIONWIDE_FINALIZE_CANDIDATE_INVALID");
    if (!identityRun || !tigerRun) fail("NATIONWIDE_FINALIZE_CANDIDATE_INVALID");
    if (identityRun.status === "loaded" && tigerRun.status === "loaded") {
      assertRun(identityRun, input.identityRunId, "identity", "loaded"); assertRun(tigerRun, input.tigerRunId, "tiger", "loaded");
      // The immutable raw envelopes bind this run to the source-lock SHA; retries
      // deliberately avoid rereading large TIGER components after a committed run.
      const [identityBytes, tigerBytes] = await Promise.all([input.rawStore.read(receipt(identityRun), input.signal), input.rawStore.read(receipt(tigerRun), input.signal)]);
      if (hash(identityBytes) !== identityRun.raw_object_sha256 || hash(tigerBytes) !== tigerRun.raw_object_sha256 || decodeIdentityEnvelope(identityBytes).sourceLockSha256 !== input.sourceLockSha256 || decodeTigerEnvelope(tigerBytes).sourceLockSha256 !== input.sourceLockSha256) fail("NATIONWIDE_FINALIZE_SOURCE_LOCK_MISMATCH");
      // A prior commit may have succeeded after the caller lost its response.  Do
      // not reread retained raw artifacts or rewrite the manifest in that case.
      await recheckNationwideValidationGate(client, input.releaseId);
      abort(input.signal); await client.query("COMMIT"); begun = false;
      return;
    }
    assertRun(identityRun, input.identityRunId, "identity", "validated"); assertRun(tigerRun, input.tigerRunId, "tiger", "validated");
    abort(input.signal);
    const [identityBytes, tigerBytes] = await Promise.all([input.rawStore.read(receipt(identityRun), input.signal), input.rawStore.read(receipt(tigerRun), input.signal)]);
    if (hash(identityBytes) !== identityRun.raw_object_sha256 || hash(tigerBytes) !== tigerRun.raw_object_sha256) fail("NATIONWIDE_FINALIZE_RAW_MISMATCH");
    const identity = decodeIdentityEnvelope(identityBytes); const tiger = decodeTigerEnvelope(tigerBytes);
    if (identity.sourceLockSha256 !== input.sourceLockSha256 || tiger.sourceLockSha256 !== input.sourceLockSha256) fail("NATIONWIDE_FINALIZE_SOURCE_LOCK_MISMATCH");
    if (identity.parserVersion !== identityRun.adapter_version || tiger.parserVersion !== tigerRun.adapter_version || identity.upstreamRelease !== identityRun.upstream_release || tiger.upstreamRelease !== tigerRun.upstream_release || identity.releaseCutoff !== iso(identityRun.source_cutoff)?.slice(0, 10)) fail("NATIONWIDE_FINALIZE_ENVELOPE_INVALID");
    const tigerComponents = await readTigerComponents(input.rawStore, tiger, input.signal); const expectedIdentity = identityRows(identity); const expectedTiger = tigerRows(tiger, tigerComponents);
    const vacancyCount = identity.rows.filter(row => row.vacancy).length;
    if (expectedIdentity.length !== 541 || identity.rows.filter(row => row.officeChamber === "house").length !== 441 || identity.rows.filter(row => row.officeChamber === "senate").length !== 100 || new Set(identity.rows.map(row => row.sourceNaturalKey)).size !== 541 || expectedTiger.length !== 497 || expectedTiger.filter(row => row[1] === "cd119").length !== 441 || expectedTiger.filter(row => row[1] === "states").length !== 56 || vacancyCount < 0) fail("NATIONWIDE_FINALIZE_STAGING_INVALID");
    const [identityStage, tigerStage] = await Promise.all([client.query<StageRow>("SELECT source_natural_key,entity_id,source_entity_id,display_name,office_chamber,office_state_code,office_district_code FROM stg_identity WHERE run_id=$1", [identityRun.id]), client.query<StageRow>("SELECT source_natural_key,artifact_id,geoid,state_code,district_code,vintage,checksum_sha256 FROM stg_tiger WHERE run_id=$1", [tigerRun.id])]);
    assertStage(identityStage.rows, expectedIdentity, ["source_natural_key", "entity_id", "source_entity_id", "display_name", "office_chamber", "office_state_code", "office_district_code"], "NATIONWIDE_FINALIZE_IDENTITY_STAGE_INVALID");
    assertStage(tigerStage.rows, expectedTiger, ["source_natural_key", "artifact_id", "geoid", "state_code", "district_code", "vintage", "checksum_sha256"], "NATIONWIDE_FINALIZE_TIGER_STAGE_INVALID");
    const compilation = compileNationwideCandidate({ release: { id: input.releaseId, label: identityRun.release_label, sourceCutoff: iso(identityRun.source_cutoff)!, createdAt: iso(identityRun.created_at)! }, sourceLockSha256: input.sourceLockSha256, identity, tiger, tigerComponents, sources: [{ id: identityRun.source_id, releaseId: input.releaseId, name: identityRun.source_name, authority: requireDerivedAuthority(identityRun.source_authority), homepageUrl: identityRun.source_homepage_url }, { id: tigerRun.source_id, releaseId: input.releaseId, name: tigerRun.source_name, authority: requireDerivedAuthority(tigerRun.source_authority), homepageUrl: tigerRun.source_homepage_url }], snapshots: [{ id: identityRun.snapshot_id, releaseId: input.releaseId, sourceId: identityRun.source_id, sourceUrl: identityRun.source_url, publishedAt: iso(identityRun.published_at), retrievedAt: iso(identityRun.retrieved_at)!, checksumSha256: identityRun.snapshot_checksum, parserVersion: identityRun.snapshot_parser_version, license: identityRun.license, usageStatus: "approved" }, { id: tigerRun.snapshot_id, releaseId: input.releaseId, sourceId: tigerRun.source_id, sourceUrl: tigerRun.source_url, publishedAt: iso(tigerRun.published_at), retrievedAt: iso(tigerRun.retrieved_at)!, checksumSha256: tigerRun.snapshot_checksum, parserVersion: tigerRun.snapshot_parser_version, license: tigerRun.license, usageStatus: "approved" }] });
    await adoptNationwideCandidateManifest(client, compilation.manifest, compilation.boundaryBundle);
    // Ingest-run transitions intentionally invalidate any existing semantic
    // gate. Complete both operational transitions before creating the final,
    // content-bound nationwide gate.
    await markLoaded(client, identityRun.id, identityRun.lease_token);
    await markLoaded(client, tigerRun.id, tigerRun.lease_token);
    await validateNationwideCandidateReleaseWithClient(client, input.releaseId);
    abort(input.signal); await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && /^NATIONWIDE_FINALIZE_/.test(error.message)) throw error; throw new Error("NATIONWIDE_FINALIZE_FAILED"); }
  finally { client.release(); }
}

export type NationwideCandidatePoint = { readonly kind: "matched"; readonly houseSeatCycleId: string; readonly senateSeatCycleIds: readonly string[] } | { readonly kind: "unsupported" | "ambiguous" };
/** Internal candidate-only geographic lookup; callers must not expose it as an address API. */
export async function locateNationwideCandidatePoint(client: PoolClient, releaseId: string, lon: number, lat: number): Promise<NationwideCandidatePoint> {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) fail("NATIONWIDE_POINT_INVALID");
  const result = await client.query<{ house: string | null; senate: string[] | null; count: unknown }>(`WITH candidate AS (SELECT id FROM data_releases WHERE id=$1 AND status='candidate'), p AS (SELECT ST_SetSRID(ST_MakePoint($2,$3),4326) point), h AS (SELECT sc.id FROM geography_versions g JOIN candidate c ON c.id=g.release_id JOIN seat_cycles sc ON sc.release_id=g.release_id AND sc.geography_version_id=g.id, p WHERE g.kind='house_district' AND ST_Covers(g.boundary,p.point)), s AS (SELECT sc.id, o.senate_class FROM jurisdictions j JOIN candidate c ON c.id=j.release_id JOIN offices o ON o.release_id=j.release_id AND o.state_code=j.jurisdiction_code AND o.chamber='senate' JOIN office_terms ot ON ot.release_id=o.release_id AND ot.office_id=o.id JOIN seat_cycles sc ON sc.release_id=ot.release_id AND sc.office_term_id=ot.id JOIN geography_versions g ON g.release_id=j.release_id AND g.kind='state' AND g.state_code=j.jurisdiction_code, p WHERE j.senate_representation='two_seats' AND ST_Covers(g.boundary,p.point)) SELECT (SELECT id FROM h LIMIT 1) house, (SELECT array_agg(id ORDER BY senate_class) FROM s) senate, (SELECT count(*) FROM h) count`, [releaseId, lon, lat]);
  const row = result.rows[0]; if (!row || finite(row.count) === 0) return { kind: "unsupported" }; const senate = row.senate ?? []; if (finite(row.count) !== 1 || !row.house || (senate.length !== 0 && senate.length !== 2)) return { kind: "ambiguous" }; return { kind: "matched", houseSeatCycleId: row.house, senateSeatCycleIds: senate };
}
