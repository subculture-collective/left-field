import { describe, expect, it } from "vitest";

import { buildMissouriPrimaryResults, validateMissouriPrimaryResults } from "./house-primary-missouri-results";

describe("Missouri rapid House-primary results", () => {
  it("parses both target Democratic contests and excludes all-party totals", () => {
    const value = buildMissouriPrimaryResults();
    expect(value.summary).toEqual({ observations: 2, candidateRows: 5, candidateVotes: 189506, scoreEligibleRows: 0 });
    expect(value.results[0]).toMatchObject({ districtLabel: "MO-01", sourceCandidateNames: ["Cori Bush", "Wesley Bell", "Maria N. Chappelle-Nadal", "Ron Harshaw"], candidateVotes: [56723, 63521, 3279, 735], totalVotes: 124258 });
    expect(value.results[1]).toMatchObject({ districtLabel: "MO-05", sourceCandidateNames: ["Emanuel Cleaver, II"], candidateVotes: [65248], totalVotes: 65248 });
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.identity === null && !row.scoreEligible)).toBe(true);
    expect(validateMissouriPrimaryResults(value)).toEqual(value);
  });
  it.each([["sourceWinnerStatus", "source_marked_winner"], ["scoreEligible", true], ["totalVotes", 0], ["identity", "fabricated"]])("rejects coherent %s escalation", (field, replacement) => {
    const value = structuredClone(buildMissouriPrimaryResults()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]![field] = replacement; value.packageSha256 = "0".repeat(64);
    expect(() => validateMissouriPrimaryResults(value)).toThrow("MISSOURI_RESULTS_INVALID");
  });
});
