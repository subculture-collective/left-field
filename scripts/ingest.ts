import { getPool, closeDb } from "@/db/client";
import { isoDateSchema, releaseIdSchema } from "@/domain/contracts";
import type { Pool } from "pg";
import { assertProductionIngestionEnv, createRawObjectStore, runConfiguredSource, verifyConfiguredSourceLock } from "./ingestion-config";
import type { RunSourceResult } from "@/ingestion/core/run-source";

export type IngestSource = "identity" | "tiger" | "acs" | "fec" | "elections";
export interface IngestArguments { readonly source: IngestSource; readonly release: string; readonly cutoff: string; readonly dryRun: boolean; }
export function parseIngestArguments(argv: readonly string[]): IngestArguments {
  const values = new Map<string, string>(); let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--dry-run") { if (dryRun) throw new Error("Duplicate --dry-run"); dryRun = true; continue; }
    if (arg !== "--source" && arg !== "--release" && arg !== "--cutoff") throw new Error(`Unknown argument ${arg}`);
    const value = argv[++index]; if (!value || value.startsWith("--") || values.has(arg)) throw new Error(`Expected one value for ${arg}`); values.set(arg, value);
  }
  const source = values.get("--source"); const release = values.get("--release"); const cutoff = values.get("--cutoff");
  if (!source || !release || !cutoff || !releaseIdSchema.safeParse(release).success || !isoDateSchema.safeParse(cutoff).success) throw new Error("Require --source identity|tiger|acs|fec|elections, --release rel_..., and --cutoff YYYY-MM-DD");
  if (!(["identity", "tiger", "acs", "fec", "elections"] as const).includes(source as IngestSource)) throw new Error("Unknown ingestion source");
  return { source: source as IngestSource, release, cutoff, dryRun };
}
type IngestRunner = (args: IngestArguments, pool: Pool) => Promise<RunSourceResult>;
export interface IngestCliDependencies { readonly env: NodeJS.ProcessEnv; readonly getPool: () => Pool; readonly registry?: Partial<Record<IngestSource, IngestRunner>>; }
export interface IngestExecutionResult { readonly source: IngestSource; readonly release: string; readonly runIds: readonly string[]; readonly reusedRunIds: readonly string[]; readonly finalizationRunIds: readonly string[]; }
export function defaultRegistry(env: NodeJS.ProcessEnv): Partial<Record<IngestSource, IngestRunner>> {
  return { identity: async (args, pool) => runConfiguredSource("identity", args, pool, createRawObjectStore(env), env), tiger: async (args, pool) => runConfiguredSource("tiger", args, pool, createRawObjectStore(env), env), acs: async (args, pool) => runConfiguredSource("acs", args, pool, createRawObjectStore(env), env) };
}
export async function executeIngest(argv: readonly string[], dependencies: IngestCliDependencies): Promise<IngestExecutionResult> {
  const args = parseIngestArguments(argv);
  const runner = dependencies.registry?.[args.source];
  if (!runner) throw new Error(`Ingestion source is unavailable: ${args.source}`);
  if (!args.dryRun) throw new Error("Configured ingestion only stages with --dry-run; use the source-specific finalization command to finalize a candidate");
  assertProductionIngestionEnv(dependencies.env);
  if (dependencies.env.NODE_ENV === "production") await verifyConfiguredSourceLock(dependencies.env);
  const result = await runner(args, dependencies.getPool());
  return { source: args.source, release: args.release, runIds: result.runIds, reusedRunIds: result.reusedRunIds, finalizationRunIds: [...result.runIds, ...result.reusedRunIds] };
}
export async function main(argv = process.argv.slice(2), env = process.env, dependencies: Omit<IngestCliDependencies, "env"> = { getPool, registry: defaultRegistry(env) }): Promise<IngestExecutionResult> { const result = await executeIngest(argv, { env, ...dependencies }); process.stdout.write(`${JSON.stringify(result)}\n`); return result; }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Ingestion failed"}\n`); process.exitCode = 1; }).finally(closeDb);
