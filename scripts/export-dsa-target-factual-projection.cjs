"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- this standalone exporter is piped to the production CommonJS stdin runtime. */

const { createHash } = require("node:crypto");
const { Pool } = require("pg");

const releaseId = process.env.DSA_TARGET_RELEASE_ID || "rel_full_20260804_v2";
const connectionString = process.env.WEB_DATABASE_URL;
if (!connectionString) throw new Error("WEB_DATABASE_URL is required");

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

const digest = (domain, value) => createHash("sha256").update(domain).update(canonical(value)).digest("hex");
const numeric = (value) => value === null ? null : Number(value);
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function main() {
  const pool = new Pool({ connectionString, max: 1, statement_timeout: 30_000, query_timeout: 30_000, application_name: "dsa_target_factual_projection_readonly" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const releaseResult = await client.query("SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,m.schema_version,m.canonical_data_checksum_sha256,m.geometry_checksum_sha256,m.content_checksum_sha256 FROM data_releases r JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1", [releaseId]);
    if (releaseResult.rowCount !== 1) throw new Error("DSA_TARGET_RELEASE_MISSING");
    const release = releaseResult.rows[0];
    if (release.status !== "published" || !release.published_at) throw new Error("DSA_TARGET_RELEASE_NOT_PUBLISHED");
    const snapshotResult = await client.query("SELECT id,source_id,checksum_sha256,parser_version,usage_status,retrieved_at FROM source_snapshots WHERE release_id=$1 AND id = ANY($2::text[]) ORDER BY id COLLATE \"C\"", [releaseId, ["snap_full_elections", "snap_full_fec_2024", "snap_full_fec_2026"]]);
    const seatResult = await client.query(`
      WITH eligible AS (
        SELECT sc.id seat_cycle_id,o.state_code,o.district_code,sc.occupancy_as_of,m.party
        FROM seat_cycles sc
        JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
        JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
        JOIN memberships m ON m.release_id=ot.release_id AND m.office_term_id=ot.id
          AND m.starts_at<=sc.occupancy_as_of AND (m.ends_at IS NULL OR sc.occupancy_as_of<m.ends_at)
        WHERE sc.release_id=$1 AND o.kind='house_voting' AND sc.election_kind='regular'
          AND sc.occupancy_status='occupied' AND m.party='democratic'
      )
      SELECT e.*,
        c.lineage_as_of presidential_observed_at,c.lineage_methodology presidential_methodology,c.denominator_votes,
        rr.democratic_votes,rr.republican_votes,COALESCE(pl.snapshot_ids,'{}'::text[]) presidential_snapshot_ids,
        fa.cash_on_hand,fa.cash_on_hand_missing_reason,fa.as_of cash_observed_at,fa.methodology_version cash_methodology,
        COALESCE(fl.snapshot_ids,fc.snapshot_ids,'{}'::text[]) cash_snapshot_ids
      FROM eligible e
      JOIN LATERAL (
        SELECT * FROM contests WHERE release_id=$1 AND seat_cycle_id=e.seat_cycle_id
          AND kind='president_general' AND round='general' AND election_date>=DATE '2024-01-01' AND election_date<DATE '2025-01-01'
        ORDER BY id COLLATE "C" LIMIT 1
      ) c ON true
      JOIN LATERAL (
        SELECT sum(er.votes) FILTER (WHERE ro.party='democratic') democratic_votes,
               sum(er.votes) FILTER (WHERE ro.party='republican') republican_votes
        FROM election_results er JOIN result_options ro ON ro.release_id=er.release_id AND ro.id=er.result_option_id AND ro.contest_id=er.contest_id
        WHERE er.release_id=$1 AND er.contest_id=c.id
      ) rr ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT snapshot_id ORDER BY snapshot_id) snapshot_ids FROM (
          SELECT snapshot_id FROM contest_lineage WHERE release_id=$1 AND contest_id=c.id
          UNION ALL SELECT erl.snapshot_id FROM election_result_lineage erl JOIN result_options ro ON ro.release_id=erl.release_id AND ro.id=erl.result_option_id AND ro.contest_id=erl.contest_id WHERE erl.release_id=$1 AND erl.contest_id=c.id AND ro.party IN ('democratic','republican')
        ) snapshots
      ) pl ON true
      LEFT JOIN LATERAL (SELECT * FROM finance_aggregates WHERE release_id=$1 AND seat_cycle_id=e.seat_cycle_id ORDER BY as_of DESC,id COLLATE "C" DESC LIMIT 1) fa ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT fli.snapshot_id ORDER BY fli.snapshot_id) snapshot_ids
        FROM finance_aggregate_inputs fai JOIN fec_filing_lineage fli ON fli.release_id=fai.release_id AND fli.filing_id=fai.filing_id
        WHERE fai.release_id=$1 AND fai.finance_aggregate_id=fa.id
      ) fl ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT cis.snapshot_id ORDER BY cis.snapshot_id) snapshot_ids
        FROM coverage_records cr LEFT JOIN coverage_input_snapshots cis ON cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key
        WHERE cr.release_id=$1 AND cr.domain='finance' AND cr.scope_kind='funding' AND cr.seat_cycle_id=e.seat_cycle_id AND cr.funding_kind='summary'
      ) fc ON true
      ORDER BY e.seat_cycle_id COLLATE "C"`, [releaseId]);
    if (seatResult.rowCount !== 212) throw new Error(`DSA_TARGET_UNIVERSE_INVALID:${seatResult.rowCount}`);
    const seats = seatResult.rows.map((row) => {
      const denominator = numeric(row.denominator_votes), democratic = numeric(row.democratic_votes), republican = numeric(row.republican_votes);
      if (denominator === null || denominator <= 0 || democratic === null || republican === null) throw new Error(`DSA_TARGET_PRESIDENTIAL_FACT_MISSING:${row.seat_cycle_id}`);
      const presidentialMargin2024 = {
        kind: "value", value: ((democratic - republican) / denominator) * 100, observedAt: date(row.presidential_observed_at),
        inputSnapshotIds: row.presidential_snapshot_ids, methodologyVersion: row.presidential_methodology, geographyCompatibility: "current_boundary_compatible",
      };
      const incumbentCashOnHand = row.cash_on_hand === null
        ? { kind: "missing", reason: row.cash_on_hand_missing_reason || "not_reported", observedAt: row.cash_observed_at ? date(row.cash_observed_at) : date(release.source_cutoff), inputSnapshotIds: row.cash_snapshot_ids }
        : { kind: "value", value: numeric(row.cash_on_hand), observedAt: date(row.cash_observed_at), inputSnapshotIds: row.cash_snapshot_ids, methodologyVersion: row.cash_methodology };
      return { seatCycleId: row.seat_cycle_id, stateCode: row.state_code, districtCode: row.district_code, incumbentFecCandidateId: null, presidentialMargin2024, incumbentCashOnHand };
    });
    if (new Set(seats.map((row) => row.seatCycleId)).size !== seats.length) throw new Error("DSA_TARGET_UNIVERSE_DUPLICATE");
    if (seats.filter((row) => row.incumbentCashOnHand.kind === "value").length !== 210) throw new Error("DSA_TARGET_CASH_COVERAGE_INVALID");
    const releaseIdentity = { id: release.id, label: release.label, status: release.status, sourceCutoff: date(release.source_cutoff), publishedAt: release.published_at.toISOString() };
    const snapshots = snapshotResult.rows.map((row) => ({ id: row.id, sourceId: row.source_id, checksumSha256: row.checksum_sha256, parserVersion: row.parser_version, usageStatus: row.usage_status, retrievedAt: row.retrieved_at.toISOString() }));
    const manifest = { schemaVersion: release.schema_version, canonicalDataChecksumSha256: release.canonical_data_checksum_sha256, geometryChecksumSha256: release.geometry_checksum_sha256, contentChecksumSha256: release.content_checksum_sha256 };
    const closurePayload = { release: releaseIdentity, manifest, snapshots };
    const unsigned = {
      schema: "dsa-target-factual-projection-v1", version: 1, generatedAt: release.published_at.toISOString(),
      release: releaseIdentity,
      universe: { definition: "occupied regular Democratic voting U.S. House seats", expected: 212, observed: seats.length },
      productionReleaseClosure: { manifest, closureSha256: digest("dsa-seats:production-release-projection-closure:v1\0", closurePayload) },
      snapshots,
      seats,
    };
    const output = { ...unsigned, projectionSha256: digest("dsa-seats:dsa-target-factual-projection:v1\0", unsigned) };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release(); await pool.end();
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_PROJECTION_FAILED"}\n`); process.exitCode = 1; });
