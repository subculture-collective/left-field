import { createHash } from "node:crypto";

export const CONGRESS_LIMITS = { pageLimit: 250, maxPages: 25, maxMembers: 2_000, maxResponseBytes: 2 * 1024 * 1024, timeoutMs: 10_000, detailConcurrency: 4 } as const;
export interface CongressMemberRecord { readonly bioguideId: string; readonly updateDate: string; readonly birthYear: string | null; readonly detailUrl: string; readonly rawRecordSha256: string; }
export type CongressFetch = (input: string, init?: RequestInit) => Promise<Response>;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Z][0-9]{6}$/.test(value);
const year = (value: unknown): value is string => typeof value === "string" && /^(?:17\d{2}|18\d{2}|19\d{2}|20\d{2}|21\d{2}|2200)$/.test(value);
const date = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === (value.includes(".") ? value : `${value.slice(0, -1)}.000Z`);
};
const allowed = (value: string, detail: boolean): URL => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("CONGRESS_URL_INVALID"); }
  const path = detail ? /^\/v3\/member\/[A-Z][0-9]{6}\/?$/ : /^\/v3\/member\/?$/;
  if (url.protocol !== "https:" || url.hostname !== "api.congress.gov" || url.port || !path.test(url.pathname)) throw new Error("CONGRESS_URL_DISALLOWED");
  return url;
};
const compareBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
function listPage(value: string): URL {
  const url = allowed(value, false);
  const offset = url.searchParams.get("offset");
  if (offset !== null && !/^(?:0|[1-9]\d*)$/.test(offset)) throw safeError("CONGRESS_PAGINATION_MALFORMED");
  url.search = "";
  url.searchParams.set("currentMember", "true");
  url.searchParams.set("limit", String(CONGRESS_LIMITS.pageLimit));
  if (offset !== null) url.searchParams.set("offset", offset);
  return url;
}
/** Removes credentials and non-identifying metadata before a detail URL is persisted. */
export function normalizeCongressDetailUrl(value: string): string {
  const url = allowed(value, true);
  url.search = "";
  url.hash = "";
  return url.toString();
}
const safeError = (code: string): Error => new Error(code);
async function json(fetcher: CongressFetch, url: URL, key: string, signal?: AbortSignal): Promise<{ value: unknown; bytes: Uint8Array }> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONGRESS_LIMITS.timeoutMs);
  const onAbort = () => controller.abort(); signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const request = new URL(url); request.searchParams.set("api_key", key);
    const response = await fetcher(request.toString(), { redirect: "error", signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw safeError("CONGRESS_HTTP_ERROR");
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > CONGRESS_LIMITS.maxResponseBytes) throw safeError("CONGRESS_RESPONSE_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > CONGRESS_LIMITS.maxResponseBytes) throw safeError("CONGRESS_RESPONSE_TOO_LARGE");
    try { return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), bytes }; } catch { throw safeError("CONGRESS_RESPONSE_MALFORMED"); }
  } catch (error) {
    if (controller.signal.aborted) throw safeError(signal?.aborted ? "CONGRESS_ABORTED" : "CONGRESS_TIMEOUT");
    if (error instanceof Error && error.message.startsWith("CONGRESS_")) throw error;
    throw safeError("CONGRESS_FETCH_FAILED");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const object = (value: unknown): Record<string, unknown> => { if (!isObject(value)) throw safeError("CONGRESS_RESPONSE_MALFORMED"); return value; };
function detail(value: unknown, url: string, bytes: Uint8Array): CongressMemberRecord {
  const root = object(value); const member = object(root.member);
  if (!id(member.bioguideId) || !date(member.updateDate) || (member.birthYear !== undefined && member.birthYear !== null && !year(member.birthYear))) throw safeError("CONGRESS_MEMBER_MALFORMED");
  return { bioguideId: member.bioguideId, updateDate: member.updateDate, birthYear: member.birthYear ?? null, detailUrl: url, rawRecordSha256: hash(bytes) };
}
export interface CongressFetchOptions { readonly fetch: CongressFetch; readonly apiKey: string; readonly listUrl?: string; readonly signal?: AbortSignal; }
/** Research/preflight-only parser: fetches no retained responses and performs no loading or replay. */
export async function fetchCongressMembers(options: CongressFetchOptions): Promise<readonly CongressMemberRecord[]> {
  if (!options.apiKey) throw safeError("CONGRESS_API_KEY_REQUIRED");
  let next = listPage(options.listUrl ?? "https://api.congress.gov/v3/member");
  const seenPages = new Set<string>(); const details: string[] = [];
  for (let page = 0; page < CONGRESS_LIMITS.maxPages && next; page++) {
    const pageKey = `${next.origin}${next.pathname}?${[...next.searchParams].filter(([k]) => k !== "api_key").sort().map(([k,v]) => `${k}=${v}`).join("&")}`;
    if (seenPages.has(pageKey)) throw safeError("CONGRESS_PAGINATION_CYCLE"); seenPages.add(pageKey);
    const response = await json(options.fetch, next, options.apiKey, options.signal); const root = object(response.value);
    if (!Array.isArray(root.members) || root.members.length > CONGRESS_LIMITS.pageLimit || !root.members.every(x => { try { const m = object(x); return typeof m.url === "string"; } catch { return false; } })) throw safeError("CONGRESS_LIST_MALFORMED");
    for (const item of root.members) { const url = normalizeCongressDetailUrl(String(object(item).url)); details.push(url); if (details.length > CONGRESS_LIMITS.maxMembers) throw safeError("CONGRESS_MEMBER_LIMIT"); }
    const pagination = object(root.pagination); if (pagination.next === null || pagination.next === undefined) break;
    if (typeof pagination.next !== "string") throw safeError("CONGRESS_PAGINATION_MALFORMED"); next = listPage(pagination.next);
    if (page === CONGRESS_LIMITS.maxPages - 1) throw safeError("CONGRESS_PAGE_LIMIT");
  }
  details.sort(compareBytes);
  const result: CongressMemberRecord[] = []; const seen = new Map<string, CongressMemberRecord>();
  for (let i = 0; i < details.length; i += CONGRESS_LIMITS.detailConcurrency) {
    const batch = await Promise.all(details.slice(i, i + CONGRESS_LIMITS.detailConcurrency).map(async url => { const r = await json(options.fetch, allowed(url, true), options.apiKey, options.signal); return detail(r.value, url, r.bytes); }));
    for (const record of batch) { const prior = seen.get(record.bioguideId); if (prior && (prior.rawRecordSha256 !== record.rawRecordSha256 || prior.updateDate !== record.updateDate || prior.birthYear !== record.birthYear)) throw safeError("CONGRESS_DUPLICATE_CONFLICT"); if (!prior) { seen.set(record.bioguideId, record); result.push(record); } }
  }
  return result.sort((a, b) => compareBytes(a.bioguideId, b.bioguideId));
}
