import { closeDb, getNationwideFinalizerPool } from "@/db/client";
import { expectedContentChecksum, validateNationwideCandidateReleaseWithClient } from "@/db/catalog-release";
import { loadNationwideManifestForFinalization } from "@/db/manifest";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";

const releasePattern = /^rel_[A-Za-z0-9_-]{1,128}$/;

async function main(argv = process.argv.slice(2)): Promise<void> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !value || !["--source-release", "--candidate-release"].includes(key) || values.has(key)) throw new Error("Require --source-release and --candidate-release");
    values.set(key, value);
  }
  const source = values.get("--source-release"), candidate = values.get("--candidate-release");
  if (!source || !candidate || source === candidate || !releasePattern.test(source) || !releasePattern.test(candidate)) throw new Error("Require --source-release and --candidate-release");
  const pool = getNationwideFinalizerPool(); const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of [source, candidate].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [id]);
    const releases = await client.query<{ id: string; status: string }>("SELECT id,status FROM data_releases WHERE id=ANY($1::text[])", [[source, candidate]]);
    if (releases.rows.find((row) => row.id === source)?.status !== "retired" || releases.rows.find((row) => row.id === candidate)?.status !== "candidate") throw new Error("MAP_CLONE_RELEASE_STATE_INVALID");

    await client.query("INSERT INTO sources(release_id,id,name,authority,homepage_url) SELECT $2,id,name,authority,homepage_url FROM sources WHERE release_id=$1 AND id IN (SELECT DISTINCT source_id FROM source_snapshots WHERE release_id=$1 AND id LIKE 'snap_map_%')", [source, candidate]);
    await client.query("INSERT INTO source_snapshots(release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) SELECT $2,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status FROM source_snapshots WHERE release_id=$1 AND id LIKE 'snap_map_%'", [source, candidate]);
    await client.query("INSERT INTO geometry_artifacts(release_id,id,snapshot_id,object_key,format,srid,checksum_sha256) SELECT $2,id,snapshot_id,object_key,format,srid,checksum_sha256 FROM geometry_artifacts WHERE release_id=$1 AND snapshot_id LIKE 'snap_map_%'", [source, candidate]);
    await client.query("INSERT INTO snapshot_derivations(release_id,output_snapshot_id,methodology_version) SELECT $2,output_snapshot_id,methodology_version FROM snapshot_derivations WHERE release_id=$1 AND output_snapshot_id LIKE 'snap_map_%'", [source, candidate]);
    await client.query("INSERT INTO snapshot_derivation_inputs(release_id,output_snapshot_id,input_snapshot_id) SELECT $2,output_snapshot_id,input_snapshot_id FROM snapshot_derivation_inputs WHERE release_id=$1 AND output_snapshot_id LIKE 'snap_map_%'", [source, candidate]);
    await client.query("INSERT INTO map_artifacts(release_id,id,geography_version_id,artifact_id) SELECT $2,id,geography_version_id,artifact_id FROM map_artifacts WHERE release_id=$1", [source, candidate]);
    await client.query("INSERT INTO map_artifact_receipts(release_id,map_artifact_id,raw_store_kind,store_identity,object_key,sha256,byte_size,version_id,etag) SELECT $2,map_artifact_id,raw_store_kind,store_identity,replace(object_key,'maps/' || $1 || '/','maps/' || $2 || '/'),sha256,byte_size,version_id,etag FROM map_artifact_receipts WHERE release_id=$1", [source, candidate]);
    await client.query("INSERT INTO map_artifact_inputs(release_id,map_artifact_id,snapshot_id) SELECT $2,map_artifact_id,snapshot_id FROM map_artifact_inputs WHERE release_id=$1", [source, candidate]);
    await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain='maps'", [candidate]);
    await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain='maps'", [candidate]);
    await client.query("DELETE FROM coverage_records WHERE release_id=$1 AND domain='maps'", [candidate]);
    await client.query("INSERT INTO coverage_records(release_id,domain,scope_key,scope_kind,jurisdiction_code,seat_cycle_id,variable,survey_period,election_year,funding_kind,status,expected_count,observed_count,quarantined_count,incompatible_count) SELECT $2,domain,scope_key,scope_kind,jurisdiction_code,seat_cycle_id,variable,survey_period,election_year,funding_kind,status,expected_count,observed_count,quarantined_count,incompatible_count FROM coverage_records WHERE release_id=$1 AND domain='maps'", [source, candidate]);
    await client.query("INSERT INTO coverage_missing_reasons(release_id,domain,scope_key,reason,count) SELECT $2,domain,scope_key,reason,count FROM coverage_missing_reasons WHERE release_id=$1 AND domain='maps'", [source, candidate]);
    await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) SELECT $2,domain,scope_key,snapshot_id FROM coverage_input_snapshots WHERE release_id=$1 AND domain='maps'", [source, candidate]);

    const loaded = (await loadNationwideManifestForFinalization(client, candidate)).manifest;
    const canonical = computeCanonicalDataChecksum(loaded); const validation = validateReleaseManifest({ ...loaded, canonicalDataChecksumSha256: canonical });
    if (!validation.success) throw new Error(`MAP_CLONE_MANIFEST_INVALID:${validation.issues.map((issue) => `${issue.path}:${issue.message}`).join(";")}`);
    const metadata = await client.query<{ geometry_checksum_sha256: string }>("SELECT geometry_checksum_sha256 FROM release_manifests WHERE release_id=$1", [candidate]);
    await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [candidate, canonical, expectedContentChecksum({ canonical_data_checksum_sha256: canonical, geometry_checksum_sha256: metadata.rows[0]!.geometry_checksum_sha256 } as never)]);
    await validateNationwideCandidateReleaseWithClient(client, candidate);
    await client.query("COMMIT"); process.stdout.write(`${JSON.stringify({ source, candidate, maps: 441, status: "validated_candidate" })}\n`);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); await closeDb(); }
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Map clone failed"}\n`); process.exitCode = 1; }).finally(closeDb);
