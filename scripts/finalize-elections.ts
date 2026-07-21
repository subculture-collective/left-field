import { closeDb, getPool } from "@/db/client";
import { releaseIdSchema } from "@/domain/contracts";
import { finalizeCandidateElectionDecisions } from "@/ingestion/elections/finalize-elections";
import type { ElectionDecisionSourceLockEntry } from "@/ingestion/elections/adapter";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import type { Pool } from "pg";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";

export interface FinalizeElectionArguments {
  readonly release: string;
  readonly sourceRelease: string;
  readonly runIds: readonly string[];
  readonly lockEntries: readonly ElectionDecisionSourceLockEntry[];
}
const message = "Require --release, --source-release, one or more unique --run values, and exact JSON --lock-entry values";
const parseEntry = (value: string): ElectionDecisionSourceLockEntry => {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(message); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(message);
  const entry = parsed as Record<string, unknown>;
  if (Object.keys(entry).sort().join(",") !== "byteSize,id,sha256,url" || typeof entry.id !== "string" || typeof entry.url !== "string" || typeof entry.sha256 !== "string" || typeof entry.byteSize !== "number") throw new Error(message);
  return { id: entry.id, url: entry.url, sha256: entry.sha256, byteSize: entry.byteSize };
};

export function parseFinalizeElectionArguments(argv: readonly string[]): FinalizeElectionArguments {
  const singletons = new Map<string, string>();
  const repeated = new Map<string, string[]>();
  const known = new Set(["--release", "--source-release", "--run", "--lock-entry"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !known.has(key) || !value || value.startsWith("--")) throw new Error(message);
    if (key === "--run" || key === "--lock-entry") repeated.set(key, [...(repeated.get(key) ?? []), value]);
    else { if (singletons.has(key)) throw new Error(message); singletons.set(key, value); }
  }
  const release = singletons.get("--release"), sourceRelease = singletons.get("--source-release");
  const runIds = repeated.get("--run") ?? [], lockEntries = (repeated.get("--lock-entry") ?? []).map(parseEntry);
  if (!release || !sourceRelease || release === sourceRelease || !releaseIdSchema.safeParse(release).success || !releaseIdSchema.safeParse(sourceRelease).success || runIds.length < 1 || runIds.length > 158 || new Set(runIds).size !== runIds.length || lockEntries.length < 1 || new Set(lockEntries.map((entry) => entry.id)).size !== lockEntries.length) throw new Error(message);
  return { release, sourceRelease, runIds, lockEntries };
}

export interface FinalizeElectionDependencies {
  readonly env: NodeJS.ProcessEnv;
  readonly getPool: () => Pool;
  readonly rawStore?: RawObjectStore;
  readonly finalize?: typeof finalizeCandidateElectionDecisions;
}
export async function executeFinalizeElections(argv: readonly string[], dependencies: FinalizeElectionDependencies): Promise<{ release: string; status: "validated_candidate" }> {
  const args = parseFinalizeElectionArguments(argv);
  if (dependencies.env.NODE_ENV === "production" && (!dependencies.env.RAW_OBJECT_BUCKET || !dependencies.env.DATABASE_URL || !dependencies.env.SOURCE_LOCK_SHA256)) throw new Error("Production finalization requires RAW_OBJECT_BUCKET, DATABASE_URL, and SOURCE_LOCK_SHA256");
  const { lock, sha256: sourceLockSha256 } = await verifyConfiguredSourceLock(dependencies.env);
  for (const expected of args.lockEntries) {
    const actual = lock.entries.find((entry) => entry.id === expected.id);
    if (!actual || actual.url !== expected.url || actual.sha256 !== expected.sha256 || actual.byteSize !== expected.byteSize) throw new Error("ELECTION_FINALIZE_SOURCE_LOCK_MISMATCH");
  }
  await (dependencies.finalize ?? finalizeCandidateElectionDecisions)({ pool: dependencies.getPool(), rawStore: dependencies.rawStore ?? createRawObjectStore(dependencies.env), candidateReleaseId: args.release, sourceReleaseId: args.sourceRelease, runIds: args.runIds, sourceLockSha256, sourceLockEntries: args.lockEntries });
  return { release: args.release, status: "validated_candidate" };
}
export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> { const result = await executeFinalizeElections(argv, { env, getPool }); process.stdout.write(`${JSON.stringify(result)}\n`); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "Election finalization failed"}\n`); process.exitCode = 1; }).finally(closeDb);
