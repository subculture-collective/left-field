import { describe, expect, it } from "vitest";

import {
  buildRapidLocalContextCoverageV16,
  validateRapidLocalContextCoverageV16,
} from "./local-context-coverage-v16";

describe("rapid local context coverage v16", () => {
  it("reconciles the retained Indiana local-office receipt", () => {
    const value = buildRapidLocalContextCoverageV16();
    expect(value.artifacts).toHaveLength(18);
    expect(
      value.artifacts.find(
        (artifact) =>
          artifact.id === "rapid-indiana-local-office-primary-results-v1",
      ),
    ).toMatchObject({
      formulaEligibleCount: 0,
      summary: { officeCategories: 12, partyContests: 816 },
    });
  }, 60_000);

  it("rejects formula promotion of the reconciled local receipt", () => {
    const value = structuredClone(
      buildRapidLocalContextCoverageV16(),
    ) as unknown as { artifacts: { formulaEligibleCount: number }[] };
    value.artifacts.at(-1)!.formulaEligibleCount = 1;
    expect(() => validateRapidLocalContextCoverageV16(value)).toThrow(
      "RAPID_LOCAL_CONTEXT_COVERAGE_V16_INVALID",
    );
  }, 60_000);
});
