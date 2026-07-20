import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  assertPersistedTask6MemberInvariant,
  recheckNationwideValidationGate,
  recheckNationwideValidationGateShared,
  validateNationwideCandidateReleaseWithClient,
} from "@/db/catalog-release";
import { expectedContentChecksum } from "@/db/catalog-release";
import { canonicalCoverageScopeKey, loadNationwideManifestForFinalization } from "@/db/manifest";
import type { NationwideManifest } from "@/domain/manifest";
import { markLoaded } from "@/db/ingestion";
import {
  geographyVersionIdSchema,
  releaseIdSchema,
  snapshotIdSchema,
  type FactValue,
  type MissingReason,
} from "@/domain/contracts";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";
import type { RawObjectResult, RawObjectStore } from "@/ingestion/core/raw-object-store";
import { ACS_ADAPTER_VERSION, decodeAcsStagedExtras, type AcsStagedExtrasV1 } from "./adapter";
import { ACS_INDICATOR_DICTIONARY, type AcsIndicatorDefinition } from "./indicator-dictionary";
import { parseAcsSummaryTableIncrementally } from "./table-parser";

export interface FinalizeCandidateAcsOptions {
  readonly pool: Pool;
  readonly rawStore: RawObjectStore;
  readonly candidateReleaseId: string;
  readonly sourceReleaseId: string;
  readonly runIds: readonly [string, string, string];
  readonly sourceLockSha256: string;
  /** Exact ACS entries from the verified source lock, never caller-selected receipts. */
  readonly sourceLockEntries: readonly AcsFinalizationLockEntry[];
  readonly signal?: AbortSignal;
}
export interface AcsFinalizationLockEntry {
  readonly id: AcsIndicatorDefinition["lockId"];
  readonly url: string;
  readonly sha256: string;
  readonly byteSize: number;
}

type Runner = Pool | PoolClient;
type LockMode = "FOR UPDATE" | "FOR SHARE";
type Run = QueryResultRow & {
  id: string; release_id: string; source_id: string; snapshot_id: string; adapter_version: string; upstream_release: string;
  raw_store_kind: "local" | "s3"; raw_store_locator: string; raw_object_key: string;
  raw_object_sha256: string; raw_object_byte_size: unknown; raw_object_version_id: string | null;
  raw_object_etag: string | null; lease_token: string; status: string; extracted_count: unknown;
  staged_count: unknown; quarantined_count: unknown; source_name: string; source_authority: string; source_homepage_url: string; source_url: string;
  checksum_sha256: string; parser_version: string; published_at: Date | string | null; retrieved_at: Date | string; license: string; usage_status: string; source_cutoff: Date | string;
};
type Stage = QueryResultRow & {
  source_natural_key: string; snapshot_id: string; geography: string; variable: string;
  survey_period: string; estimate: string | null; margin_of_error: string | null; unit: string;
  redacted_extras: unknown;
};

const ACS_MISSING_GEOIDS = new Set(["6098", "6698", "6998", "7898"]);
const missingReasons = new Set<MissingReason>([
  "not_applicable", "not_collected", "not_reported", "not_yet_reported", "suppressed", "unmatched",
  "source_unavailable", "license_unavailable", "not_defensibly_modeled",
]);

function fail(code: string): never { throw new Error(code); }
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function count(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 0) fail("ACS_FINALIZE_INVALID_COUNT");
  return number;
}
function bytewise(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function timestampAtOrAfter(value: Date | string, minimum: Date | string): boolean {
  const actual = new Date(value).getTime(), cutoff = new Date(minimum).getTime();
  return Number.isFinite(actual) && Number.isFinite(cutoff) && actual >= cutoff;
}
const publishedMoeMethod = "published" as const;
function assertInput(options: FinalizeCandidateAcsOptions): void {
  if (!options.candidateReleaseId || !options.sourceReleaseId || options.candidateReleaseId === options.sourceReleaseId
    || new Set(options.runIds).size !== 3 || options.runIds.some((id) => !id)
    || !/^[a-f0-9]{64}$/.test(options.sourceLockSha256)
    || options.sourceLockEntries.length !== 3) fail("ACS_FINALIZE_INPUT_INVALID");
  for (const definition of ACS_INDICATOR_DICTIONARY) {
    const entry = options.sourceLockEntries.find((value) => value.id === definition.lockId);
    if (!entry || entry.url !== definition.sourceUrl || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0) fail("ACS_FINALIZE_INPUT_INVALID");
  }
  if (new Set(options.sourceLockEntries.map((entry) => entry.id)).size !== 3) fail("ACS_FINALIZE_INPUT_INVALID");
}
function assertNotAborted(signal?: AbortSignal): void { if (signal?.aborted) fail("ACS_FINALIZE_ABORTED"); }
function receipt(run: Run): RawObjectResult {
  return {
    storeKind: run.raw_store_kind, storeLocator: run.raw_store_locator, objectKey: run.raw_object_key,
    sha256: run.raw_object_sha256, byteSize: count(run.raw_object_byte_size),
    ...(run.raw_object_version_id === null ? {} : { versionId: run.raw_object_version_id }),
    ...(run.raw_object_etag === null ? {} : { etag: run.raw_object_etag }),
  };
}

async function loadRuns(client: PoolClient, options: FinalizeCandidateAcsOptions, lock: LockMode): Promise<Run[]> {
  const result = await client.query<Run>(`SELECT ir.*, s.name source_name, s.authority source_authority, s.homepage_url source_homepage_url, ss.source_url, ss.checksum_sha256,
    ss.parser_version, ss.published_at, ss.retrieved_at, ss.license, ss.usage_status, r.source_cutoff FROM ingest_runs ir JOIN data_releases r ON r.id=ir.release_id JOIN sources s ON s.release_id=ir.release_id AND s.id=ir.source_id
    JOIN source_snapshots ss ON ss.release_id=ir.release_id AND ss.id=ir.snapshot_id
    WHERE ir.release_id=$1 AND ir.id=ANY($2) ${lock}`, [options.candidateReleaseId, options.runIds]);
  if (result.rowCount !== 3) fail("ACS_FINALIZE_RUN_INVALID");
  return [...result.rows].sort((a, b) => bytewise(a.id, b.id));
}
function definitionForRun(run: Run, options: FinalizeCandidateAcsOptions): AcsIndicatorDefinition {
  const definition = ACS_INDICATOR_DICTIONARY.find((candidate) => candidate.sourceUrl === run.source_url);
  const entry = definition && options.sourceLockEntries.find((candidate) => candidate.id === definition.lockId);
  const expectedSnapshotId = entry && `snap_acs_v2_acs_2024_5yr_${entry.id}_${entry.sha256.slice(0, 48)}`;
  if (!definition || run.source_id !== "src_acs_2024" || run.source_name !== "acs" || run.source_authority !== "official" || run.source_homepage_url !== "https://www.census.gov/programs-surveys/acs.html" || run.upstream_release !== "acs-2024-5yr" || run.checksum_sha256 !== run.raw_object_sha256
    || !entry || run.source_url !== entry.url || run.raw_object_sha256 !== entry.sha256 || count(run.raw_object_byte_size) !== entry.byteSize
    || run.snapshot_id !== expectedSnapshotId || run.adapter_version !== ACS_ADAPTER_VERSION || run.parser_version !== ACS_ADAPTER_VERSION || run.published_at !== null || !run.retrieved_at || !timestampAtOrAfter(run.retrieved_at, run.source_cutoff) || run.license !== "public-domain" || run.usage_status !== "approved"
    || count(run.extracted_count) !== count(run.staged_count) || count(run.quarantined_count) !== 0) fail("ACS_FINALIZE_RUN_INVALID");
  return definition;
}
function fact(value: string | null, reason: unknown): FactValue<number> {
  if (value !== null) {
    const number = Number(value);
    if (!Number.isFinite(number)) fail("ACS_FINALIZE_STAGE_INVALID");
    return { kind: "value", value: number };
  }
  if (typeof reason !== "string" || !missingReasons.has(reason as MissingReason)) fail("ACS_FINALIZE_STAGE_INVALID");
  return { kind: "missing", reason: reason as MissingReason };
}
function releaseId(value: string) { const parsed = releaseIdSchema.safeParse(value); if (!parsed.success) fail("ACS_FINALIZE_MANIFEST_INVALID"); return parsed.data; }
function snapshotId(value: string) { const parsed = snapshotIdSchema.safeParse(value); if (!parsed.success) fail("ACS_FINALIZE_MANIFEST_INVALID"); return parsed.data; }
function geographyId(value: string) { const parsed = geographyVersionIdSchema.safeParse(value); if (!parsed.success) fail("ACS_FINALIZE_MANIFEST_INVALID"); return parsed.data; }
function assertExtras(extras: AcsStagedExtrasV1, definition: AcsIndicatorDefinition, lockSha: string): void {
  if (extras.sourceLockSha256 !== lockSha || extras.lockId !== definition.lockId
    || extras.sourceTable !== definition.sourceTable || extras.estimateColumn !== definition.estimateColumn
    || extras.marginOfErrorColumn !== definition.marginOfErrorColumn || extras.label !== definition.label
    || extras.universe !== definition.universe
    || (extras.estimateMissingReason !== null && !missingReasons.has(extras.estimateMissingReason as MissingReason))
    || (extras.marginOfErrorMissingReason !== null && !missingReasons.has(extras.marginOfErrorMissingReason as MissingReason))) fail("ACS_FINALIZE_STAGE_INVALID");
}
async function replayRun(client: PoolClient, run: Run, definition: AcsIndicatorDefinition, options: FinalizeCandidateAcsOptions): Promise<Stage[]> {
  const bytes = await options.rawStore.read(receipt(run), options.signal);
  if (hash(bytes) !== run.raw_object_sha256) fail("ACS_FINALIZE_RAW_MISMATCH");
  const expected = new Map<string, Stage>();
  for await (const event of parseAcsSummaryTableIncrementally(bytes, definition)) {
    if (event.kind === "quarantine") fail("ACS_FINALIZE_QUARANTINE");
    const row = event.row;
    expected.set(row.sourceNaturalKey, {
      source_natural_key: row.sourceNaturalKey, snapshot_id: run.snapshot_id, geography: `${row.stateFips}${row.districtCode}`,
      variable: definition.variableId, survey_period: definition.surveyPeriod,
      estimate: row.estimate.kind === "value" ? String(row.estimate.value) : null,
      margin_of_error: row.marginOfError.kind === "value" ? String(row.marginOfError.value) : null,
      unit: definition.unit,
      redacted_extras: { schemaVersion: 1, sourceLockSha256: options.sourceLockSha256, lockId: definition.lockId,
        sourceTable: definition.sourceTable, estimateColumn: definition.estimateColumn,
        marginOfErrorColumn: definition.marginOfErrorColumn, label: definition.label, universe: definition.universe,
        stateFips: row.stateFips, districtCode: row.districtCode,
        estimateMissingReason: row.estimate.kind === "missing" ? row.estimate.reason : null,
        marginOfErrorMissingReason: row.marginOfError.kind === "missing" ? row.marginOfError.reason : null },
    });
  }
  if (expected.size !== 437) fail("ACS_FINALIZE_STAGE_INVALID");
  const staged = await client.query<Stage>("SELECT source_natural_key,snapshot_id,geography,variable,survey_period,estimate,margin_of_error,unit,redacted_extras FROM stg_acs WHERE run_id=$1 ORDER BY source_natural_key", [run.id]);
  if (staged.rowCount !== 437) fail("ACS_FINALIZE_STAGE_INVALID");
  for (const actual of staged.rows) {
    const wanted = expected.get(actual.source_natural_key);
    let extras: AcsStagedExtrasV1;
    try { extras = decodeAcsStagedExtras(actual.redacted_extras); } catch { fail("ACS_FINALIZE_STAGE_INVALID"); }
    assertExtras(extras, definition, options.sourceLockSha256);
    if (!wanted || actual.snapshot_id !== wanted.snapshot_id || actual.geography !== wanted.geography
      || actual.variable !== wanted.variable || actual.survey_period !== wanted.survey_period || actual.unit !== wanted.unit
      || String(actual.estimate ?? "") !== String(wanted.estimate ?? "")
      || String(actual.margin_of_error ?? "") !== String(wanted.margin_of_error ?? "")
      || extras.estimateMissingReason !== (wanted.redacted_extras as AcsStagedExtrasV1).estimateMissingReason
      || extras.marginOfErrorMissingReason !== (wanted.redacted_extras as AcsStagedExtrasV1).marginOfErrorMissingReason) fail("ACS_FINALIZE_STAGE_INVALID");
  }
  return staged.rows;
}
async function assertGeographyPolicy(client: PoolClient, releaseId: string): Promise<void> {
  const result = await client.query<{ valid: boolean }>(`SELECT
    (SELECT count(*) FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND vintage='2025')=441
    AND (SELECT count(DISTINCT source_geoid) FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND vintage='2025')=441 AS valid`, [releaseId]);
  if (result.rows[0]?.valid !== true) fail("ACS_FINALIZE_GEOGRAPHY_INVALID");
}

/** Exact, query-only Task 7 proof. Accepts a pool or the caller's transaction client. */
export async function assertPersistedTask7AcsInvariant(connection: Runner, releaseId: string, sourceReleaseId: string): Promise<void> {
  if (typeof (connection as PoolClient).release !== "function") {
    const client = await (connection as Pool).connect();
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); await assertPersistedTask7AcsInvariant(client, releaseId, sourceReleaseId); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
    return;
  }
  const client = connection as PoolClient;
  const result = await client.query<{ valid: boolean }>(`WITH expected(id,lock_id,source_url,variable,label,unit,period,universe,census,moe) AS (
      VALUES ${ACS_INDICATOR_DICTIONARY.map((_, index) => `($${index * 10 + 3},$${index * 10 + 4},$${index * 10 + 5},$${index * 10 + 6},$${index * 10 + 7},$${index * 10 + 8},$${index * 10 + 9},$${index * 10 + 10},$${index * 10 + 11},$${index * 10 + 12})`).join(",")}
    ), release_ok AS (SELECT 1 FROM data_releases r JOIN data_releases p ON p.id=r.previous_release_id JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1 AND r.previous_release_id=$2 AND r.status='candidate' AND r.source_cutoff=p.source_cutoff AND m.schema_version=2),
    runs AS (SELECT ir.id AS run_id,ir.snapshot_id,e.lock_id,e.source_url,e.variable,e.label,e.unit,e.period,e.universe,e.census,e.moe FROM ingest_runs ir JOIN data_releases d ON d.id=ir.release_id JOIN source_snapshots ss ON ss.release_id=ir.release_id AND ss.id=ir.snapshot_id JOIN sources s ON s.release_id=ir.release_id AND s.id=ir.source_id JOIN expected e ON e.source_url=ss.source_url WHERE ir.release_id=$1 AND ir.status='loaded' AND ir.upstream_release='acs-2024-5yr' AND s.id='src_acs_2024' AND s.name='acs' AND s.authority='official' AND s.homepage_url='https://www.census.gov/programs-surveys/acs.html' AND ss.usage_status='approved' AND ss.license='public-domain' AND ss.published_at IS NULL AND ss.retrieved_at >= d.source_cutoff AND ss.checksum_sha256=ir.raw_object_sha256 AND ss.parser_version='acs-direct-table-v2' AND ir.adapter_version='acs-direct-table-v2'),
    geos AS (SELECT id,source_geoid FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND vintage='2025'),
    obs AS (SELECT o.*,g.source_geoid FROM acs_observations o JOIN geos g ON g.id=o.geography_version_id WHERE o.release_id=$1),
    checks AS (SELECT
      EXISTS(SELECT 1 FROM release_ok) release_ok,
      (SELECT count(*) FROM geos)=441 AND (SELECT count(DISTINCT source_geoid) FROM geos)=441 geography_ok,
      (SELECT count(*) FROM runs)=3 AND (SELECT count(DISTINCT lock_id) FROM runs)=3 AND (SELECT count(DISTINCT source_url) FROM runs)=3 AND NOT EXISTS((SELECT source_url FROM expected) EXCEPT (SELECT source_url FROM runs)) AND NOT EXISTS((SELECT source_url FROM runs) EXCEPT (SELECT source_url FROM expected)) runs_ok,
      (SELECT count(*) FROM acs_variables WHERE release_id=$1)=3 AND NOT EXISTS((SELECT variable,survey_period FROM acs_variables WHERE release_id=$1) EXCEPT (SELECT variable,period FROM expected)) AND NOT EXISTS((SELECT variable,period FROM expected) EXCEPT (SELECT variable,survey_period FROM acs_variables WHERE release_id=$1)) AND NOT EXISTS(SELECT 1 FROM acs_variables v JOIN expected e ON e.variable=v.variable AND e.period=v.survey_period WHERE v.release_id=$1 AND (v.id <> 'acs_' || e.id OR v.label<>e.label OR v.unit<>e.unit OR v.universe<>e.universe OR v.definition_kind<>'source' OR v.census_variable<>e.census OR v.published_moe_method<>e.moe)) definitions_ok,
      (SELECT count(*) FROM acs_variable_dependencies WHERE release_id=$1)=0 AND (SELECT count(*) FROM acs_variable_inputs WHERE release_id=$1)=3 AND NOT EXISTS(SELECT 1 FROM acs_variable_inputs i JOIN acs_variables v ON v.release_id=i.release_id AND v.id=i.acs_variable_id LEFT JOIN runs r ON r.snapshot_id=i.snapshot_id AND r.variable=v.variable WHERE i.release_id=$1 AND r.run_id IS NULL) inputs_ok,
      (SELECT count(*) FROM acs_observations WHERE release_id=$1)=1311 AND (SELECT count(*) FROM obs)=1311 AND NOT EXISTS(SELECT 1 FROM obs o LEFT JOIN expected e ON e.variable=o.variable AND e.period=o.survey_period WHERE e.id IS NULL OR o.label<>e.label OR o.unit<>e.unit OR o.universe<>e.universe OR o.lineage_as_of<>'2024-12-31'::date OR o.lineage_status<>'estimated' OR (o.estimate IS NULL)=(o.estimate_missing_reason IS NULL) OR (o.margin_of_error IS NULL)=(o.margin_of_error_missing_reason IS NULL) OR (o.margin_of_error IS NOT NULL AND o.margin_of_error<0)) observations_ok,
      NOT EXISTS(SELECT 1 FROM obs o WHERE EXISTS((SELECT l.snapshot_id,l.role FROM acs_observation_lineage l WHERE l.release_id=$1 AND l.geography_version_id=o.geography_version_id AND l.variable=o.variable AND l.survey_period=o.survey_period) EXCEPT (SELECT r.snapshot_id,'original_publisher' FROM runs r WHERE r.variable=o.variable)) OR EXISTS((SELECT r.snapshot_id,'original_publisher' FROM runs r WHERE r.variable=o.variable) EXCEPT (SELECT l.snapshot_id,l.role FROM acs_observation_lineage l WHERE l.release_id=$1 AND l.geography_version_id=o.geography_version_id AND l.variable=o.variable AND l.survey_period=o.survey_period))) lineage_ok,
      (SELECT count(*) FROM coverage_records WHERE release_id=$1 AND domain='acs')=3 AND NOT EXISTS(SELECT 1 FROM coverage_records c JOIN expected e ON e.variable=c.variable AND e.period=c.survey_period WHERE c.release_id=$1 AND c.domain='acs' AND (c.scope_kind<>'acs_indicator' OR c.status<>'partial' OR c.expected_count<>441 OR c.observed_count<>437 OR c.quarantined_count<>0 OR c.incompatible_count<>4)) AND NOT EXISTS(SELECT 1 FROM coverage_missing_reasons WHERE release_id=$1 AND domain='acs') AND (SELECT count(*) FROM coverage_input_snapshots WHERE release_id=$1 AND domain='acs')=3 AND NOT EXISTS(SELECT 1 FROM coverage_input_snapshots i JOIN coverage_records c ON c.release_id=i.release_id AND c.domain=i.domain AND c.scope_key=i.scope_key LEFT JOIN runs r ON r.snapshot_id=i.snapshot_id AND r.variable=c.variable AND r.period=c.survey_period WHERE i.release_id=$1 AND i.domain='acs' AND r.run_id IS NULL) coverage_ok,
      NOT EXISTS(SELECT 1 FROM expected e WHERE (SELECT array_agg(source_geoid ORDER BY source_geoid) FROM geos WHERE source_geoid NOT IN (SELECT source_geoid FROM obs WHERE variable=e.variable)) <> ARRAY['6098','6698','6998','7898']::text[]) missing_ok
    ) SELECT (release_ok AND geography_ok AND runs_ok AND definitions_ok AND inputs_ok AND observations_ok AND lineage_ok AND coverage_ok AND missing_ok) valid FROM checks`, [releaseId, sourceReleaseId, ...ACS_INDICATOR_DICTIONARY.flatMap((d) => [d.id, d.lockId, d.sourceUrl, d.variableId, d.label, d.unit, d.surveyPeriod, d.universe, d.estimateColumn, publishedMoeMethod])]);
  if (result.rows[0]?.valid !== true) throw new Error("Persisted Task 7 ACS invariant is invalid");
}

function assertOnlyAcsStagingDrift(manifest: NationwideManifest, storedChecksum: string, runs: readonly Run[]): void {
  const sourceIds = new Set(runs.map((run) => run.source_id));
  const snapshotIds = new Set(runs.map((run) => run.snapshot_id));
  if (sourceIds.size !== 1 || snapshotIds.size !== 3) fail("ACS_FINALIZE_DRIFT_INVALID");
  const sourceId = runs[0]!.source_id;
  const source = manifest.sources.filter((row) => row.id === sourceId);
  if (source.length !== 1 || source[0]!.name !== "acs" || source[0]!.authority !== "official"
    || source[0]!.homepageUrl !== "https://www.census.gov/programs-surveys/acs.html"
    || runs.some((run) => run.source_id !== sourceId)) fail("ACS_FINALIZE_DRIFT_INVALID");
  const stagedSnapshots = manifest.snapshots.filter((row) => snapshotIds.has(row.id));
  if (stagedSnapshots.length !== 3 || stagedSnapshots.some((row) => row.sourceId !== sourceId)
    || manifest.snapshots.some((row) => row.sourceId === sourceId && !snapshotIds.has(row.id))) fail("ACS_FINALIZE_DRIFT_INVALID");

  const stripped = structuredClone(manifest);
  stripped.sources = stripped.sources.filter((row) => row.id !== sourceId);
  stripped.snapshots = stripped.snapshots.filter((row) => !snapshotIds.has(row.id));
  stripped.canonicalDataChecksumSha256 = storedChecksum;
  const validation = validateReleaseManifest(stripped);
  if (!validation.success || computeCanonicalDataChecksum(stripped) !== storedChecksum) fail("ACS_FINALIZE_DRIFT_INVALID");
}

async function persist(client: PoolClient, options: FinalizeCandidateAcsOptions, runs: readonly Run[], staged: ReadonlyMap<string, readonly Stage[]>): Promise<void> {
  const old = await client.query<{ definitions: boolean; observations: boolean }>("SELECT EXISTS(SELECT 1 FROM acs_variables WHERE release_id=$1) definitions, EXISTS(SELECT 1 FROM acs_observations WHERE release_id=$1) observations", [options.candidateReleaseId]);
  if (old.rows[0]?.definitions || old.rows[0]?.observations) fail("ACS_FINALIZE_ALREADY_WRITTEN");
  const geography = await client.query<{ id: string; source_geoid: string }>("SELECT id,source_geoid FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND vintage='2025' ORDER BY source_geoid", [options.candidateReleaseId]);
  const ids = new Map(geography.rows.map((row) => [row.source_geoid, row.id]));
  if (ids.size !== 441) fail("ACS_FINALIZE_GEOGRAPHY_INVALID");

  // Validate all in-memory rows before issuing any ACS content INSERT.
  const loaded = await loadNationwideManifestForFinalization(client, options.candidateReleaseId);
  assertOnlyAcsStagingDrift(loaded.manifest, loaded.storedCanonicalDataChecksumSha256, runs);
  const candidate = structuredClone(loaded.manifest);
  candidate.coverageRecords = candidate.coverageRecords.filter((record) => record.domain !== "acs");
  for (const run of runs) {
    const definition = definitionForRun(run, options);
    const rows = staged.get(run.id) ?? [];
    candidate.acsVariables.push({ id: `acs_${definition.id}`, releaseId: releaseId(options.candidateReleaseId), variable: definition.variableId, label: definition.label, unit: definition.unit, surveyPeriod: definition.surveyPeriod, universe: definition.universe, inputSnapshotIds: [snapshotId(run.snapshot_id)], definitionKind: "source", censusVariable: definition.estimateColumn, publishedMoeMethod });
    candidate.coverageRecords.push({ releaseId: releaseId(options.candidateReleaseId), domain: "acs", scope: { kind: "acs_indicator", variable: definition.variableId, surveyPeriod: definition.surveyPeriod }, status: "partial", expectedCount: 441, observedCount: 437, quarantinedCount: 0, incompatibleCount: 4, missingByReason: [], inputSnapshotIds: [snapshotId(run.snapshot_id)] });
    for (const row of rows) {
      const geographyVersionId = ids.get(row.geography);
      let extras: AcsStagedExtrasV1;
      try { extras = decodeAcsStagedExtras(row.redacted_extras); } catch { fail("ACS_FINALIZE_STAGE_INVALID"); }
      if (!geographyVersionId) { if (!ACS_MISSING_GEOIDS.has(row.geography)) fail("ACS_FINALIZE_GEOGRAPHY_INVALID"); continue; }
      candidate.acsObservations.push({ releaseId: releaseId(options.candidateReleaseId), geographyVersionId: geographyId(geographyVersionId), variable: definition.variableId, label: definition.label, estimate: fact(row.estimate, extras.estimateMissingReason), marginOfError: fact(row.margin_of_error, extras.marginOfErrorMissingReason), unit: definition.unit, surveyPeriod: definition.surveyPeriod, universe: definition.universe, lineage: { inputs: [{ snapshotId: snapshotId(run.snapshot_id), role: "original_publisher" }], asOf: "2024-12-31", methodology: definition.marginOfErrorMethod, status: "estimated" } });
    }
  }
  candidate.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(candidate);
  if (!validateReleaseManifest(candidate).success) fail("ACS_FINALIZE_MANIFEST_INVALID");
  await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain=$2", [options.candidateReleaseId, "acs"]);
  await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain=$2", [options.candidateReleaseId, "acs"]);
  await client.query("DELETE FROM coverage_records WHERE release_id=$1 AND domain=$2", [options.candidateReleaseId, "acs"]);
  for (const run of runs) {
    const definition = definitionForRun(run, options); const definitionId = `acs_${definition.id}`;
    await client.query("INSERT INTO acs_variables(release_id,id,variable,label,unit,survey_period,universe,definition_kind,census_variable,published_moe_method) VALUES($1,$2,$3,$4,$5,$6,$7,'source',$8,$9)", [options.candidateReleaseId, definitionId, definition.variableId, definition.label, definition.unit, definition.surveyPeriod, definition.universe, definition.estimateColumn, publishedMoeMethod]);
    await client.query("INSERT INTO acs_variable_inputs(release_id,acs_variable_id,snapshot_id) VALUES($1,$2,$3)", [options.candidateReleaseId, definitionId, run.snapshot_id]);
    for (const row of staged.get(run.id) ?? []) {
      const geographyId = ids.get(row.geography); if (!geographyId) continue;
      const extras = decodeAcsStagedExtras(row.redacted_extras);
      await client.query("INSERT INTO acs_observations(release_id,geography_version_id,variable,label,estimate,estimate_missing_reason,margin_of_error,margin_of_error_missing_reason,unit,survey_period,universe,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'2024-12-31',$12,'estimated')", [options.candidateReleaseId, geographyId, definition.variableId, definition.label, row.estimate, extras.estimateMissingReason, row.margin_of_error, extras.marginOfErrorMissingReason, definition.unit, definition.surveyPeriod, definition.universe, definition.marginOfErrorMethod]);
      await client.query("INSERT INTO acs_observation_lineage(release_id,geography_version_id,variable,survey_period,snapshot_id,role) VALUES($1,$2,$3,$4,$5,'original_publisher')", [options.candidateReleaseId, geographyId, definition.variableId, definition.surveyPeriod, run.snapshot_id]);
    }
    const scopeKey = canonicalCoverageScopeKey({ kind: "acs_indicator", variable: definition.variableId, surveyPeriod: definition.surveyPeriod });
    await client.query("INSERT INTO coverage_records(release_id,domain,scope_key,scope_kind,variable,survey_period,status,expected_count,observed_count,quarantined_count,incompatible_count) VALUES($1,'acs',$2,'acs_indicator',$3,$4,'partial',441,437,0,4)", [options.candidateReleaseId, scopeKey, definition.variableId, definition.surveyPeriod]);
    await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,'acs',$2,$3)", [options.candidateReleaseId, scopeKey, run.snapshot_id]);
  }
  const manifestRow = await client.query<{ schema_version: number; canonical_data_checksum_sha256: string; geometry_checksum_sha256: string; content_checksum_sha256: string }>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR UPDATE", [options.candidateReleaseId]);
  const currentManifest = manifestRow.rows[0];
  if (!currentManifest) fail("ACS_FINALIZE_MANIFEST_INVALID");
  const contentChecksum = expectedContentChecksum({ ...currentManifest, canonical_data_checksum_sha256: candidate.canonicalDataChecksumSha256 });
  await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [options.candidateReleaseId, candidate.canonicalDataChecksumSha256, contentChecksum]);
}

async function assertCandidate(client: PoolClient, options: FinalizeCandidateAcsOptions, lock: LockMode): Promise<void> {
  const result = await client.query(`SELECT 1 FROM data_releases r JOIN data_releases s ON s.id=r.previous_release_id JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1 AND r.status='candidate' AND r.previous_release_id=$2 AND r.source_cutoff=s.source_cutoff AND m.schema_version=2 ${lock}`, [options.candidateReleaseId, options.sourceReleaseId]);
  if (result.rowCount !== 1) fail("ACS_FINALIZE_CANDIDATE_INVALID");
}
async function replayAll(client: PoolClient, options: FinalizeCandidateAcsOptions, lock: LockMode): Promise<{ runs: Run[]; staged: Map<string, readonly Stage[]> }> {
  const runs = await loadRuns(client, options, lock);
  const definitions = runs.map((run) => definitionForRun(run, options));
  if (new Set(definitions.map((definition) => definition.lockId)).size !== 3) fail("ACS_FINALIZE_RUN_INVALID");
  const staged = new Map<string, readonly Stage[]>();
  for (let index = 0; index < runs.length; index += 1) staged.set(runs[index]!.id, await replayRun(client, runs[index]!, definitions[index]!, options));
  return { runs, staged };
}

export async function finalizeCandidateAcs(options: FinalizeCandidateAcsOptions): Promise<void> {
  assertInput(options); const client = await options.pool.connect(); let begun = false;
  try {
    assertNotAborted(options.signal); await client.query("BEGIN"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await assertCandidate(client, options, "FOR UPDATE");
    const replayed = await replayAll(client, options, "FOR UPDATE"); await assertGeographyPolicy(client, options.candidateReleaseId);
    if (replayed.runs.every((run) => run.status === "loaded")) {
      await recheckNationwideValidationGate(client, options.candidateReleaseId); await assertPersistedTask6MemberInvariant(client, options.candidateReleaseId, options.sourceReleaseId); await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
    } else {
      if (replayed.runs.some((run) => run.status !== "validated")) fail("ACS_FINALIZE_MIXED_STATUS");
      await assertPersistedTask6MemberInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
      await persist(client, options, replayed.runs, replayed.staged);
      for (const run of replayed.runs) await markLoaded(client, run.id, run.lease_token);
      await validateNationwideCandidateReleaseWithClient(client, options.candidateReleaseId);
      await recheckNationwideValidationGate(client, options.candidateReleaseId);
      await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
    }
    await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && (/^ACS_FINALIZE_/.test(error.message) || error.message.startsWith("Persisted Task"))) throw error; throw new Error("ACS_FINALIZE_FAILED"); } finally { client.release(); }
}

/** Replays source receipts and staging while holding only read-compatible locks. */
export async function verifyPersistedTask7AcsCandidate(options: FinalizeCandidateAcsOptions): Promise<void> {
  assertInput(options); const client = await options.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await assertCandidate(client, options, "FOR SHARE");
    const replayed = await replayAll(client, options, "FOR SHARE");
    if (replayed.runs.some((run) => run.status !== "loaded")) fail("ACS_FINALIZE_MIXED_STATUS");
    await assertGeographyPolicy(client, options.candidateReleaseId);
    await recheckNationwideValidationGateShared(client, options.candidateReleaseId);
    await assertPersistedTask6MemberInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
    await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
    await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && (/^ACS_FINALIZE_/.test(error.message) || error.message.startsWith("Persisted Task"))) throw error; throw new Error("ACS_FINALIZE_FAILED"); } finally { client.release(); }
}
