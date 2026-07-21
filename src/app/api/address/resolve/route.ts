import { addressInputSchema, type AddressResolver } from "@/domain/address";
import { addressAnonymousSubjectHash, type AddressAdmissionRepository } from "@/address/admission";
import { parseAddressConfig, type AddressConfig } from "@/address/config";
import { createAddressRuntime } from "@/address/runtime";
import { canaryAuthorizationLooksValid, canonicalIp, digest, issueAddressCsrf, verifyAddressCsrf, verifyCanary } from "@/address/security";
import { boundedDuration, emitOperationalSignal, signalTimestamp, type OperationalSignalSink } from "@/operations/signals";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
const json = (status: number, body: object, extra?: HeadersInit) => Response.json(body, { status, headers: { ...headers, ...extra } });
const retry = (n: number | null) => String(Math.max(1, Math.min(86400, Math.floor(n ?? 1))));
type Repository = Pick<AddressAdmissionRepository, "consumeMetadataAttempt" | "consumeEnabledLookup" | "consumeCanary">;
export interface AddressHandlerDependencies { getConfig?: () => AddressConfig; createRuntime?: (config: AddressConfig) => { repository: Repository; resolver: AddressResolver }; now?: () => Date; signalSink?: OperationalSignalSink; }
async function body(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader(); if (!reader) throw new Error("malformed"); let size = 0; const chunks: Uint8Array[] = []; let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new Error("deadline")); }, 5_000); });
  const aborted = new Promise<never>((_, reject) => { onAbort = () => { void reader.cancel().catch(() => undefined); reject(new Error("aborted")); }; request.signal.addEventListener("abort", onAbort, { once: true }); if (request.signal.aborted) onAbort(); });
  try { while (true) { const next = await Promise.race([reader.read(), deadline, aborted]); if (next.done) break; size += next.value.byteLength; if (size > 1024) { void reader.cancel().catch(() => undefined); throw new RangeError("large"); } chunks.push(next.value); } }
  finally { if (timer) clearTimeout(timer); if (onAbort) request.signal.removeEventListener("abort", onAbort); reader.releaseLock(); }
  const out = new Uint8Array(size); let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; } return out;
}
function disabled() { return json(503, { status: "disabled", errorCode: "LOOKUP_DISABLED" }, { "X-Address-Resolve-Outcome": "disabled" }); }
function methodNotAllowed() { return json(405, { status: "method_not_allowed" }); }
function exactPath(request: Request) { const url = new URL(request.url); return url.pathname === "/api/address/resolve" && !url.search; }
function enabledHeaders(request: Request, config: AddressConfig, at: number): string | undefined {
  if (new URL(request.url).search || request.headers.get("origin") !== config.publicOrigin || (request.headers.get("sec-fetch-site") !== null && request.headers.get("sec-fetch-site") !== "same-origin") || request.headers.get("content-encoding") || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "") || !verifyAddressCsrf(config, request.headers.get("cookie"), request.headers.get("x-csrf-token"), at)) return undefined;
  return canonicalIp(request.headers.get(config.trustedIpHeader!));
}
export function createAddressHandler(deps: AddressHandlerDependencies = {}) {
  const getConfig = deps.getConfig ?? (() => parseAddressConfig(process.env)); const createRuntime = deps.createRuntime ?? createAddressRuntime; const now = deps.now ?? (() => new Date());
  const handler = {
    async GET(request: Request): Promise<Response> { let config: AddressConfig; try { config = getConfig(); } catch { return json(503, { status: "unavailable" }); } if (config.mode !== "enabled") return disabled(); if (!exactPath(request)) return json(404, { status: "not_found" }); try { const csrf = issueAddressCsrf(config, now().getTime()); return json(200, { csrfToken: csrf.token }, { "Set-Cookie": csrf.cookie }); } catch { return json(503, { status: "unavailable" }); } },
    async POST(request: Request): Promise<Response> {
      let config: AddressConfig; try { config = getConfig(); } catch { return json(503, { status: "unavailable" }); }
      if (config.mode === "disabled") return disabled();
      let repository!: Repository; let resolver!: AddressResolver; let enabledIp: string | undefined;
      if (config.mode === "enabled") {
        if (!exactPath(request)) return json(403, { status: "forbidden" }); enabledIp = enabledHeaders(request, config, now().getTime()); if (!enabledIp) return json(403, { status: "forbidden" });
        try { ({ repository, resolver } = createRuntime(config)); } catch { return json(503, { status: "unavailable" }); }
        const metadataSubject = addressAnonymousSubjectHash(config.subjectHmacSecret!, enabledIp, config.subjectGeneration!, "metadata", now());
        try { const attempt = await repository.consumeMetadataAttempt(metadataSubject, request.signal); if (!attempt.allowed) return json(429, { status: "rate_limited" }, { "Retry-After": retry(attempt.retryAfter) }); } catch { return json(503, { status: "unavailable" }); }
      } else if (!exactPath(request) || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "") || request.headers.get("content-encoding") || !canaryAuthorizationLooksValid(config, request.headers.get("authorization"), Math.floor(now().getTime() / 1000))) return json(403, { status: "forbidden" });
      let bytes: Uint8Array; try { bytes = await body(request); } catch (e) { return e instanceof RangeError ? json(413, { status: "too_large" }) : json(400, { status: "malformed" }); }
      if (config.mode === "canary") {
        const authorization = verifyCanary(config, request.headers.get("authorization"), digest(bytes), Math.floor(now().getTime() / 1000)); if (!authorization) return json(403, { status: "forbidden" });
        try { ({ repository, resolver } = createRuntime(config)); } catch { return json(503, { status: "unavailable" }); }
        try { const allowed = await repository.consumeCanary({ subjectHash: Buffer.alloc(32), nonceHash: authorization.nonceHash, keyId: authorization.keyId, signatureTimestamp: authorization.timestamp, expiresAt: new Date(authorization.timestamp.getTime() + 10 * 60_000) }, request.signal); if (!allowed.allowed) return json(429, { status: "rate_limited" }, { "Retry-After": retry(allowed.retryAfter) }); } catch { return json(503, { status: "unavailable" }); }
      }
      let input; try { input = addressInputSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); } catch { return json(400, { status: "malformed" }); }
      if (config.mode === "enabled") try { const lookupSubject = addressAnonymousSubjectHash(config.subjectHmacSecret!, enabledIp!, config.subjectGeneration!, "lookup", now()); const allowed = await repository.consumeEnabledLookup(lookupSubject, request.signal); if (!allowed.allowed) return json(429, { status: "rate_limited" }, { "Retry-After": retry(allowed.retryAfter) }); } catch { return json(503, { status: "unavailable" }); }
      try { const resolution = await resolver.resolve(input, request.signal); return json(200, resolution, { "X-Address-Resolve-Outcome": resolution.status }); } catch { return json(503, { status: "unavailable" }); }
    },
    async HEAD(): Promise<Response> { return methodNotAllowed(); },
    async OPTIONS(): Promise<Response> { return methodNotAllowed(); },
    async PUT(): Promise<Response> { return methodNotAllowed(); },
    async PATCH(): Promise<Response> { return methodNotAllowed(); },
    async DELETE(): Promise<Response> { return methodNotAllowed(); },
  };
  return { ...handler, POST: async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    try {
      const response = await handler.POST(request);
      const resolvedOutcome = response.headers.get("X-Address-Resolve-Outcome");
      response.headers.delete("X-Address-Resolve-Outcome");
      const outcome = resolvedOutcome ?? (response.status === 503 ? "unavailable" : response.status === 429 ? "rate_limited" : response.status === 413 ? "too_large" : response.status === 400 ? "malformed" : "forbidden");
      emitOperationalSignal(deps.signalSink, { version: 1, timestamp: signalTimestamp(), kind: "address_resolve", route: "/api/address/resolve", outcome, durationMs: boundedDuration(startedAt) });
      return response;
    } catch (error) { emitOperationalSignal(deps.signalSink, { version: 1, timestamp: signalTimestamp(), kind: "address_resolve", route: "/api/address/resolve", outcome: "unavailable", durationMs: boundedDuration(startedAt) }); throw error; }
  } };
}
const handler = createAddressHandler();
export const GET = handler.GET; export const POST = handler.POST; export const HEAD = handler.HEAD; export const OPTIONS = handler.OPTIONS; export const PUT = handler.PUT; export const PATCH = handler.PATCH; export const DELETE = handler.DELETE;
