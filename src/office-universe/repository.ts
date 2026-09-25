import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { IntakeDecision, IntakeIssue, RawIntakeOptions, RawIntakeRecord, RetainedObjectReceipt, SnapshotDisposition, SourceRegistryEntry } from "./nationwide-intake";
import { assessRawIntake, intakeFingerprint } from "./nationwide-intake";

type Runner = Pool | PoolClient;

const stableId = (prefix: string, value: string) => `${prefix}_${value.slice(0, 48)}`;

export type SeedSummary = Readonly<{ inserted: number; existing: number }>;

/** Insert-only bootstrap: existing (state_code,family) rows are a backlog index and are never overwritten. */
export async function seedSourceRegistry(
  db: Runner,
  entries: readonly SourceRegistryEntry[],
): Promise<SeedSummary> {
  let inserted = 0;
  for (const entry of entries) {
    const result = await db.query(
      `INSERT INTO office_universe.source_registrations(state_code,family,source_key,authority_tier,status,source_url,refresh_profile)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(state_code,family) DO NOTHING`,
      [entry.stateCode, entry.family, entry.sourceKey, entry.authorityTier, entry.status, entry.sourceUrl, entry.refreshProfile],
    );
    inserted += result.rowCount ?? 0;
  }
  return { inserted, existing: entries.length - inserted };
}

/** Retains the raw payload and every row-level issue in one transaction; never projects graph rows. */
export async function retainRawIntake(
  pool: Pool,
  record: RawIntakeRecord,
  options: RawIntakeOptions = {},
): Promise<RetainedRawIntake> {
  const decision = assessRawIntake(record, options);
  const id = stableId("raw", intakeFingerprint(record));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO office_universe.raw_payloads(id,source_key,snapshot_id,payload_sha256,payload_locator,source_natural_key,kind,observed_at,disposition,payload)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT(source_key,snapshot_id,payload_sha256,source_natural_key,kind) DO NOTHING`,
      [id, record.sourceKey, record.snapshotId, record.payloadSha256, record.payloadLocator, record.sourceNaturalKey, record.kind, record.observedAt, decision.disposition, JSON.stringify(record.payload)],
    );
    for (const [index, issue] of decision.issues.entries()) await retainIssue(client, id, record.sourceNaturalKey, issue, index);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { id, disposition: decision.disposition, issueCount: decision.issues.length, issues: decision.issues };
}

export type RetainedRawIntake = Readonly<{ id: string; disposition: IntakeDecision["disposition"]; issueCount: number; issues: readonly IntakeIssue[] }>;
export type RunStatus = "succeeded" | "failed";
/** A run is inserted exactly once, already terminal; ingest holds no UPDATE grant on intake_runs. */
export type RunRecord = Readonly<{ id: string; sourceDefinitionId: string; receipt: RetainedObjectReceipt; requestedCutoff: string; status: RunStatus; startedAt: string; finishedAt: string }>;
export type SnapshotRecord = Readonly<{ id: string; runId: string; disposition: SnapshotDisposition; rowCount: number; acceptedRowCount: number; quarantinedRowCount: number }>;
export type SnapshotIssueRecord = IntakeIssue & Readonly<{ systemic: boolean }>;

export const receiptId = (receipt: Pick<RetainedObjectReceipt, "sourceId" | "locator" | "sha256">): string =>
  stableId("receipt", createHash("sha256").update(`${receipt.sourceId}\n${receipt.locator}\n${receipt.sha256}`).digest("hex"));

/** Append-only receipt insert; an identical retained object keeps its first receipt. */
export async function recordReceipt(db: Runner, receipt: RetainedObjectReceipt): Promise<string> {
  const id = receiptId(receipt);
  await db.query(
    `INSERT INTO office_universe.retained_object_receipts(id,source_definition_id,locator,byte_size,sha256,retrieved_at,final_url,parser_version)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
    [id, receipt.sourceId, receipt.locator, receipt.byteSize, receipt.sha256, receipt.retrievedAt, receipt.finalUrl, receipt.parserVersion],
  );
  return id;
}

/** Inserts the receipt and the terminal run row in one transaction. Never updates an existing run. */
export async function recordRun(pool: Pool, run: RunRecord): Promise<void> {
  if (run.status !== "succeeded" && run.status !== "failed") throw new Error(`OFFICE_UNIVERSE_RUN_STATUS_INVALID: run ${run.id} must be inserted with a terminal status`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const receipt = await recordReceipt(client, run.receipt);
    await client.query(
      `INSERT INTO office_universe.intake_runs(id,source_definition_id,receipt_id,requested_cutoff,status,started_at,finished_at)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
      [run.id, run.sourceDefinitionId, receipt, run.requestedCutoff, run.status, run.startedAt, run.finishedAt],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordSnapshot(db: Runner, snapshot: SnapshotRecord): Promise<void> {
  await db.query(
    `INSERT INTO office_universe.intake_snapshots(id,run_id,disposition,row_count,accepted_row_count,quarantined_row_count)
     VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
    [snapshot.id, snapshot.runId, snapshot.disposition, snapshot.rowCount, snapshot.acceptedRowCount, snapshot.quarantinedRowCount],
  );
}

export async function recordSnapshotIssues(db: Runner, snapshotId: string, issues: readonly SnapshotIssueRecord[]): Promise<void> {
  for (const [index, issue] of issues.entries())
    await db.query(
      `INSERT INTO office_universe.snapshot_issues(id,snapshot_id,code,diagnostic,systemic)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
      [stableId("snapshot_issue", `${snapshotId}_${index}_${issue.code}`), snapshotId, issue.code, issue.diagnostic, issue.systemic],
    );
}

/**
 * The only persistence surface a shadow run may touch: append-only evidence,
 * run, snapshot, and systemic-issue inserts. Graph projection, coverage,
 * formula, holder, scheduler, and retry operations are deliberately absent.
 */
export type IntakeRepository = Readonly<{
  retainRawIntake: (record: RawIntakeRecord, options?: RawIntakeOptions) => Promise<RetainedRawIntake>;
  recordRun: (run: RunRecord) => Promise<void>;
  recordSnapshot: (snapshot: SnapshotRecord) => Promise<void>;
  recordSnapshotIssues: (snapshotId: string, issues: readonly SnapshotIssueRecord[]) => Promise<void>;
}>;

export function createIntakeRepository(pool: Pool): IntakeRepository {
  return {
    retainRawIntake: (record, options) => retainRawIntake(pool, record, options),
    recordRun: (run) => recordRun(pool, run),
    recordSnapshot: (snapshot) => recordSnapshot(pool, snapshot),
    recordSnapshotIssues: (snapshotId, issues) => recordSnapshotIssues(pool, snapshotId, issues),
  };
}

async function retainIssue(
  db: PoolClient,
  rawPayloadId: string,
  sourceNaturalKey: string | null,
  issue: IntakeIssue,
  index: number,
): Promise<void> {
  await db.query(
    `INSERT INTO office_universe.intake_issues(id,raw_payload_id,source_natural_key,code,diagnostic)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
    [stableId("issue", `${rawPayloadId}_${index}_${issue.code}`), rawPayloadId, sourceNaturalKey, issue.code, issue.diagnostic],
  );
}

export async function currentCoverage(
  db: Runner,
  stateCode: string,
): Promise<readonly Record<string, unknown>[]> {
  const result = await db.query(
    `SELECT state_code AS "stateCode",office_family AS "officeFamily",source_family AS "sourceFamily",status,
            expected_count AS "expectedCount",observed_count AS "observedCount",raw_only_count AS "rawOnlyCount",
            provisional_count AS "provisionalCount",certified_count AS "certifiedCount",quarantined_count AS "quarantinedCount",
            missingness,last_successful_refresh_at AS "lastSuccessfulRefreshAt",authority_tier AS "authorityTier"
       FROM office_universe.coverage WHERE state_code=$1
      ORDER BY office_family COLLATE "C",source_family COLLATE "C"`,
    [stateCode],
  );
  return result.rows;
}
