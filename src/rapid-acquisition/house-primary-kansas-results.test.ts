import { describe, expect, it } from "vitest";

import { buildKansasPrimaryResults, validateKansasPrimaryResults } from "./house-primary-kansas-results";

describe("Kansas rapid House-primary results", () => {
  it("aggregates master plus special-county sheets for KS-03 without inference", () => {
    const value = buildKansasPrimaryResults();
    expect(value.summary).toEqual({ observations: 2, candidateRows: 2, candidateVotes: 141782, scoreEligibleRows: 0 });
    expect(value.results[0]).toMatchObject({ cycleYear: 2022, candidateVotes: 103945, segmentVotes: { statewideMasterExcludingSpecialCountySheets: 4669, johnsonCounty: 93377, wyandotteCounty: 5899 }, redactedTargetPrecinctCells: 9 });
    expect(value.results[1]).toMatchObject({ cycleYear: 2024, candidateVotes: 37837, segmentVotes: { statewideMasterExcludingSpecialCountySheets: 1260, johnsonCounty: 34604, wyandotteCounty: 1973 }, redactedTargetPrecinctCells: 10 });
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && !row.scoreEligible && row.identity === null)).toBe(true);
    expect(validateKansasPrimaryResults(value)).toEqual(value);
  }, 30_000);
  it.each([["candidateVotes", 0], ["sourceWinnerStatus", "source_marked_winner"], ["scoreEligible", true]])("rejects %s tampering", (field, replacement) => { const value = structuredClone(buildKansasPrimaryResults()) as unknown as Record<string, unknown>; (value.results as Record<string, unknown>[])[0]![field] = replacement; value.packageSha256 = "0".repeat(64); expect(() => validateKansasPrimaryResults(value)).toThrow("KANSAS_RESULTS_INVALID"); });
});
