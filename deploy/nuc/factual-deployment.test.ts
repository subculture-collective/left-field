import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string): string =>
  readFileSync(resolve(process.cwd(), "deploy/nuc", name), "utf8");

describe("factual production FEC runtime wiring", () => {
  it("mounts distinct acquisition, replay-verifier, and API credential secrets only into operator tooling", () => {
    const compose = read("factual.compose.yml");

    for (const secret of [
      "db_fec_v2_acquisition_password",
      "db_fec_v2_replay_verifier_password",
      "fec_api_credential",
    ]) {
      expect(compose).toContain(`${secret}:`);
      expect(compose).toContain(`- ${secret}`);
    }

    const app = compose.slice(compose.indexOf("\n  app:"), compose.indexOf("\n  release:"));
    expect(app).not.toContain("db_fec_v2_acquisition_password");
    expect(app).not.toContain("db_fec_v2_replay_verifier_password");
    expect(app).not.toContain("fec_api_credential");
  });

  it("creates separate least-privilege logins and grants exactly their purpose roles", () => {
    const sql = read("grant-runtime-roles.sql");

    expect(sql).toContain(
      "CREATE ROLE dsa_seats_fec_v2_acquisition_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION",
    );
    expect(sql).toContain(
      "CREATE ROLE dsa_seats_fec_v2_replay_verifier_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION",
    );
    expect(sql).toContain(
      "GRANT dsa_seats_fec_v2_acquisition TO dsa_seats_fec_v2_acquisition_login",
    );
    expect(sql).toContain(
      "GRANT dsa_seats_fec_v2_replay_verifier TO dsa_seats_fec_v2_replay_verifier_login",
    );
    expect(sql).not.toMatch(
      /GRANT\s+dsa_seats_fec_v2_(?:acquisition|replay_verifier)\s+TO\s+dsa_seats_(?:web|ingest|preflight|operator)_login/i,
    );
  });

  it("constructs the two database URLs and reads the API credential from mounted files", () => {
    const wrapper = read("run-with-secrets.sh");

    expect(wrapper).toContain(
      "FEC_V2_ACQUISITION_DATABASE_URL=\"postgresql://dsa_seats_fec_v2_acquisition_login:",
    );
    expect(wrapper).toContain(
      "FEC_V2_REPLAY_VERIFIER_DATABASE_URL=\"postgresql://dsa_seats_fec_v2_replay_verifier_login:",
    );
    expect(wrapper).toContain(
      "FEC_API_CREDENTIAL=$(tr -d '\\r\\n' < /run/secrets/fec_api_credential)",
    );
    expect(wrapper).not.toContain("printf \"$FEC_API_CREDENTIAL\"");
  });

  it("uses a separate certificate-validated, versioned FEC store with default compliance retention", () => {
    const compose = read("factual.compose.yml");
    const policy = read("fec-v2-rawstore-policy.json");
    const wrapper = read("run-with-secrets.sh");

    expect(compose).toContain("FEC_V2_STORE_MODE: production");
    expect(compose).toContain("FEC_V2_OBJECT_ENDPOINT: https://fecstore:9000");
    expect(compose).toContain("NODE_EXTRA_CA_CERTS: /etc/dsa-seats/fec-v2-root.crt");
    expect(compose).toContain("mc mb --ignore-existing --with-lock fecstore/dsa-seats-fec-v2");
    expect(compose).toContain('mc retention set --default COMPLIANCE "1y" fecstore/dsa-seats-fec-v2');
    expect(compose).toContain("mc retention info --default fecstore/dsa-seats-fec-v2");
    const release = compose.slice(compose.indexOf("\n  release:"), compose.indexOf("\nvolumes:"));
    expect(release).toContain("fecstore-init:");
    expect(release).toContain("condition: service_completed_successfully");
    expect(policy).not.toContain("s3:DeleteObject");
    expect(policy).not.toContain("s3:BypassGovernanceRetention");
    expect(wrapper).toContain("FEC_V2_S3_ACCESS_KEY_ID=$(tr -d");
    expect(wrapper).toContain("FEC_V2_S3_SECRET_ACCESS_KEY=$(tr -d");
  });

  it("includes the dedicated FEC object volume in backup and isolated restore", () => {
    const backup = read("backup-factual.sh");
    const restore = read("restore-factual-drill.sh");

    expect(backup).toContain('FEC_V2_VOLUME="${FEC_V2_VOLUME:-dsa-seats-r1_fec_v2_objects}"');
    expect(backup).toContain('docker stop --time 30 "$FECSTORE_CONTAINER"');
    expect(backup).toContain('archive_volume "$FEC_V2_VOLUME" "$stage/fec_v2_objects.tgz"');
    expect(backup).toContain("fec_v2_objects.tgz");
    expect(backup).toContain("fec-v2-retention-evidence.txt");
    expect(backup).toContain("fec-v2-root.crt");
    expect(restore).toContain('fec_v2_volume="${network}-fec-v2-objects"');
    expect(restore).toContain('RESTORE_SUBNET="${RESTORE_SUBNET:-10.253.0.0/24}"');
    expect(restore).toContain('docker network create --internal --subnet "$RESTORE_SUBNET" "$network"');
    expect(restore).toContain('docker stop --time 30 "$rawstore_container"');
    expect(restore).toContain('append_evidence "rawstore_stopped_after_health=pass"');
    expect(restore).toContain('docker stop --time 30 "$postgres_container"');
    expect(restore).toContain('append_evidence "postgres_stopped_before_fec_restore=pass"');
    expect(restore).toContain('docker stop --time 30 "$fecstore_container"');
    expect(restore).toContain('append_evidence "postgres_restarted_after_fec_restore=pass"');
    expect(restore).toContain("/backup/fec_v2_objects.tgz");
    expect(restore).toContain("server --certs-dir /certs /data");
    expect(restore).toContain("mc alias set restored https://fecstore:9000");
    expect(restore).not.toContain("https://'\"$fecstore_container\"':9000");
    expect(restore).toContain("FEC_V2_RESTORE_ALIAS_FAILED");
    expect(restore).toContain("mc stat --json restored/dsa-seats-fec-v2/operational-preflight/tls-versioning-retention-v1.txt");
    expect(restore).toContain('append_evidence "fec_v2_tls_recovery_path=pass"');
    expect(restore).toContain('append_evidence "fec_v2_object_restore=pass"');
    expect(restore).toContain('case "$version_info" in *"versioning is enabled"*');
    expect(restore).toContain("configured for 1YEARS");
    expect(restore).toContain(`\\"X-Amz-Object-Lock-Mode\\":\\"COMPLIANCE\\"`);
    expect(restore).toContain(`\\"X-Amz-Object-Lock-Retain-Until-Date\\":\\"`);
    expect(restore).toContain('version_id=${retained_object#*\\"versionID\\":\\"}');
    expect(restore).toContain('[ -n "$version_id" ]');
    expect(restore).toContain('append_evidence "fec_v2_versioning_restore=pass"');
    expect(restore).toContain('append_evidence "fec_v2_one_year_compliance_retention_restore=pass"');
    expect(restore).toContain('--command "ANALYZE;"');
    expect(restore).toContain('append_evidence "postgres_analyze=pass"');
  });

  it("requires the dedicated FEC store in production component health", () => {
    const monitor = read("monitor-factual.sh");

    expect(monitor).toContain('FECSTORE_CONTAINER="${FECSTORE_CONTAINER:-dsa-seats-r1-fecstore-1}"');
    expect(monitor).toContain('fecstore_healthy="$(container_health "$FECSTORE_CONTAINER")"');
    expect(monitor).toContain('component="fecstore"} %s\\n\' "$fecstore_healthy"');
  });
});
