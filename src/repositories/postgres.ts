import type { Pool } from "pg";
import { dataReleaseSchema } from "@/domain/contracts";
import type { DataRelease, ReleaseId, SeatCycleId, Source, SourceSnapshot } from "@/domain/contracts";
import type { ReleaseCoverageAggregate, SeatFacets, SeatListItem, SeatPage, SeatPageRequest, SeatProfile, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { getSeatProfile } from "./sql/get-seat-profile";
import { getSeatListItem, listSeatPage } from "./sql/list-seats";
import { getSeatFacets, listReleaseCoverage, listSourceSnapshots, listSources } from "./sql/list-sources";
import { boundedDuration, boundedFailureCode, emitOperationalSignal, signalTimestamp, type OperationalSignalSink } from "@/operations/signals";
import { getRuntimeOperationalSignalSink } from "@/operations/runtime-signals";

const releaseSql = `SELECT id, label, status, source_cutoff AS "sourceCutoff", created_at AS "createdAt",
  published_at AS "publishedAt", previous_release_id AS "previousReleaseId" FROM data_releases`;

function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  return value;
}

export class PostgresSeatResearchRepository implements SeatResearchRepository {
  public constructor(private readonly pool: Pool, private readonly signalSink: OperationalSignalSink = getRuntimeOperationalSignalSink()) {}
  private async observe<T>(operation: "get_active_release" | "get_release" | "list_seats" | "list_seat_page" | "get_seat_list_item" | "get_seat_profile" | "get_seat_facets" | "list_sources" | "list_source_snapshots" | "list_release_coverage", releaseId: ReleaseId | undefined, work: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try { const value = await work(); emitOperationalSignal(this.signalSink, { version: 1, timestamp: signalTimestamp(), kind: "repository", operation, ...(releaseId ? { releaseId } : {}), outcome: "success", durationMs: boundedDuration(startedAt) }); return value; }
    catch (error) { emitOperationalSignal(this.signalSink, { version: 1, timestamp: signalTimestamp(), kind: "repository", operation, ...(releaseId ? { releaseId } : {}), outcome: "failure", failureCode: boundedFailureCode("repository"), durationMs: boundedDuration(startedAt) }); throw error; }
  }
  async getActiveRelease(): Promise<DataRelease> {
    return this.observe("get_active_release", undefined, async () => { const result = await this.pool.query(`${releaseSql} WHERE status = 'published'`);
    if (result.rowCount !== 1) throw new Error("Expected exactly one published release");
    return dataReleaseSchema.parse(normalizeDates(result.rows[0])); });
  }
  async getRelease(id: ReleaseId): Promise<DataRelease | null> {
    return this.observe("get_release", id, async () => { const result = await this.pool.query(`${releaseSql} WHERE id = $1`, [id]); return result.rowCount === 0 ? null : dataReleaseSchema.parse(normalizeDates(result.rows[0])); });
  }
  async listSeatPage(releaseId: ReleaseId, request: SeatPageRequest): Promise<SeatPage> { return this.observe("list_seat_page", releaseId, () => listSeatPage(this.pool, releaseId, request)); }
  async getSeatListItem(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatListItem | null> { return this.observe("get_seat_list_item", releaseId, () => getSeatListItem(this.pool, releaseId, id)); }
  /** Legacy compatibility only; callers should use listSeatPage. */
  async listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]> {
    return this.observe("list_seats", releaseId, async () => { const items: SeatListItem[] = []; const seenCursors = new Set<string>(); let cursor: string | undefined;
    for (let pageCount = 0; pageCount < 10_000; pageCount += 1) {
      const page = await listSeatPage(this.pool, releaseId, { ...query, limit: 100, ...(cursor ? { cursor } : {}) });
      items.push(...page.items);
      if (page.nextCursor === null) return items;
      if (seenCursors.has(page.nextCursor)) throw new Error("Seat page cursor did not advance");
      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    throw new Error("Seat page cursor exceeded compatibility limit"); });
  }
  async getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null> {
    return this.observe("get_seat_profile", releaseId, async () => { const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      const profile = await getSeatProfile(client, releaseId, id);
      await client.query("COMMIT");
      return profile;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve the original failure */ }
      throw error;
    } finally { client.release(); } });
  }
  async getSeatFacets(releaseId: ReleaseId): Promise<SeatFacets> { return this.observe("get_seat_facets", releaseId, () => getSeatFacets(this.pool, releaseId)); }
  async listSources(releaseId: ReleaseId): Promise<readonly Source[]> { return this.observe("list_sources", releaseId, () => listSources(this.pool, releaseId)); }
  async listSourceSnapshots(releaseId: ReleaseId): Promise<readonly SourceSnapshot[]> { return this.observe("list_source_snapshots", releaseId, () => listSourceSnapshots(this.pool, releaseId)); }
  async listReleaseCoverage(releaseId: ReleaseId): Promise<readonly ReleaseCoverageAggregate[]> { return this.observe("list_release_coverage", releaseId, () => listReleaseCoverage(this.pool, releaseId)); }
}
