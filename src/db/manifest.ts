import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { FactValue, GeographyVersionId, MissingReason, PrototypeManifest } from "@/domain/contracts";
import { prototypeManifestSchema } from "@/domain/contracts";
import { nationwideManifestSchema, type NationwideManifest } from "@/domain/manifest";
import { computeCanonicalDataChecksum, validatePrototypeManifest, validateReleaseManifest } from "@/domain/validate-manifest";

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
  return sha256(JSON.stringify([...pairs].sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)))));
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
function textFactColumns(value: FactValue<string>): readonly [string | null, string | null] {
  return value.kind === "value" ? [value.value, null] : [null, value.reason];
}

type CoverageScope = NationwideManifest["coverageRecords"][number]["scope"];
export function canonicalCoverageScopeKey(scope: CoverageScope): string {
  return JSON.stringify({ kind: scope.kind, jurisdictionCode: scope.kind === "jurisdiction" || scope.kind === "election" ? scope.jurisdictionCode : null, seatCycleId: scope.kind === "seat_cycle" || scope.kind === "funding" ? scope.seatCycleId : null, variable: scope.kind === "acs_indicator" ? scope.variable : null, surveyPeriod: scope.kind === "acs_indicator" ? scope.surveyPeriod : null, electionYear: scope.kind === "election" ? scope.electionYear : null, fundingKind: scope.kind === "funding" ? scope.fundingKind : null });
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

type NormalizedSeedMode = "create" | "adopt-existing-candidate";

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function verifyAdoptableCandidate(client: Queryable, manifest: NationwideManifest): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [manifest.release.id]);
  const release = await client.query("SELECT id,label,status,source_cutoff,created_at,published_at,previous_release_id FROM data_releases WHERE id=$1", [manifest.release.id]);
  if (release.rowCount !== 1) throw new Error("Adoption requires an existing candidate release");
  const row = release.rows[0]!;
  const expectedRelease = {
    ...manifest.release,
    sourceCutoff: isoTimestamp(manifest.release.sourceCutoff), createdAt: isoTimestamp(manifest.release.createdAt),
    publishedAt: manifest.release.publishedAt === null ? null : isoTimestamp(manifest.release.publishedAt),
  };
  const actualRelease = {
    id: row.id, label: row.label, status: row.status,
    sourceCutoff: isoTimestamp(row.source_cutoff), createdAt: isoTimestamp(row.created_at),
    publishedAt: row.published_at === null ? null : isoTimestamp(row.published_at), previousReleaseId: row.previous_release_id,
  };
  if (!sameJson(actualRelease, expectedRelease) || row.status !== "candidate") throw new Error("Existing candidate release does not exactly match manifest");

  const sources = await client.query("SELECT id,release_id,name,authority,homepage_url FROM sources WHERE release_id=$1 ORDER BY id", [manifest.release.id]);
  const expectedSources = [...manifest.sources].map(({ id, releaseId, name, authority, homepageUrl }) => ({ id, releaseId, name, authority, homepageUrl })).sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  const actualSources = sources.rows.map((source) => ({ id: source.id, releaseId: source.release_id, name: source.name, authority: source.authority, homepageUrl: source.homepage_url }));
  if (!sameJson(actualSources, expectedSources)) throw new Error("Existing candidate sources do not exactly match manifest");

  const snapshots = await client.query("SELECT id,release_id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status FROM source_snapshots WHERE release_id=$1 ORDER BY id", [manifest.release.id]);
  const expectedSnapshots = [...manifest.snapshots].map((snapshot) => ({
    ...snapshot,
    publishedAt: snapshot.publishedAt === null ? null : isoTimestamp(snapshot.publishedAt),
    retrievedAt: isoTimestamp(snapshot.retrievedAt),
  })).sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  const actualSnapshots = snapshots.rows.map((snapshot) => ({
    id: snapshot.id, releaseId: snapshot.release_id, sourceId: snapshot.source_id, sourceUrl: snapshot.source_url,
    publishedAt: snapshot.published_at === null ? null : isoTimestamp(snapshot.published_at), retrievedAt: isoTimestamp(snapshot.retrieved_at),
    checksumSha256: snapshot.checksum_sha256, parserVersion: snapshot.parser_version, license: snapshot.license, usageStatus: snapshot.usage_status,
  }));
  if (!sameJson(actualSnapshots, expectedSnapshots)) throw new Error("Existing candidate source snapshots do not exactly match manifest");

  // The candidate shell may contain only preregistered source inventory and
  // operational ingestion evidence. Publishable release content must be empty.
  const operationalTables = ["data_releases", "sources", "source_snapshots", "ingest_runs", "stg_identity", "stg_tiger", "stg_acs", "stg_fec", "stg_elections", "quarantined_records"];
  const residueTables = await client.query<{ table_name: string }>("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='release_id' AND NOT (table_name = ANY($1::text[]))", [operationalTables]);
  for (const { table_name } of residueTables.rows) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table_name)) throw new Error("Unsafe release-scoped table name");
    const residue = await client.query(`SELECT 1 FROM \"${table_name}\" WHERE release_id=$1 LIMIT 1`, [manifest.release.id]);
    if (residue.rowCount) throw new Error(`Adoption requires no prior catalog/content residue (${table_name})`);
  }
}

/** Validates and atomically persists one complete candidate release. */
async function seedNormalizedManifest(
  connection: Pool | PoolClient,
  manifest: PrototypeManifest | NationwideManifest,
  bundle: BoundaryBundle,
  catalogSeatCycleIds: readonly string[],
  persistV2?: (client: Queryable, releaseId: string) => Promise<void>,
  mode: NormalizedSeedMode = "create",
): Promise<void> {
  // Compile immediately before persistence; a pre-mapped geometry cannot attest raw artifact identity.
  const boundaryByGeography = compileBoundaryBundle(manifest as PrototypeManifest, bundle);

  await inTransaction(connection, async (client) => {
    const release = manifest.release;
    if (mode === "adopt-existing-candidate") await verifyAdoptableCandidate(client, manifest as NationwideManifest);
    else {
      await client.query(
        "INSERT INTO data_releases (id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [release.id, release.label, release.status, release.sourceCutoff, release.createdAt, release.publishedAt, release.previousReleaseId],
      );
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [release.id]);
    }
    // Geometry identity is derived only from PostGIS's normalized EWKB, never
    // from caller supplied geometry or hashes.

    if (mode === "create") {
      for (const row of manifest.sources) {
        await client.query("INSERT INTO sources (release_id,id,name,authority,homepage_url) VALUES ($1,$2,$3,$4,$5)", [row.releaseId, row.id, row.name, row.authority, row.homepageUrl]);
      }
      for (const row of manifest.snapshots) {
        await client.query("INSERT INTO source_snapshots (release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [row.releaseId, row.id, row.sourceId, row.sourceUrl, row.publishedAt, row.retrievedAt, row.checksumSha256, row.parserVersion, row.license, row.usageStatus]);
      }
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
    for (const [index, seatCycleId] of catalogSeatCycleIds.entries()) {
      await client.query("INSERT INTO release_profile_seats (release_id,seat_cycle_id,position) VALUES ($1,$2,$3)", [release.id, seatCycleId, index + 1]);
    }
    await persistV2?.(client, release.id);
    const geometryRows = await client.query<{ id: string; boundary_checksum_sha256: string }>("SELECT id,boundary_checksum_sha256 FROM geography_versions WHERE release_id=$1 ORDER BY id", [release.id]);
    const geometry = geometryChecksum(geometryRows.rows.map((row) => ({ id: row.id, checksum: row.boundary_checksum_sha256 })));
    await client.query("INSERT INTO release_manifests (release_id,schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256) VALUES ($1,$2,$3,$4,$5)", [release.id, manifest.schemaVersion, manifest.canonicalDataChecksumSha256, geometry, contentChecksum(manifest.canonicalDataChecksumSha256, geometry)]);
  });
}

async function insertRows(client: Queryable, table: string, columns: readonly string[], values: unknown[]): Promise<void> {
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
  await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`, values);
}

/** Validates and atomically persists the complete v2 nationwide projection. */
async function seedNationwideCandidateManifestWithMode(connection: Pool | PoolClient, input: NationwideManifest, boundaryBundle: BoundaryBundle, mode: NormalizedSeedMode): Promise<void> {
  const validation = validateReleaseManifest(input);
  if (!validation.success || validation.data.schemaVersion !== 2) throw validationError("Cannot seed invalid nationwide manifest", validation.success ? [] : validation.issues);
  const manifest = validation.data;
  if (manifest.release.status !== "candidate") throw new Error("Only candidate releases may be seeded");
  if (computeCanonicalDataChecksum(manifest) !== manifest.canonicalDataChecksumSha256) throw new Error("Canonical data checksum does not exactly match manifest content");
  await seedNormalizedManifest(connection, manifest, boundaryBundle, manifest.catalogSeatCycleIds, async (client, releaseId) => {
    for (const r of manifest.jurisdictions) await insertRows(client,"jurisdictions",["release_id","jurisdiction_code","house_representation","senate_representation"],[releaseId,r.jurisdictionCode,r.houseRepresentation,r.senateRepresentation]);
    for (const r of manifest.coverageRecords) { const s=r.scope, scopeKey=canonicalCoverageScopeKey(s); const key=[s.kind,s.kind==="jurisdiction"||s.kind==="election"?s.jurisdictionCode:null,s.kind==="seat_cycle"||s.kind==="funding"?s.seatCycleId:null,s.kind==="acs_indicator"?s.variable:null,s.kind==="acs_indicator"?s.surveyPeriod:null,s.kind==="election"?s.electionYear:null,s.kind==="funding"?s.fundingKind:null]; const cols=["release_id","domain","scope_key","scope_kind","jurisdiction_code","seat_cycle_id","variable","survey_period","election_year","funding_kind","status","expected_count","observed_count","quarantined_count","incompatible_count"]; const vals=[releaseId,r.domain,scopeKey,...key,r.status,r.expectedCount,r.observedCount,r.quarantinedCount,r.incompatibleCount]; await insertRows(client,"coverage_records",cols,vals); for(const m of r.missingByReason) await insertRows(client,"coverage_missing_reasons",["release_id","domain","scope_key","reason","count"],[releaseId,r.domain,scopeKey,m.reason,m.count]); for(const id of r.inputSnapshotIds) await insertRows(client,"coverage_input_snapshots",["release_id","domain","scope_key","snapshot_id"],[releaseId,r.domain,scopeKey,id]); }
    for(const r of manifest.biographicalFacts){const v=textFactColumns(r.value);await insertRows(client,"biographical_facts",["release_id","person_id","fact","value","value_missing_reason","effective_at"],[releaseId,r.personId,r.fact,...v,r.effectiveAt]);for(const p of r.provenance)await insertRows(client,"biographical_fact_provenance",["release_id","person_id","fact","effective_at","snapshot_id","role"],[releaseId,r.personId,r.fact,r.effectiveAt,p.snapshotId,p.role]);}
    for(const r of manifest.committeeAssignments){await insertRows(client,"committee_assignments",["release_id","person_id","committee_id","role","effective_from","effective_to"],[releaseId,r.personId,r.committeeId,r.role,r.effectiveFrom,r.effectiveTo]);for(const p of r.provenance)await insertRows(client,"committee_assignment_provenance",["release_id","person_id","committee_id","role_name","effective_from","snapshot_id","provenance_role"],[releaseId,r.personId,r.committeeId,r.role,r.effectiveFrom,p.snapshotId,p.role]);}
    for(const r of manifest.acsVariables){await insertRows(client,"acs_variables",["release_id","id","variable","label","unit","survey_period","universe","definition_kind","census_variable","published_moe_method","derivation_formula_version","moe_propagation_method"],[releaseId,r.id,r.variable,r.label,r.unit,r.surveyPeriod,r.universe,r.definitionKind,r.definitionKind==="source"?r.censusVariable:null,r.definitionKind==="source"?r.publishedMoeMethod:null,r.definitionKind==="derived_ratio"?r.derivationFormulaVersion:null,r.definitionKind==="derived_ratio"?r.moePropagationMethod:null]);for(const id of r.inputSnapshotIds)await insertRows(client,"acs_variable_inputs",["release_id","acs_variable_id","snapshot_id"],[releaseId,r.id,id]);if(r.definitionKind==="derived_ratio")for(const [k,id] of [["numerator",r.numeratorDefinitionId],["denominator",r.denominatorDefinitionId]] as const)await insertRows(client,"acs_variable_dependencies",["release_id","acs_variable_id","dependency_kind","dependency_variable_id"],[releaseId,r.id,k,id]);}
    for(const r of manifest.financeAggregates){const a=factColumns(r.cashOnHand),b=factColumns(r.receipts),c=factColumns(r.disbursements);await insertRows(client,"finance_aggregates",["release_id","id","seat_cycle_id","as_of","coverage_through","reporting_period_start","cash_on_hand","cash_on_hand_missing_reason","receipts","receipts_missing_reason","disbursements","disbursements_missing_reason","methodology_version"],[releaseId,r.id,r.seatCycleId,r.asOf,r.coverageThrough,r.reportingPeriodStart,...a,...b,...c,r.methodologyVersion]);for(const i of r.committeeInputs)await insertRows(client,"finance_aggregate_inputs",["release_id","finance_aggregate_id","committee_id","filing_id","missing_reason"],[releaseId,r.id,i.committeeId,i.kind==="included"?i.filingId:null,i.kind==="missing"?i.reason:null]);}
    const funding = async (table:string, r:{ id?: string; seatCycleId: string; category?: string; coverageThrough: string; methodologyVersion: string }, columns:string[], values:unknown[], inputs:readonly string[])=>{await insertRows(client,table,columns,values);for(const id of inputs)await insertRows(client,table==="funding_category_aggregates"?"funding_category_input_snapshots":table==="funding_organization_aggregates"?"funding_organization_input_snapshots":"outside_spending_input_snapshots",table==="funding_category_aggregates"?["release_id","seat_cycle_id","category","coverage_through","methodology_version","snapshot_id"]:table==="funding_organization_aggregates"?["release_id","aggregate_id","snapshot_id"]:["release_id","seat_cycle_id","coverage_through","methodology_version","snapshot_id"],table==="funding_category_aggregates"?[releaseId,r.seatCycleId,r.category,r.coverageThrough,r.methodologyVersion,id]:table==="funding_organization_aggregates"?[releaseId,r.id,id]:[releaseId,r.seatCycleId,r.coverageThrough,r.methodologyVersion,id]);};
    for(const r of manifest.fundingCategoryAggregates){const v=factColumns(r.amount);await funding("funding_category_aggregates",r,["release_id","seat_cycle_id","category","amount","amount_missing_reason","coverage_through","methodology_version"],[releaseId,r.seatCycleId,r.category,...v,r.coverageThrough,r.methodologyVersion],r.inputSnapshotIds);} for(const r of manifest.fundingOrganizationAggregates){const v=factColumns(r.amount);await funding("funding_organization_aggregates",r,["release_id","id","seat_cycle_id","organization_name","organization_external_id","amount","amount_missing_reason","coverage_through","methodology_version"],[releaseId,r.id,r.seatCycleId,r.organizationName,r.organizationExternalId,...v,r.coverageThrough,r.methodologyVersion],r.inputSnapshotIds);} for(const r of manifest.outsideSpendingAggregates){const a=factColumns(r.supportAmount),b=factColumns(r.opposeAmount);await funding("outside_spending_aggregates",r,["release_id","seat_cycle_id","support_amount","support_amount_missing_reason","oppose_amount","oppose_amount_missing_reason","coverage_through","methodology_version"],[releaseId,r.seatCycleId,...a,...b,r.coverageThrough,r.methodologyVersion],r.inputSnapshotIds);}
    for(const r of manifest.electionDecisions){await insertRows(client,"election_decisions",["release_id","id","jurisdiction_code","election_year","status"],[releaseId,r.id,r.jurisdictionCode,r.electionYear,r.status]);for(const id of r.inputSnapshotIds)await insertRows(client,"election_decision_inputs",["release_id","election_decision_id","snapshot_id"],[releaseId,r.id,id]);} for(const r of manifest.mapArtifacts){await insertRows(client,"map_artifacts",["release_id","id","geography_version_id","artifact_id"],[releaseId,r.id,r.geographyVersionId,r.artifactId]);for(const id of r.inputSnapshotIds)await insertRows(client,"map_artifact_inputs",["release_id","map_artifact_id","snapshot_id"],[releaseId,r.id,id]);} for(const r of manifest.snapshotDerivations){await insertRows(client,"snapshot_derivations",["release_id","output_snapshot_id","methodology_version"],[releaseId,r.outputSnapshotId,r.methodologyVersion]);for(const id of r.inputSnapshotIds)await insertRows(client,"snapshot_derivation_inputs",["release_id","output_snapshot_id","input_snapshot_id"],[releaseId,r.outputSnapshotId,id]);}
    for (const row of manifest.fecV2ExactElectionAggregates ?? []) {
      await insertRows(client, "fec_v2_exact_election_aggregates", ["release_id", "plan_sha256", "seat_cycle_id", "candidate_mapping_id", "election_mapping_id", "closure_id", "support_cents", "oppose_cents", "methodology", "coverage_through"], [releaseId, row.acquisitionPlanSha256, row.seatCycleId, row.candidateMappingId, row.electionMappingId, row.closureId, row.supportCents, row.opposeCents, row.methodology, row.coverageThrough]);
    }
    const plans = await client.query<{ plan_sha256: string }>("SELECT plan_sha256 FROM fec_v2_plans WHERE release_id=$1", [releaseId]);
    const outcomes = manifest.fecV2AcquisitionOutcomes;
    const hasOutcomes = Object.prototype.hasOwnProperty.call(manifest, "fecV2AcquisitionOutcomes");
    if (plans.rows.length > 0 && !hasOutcomes) throw new Error("FEC V2 plan requires an acquisition outcomes field");
    if (plans.rows.length === 0 && hasOutcomes) throw new Error("FEC V2 acquisition outcomes require exactly one persisted plan");
    if (hasOutcomes) {
      if (plans.rows.length !== 1 || !outcomes) throw new Error("FEC V2 acquisition outcomes require exactly one persisted plan");
      for (const row of outcomes) {
        const parent = await client.query<{ ledger_sha256: string }>("SELECT ledger_sha256 FROM fec_v2_filing_ledger_entries WHERE release_id=$1 AND plan_sha256=$2 AND file_number=$3 AND entry_identity_sha256=$4", [releaseId, plans.rows[0]!.plan_sha256, BigInt(row.fileNumber), row.entryIdentitySha256]);
        if (parent.rowCount !== 1) throw new Error("FEC V2 acquisition outcome has no exact ledger parent");
        await insertRows(client, "fec_v2_acquisition_outcomes", ["release_id", "plan_sha256", "ledger_sha256", "file_number", "entry_identity_sha256", "outcome"], [releaseId, plans.rows[0]!.plan_sha256, parent.rows[0]!.ledger_sha256, BigInt(row.fileNumber), row.entryIdentitySha256, row.outcome]);
      }
    }
  }, mode);
}

/** Validates and atomically persists the complete v2 nationwide projection. */
export async function seedNationwideCandidateManifest(pool: Pool, input: NationwideManifest, boundaryBundle: BoundaryBundle): Promise<void> {
  await seedNationwideCandidateManifestWithMode(pool, input, boundaryBundle, "create");
}

/** Persists a v2 manifest into a caller-owned transaction and preregistered candidate release. */
export async function adoptNationwideCandidateManifest(client: PoolClient, input: NationwideManifest, boundaryBundle: BoundaryBundle): Promise<void> {
  await seedNationwideCandidateManifestWithMode(client, input, boundaryBundle, "adopt-existing-candidate");
}

/** Validates and atomically persists one complete v1 candidate release. */
export async function seedPrototypeManifest(connection: Pool, input: PrototypeManifest, bundle: BoundaryBundle): Promise<void> {
  const validation = validatePrototypeManifest(input);
  if (!validation.success) throw validationError("Cannot seed invalid prototype manifest", validation.issues);
  if (validation.data.release.status !== "candidate") throw new Error("Only candidate releases may be seeded");
  if (computeCanonicalDataChecksum(validation.data) !== validation.data.canonicalDataChecksumSha256) throw new Error("Canonical data checksum does not exactly match manifest content");
  await seedNormalizedManifest(connection, validation.data, bundle, validation.data.profileSeatCycleIds);
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
function textFact(value: unknown, reason: unknown): FactValue<string> {
  return value === null ? { kind: "missing", reason: String(reason) as MissingReason } : { kind: "value", value: String(value) };
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

    // v2 reuses the inherited relational projection; parse that projection with
    // the v1 shape only (its checksum/catalog policy is deliberately not applied).
    const parsed = prototypeManifestSchema.safeParse(metadata.schema_version === 2
      ? { ...candidate, schemaVersion: 1, profileSeatCycleIds: candidate.profileSeatCycleIds.slice(0, 12) }
      : candidate);
    if (!parsed.success) throw new Error(`Stored release ${releaseId} cannot be parsed as a prototype manifest: ${parsed.error.message}`);
    if (metadata.schema_version === 2) return parsed.data;
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

/** Reconstructs a v2 manifest, including every normalized edge, and revalidates it. */
async function assembleNationwideManifest(
  connection: Pool | PoolClient,
  releaseId: string,
  recomputeCanonicalChecksum: boolean,
): Promise<{ readonly manifest: NationwideManifest; readonly storedCanonicalDataChecksumSha256: string }> {
  const base = await loadPrototypeManifest(connection, releaseId);
  const client = connection as Queryable;
  const get = (table: string, order = "1") => rows(client, table, releaseId, order);
  const metadata = (await client.query("SELECT * FROM release_manifests WHERE release_id=$1", [releaseId])).rows[0];
  const catalog = await get("release_profile_seats", "position");
  const jurisdictions = await get("jurisdictions", "jurisdiction_code");
  const coverage = await get("coverage_records");
  const coverageMissing = await get("coverage_missing_reasons");
  const coverageInputs = await get("coverage_input_snapshots");
  const bios = await get("biographical_facts");
  const bioProv = await get("biographical_fact_provenance");
  const assignments = await get("committee_assignments");
  const assignmentProv = await get("committee_assignment_provenance");
  const variables = await get("acs_variables", "id");
  const variableInputs = await get("acs_variable_inputs");
  const dependencies = await get("acs_variable_dependencies");
  const finance = await get("finance_aggregates", "id");
  const financeInputs = await get("finance_aggregate_inputs");
  const categories = await get("funding_category_aggregates");
  const categoryInputs = await get("funding_category_input_snapshots");
  const organizations = await get("funding_organization_aggregates", "id");
  const organizationInputs = await get("funding_organization_input_snapshots");
  const outside = await get("outside_spending_aggregates");
  const outsideInputs = await get("outside_spending_input_snapshots");
  const decisions = await get("election_decisions", "id");
  const decisionInputs = await get("election_decision_inputs");
  const maps = await get("map_artifacts", "id");
  const mapInputs = await get("map_artifact_inputs");
  const derivations = await get("snapshot_derivations");
  const derivationInputs = await get("snapshot_derivation_inputs");
  const exactElectionAggregates = await get("fec_v2_exact_election_aggregates", "plan_sha256, seat_cycle_id, candidate_mapping_id, election_mapping_id");
  const v2Plans = await get("fec_v2_plans", "plan_sha256");
  const acquisitionOutcomes = await client.query("SELECT o.plan_sha256,o.file_number,o.entry_identity_sha256,o.outcome FROM fec_v2_acquisition_outcomes o WHERE o.release_id=$1", [releaseId]);
  if (!metadata || metadata.schema_version !== 2) throw new Error(`Release ${releaseId} is not a v2 manifest`);
  const grouped = (rs: QueryResultRow[], key: (r: QueryResultRow) => string) => indexReferences(rs, key);
  const biosBy = grouped(bioProv, r => `${r.person_id}:${r.fact}:${isoDate(r.effective_at)}`), assignmentsBy = grouped(assignmentProv.map(r => ({ ...r, role: r.provenance_role })), r => `${r.person_id}:${r.committee_id}:${r.role_name}:${isoDate(r.effective_from)}`);
  const inputs = (rs: QueryResultRow[], key: (r: QueryResultRow) => string) => { const out = new Map<string,string[]>(); for(const r of rs){const k=key(r);out.set(k,[...(out.get(k)??[]),String(r.snapshot_id ?? r.input_snapshot_id)]);} return out; };
  const cInputs=inputs(coverageInputs,r=>`${r.domain}:${r.scope_key}`), vInputs=inputs(variableInputs,r=>String(r.acs_variable_id)), catInputs=inputs(categoryInputs,r=>`${r.seat_cycle_id}:${r.category}:${isoDate(r.coverage_through)}:${r.methodology_version}`), orgInputs=inputs(organizationInputs,r=>String(r.aggregate_id)), outInputs=inputs(outsideInputs,r=>`${r.seat_cycle_id}:${isoDate(r.coverage_through)}:${r.methodology_version}`), decInputs=inputs(decisionInputs,r=>String(r.election_decision_id)), mapInputsBy=inputs(mapInputs,r=>String(r.map_artifact_id)), derivInputs=inputs(derivationInputs,r=>String(r.output_snapshot_id));
  const coverageKey=(r:QueryResultRow)=>`${r.domain}:${r.scope_key}`;
  delete (base as { profileSeatCycleIds?: unknown }).profileSeatCycleIds;
  const scopeFromRow = (r: QueryResultRow): CoverageScope => (r.scope_kind === "release" ? { kind: "release" } : r.scope_kind === "jurisdiction" ? { kind: "jurisdiction", jurisdictionCode: r.jurisdiction_code } : r.scope_kind === "seat_cycle" ? { kind: "seat_cycle", seatCycleId: r.seat_cycle_id } : r.scope_kind === "acs_indicator" ? { kind: "acs_indicator", variable: r.variable, surveyPeriod: r.survey_period } : r.scope_kind === "election" ? { kind: "election", jurisdictionCode: r.jurisdiction_code, electionYear: r.election_year } : { kind: "funding", seatCycleId: r.seat_cycle_id, fundingKind: r.funding_kind }) as CoverageScope;
  for (const row of coverage) if (row.scope_key !== canonicalCoverageScopeKey(scopeFromRow(row))) throw new Error(`Stored release ${releaseId} coverage scope key mismatch`);
  const candidate: unknown = { ...base, schemaVersion: 2, canonicalDataChecksumSha256: metadata.canonical_data_checksum_sha256, catalogSeatCycleIds: catalog.map(r=>r.seat_cycle_id), jurisdictions: jurisdictions.map(r=>({jurisdictionCode:r.jurisdiction_code,houseRepresentation:r.house_representation,senateRepresentation:r.senate_representation})), coverageRecords: coverage.map(r=>{const k=coverageKey(r);const scope=r.scope_kind==="release"?{kind:"release"}:r.scope_kind==="jurisdiction"?{kind:"jurisdiction",jurisdictionCode:r.jurisdiction_code}:r.scope_kind==="seat_cycle"?{kind:"seat_cycle",seatCycleId:r.seat_cycle_id}:r.scope_kind==="acs_indicator"?{kind:"acs_indicator",variable:r.variable,surveyPeriod:r.survey_period}:r.scope_kind==="election"?{kind:"election",jurisdictionCode:r.jurisdiction_code,electionYear:r.election_year}:{kind:"funding",seatCycleId:r.seat_cycle_id,fundingKind:r.funding_kind};return {releaseId,domain:r.domain,scope,status:r.status,expectedCount:r.expected_count,observedCount:r.observed_count,quarantinedCount:r.quarantined_count,incompatibleCount:r.incompatible_count,missingByReason:coverageMissing.filter(x=>coverageKey(x)===k).map(x=>({reason:x.reason,count:x.count})),inputSnapshotIds:cInputs.get(k)??[]};}), biographicalFacts:bios.map(r=>({releaseId,personId:r.person_id,fact:r.fact,value:fact(r.value,r.value_missing_reason),effectiveAt:isoDate(r.effective_at),provenance:biosBy.get(`${r.person_id}:${r.fact}:${isoDate(r.effective_at)}`)??[]})), committeeAssignments:assignments.map(r=>({releaseId,personId:r.person_id,committeeId:r.committee_id,role:r.role,effectiveFrom:isoDate(r.effective_from),effectiveTo:isoDate(r.effective_to),provenance:assignmentsBy.get(`${r.person_id}:${r.committee_id}:${r.role}:${isoDate(r.effective_from)}`)??[]})), acsVariables:variables.map(r=>r.definition_kind==="source"?{id:r.id,releaseId,variable:r.variable,label:r.label,unit:r.unit,surveyPeriod:r.survey_period,universe:r.universe,inputSnapshotIds:vInputs.get(r.id)??[],definitionKind:"source",censusVariable:r.census_variable,publishedMoeMethod:r.published_moe_method}:{id:r.id,releaseId,variable:r.variable,label:r.label,unit:r.unit,surveyPeriod:r.survey_period,universe:r.universe,inputSnapshotIds:vInputs.get(r.id)??[],definitionKind:"derived_ratio",numeratorDefinitionId:dependencies.find(x=>x.acs_variable_id===r.id&&x.dependency_kind==="numerator")?.dependency_variable_id,denominatorDefinitionId:dependencies.find(x=>x.acs_variable_id===r.id&&x.dependency_kind==="denominator")?.dependency_variable_id,derivationFormulaVersion:r.derivation_formula_version,moePropagationMethod:r.moe_propagation_method}), financeAggregates:finance.map(r=>({id:r.id,releaseId,seatCycleId:r.seat_cycle_id,asOf:isoDate(r.as_of),coverageThrough:isoDate(r.coverage_through),reportingPeriodStart:isoDate(r.reporting_period_start),cashOnHand:fact(r.cash_on_hand,r.cash_on_hand_missing_reason),receipts:fact(r.receipts,r.receipts_missing_reason),disbursements:fact(r.disbursements,r.disbursements_missing_reason),methodologyVersion:r.methodology_version,committeeInputs:financeInputs.filter(x=>x.finance_aggregate_id===r.id).map(x=>x.filing_id===null?{kind:"missing",committeeId:x.committee_id,reason:x.missing_reason}:{kind:"included",committeeId:x.committee_id,filingId:x.filing_id})})), fundingCategoryAggregates:categories.map(r=>({releaseId,seatCycleId:r.seat_cycle_id,category:r.category,amount:fact(r.amount,r.amount_missing_reason),coverageThrough:isoDate(r.coverage_through),methodologyVersion:r.methodology_version,inputSnapshotIds:catInputs.get(`${r.seat_cycle_id}:${r.category}:${isoDate(r.coverage_through)}:${r.methodology_version}`)??[]})), fundingOrganizationAggregates:organizations.map(r=>({id:r.id,releaseId,seatCycleId:r.seat_cycle_id,organizationName:r.organization_name,organizationExternalId:r.organization_external_id,amount:fact(r.amount,r.amount_missing_reason),coverageThrough:isoDate(r.coverage_through),methodologyVersion:r.methodology_version,inputSnapshotIds:orgInputs.get(r.id)??[]})), outsideSpendingAggregates:outside.map(r=>({releaseId,seatCycleId:r.seat_cycle_id,supportAmount:fact(r.support_amount,r.support_amount_missing_reason),opposeAmount:fact(r.oppose_amount,r.oppose_amount_missing_reason),coverageThrough:isoDate(r.coverage_through),methodologyVersion:r.methodology_version,inputSnapshotIds:outInputs.get(`${r.seat_cycle_id}:${isoDate(r.coverage_through)}:${r.methodology_version}`)??[]})), electionDecisions:decisions.map(r=>({id:r.id,releaseId,jurisdictionCode:r.jurisdiction_code,electionYear:r.election_year,status:r.status,inputSnapshotIds:decInputs.get(r.id)??[]})), mapArtifacts:maps.map(r=>({id:r.id,releaseId,geographyVersionId:r.geography_version_id,artifactId:r.artifact_id,inputSnapshotIds:mapInputsBy.get(r.id)??[]})), snapshotDerivations:derivations.map(r=>({releaseId,outputSnapshotId:r.output_snapshot_id,methodologyVersion:r.methodology_version,inputSnapshotIds:derivInputs.get(r.output_snapshot_id)??[]})) };
  if (exactElectionAggregates.length > 0) (candidate as Record<string, unknown>).fecV2ExactElectionAggregates = exactElectionAggregates.map((row) => ({ releaseId, acquisitionPlanSha256: row.plan_sha256, seatCycleId: row.seat_cycle_id, candidateMappingId: row.candidate_mapping_id, electionMappingId: row.election_mapping_id, closureId: row.closure_id, supportCents: String(row.support_cents), opposeCents: String(row.oppose_cents), methodology: row.methodology, coverageThrough: isoDate(row.coverage_through) }));
  if (v2Plans.length > 0) (candidate as Record<string, unknown>).fecV2AcquisitionOutcomes = acquisitionOutcomes.rows.map((row) => {
    const fileNumber = Number(row.file_number);
    if (!Number.isSafeInteger(fileNumber) || fileNumber < 1) throw new Error(`Stored release ${releaseId} has an unsafe FEC V2 acquisition outcome file number`);
    return { fileNumber, entryIdentitySha256: row.entry_identity_sha256, outcome: row.outcome };
  }).sort((left, right) => left.fileNumber - right.fileNumber || Buffer.compare(Buffer.from(left.entryIdentitySha256), Buffer.from(right.entryIdentitySha256)));
  const biographyRows = candidate as { biographicalFacts: Array<{ value: FactValue<string> }> };
  biographyRows.biographicalFacts.forEach((row, index) => { row.value = textFact(bios[index]!.value, bios[index]!.value_missing_reason); });
  const parsed = nationwideManifestSchema.safeParse(candidate); if(!parsed.success) throw new Error(`Stored release ${releaseId} cannot be parsed as a nationwide manifest: ${parsed.error.message}`);
  const typed = recomputeCanonicalChecksum
    ? { ...parsed.data, canonicalDataChecksumSha256: computeCanonicalDataChecksum(parsed.data) }
    : parsed.data;
  const validation=validateReleaseManifest(typed); if(!validation.success) throw validationError(`Stored release ${releaseId} is not semantically valid`,validation.issues); if(!recomputeCanonicalChecksum && computeCanonicalDataChecksum(validation.data)!==metadata.canonical_data_checksum_sha256) throw new Error(`Stored release ${releaseId} canonical data checksum mismatch`); return { manifest: validation.data as NationwideManifest, storedCanonicalDataChecksumSha256: metadata.canonical_data_checksum_sha256 };
}

/** Reconstructs and validates the exact stored v2 manifest. */
export async function loadNationwideManifest(connection: Pool | PoolClient, releaseId: string): Promise<NationwideManifest> {
  return (await assembleNationwideManifest(connection, releaseId, false)).manifest;
}

/** Reconstructs staged v2 candidate content for ACS finalization while retaining its stored baseline checksum. */
export async function loadNationwideManifestForFinalization(connection: Pool | PoolClient, releaseId: string): Promise<{ readonly manifest: NationwideManifest; readonly storedCanonicalDataChecksumSha256: string }> {
  return assembleNationwideManifest(connection, releaseId, true);
}

// Explicit candidate-oriented name for callers that prefer release lifecycle terminology.
export const seedCandidateManifest = seedPrototypeManifest;
