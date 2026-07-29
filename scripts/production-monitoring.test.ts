import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const artifact = (name: string): string => join(process.cwd(), "deploy", "nuc", name);

describe("factual production monitoring artifacts", () => {
  it("probes the required factual contracts without sensitive metric labels", async () => {
    const script = await readFile(artifact("monitor-factual.sh"), "utf8");
    for (const metric of [
      "dsa_seats_public_route_healthy",
      "dsa_seats_public_body_contract_healthy",
      "dsa_seats_expected_release_healthy",
      "dsa_seats_synthetic_content_detected",
      "dsa_seats_caddy_route_healthy",
      "dsa_seats_origin_route_healthy",
      "dsa_seats_component_healthy",
      "dsa_seats_database_probe_healthy",
      "dsa_seats_validation_gate_healthy",
      "dsa_seats_ingestion_runs",
      "dsa_seats_map_integrity_failures",
      "dsa_seats_map_route_healthy",
      "dsa_seats_monitor_last_run_unixtime",
    ]) expect(script).toContain(metric);
    expect(script).toContain("/run/secrets/db_preflight_password");
    expect(script).toContain("dsa_seats_preflight_login");
    expect(script).toContain('grep -Fq "Synthetic"');
    expect(script).not.toContain('local name=$1 url=$2 host_header=${3:-} body=');
    expect(script).toContain('[[ -d "$metric_dir" ]] || install -d -m 0755 "$metric_dir"');
    expect(script).not.toMatch(/address|correction|donor|credential|password"}/i);
    expect(script).not.toMatch(/printf 'dsa_seats_[^']*\{[^']*release_id=/);
  });

  it("defines bounded alerts for route, storage, ingestion, validation, and maps", async () => {
    const rules = await readFile(artifact("dsa-seats-alerts.yml"), "utf8");
    for (const alert of [
      "DsaSeatsFactualMonitorStale",
      "DsaSeatsPublicRouteUnavailable",
      "DsaSeatsPublicBodyContractFailed",
      "DsaSeatsExpectedReleaseMismatch",
      "DsaSeatsSyntheticContentDetected",
      "DsaSeatsCaddyRouteFailed",
      "DsaSeatsOriginRouteFailed",
      "DsaSeatsComponentUnhealthy",
      "DsaSeatsDatabaseProbeFailed",
      "DsaSeatsValidationGateFailed",
      "DsaSeatsIngestionFailed",
      "DsaSeatsIngestionStuck",
      "DsaSeatsBackupFailed",
      "DsaSeatsBackupStale",
      "DsaSeatsRestoreDrillFailed",
      "DsaSeatsRestoreDrillStale",
      "DsaSeatsMapIntegrityFailed",
    ]) expect(rules).toContain(`alert: ${alert}`);
    expect(rules).not.toMatch(/receiver|webhook|token|address|correction|donor/i);
  });

  it("schedules a hardened one-shot probe with an explicit release environment", async () => {
    const [service, timer] = await Promise.all([
      readFile(artifact("dsa-seats-factual-monitor.service"), "utf8"),
      readFile(artifact("dsa-seats-factual-monitor.timer"), "utf8"),
    ]);
    for (const control of ["EnvironmentFile=/etc/dsa-seats-factual-monitor.env", "NoNewPrivileges=true", "ProtectSystem=strict", "PrivateTmp=true"]) expect(service).toContain(control);
    expect(timer).toContain("OnUnitActiveSec=1min");
    expect(timer).toContain("Persistent=true");
  });

  it("includes factual monitoring configuration in the encrypted recovery set", async () => {
    const backup = await readFile(artifact("backup-factual.sh"), "utf8");
    for (const recoveryFile of [
      "monitor-factual.sh",
      "dsa-seats-factual-monitor.service",
      "dsa-seats-factual-monitor.timer",
      "dsa-seats-factual-monitor.env",
      "prometheus.yml",
      "dsa-seats-alerts.yml",
      "dsa_seats_factual.prom",
    ]) expect(backup).toContain(recoveryFile);
  });
});
