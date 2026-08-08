import { describe, expect, it } from "vitest";
import { buildMississippiPrimaryResults, validateMississippiPrimaryResults } from "./house-primary-mississippi-results";

describe("Mississippi rapid House-primary results", () => {
  it("parses the explicit statewide MS-02 Democratic total", () => {
    const value = buildMississippiPrimaryResults();
    expect(value.summary).toEqual({ observations: 1, candidateRows: 1, candidateVotes: 44295, scoreEligibleRows: 0 });
    expect(value.results[0]).toMatchObject({ districtLabel: "MS-02", sourceCandidateNames: ["Bennie G. Thompson"], candidateVotes: [44295], totalVotes: 44295, sourceWinnerStatus: "not_marked_by_source", identity: null, scoreEligible: false });
    expect(validateMississippiPrimaryResults(value)).toEqual(value);
  });
  it.each([["sourceWinnerStatus", "source_marked_winner"], ["scoreEligible", true], ["totalVotes", 0], ["identity", "fabricated"]])("rejects coherent %s escalation", (field, replacement) => { const value = structuredClone(buildMississippiPrimaryResults()) as unknown as Record<string, unknown>; (value.results as Record<string, unknown>[])[0]![field] = replacement; value.packageSha256 = "0".repeat(64); expect(() => validateMississippiPrimaryResults(value)).toThrow("MISSISSIPPI_RESULTS_INVALID"); });
});
