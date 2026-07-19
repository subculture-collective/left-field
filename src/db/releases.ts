import type { Pool } from "pg";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { loadPrototypeManifest } from "./manifest";

const SERIALIZATION_FAILURE = "40001";

/** Atomically makes a candidate the sole published release after the content lock exposes its latest committed state. */
export async function promoteCandidateRelease(pool: Pool, releaseId: string, maxAttempts = 3): Promise<void> {
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
      const version = await client.query<{ schema_version: number }>("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId]);
      if (version.rows[0]?.schema_version !== 1) throw new Error("Nationwide v2 publication is not enabled until Task 5");
      const manifest = await loadPrototypeManifest(client, releaseId);
      const semantic = validatePrototypeManifest(manifest);
      if (!semantic.success || manifest.profileSeatCycleIds.length < 10 || manifest.profileSeatCycleIds.length > 12) throw new Error(`Release ${releaseId} failed validation immediately before promotion`);
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
