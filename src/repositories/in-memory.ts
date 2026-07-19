import { dataReleaseSchema } from "@/domain/contracts";
import type { DataRelease, PrototypeManifest, ReleaseId, SeatCycleId, Source } from "@/domain/contracts";
import type { SeatListItem, SeatProfile, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { createManifestSeatProjection } from "./manifest-projection";

function checkedManifest(input: PrototypeManifest): PrototypeManifest {
  const result = validatePrototypeManifest(input);
  if (!result.success) throw new Error(`Cannot create seat repository from invalid manifest: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.data;
}

export class InMemorySeatResearchRepository implements SeatResearchRepository {
  private readonly projection;
  private readonly manifest: PrototypeManifest;
  public constructor(manifest: PrototypeManifest) {
    if (process.env.NODE_ENV === "production") throw new Error("In-memory SeatResearchRepository is unavailable in production");
    this.manifest = checkedManifest(manifest); this.projection = createManifestSeatProjection(this.manifest);
  }
  async getActiveRelease(): Promise<DataRelease> { return dataReleaseSchema.parse(this.manifest.release); }
  async getRelease(id: ReleaseId): Promise<DataRelease | null> { return id === this.manifest.release.id ? dataReleaseSchema.parse(this.manifest.release) : null; }
  async listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]> { return releaseId === this.manifest.release.id ? this.projection.list(query) : []; }
  async getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null> { return releaseId === this.manifest.release.id ? this.projection.profile(id) : null; }
  async listSources(releaseId: ReleaseId): Promise<readonly Source[]> { return releaseId === this.manifest.release.id ? this.projection.sources() : []; }
}
