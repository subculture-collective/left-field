import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetReviewReportV4 } from "../src/domain/dsa-target-review-report-v4";

type Entry = { id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string };
const output = "data/metadata/dsa-target-evaluation-review-report-20260805-v4.json";
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile("data/source-lock.json", "utf8")) as { entries: Entry[] }, byId = new Map(lock.entries.map((row) => [row.id, row]));
  const load = async (id: string): Promise<{ entry: Entry; bytes: Buffer }> => {
    const entry = byId.get(id);
    if (!entry || entry.retainedStatus !== "retained" || !entry.retainedPath) throw new Error(`DSA_TARGET_REPORT_V4_LOCK_MISSING:${id}`);
    const bytes = await readFile(entry.retainedPath);
    if (bytes.length !== entry.byteSize || sha(bytes) !== entry.sha256) throw new Error(`DSA_TARGET_REPORT_V4_LOCK_MISMATCH:${id}`);
    return { entry, bytes };
  };
  const projection = await load("dsa-target-factual-projection-20260804-v1"), tenure = await load("incumbent-tenure-factual-candidate-20260804-v1"), prior = await load("dsa-target-evaluation-review-report-20260804-v2"), aipac = await load("aipac-numeric-evidence-candidate-v2"), authority = await load("washington-house-top-two-results-receipt-20220802-20240806-v1");
  const report = buildDsaTargetReviewReportV4({ projection: JSON.parse(projection.bytes.toString()), projectionFileSha256: projection.entry.sha256, tenureCandidate: JSON.parse(tenure.bytes.toString()), tenureFileSha256: tenure.entry.sha256, priorReport: JSON.parse(prior.bytes.toString()), priorReportFileSha256: prior.entry.sha256, aipacCandidate: JSON.parse(aipac.bytes.toString()), aipacCandidateFileSha256: aipac.entry.sha256, formulaEligibilityAuthority: JSON.parse(authority.bytes.toString()), formulaEligibilityAuthorityFileSha256: authority.entry.sha256 });
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  try { await writeFile(resolve(output), bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("DSA_TARGET_REPORT_V4_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output: resolve(output), ...report.summary, reportSha256: report.reportSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_REPORT_V4_GENERATION_FAILED"}\n`); process.exitCode = 1; });
