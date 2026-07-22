import { closeDb, getIngestPool } from "@/db/client";
import { releaseIdSchema } from "@/domain/contracts";
import { finalizeNationwideCandidate } from "@/ingestion/catalog/finalize-nationwide";
import type { Pool } from "pg";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";

export interface FinalizeArguments { readonly release: string; readonly identityRun: string; readonly tigerRun: string; }
export function parseFinalizeArguments(argv: readonly string[]): FinalizeArguments {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) { const key = argv[i]!; if (!["--release", "--identity-run", "--tiger-run"].includes(key) || values.has(key) || !argv[i + 1] || argv[i + 1]!.startsWith("--")) throw new Error("Require exactly --release, --identity-run, and --tiger-run"); values.set(key, argv[++i]!); }
  const release = values.get("--release"), identityRun = values.get("--identity-run"), tigerRun = values.get("--tiger-run");
  if (!release || !identityRun || !tigerRun || identityRun === tigerRun || !releaseIdSchema.safeParse(release).success) throw new Error("Require exactly --release, --identity-run, and --tiger-run"); return { release, identityRun, tigerRun };
}
export interface FinalizeExecutionResult { readonly release: string; readonly identityRunId: string; readonly tigerRunId: string; readonly status: "finalized"; }
export async function executeFinalize(argv: readonly string[], dependencies: { env: NodeJS.ProcessEnv; getPool: () => Pool; rawStore?: RawObjectStore; finalize?: typeof finalizeNationwideCandidate }): Promise<FinalizeExecutionResult> {
  const args = parseFinalizeArguments(argv);
  if (dependencies.env.NODE_ENV === "production" && (!dependencies.env.RAW_OBJECT_BUCKET || !dependencies.env.INGEST_DATABASE_URL)) throw new Error("Production finalization requires RAW_OBJECT_BUCKET and INGEST_DATABASE_URL");
  const rawStore = dependencies.rawStore ?? createRawObjectStore(dependencies.env);
  const { sha256: sourceLockSha256 } = await verifyConfiguredSourceLock(dependencies.env);
  await (dependencies.finalize ?? finalizeNationwideCandidate)({ pool: dependencies.getPool(), rawStore, releaseId: args.release, identityRunId: args.identityRun, tigerRunId: args.tigerRun, sourceLockSha256 });
  return { release: args.release, identityRunId: args.identityRun, tigerRunId: args.tigerRun, status: "finalized" };
}
export async function main(argv = process.argv.slice(2), env = process.env, dependencies: Omit<Parameters<typeof executeFinalize>[1], "env"> = { getPool: getIngestPool }): Promise<FinalizeExecutionResult> { const result = await executeFinalize(argv, { env, ...dependencies }); process.stdout.write(`${JSON.stringify(result)}\n`); return result; }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Finalization failed"}\n`); process.exitCode = 1; }).finally(closeDb);
