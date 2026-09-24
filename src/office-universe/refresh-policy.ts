import type { SourceRegistryEntry } from "./nationwide-intake";

export type RefreshWindow = "normal" | "filing_primary" | "election_night" | "post_certification" | "vacancy_watch";

export function refreshIntervalMinutes(
  source: SourceRegistryEntry,
  window: RefreshWindow,
): number {
  if (source.status !== "configured") return 24 * 60;
  if (window === "election_night" && source.family === "elections") return 15;
  if (window === "filing_primary" && ["elections", "officeholders", "finance"].includes(source.family)) return 24 * 60;
  if (window === "post_certification" && source.family === "elections") return 24 * 60;
  if (window === "vacancy_watch" && ["elections", "officeholders"].includes(source.family)) return 24 * 60;
  return source.refreshProfile === "weekly" ? 7 * 24 * 60 : source.refreshProfile === "nightly" ? 24 * 60 : source.refreshProfile === "daily" ? 24 * 60 : 15;
}

export function nextRefreshAt(
  source: SourceRegistryEntry,
  window: RefreshWindow,
  lastSuccessfulAt: Date | null,
  now: Date,
): Date {
  const base = lastSuccessfulAt ?? now;
  return new Date(base.valueOf() + refreshIntervalMinutes(source, window) * 60_000);
}
