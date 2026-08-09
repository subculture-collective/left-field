import { describe, expect, it } from "vitest";

import { buildWisconsinPrimaryResults, validateWisconsinPrimaryResults } from "./house-primary-wisconsin-results";

describe("rapid Wisconsin House-primary results", () => {
  it("closes WI-02 and WI-04 for both completed cycles from official WEC canvasses", () => {
    const value = buildWisconsinPrimaryResults();
    expect(value.summary).toEqual({ reportedContests: 4, candidateRows: 8, candidateVotes: 415_288, scoreEligibleRows: 0 });
    expect(value.results.map((row) => [row.resultId, row.sourceCandidateNames, row.candidateVotes, row.totalVotes])).toEqual([
      ["wi:primary:2022:02:democratic", ["Mark Pocan", "SCATTERING"], [106_595, 198], 106_793],
      ["wi:primary:2022:04:democratic", ["Gwen Moore", "SCATTERING"], [72_845, 325], 73_170],
      ["wi:primary:2024:02:democratic", ["Mark Pocan", "SCATTERING"], [149_581, 316], 149_897],
      ["wi:primary:2024:04:democratic", ["Gwen S. Moore", "SCATTERING"], [85_017, 411], 85_428],
    ]);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null && row.identity === null && !row.scoreEligible)).toBe(true);
  });

  it("rejects coherent winner, identity, and score escalation", () => {
    const value = structuredClone(buildWisconsinPrimaryResults()) as unknown as Record<string, unknown>;
    const row = (value.results as Record<string, unknown>[])[0]!;
    row.sourceWinnerStatus = "marked_by_source";
    row.winnerIdentity = "Mark Pocan";
    row.identity = "Mark Pocan";
    row.scoreEligible = true;
    expect(() => validateWisconsinPrimaryResults(value)).toThrow("WISCONSIN_PRIMARY_RESULTS_INVALID");
  });
});
