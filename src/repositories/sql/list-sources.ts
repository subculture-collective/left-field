import type { Pool, PoolClient } from "pg";

import { sourceSchema, sourceSnapshotSchema } from "@/domain/contracts";
import type { ReleaseId, Source, SourceSnapshot } from "@/domain/contracts";
import { releaseCoverageAggregateSchema, seatFacetsSchema } from "@/domain/repository";
import type { ReleaseCoverageAggregate, SeatFacets } from "@/domain/repository";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

/** Reads sources from the release tables; snapshots are deliberately not hydrated here. */
export async function listSources(pool: Queryable, releaseId: ReleaseId): Promise<readonly Source[]> {
  const result = await pool.query(
    `SELECT id, release_id AS "releaseId", name, authority, homepage_url AS "homepageUrl"
       FROM sources
      WHERE release_id = $1
      ORDER BY id COLLATE "C"`,
    [releaseId],
  );
  return result.rows.map((row) => sourceSchema.parse(row));
}

/** Reads the complete active-release snapshot inventory, not a profile closure. */
export async function listSourceSnapshots(pool: Queryable, releaseId: ReleaseId): Promise<readonly SourceSnapshot[]> {
  const result = await pool.query(
    `SELECT id, release_id AS "releaseId", source_id AS "sourceId", source_url AS "sourceUrl",
            published_at AS "publishedAt", retrieved_at AS "retrievedAt", checksum_sha256 AS "checksumSha256",
            parser_version AS "parserVersion", license, usage_status AS "usageStatus"
       FROM source_snapshots WHERE release_id = $1 ORDER BY id COLLATE "C"`,
    [releaseId],
  );
  return result.rows.map((row) => sourceSnapshotSchema.parse(normalizeDates(row)));
}

export async function getSeatFacets(pool: Queryable, releaseId: ReleaseId): Promise<SeatFacets> {
  const result = await pool.query(
    `WITH profile AS (
       SELECT o.state_code, sc.incumbency_status, sc.cycle_year, membership.party
         FROM release_profile_seats rps
         JOIN seat_cycles sc ON sc.release_id = rps.release_id AND sc.id = rps.seat_cycle_id
         JOIN offices o ON o.release_id = rps.release_id AND o.id = sc.office_id
         LEFT JOIN LATERAL (
           SELECT m.party FROM memberships m
            WHERE sc.occupancy_status = 'occupied' AND m.release_id = rps.release_id
              AND m.office_term_id = sc.office_term_id AND m.starts_at <= sc.occupancy_as_of
              AND (m.ends_at IS NULL OR sc.occupancy_as_of < m.ends_at)
            ORDER BY m.starts_at DESC, m.id COLLATE "C" LIMIT 1
         ) membership ON true
        WHERE rps.release_id = $1
     ) SELECT ARRAY(SELECT DISTINCT state_code COLLATE "C" AS value FROM profile ORDER BY value) AS states,
              ARRAY(SELECT DISTINCT party COLLATE "C" AS value FROM profile WHERE party IS NOT NULL ORDER BY value) AS parties,
              ARRAY(SELECT DISTINCT incumbency_status COLLATE "C" AS value FROM profile ORDER BY value) AS "incumbencyStatuses",
              ARRAY(SELECT DISTINCT cycle_year FROM profile ORDER BY cycle_year) AS "electionYears"`,
    [releaseId],
  );
  return seatFacetsSchema.parse(result.rows[0] ?? { states: [], parties: [], incumbencyStatuses: [], electionYears: [] });
}

export async function listReleaseCoverage(pool: Queryable, releaseId: ReleaseId): Promise<readonly ReleaseCoverageAggregate[]> {
  const result = await pool.query(`WITH coverage_groups AS (
    SELECT cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status,count(*)::int AS record_count,sum(cr.expected_count)::int AS expected_count,sum(cr.observed_count)::int AS observed_count,sum(cr.quarantined_count)::int AS quarantined_count,sum(cr.incompatible_count)::int AS incompatible_count FROM coverage_records cr WHERE cr.release_id=$1 GROUP BY cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status
  ), snapshot_groups AS (
    SELECT cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status,count(DISTINCT cis.snapshot_id)::int AS input_snapshot_count FROM coverage_records cr LEFT JOIN coverage_input_snapshots cis ON cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key WHERE cr.release_id=$1 GROUP BY cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status
  ), reasons AS (
    SELECT cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status,cmr.reason::text AS reason,sum(cmr.count)::int AS count FROM coverage_records cr JOIN coverage_missing_reasons cmr ON cmr.release_id=cr.release_id AND cmr.domain=cr.domain AND cmr.scope_key=cr.scope_key WHERE cr.release_id=$1 GROUP BY cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status,cmr.reason::text
  ) SELECT jsonb_build_object('releaseId',$1,'domain',g.domain,'scope',CASE g.scope_kind WHEN 'release' THEN jsonb_build_object('kind','release') WHEN 'jurisdiction' THEN jsonb_build_object('kind','jurisdiction') WHEN 'seat_cycle' THEN jsonb_build_object('kind','seat_cycle') WHEN 'acs_indicator' THEN jsonb_build_object('kind','acs_indicator','variable',g.variable,'surveyPeriod',g.survey_period) WHEN 'election' THEN jsonb_build_object('kind','election','electionYear',g.election_year) ELSE jsonb_build_object('kind','funding','fundingKind',g.funding_kind) END,'status',g.status,'recordCount',g.record_count,'expectedCount',g.expected_count,'observedCount',g.observed_count,'quarantinedCount',g.quarantined_count,'incompatibleCount',g.incompatible_count,'missingByReason',COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',r.reason,'count',r.count) ORDER BY r.reason COLLATE "C") FROM reasons r WHERE r.domain=g.domain AND r.scope_kind=g.scope_kind AND r.variable IS NOT DISTINCT FROM g.variable AND r.survey_period IS NOT DISTINCT FROM g.survey_period AND r.election_year IS NOT DISTINCT FROM g.election_year AND r.funding_kind IS NOT DISTINCT FROM g.funding_kind AND r.status=g.status),'[]'::jsonb),'inputSnapshotCount',s.input_snapshot_count) coverage FROM coverage_groups g JOIN snapshot_groups s ON s.domain=g.domain AND s.scope_kind=g.scope_kind AND s.variable IS NOT DISTINCT FROM g.variable AND s.survey_period IS NOT DISTINCT FROM g.survey_period AND s.election_year IS NOT DISTINCT FROM g.election_year AND s.funding_kind IS NOT DISTINCT FROM g.funding_kind AND s.status=g.status ORDER BY g.domain COLLATE "C",g.scope_kind COLLATE "C",g.variable COLLATE "C",g.survey_period COLLATE "C",g.election_year,g.funding_kind COLLATE "C",g.status COLLATE "C"`, [releaseId]);
  return result.rows.map((row) => releaseCoverageAggregateSchema.parse(row.coverage));
}

function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  return value;
}
