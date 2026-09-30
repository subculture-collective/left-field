import type { PriorityIndexRepository, ModelRelease } from "./priority-index-repository";
import type { PublicPriorityBrief } from "./house-priority-index";
import { housePriorityBriefsV11 } from "./house-priority-index";
import { readPriorityIndexRelease, type PriorityIndexRelease } from "./priority-index-release";
import { senatePriorityBriefs } from "./senate-priority-index";
import { governorPriorityBriefs } from "./governor-priority-index";
import { stateLegislativePriorityBriefs } from "./state-legislative-priority-index";

let _instance: FilesystemPriorityIndexRepository | undefined;

/** One list across chambers: sorted by score, then by stable seat id, then ranked. */
export const rankAcrossChambers = (briefs: readonly PublicPriorityBrief[]): PublicPriorityBrief[] =>
  [...briefs].sort((a, b) => b.provisionalTargetScore - a.provisionalTargetScore || a.seatCycleId.localeCompare(b.seatCycleId)).map((row, index) => ({ ...row, rank: index + 1 }));

export class FilesystemPriorityIndexRepository implements PriorityIndexRepository {
  private _briefs: PublicPriorityBrief[] | undefined;
  private _release: PriorityIndexRelease | undefined;

  getRelease(): PriorityIndexRelease {
    if (!this._release) this._release = readPriorityIndexRelease();
    return this._release;
  }

  getModelRelease(): ModelRelease {
    const release = this.getRelease();
    return { version: release.modelVersion, publishedAt: release.publishedAt, cutoffDate: release.sourceCutoff };
  }

  getBriefs(): readonly PublicPriorityBrief[] {
    if (!this._briefs) {
      const release = this.getRelease();
      this._briefs = rankAcrossChambers([...housePriorityBriefsV11(), ...senatePriorityBriefs(), ...governorPriorityBriefs(), ...(release.chambers.stateLegislative ? stateLegislativePriorityBriefs() : [])]);
    }
    return this._briefs;
  }

  getBrief(seatCycleId: string): PublicPriorityBrief | undefined {
    return this.getBriefs().find((row) => row.seatCycleId === seatCycleId);
  }
}

export class InMemoryPriorityIndexRepository implements PriorityIndexRepository {
  private readonly _briefs: PublicPriorityBrief[];
  private readonly _model: ModelRelease;

  constructor(briefs: readonly PublicPriorityBrief[], model?: Partial<ModelRelease>) {
    this._briefs = [...briefs].sort((a, b) => b.provisionalTargetScore - a.provisionalTargetScore || a.seatCycleId.localeCompare(b.seatCycleId)).map((row, index) => ({ ...row, rank: index + 1 }));
    this._model = { version: model?.version ?? "test", publishedAt: model?.publishedAt ?? "test", cutoffDate: model?.cutoffDate ?? "test" };
  }

  getModelRelease(): ModelRelease { return this._model; }
  getBriefs(): readonly PublicPriorityBrief[] { return this._briefs; }
  getBrief(seatCycleId: string): PublicPriorityBrief | undefined { return this._briefs.find((row) => row.seatCycleId === seatCycleId); }
}

/** Default singleton instance, lazily initialized from the filesystem. */
export function getDefaultPriorityRepository(): PriorityIndexRepository {
  if (!_instance) _instance = new FilesystemPriorityIndexRepository();
  return _instance;
}

/** Reset the singleton (primarily for testing). */
export function resetDefaultPriorityRepository(): void {
  _instance = undefined;
}