import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetScoreSensitivityV1 } from "../src/domain/dsa-target-score-sensitivity-v1";

const load = async (path: string) => { const bytes = await readFile(resolve(path)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
async function main(): Promise<void> {
  const report = await load("data/metadata/dsa-target-evaluation-review-report-20260805-v6.json"), candidate = await load("data/metadata/aipac-numeric-evidence-candidate-v4.json"), priorReviewPackage = await load("data/metadata/aipac-numeric-review-package-v4.json");
  const value = buildDsaTargetScoreSensitivityV1({ report: report.value, reportFileSha256: report.sha256, candidate: candidate.value, candidateFileSha256: candidate.sha256, priorReviewPackage: priorReviewPackage.value, priorReviewPackageFileSha256: priorReviewPackage.sha256 });
  const output = resolve("data/metadata/dsa-target-score-sensitivity-candidate-20260805-v1.json"), bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("DSA_SCORE_SENSITIVITY_V1_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, weightMetrics: value.weightScenarios.map(({ id, metrics }) => ({ id, metrics })), commonHistoryMetrics: value.denominatorSensitivity.commonHistoryScenario.metrics, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_SCORE_SENSITIVITY_V1_GENERATION_FAILED"}\n`); process.exitCode = 1; });
