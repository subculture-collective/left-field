import { describe, expect, it } from "vitest";

import {
  buildNewHampshirePrimaryResults,
  validateNewHampshirePrimaryResults,
} from "./house-primary-new-hampshire-results";

describe("rapid New Hampshire House-primary results", () => {
  it("closes both 2024 Democratic congressional workbooks without inferring winners", () => {
    const value = buildNewHampshirePrimaryResults();
    expect(value.summary).toEqual({
      observations: 2,
      candidateRows: 4,
      candidateVotes: 125_012,
      sourceMarkedWinnerContests: 0,
      scoreEligibleRows: 0,
    });
    expect(value.results.map((row) => [row.districtLabel, row.candidates.map((candidate) => [candidate.sourceCandidateName, candidate.votes]), row.totalCandidateVotes])).toEqual([
      ["NH-01", [["Chris Pappas", 54_927], ["Kevin Rondeau", 2_783]], 57_710],
      ["NH-02", [["Maggie Goodlander", 42_960], ["Colin Van Ostern", 24_342]], 67_302],
    ]);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.winner === null && row.identity === null && !row.scoreEligible)).toBe(true);
  });

  it("rejects lifecycle escalation", () => {
    const value = structuredClone(buildNewHampshirePrimaryResults()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateNewHampshirePrimaryResults(value)).toThrow("NEW_HAMPSHIRE_RESULTS_INVALID");
  });
});
