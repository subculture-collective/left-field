import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadRapidHousePrimaryCoverage } from "./rapid-house-primary-coverage";

const roots: string[] = [];
const root = async () => { const value = await mkdtemp(join(tmpdir(), "dsa-seats-rapid-ui-")); roots.push(value); return value; };
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });

describe("rapid House-primary coverage read model", () => {
  it("is absent without a generated ledger", async () => expect(await loadRapidHousePrimaryCoverage(await root())).toBeNull());
  it("reads only the canonical source-verified ledger", async () => {
    const value = await loadRapidHousePrimaryCoverage();
    expect(value?.rows).toHaveLength(48);
    expect(value?.rows.flatMap((row) => row.expectedTargetDistricts)).toHaveLength(78);
    expect(value?.rows.reduce((sum, row) => sum + row.parsedDistrictCount, 0)).toBe(22);
    expect(value?.rows.reduce((sum, row) => sum + row.sourceAbsentDistrictCount, 0)).toBe(2);
  });
  it("rejects a well-shaped but unverified ledger", async () => {
    const directory = await root(); await mkdir(join(directory, "data/metadata"), { recursive: true });
    await writeFile(join(directory, "data/metadata/rapid-house-primary-coverage-ledger-v8.json"), JSON.stringify({ schema: "rapid-house-primary-coverage-ledger-v8", version: 8, rows: [{ stateCode: "SC", cycleYear: 2024, expectedTargetDistricts: ["SC-06"], retainedArtifactCount: 1, parsedDistrictCount: 0, sourceAbsentDistrictCount: 0, status: "ready_unparsed" }] }));
    await expect(loadRapidHousePrimaryCoverage(directory)).resolves.toBeNull();
  });
});
