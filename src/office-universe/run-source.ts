import { createHash } from "node:crypto";

import type { IntakeDecision, RawIntakeRecord, RetainedObjectReceipt, SnapshotDisposition, SourceDefinition } from "./nationwide-intake";
import { isIsoUtc } from "./nationwide-intake";
import { verifyRetainedObject } from "./raw-store";
import type { IntakeRepository, RunStatus } from "./repository";
import { assessSnapshot, reviewSourceDefinition } from "./source-review";

export type RunReviewedSourceInput = Readonly<{
  source: SourceDefinition;
  /** ISO 8601 UTC instant with a trailing Z. */
  requestedCutoff: string;
  receipt: RetainedObjectReceipt;
  /** When set, the receipt is re-verified against the retained bytes under this root before any row is written. */
  rawStoreRoot?: string;
  loadRecords: () => Promise<readonly RawIntakeRecord[]>;
  repository: IntakeRepository;
}>;
export type RunReviewedSourceResult = Readonly<{ runId: string; snapshotId: string; snapshotDisposition: SnapshotDisposition; normalizedRecordCount: 0 }>;

const fail = (code: string, detail: string): never => { throw new Error(`${code}: ${detail}`); };

/** Run and snapshot ids depend only on source id, cutoff, and retained digest, so a replay names the same evidence. */
export function shadowRunIds(sourceId: string, requestedCutoff: string, sha256: string): Readonly<{ runId: string; snapshotId: string }> {
  const digest = createHash("sha256").update(`${sourceId}\n${requestedCutoff}\n${sha256}`).digest("hex").slice(0, 48);
  return { runId: `run_${digest}`, snapshotId: `snapshot_${digest}` };
}

/**
 * Manually invoked shadow run for one reviewed source. It retains raw rows,
 * records one terminal run row, one snapshot, and its systemic issues, and
 * nothing else: no normalization, graph projection, coverage, formula, holder,
 * scheduling, or retry. `normalizedRecordCount` is always 0 by design.
 */
export async function runReviewedSource(input: RunReviewedSourceInput): Promise<RunReviewedSourceResult> {
  const { source, requestedCutoff, repository } = input;
  if (source.status !== "reviewed") fail("OFFICE_UNIVERSE_SOURCE_NOT_REVIEWED", `source ${source.id} is ${source.status}`);
  const review = reviewSourceDefinition(source);
  if (review.status !== "reviewed") fail("OFFICE_UNIVERSE_SOURCE_NOT_REVIEWED", `source ${source.id} failed review: ${review.issues.map((issue) => issue.code).join(",")}`);
  if (!isIsoUtc(requestedCutoff)) fail("OFFICE_UNIVERSE_CUTOFF_INVALID", "requestedCutoff must be an ISO 8601 UTC instant ending in Z");
  const receipt = await verifiedReceipt(input);

  const startedAt = new Date().toISOString();
  const { runId, snapshotId } = shadowRunIds(source.id, requestedCutoff, receipt.sha256);
  const records = await input.loadRecords();
  const recordDecisions: IntakeDecision[] = [];
  for (const record of records) {
    const retained = await repository.retainRawIntake({ ...record, sourceKey: source.sourceKey, snapshotId }, { privacyPolicy: source.privacyPolicy });
    recordDecisions.push({ disposition: retained.disposition, issues: retained.issues });
  }
  const assessment = assessSnapshot({ receipts: [receipt], recordDecisions, source });
  const status: RunStatus = assessment.disposition === "quarantined" ? "failed" : "succeeded";
  const rowCount = records.length;
  const quarantinedRowCount = status === "failed" ? rowCount : assessment.quarantinedRowCount;

  await repository.recordRun({ id: runId, sourceDefinitionId: source.id, receipt, requestedCutoff, status, startedAt, finishedAt: new Date().toISOString() });
  await repository.recordSnapshot({ id: snapshotId, runId, disposition: assessment.disposition, rowCount, acceptedRowCount: rowCount - quarantinedRowCount, quarantinedRowCount });
  await repository.recordSnapshotIssues(snapshotId, assessment.issues.map((issue) => ({ ...issue, systemic: true })));
  return { runId, snapshotId, snapshotDisposition: assessment.disposition, normalizedRecordCount: 0 };
}

async function verifiedReceipt(input: RunReviewedSourceInput): Promise<RetainedObjectReceipt> {
  const { receipt, rawStoreRoot } = input;
  if (rawStoreRoot === undefined) {
    if (receipt.verified !== true) fail("OFFICE_UNIVERSE_RECEIPT_UNVERIFIED", `receipt ${receipt.locator} has not passed retained-object verification`);
    return receipt;
  }
  await verifyRetainedObject({ root: rawStoreRoot, locator: receipt.locator, expectedSha256: receipt.sha256, expectedBytes: receipt.byteSize });
  return { ...receipt, verified: true };
}
