import type { Pool } from "pg";
import { dataReleaseSchema } from "@/domain/contracts";
import type { DataRelease, ReleaseId, SeatCycleId, Source } from "@/domain/contracts";
import type { SeatListItem, SeatProfile, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { loadPrototypeManifest } from "@/db/manifest";
import { createManifestSeatProjection } from "./manifest-projection";

export class PostgresSeatResearchRepository implements SeatResearchRepository {
  public constructor(private readonly pool: Pool) {}
  async getActiveRelease(): Promise<DataRelease> { const result = await this.pool.query("SELECT id FROM data_releases WHERE status='published'"); if (result.rowCount !== 1) throw new Error("Expected exactly one published release"); return dataReleaseSchema.parse((await loadPrototypeManifest(this.pool, result.rows[0]!.id)).release); }
  async getRelease(id: ReleaseId): Promise<DataRelease | null> { const result = await this.pool.query("SELECT id FROM data_releases WHERE id=$1", [id]); return result.rowCount === 0 ? null : dataReleaseSchema.parse((await loadPrototypeManifest(this.pool, id)).release); }
  /** Confirms absence cheaply; an existing release is hydrated exactly once per read. */
  private async projection(releaseId: ReleaseId) { const result = await this.pool.query("SELECT 1 FROM data_releases WHERE id=$1", [releaseId]); return result.rowCount === 0 ? null : createManifestSeatProjection(await loadPrototypeManifest(this.pool, releaseId)); }
  async listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]> { return (await this.projection(releaseId))?.list(query) ?? []; }
  async getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null> { return (await this.projection(releaseId))?.profile(id) ?? null; }
  async listSources(releaseId: ReleaseId): Promise<readonly Source[]> { return (await this.projection(releaseId))?.sources() ?? []; }
}
