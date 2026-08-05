import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacNumericReviewPackageV4 } from "../src/ingestion/fec/aipac-numeric-review-package-v4";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function load(path: string): Promise<{ value: unknown; sha256: string }> { const bytes = await readFile(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) }; }
async function main(): Promise<void> {
  const root = resolve("data/metadata");
  const [foundation, candidate, report] = await Promise.all(["aipac-evidence-foundation-candidate-v4.json", "aipac-numeric-evidence-candidate-v4.json", "dsa-target-evaluation-review-report-20260805-v6.json"].map((name) => load(resolve(root, name))));
  const value = buildAipacNumericReviewPackageV4({ foundation: foundation.value, foundationFileSha256: foundation.sha256, candidate: candidate.value, candidateFileSha256: candidate.sha256, report: report.value, reportFileSha256: report.sha256 });
  const output = resolve(root, "aipac-numeric-review-package-v4.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("AIPAC_NUMERIC_REVIEW_V4_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_NUMERIC_REVIEW_V4_GENERATION_FAILED"}\n`); process.exitCode = 1; });
