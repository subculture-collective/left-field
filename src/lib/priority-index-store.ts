import type { PriorityIndexRepository, ModelRelease } from "./priority-index-repository";
import type { PublicPriorityBrief } from "./house-priority-index";
import { housePriorityBriefs } from "./house-priority-index";

// This is the runtime-relevant version string shown in the UI.
const CURRENT_VERSION = "v0.9";
const CURRENT_PUBLISHED_AT = "2026-09-23";
const CURRENT_CUTOFF_DATE = "2026-08-04";

let _instance: FilesystemPriorityIndexRepository | undefined;

export class FilesystemPriorityIndexRepository implements PriorityIndexRepository {
  private _briefs: PublicPriorityBrief[] | undefined;

  getModelRelease(): ModelRelease {
    return {
      version: CURRENT_VERSION,
      publishedAt: CURRENT_PUBLISHED_AT,
      cutoffDate: CURRENT_CUTOFF_DATE,
    };
  }

  getBriefs(): readonly PublicPriorityBrief[] {
    if (!this._briefs) this._briefs = [...housePriorityBriefs()];
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