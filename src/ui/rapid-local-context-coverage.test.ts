import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadRapidLocalContextCoverage } from "./rapid-local-context-coverage";

const roots: string[] = [];
const root = async () => { const value = await mkdtemp(join(tmpdir(), "dsa-seats-local-context-ui-")); roots.push(value); return value; };
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });
describe("rapid local-context coverage read model", () => {
  it("is absent without the generated receipt", async () => expect(await loadRapidLocalContextCoverage(await root())).toBeNull());
  it("loads locked local-context coverage without rebuilding source archives", async () => {
    const value = await loadRapidLocalContextCoverage();
    expect(value?.artifacts).toHaveLength(3);
    expect(value?.artifacts.every((artifact) => artifact.formulaEligibleCount === 0)).toBe(true);
  });
  it("rejects a well-shaped receipt without source-lock validation", async () => {
    const directory = await root(); await mkdir(join(directory, "data/metadata"), { recursive: true });
    await writeFile(join(directory, "data/metadata/rapid-local-context-coverage-v1.json"), JSON.stringify({ schema: "rapid-local-context-coverage-v1", version: 1, releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score", artifacts: [] }));
    await expect(loadRapidLocalContextCoverage(directory)).resolves.toBeNull();
  });
});
