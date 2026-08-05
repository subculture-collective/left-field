import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacNumericEvidenceCandidateFromFiles } from "../src/ingestion/fec/aipac-numeric-evidence-candidate";

async function main(): Promise<void> {
  const root = resolve(".");
  const pas2Root = process.env.DSA_SEATS_AIPAC_PAS2_DIR ?? "/tmp/dsa-aipac-evidence-20260804";
  const candidate = buildAipacNumericEvidenceCandidateFromFiles({
    closure: resolve(root, "data/metadata/aipac-evidence-closure-proposal-v1.json"),
    foundation: resolve(root, "data/metadata/aipac-evidence-foundation-candidate-v1.json"),
    projection: resolve(root, "data/metadata/dsa-target-factual-projection-20260804-v1.json"),
    roster: resolve(root, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),
    sourceReceipts: resolve(root, "data/metadata/aipac-source-receipts-v1.json"),
    pas2ZipByCycle: { 2022: resolve(pas2Root, "pas222.zip"), 2024: resolve(pas2Root, "pas224.zip"), 2026: resolve(pas2Root, "pas226.zip") },
  });
  const output = resolve(root, "data/metadata/aipac-numeric-evidence-candidate-v1.json");
  await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  process.stdout.write(`${output}\n${candidate.packageSha256}\n${JSON.stringify(candidate.summary)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_NUMERIC_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
