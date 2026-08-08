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
    writeFileSync(fakeDocker, "#!/bin/sh\ncase \"$1\" in cp) exit 0;; exec) exit 0;; *) exit 1;; esac\n");
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

  it("preserves the live config and rules when validation fails", () => {
    const root = mkdtempSync(join(tmpdir(), "dsa-prometheus-rules-fail-"));
    const config = join(root, "prometheus.yml");
    const sourceRules = join(root, "source.yml");
    const installedRules = join(root, "alerts/dsa-seats-alerts.yml");
    const fakeDocker = join(root, "docker");
    writeFileSync(config, "rule_files:\n  - /etc/prometheus/alerts/base.yml\nscrape_configs:\n");
    writeFileSync(sourceRules, "groups:\n  - name: broken-candidate\n");
    writeFileSync(fakeDocker, "#!/bin/sh\ncase \"$1\" in cp) exit 0;; exec) [ \"$3\" = rm ] && exit 0; exit 1;; esac\n");
    chmodSync(fakeDocker, 0o755);
    execFileSync("mkdir", ["-p", join(root, "alerts")]);
    writeFileSync(installedRules, "groups:\n  - name: original\n");
    const originalConfig = readFileSync(config, "utf8");
    const originalRules = readFileSync(installedRules, "utf8");

    expect(() => execFileSync("sh", [script], { env: { ...process.env, PROMETHEUS_CONFIG: config, SOURCE_RULES: sourceRules, INSTALLED_RULES: installedRules, DOCKER: fakeDocker } })).toThrow();
    expect(readFileSync(config, "utf8")).toBe(originalConfig);
    expect(readFileSync(installedRules, "utf8")).toBe(originalRules);
  });

  it("rejects a concurrent registration before changing live files", () => {
    const root = mkdtempSync(join(tmpdir(), "dsa-prometheus-rules-lock-"));
    const config = join(root, "prometheus.yml");
    const sourceRules = join(root, "source.yml");
    const installedRules = join(root, "alerts/dsa-seats-alerts.yml");
    const lockFile = join(root, "register.lock");
    const fakeDocker = join(root, "docker");
    writeFileSync(config, "rule_files:\n  - /etc/prometheus/alerts/base.yml\nscrape_configs:\n");
    writeFileSync(sourceRules, "groups:\n  - name: replacement\n");
    writeFileSync(fakeDocker, "#!/bin/sh\nexit 0\n");
    chmodSync(fakeDocker, 0o755);
    execFileSync("mkdir", ["-p", join(root, "alerts")]);
    writeFileSync(installedRules, "groups:\n  - name: original\n");
    const originalConfig = readFileSync(config, "utf8");
    const originalRules = readFileSync(installedRules, "utf8");
    const env = { ...process.env, PROMETHEUS_CONFIG: config, SOURCE_RULES: sourceRules, INSTALLED_RULES: installedRules, PROMETHEUS_RULES_LOCK: lockFile, DOCKER: fakeDocker };

    expect(() => execFileSync("flock", [lockFile, "sh", script], { env })).toThrow();
    expect(readFileSync(config, "utf8")).toBe(originalConfig);
    expect(readFileSync(installedRules, "utf8")).toBe(originalRules);
  });
});
