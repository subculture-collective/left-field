import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildRapidLocalContextCoverageV16,
  COVERAGE_PATH,
  validateRapidLocalContextCoverageV16,
} from "./coverage";
import { registeredArtifacts } from "./registry";

describe("registry-driven local context coverage v16", () => {
  it("lists every registered artifact from lock-verified bytes", () => {
    const value = buildRapidLocalContextCoverageV16();
    expect(value.artifacts.map((artifact) => artifact.id)).toEqual(registeredArtifacts().map((artifact) => artifact.id));
    expect(value.artifacts.every((artifact) => artifact.formulaEligibleCount === 0)).toBe(true);
    expect(value.artifacts.at(-1)).toMatchObject({
      id: "rapid-ohio-state-legislative-democratic-primary-results-v1",
      summary: { reportedPartyContests: 221, candidateRows: 282 },
    });
  });

  it("matches the previous chained receipt artifact by artifact", () => {
    const current = buildRapidLocalContextCoverageV16();
    const prior = JSON.parse(readFileSync("data/metadata/rapid-local-context-coverage-v15.json", "utf8")) as { artifacts: unknown[] };
    expect(current.artifacts).toEqual(prior.artifacts);
  });

  it("validates the retained receipt and rejects score activation", () => {
    const retained = JSON.parse(readFileSync(COVERAGE_PATH, "utf8")) as unknown;
    expect(validateRapidLocalContextCoverageV16(retained).version).toBe(16);
    const tampered = structuredClone(retained) as { artifacts: { formulaEligibleCount: number }[] };
    tampered.artifacts[0]!.formulaEligibleCount = 1;
    expect(() => validateRapidLocalContextCoverageV16(tampered)).toThrow("RAPID_LOCAL_CONTEXT_COVERAGE_V16_INVALID");
  });
});
