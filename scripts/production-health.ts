import { executeReleaseHealth, releaseHealthExitCode, type ReleaseHealthEnvironment } from "./release-health";

type Status = "pass" | "fail" | "blocked";
type Fetcher = typeof fetch;
interface PrometheusResult { readonly metric: Readonly<Record<string, string>>; readonly value: readonly [number, string]; }
interface TelemetryCheck { readonly name: string; readonly status: Status; readonly evidence: Readonly<Record<string, number | string>>; }
export interface ProductionHealthReport {
  readonly releaseId: string;
  readonly status: Status;
  readonly repositoryStatus: Status;
  readonly productionTelemetryStatus: Status;
  readonly alertDeliveryStatus: Status;
  readonly checks: readonly TelemetryCheck[];
}
export interface ProductionHealthEnvironment extends ReleaseHealthEnvironment {
  readonly PRODUCTION_PROMETHEUS_URL?: string;
}

export function productionHealthExitCode(report: ProductionHealthReport): 0 | 1 {
  return report.status === "pass" ? 0 : 1;
}

function prometheusBaseUrl(value: string | undefined): URL {
  if (!value) throw new Error("PRODUCTION_PROMETHEUS_URL is required");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw new Error("PRODUCTION_PROMETHEUS_URL must be an HTTP(S) origin without credentials");
  return url;
}

async function prometheusJson(fetcher: Fetcher, url: URL): Promise<Record<string, unknown>> {
  const response = await fetcher(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("production telemetry request failed");
  const value = await response.json() as Record<string, unknown>;
  if (value.status !== "success") throw new Error("production telemetry response was unsuccessful");
  return value;
}

const numberValue = (result: PrometheusResult | undefined): number | undefined => {
  const value = Number(result?.value[1]);
  return Number.isFinite(value) ? value : undefined;
};

export async function inspectProductionTelemetry(base: URL, fetcher: Fetcher = fetch, nowSeconds = Date.now() / 1000): Promise<{ readonly status: Status; readonly checks: readonly TelemetryCheck[] }> {
  const targetLabels = Object.freeze({ project: "dsa-seats", environment: "factual-r1" });
  const query = new URL("/api/v1/query", base);
  query.searchParams.set("query", '{__name__=~"dsa_seats_.*",project="dsa-seats",environment="factual-r1"}');
  const rulesUrl = new URL("/api/v1/rules", base);
  rulesUrl.searchParams.set("type", "alert");
  const [vectorJson, rulesJson] = await Promise.all([prometheusJson(fetcher, query), prometheusJson(fetcher, rulesUrl)]);
  const vectorData = vectorJson.data as { result?: PrometheusResult[] } | undefined;
  const results = Array.isArray(vectorData?.result) ? vectorData.result : [];
  const find = (name: string, labels: Readonly<Record<string, string>> = {}): PrometheusResult | undefined =>
    results.find(result => result.metric.__name__ === name && Object.entries({ ...targetLabels, ...labels }).every(([key, value]) => result.metric[key] === value));
  const exact = (name: string, expected: number, labels: Readonly<Record<string, string>> = {}): boolean => numberValue(find(name, labels)) === expected;
  const checks: TelemetryCheck[] = [];
  const add = (name: string, pass: boolean, evidence: Record<string, number | string>): void => { checks.push({ name, status: pass ? "pass" : "fail", evidence }); };

  const monitorAt = numberValue(find("dsa_seats_monitor_last_run_unixtime")) ?? 0;
  const backupAt = numberValue(find("dsa_seats_backup_last_success_unixtime")) ?? 0;
  const restoreAt = numberValue(find("dsa_seats_restore_drill_last_success_unixtime")) ?? 0;
  add("telemetry_freshness", monitorAt > 0 && nowSeconds - monitorAt <= 180, { ageSeconds: Math.max(0, Math.floor(nowSeconds - monitorAt)) });
  add("public_contracts",
    exact("dsa_seats_public_route_healthy", 1)
      && exact("dsa_seats_public_body_contract_healthy", 1)
      && exact("dsa_seats_expected_release_healthy", 1)
      && exact("dsa_seats_synthetic_content_detected", 0)
      && exact("dsa_seats_caddy_route_healthy", 1)
      && exact("dsa_seats_origin_route_healthy", 1),
    { public: numberValue(find("dsa_seats_public_route_healthy")) ?? -1, synthetic: numberValue(find("dsa_seats_synthetic_content_detected")) ?? -1 });
  add("component_health", ["app", "postgres", "rawstore", "fecstore"].every(component => exact("dsa_seats_component_healthy", 1, { component })), { components: 4 });
  add("database_contracts",
    exact("dsa_seats_database_probe_healthy", 1)
      && exact("dsa_seats_validation_gate_healthy", 1)
      && exact("dsa_seats_ingestion_runs", 0, { state: "failed" })
      && exact("dsa_seats_ingestion_runs", 0, { state: "running" }),
    { failedRuns: numberValue(find("dsa_seats_ingestion_runs", { state: "failed" })) ?? -1, runningRuns: numberValue(find("dsa_seats_ingestion_runs", { state: "running" })) ?? -1 });
  add("backup_contract", exact("dsa_seats_backup_success", 1) && backupAt > 0 && nowSeconds - backupAt <= 93_600, { ageSeconds: Math.max(0, Math.floor(nowSeconds - backupAt)) });
  add("restore_contract", exact("dsa_seats_restore_drill_success", 1) && restoreAt > 0 && nowSeconds - restoreAt <= 3_024_000, { ageSeconds: Math.max(0, Math.floor(nowSeconds - restoreAt)) });
  add("map_contract", exact("dsa_seats_map_integrity_failures", 0) && exact("dsa_seats_map_route_healthy", 1), { failures: numberValue(find("dsa_seats_map_integrity_failures")) ?? -1 });

  const rulesData = rulesJson.data as { groups?: Array<{ name?: string; rules?: Array<{ health?: string; state?: string; lastError?: string }> }> } | undefined;
  const group = rulesData?.groups?.find(item => item.name === "dsa-seats-factual");
  const rules = group?.rules ?? [];
  add("alert_rule_evaluation", rules.length === 17 && rules.every(rule => rule.health === "ok" && rule.state === "inactive" && !rule.lastError), { rules: rules.length });
  return { status: checks.every(check => check.status === "pass") ? "pass" : "fail", checks };
}

export async function executeProductionHealth(argv: readonly string[], env: ProductionHealthEnvironment, fetcher: Fetcher = fetch): Promise<ProductionHealthReport> {
  const repository = await executeReleaseHealth(argv, env);
  const releaseId = argv[1]!;
  let telemetry: Awaited<ReturnType<typeof inspectProductionTelemetry>>;
  try { telemetry = await inspectProductionTelemetry(prometheusBaseUrl(env.PRODUCTION_PROMETHEUS_URL), fetcher); }
  catch { telemetry = { status: "fail", checks: [{ name: "production_telemetry", status: "fail", evidence: { observed: 0 } }] }; }
  const alertDelivery: TelemetryCheck = { name: "alert_delivery", status: "blocked", evidence: { status: "named_receiver_unverified" } };
  const repositoryStatus = releaseHealthExitCode(repository) === 0 ? "pass" : "fail";
  const status: Status = repositoryStatus === "fail" || telemetry.status === "fail" ? "fail" : "blocked";
  return {
    releaseId,
    status,
    repositoryStatus,
    productionTelemetryStatus: telemetry.status,
    alertDeliveryStatus: alertDelivery.status,
    checks: [...telemetry.checks, alertDelivery],
  };
}

export async function main(argv = process.argv.slice(2), env = process.env as ProductionHealthEnvironment): Promise<void> {
  const report = await executeProductionHealth(argv, env);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = productionHealthExitCode(report);
}

if (process.argv[1]?.endsWith("production-health.ts")) void main().catch(() => { process.stderr.write("Production health check failed\n"); process.exitCode = 1; });
