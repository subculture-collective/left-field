import { getPool, closeDb } from "@/db/client";
import { isoDateSchema, releaseIdSchema } from "@/domain/contracts";
import type { Pool } from "pg";

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
export interface IngestCliDependencies { readonly env: NodeJS.ProcessEnv; readonly getPool: () => Pool; readonly registry?: Partial<Record<IngestSource, (args: IngestArguments, pool: Pool) => Promise<void>>>; }
export async function executeIngest(argv: readonly string[], dependencies: IngestCliDependencies): Promise<void> {
  const args = parseIngestArguments(argv);
  if (dependencies.env.NODE_ENV === "production" && (!dependencies.env.RAW_OBJECT_BUCKET || !dependencies.env.DATABASE_URL)) throw new Error("Production ingestion requires RAW_OBJECT_BUCKET and DATABASE_URL");
  const runner = dependencies.registry?.[args.source];
  if (!runner) throw new Error(`Adapter not implemented in this task: ${args.source}`);
  await runner(args, dependencies.getPool());
}
export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> { await executeIngest(argv, { env, getPool }); }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Ingestion failed"}\n`); process.exitCode = 1; }).finally(closeDb);
