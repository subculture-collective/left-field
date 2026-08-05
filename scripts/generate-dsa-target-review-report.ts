import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildDsaTargetReviewReport,
  validateDsaTargetReviewReport,
} from "../src/domain/dsa-target-review-report";
import { validateAipacReviewDecisionQueue } from "../src/ingestion/fec/aipac-review-decision-queue";
import { validateProposedPackage } from "../src/ingestion/fec/aipac-proposed-packages";

const metadataRoot = resolve("data/metadata");
const projectionFile = "dsa-target-factual-projection-20260804-v1.json";
const outputFile = "dsa-target-evaluation-review-report-20260804-v1.json";
const proposalIds = [
  "aipac-candidate-seat-mappings-proposal-v1",
  "aipac-evidence-closure-proposal-v1",
  "org-classification-aipac-network-proposal-v1",
  "aipac-review-decision-queue-v1",
] as const;

type SourceLockEntry = Readonly<{
  id: string;
  retainedPath: string | null;
  retainedStatus: string;
  byteSize: number;
  sha256: string;
  kind: string;
}>;

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function lockedBytes(entry: SourceLockEntry): Promise<Buffer> {
  if (entry.retainedStatus !== "retained" || entry.retainedPath === null) throw new Error(`DSA_TARGET_REPORT_SOURCE_NOT_RETAINED:${entry.id}`);
  const bytes = await readFile(resolve(entry.retainedPath));
  if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.sha256) throw new Error(`DSA_TARGET_REPORT_SOURCE_LOCK_MISMATCH:${entry.id}`);
  return bytes;
}

async function writeExact(output: string, bytes: Buffer): Promise<void> {
  try {
    await writeFile(output, bytes, { mode: 0o644, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readFile(output);
    if (!existing.equals(bytes)) throw new Error("DSA_TARGET_REPORT_OUTPUT_CONFLICT");
  }
}

async function main(): Promise<void> {
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries?: SourceLockEntry[] };
  const byId = new Map((sourceLock.entries ?? []).map((entry) => [entry.id, entry]));
  const projectionEntry = byId.get("dsa-target-factual-projection-20260804-v1");
  if (!projectionEntry || projectionEntry.kind !== "production_projection_receipt" || projectionEntry.retainedPath !== `data/metadata/${projectionFile}`) throw new Error("DSA_TARGET_REPORT_PROJECTION_LOCK_MISSING");
  const projectionBytes = await lockedBytes(projectionEntry);

  const excludedProposalPackages = [];
  for (const id of proposalIds) {
    const entry = byId.get(id);
    if (!entry || entry.kind !== "review_proposal") throw new Error(`DSA_TARGET_REPORT_PROPOSAL_LOCK_MISSING:${id}`);
    const bytes = await lockedBytes(entry);
    const value = JSON.parse(bytes.toString("utf8")) as { packageSha256?: unknown; review?: { status?: unknown } };
    if (id === "aipac-review-decision-queue-v1") validateAipacReviewDecisionQueue(value);
    else validateProposedPackage(value);
    if (value.review?.status !== "proposed" || typeof value.packageSha256 !== "string") throw new Error(`DSA_TARGET_REPORT_PROPOSAL_STATUS_INVALID:${id}`);
    excludedProposalPackages.push({
      sourceLockId: id,
      fileSha256: entry.sha256,
      packageSha256: value.packageSha256,
      reviewStatus: "proposed",
      reason: "unreviewed_proposal_excluded_from_numeric_evaluation",
    });
  }

  const report = buildDsaTargetReviewReport({
    projection: JSON.parse(projectionBytes.toString("utf8")),
    projectionFileSha256: projectionEntry.sha256,
    excludedProposalPackages,
  });
  validateDsaTargetReviewReport(report);
  const output = resolve(metadataRoot, outputFile);
  await writeExact(output, Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ output, ...report.summary, reportSha256: report.reportSha256 }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_REPORT_GENERATION_FAILED"}\n`);
  process.exitCode = 1;
});
