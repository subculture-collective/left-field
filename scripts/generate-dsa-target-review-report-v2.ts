import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDsaTargetReviewReportV2, validateDsaTargetReviewReportV2 } from "../src/domain/dsa-target-review-report-v2";
import { validateAipacReviewDecisionQueue } from "../src/ingestion/fec/aipac-review-decision-queue";
import { validateProposedPackage } from "../src/ingestion/fec/aipac-proposed-packages";

const outputFile = "data/metadata/dsa-target-evaluation-review-report-20260804-v2.json";
const proposalIds = ["aipac-candidate-seat-mappings-proposal-v1", "aipac-evidence-closure-proposal-v1", "org-classification-aipac-network-proposal-v1", "aipac-review-decision-queue-v1"] as const;
type SourceLockEntry = Readonly<{ id: string; retainedPath: string | null; retainedStatus: string; byteSize: number; sha256: string; kind: string }>;
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function lockedBytes(entry: SourceLockEntry): Promise<Buffer> {
  if (entry.retainedStatus !== "retained" || entry.retainedPath === null) throw new Error(`DSA_TARGET_REPORT_V2_SOURCE_NOT_RETAINED:${entry.id}`);
  const bytes = await readFile(resolve(entry.retainedPath));
  if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.sha256) throw new Error(`DSA_TARGET_REPORT_V2_SOURCE_LOCK_MISMATCH:${entry.id}`);
  return bytes;
}

async function writeExact(bytes: Buffer): Promise<void> {
  try { await writeFile(resolve(outputFile), bytes, { mode: 0o644, flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (!(await readFile(resolve(outputFile))).equals(bytes)) throw new Error("DSA_TARGET_REPORT_V2_OUTPUT_CONFLICT");
  }
}

async function required(byId: Map<string, SourceLockEntry>, id: string, kind: string, path: string): Promise<Readonly<{ entry: SourceLockEntry; bytes: Buffer }>> {
  const entry = byId.get(id);
  if (!entry || entry.kind !== kind || entry.retainedPath !== path) throw new Error(`DSA_TARGET_REPORT_V2_LOCK_MISSING:${id}`);
  return { entry, bytes: await lockedBytes(entry) };
}

async function main(): Promise<void> {
  const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries?: SourceLockEntry[] };
  const byId = new Map((lock.entries ?? []).map((entry) => [entry.id, entry]));
  const projection = await required(byId, "dsa-target-factual-projection-20260804-v1", "production_projection_receipt", "data/metadata/dsa-target-factual-projection-20260804-v1.json");
  const tenure = await required(byId, "incumbent-tenure-factual-candidate-20260804-v1", "review_proposal", "data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json");
  const roster = await required(byId, "dsa-target-incumbent-roster-20260804-v1", "production_projection_receipt", "data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const excludedProposalPackages = [];
  for (const id of proposalIds) {
    const proposal = await required(byId, id, "review_proposal", `data/metadata/${id}.json`);
    const value = JSON.parse(proposal.bytes.toString("utf8")) as { packageSha256?: unknown; review?: { status?: unknown } };
    if (id === "aipac-review-decision-queue-v1") validateAipacReviewDecisionQueue(value); else validateProposedPackage(value);
    if (value.review?.status !== "proposed" || typeof value.packageSha256 !== "string") throw new Error(`DSA_TARGET_REPORT_V2_PROPOSAL_STATUS_INVALID:${id}`);
    excludedProposalPackages.push({ sourceLockId: id, fileSha256: proposal.entry.sha256, packageSha256: value.packageSha256, reviewStatus: "proposed", reason: "unreviewed_proposal_excluded_from_numeric_evaluation" });
  }
  const report = buildDsaTargetReviewReportV2({ projection: JSON.parse(projection.bytes.toString("utf8")), projectionFileSha256: projection.entry.sha256, tenureCandidate: JSON.parse(tenure.bytes.toString("utf8")), tenureFileSha256: tenure.entry.sha256, roster: JSON.parse(roster.bytes.toString("utf8")), rosterFileSha256: roster.entry.sha256, excludedProposalPackages });
  validateDsaTargetReviewReportV2(report);
  await writeExact(Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output: resolve(outputFile), ...report.summary, reportSha256: report.reportSha256 }, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_REPORT_V2_GENERATION_FAILED"}\n`); process.exitCode = 1; });
