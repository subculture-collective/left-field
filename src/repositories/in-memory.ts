import { dataReleaseSchema } from "@/domain/contracts";
import type { DataRelease, PrototypeManifest, ReleaseId, SeatCycleId, Source, SourceSnapshot } from "@/domain/contracts";
import { seatPageSchema } from "@/domain/repository";
import type { ReleaseCoverageAggregate, SeatFacets, SeatListItem, SeatPage, SeatPageRequest, SeatProfile, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { createManifestSeatProjection } from "./manifest-projection";
import { decodeSeatCursor, normalizedSeatQuery, pageSortedSeatItems } from "./pagination";

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
  async listSeatPage(releaseId: ReleaseId, request: SeatPageRequest): Promise<SeatPage> {
    if (request.cursor) decodeSeatCursor(request.cursor, releaseId, normalizedSeatQuery(request));
    const page = releaseId === this.manifest.release.id ? pageSortedSeatItems(this.projection.list(normalizedSeatQuery(request)), releaseId, request) : { items: [], nextCursor: null, total: 0 };
    return seatPageSchema.parse({ releaseId, ...page });
  }
  async getSeatListItem(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatListItem | null> { return releaseId === this.manifest.release.id ? this.projection.item(id) : null; }
  async getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null> { return releaseId === this.manifest.release.id ? this.projection.profile(id) : null; }
  async getSeatFacets(releaseId: ReleaseId): Promise<SeatFacets> { return releaseId === this.manifest.release.id ? this.projection.facets() : { states: [], parties: [], incumbencyStatuses: [], electionYears: [] }; }
  async listSources(releaseId: ReleaseId): Promise<readonly Source[]> { return releaseId === this.manifest.release.id ? this.projection.sources() : []; }
  async listSourceSnapshots(releaseId: ReleaseId): Promise<readonly SourceSnapshot[]> { return releaseId === this.manifest.release.id ? this.projection.snapshots() : []; }
  async listReleaseCoverage(releaseId: ReleaseId): Promise<readonly ReleaseCoverageAggregate[]> { return releaseId === this.manifest.release.id ? this.projection.coverage() : []; }
}
