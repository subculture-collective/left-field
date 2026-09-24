import type { Pool, PoolClient } from "pg";

import type { IntakeIssue, RawIntakeRecord, SourceRegistryEntry } from "./nationwide-intake";
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
): Promise<{ id: string; disposition: "accepted" | "quarantined"; issueCount: number }> {
  const decision = assessRawIntake(record);
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
  return { id, disposition: decision.disposition, issueCount: decision.issues.length };
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
