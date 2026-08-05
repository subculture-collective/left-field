import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacEvidenceFoundationCandidateV3 } from "../src/ingestion/fec/aipac-evidence-foundation-candidate-v3";

const load = async (file: string) => { const bytes = await readFile(resolve("data/metadata", file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
async function main(): Promise<void> {
  const foundation = await load("aipac-evidence-foundation-candidate-v2.json"), dispositions = await load("aipac-incumbent-resolution-dispositions-v2.json");
  const value = buildAipacEvidenceFoundationCandidateV3({ foundationV2: foundation.value, foundationV2FileSha256: foundation.sha256, dispositionsV2: dispositions.value, dispositionsV2FileSha256: dispositions.sha256 });
  const output = resolve("data/metadata/aipac-evidence-foundation-candidate-v3.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("AIPAC_FOUNDATION_V3_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_FOUNDATION_V3_GENERATION_FAILED"}\n`); process.exitCode = 1; });
