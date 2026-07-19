import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { FactValue, GeographyVersionId, MissingReason, PrototypeManifest } from "@/domain/contracts";
import { prototypeManifestSchema } from "@/domain/contracts";
import { computeCanonicalDataChecksum, validatePrototypeManifest } from "@/domain/validate-manifest";

type Queryable = Pick<PoolClient, "query">;

function isPool(connection: Pool | PoolClient): connection is Pool {
  return typeof (connection as Pool).connect === "function" && typeof (connection as PoolClient).release !== "function";
}

export interface GeoJsonMultiPolygon {
  readonly type: "MultiPolygon";
  readonly coordinates: readonly (readonly (readonly (readonly [number, number] | readonly number[])[])[])[];
}

export type GeographyBoundaryMap =
  | ReadonlyMap<GeographyVersionId | string, GeoJsonMultiPolygon>
  | Readonly<Record<string, GeoJsonMultiPolygon>>;

/** Untrusted, byte-for-byte geometry artifacts supplied to the seeder. */
export interface BoundaryBundleEntry {
  readonly artifactId: string;
  readonly objectKey: string;
  readonly bytes: Buffer | string;
}

export type BoundaryBundle = readonly BoundaryBundleEntry[];

async function inTransaction<T>(connection: Pool | PoolClient, work: (client: Queryable) => Promise<T>): Promise<T> {
  // A supplied PoolClient is deliberately not nested in BEGIN/COMMIT: callers such as
  // release validation already own the transaction and must observe one snapshot.
  if (!isPool(connection)) return work(connection);
  const client = await connection.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function sha256(value: Buffer | string): string { return createHash("sha256").update(value).digest("hex"); }
function geometryChecksum(pairs: readonly { id: string; checksum: string }[]): string {
  return sha256(JSON.stringify([...pairs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}
function contentChecksum(data: string, geometry: string): string { return sha256(JSON.stringify({ data, geometry })); }

type GeoJsonFeature = { readonly type: "Feature"; readonly properties: Record<string, unknown>; readonly geometry: unknown };
type GeoJsonCollection = { readonly type: "FeatureCollection"; readonly features: readonly GeoJsonFeature[] };

function requireMultiPolygon(value: unknown, context: string): GeoJsonMultiPolygon {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "MultiPolygon" || !Array.isArray((value as { coordinates?: unknown }).coordinates)) throw new Error(`${context} must be a MultiPolygon`);
  const coordinates = (value as { coordinates: unknown[] }).coordinates;
  if (coordinates.length === 0) throw new Error(`${context} has no polygons`);
  for (const polygon of coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw new Error(`${context} has an empty polygon`);
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error(`${context} has an invalid ring`);
      let first: readonly number[] | undefined;
      for (const point of ring) {
        if (!Array.isArray(point) || point.length !== 2 || !point.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) throw new Error(`${context} has an invalid coordinate`);
        const [longitude, latitude] = point as number[];
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) throw new Error(`${context} has an out-of-range coordinate`);
        first ??= point as number[];
      }
      const last = ring[ring.length - 1] as readonly number[];
      if (first![0] !== last[0] || first![1] !== last[1]) throw new Error(`${context} has a non-closed ring`);
    }
  }
  return value as GeoJsonMultiPolygon;
}

/** Verifies raw artifacts before compiling their features into persistence-ready boundaries. */
export function compileBoundaryBundle(manifest: PrototypeManifest, bundle: BoundaryBundle): ReadonlyMap<string, GeoJsonMultiPolygon> {
  const artifacts = new Map(manifest.geometryArtifacts.map((artifact) => [String(artifact.id), artifact]));
  if (artifacts.size !== manifest.geometryArtifacts.length || bundle.length !== artifacts.size) throw new Error("Boundary bundle must contain every manifest artifact exactly once");
  const supplied = new Set<string>();
  const result = new Map<string, GeoJsonMultiPolygon>();
  for (const entry of bundle) {
    const artifact = artifacts.get(entry.artifactId);
    if (!artifact || supplied.has(entry.artifactId)) throw new Error(`Unknown or duplicate boundary artifact ${entry.artifactId}`);
    supplied.add(entry.artifactId);
    if (entry.objectKey !== artifact.objectKey) throw new Error(`Boundary artifact ${entry.artifactId} object key does not match manifest`);
    const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes);
    if (sha256(bytes) !== artifact.checksumSha256) throw new Error(`Boundary artifact ${entry.artifactId} checksum does not match manifest`);
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`Boundary artifact ${entry.artifactId} is not valid JSON`); }
    if (!parsed || typeof parsed !== "object" || (parsed as GeoJsonCollection).type !== "FeatureCollection" || !Array.isArray((parsed as GeoJsonCollection).features)) throw new Error(`Boundary artifact ${entry.artifactId} must be a FeatureCollection`);
    const expected = new Map(manifest.geographyVersions.filter((geography) => geography.geometryArtifactId === artifact.id).map((geography) => [geography.sourceGeoid, geography]));
    if (expected.size === 0) throw new Error(`Boundary artifact ${entry.artifactId} has no expected geographies`);
    const seen = new Set<string>();
    for (const feature of (parsed as GeoJsonCollection).features) {
      if (!feature || feature.type !== "Feature" || !feature.properties || typeof feature.properties !== "object") throw new Error(`Boundary artifact ${entry.artifactId} has an invalid feature`);
      const sourceGeoid = feature.properties.sourceGeoid;
      if (typeof sourceGeoid !== "string" || seen.has(sourceGeoid)) throw new Error(`Boundary artifact ${entry.artifactId} has a duplicate or invalid GEOID`);
      const geography = expected.get(sourceGeoid);
      if (!geography) throw new Error(`Boundary artifact ${entry.artifactId} has an unexpected GEOID ${sourceGeoid}`);
      const featureState = feature.properties.stateCode;
      const fips = feature.properties.stateFips;
      const stateMatches = featureState === geography.stateCode || (featureState === null && typeof fips === "string" && ({ "01": "AL", "02": "AK", "04": "AZ", "12": "FL" }[fips] === geography.stateCode));
      if (!stateMatches || (geography.kind === "house_district" ? feature.properties.districtCode !== geography.districtCode : feature.properties.districtCode !== null)) throw new Error(`Boundary artifact ${entry.artifactId} feature ${sourceGeoid} does not match geography properties`);
      if (result.has(geography.id)) throw new Error(`Duplicate boundary geography ${geography.id}`);
      result.set(geography.id, requireMultiPolygon(feature.geometry, `Boundary artifact ${entry.artifactId} feature ${sourceGeoid}`));
      seen.add(sourceGeoid);
    }
    if (seen.size !== expected.size) throw new Error(`Boundary artifact ${entry.artifactId} is missing expected features`);
  }
  if (result.size !== manifest.geographyVersions.length) throw new Error("Boundary bundle does not cover every manifest geography");
  return result;
}

function validationError(prefix: string, issues: readonly { path: string; message: string }[]): Error {
  return new Error(`${prefix}: ${issues.map((issue) => `${issue.path || "manifest"}: ${issue.message}`).join("; ")}`);
}

function factColumns(value: FactValue<number>): readonly [number | null, string | null] {
  return value.kind === "value" ? [value.value, null] : [null, value.reason];
}

async function insertProvenance(
  client: Queryable,
  releaseId: string,
  entityType: string,
  entityId: string,
  references: readonly { snapshotId: string; role: string }[],
): Promise<void> {
  for (const reference of references) {
    await client.query(
      "INSERT INTO provenance (release_id,entity_type,entity_id,snapshot_id,role) VALUES ($1,$2,$3,$4,$5)",
      [releaseId, entityType, entityId, reference.snapshotId, reference.role],
    );
  }
}

async function insertLineage(
  client: Queryable,
  table: "contest_lineage" | "election_result_lineage" | "acs_observation_lineage" | "fec_filing_lineage" | "seat_finance_summary_lineage",
  identityColumns: readonly string[],
  identityValues: readonly string[],
  releaseId: string,
  references: readonly { snapshotId: string; role: string }[],
): Promise<void> {
  const columns = ["release_id", ...identityColumns, "snapshot_id", "role"];
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
  // table/column names are closed internal literals; all manifest data remains parameterized.
  for (const reference of references) {
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`,
      [releaseId, ...identityValues, reference.snapshotId, reference.role],
    );
  }
}

/** Validates and atomically persists one complete candidate release. */
export async function seedPrototypeManifest(
  connection: Pool,
  input: PrototypeManifest,
  bundle: BoundaryBundle,
): Promise<void> {
  const validation = validatePrototypeManifest(input);
  if (!validation.success) throw validationError("Cannot seed invalid prototype manifest", validation.issues);
  const manifest = validation.data;
  if (manifest.release.status !== "candidate") throw new Error("Only candidate releases may be seeded");
  if (computeCanonicalDataChecksum(manifest) !== manifest.canonicalDataChecksumSha256) {
    throw new Error("Canonical data checksum does not exactly match manifest content");
  }

  // Compile immediately before persistence; a pre-mapped geometry cannot attest raw artifact identity.
  const boundaryByGeography = compileBoundaryBundle(manifest, bundle);

  await inTransaction(connection, async (client) => {
    const release = manifest.release;
    await client.query(
      "INSERT INTO data_releases (id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [release.id, release.label, release.status, release.sourceCutoff, release.createdAt, release.publishedAt, release.previousReleaseId],
    );
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [release.id]);
    // Geometry identity is derived only from PostGIS's normalized EWKB, never
    // from caller supplied geometry or hashes.

    for (const row of manifest.sources) {
      await client.query("INSERT INTO sources (release_id,id,name,authority,homepage_url) VALUES ($1,$2,$3,$4,$5)", [row.releaseId, row.id, row.name, row.authority, row.homepageUrl]);
    }
    for (const row of manifest.snapshots) {
      await client.query("INSERT INTO source_snapshots (release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [row.releaseId, row.id, row.sourceId, row.sourceUrl, row.publishedAt, row.retrievedAt, row.checksumSha256, row.parserVersion, row.license, row.usageStatus]);
    }
    for (const row of manifest.districtPlans) {
      await client.query("INSERT INTO district_plans (release_id,id,name,congress,enacted_at,effective_from,effective_to,jurisdiction_state_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [row.releaseId, row.id, row.name, row.congress, row.enactedAt, row.effectiveFrom, row.effectiveTo, row.jurisdictionStateCode]);
      await insertProvenance(client, release.id, "district_plans", row.id, row.provenance);
    }
    for (const row of manifest.geometryArtifacts) {
      await client.query("INSERT INTO geometry_artifacts (release_id,id,snapshot_id,object_key,format,srid,checksum_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7)", [row.releaseId, row.id, row.snapshotId, row.objectKey, row.format, row.srid, row.checksumSha256]);
    }
    for (const row of manifest.geographyVersions) {
      const boundary = boundaryByGeography.get(row.id)!;
      await client.query(
        "INSERT INTO geography_versions (release_id,id,kind,district_plan_id,geometry_artifact_id,source_geoid,label,vintage,state_code,district_code,boundary,boundary_checksum_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,ST_SetSRID(ST_GeomFromGeoJSON($11),4326),$12) RETURNING boundary_checksum_sha256",
        [row.releaseId, row.id, row.kind, row.kind === "house_district" ? row.districtPlanId : null, row.geometryArtifactId, row.sourceGeoid, row.label, row.vintage, row.stateCode, row.kind === "house_district" ? row.districtCode : null, JSON.stringify(boundary), "0".repeat(64)],
      );
      const ewkb = await client.query<{ ewkb: Buffer }>("SELECT ST_AsEWKB(ST_Normalize(boundary)) AS ewkb FROM geography_versions WHERE release_id=$1 AND id=$2", [release.id, row.id]);
      const digest = sha256(ewkb.rows[0]!.ewkb);
      await client.query("UPDATE geography_versions SET boundary_checksum_sha256=$3 WHERE release_id=$1 AND id=$2", [release.id, row.id, digest]);
      await insertProvenance(client, release.id, "geography_versions", row.id, row.provenance);
    }
    for (const row of manifest.offices) {
      await client.query("INSERT INTO offices (release_id,id,chamber,kind,state_code,district_code,senate_class) VALUES ($1,$2,$3,$4,$5,$6,$7)", [row.releaseId, row.id, row.chamber, row.kind, row.stateCode, row.districtCode, row.senateClass]);
      await insertProvenance(client, release.id, "offices", row.id, row.provenance);
    }
    for (const row of manifest.people) {
      await client.query("INSERT INTO people (release_id,id,display_name,birth_date,bioguide_id) VALUES ($1,$2,$3,$4,$5)", [row.releaseId, row.id, row.displayName, row.birthDate, row.bioguideId]);
      await insertProvenance(client, release.id, "people", row.id, row.provenance);
    }
    for (const row of manifest.officeTerms) {
      await client.query("INSERT INTO office_terms (release_id,id,office_id,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5)", [row.releaseId, row.id, row.officeId, row.startsAt, row.endsAt]);
      await insertProvenance(client, release.id, "office_terms", row.id, row.provenance);
    }
    for (const row of manifest.memberships) {
      await client.query("INSERT INTO memberships (release_id,id,office_term_id,person_id,party,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [row.releaseId, row.id, row.officeTermId, row.personId, row.party, row.startsAt, row.endsAt]);
      await insertProvenance(client, release.id, "memberships", row.id, row.provenance);
    }
    for (const row of manifest.seatCycles) {
      await client.query("INSERT INTO seat_cycles (release_id,id,office_id,office_term_id,geography_version_id,cycle_year,election_date,election_kind,incumbency_status,occupancy_status,occupancy_as_of) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [row.releaseId, row.id, row.officeId, row.officeTermId, row.geographyVersionId, row.cycleYear, row.electionDate, row.electionKind, row.incumbencyStatus, row.occupancy.status, row.occupancy.asOf]);
      await insertProvenance(client, release.id, "seat_cycles", row.id, row.provenance);
    }
    for (const row of manifest.contests) {
      const denominator = factColumns(row.denominatorVotes);
      const allocation = factColumns(row.allocationCoveragePercent);
      await client.query("INSERT INTO contests (release_id,id,seat_cycle_id,kind,round,election_date,geography_version_id,certification_status,reporting_completeness_percent,denominator_votes,denominator_missing_reason,reporting_unit,allocation_method,allocation_coverage_percent,allocation_coverage_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)", [row.releaseId, row.id, row.seatCycleId, row.kind, row.round, row.electionDate, row.geographyVersionId, row.certificationStatus, row.reportingCompletenessPercent, ...denominator, row.reportingUnit, row.allocationMethod, ...allocation, row.lineage.asOf, row.lineage.methodology, row.lineage.status]);
      await insertProvenance(client, release.id, "contests", row.id, row.provenance);
      await insertLineage(client, "contest_lineage", ["contest_id"], [row.id], release.id, row.lineage.inputs);
    }
    for (const row of manifest.candidacies) {
      await client.query("INSERT INTO candidacies (release_id,id,contest_id,person_id,party,status) VALUES ($1,$2,$3,$4,$5,$6)", [row.releaseId, row.id, row.contestId, row.personId, row.party, row.status]);
      await insertProvenance(client, release.id, "candidacies", row.id, row.provenance);
    }
    for (const row of manifest.resultOptions) {
      await client.query("INSERT INTO result_options (release_id,id,contest_id,candidacy_id,label,party,option_kind) VALUES ($1,$2,$3,$4,$5,$6,$7)", [row.releaseId, row.id, row.contestId, row.candidacyId, row.label, row.party, row.optionKind]);
      await insertProvenance(client, release.id, "result_options", row.id, row.provenance);
    }
    for (const row of manifest.electionResults) {
      const votes = factColumns(row.votes);
      await client.query("INSERT INTO election_results (release_id,contest_id,result_option_id,votes,votes_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [row.releaseId, row.contestId, row.resultOptionId, ...votes, row.lineage.asOf, row.lineage.methodology, row.lineage.status]);
      await insertLineage(client, "election_result_lineage", ["contest_id", "result_option_id"], [row.contestId, row.resultOptionId], release.id, row.lineage.inputs);
    }
    for (const row of manifest.acsObservations) {
      const estimate = factColumns(row.estimate);
      const margin = factColumns(row.marginOfError);
      await client.query("INSERT INTO acs_observations (release_id,geography_version_id,variable,label,estimate,estimate_missing_reason,margin_of_error,margin_of_error_missing_reason,unit,survey_period,universe,lineage_as_of,lineage_methodology,lineage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)", [row.releaseId, row.geographyVersionId, row.variable, row.label, ...estimate, ...margin, row.unit, row.surveyPeriod, row.universe, row.lineage.asOf, row.lineage.methodology, row.lineage.status]);
      await insertLineage(client, "acs_observation_lineage", ["geography_version_id", "variable", "survey_period"], [row.geographyVersionId, row.variable, row.surveyPeriod], release.id, row.lineage.inputs);
    }
    for (const row of manifest.committees) {
      await client.query("INSERT INTO committees (release_id,id,source_committee_id,name,committee_type) VALUES ($1,$2,$3,$4,$5)", [row.releaseId, row.id, row.sourceCommitteeId, row.name, row.committeeType]);
      await insertProvenance(client, release.id, "committees", row.id, row.provenance);
    }
    for (const row of manifest.committeeRelationships) {
      await client.query("INSERT INTO committee_relationships (release_id,id,committee_id,candidacy_id,relationship,effective_from,effective_to) VALUES ($1,$2,$3,$4,$5,$6,$7)", [row.releaseId, row.id, row.committeeId, row.candidacyId, row.relationship, row.effectiveFrom, row.effectiveTo]);
      await insertProvenance(client, release.id, "committee_relationships", row.id, row.provenance);
    }

    // Self-referencing FEC chains are inserted predecessor-first even when the manifest is not ordered that way.
    const pending = new Map(manifest.fecFilingSummaries.map((row) => [row.id, row]));
    const inserted = new Set<string>();
    while (pending.size > 0) {
      const ready = [...pending.values()].filter((row) => row.amendsFilingId === null || inserted.has(row.amendsFilingId));
      if (ready.length === 0) throw new Error("FEC amendment chain cannot be ordered");
      for (const row of ready) {
        const cash = factColumns(row.cashOnHand);
        const receipts = factColumns(row.totalReceipts);
        const disbursements = factColumns(row.totalDisbursements);
        await client.query("INSERT INTO fec_filing_summaries (release_id,id,seat_cycle_id,committee_id,source_filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)", [row.releaseId, row.id, row.seatCycleId, row.committeeId, row.sourceFilingId, row.reportType, row.reportingPeriodStart, row.reportingPeriodEnd, row.filedAt, row.amendmentNumber, row.amendmentStatus, row.amendsFilingId, ...cash, ...receipts, ...disbursements, row.lineage.asOf, row.lineage.methodology, row.lineage.status]);
        await insertLineage(client, "fec_filing_lineage", ["filing_id"], [row.id], release.id, row.lineage.inputs);
        pending.delete(row.id);
        inserted.add(row.id);
      }
    }
    for (const row of manifest.financeSummaries) {
      await client.query("INSERT INTO seat_finance_summaries (release_id,seat_cycle_id,filing_id,missing_reason,as_of) VALUES ($1,$2,$3,$4,$5)", row.kind === "value" ? [row.releaseId, row.seatCycleId, row.filingId, null, null] : [row.releaseId, row.seatCycleId, null, row.reason, row.asOf]);
      if (row.kind === "missing") await insertLineage(client, "seat_finance_summary_lineage", ["seat_cycle_id"], [row.seatCycleId], release.id, row.inputs);
    }
    for (const [index, seatCycleId] of manifest.profileSeatCycleIds.entries()) {
      await client.query("INSERT INTO release_profile_seats (release_id,seat_cycle_id,position) VALUES ($1,$2,$3)", [release.id, seatCycleId, index + 1]);
    }
    const geometryRows = await client.query<{ id: string; boundary_checksum_sha256: string }>("SELECT id,boundary_checksum_sha256 FROM geography_versions WHERE release_id=$1 ORDER BY id", [release.id]);
    const geometry = geometryChecksum(geometryRows.rows.map((row) => ({ id: row.id, checksum: row.boundary_checksum_sha256 })));
    await client.query("INSERT INTO release_manifests (release_id,schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256) VALUES ($1,$2,$3,$4,$5)", [release.id, manifest.schemaVersion, manifest.canonicalDataChecksumSha256, geometry, contentChecksum(manifest.canonicalDataChecksumSha256, geometry)]);
  });
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function isoDate(value: unknown): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function fact(value: unknown, reason: unknown): FactValue<number> {
  return value === null
    ? { kind: "missing", reason: String(reason) as MissingReason }
    : { kind: "value", value: numberValue(value) };
}

function indexReferences(rows: readonly QueryResultRow[], key: (row: QueryResultRow) => string): Map<string, { snapshotId: string; role: string }[]> {
  const result = new Map<string, { snapshotId: string; role: string }[]>();
  for (const row of rows) {
    const id = key(row);
    const references = result.get(id) ?? [];
    references.push({ snapshotId: row.snapshot_id as string, role: row.role as string });
    result.set(id, references);
  }
  return result;
}

async function rows(client: Queryable, table: string, releaseId: string, orderBy: string): Promise<QueryResultRow[]> {
  // All identifiers are internal constants supplied below; releaseId remains parameterized.
  return (await client.query(`SELECT * FROM ${table} WHERE release_id=$1 ORDER BY ${orderBy}`, [releaseId])).rows;
}

/** Loads and semantically validates the exact domain manifest represented by a release. */
export async function loadPrototypeManifest(connection: Pool | PoolClient, releaseId: string): Promise<PrototypeManifest> {
  return inTransaction(connection, async (client) => {
    const releaseResult = await client.query("SELECT * FROM data_releases WHERE id=$1", [releaseId]);
    const manifestResult = await client.query("SELECT * FROM release_manifests WHERE release_id=$1", [releaseId]);
    const profileRows = await rows(client, "release_profile_seats", releaseId, "position");
    const provenanceRows = await rows(client, "provenance", releaseId, "entity_type, entity_id, snapshot_id, role");
    const contestLineageRows = await rows(client, "contest_lineage", releaseId, "contest_id, snapshot_id, role");
    const resultLineageRows = await rows(client, "election_result_lineage", releaseId, "contest_id, result_option_id, snapshot_id, role");
    const acsLineageRows = await rows(client, "acs_observation_lineage", releaseId, "geography_version_id, variable, survey_period, snapshot_id, role");
    const filingLineageRows = await rows(client, "fec_filing_lineage", releaseId, "filing_id, snapshot_id, role");
    const financeLineageRows = await rows(client, "seat_finance_summary_lineage", releaseId, "seat_cycle_id, snapshot_id, role");
    if (releaseResult.rowCount !== 1 || manifestResult.rowCount !== 1) throw new Error(`Release ${releaseId} has no complete manifest metadata`);

    const tableNames = ["sources", "source_snapshots", "district_plans", "geometry_artifacts", "geography_versions", "offices", "people", "office_terms", "memberships", "seat_cycles", "contests", "candidacies", "result_options", "election_results", "acs_observations", "committees", "committee_relationships", "fec_filing_summaries", "seat_finance_summaries"] as const;
    const tableOrderBy: Record<(typeof tableNames)[number], string> = {
      sources: "id", source_snapshots: "id", district_plans: "id", geometry_artifacts: "id",
      geography_versions: "id", offices: "id", people: "id", office_terms: "id", memberships: "id",
      seat_cycles: "id", contests: "id", candidacies: "id", result_options: "id",
      election_results: "contest_id, result_option_id",
      acs_observations: "geography_version_id, variable, survey_period",
      committees: "id", committee_relationships: "id", fec_filing_summaries: "id",
      seat_finance_summaries: "seat_cycle_id",
    };
    const tables = {} as Record<(typeof tableNames)[number], QueryResultRow[]>;
    for (const table of tableNames) tables[table] = await rows(client, table, releaseId, tableOrderBy[table]);
    const provenance = indexReferences(provenanceRows, (row) => `${row.entity_type}:${row.entity_id}`);
    const refs = (type: string, id: unknown) => provenance.get(`${type}:${String(id)}`) ?? [];
    const contestLineage = indexReferences(contestLineageRows, (row) => String(row.contest_id));
    const resultLineage = indexReferences(resultLineageRows, (row) => `${row.contest_id}:${row.result_option_id}`);
    const acsLineage = indexReferences(acsLineageRows, (row) => `${row.geography_version_id}:${row.variable}:${row.survey_period}`);
    const filingLineage = indexReferences(filingLineageRows, (row) => String(row.filing_id));
    const financeLineage = indexReferences(financeLineageRows, (row) => String(row.seat_cycle_id));
    const release = releaseResult.rows[0]!;
    const metadata = manifestResult.rows[0]!;

    const geometryRows = await client.query<{ id: string; boundary_checksum_sha256: string; ewkb: Buffer }>("SELECT id,boundary_checksum_sha256,ST_AsEWKB(ST_Normalize(boundary)) AS ewkb FROM geography_versions WHERE release_id=$1 ORDER BY id", [releaseId]);
    const pairs = geometryRows.rows.map((row) => ({ id: row.id, checksum: sha256(row.ewkb) }));
    if (pairs.some((pair, index) => pair.checksum !== geometryRows.rows[index]!.boundary_checksum_sha256)) throw new Error(`Stored release ${releaseId} geometry boundary checksum mismatch`);
    const geometry = geometryChecksum(pairs);
    if (geometry !== metadata.geometry_checksum_sha256 || contentChecksum(metadata.canonical_data_checksum_sha256, geometry) !== metadata.content_checksum_sha256) throw new Error(`Stored release ${releaseId} geometry content checksum mismatch`);

    const candidate = {
      schemaVersion: metadata.schema_version,
      canonicalDataChecksumSha256: metadata.canonical_data_checksum_sha256,
      profileSeatCycleIds: profileRows.map((row) => row.seat_cycle_id),
      release: { id: release.id, label: release.label, status: release.status, sourceCutoff: isoTimestamp(release.source_cutoff), createdAt: isoTimestamp(release.created_at), publishedAt: release.published_at === null ? null : isoTimestamp(release.published_at), previousReleaseId: release.previous_release_id },
      sources: tables.sources.map((row) => ({ id: row.id, releaseId: row.release_id, name: row.name, authority: row.authority, homepageUrl: row.homepage_url })),
      snapshots: tables.source_snapshots.map((row) => ({ id: row.id, releaseId: row.release_id, sourceId: row.source_id, sourceUrl: row.source_url, publishedAt: row.published_at === null ? null : isoTimestamp(row.published_at), retrievedAt: isoTimestamp(row.retrieved_at), checksumSha256: row.checksum_sha256, parserVersion: row.parser_version, license: row.license, usageStatus: row.usage_status })),
      districtPlans: tables.district_plans.map((row) => ({ id: row.id, releaseId: row.release_id, name: row.name, congress: row.congress, enactedAt: isoDate(row.enacted_at), effectiveFrom: isoDate(row.effective_from), effectiveTo: isoDate(row.effective_to), jurisdictionStateCode: row.jurisdiction_state_code, provenance: refs("district_plans", row.id) })),
      geometryArtifacts: tables.geometry_artifacts.map((row) => ({ id: row.id, releaseId: row.release_id, snapshotId: row.snapshot_id, objectKey: row.object_key, format: row.format, srid: row.srid, checksumSha256: row.checksum_sha256 })),
      geographyVersions: tables.geography_versions.map((row) => row.kind === "house_district" ? ({ id: row.id, releaseId: row.release_id, kind: row.kind, districtPlanId: row.district_plan_id, geometryArtifactId: row.geometry_artifact_id, sourceGeoid: row.source_geoid, label: row.label, vintage: row.vintage, stateCode: row.state_code, districtCode: row.district_code, provenance: refs("geography_versions", row.id) }) : ({ id: row.id, releaseId: row.release_id, kind: row.kind, geometryArtifactId: row.geometry_artifact_id, sourceGeoid: row.source_geoid, label: row.label, vintage: row.vintage, stateCode: row.state_code, provenance: refs("geography_versions", row.id) })),
      offices: tables.offices.map((row) => ({ id: row.id, releaseId: row.release_id, chamber: row.chamber, kind: row.kind, stateCode: row.state_code, districtCode: row.district_code, senateClass: row.senate_class, provenance: refs("offices", row.id) })),
      people: tables.people.map((row) => ({ id: row.id, releaseId: row.release_id, displayName: row.display_name, birthDate: isoDate(row.birth_date), bioguideId: row.bioguide_id, provenance: refs("people", row.id) })),
      officeTerms: tables.office_terms.map((row) => ({ id: row.id, releaseId: row.release_id, officeId: row.office_id, startsAt: isoDate(row.starts_at), endsAt: isoDate(row.ends_at), provenance: refs("office_terms", row.id) })),
      memberships: tables.memberships.map((row) => ({ id: row.id, releaseId: row.release_id, officeTermId: row.office_term_id, personId: row.person_id, party: row.party, startsAt: isoDate(row.starts_at), endsAt: isoDate(row.ends_at), provenance: refs("memberships", row.id) })),
      seatCycles: tables.seat_cycles.map((row) => ({ id: row.id, releaseId: row.release_id, officeId: row.office_id, officeTermId: row.office_term_id, geographyVersionId: row.geography_version_id, cycleYear: row.cycle_year, electionDate: isoDate(row.election_date), electionKind: row.election_kind, incumbencyStatus: row.incumbency_status, occupancy: { status: row.occupancy_status, asOf: isoDate(row.occupancy_as_of) }, provenance: refs("seat_cycles", row.id) })),
      contests: tables.contests.map((row) => ({ id: row.id, releaseId: row.release_id, seatCycleId: row.seat_cycle_id, kind: row.kind, round: row.round, electionDate: isoDate(row.election_date), geographyVersionId: row.geography_version_id, certificationStatus: row.certification_status, reportingCompletenessPercent: numberValue(row.reporting_completeness_percent), denominatorVotes: fact(row.denominator_votes, row.denominator_missing_reason), reportingUnit: row.reporting_unit, allocationMethod: row.allocation_method, allocationCoveragePercent: fact(row.allocation_coverage_percent, row.allocation_coverage_missing_reason), provenance: refs("contests", row.id), lineage: { inputs: contestLineage.get(String(row.id)) ?? [], asOf: isoDate(row.lineage_as_of), methodology: row.lineage_methodology, status: row.lineage_status } })),
      candidacies: tables.candidacies.map((row) => ({ id: row.id, releaseId: row.release_id, contestId: row.contest_id, personId: row.person_id, party: row.party, status: row.status, provenance: refs("candidacies", row.id) })),
      resultOptions: tables.result_options.map((row) => ({ id: row.id, releaseId: row.release_id, contestId: row.contest_id, candidacyId: row.candidacy_id, label: row.label, party: row.party, optionKind: row.option_kind, provenance: refs("result_options", row.id) })),
      electionResults: tables.election_results.map((row) => ({ releaseId: row.release_id, contestId: row.contest_id, resultOptionId: row.result_option_id, votes: fact(row.votes, row.votes_missing_reason), lineage: { inputs: resultLineage.get(`${row.contest_id}:${row.result_option_id}`) ?? [], asOf: isoDate(row.lineage_as_of), methodology: row.lineage_methodology, status: row.lineage_status } })),
      acsObservations: tables.acs_observations.map((row) => ({ releaseId: row.release_id, geographyVersionId: row.geography_version_id, variable: row.variable, label: row.label, estimate: fact(row.estimate, row.estimate_missing_reason), marginOfError: fact(row.margin_of_error, row.margin_of_error_missing_reason), unit: row.unit, surveyPeriod: row.survey_period, universe: row.universe, lineage: { inputs: acsLineage.get(`${row.geography_version_id}:${row.variable}:${row.survey_period}`) ?? [], asOf: isoDate(row.lineage_as_of), methodology: row.lineage_methodology, status: row.lineage_status } })),
      committees: tables.committees.map((row) => ({ id: row.id, releaseId: row.release_id, sourceCommitteeId: row.source_committee_id, name: row.name, committeeType: row.committee_type, provenance: refs("committees", row.id) })),
      committeeRelationships: tables.committee_relationships.map((row) => ({ id: row.id, releaseId: row.release_id, committeeId: row.committee_id, candidacyId: row.candidacy_id, relationship: row.relationship, effectiveFrom: isoDate(row.effective_from), effectiveTo: isoDate(row.effective_to), provenance: refs("committee_relationships", row.id) })),
      fecFilingSummaries: tables.fec_filing_summaries.map((row) => ({ id: row.id, releaseId: row.release_id, seatCycleId: row.seat_cycle_id, committeeId: row.committee_id, sourceFilingId: row.source_filing_id, reportType: row.report_type, reportingPeriodStart: isoDate(row.reporting_period_start), reportingPeriodEnd: isoDate(row.reporting_period_end), filedAt: isoTimestamp(row.filed_at), amendmentNumber: row.amendment_number, amendmentStatus: row.amendment_status, amendsFilingId: row.amends_filing_id, cashOnHand: fact(row.cash_on_hand, row.cash_on_hand_missing_reason), totalReceipts: fact(row.total_receipts, row.total_receipts_missing_reason), totalDisbursements: fact(row.total_disbursements, row.total_disbursements_missing_reason), lineage: { inputs: filingLineage.get(String(row.id)) ?? [], asOf: isoDate(row.lineage_as_of), methodology: row.lineage_methodology, status: row.lineage_status } })),
      financeSummaries: tables.seat_finance_summaries.map((row) => row.filing_id === null ? ({ kind: "missing", releaseId: row.release_id, seatCycleId: row.seat_cycle_id, reason: row.missing_reason, asOf: isoDate(row.as_of), inputs: financeLineage.get(String(row.seat_cycle_id)) ?? [] }) : ({ kind: "value", releaseId: row.release_id, seatCycleId: row.seat_cycle_id, filingId: row.filing_id })),
    };

    const parsed = prototypeManifestSchema.safeParse(candidate);
    if (!parsed.success) throw new Error(`Stored release ${releaseId} cannot be parsed as a prototype manifest: ${parsed.error.message}`);
    const validation = validatePrototypeManifest(parsed.data);
    if (!validation.success) throw validationError(`Stored release ${releaseId} is not semantically valid`, validation.issues);
    const allowed = new Set(["district_plans", "geography_versions", "offices", "people", "office_terms", "memberships", "seat_cycles", "contests", "candidacies", "result_options", "committees", "committee_relationships"].flatMap((type) => {
      const property = type.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof typeof candidate;
      const records = candidate[property] as readonly { id: string }[] | undefined;
      return records?.map((record) => `${type}:${record.id}`) ?? [];
    }));
    for (const row of provenanceRows) if (!allowed.has(`${row.entity_type}:${row.entity_id}`)) throw new Error(`Stored release ${releaseId} has unconsumed provenance`);
    const missingFinanceKeys = new Set(candidate.financeSummaries.filter((row) => row.kind === "missing").map((row) => row.seatCycleId));
    for (const key of financeLineage.keys()) if (!missingFinanceKeys.has(key)) throw new Error(`Stored release ${releaseId} has unconsumed finance summary lineage`);
    return validation.data;
  });
}

// Explicit candidate-oriented name for callers that prefer release lifecycle terminology.
export const seedCandidateManifest = seedPrototypeManifest;
