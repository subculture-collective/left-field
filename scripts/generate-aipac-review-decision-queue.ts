import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacReviewDecisionQueue, validateAipacReviewDecisionQueue } from "../src/ingestion/fec/aipac-review-decision-queue";

const root = resolve("data/metadata");
const load = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), "utf8"));

async function main(): Promise<void> {
  const queue = buildAipacReviewDecisionQueue({
    mapping: await load("aipac-candidate-seat-mappings-proposal-v1.json"),
    evidenceClosure: await load("aipac-evidence-closure-proposal-v1.json"),
    networkClassification: await load("org-classification-aipac-network-proposal-v1.json"),
  });
  validateAipacReviewDecisionQueue(queue);
  const output = resolve(root, "aipac-review-decision-queue-v1.json");
  await writeFile(output, `${JSON.stringify(queue, null, 2)}\n`, { mode: 0o644 });
  process.stdout.write(`${JSON.stringify({ output, ...queue.summary, packageSha256: queue.packageSha256 }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_REVIEW_QUEUE_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
