import { Pool, type PoolConfig } from "pg";
import { releaseIdSchema } from "@/domain/contracts";
import { promoteCandidateRelease, rollbackPublishedRelease, rollForwardRetiredRelease, type ElectionPublicationProof, type MapPublicationProof } from "@/db/releases";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";
import { createMapStore } from "./finalize-maps";
import type { MapArtifactStore } from "@/maps/map-artifact-store";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import { getRuntimeOperationalSignalSink } from "@/operations/runtime-signals";

type Operation = "promote" | "rollback" | "roll-forward";
export interface ReleaseLifecycleArguments { readonly operation: Operation; readonly releaseId?: string; readonly task9RunIds: readonly string[]; readonly electionSourceReleaseId?: string; readonly electionLockEntryIds: readonly string[]; }
export interface ReleaseLifecycleEnvironment { readonly INGEST_DATABASE_URL?: string; readonly RELEASE_PREFLIGHT_DATABASE_URL?: string; readonly RELEASE_OPERATOR_DATABASE_URL?: string; readonly MAP_ARTIFACT_ROOT?: string; readonly MAP_ARTIFACT_BUCKET?: string; readonly [name: string]: string | undefined; }
export interface ReleaseLifecycleDependencies {
  readonly createPool: (config: PoolConfig) => Pick<Pool, "end">;
  readonly verifySourceLock: typeof verifyConfiguredSourceLock;
  readonly createRawStore: (env: NodeJS.ProcessEnv) => RawObjectStore;
  readonly createMapStore: (env: NodeJS.ProcessEnv) => MapArtifactStore;
  readonly promote: typeof promoteCandidateRelease;
  readonly rollback: typeof rollbackPublishedRelease;
  readonly rollForward: typeof rollForwardRetiredRelease;
}
const message = "Require promote|rollback|roll-forward with strict release and complete optional Task 9 proof arguments";
const lockIdPattern = /^[A-Za-z0-9:_-]{1,128}$/;
const defaults: ReleaseLifecycleDependencies = { createPool: config => new Pool(config), verifySourceLock: verifyConfiguredSourceLock, createRawStore: createRawObjectStore, createMapStore, promote: promoteCandidateRelease, rollback: rollbackPublishedRelease, rollForward: rollForwardRetiredRelease };
const validRelease = (value: string | undefined): value is string => !!value && releaseIdSchema.safeParse(value).success && /^rel_[A-Za-z0-9_-]+$/.test(value);

export function parseReleaseLifecycleArguments(argv: readonly string[]): ReleaseLifecycleArguments {
  const [operation, ...rest] = argv;
  if (operation !== "promote" && operation !== "rollback" && operation !== "roll-forward") throw new Error(message);
  const values = new Map<string, string>(); const runs: string[] = []; const lockIds: string[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i], value = rest[i + 1];
    if (!key || !value || value.startsWith("--") || !["--release", "--task9-run", "--election-source-release", "--election-lock-entry"].includes(key)) throw new Error(message);
    if (key === "--task9-run") runs.push(value); else if (key === "--election-lock-entry") lockIds.push(value); else { if (values.has(key)) throw new Error(message); values.set(key, value); }
  }
  const releaseId = values.get("--release"); const electionSourceReleaseId = values.get("--election-source-release");
  if (operation === "rollback") { if (rest.length) throw new Error(message); return { operation, task9RunIds: [], electionLockEntryIds: [] }; }
  const hasElectionProof = runs.length > 0;
  if (!validRelease(releaseId) || runs.some(id => !id) || new Set(runs).size !== runs.length || (hasElectionProof && (runs.length !== 158 || !electionSourceReleaseId || !validRelease(electionSourceReleaseId) || electionSourceReleaseId === releaseId || lockIds.length < 1 || lockIds.length > 1024 || lockIds.some(id => !lockIdPattern.test(id)) || new Set(lockIds).size !== lockIds.length)) || (!hasElectionProof && (electionSourceReleaseId !== undefined || lockIds.length !== 0))) throw new Error(message);
  return { operation, releaseId, task9RunIds: runs, electionLockEntryIds: lockIds, ...(electionSourceReleaseId ? { electionSourceReleaseId } : {}) };
}

function poolConfig(env: ReleaseLifecycleEnvironment, name: "INGEST_DATABASE_URL" | "RELEASE_PREFLIGHT_DATABASE_URL" | "RELEASE_OPERATOR_DATABASE_URL"): PoolConfig {
  const value = env[name]; if (!value) throw new Error(`${name} is required`);
  try { const url = new URL(value); if (!(["postgres:", "postgresql:"] as const).includes(url.protocol as "postgres:" | "postgresql:") || !url.username) throw new Error(); } catch { throw new Error(`${name} must be a PostgreSQL URL with a LOGIN username`); }
  return { connectionString: value, max: 3, connectionTimeoutMillis: 5_000, query_timeout: 120_000, statement_timeout: 120_000, lock_timeout: 5_000, idleTimeoutMillis: 30_000 };
}
export function releaseLifecyclePoolConfigs(env: ReleaseLifecycleEnvironment): { readonly ingest: PoolConfig; readonly preflight: PoolConfig; readonly operator: PoolConfig } {
  return { ingest: poolConfig(env, "INGEST_DATABASE_URL"), preflight: poolConfig(env, "RELEASE_PREFLIGHT_DATABASE_URL"), operator: poolConfig(env, "RELEASE_OPERATOR_DATABASE_URL") };
}

async function electionProof(args: ReleaseLifecycleArguments, env: ReleaseLifecycleEnvironment, dependencies: ReleaseLifecycleDependencies): Promise<ElectionPublicationProof | undefined> {
  if (!args.task9RunIds.length) return undefined;
  if (!args.electionSourceReleaseId || args.task9RunIds.length !== 158 || !args.electionLockEntryIds.length) throw new Error(message);
  const { lock, sha256 } = await dependencies.verifySourceLock(env as NodeJS.ProcessEnv);
  const sourceLockEntries = args.electionLockEntryIds.map(id => {
    const matches = lock.entries.filter(entry => entry.id === id);
    if (matches.length !== 1) throw new Error(message);
    const entry = matches[0]!;
    return { id: entry.id, url: entry.url, sha256: entry.sha256, byteSize: entry.byteSize };
  }).sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)));
  return { rawStore: dependencies.createRawStore(env as NodeJS.ProcessEnv), sourceReleaseId: args.electionSourceReleaseId, runIds: args.task9RunIds, sourceLockSha256: sha256, sourceLockEntries };
}
function mapProof(env: ReleaseLifecycleEnvironment, dependencies: ReleaseLifecycleDependencies): MapPublicationProof | undefined {
  if (!env.MAP_ARTIFACT_ROOT && !env.MAP_ARTIFACT_BUCKET) return undefined;
  return { store: dependencies.createMapStore(env as NodeJS.ProcessEnv) };
}

export async function executeReleaseLifecycle(argv: readonly string[], env: ReleaseLifecycleEnvironment, supplied: Partial<ReleaseLifecycleDependencies> = {}): Promise<{ readonly operation: Operation; readonly status: "completed" }> {
  const args = parseReleaseLifecycleArguments(argv); const dependencies = { ...defaults, ...supplied }; const pools = releaseLifecyclePoolConfigs(env);
  const ingest = dependencies.createPool(pools.ingest); const preflight = dependencies.createPool(pools.preflight); const operator = dependencies.createPool(pools.operator);
  try {
    const lifecyclePools = { preflightPool: preflight as Pool, operatorPool: operator as Pool, signalSink: getRuntimeOperationalSignalSink() };
    if (args.operation === "rollback") await dependencies.rollback(ingest as Pool, 3, lifecyclePools);
    else { const proof = await electionProof(args, env, dependencies); const maps = mapProof(env, dependencies); if (args.operation === "promote") await dependencies.promote(ingest as Pool, args.releaseId!, 3, proof, maps, lifecyclePools); else await dependencies.rollForward(ingest as Pool, args.releaseId!, 3, proof, maps, lifecyclePools); }
    return { operation: args.operation, status: "completed" };
  } finally { await Promise.all([ingest.end(), preflight.end(), operator.end()]); }
}
export async function main(argv = process.argv.slice(2), env = process.env as ReleaseLifecycleEnvironment): Promise<void> { const result = await executeReleaseLifecycle(argv, env); process.stdout.write(`${JSON.stringify(result)}\n`); }
if (process.argv[1]?.endsWith("release-lifecycle.ts")) void main().catch(() => { process.stderr.write("Release lifecycle failed\n"); process.exitCode = 1; });
