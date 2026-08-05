import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacEvidenceFoundationCandidateV2 } from "../src/ingestion/fec/aipac-evidence-foundation-candidate-v2";

const root = resolve("data/metadata");
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function load(file: string): Promise<{ value: unknown; sha256: string }> { const bytes = await readFile(resolve(root, file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) }; }

async function main(): Promise<void> {
  const foundation = await load("aipac-evidence-foundation-candidate-v1.json");
  const ambiguity = await load("aipac-challenger-ambiguity-resolution-candidate-v1.json");
  const incumbent = await load("aipac-incumbent-conflict-resolution-candidate-v1.json");
  const candidate = buildAipacEvidenceFoundationCandidateV2({ foundation: foundation.value, foundationFileSha256: foundation.sha256, ambiguity: ambiguity.value, ambiguityFileSha256: ambiguity.sha256, incumbent: incumbent.value, incumbentFileSha256: incumbent.sha256 });
  const output = resolve(root, "aipac-evidence-foundation-candidate-v2.json");
  const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`);
  try { const existing = await readFile(output); if (!existing.equals(bytes)) throw new Error("AIPAC_FOUNDATION_V2_OUTPUT_CONFLICT"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  process.stdout.write(`${JSON.stringify({ output, summary: candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_FOUNDATION_V2_GENERATION_FAILED"}\n`); process.exitCode = 1; });
