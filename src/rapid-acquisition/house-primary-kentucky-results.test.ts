import { describe, expect, it } from "vitest";

import { buildKentuckyPrimaryResults, validateKentuckyPrimaryResults } from "./house-primary-kentucky-results";

describe("Kentucky rapid House-primary results", () => {
  it("parses the exact official KY-03 Democratic table without winner inference", () => {
    const value = buildKentuckyPrimaryResults();
    expect(value.summary).toEqual({ observations: 1, candidateRows: 3, candidateVotes: 52641, scoreEligibleRows: 0 });
    expect(value.results[0]).toMatchObject({ cycleYear: 2024, districtLabel: "KY-03", sourceCandidateNames: ["Morgan McGARVEY", "Geoffrey M. \"Geoff\" YOUNG", "Jared RANDALL"], candidateVotes: [44275, 5875, 2491], totalVotes: 52641, sourceWinnerStatus: "not_marked_by_source", identity: null, scoreEligible: false });
    expect(validateKentuckyPrimaryResults(value)).toEqual(value);
  });

  it.each([["sourceWinnerStatus", "source_marked_winner"], ["scoreEligible", true], ["totalVotes", 0], ["identity", "fabricated"]])("rejects coherent %s escalation", (field, replacement) => {
    const value = structuredClone(buildKentuckyPrimaryResults()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateKentuckyPrimaryResults(value)).toThrow("KENTUCKY_RESULTS_INVALID");
  });
});
