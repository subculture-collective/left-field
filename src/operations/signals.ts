import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const duration = z.number().int().min(0).max(86_400_000);
const count = z.number().int().min(0).max(1_000_000_000);
const base = { version: z.literal(1), timestamp: z.string().datetime({ offset: true }), durationMs: duration };
const ingestion = { ...base, kind: z.literal("ingestion"), releaseId: identifier, sourceId: identifier, runId: identifier.optional(), extractedCount: count, stagedCount: count, quarantinedCount: count };
const lifecycle = { ...base, kind: z.literal("lifecycle"), operation: z.enum(["promote", "rollback", "roll_forward"]), releaseId: identifier.optional() };
const repository = { ...base, kind: z.literal("repository"), operation: z.enum(["get_active_release", "get_release", "list_seats", "list_seat_page", "get_seat_list_item", "get_seat_profile", "get_seat_facets", "list_sources", "list_source_snapshots", "list_release_coverage"]), releaseId: identifier.optional() };

/** Each outcome is an independent strict branch: success cannot smuggle a failure code. */
export const operationalSignalSchema = z.union([
  z.object({ ...ingestion, outcome: z.literal("success") }).strict(),
  z.object({ ...ingestion, outcome: z.literal("failure"), failureCode: z.literal("INGESTION_FAILED") }).strict(),
  z.object({ ...lifecycle, outcome: z.literal("success") }).strict(),
  z.object({ ...lifecycle, outcome: z.literal("failure"), failureCode: z.literal("LIFECYCLE_FAILED") }).strict(),
  z.object({ ...repository, outcome: z.literal("success") }).strict(),
  z.object({ ...repository, outcome: z.literal("failure"), failureCode: z.literal("REPOSITORY_FAILED") }).strict(),
  z.object({ ...base, kind: z.literal("address_resolve"), route: z.literal("/api/address/resolve"), outcome: z.enum(["matched", "ambiguous", "no_match", "vintage_mismatch", "geography_ambiguous", "unsupported_prototype_coverage", "disabled", "rate_limited", "upstream_failure", "resolver_failure", "unavailable", "forbidden", "malformed", "too_large"]) }).strict(),
]);
export type OperationalSignal = z.infer<typeof operationalSignalSchema>;
export interface OperationalSignalSink { emit(signal: OperationalSignal): void | Promise<void>; }
export type JsonlOperationalSignalWriter = (line: string) => void | Promise<void>;
export const MAX_OPERATIONAL_SIGNAL_LINE_BYTES = 4096;
export const MAX_OPERATIONAL_SIGNAL_PENDING = 64;
/** @deprecated Use MAX_OPERATIONAL_SIGNAL_PENDING. Kept for compatibility. */
export const MAX_OPERATIONAL_SIGNAL_IN_FLIGHT = MAX_OPERATIONAL_SIGNAL_PENDING;
export const noopOperationalSignalSink: OperationalSignalSink = { emit: () => undefined };

/**
 * Opt-in, serialized JSONL delivery. Invalid, overflow, and writer-failed signals are
 * dropped without retry; telemetry has no default durable destination. releaseId, runId,
 * and sourceId are JSONL correlation fields only, never metric label dimensions.
 */
export function createJsonlOperationalSignalSink(writer: JsonlOperationalSignalWriter, maxPending = MAX_OPERATIONAL_SIGNAL_PENDING): OperationalSignalSink {
  if (typeof writer !== "function") throw new TypeError("writer must be a function");
  if (!Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > MAX_OPERATIONAL_SIGNAL_PENDING) throw new RangeError("maxPending must be a bounded positive integer");
  const pending: string[] = [];
  let writing = false;
  const drain = (): void => {
    if (writing) return;
    const line = pending.shift();
    if (!line) return;
    writing = true;
    void Promise.resolve().then(() => writer(line)).catch(() => undefined).then(() => { writing = false; drain(); });
  };
  return { emit(signal): void {
    let line: string;
    try {
      line = `${JSON.stringify(operationalSignalSchema.parse(signal))}\n`;
      if (Buffer.byteLength(line, "utf8") > MAX_OPERATIONAL_SIGNAL_LINE_BYTES || pending.length + Number(writing) >= maxPending) return;
    } catch { return; }
    pending.push(line);
    drain();
  } };
}

/** Validates at the trust boundary; telemetry is deliberately unable to affect callers. */
export function emitOperationalSignal(sink: OperationalSignalSink | undefined, signal: unknown): void {
  try {
    const emitted = sink?.emit(operationalSignalSchema.parse(signal));
    if (emitted && typeof (emitted as Promise<void>).then === "function") void Promise.resolve(emitted).catch(() => undefined);
  } catch { /* best-effort only */ }
}

export const signalTimestamp = (): string => new Date().toISOString();
export const boundedDuration = (startedAt: number): number => Math.max(0, Math.min(86_400_000, Math.floor(performance.now() - startedAt)));
export const boundedFailureCode = (operation: "lifecycle" | "repository"): "LIFECYCLE_FAILED" | "REPOSITORY_FAILED" => operation === "lifecycle" ? "LIFECYCLE_FAILED" : "REPOSITORY_FAILED";
