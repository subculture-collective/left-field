import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacNumericEvidenceCandidateV2FromFiles } from "../src/ingestion/fec/aipac-numeric-evidence-candidate-v2";

async function main(): Promise<void> {
  const root = resolve("."), pas2Root = process.env.DSA_SEATS_AIPAC_PAS2_DIR ?? "/tmp/dsa-aipac-evidence-20260804";
  const candidate = buildAipacNumericEvidenceCandidateV2FromFiles({
    closure: resolve(root, "data/metadata/aipac-evidence-closure-proposal-v1.json"), foundation: resolve(root, "data/metadata/aipac-evidence-foundation-candidate-v2.json"), projection: resolve(root, "data/metadata/dsa-target-factual-projection-20260804-v1.json"), roster: resolve(root, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), sourceReceipts: resolve(root, "data/metadata/aipac-source-receipts-v1.json"),
    pas2ZipByCycle: { 2022: resolve(pas2Root, "pas222.zip"), 2024: resolve(pas2Root, "pas224.zip"), 2026: resolve(pas2Root, "pas226.zip") },
  });
  const output = resolve(root, "data/metadata/aipac-numeric-evidence-candidate-v2.json"), bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`);
  try { const existing = await readFile(output); if (!existing.equals(bytes)) throw new Error("AIPAC_NUMERIC_V2_OUTPUT_CONFLICT"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  process.stdout.write(`${JSON.stringify({ output, summary: candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_NUMERIC_V2_GENERATION_FAILED"}\n`); process.exitCode = 1; });
