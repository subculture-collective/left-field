import { describe, expect, it } from "vitest";
import { buildTennesseePrimaryResults, validateTennesseePrimaryResults } from "./house-primary-tennessee-results";

describe("rapid Tennessee House-primary results", () => {
  it("extracts TN-09 Democratic contests from the official precinct workbooks", () => {
    const value = buildTennesseePrimaryResults();
    expect(value.summary).toEqual({ reportedContests: 2, candidateRows: 7, candidateVotes: 111265, scoreEligibleRows: 0 });
    expect(value.results.map((row) => [row.cycleYear, row.precinctRows, row.sourceCandidateNames, row.candidateVotes, row.totalVotes])).toEqual([
      [2022, 125, ["M. Latroy Alexandria-Williams", "Steve Cohen", "Write-In - Ollie O. Nelson"], [8449, 62055, 2], 70506],
      [2024, 125, ["M Latroy A-Williams", "Steve Cohen", "Kasandra L Smith", "Corey Strong"], [1936, 30042, 1523, 7258], 40759],
    ]);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.identity === null && !row.scoreEligible)).toBe(true);
  }, 30000);

  it("rejects a coherently shaped lifecycle escalation", () => {
    const value = structuredClone(buildTennesseePrimaryResults()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateTennesseePrimaryResults(value)).toThrow("TENNESSEE_RESULTS_INVALID");
  }, 30000);
});
