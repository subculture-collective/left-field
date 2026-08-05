import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildAipacEvidenceFoundationCandidate,
  validateAipacEvidenceFoundationCandidate,
} from "../src/ingestion/fec/aipac-evidence-foundation-candidate";

const root = resolve("data/metadata");
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function load(file: string): Promise<{ value: unknown; sha256: string }> {
  const bytes = await readFile(resolve(root, file));
  return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) };
}

async function main(): Promise<void> {
  const mapping = await load("aipac-candidate-seat-mappings-proposal-v1.json");
  const evidenceClosure = await load("aipac-evidence-closure-proposal-v1.json");
  const networkClassification = await load("org-classification-aipac-network-proposal-v1.json");
  const candidate = buildAipacEvidenceFoundationCandidate({
    mapping: mapping.value,
    mappingFileSha256: mapping.sha256,
    evidenceClosure: evidenceClosure.value,
    evidenceClosureFileSha256: evidenceClosure.sha256,
    networkClassification: networkClassification.value,
    networkClassificationFileSha256: networkClassification.sha256,
  });
  validateAipacEvidenceFoundationCandidate(candidate);
  const output = resolve(root, "aipac-evidence-foundation-candidate-v1.json");
  await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o644 });
  process.stdout.write(`${JSON.stringify({ output, ...candidate.summary, packageSha256: candidate.packageSha256 }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_FOUNDATION_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
