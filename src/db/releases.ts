import type { Pool, PoolClient } from "pg";
import { verifyPersistedTask9ElectionWithClient, type FinalizeCandidateElectionDecisionsOptions } from "@/ingestion/elections/finalize-elections";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { loadNationwideManifest, loadPrototypeManifest } from "./manifest";
import { recheckNationwideValidationGateShared } from "./catalog-release";
import { createHash, randomUUID } from "node:crypto";
import type { MapArtifactReceipt, MapArtifactStore } from "@/maps/map-artifact-store";
import { isCanonicalDistrictGeoJson } from "@/maps/public-map";
import { boundedDuration, boundedFailureCode, emitOperationalSignal, signalTimestamp, type OperationalSignalSink } from "@/operations/signals";

const SERIALIZATION_FAILURE = "40001";
export type ElectionPublicationProof = Omit<FinalizeCandidateElectionDecisionsOptions, "pool" | "candidateReleaseId">;
/** Required out-of-database evidence before a map-bearing release can be public. */
export interface MapPublicationProof { readonly store: MapArtifactStore; }
/** Separate least-privilege connections for capability issuance and consumption. */
export interface ReleaseLifecyclePools { readonly preflightPool?: Pool; readonly operatorPool?: Pool; readonly signalSink?: OperationalSignalSink; }

async function issuePreflight(client: PoolClient, operation: "promote" | "roll_forward", releaseId: string, currentId: string | null, predecessorId: string | null, runIds?: readonly string[]): Promise<string> {
  const proofId = randomUUID();
  await client.query("SELECT public.issue_release_preflight($1,$2,$3,$4,$5,$6,$7)", [proofId, operation, releaseId, currentId, predecessorId, runIds ?? null, 300]);
  return proofId;
}

async function consumeLifecycle(pool: Pool, sql: string, args: unknown[]): Promise<void> {
  const client = await pool.connect();
  try { await client.query(sql, args); } finally { client.release(); }
}

async function lockReleases(client: PoolClient, ids: readonly (string | null | undefined)[]): Promise<void> {
  for (const id of [...new Set(ids.filter((value): value is string => value !== null && value !== undefined))].sort()) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [id]);
  }
}

/** Reads every exact persisted receipt, failing closed on a missing, replaced, or malformed map object. */
export async function verifyPublishedMapObjectsWithClient(client: Parameters<typeof loadPrototypeManifest>[0], store: MapArtifactStore, releaseId: string): Promise<void> {
  const result = await client.query<{ geography_id: string; raw_store_kind: "local" | "s3"; store_identity: string; object_key: string; sha256: string; byte_size: number | string; version_id: string | null; etag: string | null }>(`
    WITH cutoff_house_geographies AS (
      SELECT DISTINCT sc.geography_version_id
      FROM data_releases r JOIN release_profile_seats rps ON rps.release_id=r.id
      JOIN seat_cycles sc ON sc.release_id=rps.release_id AND sc.id=rps.seat_cycle_id
      JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
      JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
      JOIN geography_versions gv ON gv.release_id=sc.release_id AND gv.id=sc.geography_version_id
      JOIN district_plans dp ON dp.release_id=gv.release_id AND dp.id=gv.district_plan_id
      WHERE r.id=$1 AND o.chamber='house' AND sc.occupancy_as_of <= r.source_cutoff::date
        AND ot.starts_at <= r.source_cutoff::date AND ot.ends_at > r.source_cutoff::date
        AND dp.effective_from <= r.source_cutoff::date AND (dp.effective_to IS NULL OR dp.effective_to > r.source_cutoff::date)
    )
    SELECT ma.geography_version_id geography_id,mr.raw_store_kind,mr.store_identity,mr.object_key,mr.sha256,mr.byte_size,mr.version_id,mr.etag
    FROM cutoff_house_geographies chg JOIN map_artifacts ma ON ma.release_id=$1 AND ma.geography_version_id=chg.geography_version_id
    JOIN map_artifact_receipts mr ON mr.release_id=ma.release_id AND mr.map_artifact_id=ma.id`, [releaseId]);
  if (result.rows.length !== 441 || new Set(result.rows.map(row => row.geography_id)).size !== 441) throw new Error(`Map-bearing release ${releaseId} has incomplete cutoff-active map receipts`);
  for (const row of result.rows) {
    const byteSize = Number(row.byte_size);
    const receipt = row.raw_store_kind === "local" && row.version_id === null && row.etag === null
      ? { storeKind: "local", storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize }
      : row.raw_store_kind === "s3" && typeof row.version_id === "string" && typeof row.etag === "string"
        ? { storeKind: "s3", storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize, versionId: row.version_id, etag: row.etag }
        : null;
    if (!receipt || row.object_key !== `maps/${releaseId}/${row.geography_id}.geojson` || !Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error(`Map-bearing release ${releaseId} has an invalid map receipt`);
    const bytes = await store.read(receipt as MapArtifactReceipt);
    if (bytes.byteLength !== byteSize || createHash("sha256").update(bytes).digest("hex") !== row.sha256 || !isCanonicalDistrictGeoJson(bytes)) throw new Error(`Map-bearing release ${releaseId} map object verification failed`);
  }
}

/**
 * Legacy nationwide releases contain only unassessed planning rows. Once a
 * candidate introduces any reviewed election decision, publication must close
 * the complete presidential review cohort and every approved decision must
 * have corresponding publishable result facts. Candidate validation remains
 * available for partial cohort work; this stricter check is publication-only.
 */
export async function assertElectionPublicationReadiness(
  client: Parameters<typeof loadPrototypeManifest>[0],
  releaseId: string,
): Promise<boolean> {
  const decisions = await client.query<{
    reviewed_any: string | number;
    unassessed_any: string | number;
    reviewed: string | number;
    unassessed: string | number;
    alaska_approved: string | number;
    approved_without_results: string | number;
  }>(`
    WITH presidential AS (
      SELECT jurisdiction_code, election_year, status
      FROM election_decisions
      WHERE release_id=$1
    ), result_closure AS (
      SELECT ed.jurisdiction_code,ed.election_year
      FROM election_decisions ed
      JOIN election_decision_inputs edi ON edi.release_id=ed.release_id AND edi.election_decision_id=ed.id
      WHERE ed.release_id=$1 AND ed.status='approved' AND ed.election_year IN (2020,2024)
        AND EXISTS (
          SELECT 1 FROM contests c
          JOIN seat_cycles sc ON sc.release_id=c.release_id AND sc.id=c.seat_cycle_id
          JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
          WHERE c.release_id=ed.release_id AND c.kind='president_general' AND o.state_code=ed.jurisdiction_code AND EXTRACT(YEAR FROM c.election_date)::int=ed.election_year
        )
        AND NOT EXISTS (
          SELECT 1 FROM contests c
          JOIN seat_cycles sc ON sc.release_id=c.release_id AND sc.id=c.seat_cycle_id
          JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
          WHERE c.release_id=ed.release_id AND c.kind='president_general' AND o.state_code=ed.jurisdiction_code AND EXTRACT(YEAR FROM c.election_date)::int=ed.election_year
            AND (
              c.round<>'general' OR c.certification_status NOT IN ('certified','modeled') OR c.reporting_completeness_percent<>100 OR c.denominator_votes IS NULL
              OR (c.allocation_method<>'none' AND c.allocation_coverage_percent IS DISTINCT FROM 100)
              OR NOT EXISTS (SELECT 1 FROM result_options ro WHERE ro.release_id=c.release_id AND ro.contest_id=c.id)
              OR NOT EXISTS (SELECT 1 FROM contest_lineage cl JOIN snapshot_derivation_inputs sdi ON sdi.release_id=cl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=cl.snapshot_id WHERE cl.release_id=c.release_id AND cl.contest_id=c.id)
              OR EXISTS (SELECT 1 FROM contest_lineage cl WHERE cl.release_id=c.release_id AND cl.contest_id=c.id AND NOT EXISTS (SELECT 1 FROM snapshot_derivation_inputs sdi WHERE sdi.release_id=cl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=cl.snapshot_id))
              OR EXISTS (
                SELECT 1 FROM result_options ro
                LEFT JOIN election_results er ON er.release_id=ro.release_id AND er.contest_id=ro.contest_id AND er.result_option_id=ro.id
                WHERE ro.release_id=c.release_id AND ro.contest_id=c.id AND (
                  er.result_option_id IS NULL OR er.votes IS NULL
                  OR NOT EXISTS (SELECT 1 FROM election_result_lineage erl JOIN snapshot_derivation_inputs sdi ON sdi.release_id=erl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=erl.snapshot_id WHERE erl.release_id=ro.release_id AND erl.contest_id=ro.contest_id AND erl.result_option_id=ro.id)
                  OR EXISTS (SELECT 1 FROM election_result_lineage erl WHERE erl.release_id=ro.release_id AND erl.contest_id=ro.contest_id AND erl.result_option_id=ro.id AND NOT EXISTS (SELECT 1 FROM snapshot_derivation_inputs sdi WHERE sdi.release_id=erl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=erl.snapshot_id))
                )
              )
              OR c.denominator_votes IS DISTINCT FROM (SELECT sum(er.votes) FROM election_results er WHERE er.release_id=c.release_id AND er.contest_id=c.id)
            )
        )
    )
    SELECT
      count(*) FILTER (WHERE status<>'unassessed') AS reviewed_any,
      count(*) FILTER (WHERE status='unassessed') AS unassessed_any,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND status<>'unassessed') AS reviewed,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND status='unassessed') AS unassessed,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND jurisdiction_code='AK' AND status='approved') AS alaska_approved,
      count(*) FILTER (
        WHERE election_year IN (2020,2024) AND status='approved' AND NOT EXISTS (
          SELECT 1 FROM result_closure r
          WHERE r.jurisdiction_code=presidential.jurisdiction_code
            AND r.election_year=presidential.election_year
        )
      ) AS approved_without_results
    FROM presidential
  `, [releaseId]);
  const row = decisions.rows[0];
  const reviewedAny = Number(row?.reviewed_any ?? 0);
  if (reviewedAny === 0) return false;
  if (
    reviewedAny !== 158 ||
    Number(row?.unassessed_any ?? 0) !== 0 ||
    Number(row?.reviewed ?? 0) !== 102 ||
    Number(row?.unassessed ?? 0) !== 0 ||
    Number(row?.alaska_approved ?? 0) !== 2 ||
    Number(row?.approved_without_results ?? 0) !== 0
  ) throw new Error(`Release ${releaseId} failed election publication readiness`);
  return true;
}

async function validateReleaseForPublication(client: Parameters<typeof loadPrototypeManifest>[0], pool: Pool, releaseId: string, targetStatus: "candidate" | "retired", electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof): Promise<void> {
  const version = await client.query<{ schema_version: number }>("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId]);
  switch (version.rows[0]?.schema_version) {
    case 1: {
      const manifest = await loadPrototypeManifest(client, releaseId);
      const semantic = validatePrototypeManifest(manifest);
      if (!semantic.success || manifest.profileSeatCycleIds.length < 10 || manifest.profileSeatCycleIds.length > 12) throw new Error(`Release ${releaseId} failed validation immediately before promotion`);
      return;
    }
    case 2:
      await recheckNationwideValidationGateShared(client as PoolClient, releaseId);
      // Strict-load after the gate recheck: promotion must never rely only on a
      // digest row when the persisted manifest itself cannot be reconstructed.
      await loadNationwideManifest(client, releaseId);
      const mapTarget = await client.query<{ previous_release_id: string | null; maps: boolean }>("SELECT r.previous_release_id,EXISTS(SELECT 1 FROM map_artifacts ma WHERE ma.release_id=r.id) maps FROM data_releases r WHERE r.id=$1", [releaseId]);
      if (mapTarget.rowCount !== 1) throw new Error(`Release ${releaseId} is missing`);
      if (mapTarget.rows[0]!.maps) {
        const predecessor = mapTarget.rows[0]!.previous_release_id;
        if (predecessor === null) throw new Error(`Map-bearing release ${releaseId} requires an immutable predecessor`);
        await recheckNationwideValidationGateShared(client as PoolClient, predecessor);
        if (!electionProof || electionProof.runIds.length !== 158) throw new Error(`Release ${releaseId} requires predecessor Task 9 evidence`);
        await verifyPersistedTask9ElectionWithClient(client as never, { ...electionProof, pool, candidateReleaseId: predecessor }, ["published", "retired"]);
        const inherited = await client.query<{ equal: boolean }>("SELECT EXISTS(SELECT 1 FROM release_content_digests t JOIN release_content_digests p ON p.domain='elections' AND p.release_id=$2 WHERE t.release_id=$1 AND t.domain='elections' AND t.row_count=p.row_count AND t.sha256=p.sha256) equal", [releaseId, predecessor]);
        if (!inherited.rows[0]!.equal) throw new Error(`Map-bearing release ${releaseId} did not inherit predecessor elections content`);
        if (!mapProof) throw new Error(`Map-bearing release ${releaseId} requires map publication evidence`);
        await verifyPublishedMapObjectsWithClient(client, mapProof.store, releaseId);
        return;
      }
      if (await assertElectionPublicationReadiness(client, releaseId)) {
        if (!electionProof || electionProof.runIds.length !== 158) throw new Error(`Release ${releaseId} requires exact Task 9 publication evidence`);
        const options = { ...electionProof, pool, candidateReleaseId: releaseId };
        await verifyPersistedTask9ElectionWithClient(client as never, options, [targetStatus]);
        const closure = await client.query<{ reviewed: string | number; matched: string | number }>(`SELECT count(*) FILTER (WHERE ed.status<>'unassessed') reviewed,count(*) FILTER (WHERE ed.status<>'unassessed' AND ir.id IS NOT NULL) matched FROM election_decisions ed LEFT JOIN election_decision_inputs edi ON edi.release_id=ed.release_id AND edi.election_decision_id=ed.id LEFT JOIN ingest_runs ir ON ir.release_id=edi.release_id AND ir.snapshot_id=edi.snapshot_id AND ir.id=ANY($2) AND ir.status='loaded' WHERE ed.release_id=$1`, [releaseId, electionProof.runIds]);
        if (Number(closure.rows[0]?.reviewed) !== 158 || Number(closure.rows[0]?.matched) !== 158) throw new Error(`Release ${releaseId} requires complete Task 9 publication evidence`);
      } else if (electionProof?.runIds.length) {
        throw new Error(`All-unassessed release ${releaseId} must not supply Task 9 evidence`);
      }
      return;
    default:
      throw new Error(`Release ${releaseId} has an unsupported manifest schema version`);
  }
}

/** Atomically makes a candidate the sole published release after the content lock exposes its latest committed state. */
async function promoteCandidateReleaseImpl(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<void> {
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  const validationPool = lifecyclePools.preflightPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await validationPool.connect();
    let committed = false;
    try {
      // Candidate writers and promotion share explicit advisory/row locks. READ COMMITTED
      // is intentional: a serializable snapshot taken before a blocked content lock could
      // validate stale candidate rows after that writer commits.
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const candidate = await client.query<{ id: string; previous_release_id: string | null }>(
        "SELECT id,previous_release_id FROM data_releases WHERE id = $1 AND status = 'candidate'", [releaseId],
      );
      if (candidate.rowCount !== 1) throw new Error(`Release ${releaseId} is not a candidate`);
      const published = await client.query<{ id: string }>(
        "SELECT id FROM data_releases WHERE status = 'published'",
      );
      if ((published.rowCount ?? published.rows.length) > 1) throw new Error("Expected at most one published release to promote");
      const currentId = published.rows[0]?.id ?? null;
      // The global lock freezes lifecycle topology; lock every release whose
      // lineage/evidence is read so writers and finalizers share one order.
      await lockReleases(client, [releaseId, candidate.rows[0]!.previous_release_id, currentId]);
      await validateReleaseForPublication(client, validationPool, releaseId, "candidate", electionProof, mapProof);
      const proofId = await issuePreflight(client, "promote", releaseId, currentId, currentId, electionProof?.runIds);
      const args = [proofId, releaseId, currentId, currentId, electionProof?.runIds ?? null];
      if (lifecyclePools.operatorPool) {
        await client.query("COMMIT"); committed = true;
        await consumeLifecycle(lifecyclePools.operatorPool, "SELECT public.lifecycle_promote_candidate($1,$2,$3,$4,$5)", args);
      } else {
        await client.query("SELECT public.lifecycle_promote_candidate($1,$2,$3,$4,$5)", args);
        await client.query("COMMIT"); committed = true;
      }
      return;
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
}

/** Republishes the direct retired successor of the current release after revalidating immutable content. */
async function rollForwardRetiredReleaseImpl(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  const validationPool = lifecyclePools.preflightPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await validationPool.connect();
    let committed = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const published = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE status = 'published'");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll forward");
      const current = published.rows[0]!;
      if (current.id === releaseId) throw new Error(`Release ${releaseId} is already published`);
      const target = await client.query<{ id: string; previous_release_id: string | null }>("SELECT id,previous_release_id FROM data_releases WHERE id=$1 AND status='retired' AND previous_release_id=$2", [releaseId, current.id]);
      if (target.rowCount !== 1) throw new Error(`Retired release ${releaseId} is not the direct successor of published release ${current.id}`);
      await lockReleases(client, [releaseId, current.id, target.rows[0]!.previous_release_id]);
      await validateReleaseForPublication(client, validationPool, releaseId, "retired", electionProof, mapProof);
      // The SECURITY DEFINER routine preserves the target's historical metadata.
      const proofId = await issuePreflight(client, "roll_forward", releaseId, current.id, current.id, electionProof?.runIds);
      const args = [proofId, releaseId, current.id, current.id, electionProof?.runIds ?? null];
      if (lifecyclePools.operatorPool) {
        await client.query("COMMIT"); committed = true;
        await consumeLifecycle(lifecyclePools.operatorPool, "SELECT public.lifecycle_roll_forward($1,$2,$3,$4,$5)", args);
      } else {
        await client.query("SELECT public.lifecycle_roll_forward($1,$2,$3,$4,$5)", args);
        await client.query("COMMIT"); committed = true;
      }
      return { publishedReleaseId: releaseId, retiredReleaseId: current.id };
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Roll-forward attempts exhausted");
}

/** Restores the retired predecessor of the sole published release, retrying complete serializable attempts. */
async function rollbackPublishedReleaseImpl(pool: Pool, maxAttempts = 3, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  const validationPool = lifecyclePools.preflightPool ?? pool;
  const operatorPool = lifecyclePools.operatorPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await validationPool.connect();
    let committed = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const published = await client.query<{ id: string; previous_release_id: string | null }>("SELECT id, previous_release_id FROM data_releases WHERE status = 'published'");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll back");
      const current = published.rows[0]!;
      if (current.previous_release_id === null) throw new Error(`Published release ${current.id} has no previous release to restore`);
      const previous = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE id = $1 AND status = 'retired'", [current.previous_release_id]);
      if (previous.rowCount !== 1) throw new Error(`Previous release ${current.previous_release_id} must exist and be retired`);
      await lockReleases(client, [current.id, previous.rows[0]!.id]);
      // Do not change published_at: the restored release retains its original publication time.
      await client.query("COMMIT");
      committed = true;
      // Do not hold the validation connection's global advisory lock while the
      // operator acquires it, even when both capabilities use the same Pool.
      await consumeLifecycle(operatorPool, "SELECT public.lifecycle_rollback($1,$2)", [current.id, previous.rows[0]!.id]);
      return { publishedReleaseId: previous.rows[0]!.id, retiredReleaseId: current.id };
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Rollback attempts exhausted");
}

async function observeLifecycle<T>(sink: OperationalSignalSink | undefined, operation: "promote" | "rollback" | "roll_forward", releaseId: string | undefined, work: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try { const result = await work(); emitOperationalSignal(sink, { version: 1, timestamp: signalTimestamp(), kind: "lifecycle", operation, ...(releaseId ? { releaseId } : {}), outcome: "success", durationMs: boundedDuration(startedAt) }); return result; }
  catch (error) { emitOperationalSignal(sink, { version: 1, timestamp: signalTimestamp(), kind: "lifecycle", operation, ...(releaseId ? { releaseId } : {}), outcome: "failure", failureCode: boundedFailureCode("lifecycle"), durationMs: boundedDuration(startedAt) }); throw error; }
}
export const promoteCandidateRelease = (pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<void> => observeLifecycle(lifecyclePools.signalSink, "promote", releaseId, () => promoteCandidateReleaseImpl(pool, releaseId, maxAttempts, electionProof, mapProof, lifecyclePools));
export const rollForwardRetiredRelease = (pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> => observeLifecycle(lifecyclePools.signalSink, "roll_forward", releaseId, () => rollForwardRetiredReleaseImpl(pool, releaseId, maxAttempts, electionProof, mapProof, lifecyclePools));
export const rollbackPublishedRelease = (pool: Pool, maxAttempts = 3, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> => observeLifecycle(lifecyclePools.signalSink, "rollback", undefined, () => rollbackPublishedReleaseImpl(pool, maxAttempts, lifecyclePools));
