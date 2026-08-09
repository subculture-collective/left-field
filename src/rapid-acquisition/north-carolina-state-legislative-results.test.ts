import { describe, expect, it } from "vitest";
import { buildNorthCarolinaStateLegislativeResults, validateNorthCarolinaStateLegislativeResults } from "./north-carolina-state-legislative-results";

describe("North Carolina state-legislative primary results", () => {
  it("closes the three official precinct archives without winner or score inference", () => {
    const value = buildNorthCarolinaStateLegislativeResults();
    expect(value.summary).toEqual({ officeDistrictRows: 164, partyContests: 176, candidateRows: 404, precinctCandidateRows: 14848, candidateVotes: 1829202, formulaEligibleContests: 0 });
    expect(value.cycles).toEqual([
      { cycleYear: 2022, officeDistrictRows: 66, partyContests: 73, candidateRows: 170, precinctCandidateRows: 6806, candidateVotes: 739964 },
      { cycleYear: 2024, officeDistrictRows: 42, partyContests: 43, candidateRows: 102, precinctCandidateRows: 3270, candidateVotes: 488918 },
      { cycleYear: 2026, officeDistrictRows: 56, partyContests: 60, candidateRows: 132, precinctCandidateRows: 4772, candidateVotes: 600320 },
    ]);
    expect(value.contests.every((row) => row.formulaEligible === false && row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null)).toBe(true);
  });

  it("rejects coherent lifecycle mutation", () => {
    const value = structuredClone(buildNorthCarolinaStateLegislativeResults()) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateNorthCarolinaStateLegislativeResults(value)).toThrow("NORTH_CAROLINA_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
