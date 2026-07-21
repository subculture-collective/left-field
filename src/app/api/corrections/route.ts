import { createHash } from "node:crypto";

import { CorrectionRepository, type SubmitCorrectionResult } from "@/corrections/repository";
import { correctionAnonymousSubjectHash, generateCorrectionIdempotencyToken, isCorrectionIdempotencyToken, issueCorrectionCsrf, parseCorrectionCsrfCookie, parseCorrectionSecurityConfig, validateCorrectionRequestHeaders, verifyCorrectionCsrf, type CorrectionSecurityConfig } from "@/corrections/security";
import { correctionPublicOutcomeSchema, parseCorrectionSubmission } from "@/domain/corrections";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;
const BODY_READ_DEADLINE_MS = 5_000;
const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;
type Repository = Pick<CorrectionRepository, "consumeAttempt" | "submit">;
export interface CorrectionHandlerDependencies {
  getConfig?: () => CorrectionSecurityConfig;
  createRepository?: () => Repository;
  now?: () => Date;
}

function response(status: number, body: object, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}
async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("malformed");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
      reject(new Error("malformed"));
    }, BODY_READ_DEADLINE_MS);
  });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        // Cancellation is best-effort: a hostile stream must not hold this response open.
        void reader.cancel().catch(() => undefined);
        throw new RangeError("too_large");
      }
      chunks.push(next.value);
    }
  } finally { if (timeout) clearTimeout(timeout); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("malformed"); }
}
function hash(value: string): Buffer { return createHash("sha256").update(value).digest(); }
function retryAfter(value: number | null): string { return String(Math.max(1, Math.min(3600, Math.floor(value ?? 1)))); }

export function createCorrectionHandler(dependencies: CorrectionHandlerDependencies = {}) {
  const getConfig = dependencies.getConfig ?? (() => parseCorrectionSecurityConfig(process.env));
  const createRepository = dependencies.createRepository ?? (() => new CorrectionRepository());
  const now = dependencies.now ?? (() => new Date());
  return {
    async GET(): Promise<Response> {
      try {
        const config = getConfig();
        createRepository();
        const material = issueCorrectionCsrf(config, now().getTime());
        return response(200, { csrfToken: material.token, idempotencyToken: generateCorrectionIdempotencyToken() }, { "Set-Cookie": material.cookie });
      } catch { return response(503, { status: "unavailable" }); }
    },
    async POST(request: Request): Promise<Response> {
      let config: CorrectionSecurityConfig;
      let repository: Repository;
      try { config = getConfig(); repository = createRepository(); }
      catch { return response(503, { status: "unavailable" }); }
      if (!JSON_CONTENT_TYPE.test(request.headers.get("content-type") ?? "")) return response(415, { status: "unsupported_media_type" });
      const ip = validateCorrectionRequestHeaders(request.headers, config);
      if (!ip) return response(403, { status: "forbidden" });
      const nonce = parseCorrectionCsrfCookie(request.headers.get("cookie"));
      if (!verifyCorrectionCsrf(config, nonce, request.headers.get("x-csrf-token") ?? undefined, now().getTime())) return response(403, { status: "forbidden" });
      const subjectHash = Buffer.from(correctionAnonymousSubjectHash(config, ip, now()), "hex");
      let attempt;
      try { attempt = await repository.consumeAttempt(subjectHash); }
      catch { return response(503, { status: "unavailable" }); }
      if (!attempt.allowed) return response(429, { status: "rate_limited" }, { "Retry-After": retryAfter(attempt.retryAfter) });
      const key = request.headers.get("idempotency-key");
      if (!isCorrectionIdempotencyToken(key)) return response(400, { status: "malformed" });
      let submission;
      try { submission = parseCorrectionSubmission(await readBoundedJson(request)); }
      catch (error) { return error instanceof RangeError ? response(413, { status: "too_large" }) : response(400, { status: "malformed" }); }
      let result: SubmitCorrectionResult;
      try {
        result = await repository.submit({ ...submission, keyHash: hash(key), subjectHash });
      } catch { return response(503, { status: "unavailable" }); }
      if (result.outcome === "accepted" && result.correctionId) {
        const outcome = { status: result.created ? "accepted" as const : "replay" as const, correctionId: result.correctionId };
        return correctionPublicOutcomeSchema.safeParse(outcome).success ? response(202, outcome) : response(503, { status: "unavailable" });
      }
      if (result.outcome === "idempotency_conflict") return response(409, { status: "conflict" });
      if (result.outcome === "rate_limited") return response(429, { status: "rate_limited" }, { "Retry-After": retryAfter(result.retryAfter) });
      return response(400, { status: "malformed" });
    },
  };
}

const handler = createCorrectionHandler();
export const GET = handler.GET;
export const POST = handler.POST;
