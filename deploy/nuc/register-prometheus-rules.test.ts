import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "deploy/nuc/register-prometheus-rules.sh");

describe("factual Prometheus rule registration", () => {
  it("installs and registers the checked rules exactly once", () => {
    const root = mkdtempSync(join(tmpdir(), "dsa-prometheus-rules-"));
    const config = join(root, "prometheus.yml");
    const sourceRules = join(root, "source.yml");
    const installedRules = join(root, "alerts/dsa-seats-alerts.yml");
    const fakeDocker = join(root, "docker");
    writeFileSync(config, "global:\n  scrape_interval: 15s\nrule_files:\n  - /etc/prometheus/alerts/base.yml\nscrape_configs:\n  - job_name: prometheus\n");
    writeFileSync(sourceRules, "groups:\n  - name: dsa-seats-factual\n    rules:\n      - alert: DsaSeatsPublicRouteUnavailable\n        expr: vector(0)\n");
    writeFileSync(fakeDocker, "#!/bin/sh\n[ \"$1\" = exec ] && [ \"$3\" = promtool ] && [ \"$4\" = check ]\n");
    chmodSync(fakeDocker, 0o755);

    const env = {
      ...process.env,
      PROMETHEUS_CONFIG: config,
      SOURCE_RULES: sourceRules,
      INSTALLED_RULES: installedRules,
      DOCKER: fakeDocker,
    };
    execFileSync("sh", [script], { env });
    execFileSync("sh", [script], { env });

    const updated = readFileSync(config, "utf8");
    expect(updated.match(/\/etc\/prometheus\/alerts\/dsa-seats-alerts\.yml/g)).toHaveLength(1);
    expect(updated.indexOf("dsa-seats-alerts.yml")).toBeLessThan(updated.indexOf("scrape_configs:"));
    expect(readFileSync(installedRules, "utf8")).toBe(readFileSync(sourceRules, "utf8"));
  });
});
