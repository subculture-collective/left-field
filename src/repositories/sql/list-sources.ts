import type { Pool, PoolClient } from "pg";

import { sourceSchema, sourceSnapshotSchema } from "@/domain/contracts";
import type { ReleaseId, Source, SourceSnapshot } from "@/domain/contracts";
import { seatFacetsSchema } from "@/domain/repository";
import type { SeatFacets } from "@/domain/repository";

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

function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  return value;
}
