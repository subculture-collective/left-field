"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- standalone production read-only exporter */

const { createHash } = require("node:crypto");
const { Pool } = require("pg");

const releaseId = process.env.HOUSE_PRIORITY_RELEASE_ID || "rel_full_20260804_v2";
const connectionString = process.env.WEB_DATABASE_URL;
if (!connectionString) throw new Error("WEB_DATABASE_URL is required");

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}
const digest = (domain, value) => createHash("sha256").update(domain).update(canonical(value)).digest("hex");
const number = (value) => value === null ? null : Number(value);
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function main() {
  const pool = new Pool({ connectionString, max: 1, statement_timeout: 30_000, query_timeout: 30_000, application_name: "house_priority_finance_readonly" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const releaseResult = await client.query("SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,m.schema_version,m.canonical_data_checksum_sha256,m.content_checksum_sha256 FROM data_releases r JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1", [releaseId]);
    if (releaseResult.rowCount !== 1) throw new Error("HOUSE_PRIORITY_RELEASE_MISSING");
    const release = releaseResult.rows[0];
    if (release.status !== "published" || !release.published_at) throw new Error("HOUSE_PRIORITY_RELEASE_NOT_PUBLISHED");
    const result = await client.query(`
      WITH eligible AS (
        SELECT sc.id seat_cycle_id,o.state_code,o.district_code,m.party,p.display_name
        FROM seat_cycles sc
        JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
        JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
        JOIN memberships m ON m.release_id=ot.release_id AND m.office_term_id=ot.id
          AND m.starts_at<=sc.occupancy_as_of AND (m.ends_at IS NULL OR sc.occupancy_as_of<m.ends_at)
        JOIN people p ON p.release_id=m.release_id AND p.id=m.person_id
        WHERE sc.release_id=$1 AND o.kind='house_voting' AND sc.election_kind='regular'
          AND sc.occupancy_status='occupied' AND m.party IN ('democratic','republican')
      )
      SELECT e.*,fa.id finance_aggregate_id,fa.as_of,fa.coverage_through,fa.methodology_version,
        fa.cash_on_hand,fa.cash_on_hand_missing_reason,fa.receipts,fa.receipts_missing_reason,
        fa.disbursements,fa.disbursements_missing_reason
      FROM eligible e
      LEFT JOIN LATERAL (
        SELECT * FROM finance_aggregates WHERE release_id=$1 AND seat_cycle_id=e.seat_cycle_id
        ORDER BY as_of DESC,id COLLATE "C" DESC LIMIT 1
      ) fa ON true
      ORDER BY e.seat_cycle_id COLLATE "C"`, [releaseId]);
    if (result.rowCount !== 430) throw new Error(`HOUSE_PRIORITY_UNIVERSE_INVALID:${result.rowCount}`);
    const rows = result.rows.map((row) => ({
      seatCycleId: row.seat_cycle_id,
      stateCode: row.state_code,
      districtCode: row.district_code,
      incumbentName: row.display_name,
      incumbentParty: row.party,
      financeAggregateId: row.finance_aggregate_id,
      asOf: row.as_of ? date(row.as_of) : date(release.source_cutoff),
      coverageThrough: row.coverage_through ? date(row.coverage_through) : null,
      methodologyVersion: row.methodology_version,
      cashOnHand: row.cash_on_hand === null ? { kind: "missing", reason: row.cash_on_hand_missing_reason || "not_reported" } : { kind: "value", value: number(row.cash_on_hand) },
      receipts: row.receipts === null ? { kind: "missing", reason: row.receipts_missing_reason || "not_reported" } : { kind: "value", value: number(row.receipts) },
      disbursements: row.disbursements === null ? { kind: "missing", reason: row.disbursements_missing_reason || "not_reported" } : { kind: "value", value: number(row.disbursements) },
    }));
    if (new Set(rows.map((row) => row.seatCycleId)).size !== 430) throw new Error("HOUSE_PRIORITY_UNIVERSE_DUPLICATE");
    if (rows.filter((row) => row.cashOnHand.kind === "value").length !== 427) throw new Error("HOUSE_PRIORITY_CASH_COVERAGE_INVALID");
    const unsigned = {
      schema: "house-priority-finance-projection-v1",
      version: 1,
      generatedAt: "2026-08-08T01:30:00.000Z",
      release: { id: release.id, label: release.label, status: release.status, sourceCutoff: date(release.source_cutoff), publishedAt: release.published_at.toISOString() },
      manifest: { schemaVersion: release.schema_version, canonicalDataChecksumSha256: release.canonical_data_checksum_sha256, contentChecksumSha256: release.content_checksum_sha256 },
      universe: { definition: "occupied regular Democratic and Republican voting U.S. House seats", expected: 430, observed: rows.length },
      summary: { seats: rows.length, democraticSeats: rows.filter((row) => row.incumbentParty === "democratic").length, republicanSeats: rows.filter((row) => row.incumbentParty === "republican").length, cashOnHandValues: rows.filter((row) => row.cashOnHand.kind === "value").length, missingCashOnHand: rows.filter((row) => row.cashOnHand.kind === "missing").length },
      rows,
    };
    process.stdout.write(`${JSON.stringify({ ...unsigned, projectionSha256: digest("dsa-seats:house-priority-finance-projection:v1\0", unsigned) }, null, 2)}\n`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "HOUSE_PRIORITY_FINANCE_EXPORT_FAILED"}\n`);
  process.exitCode = 1;
});
