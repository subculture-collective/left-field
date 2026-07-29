import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { compileFecAcquisitionPlan } from "@/ingestion/fec/plan-compiler";

export type CompileFecV2PlanArguments = Readonly<{
  inputPath: string;
  planPath: string;
  manifestPath: string;
}>;

const usage = "Require exactly --input PATH --plan PATH --manifest PATH";

export function parseCompileFecV2PlanArguments(argv: readonly string[]): CompileFecV2PlanArguments {
  const values = new Map<string, string>();
  const allowed = new Set(["--input", "--plan", "--manifest"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !allowed.has(key) || values.has(key) || !value || value.startsWith("--") || value.includes("\0")) {
      throw new Error(usage);
    }
    values.set(key, value);
  }
  const inputPath = values.get("--input"), planPath = values.get("--plan"), manifestPath = values.get("--manifest");
  if (!inputPath || !planPath || !manifestPath || new Set([inputPath, planPath, manifestPath]).size !== 3) throw new Error(usage);
  return { inputPath, planPath, manifestPath };
}

async function writeExactOrVerify(path: string, bytes: Uint8Array): Promise<"written" | "verified"> {
  try {
    await access(path, constants.F_OK);
    const existing = await readFile(path);
    if (!existing.equals(Buffer.from(bytes))) throw new Error("FEC_PLAN_OUTPUT_CONFLICT");
    return "verified";
  } catch (error) {
    if (error instanceof Error && error.message === "FEC_PLAN_OUTPUT_CONFLICT") throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o640 });
    return "written";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readFile(path);
    if (!existing.equals(Buffer.from(bytes))) throw new Error("FEC_PLAN_OUTPUT_CONFLICT");
    return "verified";
  }
}

export async function executeCompileFecV2Plan(argv: readonly string[]): Promise<Readonly<{
  release: string;
  planSha256: string;
  targetUniverseSha256: string;
  plan: "written" | "verified";
  manifest: "written" | "verified";
}>> {
  const args = parseCompileFecV2PlanArguments(argv);
  let input: unknown;
  try {
    input = JSON.parse(await readFile(args.inputPath, "utf8"));
  } catch {
    throw new Error("FEC_PLAN_COMPILATION_INVALID");
  }
  const compiled = compileFecAcquisitionPlan(input);
  const plan = await writeExactOrVerify(args.planPath, compiled.planBytes);
  const manifest = await writeExactOrVerify(args.manifestPath, compiled.manifestBytes);
  return {
    release: compiled.manifest.releaseId,
    planSha256: compiled.manifest.planSha256,
    targetUniverseSha256: compiled.manifest.targetUniverseSha256,
    plan,
    manifest,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  process.stdout.write(`${JSON.stringify(await executeCompileFecV2Plan(argv))}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error && error.message.startsWith("FEC_") ? error.message : "FEC_PLAN_COMPILATION_FAILED"}\n`);
    process.exitCode = 1;
  });
}
