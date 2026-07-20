import { closeDb, getPool } from "@/db/client";
import { releaseIdSchema } from "@/domain/contracts";
import { finalizeCandidateAcs } from "@/ingestion/acs/finalize-acs";
import { ACS_INDICATOR_DICTIONARY } from "@/ingestion/acs/indicator-dictionary";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import type { Pool } from "pg";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";

export interface FinalizeAcsArguments { readonly release: string; readonly sourceRelease: string; readonly populationRun: string; readonly ageRun: string; readonly incomeRun: string; }
const message = "Require exactly --release, --source-release, --population-run, --age-run, and --income-run";
export function parseFinalizeAcsArguments(argv: readonly string[]): FinalizeAcsArguments {
  const values = new Map<string, string>(), keys = ["--release", "--source-release", "--population-run", "--age-run", "--income-run"];
  for (let i = 0; i < argv.length; i += 1) { const key = argv[i]!; if (!keys.includes(key) || values.has(key) || !argv[i + 1] || argv[i + 1]!.startsWith("--")) throw new Error(message); values.set(key, argv[++i]!); }
  const release = values.get("--release"), sourceRelease = values.get("--source-release"), populationRun = values.get("--population-run"), ageRun = values.get("--age-run"), incomeRun = values.get("--income-run");
  if (!release || !sourceRelease || !populationRun || !ageRun || !incomeRun || !releaseIdSchema.safeParse(release).success || !releaseIdSchema.safeParse(sourceRelease).success || release === sourceRelease || new Set([populationRun, ageRun, incomeRun]).size !== 3) throw new Error(message);
  return { release, sourceRelease, populationRun, ageRun, incomeRun };
}
export interface FinalizeAcsResult { readonly release: string; readonly sourceReleaseId: string; readonly runIds: readonly [string, string, string]; readonly status: "validated_candidate"; }
export interface FinalizeAcsDependencies { readonly env: NodeJS.ProcessEnv; readonly getPool: () => Pool; readonly rawStore?: RawObjectStore; readonly finalize?: typeof finalizeCandidateAcs; }
export async function executeFinalizeAcs(argv: readonly string[], dependencies: FinalizeAcsDependencies): Promise<FinalizeAcsResult> {
  const args = parseFinalizeAcsArguments(argv);
  if (dependencies.env.NODE_ENV === "production" && (!dependencies.env.RAW_OBJECT_BUCKET || !dependencies.env.DATABASE_URL || !dependencies.env.SOURCE_LOCK_SHA256)) throw new Error("Production finalization requires RAW_OBJECT_BUCKET, DATABASE_URL, and SOURCE_LOCK_SHA256");
  const rawStore = dependencies.rawStore ?? createRawObjectStore(dependencies.env);
  const { lock, sha256: sourceLockSha256 } = await verifyConfiguredSourceLock(dependencies.env);
  const sourceLockEntries = ACS_INDICATOR_DICTIONARY.map((definition) => {
    const entry = lock.entries.find((candidate) => candidate.id === definition.lockId);
    if (!entry) throw new Error("ACS_SOURCE_LOCK_ENTRY_INVALID");
    return { id: definition.lockId, url: entry.url, sha256: entry.sha256, byteSize: entry.byteSize };
  });
  const runIds = [args.populationRun, args.ageRun, args.incomeRun] as const;
  await (dependencies.finalize ?? finalizeCandidateAcs)({ pool: dependencies.getPool(), rawStore, candidateReleaseId: args.release, sourceReleaseId: args.sourceRelease, runIds, sourceLockSha256, sourceLockEntries });
  return { release: args.release, sourceReleaseId: args.sourceRelease, runIds, status: "validated_candidate" };
}
export async function main(argv = process.argv.slice(2), env = process.env, dependencies: Omit<FinalizeAcsDependencies, "env"> = { getPool }): Promise<FinalizeAcsResult> { const result = await executeFinalizeAcs(argv, { env, ...dependencies }); process.stdout.write(`${JSON.stringify(result)}\n`); return result; }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "ACS finalization failed"}\n`); process.exitCode = 1; }).finally(closeDb);
