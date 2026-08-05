import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacNumericReviewPackage } from "../src/ingestion/fec/aipac-numeric-review-package";
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const files = { foundation: "data/metadata/aipac-evidence-foundation-candidate-v1.json", candidate: "data/metadata/aipac-numeric-evidence-candidate-v1.json", report: "data/metadata/dsa-target-evaluation-review-report-20260805-v3.json" } as const;
  const loaded = await Promise.all(Object.values(files).map(async (path) => { const bytes = await readFile(path); return { value: JSON.parse(bytes.toString()), sha256: sha(bytes) }; }));
  const value = buildAipacNumericReviewPackage({ foundation: loaded[0]!.value, foundationFileSha256: loaded[0]!.sha256, candidate: loaded[1]!.value, candidateFileSha256: loaded[1]!.sha256, report: loaded[2]!.value, reportFileSha256: loaded[2]!.sha256 });
  const output = resolve("data/metadata/aipac-numeric-review-package-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("AIPAC_NUMERIC_REVIEW_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, ...value.summary, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_NUMERIC_REVIEW_GENERATION_FAILED"}\n`); process.exitCode = 1; });
