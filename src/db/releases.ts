import type { Pool } from "pg";
import { verifyPersistedTask9ElectionWithClient, type FinalizeCandidateElectionDecisionsOptions } from "@/ingestion/elections/finalize-elections";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { loadPrototypeManifest } from "./manifest";
import { recheckNationwideValidationGate } from "./catalog-release";

const SERIALIZATION_FAILURE = "40001";
export type ElectionPublicationProof = Omit<FinalizeCandidateElectionDecisionsOptions, "pool" | "candidateReleaseId">;

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

async function validateReleaseForPublication(client: Parameters<typeof loadPrototypeManifest>[0], pool: Pool, releaseId: string, targetStatus: "candidate" | "retired", electionProof?: ElectionPublicationProof): Promise<void> {
  const version = await client.query<{ schema_version: number }>("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId]);
  switch (version.rows[0]?.schema_version) {
    case 1: {
      const manifest = await loadPrototypeManifest(client, releaseId);
      const semantic = validatePrototypeManifest(manifest);
      if (!semantic.success || manifest.profileSeatCycleIds.length < 10 || manifest.profileSeatCycleIds.length > 12) throw new Error(`Release ${releaseId} failed validation immediately before promotion`);
      return;
    }
    case 2:
      await recheckNationwideValidationGate(client, releaseId);
      if (await assertElectionPublicationReadiness(client, releaseId)) {
        if (!electionProof || electionProof.runIds.length !== 158) throw new Error(`Release ${releaseId} requires exact Task 9 publication evidence`);
        const options = { ...electionProof, pool, candidateReleaseId: releaseId };
        await verifyPersistedTask9ElectionWithClient(client as never, options, [targetStatus]);
        const closure = await client.query<{ reviewed: string | number; matched: string | number }>(`SELECT count(*) FILTER (WHERE ed.status<>'unassessed') reviewed,count(*) FILTER (WHERE ed.status<>'unassessed' AND ir.id IS NOT NULL) matched FROM election_decisions ed LEFT JOIN election_decision_inputs edi ON edi.release_id=ed.release_id AND edi.election_decision_id=ed.id LEFT JOIN ingest_runs ir ON ir.release_id=edi.release_id AND ir.snapshot_id=edi.snapshot_id AND ir.id=ANY($2) AND ir.status='loaded' WHERE ed.release_id=$1`, [releaseId, electionProof.runIds]);
        if (Number(closure.rows[0]?.reviewed) !== 158 || Number(closure.rows[0]?.matched) !== 158) throw new Error(`Release ${releaseId} requires complete Task 9 publication evidence`);
      }
      return;
    default:
      throw new Error(`Release ${releaseId} has an unsupported manifest schema version`);
  }
}

/** Atomically makes a candidate the sole published release after the content lock exposes its latest committed state. */
export async function promoteCandidateRelease(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await pool.connect();
    try {
      // Candidate writers and promotion share explicit advisory/row locks. READ COMMITTED
      // is intentional: a serializable snapshot taken before a blocked content lock could
      // validate stale candidate rows after that writer commits.
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [releaseId]);
      const candidate = await client.query<{ id: string }>(
        "SELECT id FROM data_releases WHERE id = $1 AND status = 'candidate' FOR UPDATE", [releaseId],
      );
      if (candidate.rowCount !== 1) throw new Error(`Release ${releaseId} is not a candidate`);
      await validateReleaseForPublication(client, pool, releaseId, "candidate", electionProof);
      const published = await client.query<{ id: string }>(
        "SELECT id FROM data_releases WHERE status = 'published' FOR UPDATE",
      );
      await client.query("UPDATE data_releases SET status = 'retired' WHERE status = 'published'");
      await client.query(
        "UPDATE data_releases SET status = 'published', published_at = now(), previous_release_id = $2 WHERE id = $1",
        [releaseId, published.rows[0]?.id ?? null],
      );
      await client.query("COMMIT");
      return;
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
}

/** Republishes the direct retired successor of the current release after revalidating immutable content. */
export async function rollForwardRetiredRelease(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [releaseId]);
      const published = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE status = 'published' FOR UPDATE");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll forward");
      const current = published.rows[0]!;
      if (current.id === releaseId) throw new Error(`Release ${releaseId} is already published`);
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [current.id]);
      const target = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE id=$1 AND status='retired' AND previous_release_id=$2 FOR UPDATE", [releaseId, current.id]);
      if (target.rowCount !== 1) throw new Error(`Retired release ${releaseId} is not the direct successor of published release ${current.id}`);
      await validateReleaseForPublication(client, pool, releaseId, "retired", electionProof);
      await client.query("UPDATE data_releases SET status = 'retired' WHERE id = $1", [current.id]);
      // Keep the target's original published_at and previous_release_id as historical facts.
      await client.query("UPDATE data_releases SET status = 'published' WHERE id = $1", [releaseId]);
      await client.query("COMMIT");
      return { publishedReleaseId: releaseId, retiredReleaseId: current.id };
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Roll-forward attempts exhausted");
}

/** Restores the retired predecessor of the sole published release, retrying complete serializable attempts. */
export async function rollbackPublishedRelease(pool: Pool, maxAttempts = 3): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const published = await client.query<{ id: string; previous_release_id: string | null }>("SELECT id, previous_release_id FROM data_releases WHERE status = 'published' FOR UPDATE");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll back");
      const current = published.rows[0]!;
      if (current.previous_release_id === null) throw new Error(`Published release ${current.id} has no previous release to restore`);
      const previous = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE id = $1 AND status = 'retired' FOR UPDATE", [current.previous_release_id]);
      if (previous.rowCount !== 1) throw new Error(`Previous release ${current.previous_release_id} must exist and be retired`);
      await client.query("UPDATE data_releases SET status = 'retired' WHERE id = $1", [current.id]);
      // Do not change published_at: the restored release retains its original publication time.
      await client.query("UPDATE data_releases SET status = 'published' WHERE id = $1", [previous.rows[0]!.id]);
      await client.query("COMMIT");
      return { publishedReleaseId: previous.rows[0]!.id, retiredReleaseId: current.id };
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Rollback attempts exhausted");
}
