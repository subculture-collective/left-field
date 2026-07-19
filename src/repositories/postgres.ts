import type { Pool } from "pg";
import { dataReleaseSchema } from "@/domain/contracts";
import type { DataRelease, ReleaseId, SeatCycleId, Source, SourceSnapshot } from "@/domain/contracts";
import type { SeatFacets, SeatListItem, SeatPage, SeatPageRequest, SeatProfile, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { getSeatProfile } from "./sql/get-seat-profile";
import { getSeatListItem, listSeatPage } from "./sql/list-seats";
import { getSeatFacets, listSourceSnapshots, listSources } from "./sql/list-sources";

const releaseSql = `SELECT id, label, status, source_cutoff AS "sourceCutoff", created_at AS "createdAt",
  published_at AS "publishedAt", previous_release_id AS "previousReleaseId" FROM data_releases`;

function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  return value;
}

export class PostgresSeatResearchRepository implements SeatResearchRepository {
  public constructor(private readonly pool: Pool) {}
  async getActiveRelease(): Promise<DataRelease> {
    const result = await this.pool.query(`${releaseSql} WHERE status = 'published'`);
    if (result.rowCount !== 1) throw new Error("Expected exactly one published release");
    return dataReleaseSchema.parse(normalizeDates(result.rows[0]));
  }
  async getRelease(id: ReleaseId): Promise<DataRelease | null> {
    const result = await this.pool.query(`${releaseSql} WHERE id = $1`, [id]);
    return result.rowCount === 0 ? null : dataReleaseSchema.parse(normalizeDates(result.rows[0]));
  }
  async listSeatPage(releaseId: ReleaseId, request: SeatPageRequest): Promise<SeatPage> { return listSeatPage(this.pool, releaseId, request); }
  async getSeatListItem(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatListItem | null> { return getSeatListItem(this.pool, releaseId, id); }
  /** Legacy compatibility only; callers should use listSeatPage. */
  async listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]> {
    const items: SeatListItem[] = []; const seenCursors = new Set<string>(); let cursor: string | undefined;
    for (let pageCount = 0; pageCount < 10_000; pageCount += 1) {
      const page = await this.listSeatPage(releaseId, { ...query, limit: 100, ...(cursor ? { cursor } : {}) });
      items.push(...page.items);
      if (page.nextCursor === null) return items;
      if (seenCursors.has(page.nextCursor)) throw new Error("Seat page cursor did not advance");
      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    throw new Error("Seat page cursor exceeded compatibility limit");
  }
  async getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const profile = await getSeatProfile(client, releaseId, id);
      await client.query("COMMIT");
      return profile;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ }
      throw error;
    } finally { client.release(); }
  }
  async getSeatFacets(releaseId: ReleaseId): Promise<SeatFacets> { return getSeatFacets(this.pool, releaseId); }
  async listSources(releaseId: ReleaseId): Promise<readonly Source[]> { return listSources(this.pool, releaseId); }
  async listSourceSnapshots(releaseId: ReleaseId): Promise<readonly SourceSnapshot[]> { return listSourceSnapshots(this.pool, releaseId); }
}
