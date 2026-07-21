import { createHmac } from "node:crypto";
import { Client, type ClientConfig, type Pool, type PoolClient, type QueryResultRow } from "pg";
import { getAddressPool } from "@/db/client";
import { CallerAbortError, isCallerAbort, throwIfCallerAborted } from "./census-geocoder";

export type AdmissionResult = { allowed: boolean; retryAfter: number | null };
export type CanaryAdmissionInput = { subjectHash: Buffer; nonceHash: Buffer; keyId: string; signatureTimestamp: Date; expiresAt: Date };
export type AnonymousAdmissionPurpose = "metadata" | "lookup";
type BackendCanceller = (processID: number) => Promise<boolean | void>;

const CANCEL_TIMEOUT_MS = 1_000;
const STATEMENT_TIMEOUT_MS = 5_000;
const ACQUIRE_TIMEOUT_MS = 5_000;

function hash32(value: Buffer, name: string): Buffer {
  if (!Buffer.isBuffer(value) || value.length !== 32) throw new Error(`${name} must be a 32-byte Buffer`);
  return value;
}

/** Purpose-separated anonymous identity. Metadata rotates by minute; lookup rotates by hour. */
export function addressAnonymousSubjectHash(secret: string, canonicalSubject: string, generation: string, purpose: AnonymousAdmissionPurpose, now = new Date()): Buffer {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("address HMAC secret must contain at least 32 UTF-8 bytes");
  if (!canonicalSubject || !generation) throw new Error("canonical subject and active generation are required");
  const window = purpose === "metadata" ? now.toISOString().slice(0, 16) + ":00Z" : now.toISOString().slice(0, 13) + ":00:00Z";
  return createHmac("sha256", secret).update(`dsa-seats-address-admission:v1:${purpose}:${generation}:${window}:${canonicalSubject}`).digest();
}

function cancellationConfig(pool: Pool): ClientConfig {
  const { user, database, password, port, host, connectionString, keepAlive, ssl, keepAliveInitialDelayMillis, application_name, fallback_application_name, client_encoding, options } = pool.options;
  return { user, database, password, port, host, connectionString, keepAlive, ssl, keepAliveInitialDelayMillis, application_name, fallback_application_name, client_encoding, options, connectionTimeoutMillis: CANCEL_TIMEOUT_MS, query_timeout: CANCEL_TIMEOUT_MS, statement_timeout: CANCEL_TIMEOUT_MS };
}
function defaultBackendCanceller(pool: Pool): BackendCanceller {
  return async processID => {
    const client = new Client(cancellationConfig(pool));
    try { await client.connect(); return (await client.query<{ pg_cancel_backend: boolean }>("SELECT pg_cancel_backend($1)", [processID])).rows[0]?.pg_cancel_backend === true; }
    finally { await client.end().catch(() => undefined); }
  };
}

/** Typed wrappers around the only address-admission SQL entrypoints. */
export class AddressAdmissionRepository {
  private readonly cancelBackend: BackendCanceller;
  constructor(private readonly pool: Pool = getAddressPool(), private readonly statementTimeoutMs = STATEMENT_TIMEOUT_MS, cancelBackend?: BackendCanceller, private readonly acquireTimeoutMs = ACQUIRE_TIMEOUT_MS) {
    if (!Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs <= 0 || !Number.isSafeInteger(acquireTimeoutMs) || acquireTimeoutMs <= 0) throw new Error("Invalid admission timeout");
    this.cancelBackend = cancelBackend ?? defaultBackendCanceller(pool);
  }
  private async acquire(signal?: AbortSignal): Promise<PoolClient> {
    throwIfCallerAborted(signal);
    let settled = false;
    const checkout = this.pool.connect();
    checkout.then(client => { if (settled) client.release(true); }).catch(() => undefined);
    return new Promise<PoolClient>((resolve, reject) => {
      const finish = (fn: () => void) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", onAbort); fn(); };
      const onAbort = () => finish(() => reject(new CallerAbortError()));
      const timer = setTimeout(() => finish(() => reject(new Error("Pool acquisition timeout"))), this.acquireTimeoutMs);
      checkout.then(client => finish(() => resolve(client)), error => finish(() => reject(error)));
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
  private async consume<Row extends QueryResultRow>(text: string, values: unknown[], signal?: AbortSignal): Promise<Row> {
    throwIfCallerAborted(signal);
    const client = await this.acquire(signal); let begun = false; let active = true; let destroy = false; let cancellation: Promise<boolean | void> | undefined;
    const cancel = () => { if (!active || cancellation) return; cancellation = this.cancelBackend((client as PoolClient & { processID: number }).processID); };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      throwIfCallerAborted(signal); await client.query("BEGIN"); begun = true;
      await client.query(`SET LOCAL statement_timeout = '${this.statementTimeoutMs}ms'`);
      throwIfCallerAborted(signal); const result = await client.query<Row>(text, values);
      throwIfCallerAborted(signal); await client.query("COMMIT"); begun = false;
      throwIfCallerAborted(signal); return result.rows[0]!;
    } catch (error) {
      if (begun) { destroy = true; await client.query("ROLLBACK").catch(() => undefined); }
      if (isCallerAbort(error, signal)) { destroy = true; throw new CallerAbortError(); }
      throw error;
    } finally {
      active = false; signal?.removeEventListener("abort", cancel);
      if (cancellation) { try { if ((await cancellation) === false) destroy = true; } catch { destroy = true; } }
      client.release(destroy);
    }
  }
  async consumeMetadataAttempt(subjectHash: Buffer, signal?: AbortSignal): Promise<AdmissionResult> {
    return this.consume<AdmissionResult>('SELECT allowed, retry_after AS "retryAfter" FROM operations.consume_address_metadata_attempt_v1($1)', [hash32(subjectHash, "subjectHash")], signal);
  }
  async consumeEnabledLookup(subjectHash: Buffer, signal?: AbortSignal): Promise<AdmissionResult> {
    return this.consume<AdmissionResult>('SELECT allowed, retry_after AS "retryAfter" FROM operations.consume_address_lookup_v1($1)', [hash32(subjectHash, "subjectHash")], signal);
  }
  async consumeCanary(input: CanaryAdmissionInput, signal?: AbortSignal): Promise<AdmissionResult> {
    return this.consume<AdmissionResult>('SELECT allowed, retry_after AS "retryAfter" FROM operations.consume_address_canary_v1($1,$2,$3,$4,$5)', [hash32(input.subjectHash, "subjectHash"), hash32(input.nonceHash, "nonceHash"), input.keyId, input.signatureTimestamp, input.expiresAt], signal);
  }
}

export class AddressAdmissionMaintenanceRepository {
  constructor(private readonly pool: Pool) {}
  async cleanup(): Promise<{ quotaBucketsDeleted: number; canaryNoncesDeleted: number }> {
    const result = await this.pool.query<{ quotaBucketsDeleted: number; canaryNoncesDeleted: number }>('SELECT quota_buckets_deleted AS "quotaBucketsDeleted", canary_nonces_deleted AS "canaryNoncesDeleted" FROM operations.cleanup_address_admission_v1()');
    return result.rows[0]!;
  }
}
