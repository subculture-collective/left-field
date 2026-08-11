import type { PublicPriorityBrief } from "./house-priority-index";

export type ModelRelease = Readonly<{
  version: string;
  publishedAt: string;
  cutoffDate: string;
}>;

export interface PriorityIndexRepository {
  /** Returns the current model release metadata. */
  getModelRelease(): ModelRelease;
  /** Returns all scored briefs ranked by provisional target score descending. */
  getBriefs(): readonly PublicPriorityBrief[];
  /** Returns a single scored brief or undefined if the seatCycleId is not in the index. */
  getBrief(seatCycleId: string): PublicPriorityBrief | undefined;
}