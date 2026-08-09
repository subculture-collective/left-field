import { describe, expect, it } from "vitest";
import { buildVermontPrimaryResults, validateVermontPrimaryResults } from "./house-primary-vermont-results";

describe("Vermont rapid House-primary results", () => {
  it("closes both completed at-large Democratic primary canvasses", () => {
    const value = buildVermontPrimaryResults();
    expect(value.summary).toEqual({ reportedContests: 2, candidateRows: 5, candidateVotes: 148407, sourceTotalVotesCounted: 154377, sourceMarkedWinnerContests: 1, scoreEligibleRows: 0 });
    expect(value.results.map((row) => [row.cycleYear, row.candidateVoteSum, row.sourceTotalVotesCounted, row.sourceWinnerStatus])).toEqual([[2022, 100769, 102408, "not_marked_by_source"], [2024, 47638, 51969, "marked_by_source"]]);
    expect(value.results.every((row) => row.winnerIdentity === null && row.identity === null && !row.scoreEligible)).toBe(true);
    expect(validateVermontPrimaryResults(value)).toEqual(value);
  });
  it("rejects lifecycle escalation", () => { const value = structuredClone(buildVermontPrimaryResults()) as unknown as Record<string, unknown>; (value.results as Record<string, unknown>[])[0]!.scoreEligible = true; expect(() => validateVermontPrimaryResults(value)).toThrow("VERMONT_RESULTS_INVALID"); });
});
