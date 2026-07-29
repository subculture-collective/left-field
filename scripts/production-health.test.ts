import { describe, expect, it } from "vitest";
import { inspectProductionTelemetry } from "./production-health";

const now = 1_800_000_000;
const metric = (name: string, value: number, labels: Record<string, string> = {}) => ({ metric: { __name__: name, project: "dsa-seats", environment: "factual-r1", ...labels }, value: [now, String(value)] });
const vector = [
  metric("dsa_seats_monitor_last_run_unixtime", now - 30),
  metric("dsa_seats_public_route_healthy", 1),
  metric("dsa_seats_public_body_contract_healthy", 1),
  metric("dsa_seats_expected_release_healthy", 1),
  metric("dsa_seats_synthetic_content_detected", 0),
  metric("dsa_seats_caddy_route_healthy", 1),
  metric("dsa_seats_origin_route_healthy", 1),
  ...["app", "postgres", "rawstore", "fecstore"].map(component => metric("dsa_seats_component_healthy", 1, { component })),
  metric("dsa_seats_database_probe_healthy", 1),
  metric("dsa_seats_validation_gate_healthy", 1),
  metric("dsa_seats_ingestion_runs", 0, { state: "failed" }),
  metric("dsa_seats_ingestion_runs", 0, { state: "running" }),
  metric("dsa_seats_backup_success", 1),
  metric("dsa_seats_backup_last_success_unixtime", now - 60),
  metric("dsa_seats_restore_drill_success", 1),
  metric("dsa_seats_restore_drill_last_success_unixtime", now - 120),
  metric("dsa_seats_map_integrity_failures", 0),
  metric("dsa_seats_map_route_healthy", 1),
];

const fetcher = async (input: string | URL | Request): Promise<Response> => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/query")) return Response.json({ status: "success", data: { result: vector } });
  return Response.json({ status: "success", data: { groups: [{ name: "dsa-seats-factual", rules: Array.from({ length: 17 }, () => ({ health: "ok", state: "inactive" })) }] } });
};

describe("production telemetry health", () => {
  it("passes only with fresh production series and healthy evaluated alert rules", async () => {
    const report = await inspectProductionTelemetry(new URL("http://10.0.0.56:9090"), fetcher as typeof fetch, now);
    expect(report.status).toBe("pass");
    expect(report.checks).toHaveLength(8);
    expect(report.checks.every(check => check.status === "pass")).toBe(true);
  });

  it("fails when synthetic content is detected", async () => {
    const unsafe = vector.map(item => item.metric.__name__ === "dsa_seats_synthetic_content_detected" ? metric("dsa_seats_synthetic_content_detected", 1) : item);
    const unsafeFetcher = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/query")
        ? Response.json({ status: "success", data: { result: unsafe } })
        : Response.json({ status: "success", data: { groups: [{ name: "dsa-seats-factual", rules: Array.from({ length: 17 }, () => ({ health: "ok", state: "inactive" })) }] } });
    };
    const report = await inspectProductionTelemetry(new URL("http://10.0.0.56:9090"), unsafeFetcher as typeof fetch, now);
    expect(report.status).toBe("fail");
    expect(report.checks.find(check => check.name === "public_contracts")?.status).toBe("fail");
  });

  it("ignores duplicate foreign-environment series and scopes the Prometheus query", async () => {
    const foreign = vector.map(item => ({
      ...item,
      metric: { ...item.metric, project: "other", environment: "preview" },
      value: [now, item.metric.__name__ === "dsa_seats_synthetic_content_detected" ? "1" : "0"],
    }));
    let query = "";
    const scopedFetcher = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/query")) {
        query = url.searchParams.get("query") ?? "";
        return Response.json({ status: "success", data: { result: [...foreign, ...vector] } });
      }
      return Response.json({ status: "success", data: { groups: [{ name: "dsa-seats-factual", rules: Array.from({ length: 17 }, () => ({ health: "ok", state: "inactive" })) }] } });
    };
    await expect(inspectProductionTelemetry(new URL("http://10.0.0.56:9090"), scopedFetcher as typeof fetch, now)).resolves.toMatchObject({ status: "pass" });
    expect(query).toContain('project="dsa-seats"');
    expect(query).toContain('environment="factual-r1"');
  });
});
