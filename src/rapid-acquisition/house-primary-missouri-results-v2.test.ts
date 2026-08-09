import { describe, expect, it } from "vitest";
import { buildMissouriPrimaryResultsV2, validateMissouriPrimaryResultsV2 } from "./house-primary-missouri-results-v2";

describe("Missouri rapid House-primary results v2", () => {
  it("adds exact 2022 Democratic target totals without importing all-party totals", () => {
    const value = buildMissouriPrimaryResultsV2();
    expect(value.summary).toEqual({ observations: 4, candidateRows: 12, candidateVotes: 354070, scoreEligibleRows: 0 });
    expect(value.results.slice(0, 2)).toEqual([
      expect.objectContaining({ districtLabel: "MO-01", sourceCandidateNames: ["Ron Harshaw", "Michael Daniels", "Cori Bush", "Earl Childress", "Steve Roberts"], candidateVotes: [1065, 1683, 65326, 929, 25015], totalVotes: 94018 }),
      expect.objectContaining({ districtLabel: "MO-05", sourceCandidateNames: ["Emanuel Cleaver, II", "Maite Salazar"], candidateVotes: [60399, 10147], totalVotes: 70546 }),
    ]);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.identity === null && !row.scoreEligible)).toBe(true);
    expect(validateMissouriPrimaryResultsV2(value)).toEqual(value);
  });
  it.each([["sourceWinnerStatus", "source_marked_winner"], ["scoreEligible", true], ["totalVotes", 110574], ["identity", "fabricated"]])("rejects coherent %s escalation", (field, replacement) => {
    const value = structuredClone(buildMissouriPrimaryResultsV2()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateMissouriPrimaryResultsV2(value)).toThrow("MISSOURI_RESULTS_V2_INVALID");
  });
});
