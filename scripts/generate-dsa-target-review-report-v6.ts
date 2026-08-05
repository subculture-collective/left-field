import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetReviewReportV6 } from "../src/domain/dsa-target-review-report-v6";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function load(path: string): Promise<{ value: unknown; sha256: string }> { const bytes = await readFile(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha(bytes) }; }
async function main(): Promise<void> {
  const root = resolve("data/metadata");
  const [projection, tenure, prior, candidate, authority] = await Promise.all(["dsa-target-factual-projection-20260804-v1.json", "incumbent-tenure-factual-candidate-20260804-v1.json", "dsa-target-evaluation-review-report-20260804-v2.json", "aipac-numeric-evidence-candidate-v4.json", "washington-house-top-two-results-receipt-20220802-20240806-v1.json"].map((name) => load(resolve(root, name))));
  const report = buildDsaTargetReviewReportV6({ projection: projection.value, projectionFileSha256: projection.sha256, tenureCandidate: tenure.value, tenureFileSha256: tenure.sha256, priorReport: prior.value, priorReportFileSha256: prior.sha256, aipacCandidate: candidate.value, aipacCandidateFileSha256: candidate.sha256, formulaEligibilityAuthority: authority.value, formulaEligibilityAuthorityFileSha256: authority.sha256 });
  const output = resolve(root, "dsa-target-evaluation-review-report-20260805-v6.json"), bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("DSA_TARGET_REPORT_V6_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: report.summary, reportSha256: report.reportSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_REPORT_V6_GENERATION_FAILED"}\n`); process.exitCode = 1; });
