import { createHash } from "node:crypto";
import { fecFilingIdentitySha256, type FecFilingIdentityV1, type FecFormType } from "./filing-ledger";
import { isFecReportType } from "./values";

export const FEC_V2_ERRORS = ["FEC_V2_ABORTED", "FEC_V2_DEADLINE", "FEC_V2_TIMEOUT", "FEC_V2_BUDGET", "FEC_V2_FETCH", "FEC_V2_HTTP", "FEC_V2_SOURCE_UNAVAILABLE", "FEC_V2_RESPONSE_URL", "FEC_V2_ENCODING", "FEC_V2_MEDIA", "FEC_V2_BODY_TOO_LARGE", "FEC_V2_BODY", "FEC_V2_JSON", "FEC_V2_RESPONSE", "FEC_V2_FEC_URL"] as const;
export type FecV2ErrorCode = typeof FEC_V2_ERRORS[number];
const isCode = (code: unknown): code is FecV2ErrorCode => typeof code === "string" && (FEC_V2_ERRORS as readonly string[]).includes(code);
export class FecV2TransportError extends Error { constructor(code: FecV2ErrorCode) { const valid = isCode(code) ? code : "FEC_V2_FETCH"; super(valid); this.code = valid; this.name = "FecV2TransportError"; } readonly code: FecV2ErrorCode; }
const fail = (code: FecV2ErrorCode): never => { throw new FecV2TransportError(code); };
const OPENFEC = "https://api.open.fec.gov/v1/filings/", RETRIES = 3, RETRY_DELAYS = [250, 500] as const, CLEANUP_MS = 10;
type Kind = "openfec" | "docquery";
const limits = { openfec: { attempts: 20_000, bytes: 41_943_040_000, body: 2_097_152, timeout: 15_000 }, docquery: { attempts: 100_000, bytes: 68_719_476_736, body: 16_777_216, timeout: 30_000 } } as const;
const forms = new Set<FecFormType>(["F3", "F3X", "F24", "F5"]);
const asError = (e: unknown, fallback: FecV2ErrorCode) => e instanceof FecV2TransportError && isCode(e.code) ? e : new FecV2TransportError(fallback);
const sha = (v: Uint8Array | string) => createHash("sha256").update(v).digest("hex");
const nowClock = { now: Date.now };
export type FecV2Clock = Readonly<{ now(): number }>;
export type FecV2Fetch = (input: URL, init: RequestInit) => Promise<Response>;
export type FecV2Dependencies = Readonly<{ fetch?: FecV2Fetch; sleep?: (ms: number, signal: AbortSignal) => Promise<void>; clock?: FecV2Clock }>;
type CapturedDependencies = Readonly<{ fetch: FecV2Fetch; sleep: (ms: number, signal: AbortSignal) => Promise<void>; clock: FecV2Clock }>;
type Counters = { attempts: number; bytes: number; reservedAttempts: number; reservedBytes: number };

export class FecV2RunBudget {
  readonly signal: AbortSignal; readonly deadline: number; private readonly clock: FecV2Clock;
  private readonly used: Record<Kind, Counters> = { openfec: { attempts: 0, bytes: 0, reservedAttempts: 0, reservedBytes: 0 }, docquery: { attempts: 0, bytes: 0, reservedAttempts: 0, reservedBytes: 0 } };
  constructor(options: Readonly<{ signal: AbortSignal; deadline?: number; clock?: FecV2Clock }>) { this.signal = options.signal; this.clock = options.clock ?? nowClock; const n = this.clock.now(); this.deadline = options.deadline ?? n + 21_600_000; if (!Number.isFinite(this.deadline) || this.deadline <= n || this.deadline > n + 21_600_000) fail("FEC_V2_DEADLINE"); }
  private check() { if (this.signal.aborted) fail("FEC_V2_ABORTED"); if (this.clock.now() >= this.deadline) fail("FEC_V2_DEADLINE"); }
  reserve(kind: Kind): FecV2Lease { return this.reserveMany(kind, 1)[0]!; }
  /** Check an atomic admission without changing counters (used by enumerators before I/O). */
  assertCanAdmit(kind: Kind, count: number): void {
    this.check(); const l = limits[kind], c = this.used[kind];
    if (!Number.isSafeInteger(count) || count < 1 || this.deadline - this.clock.now() < RETRIES * l.timeout + RETRY_DELAYS[0] + RETRY_DELAYS[1]) fail("FEC_V2_DEADLINE");
    if (c.attempts + c.reservedAttempts + count * RETRIES > l.attempts || c.bytes + c.reservedBytes + count * RETRIES * l.body > l.bytes) fail("FEC_V2_BUDGET");
  }
  /** Atomically reserve complete logical requests; no request can start if this fails. */
  reserveMany(kind: Kind, count: number): FecV2Lease[] {
    this.assertCanAdmit(kind, count); const l = limits[kind], c = this.used[kind];
    c.reservedAttempts += count * RETRIES; c.reservedBytes += count * RETRIES * l.body;
    return Array.from({ length: count }, () => new FecV2Lease(this, c, l.body));
  }
  snapshot(): Readonly<{ openfec: Readonly<Counters>; docquery: Readonly<Counters>; deadline: number }> { return { openfec: { ...this.used.openfec }, docquery: { ...this.used.docquery }, deadline: this.deadline }; }
  assertLive() { this.check(); }
  /** The budget clock is intentionally exposed for deadline-aware local operations. */
  now(): number { return this.clock.now(); }
}
class FecV2Lease {
  private started = 0; private closed = false; private active: { remaining: number } | undefined;
  constructor(private readonly budget: FecV2RunBudget, private readonly c: Counters, private readonly cap: number) {}
  start() { this.budget.assertLive(); if (this.closed || this.active || this.started === RETRIES || this.c.reservedAttempts < 1 || this.c.reservedBytes < this.cap) fail("FEC_V2_BUDGET"); this.started++; this.c.reservedAttempts--; this.c.attempts++; this.active = { remaining: this.cap }; }
  bytes(n: number) { const active = this.active; if (!active || !Number.isSafeInteger(n) || n < 0) return fail("FEC_V2_BODY_TOO_LARGE"); if (n > active.remaining) { this.c.reservedBytes -= active.remaining; this.c.bytes += n; active.remaining = 0; return fail("FEC_V2_BODY_TOO_LARGE"); } active.remaining -= n; this.c.reservedBytes -= n; this.c.bytes += n; }
  conservativeCharge() { this.end(); }
  end() { if (this.active) { this.c.reservedBytes -= this.active.remaining; this.active = undefined; } }
  close() { if (!this.closed) { this.end(); const pending = RETRIES - this.started; this.c.reservedAttempts -= pending; this.c.reservedBytes -= pending * this.cap; this.closed = true; } }
}

export type FecV2Evidence = Readonly<{ kind: "daily_partition"; formType: FecFormType; receiptDate: string }> | Readonly<{ kind: "predecessor_lookup"; formType: FecFormType; requestedFileNumber: number }>;
declare const fecUrlBrand: unique symbol;
export type FecV2FecUrl = string & { readonly [fecUrlBrand]: true };
export type FecV2Filing = Readonly<{ identity: FecFilingIdentityV1; fecUrl: FecV2FecUrl | null }>;
export type FecV2Receipt = Readonly<{ requestSha256: string; upstreamBodySha256: string; bytes: number; retrievedAt: string }>;
export type FecV2OpenFecPage = Readonly<{ records: readonly FecV2Filing[]; receipt: FecV2Receipt }>;
const positive = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const validDate = (v: unknown): v is string => { if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; try { const date = new Date(`${v}T00:00:00.000Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v; } catch { return false; } };
/** OpenFEC date fields are either date-only or a date's midnight representation.
 * A non-zero offset that crosses a UTC day is deliberately not silently relabelled. */
const openFecDate = (v: unknown): string | undefined => {
  if (validDate(v)) return v;
  if (typeof v !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.exec(v);
  if (!match || !validDate(match[1])) return undefined;
  // A zone-less OpenFEC timestamp is a date representation, not an instant.
  if (!match[2]) return match[1];
  const parsed = new Date(v);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === match[1] ? match[1] : undefined;
};
const nullableDate = (v: unknown) => v === null || v === undefined ? null : openFecDate(v) ?? fail("FEC_V2_RESPONSE");
const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, ms); signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error()); }, { once: true }); });
/** Read dependencies before a budget reservation: callers may supply throwing getters. */
const captureDependencies = (dependencies?: FecV2Dependencies): CapturedDependencies => {
  const d = dependencies ?? {};
  const clock = d.clock ?? nowClock, fetcher = d.fetch ?? fetch, sleep = d.sleep ?? defaultSleep;
  return { clock, fetch: fetcher, sleep };
};
const isJson = (v: string | null) => { const x = v?.split(";", 1)[0]?.trim().toLowerCase(); return x === "application/json" || !!x && /^application\/[!#$%&'*+.^_`|~0-9a-z-]+\+json$/.test(x); };
const media = (v: string | null) => ["application/octet-stream", "binary/octet-stream", "text/plain"].includes(v?.split(";", 1)[0]?.trim().toLowerCase() ?? "");
/** Credential-free canonical request receipt descriptor. */
export const fecV2RequestSha256 = (url: URL, kind: Kind): string => sha(`${JSON.stringify({ method: "GET", url: url.toString(), headers: kind === "openfec" ? [["accept", "application/json"], ["accept-encoding", "identity"]] : [["accept", "application/octet-stream, binary/octet-stream, text/plain"], ["accept-encoding", "identity"]] })}\n`);
function checkedUrl(value: unknown, file: number): FecV2FecUrl | null { if (value == null) return null; const expected = `https://docquery.fec.gov/dcdev/posted/${file}.fec`; if (typeof value !== "string" || value.length > 512 || value !== expected) fail("FEC_V2_FEC_URL"); try { const u = new URL(value as string); if (u.origin !== "https://docquery.fec.gov" || u.username || u.password || u.search || u.hash || u.pathname !== `/dcdev/posted/${file}.fec`) fail("FEC_V2_FEC_URL"); return value as FecV2FecUrl; } catch (e) { throw asError(e, "FEC_V2_FEC_URL"); } }
/** The sole OpenFEC-to-ledger projection. Numeric identifiers are never coerced. */
export function projectOpenFecFiling(raw: unknown): FecV2Filing {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("FEC_V2_RESPONSE"); const r = raw as Record<string, unknown>;
    const file = positive(r.file_number) ? r.file_number : fail("FEC_V2_RESPONSE"), receipt = openFecDate(r.receipt_date) ?? fail("FEC_V2_RESPONSE");
    const match = typeof r.form_type === "string" && /^(F3X|F24|F3|F5)([ANT])?$/.exec(r.form_type); if (!match) return fail("FEC_V2_RESPONSE"); const form = match[1]! as FecFormType;
    const explicit = r.amendment_indicator; const indicator: "A" | "N" | "T" | null = explicit === null ? null : explicit === "A" || explicit === "N" || explicit === "T" ? explicit : fail("FEC_V2_RESPONSE");
    if (match[2] && indicator !== match[2]) fail("FEC_V2_RESPONSE");
    const rawPrior = r.previous_file_number, rawChain = r.amendment_chain;
    if (!Array.isArray(rawChain) || !rawChain.length || rawChain.length > 100 || !rawChain.every(positive) || new Set(rawChain).size !== rawChain.length || rawChain.at(-1) !== file) fail("FEC_V2_RESPONSE");
    const chain = rawChain as number[];
    const prior = rawPrior === file ? null : rawPrior === null ? null : positive(rawPrior) ? rawPrior : fail("FEC_V2_RESPONSE");
    if (prior !== (chain.length === 1 ? null : chain.at(-2)!)) fail("FEC_V2_RESPONSE");
    const electronic = r.means_filed === "e-file" ? "electronic" : r.means_filed === "paper" ? "paper" : r.means_filed === null || r.means_filed === "unknown" || r.means_filed === "other" ? "unknown" : fail("FEC_V2_RESPONSE");
    const reportType = isFecReportType(r.report_type) ? r.report_type : fail("FEC_V2_RESPONSE"), url = checkedUrl(r.fec_url, file);
    const committeeId = typeof r.committee_id === "string" && /^C\d{8}$/.test(r.committee_id) ? r.committee_id : fail("FEC_V2_RESPONSE");
    const id: FecFilingIdentityV1 = { fileNumber: file, previousFileNumber: prior, canonicalFormType: form, baseFormType: form, reportType, reportDate: nullableDate(r.report_date), receiptDate: receipt, coverageStartDate: nullableDate(r.coverage_start_date), coverageEndDate: nullableDate(r.coverage_end_date), amendmentIndicator: indicator, filerId: committeeId, committeeId, electronicStatus: electronic, rawAvailability: url ? "available" : electronic === "paper" ? "paper" : electronic === "electronic" ? "unavailable" : "unknown", authoritativeAmendmentChain: chain as number[] };
    fecFilingIdentitySha256(id); return { identity: id, fecUrl: url };
  } catch (e) { throw asError(e, "FEC_V2_RESPONSE"); }
}
async function raced<T>(op: Promise<T>, run: AbortSignal, attempt: AbortSignal, deadline: number, clock: FecV2Clock): Promise<T> {
  if (run.aborted) fail("FEC_V2_ABORTED"); if (clock.now() >= deadline) fail("FEC_V2_TIMEOUT");
  return new Promise<T>((resolve, reject) => { const done = (fn: () => void) => { clearTimeout(timer); run.removeEventListener("abort", abort); attempt.removeEventListener("abort", timeout); fn(); }; const abort = () => done(() => reject(new FecV2TransportError("FEC_V2_ABORTED"))), timeout = () => done(() => reject(new FecV2TransportError("FEC_V2_TIMEOUT"))), timer = setTimeout(timeout, Math.max(0, deadline - clock.now())); run.addEventListener("abort", abort, { once: true }); attempt.addEventListener("abort", timeout, { once: true }); op.then(v => done(() => resolve(v)), e => done(() => reject(e))); });
}
async function cleanup(response: Response | undefined) { try { const task = response?.body?.cancel(); if (task) await Promise.race([Promise.resolve(task), new Promise<void>(resolve => setTimeout(resolve, CLEANUP_MS))]); } catch { /* cleanup never escapes */ } }
/** A docquery absence is trustworthy only when its response has no bytes at all. */
async function emptyBody(response: Response, lease: FecV2Lease, run: AbortSignal, attempt: AbortSignal, deadline: number, clock: FecV2Clock): Promise<boolean> {
  if (!response.body) return true;
  const reader = response.body.getReader(); let complete = false;
  try {
    for (;;) { const part = await raced(reader.read(), run, attempt, deadline, clock); if (part.done) { complete = true; return true; } lease.bytes(part.value.byteLength); if (part.value.byteLength) return false; }
  } catch (e) { throw asError(e, "FEC_V2_BODY");
  } finally { if (!complete) { lease.conservativeCharge(); await cleanup(response); } try { reader.releaseLock(); } catch {} }
}
async function readBody(response: Response, lease: FecV2Lease, cap: number, run: AbortSignal, attempt: AbortSignal, deadline: number, clock: FecV2Clock, consume?: (chunk: Uint8Array, context: { signal: AbortSignal; deadlineMs: number }) => void | Promise<void>) {
  const stream = response.body; if (!stream) return fail("FEC_V2_BODY"); const reader = stream.getReader(), chunks: Uint8Array[] | undefined = consume ? undefined : [], hash = createHash("sha256"); let total = 0, complete = false;
  try { for (;;) { const part = await raced(reader.read(), run, attempt, deadline, clock); if (part.done) { complete = true; break; } lease.bytes(part.value.byteLength); total += part.value.byteLength; hash.update(part.value); if (total > cap) fail("FEC_V2_BODY_TOO_LARGE"); if (consume) await raced(Promise.resolve(consume(part.value, { signal: AbortSignal.any([run, attempt]), deadlineMs: deadline })), run, attempt, deadline, clock); else chunks!.push(part.value); } return { bytes: chunks ? Buffer.concat(chunks.map(Buffer.from), total) : undefined, hash: hash.digest("hex"), total }; }
  catch (e) { throw asError(e, "FEC_V2_BODY"); } finally { if (!complete) { lease.conservativeCharge(); await cleanup(response); } try { reader.releaseLock(); } catch {} }
}
async function request(kind: Kind, url: URL, budget: FecV2RunBudget, deps: CapturedDependencies, lease: FecV2Lease, apiKey: string | undefined, consume: ((chunk: Uint8Array, context: { signal: AbortSignal; deadlineMs: number }) => void | Promise<void>) | undefined, run: AbortSignal): Promise<{ bytes?: Uint8Array; receipt: FecV2Receipt }> {
  try { const { clock, fetch: fetcher, sleep } = deps, l = limits[kind]; for (let retry = 0; retry < RETRIES; retry++) { lease.start(); const deadline = Math.min(budget.deadline, clock.now() + l.timeout), controller = new AbortController(), signal = AbortSignal.any([run, controller.signal]), attemptTimer = setTimeout(() => controller.abort(), Math.max(0, deadline - clock.now())); let response: Response | undefined;
    try { response = await raced(fetcher(url, { method: "GET", redirect: "error", cache: "no-store", headers: kind === "openfec" ? { Accept: "application/json", "Accept-Encoding": "identity", "X-Api-Key": apiKey! } : { Accept: "application/octet-stream, binary/octet-stream, text/plain", "Accept-Encoding": "identity" }, signal }), run, controller.signal, deadline, clock);
      const reject = async (code: FecV2ErrorCode): Promise<never> => { await cleanup(response); return fail(code); };
      if (!response.url || response.url !== url.toString()) await reject("FEC_V2_RESPONSE_URL"); const retryable = response.status === 429 || response.status >= 500; if (response.status !== 200) { if (kind === "docquery" && (response.status === 404 || response.status === 410) && await emptyBody(response, lease, run, controller.signal, deadline, clock)) fail("FEC_V2_SOURCE_UNAVAILABLE"); lease.conservativeCharge(); await cleanup(response); if (!retryable || retry === RETRIES - 1) fail("FEC_V2_HTTP"); } else { if ((response.headers.get("content-encoding") ?? "identity").trim().toLowerCase() !== "identity") await reject("FEC_V2_ENCODING"); if (kind === "openfec" ? !isJson(response.headers.get("content-type")) : !media(response.headers.get("content-type"))) await reject("FEC_V2_MEDIA"); const got = await readBody(response, lease, l.body, run, controller.signal, deadline, clock, consume); budget.assertLive(); if (clock.now() >= deadline) fail("FEC_V2_TIMEOUT"); return { bytes: got.bytes, receipt: { requestSha256: fecV2RequestSha256(url, kind), upstreamBodySha256: got.hash, bytes: got.total, retrievedAt: new Date(clock.now()).toISOString() } }; }
    } catch (e) { await cleanup(response); const error = asError(e, "FEC_V2_FETCH"); if (error.code !== "FEC_V2_FETCH" || retry === RETRIES - 1) throw error; } finally { clearTimeout(attemptTimer); controller.abort(); lease.end(); }
    const delay = RETRY_DELAYS[retry]!; if (budget.deadline - clock.now() < delay) fail("FEC_V2_DEADLINE"); const sleepController = new AbortController(), sleepTimer = setTimeout(() => sleepController.abort(), Math.max(0, budget.deadline - clock.now())); try { await raced(sleep(delay, AbortSignal.any([run, sleepController.signal])), run, sleepController.signal, budget.deadline, clock); } catch (e) { throw asError(e, "FEC_V2_FETCH"); } finally { clearTimeout(sleepTimer); sleepController.abort(); }
  } return fail("FEC_V2_FETCH"); } finally { lease.close(); }
}
function validate(e: FecV2Evidence, page: number) { if (!Number.isSafeInteger(page) || page < 1 || page > (e.kind === "daily_partition" ? 1000 : 2) || !forms.has(e.formType) || (e.kind === "daily_partition" ? !validDate(e.receiptDate) : !positive(e.requestedFileNumber))) fail("FEC_V2_RESPONSE"); }
function validateApiKey(apiKey: string) { if (!apiKey || apiKey.length > 256 || apiKey !== apiKey.trim() || /[\u0000-\u0020\u007f]/.test(apiKey)) fail("FEC_V2_RESPONSE"); }
async function fetchPage(options: Readonly<{ budget: FecV2RunBudget; apiKey: string; evidence: FecV2Evidence; page: number; dependencies?: FecV2Dependencies }>, lease?: FecV2Lease, run?: AbortSignal): Promise<FecV2OpenFecPage> {
  validateApiKey(options.apiKey); validate(options.evidence, options.page); const deps = captureDependencies(options.dependencies), e = options.evidence, requestRun = run ?? options.budget.signal, q = e.kind === "daily_partition" ? [["form_type", e.formType], ["min_receipt_date", e.receiptDate], ["max_receipt_date", e.receiptDate]] : [["file_number", String(e.requestedFileNumber)]]; q.push(["page", String(options.page)], ["per_page", "100"], ["sort", "receipt_date"]); const url = new URL(OPENFEC); url.search = new URLSearchParams(q).toString(); const own = lease ?? options.budget.reserve("openfec"); const got = await request("openfec", url, options.budget, deps, own, options.apiKey, undefined, requestRun); options.budget.assertLive(); let root: unknown; try { root = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(got.bytes!)); } catch { fail("FEC_V2_JSON"); } options.budget.assertLive(); if (!root || typeof root !== "object" || !Array.isArray((root as { results?: unknown }).results) || (root as { results: unknown[] }).results.length > 100) fail("FEC_V2_RESPONSE"); const records: FecV2Filing[] = []; for (const raw of (root as { results: unknown[] }).results) { options.budget.assertLive(); records.push(projectOpenFecFiling(raw)); } options.budget.assertLive();
  if (e.kind === "daily_partition") { if (records.some(r => r.identity.canonicalFormType !== e.formType || r.identity.receiptDate !== e.receiptDate) || options.page === 1000 && records.length) fail("FEC_V2_RESPONSE"); } else if (options.page === 1 ? records.length !== 1 || records[0]!.identity.fileNumber !== e.requestedFileNumber || records[0]!.identity.canonicalFormType !== e.formType : records.length !== 0) fail("FEC_V2_RESPONSE"); return { records, receipt: got.receipt };
}
export async function fetchOpenFecFilingsPage(options: Readonly<{ budget: FecV2RunBudget; apiKey: string; evidence: FecV2Evidence; page: number; dependencies?: FecV2Dependencies }>): Promise<FecV2OpenFecPage> { try { return await fetchPage(options); } catch (e) { throw asError(e, "FEC_V2_RESPONSE"); } }
export type FecV2PredecessorPair = Readonly<{ pass1: Readonly<{ page1: FecV2OpenFecPage; page2: FecV2OpenFecPage }>; pass2: Readonly<{ page1: FecV2OpenFecPage; page2: FecV2OpenFecPage }> }>;
export async function fetchOpenFecPredecessorPair(options: Readonly<{ budget: FecV2RunBudget; apiKey: string; evidence: Extract<FecV2Evidence, { kind: "predecessor_lookup" }>; dependencies?: FecV2Dependencies }>): Promise<FecV2PredecessorPair> {
  let leases: FecV2Lease[] = [];
  try {
    validateApiKey(options.apiKey); validate(options.evidence, 1); validate(options.evidence, 2);
    const dependencies = captureDependencies(options.dependencies);
    leases = options.budget.reserveMany("openfec", 4);
    const fetchPass = async (pair: readonly [FecV2Lease, FecV2Lease]) => {
      const group = new AbortController(), run = AbortSignal.any([options.budget.signal, group.signal]);
      let firstError: FecV2TransportError | undefined;
      const tasks = [1, 2].map((page, index) => fetchPage({ ...options, dependencies, page }, pair[index]!, run).catch(error => {
        firstError ??= asError(error, "FEC_V2_RESPONSE"); group.abort(); throw error;
      }));
      const settled = await Promise.allSettled(tasks);
      if (firstError) throw firstError;
      return settled.map(row => (row as PromiseFulfilledResult<FecV2OpenFecPage>).value) as [FecV2OpenFecPage, FecV2OpenFecPage];
    };
    const pass1 = await fetchPass([leases[0]!, leases[1]!]);
    options.budget.assertLive();
    const pass2 = await fetchPass([leases[2]!, leases[3]!]);
    options.budget.assertLive();
    const projection = (p: FecV2OpenFecPage) => p.records.map(r => fecFilingIdentitySha256(r.identity));
    if (JSON.stringify(projection(pass1[0])) !== JSON.stringify(projection(pass2[0])) || JSON.stringify(projection(pass1[1])) !== JSON.stringify(projection(pass2[1]))) fail("FEC_V2_RESPONSE");
    return { pass1: { page1: pass1[0], page2: pass1[1] }, pass2: { page1: pass2[0], page2: pass2[1] } };
  } catch (e) { throw asError(e, "FEC_V2_RESPONSE"); } finally { for (const lease of leases) lease.close(); }
}
export async function streamFecDocqueryFiling(options: Readonly<{ budget: FecV2RunBudget; fecUrl: FecV2FecUrl; expectedFileNumber: number; consume: (chunk: Uint8Array, context: { signal: AbortSignal; deadlineMs: number }) => void | Promise<void>; dependencies?: FecV2Dependencies }>): Promise<FecV2Receipt> {
  let consumerFailure: unknown;
  try {
    const consume = options.consume;
    if (typeof consume !== "function") fail("FEC_V2_RESPONSE");
    if (!positive(options.expectedFileNumber) || !checkedUrl(options.fecUrl, options.expectedFileNumber)) fail("FEC_V2_FEC_URL");
    const url = new URL(options.fecUrl), dependencies = captureDependencies(options.dependencies), run = options.budget.signal, lease = options.budget.reserve("docquery");
    const guardedConsume = async (chunk: Uint8Array, context: { signal: AbortSignal; deadlineMs: number }) => { try { await consume(chunk, context); } catch (error) { consumerFailure = error; throw error; } };
    return (await request("docquery", url, options.budget, dependencies, lease, undefined, guardedConsume, run)).receipt;
  } catch (error) {
    if (consumerFailure) throw consumerFailure;
    throw asError(error, "FEC_V2_FEC_URL");
  }
}
