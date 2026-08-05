import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacChallengerAmbiguityResolutionCandidate } from "../src/ingestion/fec/aipac-challenger-ambiguity-resolution-candidate";

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const root = resolve("data/metadata");

async function load(file: string): Promise<{ value: unknown; sha256: string }> {
  const bytes = await readFile(resolve(root, file));
  return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) };
}

async function main(): Promise<void> {
  const closure = await load("aipac-evidence-closure-proposal-v1.json");
  const foundation = await load("aipac-evidence-foundation-candidate-v1.json");
  const candidate = buildAipacChallengerAmbiguityResolutionCandidate({ closure: closure.value, closureFileSha256: closure.sha256, foundation: foundation.value, foundationFileSha256: foundation.sha256 });
  const output = resolve(root, "aipac-challenger-ambiguity-resolution-candidate-v1.json");
  const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  try {
    const existing = await readFile(output);
    if (!existing.equals(bytes)) throw new Error("AIPAC_AMBIGUITY_OUTPUT_CONFLICT");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(output, bytes, { mode: 0o644, flag: "wx" });
  }
  process.stdout.write(`${JSON.stringify({ output, summary: candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_AMBIGUITY_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
