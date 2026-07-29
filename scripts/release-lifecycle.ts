import { Pool, type PoolConfig } from "pg";
import { releaseIdSchema } from "@/domain/contracts";
import { promoteCandidateRelease, rollbackPublishedRelease, rollForwardRetiredRelease, type ElectionPublicationProof, type MapPublicationProof, type LaunchPublicationEvidence } from "@/db/releases";
import { loadLaunchReviewRuntime } from "@/db/launch-review-runtime";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";
import { createMapStore } from "./finalize-maps";
import type { MapArtifactStore } from "@/maps/map-artifact-store";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import { getRuntimeOperationalSignalSink } from "@/operations/runtime-signals";

type Operation = "promote" | "rollback" | "roll-forward";
export interface ReleaseLifecycleArguments { readonly operation: Operation; readonly releaseId?: string; readonly task9RunIds: readonly string[]; readonly electionSourceReleaseId?: string; readonly electionLockEntryIds: readonly string[]; readonly launchFinanceProofId?: string; readonly launchElectionProofId?: string; readonly launchMaps?: boolean; readonly launchFactual?: boolean; }
export interface ReleaseLifecycleEnvironment { readonly INGEST_DATABASE_URL?: string; readonly RELEASE_PREFLIGHT_DATABASE_URL?: string; readonly RELEASE_OPERATOR_DATABASE_URL?: string; readonly LAUNCH_VERIFIER_DATABASE_URL?: string; readonly MAP_ARTIFACT_ROOT?: string; readonly MAP_ARTIFACT_BUCKET?: string; readonly [name: string]: string | undefined; }
export interface ReleaseLifecycleDependencies {
  readonly createPool: (config: PoolConfig) => Pick<Pool, "end">;
  readonly verifySourceLock: typeof verifyConfiguredSourceLock;
  readonly createRawStore: (env: NodeJS.ProcessEnv) => RawObjectStore;
  readonly createMapStore: (env: NodeJS.ProcessEnv) => MapArtifactStore;
  readonly promote: typeof promoteCandidateRelease;
  readonly rollback: typeof rollbackPublishedRelease;
  readonly rollForward: typeof rollForwardRetiredRelease;
  readonly loadLaunchRuntime: typeof loadLaunchReviewRuntime;
}
const message = "Require promote|rollback|roll-forward with strict release and complete optional Task 9 proof arguments";
const lockIdPattern = /^[A-Za-z0-9:_-]{1,128}$/;
const defaults: ReleaseLifecycleDependencies = { createPool: config => new Pool(config), verifySourceLock: verifyConfiguredSourceLock, createRawStore: createRawObjectStore, createMapStore, promote: promoteCandidateRelease, rollback: rollbackPublishedRelease, rollForward: rollForwardRetiredRelease, loadLaunchRuntime: loadLaunchReviewRuntime };
const validRelease = (value: string | undefined): value is string => !!value && releaseIdSchema.safeParse(value).success && /^rel_[A-Za-z0-9_-]+$/.test(value);

export function parseReleaseLifecycleArguments(argv: readonly string[]): ReleaseLifecycleArguments {
  const [operation, ...rest] = argv;
  if (operation !== "promote" && operation !== "rollback" && operation !== "roll-forward") throw new Error(message);
  const values = new Map<string, string>(); const runs: string[] = []; const lockIds: string[] = []; let launchMaps = false; let launchFactual = false;
  for (let i = 0; i < rest.length;) {
    if (rest[i] === "--launch-maps") { if (launchMaps) throw new Error(message); launchMaps = true; i += 1; continue; }
    if (rest[i] === "--launch-factual") { if (launchFactual) throw new Error(message); launchFactual = true; i += 1; continue; }
    const key = rest[i], value = rest[i + 1];
    if (!key || !value || value.startsWith("--") || !["--release", "--task9-run", "--election-source-release", "--election-lock-entry", "--launch-finance-proof", "--launch-election-proof"].includes(key)) throw new Error(message);
    if (key === "--task9-run") runs.push(value); else if (key === "--election-lock-entry") lockIds.push(value); else { if (values.has(key)) throw new Error(message); values.set(key, value); } i += 2;
  }
  const releaseId = values.get("--release"); const electionSourceReleaseId = values.get("--election-source-release");
  if (operation === "rollback") { if (rest.length) throw new Error(message); return { operation, task9RunIds: [], electionLockEntryIds: [] }; }
  const hasElectionProof = runs.length > 0;
  const finance = values.get("--launch-finance-proof"), launchElection = values.get("--launch-election-proof");
  if (!validRelease(releaseId) || (!!finance && !!launchElection) || (launchMaps && (!!finance || !!launchElection || hasElectionProof || launchFactual)) || (launchFactual && (!!finance || !!launchElection || hasElectionProof)) || ((finance || launchElection) && hasElectionProof) || (finance !== undefined && !lockIdPattern.test(finance)) || (launchElection !== undefined && !lockIdPattern.test(launchElection)) || runs.some(id => !id) || new Set(runs).size !== runs.length || (hasElectionProof && (runs.length !== 158 || !electionSourceReleaseId || !validRelease(electionSourceReleaseId) || electionSourceReleaseId === releaseId || lockIds.length < 1 || lockIds.length > 1024 || lockIds.some(id => !lockIdPattern.test(id)) || new Set(lockIds).size !== lockIds.length)) || (!hasElectionProof && (electionSourceReleaseId !== undefined || lockIds.length !== 0))) throw new Error(message);
  return { operation, releaseId, task9RunIds: runs, electionLockEntryIds: lockIds, ...(launchMaps ? { launchMaps: true } : {}), ...(launchFactual ? { launchFactual: true } : {}), ...(electionSourceReleaseId ? { electionSourceReleaseId } : {}), ...(finance ? { launchFinanceProofId: finance } : {}), ...(launchElection ? { launchElectionProofId: launchElection } : {}) };
}

function poolConfig(env: ReleaseLifecycleEnvironment, name: "INGEST_DATABASE_URL" | "RELEASE_PREFLIGHT_DATABASE_URL" | "RELEASE_OPERATOR_DATABASE_URL" | "LAUNCH_VERIFIER_DATABASE_URL"): PoolConfig {
  const value = env[name]; if (!value) throw new Error(`${name} is required`);
  try { const url = new URL(value); if (!(["postgres:", "postgresql:"] as const).includes(url.protocol as "postgres:" | "postgresql:") || !url.username) throw new Error(); } catch { throw new Error(`${name} must be a PostgreSQL URL with a LOGIN username`); }
  return { connectionString: value, max: 3, connectionTimeoutMillis: 5_000, query_timeout: 120_000, statement_timeout: 120_000, lock_timeout: 5_000, idleTimeoutMillis: 30_000 };
}
export function releaseLifecyclePoolConfigs(env: ReleaseLifecycleEnvironment, needsVerifier = false): { readonly ingest: PoolConfig; readonly preflight: PoolConfig; readonly operator: PoolConfig; readonly verifier?: PoolConfig } {
  const base = { ingest: poolConfig(env, "INGEST_DATABASE_URL"), preflight: poolConfig(env, "RELEASE_PREFLIGHT_DATABASE_URL"), operator: poolConfig(env, "RELEASE_OPERATOR_DATABASE_URL") };
  const principal = (config: PoolConfig) => new URL(config.connectionString!).username;
  if (new Set([base.ingest, base.preflight, base.operator].map(principal)).size !== 3) throw new Error("Lifecycle database URLs must use distinct LOGIN usernames");
  if (!needsVerifier) return base;
  const verifier = poolConfig(env, "LAUNCH_VERIFIER_DATABASE_URL");
  if ([base.ingest, base.preflight, base.operator].some(config => principal(config) === principal(verifier))) throw new Error("LAUNCH_VERIFIER_DATABASE_URL must use a distinct LOGIN username");
  return { ...base, verifier };
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

async function launchEvidence(args: ReleaseLifecycleArguments, env: ReleaseLifecycleEnvironment, dependencies: ReleaseLifecycleDependencies, ingest: Pool): Promise<LaunchPublicationEvidence | undefined> {
  if (!args.launchFinanceProofId && !args.launchElectionProofId) return undefined;
  const rawStore = dependencies.createRawStore(env as NodeJS.ProcessEnv); const runtime = dependencies.loadLaunchRuntime(env as NodeJS.ProcessEnv, rawStore);
  if (args.launchFinanceProofId) {
    const result = await ingest.query<{ outcome: string }>('SELECT DISTINCT outcome COLLATE "C" outcome FROM finance_terminal_dispositions WHERE release_id=$1 ORDER BY 1', [args.releaseId]);
    const terminalOutcomes = result.rows.map(row => row.outcome);
    return { finance: { kind: "fec_v1", proof: { proofId: args.launchFinanceProofId, releaseId: args.releaseId!, cutoff: "2026-07-18", summaryDispositions: 541, financeCoverageRows: 2164, terminalOutcomes: terminalOutcomes as ("approved_finance" | "vacancy" | "no_declared_cycle" | "no_authorized_committee" | "no_report")[], unresolvedMappings: 0, paginationGaps: 0, amendmentGaps: 0, digestDomains: ["acs", "elections", "finance", "geography", "identity", "maps", "member"] }, ...runtime } };
  }
  return { election: { proof: { proofId: args.launchElectionProofId!, releaseId: args.releaseId!, cutoff: "2026-07-18", decisionRuns: 158, decisionYears: { 2020: 51, 2022: 56, 2024: 51 }, digestDomains: ["acs", "elections", "finance", "geography", "identity", "maps", "member"] }, ...runtime } };
}

export async function executeReleaseLifecycle(argv: readonly string[], env: ReleaseLifecycleEnvironment, supplied: Partial<ReleaseLifecycleDependencies> = {}): Promise<{ readonly operation: Operation; readonly status: "completed" }> {
  const args = parseReleaseLifecycleArguments(argv); const dependencies = { ...defaults, ...supplied }; const needsVerifier = !!args.launchFinanceProofId || !!args.launchElectionProofId || args.launchMaps || args.launchFactual; const pools = releaseLifecyclePoolConfigs(env, needsVerifier);
  const ingest = dependencies.createPool(pools.ingest); const preflight = dependencies.createPool(pools.preflight); const operator = dependencies.createPool(pools.operator); const verifier = pools.verifier ? dependencies.createPool(pools.verifier) : undefined;
  try {
    const evidence = await launchEvidence(args, env, dependencies, ingest as Pool); const lifecyclePools = { preflightPool: preflight as Pool, operatorPool: operator as Pool, ...(verifier ? { launchVerifierPool: verifier as Pool } : {}), ...(evidence ? { launchEvidence: evidence } : {}), signalSink: getRuntimeOperationalSignalSink() };
    if (args.operation === "rollback") await dependencies.rollback(ingest as Pool, 3, lifecyclePools);
    else { const proof = await electionProof(args, env, dependencies); const maps = mapProof(env, dependencies); if (args.launchMaps && !maps) throw new Error(message); if (args.operation === "promote") await dependencies.promote(ingest as Pool, args.releaseId!, 3, proof, maps, lifecyclePools); else await dependencies.rollForward(ingest as Pool, args.releaseId!, 3, proof, maps, lifecyclePools); }
    return { operation: args.operation, status: "completed" };
  } finally { await Promise.all([ingest.end(), preflight.end(), operator.end(), verifier?.end()]); }
}
const secret = /(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s]+|(?:password|secret|token|api[_-]?key)\s*[=:]\s*[^\s]+/gi;
export function lifecycleFailureReport(error: unknown): string {
  const record = typeof error === "object" && error !== null ? error as { readonly code?: unknown; readonly message?: unknown } : {};
  const code = typeof record.code === "string" && /^[A-Z0-9_-]{1,32}$/i.test(record.code) ? record.code : "UNCLASSIFIED";
  const raw = typeof record.message === "string" ? record.message : "Release lifecycle failed";
  const message = raw.replace(secret, "[REDACTED]").replace(/\s+/g, " ").trim().slice(0, 300) || "Release lifecycle failed";
  return `${JSON.stringify({ error: "release_lifecycle_failed", code, message })}\n`;
}
export async function main(argv = process.argv.slice(2), env = process.env as ReleaseLifecycleEnvironment): Promise<void> { const result = await executeReleaseLifecycle(argv, env); process.stdout.write(`${JSON.stringify(result)}\n`); }
if (process.argv[1]?.endsWith("release-lifecycle.ts")) void main().catch((error: unknown) => { process.stderr.write(lifecycleFailureReport(error)); process.exitCode = 1; });
