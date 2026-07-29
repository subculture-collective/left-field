import { isoDateSchema, releaseIdSchema } from "@/domain/contracts";
import { runConfiguredFecV2FromEnvironment, type ConfiguredFecV2Request } from "@/ingestion/fec/runner";

export type AcquireFecV2Arguments = Readonly<{ release: string; cutoff: string; planPath: string }>;
export function parseAcquireFecV2Arguments(argv: readonly string[]): AcquireFecV2Arguments {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (flag !== "--release" && flag !== "--cutoff" && flag !== "--plan") throw new Error(`Unknown argument ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith("--") || values.has(flag) || value.includes("\0")) throw new Error(`Expected one value for ${flag}`);
    values.set(flag, value);
  }
  const release = values.get("--release"), cutoff = values.get("--cutoff"), planPath = values.get("--plan");
  if (!release || !cutoff || !planPath || !releaseIdSchema.safeParse(release).success || !isoDateSchema.safeParse(cutoff).success || cutoff !== "2026-07-18") throw new Error("Require --release rel_..., --cutoff 2026-07-18, and --plan PATH");
  return { release, cutoff, planPath };
}
export async function executeAcquireFecV2(argv: readonly string[], env = process.env, run = runConfiguredFecV2FromEnvironment) {
  const args = parseAcquireFecV2Arguments(argv);
  const result = await run({ ...args, dryRun: false } satisfies ConfiguredFecV2Request, { env });
  return { source: "fec", release: args.release, runIds: result.loadedRunIds, reusedRunIds: result.reusedRunIds };
}
export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> { process.stdout.write(`${JSON.stringify(await executeAcquireFecV2(argv, env))}\n`); }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error && error.message.startsWith("FEC_") ? error.message : "FEC_V2_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
