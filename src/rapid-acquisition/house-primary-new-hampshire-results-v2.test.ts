import { describe, expect, it } from "vitest";
import { buildNewHampshirePrimaryResultsV2, validateNewHampshirePrimaryResultsV2 } from "./house-primary-new-hampshire-results-v2";

describe("rapid New Hampshire House primary results v2", () => {
  it("adds both 2022 Democratic congressional workbooks without winner or score inference", () => {
    const value = buildNewHampshirePrimaryResultsV2();
    expect(value.summary).toEqual({ observations: 4, candidateRows: 6, candidateVotes: 215_632, sourceMarkedWinnerContests: 0, scoreEligibleRows: 0 });
    expect(value.results.slice(0, 2).map((row) => [row.districtLabel, row.candidates.map((candidate) => [candidate.sourceCandidateName, candidate.votes]), row.totalCandidateVotes])).toEqual([
      ["NH-01", [["Chris Pappas", 41_990]], 41_990],
      ["NH-02", [["Ann McLane Kuster", 48_630]], 48_630],
    ]);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.winner === null && row.identity === null && row.scoreEligible === false)).toBe(true);
  });
  it("rejects coherent lifecycle escalation", () => {
    const value = structuredClone(buildNewHampshirePrimaryResultsV2()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateNewHampshirePrimaryResultsV2(value)).toThrow("NEW_HAMPSHIRE_RESULTS_V2_INVALID");
  });
});
