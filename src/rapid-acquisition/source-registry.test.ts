import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { housePrimarySourceRegistry, validateHousePrimarySourceRegistry } from "./source-registry";

const rawRegistry = () => JSON.parse(readFileSync("data/rapid-acquisition/house-primary-source-registry-v1.json", "utf8")) as Record<string, unknown>;
const firstReadyRow = (raw: Record<string, unknown>) =>
  (raw.rows as Record<string, unknown>[]).find((row) => row.acquisitionStatus === "acquisition_ready")!;

describe("16-state House-primary source registry", () => {
  it("is a self-contained 48-row raw registry with exact state/cycle coverage", () => {
    const raw = rawRegistry();
    expect(Object.keys(raw).sort()).toEqual(["asOf", "rows", "schema", "version"]);
    expect(raw.asOf).toBe("2026-08-07");
    expect(Array.isArray(raw.rows) && raw.rows).toHaveLength(48);
    expect((raw.rows as Record<string, unknown>[]).every((row) => Array.isArray(row.artifacts) && row.districtAvailability !== undefined && row.source === undefined)).toBe(true);
    const registry = housePrimarySourceRegistry();
    expect([...new Set(registry.rows.map((row) => row.stateCode))]).toEqual(["AL", "DE", "HI", "IN", "KS", "KY", "LA", "MO", "MS", "NH", "NV", "RI", "SC", "TN", "VT", "WI"]);
    expect(registry.rows.every((row) => [2022, 2024, 2026].includes(row.cycleYear))).toBe(true);
  });

  it("pins exact target-district closure, status policy, and verified artifacts", () => {
    const rows = housePrimarySourceRegistry().rows;
    expect(rows.filter((row) => row.cycleYear === 2022).flatMap((row) => row.targetDistricts)).toHaveLength(26);
    expect(rows.every((row) => Object.keys(row.districtAvailability).sort().join("\0") === [...row.targetDistricts].sort().join("\0"))).toBe(true);
    expect(rows.every((row) => Object.values(row.districtAvailability).every((closure) => closure === row.finalClosure))).toBe(true);
    expect(rows.filter((row) => String(row.finalClosure) === "results_collected")).toHaveLength(0);
    const readyRows = rows.filter((row) => row.acquisitionStatus === "acquisition_ready");
    expect(readyRows).toHaveLength(16);
    expect(readyRows.every((row) => row.finalClosure === null && Object.values(row.districtAvailability).every((closure) => closure === null) && row.artifacts.length > 0)).toBe(true);
    expect(rows.filter((row) => row.acquisitionStatus !== "acquisition_ready").every((row) => row.artifacts.length === 0)).toBe(true);
    expect(rows.flatMap((row) => row.artifacts).every((artifact) => new URL(artifact.url).protocol === "https:" && artifact.outputPath.startsWith("house-primary/"))).toBe(true);
  });

  it("retains explicit Louisiana, Wisconsin, and future-event policies", () => {
    const registry = housePrimarySourceRegistry();
    expect(registry.rows.filter((row) => row.stateCode === "LA").every((row) => row.finalClosure === "not_held" && row.acquisitionStatus === "not_applicable")).toBe(true);
    expect(registry.rows.filter((row) => row.stateCode === "WI" && row.cycleYear !== 2026).every((row) => row.finalClosure === "source_blocked")).toBe(true);
    expect(registry.rows.filter((row) => row.cycleYear === 2026 && row.electionDate > registry.asOf).every((row) => row.finalClosure === "future_event" || row.finalClosure === "not_held")).toBe(true);
  });

  it("rejects injected shared sources and descriptor/status drift", () => {
    const withSharedSources = rawRegistry();
    withSharedSources.sources = {};
    expect(() => validateHousePrimarySourceRegistry(withSharedSources)).toThrow("HOUSE_PRIMARY_REGISTRY_INVALID");
    const withArtifactDrift = rawRegistry();
    (firstReadyRow(withArtifactDrift).artifacts as Record<string, unknown>[])[0]!.authority = "Unverified";
    expect(() => validateHousePrimarySourceRegistry(withArtifactDrift)).toThrow("HOUSE_PRIMARY_REGISTRY_ARTIFACT_POLICY_INVALID");
    const withStatusDrift = rawRegistry();
    firstReadyRow(withStatusDrift).acquisitionStatus = "source_blocked";
    expect(() => validateHousePrimarySourceRegistry(withStatusDrift)).toThrow("HOUSE_PRIMARY_REGISTRY_STATUS_POLICY_INVALID");
    const withCollectedClaim = rawRegistry();
    firstReadyRow(withCollectedClaim).finalClosure = "results_collected";
    expect(() => validateHousePrimarySourceRegistry(withCollectedClaim)).toThrow("HOUSE_PRIMARY_REGISTRY_ROW_INVALID");
  });
});
