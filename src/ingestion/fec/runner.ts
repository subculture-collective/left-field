import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { coordinateFecV2Acquisition, coordinateFecV2AcquisitionForTesting, reuseCompletedFecV2Acquisition, type FecV2CoordinatorTestingDeps } from "./acquisition-coordinator";
import { loadFecApiCredential } from "./credential";
import { loadFecEfoLayouts, type FecEfoLayout } from "./efo-layout";
import { readConfiguredFecPlan, type FecPlanExpectation } from "./plan-reader";
import { assertFecV2Role, FecV2AcquisitionPersistence, FecV2ReplayVerifierPersistence, lockFecV2Orchestration, type FecV2Pool, unlockFecV2Orchestration } from "./persistence-v2";
import { fecV2SnapshotId, fecV2TokenDigestSha256, type FecV2OperationalFailureCode } from "./run-descriptor";
import { type VersionedRawObjectStore } from "./versioned-artifact-store";
import { loadFecV2VersionedStoreFromEnvironment, verifyConfiguredSourceLock } from "../../../scripts/ingestion-config";

export type RunSourceResult = Readonly<{ reusedRunIds: readonly string[]; loadedRunIds: readonly string[]; failedRunIds: readonly string[] }>;
export type FecV2RunnerConfig = Readonly<{ planPath: string; expectation: FecPlanExpectation; apiKey: string; deadlineMs: number }>;
export type FecV2RunnerTestingDeps = Readonly<{ store: VersionedRawObjectStore; acquisitionPool: FecV2Pool; verifierPool: FecV2Pool; layout: FecEfoLayout; coordinatorDeps?: FecV2CoordinatorTestingDeps; heartbeatIntervalMs?: number }>;
export type ConfiguredFecV2Request = Readonly<{ release: string; cutoff: string; planPath: string; dryRun: boolean; deadlineMs?: number }>;
export type ConfiguredFecV2Dependencies = Readonly<{ env?: NodeJS.ProcessEnv; createVerifierPool?: (url: string) => FecV2Pool }>;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && Number.isSafeInteger(n);
const opaqueId = (): string => `fecv2_${randomBytes(16).toString("hex")}`;
const loaded = (id: string): RunSourceResult => ({ reusedRunIds: [], loadedRunIds: [id], failedRunIds: [] });
const reused = (id: string): RunSourceResult => ({ reusedRunIds: [id], loadedRunIds: [], failedRunIds: [] });

export async function validateConfiguredFecV2DryRun(config: FecV2RunnerConfig): Promise<Readonly<{ releaseId: string; planSha256: string }>> {
  const now = Date.now();
  if (!finite(config.deadlineMs) || config.deadlineMs <= now || config.deadlineMs > now + 6 * 60 * 60_000 || typeof config.apiKey !== "string" || config.apiKey.length === 0) throw new Error("FEC_V2_CONFIGURATION_INVALID");
  const plan = await readConfiguredFecPlan({ path: config.planPath, expected: config.expectation });
  return Object.freeze({ releaseId: plan.releaseId, planSha256: config.expectation.planSha256 });
}

type Resources = Readonly<{ store: VersionedRawObjectStore; acquisitionPool: FecV2Pool; verifierPool: FecV2Pool; layout: FecEfoLayout; testing?: FecV2CoordinatorTestingDeps; heartbeatIntervalMs?: number }>;
/** The sole lifecycle implementation; production and tests differ only in resources/coordinator. */
async function orchestrate(config: FecV2RunnerConfig, resources: Resources): Promise<RunSourceResult> {
  const validated = await validateConfiguredFecV2DryRun(config); // credential grammar and canonical plan first
  // Layout is an immutable, source-lock-derived object.  Coordinator repeats this fence.
  if (!resources.layout || typeof resources.layout !== "object") throw new Error("FEC_V2_LAYOUT_INVALID");
  const controller = new AbortController();
  const activation = await resources.store.preflight({ signal: controller.signal, deadlineMs: config.deadlineMs });
  resources.store.assertActivated(activation, { signal: controller.signal, deadlineMs: config.deadlineMs });
  const [acquisition, verifier] = await Promise.all([resources.acquisitionPool.connect(), resources.verifierPool.connect()]);
  let lockHeld = false, timer: ReturnType<typeof setInterval> | undefined, heartbeat: Promise<void> = Promise.resolve();
  let persistence: FecV2AcquisitionPersistence | undefined;
  const runId = opaqueId(), token = randomBytes(32).toString("hex");
  try {
    if (fecV2TokenDigestSha256(Buffer.from(token, "hex")).length !== 64) throw new Error("FEC_V2_TOKEN_INVALID");
    await assertFecV2Role(acquisition, "dsa_seats_fec_v2_acquisition"); await assertFecV2Role(verifier, "dsa_seats_fec_v2_replay_verifier");
    await lockFecV2Orchestration(acquisition, validated.releaseId, validated.planSha256); lockHeld = true;
    let verifierPersistence = new FecV2ReplayVerifierPersistence(verifier, validated.releaseId, validated.planSha256, runId);
    persistence = new FecV2AcquisitionPersistence(acquisition, validated.releaseId, validated.planSha256, runId, token);
    const plan = await readConfiguredFecPlan({ path: config.planPath, expected: config.expectation });
    const completed = await verifierPersistence.completedCommitment();
    if (completed) {
      verifierPersistence = new FecV2ReplayVerifierPersistence(verifier, validated.releaseId, validated.planSha256, completed.originRunId);
      const prior = await reuseCompletedFecV2Acquisition({ plan, planSha256: validated.planSha256, store: resources.store, activation, acquisition: new FecV2AcquisitionPersistence(acquisition, validated.releaseId, validated.planSha256, completed.originRunId, token), verifier: verifierPersistence, signal: controller.signal, deadlineMs: config.deadlineMs });
      if (!prior) throw new Error("FEC_V2_COMPLETED_REUSE_INVALID");
      return reused(prior);
    }
    const candidate = await persistence.activeRunCandidate();
    if (candidate) {
      const expiry = new Date(candidate.leaseExpiresAt).getTime();
      if (!Number.isFinite(expiry) || expiry > Date.now()) throw new Error("FEC_V2_ACTIVE_RUN_CONFLICT");
      await persistence.reapExpiredRun(candidate.runId, runId, token);
    } else await persistence.claim();
    const beat = () => { heartbeat = heartbeat.then(() => persistence!.heartbeat()).catch(error => { controller.abort(error); throw error; }); heartbeat.catch(() => undefined); };
    timer = setInterval(beat, resources.heartbeatIntervalMs ?? 60_000);
    const input = { plan, planSha256: validated.planSha256, apiKey: config.apiKey, store: resources.store, activation, acquisition: persistence, verifier: verifierPersistence, runId, snapshotId: fecV2SnapshotId(validated.releaseId, validated.planSha256, runId), signal: controller.signal, deadlineMs: config.deadlineMs, layout: resources.layout };
    if (resources.testing) await coordinateFecV2AcquisitionForTesting(input, resources.testing); else await coordinateFecV2Acquisition(input);
    return loaded(runId);
  } catch (error) {
    controller.abort(error);
    if (persistence) {
      try { if (await persistence.status() === "completed") return loaded(runId); await persistence.abort(); }
      catch { throw new Error("FEC_V2_CONNECTION_LOST"); }
    }
    throw error instanceof Error && error.message.startsWith("FEC_") ? error : new Error("FEC_V2_RUN_FAILED");
  } finally {
    if (timer) clearInterval(timer);
    await heartbeat.catch(() => undefined);
    if (lockHeld) await unlockFecV2Orchestration(acquisition, validated.releaseId, validated.planSha256);
    acquisition.release(); verifier.release();
    await Promise.allSettled([resources.acquisitionPool.end(), resources.verifierPool.end()]);
  }
}

export function createFecV2RunnerForTesting(deps: FecV2RunnerTestingDeps): (config: FecV2RunnerConfig) => Promise<RunSourceResult> {
  if (process.env.NODE_ENV === "production") throw new Error("FEC_V2_CONFIGURATION_INVALID");
  return config => orchestrate(config, { ...deps, testing: deps.coordinatorDeps ?? {}, heartbeatIntervalMs: deps.heartbeatIntervalMs });
}

async function loadSourceLockedLayout(): Promise<FecEfoLayout> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: Array<{ id: string; retainedPath: string | null; sha256: string }> };
  const workbook = lock.entries.find(x => x.id === "fec-efo-workbook-v85"), layout = lock.entries.find(x => x.id === "fec-efo-layouts-v1");
  if (!workbook || !layout?.retainedPath) throw new Error("FEC_V2_CONFIGURATION_INVALID");
  const bytes = await readFile(layout.retainedPath);
  if (createHash("sha256").update(bytes).digest("hex") !== layout.sha256) throw new Error("FEC_V2_CONFIGURATION_INVALID");
  return loadFecEfoLayouts(bytes, workbook.sha256);
}
export function createConfiguredFecV2RunnerFromEnvironment(env: NodeJS.ProcessEnv = process.env): (config: Omit<FecV2RunnerConfig, "apiKey">) => Promise<RunSourceResult> {
  return async config => {
    const acquisitionUrl = env.FEC_V2_ACQUISITION_DATABASE_URL, verifierUrl = env.FEC_V2_REPLAY_VERIFIER_DATABASE_URL;
    if (!acquisitionUrl || !verifierUrl) throw new Error("FEC_V2_CONFIGURATION_INVALID");
    const apiKey = loadFecApiCredential(env);
    const [layout, store] = await Promise.all([loadSourceLockedLayout(), Promise.resolve(loadFecV2VersionedStoreFromEnvironment(env))]);
    return orchestrate({ ...config, apiKey }, { layout, store, acquisitionPool: new Pool({ connectionString: acquisitionUrl, max: 1 }), verifierPool: new Pool({ connectionString: verifierUrl, max: 1 }) });
  };
}

/** Reads the sealed, verifier-owned expectation before decoding an operator plan. */
export async function loadConfiguredFecV2Expectation(request: Pick<ConfiguredFecV2Request, "release">, dependencies: ConfiguredFecV2Dependencies = {}): Promise<FecPlanExpectation> {
  const env = dependencies.env ?? process.env, planSha256 = env.FEC_V2_ACQUISITION_PLAN_SHA256, verifierUrl = env.FEC_V2_REPLAY_VERIFIER_DATABASE_URL;
  if (!planSha256 || !/^[a-f0-9]{64}$/.test(planSha256) || !verifierUrl) throw new Error("FEC_V2_CONFIGURATION_INVALID");
  const pool = (dependencies.createVerifierPool ?? (url => new Pool({ connectionString: url, max: 1 })))(verifierUrl);
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const result = await client.query<{ source_lock_sha256: unknown; seat_cycle_id: unknown }>("SELECT * FROM public.read_fec_v2_plan_expectation($1,$2)", [request.release, planSha256]);
    if (result.rows.length !== 541 || result.rows.some(row => typeof row.source_lock_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.source_lock_sha256) || typeof row.seat_cycle_id !== "string")) throw new Error("FEC_V2_PLAN_EXPECTATION_INVALID");
    const sourceLockSha256 = result.rows[0]!.source_lock_sha256 as string, seatCycleIds = result.rows.map(row => row.seat_cycle_id as string);
    if (result.rows.some(row => row.source_lock_sha256 !== sourceLockSha256) || seatCycleIds.some((id, index) => index > 0 && Buffer.compare(Buffer.from(seatCycleIds[index - 1]!), Buffer.from(id)) >= 0)) throw new Error("FEC_V2_PLAN_EXPECTATION_INVALID");
    const local = await verifyConfiguredSourceLock({ ...env, NODE_ENV: "production", SOURCE_LOCK_SHA256: sourceLockSha256 });
    if (local.sha256 !== sourceLockSha256) throw new Error("FEC_V2_PLAN_EXPECTATION_INVALID");
    return Object.freeze({ planSha256, sourceLockSha256, seatCycleIds: Object.freeze(seatCycleIds) });
  } catch (error) { throw error instanceof Error && error.message.startsWith("FEC_") ? error : new Error("FEC_V2_PLAN_EXPECTATION_INVALID"); }
  finally { client?.release(); await pool.end(); }
}

/** Shared configured entry point used by both operator and standard ingestion CLIs. */
export async function runConfiguredFecV2FromEnvironment(request: ConfiguredFecV2Request, dependencies: ConfiguredFecV2Dependencies = {}): Promise<RunSourceResult> {
  const env = dependencies.env ?? process.env;
  if (request.cutoff !== "2026-07-18" || !request.planPath || request.planPath.includes("\0")) throw new Error("FEC_V2_CONFIGURATION_INVALID");
  const expectation = await loadConfiguredFecV2Expectation(request, dependencies);
  const config = { planPath: request.planPath, expectation, deadlineMs: request.deadlineMs ?? Date.now() + 6 * 60 * 60_000 };
  if (request.dryRun) { await validateConfiguredFecV2DryRun({ ...config, apiKey: "dry-run" }); return { reusedRunIds: [], loadedRunIds: [], failedRunIds: [] }; }
  return createConfiguredFecV2RunnerFromEnvironment(env)({ ...config });
}
export const fecV2OperationalFailureCode = (error: unknown): FecV2OperationalFailureCode => error instanceof Error && error.message.includes("DEADLINE") ? "lease_expired" : error instanceof Error && error.message.includes("ABORT") ? "aborted" : "internal_failure";
