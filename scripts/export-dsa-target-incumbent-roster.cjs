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
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

async function main() {
  const pool = new Pool({ connectionString, max: 1, statement_timeout: 30_000, query_timeout: 30_000, application_name: "dsa_target_incumbent_roster_readonly" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const releaseResult = await client.query("SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,m.schema_version,m.canonical_data_checksum_sha256,m.geometry_checksum_sha256,m.content_checksum_sha256 FROM data_releases r JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1", [releaseId]);
    if (releaseResult.rowCount !== 1) throw new Error("DSA_TARGET_ROSTER_RELEASE_MISSING");
    const release = releaseResult.rows[0];
    if (release.status !== "published" || !release.published_at) throw new Error("DSA_TARGET_ROSTER_RELEASE_NOT_PUBLISHED");
    const snapshotResult = await client.query("SELECT id,source_id,source_url,checksum_sha256,parser_version,license,usage_status,retrieved_at FROM source_snapshots WHERE release_id=$1 AND id='snap_full_legislators'", [releaseId]);
    if (snapshotResult.rowCount !== 1) throw new Error("DSA_TARGET_ROSTER_SNAPSHOT_MISSING");
    const rosterResult = await client.query(`
      WITH eligible AS (
        SELECT sc.id seat_cycle_id,ot.id office_term_id
        FROM seat_cycles sc
        JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
        JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
        WHERE sc.release_id=$1 AND o.kind='house_voting' AND sc.election_kind='regular' AND sc.occupancy_status='occupied'
      )
      SELECT e.seat_cycle_id,p.bioguide_id
      FROM eligible e
      JOIN memberships m ON m.release_id=$1 AND m.office_term_id=e.office_term_id
        AND m.starts_at<=$2::date AND (m.ends_at IS NULL OR $2::date<m.ends_at)
      JOIN people p ON p.release_id=m.release_id AND p.id=m.person_id
      WHERE m.party='democratic'
      ORDER BY e.seat_cycle_id COLLATE "C"`, [releaseId, date(release.source_cutoff)]);
    if (rosterResult.rowCount !== 212 || new Set(rosterResult.rows.map((row) => row.seat_cycle_id)).size !== 212 || new Set(rosterResult.rows.map((row) => row.bioguide_id)).size !== 212) throw new Error("DSA_TARGET_ROSTER_UNIVERSE_INVALID");
    const releaseIdentity = { id: release.id, label: release.label, status: release.status, sourceCutoff: date(release.source_cutoff), publishedAt: release.published_at.toISOString() };
    const snapshot = snapshotResult.rows.map((row) => ({ id: row.id, sourceId: row.source_id, sourceUrl: row.source_url, checksumSha256: row.checksum_sha256, parserVersion: row.parser_version, license: row.license, usageStatus: row.usage_status, retrievedAt: row.retrieved_at.toISOString() }))[0];
    const manifest = { schemaVersion: release.schema_version, canonicalDataChecksumSha256: release.canonical_data_checksum_sha256, geometryChecksumSha256: release.geometry_checksum_sha256, contentChecksumSha256: release.content_checksum_sha256 };
    const closurePayload = { release: releaseIdentity, manifest, snapshot };
    const unsigned = {
      schema: "dsa-target-incumbent-roster-v1", version: 1, generatedAt: release.published_at.toISOString(), release: releaseIdentity,
      universe: { definition: "occupied regular Democratic voting U.S. House seats", expected: 212, observed: 212 },
      productionReleaseClosure: { manifest, snapshot, closureSha256: digest("dsa-seats:production-incumbent-roster-closure:v1\0", closurePayload) },
      rows: rosterResult.rows.map((row) => ({ seatCycleId: row.seat_cycle_id, bioguideId: row.bioguide_id })),
    };
    process.stdout.write(`${JSON.stringify({ ...unsigned, rosterSha256: digest("dsa-seats:dsa-target-incumbent-roster:v1\0", unsigned) }, null, 2)}\n`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined); throw error;
  } finally { client.release(); await pool.end(); }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "DSA_TARGET_ROSTER_EXPORT_FAILED"}\n`); process.exitCode = 1; });
