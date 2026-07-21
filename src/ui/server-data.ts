// Server-only import convention: this module imports database and canonical data adapters; do not import it from client components.
import { canonicalManifest } from "@/data/canonical-manifest";
import { seatPageRequestSchema, seatQuerySchema, seatRouteParamsSchema } from "@/domain/repository";
import type { ReleaseId, SeatCycleId } from "@/domain/contracts";
import type { SeatPageRequest, SeatQuery, SeatResearchRepository } from "@/domain/repository";
import { getPool } from "@/db/client";
import { PostgresSeatResearchRepository } from "@/repositories/postgres";
import { compileBrowsePage, compileMethodologyPage, compileProfilePage, compileSourcesPage } from "./view-models";
import type { BrowsePageViewModel, MethodologyPageViewModel, ProfilePageViewModel, SourcesPageViewModel } from "./view-models";

export type RouteDataResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: "invalid_request" | "not_found" | "unavailable" | "configuration" }>;
type UrlQuery = Record<string, string | readonly string[] | undefined>;

/** Rejects unknown and demographic keys before a repository can receive the query. */
export function parseBrowseQuery(input: UrlQuery): RouteDataResult<SeatPageRequest> {
  const allowed = new Set(["identitySearch", "chamber", "stateCode", "party", "incumbencyStatus", "electionYear", "sort", "direction", "cursor"]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || Object.values(input).some((value) => Array.isArray(value))) return { ok: false, code: "invalid_request" };
  const normalized = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== ""));
  const parsed = seatPageRequestSchema.safeParse({ ...normalized, limit: 50, electionYear: normalized.electionYear === undefined ? undefined : Number(normalized.electionYear) });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: "invalid_request" };
}
function queryFromPageRequest(request: SeatPageRequest): SeatQuery {
  const { cursor, limit, ...query } = request;
  void cursor; void limit;
  return seatQuerySchema.parse(query);
}
export function classifyProfileRequest(releaseId: ReleaseId, params: Record<string, string>): RouteDataResult<Readonly<{ id: SeatCycleId }>> {
  const parsed = seatRouteParamsSchema.safeParse({ releaseId, ...params });
  return parsed.success ? { ok: true, value: { id: parsed.data.id } } : { ok: false, code: "invalid_request" };
}
/** Maps an absent profile or active-release browse row to a finite public error. */
export function classifyProfileLookup<T>(value: T | null | undefined): RouteDataResult<T> {
  return value === null || value === undefined ? { ok: false, code: "not_found" } : { ok: true, value };
}

async function repository(): Promise<SeatResearchRepository> {
  if (process.env.DATABASE_URL) return new PostgresSeatResearchRepository(getPool());
  if (process.env.NODE_ENV === "production") throw new RouteDataConfigurationError();
  const { InMemorySeatResearchRepository } = await import("@/repositories/in-memory");
  return new InMemorySeatResearchRepository(canonicalManifest);
}
class RouteDataConfigurationError extends Error { public constructor() { super("DATABASE_URL is required in production for route data"); } }
async function safely<T>(load: () => Promise<T>): Promise<RouteDataResult<T>> { try { return { ok: true, value: await load() }; } catch (error) { return { ok: false, code: error instanceof RouteDataConfigurationError ? "configuration" : "unavailable" }; } }

export async function loadBrowsePage(query: UrlQuery, repositoryOverride?: SeatResearchRepository): Promise<RouteDataResult<BrowsePageViewModel>> {
  const parsed = parseBrowseQuery(query); if (!parsed.ok) return parsed;
  return safely(async () => { const repo = repositoryOverride ?? await repository(); const active = await repo.getActiveRelease(); const [page, facets] = await Promise.all([repo.listSeatPage(active.id, parsed.value), repo.getSeatFacets(active.id)]); return compileBrowsePage(active, page, queryFromPageRequest(parsed.value), facets); });
}
export async function loadProfilePage(params: Record<string, string>, repositoryOverride?: SeatResearchRepository): Promise<RouteDataResult<ProfilePageViewModel>> {
  let repo: SeatResearchRepository; let active;
  try { repo = repositoryOverride ?? await repository(); active = await repo.getActiveRelease(); } catch (error) { return { ok: false, code: error instanceof RouteDataConfigurationError ? "configuration" : "unavailable" }; }
  const parsed = classifyProfileRequest(active.id, params); if (!parsed.ok) return parsed;
  try { const [profile, seat] = await Promise.all([repo.getSeatProfile(active.id, parsed.value.id), repo.getSeatListItem(active.id, parsed.value.id)]); const foundProfile = classifyProfileLookup(profile); const foundSeat = classifyProfileLookup(seat); if (!foundProfile.ok) return foundProfile; if (!foundSeat.ok) return foundSeat; return { ok: true, value: compileProfilePage(foundProfile.value, foundSeat.value) }; } catch { return { ok: false, code: "unavailable" }; }
}
export async function loadSourcesPage(repositoryOverride?: SeatResearchRepository): Promise<RouteDataResult<SourcesPageViewModel>> {
  return safely(async () => { const repo = repositoryOverride ?? await repository(); const active = await repo.getActiveRelease(); const [sources, snapshots, coverage] = await Promise.all([repo.listSources(active.id), repo.listSourceSnapshots(active.id), repo.listReleaseCoverage(active.id)]); return compileSourcesPage(active, sources, snapshots, coverage); });
}
export async function loadMethodologyPage(repositoryOverride?: SeatResearchRepository): Promise<RouteDataResult<MethodologyPageViewModel>> { return safely(async () => compileMethodologyPage(await (repositoryOverride ?? await repository()).getActiveRelease())); }
