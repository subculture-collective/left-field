import { createHash } from "node:crypto";
import { decodeFecBulkBootstrap, fecBulkBootstrapSha256 } from "./bulk-bootstrap";
import { loadFecApiCredential } from "./credential";
import { FEC_OPENFEC_ORIGIN } from "./envelope";

const MAX_IDS = 500;
const MAX_RESPONSE = 128 * 1024;
const MAX_TOTAL = 16 * 1024 * 1024;
const MAX_REQUESTS = 1000;
const MAX_ATTEMPTS = 2;
const MAX_DURATION = 5 * 60_000;
const MAX_ATTEMPT_DURATION = 15_000;
const MAX_ARTIFACT = 1024 * 1024;
const STATUS = ["cycle_aligned", "cycle_mismatch", "not_returned"] as const;
const LIMITATIONS = ["Current or nightly OpenFEC API metadata is reconciliation evidence only and does not prove the bulk cutoff or publication eligibility."] as const;

const fail = (code: string): never => { throw new Error(code); };
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const object = (value: unknown, code = "FEC_RECONCILIATION_INVALID"): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail(code);
const exact = (value: Record<string, unknown>, keys: readonly string[], code = "FEC_RECONCILIATION_INVALID"): void => {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) fail(code);
};
const instant = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};
const candidateId = (value: unknown): string => typeof value === "string" && /^[HSP][A-Z0-9]{8}$/.test(value) ? value : fail("FEC_RECONCILIATION_ID_INVALID");
const committeeId = (value: unknown): string => typeof value === "string" && /^C\d{8}$/.test(value) ? value : fail("FEC_RECONCILIATION_ID_INVALID");
const safeInteger = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const privacy = (value: unknown): void => {
  if (Array.isArray(value)) { value.forEach(privacy); return; }
  if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (/name|address|treasurer|party|email|phone|contributor|employer|occupation/i.test(key)) fail("FEC_RECONCILIATION_PRIVACY_INVALID");
    privacy(child);
  }
};

export type OpenFecReconciliationFetch = (input: string | URL, init: RequestInit) => Promise<Response>;
export type ReconciliationStatus = typeof STATUS[number];
type Receipt = Readonly<{ kind: "candidate" | "committee"; id: string; path: string; requestSha256: string; responseSha256: string; responseByteSize: number; reportedCount: number; reportedPages: number; countExact: boolean; resultCount: number; perPage: number }>;
export type FecBulkReconciliation = Readonly<{
  schemaVersion: 1; cycle: 2026; cutoff: "2026-07-18"; retrievedAt: string;
  bulkBootstrapSha256: string; publicationEligible: false; reviewStatus: "unreviewed";
  limitations: readonly string[];
  candidates: readonly { candidateId: string; status: ReconciliationStatus; office: "H" | "S" | "P" | null }[];
  committees: readonly { committeeId: string; status: ReconciliationStatus; committeeType: string | null; designation: string | null }[];
  receipts: readonly Receipt[];
}>;
export interface FetchFecBulkReconciliationOptions { readonly apiKey: string; readonly retrievedAt: string; readonly fetcher?: OpenFecReconciliationFetch; readonly signal?: AbortSignal; readonly sleep?: (ms: number) => Promise<void>; }

/** Hashes a credential-free canonical request target. */
export const fecBulkReconciliationRequestSha256 = (path: string): string => sha(Buffer.from(`GET\0${path}`));
const receiptKey = (kind: string, id: string): string => `${kind}\0${id}`;

function validate(value: FecBulkReconciliation): void {
  const root = object(value);
  exact(root, ["schemaVersion", "cycle", "cutoff", "retrievedAt", "bulkBootstrapSha256", "publicationEligible", "reviewStatus", "limitations", "candidates", "committees", "receipts"]);
  if (root.schemaVersion !== 1 || root.cycle !== 2026 || root.cutoff !== "2026-07-18" || !instant(root.retrievedAt) || typeof root.bulkBootstrapSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.bulkBootstrapSha256) || root.publicationEligible !== false || root.reviewStatus !== "unreviewed" || JSON.stringify(root.limitations) !== JSON.stringify(LIMITATIONS)) fail("FEC_RECONCILIATION_INVALID");
  const sorted = (items: unknown, keys: readonly string[], identity: (row: Record<string, unknown>) => string, check: (row: Record<string, unknown>) => void): Record<string, unknown>[] => {
    if (!Array.isArray(items) || items.length > MAX_IDS) fail("FEC_RECONCILIATION_INVALID");
    let previous: string | undefined;
    return (items as unknown[]).map((raw: unknown) => { const row = object(raw); exact(row, keys); check(row); const key = identity(row); if (previous !== undefined && bytewise(previous, key) >= 0) fail("FEC_RECONCILIATION_INVALID"); previous = key; return row; });
  };
  const candidates = sorted(root.candidates, ["candidateId", "status", "office"], (row) => candidateId(row.candidateId), (row) => {
    if (typeof row.status !== "string" || !STATUS.includes(row.status as ReconciliationStatus) || (row.office !== null && row.office !== "H" && row.office !== "S" && row.office !== "P")) fail("FEC_RECONCILIATION_INVALID");
  });
  const committees = sorted(root.committees, ["committeeId", "status", "committeeType", "designation"], (row) => committeeId(row.committeeId), (row) => {
    if (typeof row.status !== "string" || !STATUS.includes(row.status as ReconciliationStatus) || (row.committeeType !== null && (typeof row.committeeType !== "string" || !/^[A-Z]$/.test(row.committeeType))) || (row.designation !== null && (typeof row.designation !== "string" || !/^[A-Z]$/.test(row.designation)))) fail("FEC_RECONCILIATION_INVALID");
  });
  const receipts = sorted(root.receipts, ["kind", "id", "path", "requestSha256", "responseSha256", "responseByteSize", "reportedCount", "reportedPages", "countExact", "resultCount", "perPage"], (row) => {
    if (row.kind !== "candidate" && row.kind !== "committee") fail("FEC_RECONCILIATION_INVALID");
    const kind = row.kind as "candidate" | "committee";
    const id = typeof row.id === "string" ? row.id : fail("FEC_RECONCILIATION_INVALID");
    return receiptKey(kind, id);
  }, (row) => {
    if (typeof row.path !== "string" || typeof row.requestSha256 !== "string" || typeof row.responseSha256 !== "string" || (row.kind !== "candidate" && row.kind !== "committee") || typeof row.id !== "string" || row.path !== `/v1/${row.kind}/${row.id}/` || row.requestSha256 !== fecBulkReconciliationRequestSha256(row.path) || !/^[a-f0-9]{64}$/.test(row.responseSha256) || !safeInteger(row.responseByteSize, 1, MAX_RESPONSE) || !safeInteger(row.reportedCount) || !safeInteger(row.reportedPages) || typeof row.countExact !== "boolean" || !safeInteger(row.resultCount, 0, 1) || !safeInteger(row.perPage, 1, 100) || row.resultCount > row.perPage || row.reportedCount > 1 || row.reportedPages > 1 || row.reportedPages === 0 !== (row.reportedCount === 0) || (row.reportedCount === 0 && row.resultCount !== 0) || (row.reportedCount === 1 && (row.reportedPages !== 1 || row.resultCount !== 1))) fail("FEC_RECONCILIATION_INVALID");
    if (row.kind === "candidate") {
      candidateId(row.id);
    } else {
      committeeId(row.id);
    }
  });
  const expected = new Set<string>([...candidates.map((row) => receiptKey("candidate", row.candidateId as string)), ...committees.map((row) => receiptKey("committee", row.committeeId as string))]);
  if (receipts.length !== expected.size || receipts.some((row) => !expected.has(receiptKey(row.kind as string, row.id as string)))) fail("FEC_RECONCILIATION_INVALID");
  const receiptByKey = new Map(receipts.map((row) => [receiptKey(row.kind as string, row.id as string), row]));
  for (const row of candidates) {
    const receipt = receiptByKey.get(receiptKey("candidate", row.candidateId as string))!;
    if ((receipt.resultCount === 0) !== (row.status === "not_returned") || (row.status === "not_returned" && row.office !== null)) fail("FEC_RECONCILIATION_INVALID");
  }
  for (const row of committees) {
    const receipt = receiptByKey.get(receiptKey("committee", row.committeeId as string))!;
    if ((receipt.resultCount === 0) !== (row.status === "not_returned") || (row.status === "not_returned" && (row.committeeType !== null || row.designation !== null))) fail("FEC_RECONCILIATION_INVALID");
  }
  privacy(value);
}

export function encodeFecBulkReconciliation(value: FecBulkReconciliation): Uint8Array {
  validate(value);
  return Buffer.from(JSON.stringify({
    schemaVersion: value.schemaVersion, cycle: value.cycle, cutoff: value.cutoff, retrievedAt: value.retrievedAt,
    bulkBootstrapSha256: value.bulkBootstrapSha256, publicationEligible: value.publicationEligible, reviewStatus: value.reviewStatus,
    limitations: [...value.limitations],
    candidates: value.candidates.map((row) => ({ candidateId: row.candidateId, status: row.status, office: row.office })),
    committees: value.committees.map((row) => ({ committeeId: row.committeeId, status: row.status, committeeType: row.committeeType, designation: row.designation })),
    receipts: value.receipts.map((row) => ({ kind: row.kind, id: row.id, path: row.path, requestSha256: row.requestSha256, responseSha256: row.responseSha256, responseByteSize: row.responseByteSize, reportedCount: row.reportedCount, reportedPages: row.reportedPages, countExact: row.countExact, resultCount: row.resultCount, perPage: row.perPage })),
  }));
}
export function decodeFecBulkReconciliation(bytes: Uint8Array): FecBulkReconciliation {
  if (bytes.byteLength > MAX_ARTIFACT) fail("FEC_RECONCILIATION_INPUT_TOO_LARGE");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return fail("FEC_RECONCILIATION_INVALID_JSON"); }
  validate(parsed as FecBulkReconciliation);
  if (!Buffer.from(bytes).equals(Buffer.from(encodeFecBulkReconciliation(parsed as FecBulkReconciliation)))) fail("FEC_RECONCILIATION_NONCANONICAL");
  return parsed as FecBulkReconciliation;
}
export const fecBulkReconciliationSha256 = (bytes: Uint8Array): string => sha(bytes);

function ids(bytes: Uint8Array): { bulk: ReturnType<typeof decodeFecBulkBootstrap>; candidates: string[]; committees: string[] } {
  const bulk = decodeFecBulkBootstrap(bytes);
  const candidates = new Set<string>([...bulk.coherence.unresolvedLinkageCandidates.map((row) => row.candidateId), ...bulk.coherence.unresolvedSummaryCandidates]);
  const committees = new Set<string>([...bulk.coherence.unresolvedPrincipalCommittees.map((row) => row.committeeId), ...bulk.coherence.unresolvedLinkageCommittees.map((row) => row.committeeId)]);
  if (candidates.size + committees.size > MAX_IDS) fail("FEC_RECONCILIATION_ID_LIMIT_EXCEEDED");
  return { bulk, candidates: [...candidates].sort(bytewise), committees: [...committees].sort(bytewise) };
}

function deadlineError(options: FetchFecBulkReconciliationOptions): never { if (options.signal?.aborted) fail("FEC_RECONCILIATION_ABORTED"); return fail("FEC_RECONCILIATION_GLOBAL_LIMIT_EXCEEDED"); }
function withinDeadline<T>(promise: Promise<T>, deadline: number, options: FetchFecBulkReconciliationOptions, cancel?: () => void, timeoutCode = "FEC_RECONCILIATION_GLOBAL_LIMIT_EXCEEDED"): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) { cancel?.(); return Promise.reject(new Error(options.signal?.aborted ? "FEC_RECONCILIATION_ABORTED" : timeoutCode)); }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void): void => { if (settled) return; settled = true; clearTimeout(timer); options.signal?.removeEventListener("abort", aborted); action(); };
    const aborted = (): void => { cancel?.(); finish(() => reject(new Error("FEC_RECONCILIATION_ABORTED"))); };
    const timer = setTimeout(() => { cancel?.(); finish(() => reject(new Error(options.signal?.aborted ? "FEC_RECONCILIATION_ABORTED" : timeoutCode))); }, remaining);
    if (options.signal?.aborted) return aborted();
    options.signal?.addEventListener("abort", aborted, { once: true });
    promise.then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)));
  });
}
const cancelReader = (reader: ReadableStreamDefaultReader<Uint8Array>): void => { try { void reader.cancel(); } catch { /* cancellation is best effort */ } };
async function body(response: Response, total: { bytes: number; deadline: number }, options: FetchFecBulkReconciliationOptions): Promise<Uint8Array> {
  const reader = response.body?.getReader() ?? fail("FEC_RECONCILIATION_RESPONSE_INVALID");
  const chunks: Uint8Array[] = []; let length = 0;
  try { for (;;) { const part = await withinDeadline(reader.read(), total.deadline, options, () => cancelReader(reader), "FEC_RECONCILIATION_ATTEMPT_TIMEOUT"); if (part.done) break; length += part.value.byteLength; total.bytes += part.value.byteLength; if (length > MAX_RESPONSE) { cancelReader(reader); fail("FEC_RECONCILIATION_RESPONSE_TOO_LARGE"); } if (total.bytes > MAX_TOTAL) { cancelReader(reader); fail("FEC_RECONCILIATION_TOTAL_TOO_LARGE"); } chunks.push(part.value); } } catch (error) { cancelReader(reader); if (error instanceof Error && /^FEC_/.test(error.message)) throw error; fail("FEC_RECONCILIATION_FETCH_FAILED"); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), length);
}
const retryDelay = (response: Response, attempt: number): number => { const value = response.headers.get("retry-after"); if (value !== null) { if (!/^\d+$/.test(value) || Number(value) > 30) fail("FEC_RECONCILIATION_RETRY_AFTER_INVALID"); return Number(value) * 1000; } return 250 * (attempt + 1); };
const optionalField = (row: Record<string, unknown>, name: string, regex: RegExp): string | null => { const value = row[name]; if (value === undefined || value === null) return null; if (typeof value !== "string") fail("FEC_RECONCILIATION_RESPONSE_INVALID"); const text = value as string; if (!regex.test(text)) fail("FEC_RECONCILIATION_RESPONSE_INVALID"); return text; };

async function lookup(kind: "candidate" | "committee", id: string, key: string, options: FetchFecBulkReconciliationOptions, budget: { requests: number; bytes: number; deadline: number }): Promise<{ status: ReconciliationStatus; row: Record<string, unknown> | null; receipt: Receipt }> {
  const path = `/v1/${kind}/${id}/`; const url = new URL(path, FEC_OPENFEC_ORIGIN); const fetcher = options.fetcher ?? fetch; const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (++budget.requests > MAX_REQUESTS || Date.now() >= budget.deadline) deadlineError(options);
    const attemptDeadline = Math.min(budget.deadline, Date.now() + MAX_ATTEMPT_DURATION);
    const controller = new AbortController(); const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    let response: Response;
    try { response = await withinDeadline(fetcher(url, { method: "GET", headers: { "X-Api-Key": key, accept: "application/json" }, redirect: "error", cache: "no-store", signal }), attemptDeadline, options, () => controller.abort(), "FEC_RECONCILIATION_ATTEMPT_TIMEOUT"); }
    catch (error) { if (error instanceof Error && /^FEC_RECONCILIATION_(?:GLOBAL_LIMIT|ABORTED)/.test(error.message)) throw error; if (options.signal?.aborted) deadlineError(options); if (attempt + 1 === MAX_ATTEMPTS) fail("FEC_RECONCILIATION_FETCH_FAILED"); await withinDeadline(sleep(Math.min(250 * (attempt + 1), Math.max(0, budget.deadline - Date.now()))), budget.deadline, options); continue; }
    if (!response.ok) { try { void response.body?.cancel(); } catch { /* cancellation is best effort */ } if ((response.status !== 429 && response.status < 500) || attempt + 1 === MAX_ATTEMPTS) fail("FEC_RECONCILIATION_HTTP_ERROR"); await withinDeadline(sleep(Math.min(retryDelay(response, attempt), Math.max(0, budget.deadline - Date.now()))), budget.deadline, options); continue; }
    const attemptBudget = { ...budget, deadline: attemptDeadline };
    let bytes: Uint8Array;
    try { bytes = await body(response, attemptBudget, options); }
    catch (error) {
      budget.bytes = attemptBudget.bytes;
      if (error instanceof Error && /^(FEC_RECONCILIATION_GLOBAL_LIMIT_EXCEEDED|FEC_RECONCILIATION_ABORTED)$/.test(error.message)) throw error;
      if (error instanceof Error && error.message === "FEC_RECONCILIATION_ATTEMPT_TIMEOUT" && attempt + 1 < MAX_ATTEMPTS) {
        await withinDeadline(sleep(Math.min(250 * (attempt + 1), Math.max(0, budget.deadline - Date.now()))), budget.deadline, options);
        continue;
      }
      throw error;
    }
    budget.bytes = attemptBudget.bytes;
    let root: Record<string, unknown> = {};
    try { root = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), "FEC_RECONCILIATION_RESPONSE_INVALID"); } catch (error) { if (error instanceof Error && /^FEC_/.test(error.message)) throw error; fail("FEC_RECONCILIATION_RESPONSE_INVALID_JSON"); }
    if (!Array.isArray(root.results)) fail("FEC_RECONCILIATION_RESPONSE_INVALID");
    const results = root.results as unknown[];
    const pagination = object(root.pagination, "FEC_RECONCILIATION_PAGINATION_INVALID");
    if (!safeInteger(pagination.count, 0, 1) || !safeInteger(pagination.pages, 0, 1) || !safeInteger(pagination.per_page, 1, 100) || typeof pagination.is_count_exact !== "boolean" || results.length > 1 || (pagination.count === 0 && (pagination.pages !== 0 || results.length !== 0)) || (pagination.count === 1 && (pagination.pages !== 1 || results.length !== 1))) fail("FEC_RECONCILIATION_PAGINATION_INVALID");
    const row = results[0] === undefined ? null : object(results[0], "FEC_RECONCILIATION_RESPONSE_INVALID");
    if (row && row[kind === "candidate" ? "candidate_id" : "committee_id"] !== id) fail("FEC_RECONCILIATION_ID_MISMATCH");
    const status: ReconciliationStatus = row === null ? "not_returned" : (() => { const cycles = row.cycles; if (!Array.isArray(cycles) || cycles.some((cycle: unknown) => !safeInteger(cycle, 1000, 9998) || cycle % 2 !== 0) || new Set(cycles).size !== cycles.length) fail("FEC_RECONCILIATION_RESPONSE_INVALID"); const years = cycles as number[]; return years.includes(2026) ? "cycle_aligned" : "cycle_mismatch"; })();
    return { status, row, receipt: { kind, id, path, requestSha256: fecBulkReconciliationRequestSha256(path), responseSha256: sha(bytes), responseByteSize: bytes.byteLength, reportedCount: pagination.count as number, reportedPages: pagination.pages as number, countExact: pagination.is_count_exact as boolean, resultCount: results.length, perPage: pagination.per_page as number } };
  }
  return fail("FEC_RECONCILIATION_FETCH_FAILED");
}

export async function createFecBulkReconciliation(input: Uint8Array, options: FetchFecBulkReconciliationOptions): Promise<FecBulkReconciliation> {
  if (typeof options.apiKey !== "string" || !options.apiKey || options.apiKey.length > 256 || options.apiKey !== options.apiKey.trim() || /[\u0000-\u0020\u007f]/.test(options.apiKey)) fail("FEC_API_CREDENTIAL_REQUIRED");
  if (!instant(options.retrievedAt)) fail("FEC_RECONCILIATION_RETRIEVED_AT_INVALID");
  const found = ids(input); const budget = { requests: 0, bytes: 0, deadline: Date.now() + MAX_DURATION }; const receipts: Receipt[] = []; const candidates: FecBulkReconciliation["candidates"][number][] = []; const committees: FecBulkReconciliation["committees"][number][] = [];
  for (const id of found.candidates) { const result = await lookup("candidate", id, options.apiKey, options, budget); const office = result.row === null ? null : optionalField(result.row, "office", /^[HSP]$/) as "H" | "S" | "P"; receipts.push(result.receipt); candidates.push({ candidateId: id, status: result.status, office }); }
  for (const id of found.committees) { const result = await lookup("committee", id, options.apiKey, options, budget); const committeeType = result.row === null ? null : optionalField(result.row, "committee_type", /^[A-Z]$/); const designation = result.row === null ? null : optionalField(result.row, "designation", /^[A-Z]$/); receipts.push(result.receipt); committees.push({ committeeId: id, status: result.status, committeeType, designation }); }
  const output: FecBulkReconciliation = { schemaVersion: 1, cycle: found.bulk.cycle, cutoff: found.bulk.cutoff, retrievedAt: options.retrievedAt, bulkBootstrapSha256: fecBulkBootstrapSha256(input), publicationEligible: false, reviewStatus: "unreviewed", limitations: LIMITATIONS, candidates, committees, receipts: receipts.sort((left, right) => bytewise(receiptKey(left.kind, left.id), receiptKey(right.kind, right.id))) };
  validate(output); return output;
}
export async function createFecBulkReconciliationFromEnv(input: Uint8Array, options: Omit<FetchFecBulkReconciliationOptions, "apiKey">, env: NodeJS.ProcessEnv): Promise<FecBulkReconciliation> { return createFecBulkReconciliation(input, { ...options, apiKey: loadFecApiCredential(env) }); }
