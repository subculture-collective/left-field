import { describe, expect, it } from "vitest";

import { buildGeorgiaStateLegislativeResults, validateGeorgiaStateLegislativeResults } from "./georgia-state-legislative-results";

describe("Georgia state-legislative regular-primary results", () => {
  it("closes all three official statewide workbooks without score or winner inference", () => {
    const value = buildGeorgiaStateLegislativeResults();
    expect(value.summary).toEqual({ officeDistrictRows: 708, partyContests: 1090, candidateRows: 1469, candidateVotes: 8351342, formulaEligibleContests: 0 });
    expect(value.cycles).toEqual([
      { cycleYear: 2022, officeDistrictRows: 236, partyContests: 350, candidateRows: 495, candidateVotes: 3049322 },
      { cycleYear: 2024, officeDistrictRows: 236, partyContests: 349, candidateRows: 446, candidateVotes: 1976442 },
      { cycleYear: 2026, officeDistrictRows: 236, partyContests: 391, candidateRows: 528, candidateVotes: 3325578 },
    ]);
    expect(value.contests.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.formulaEligible === false && row.winnerIdentity === null)).toBe(true);
    expect(value.contests.some((row) => row.rawOfficeTitle.startsWith("Special "))).toBe(false);
  });

  it("rejects coherent semantic mutation", () => {
    const value = structuredClone(buildGeorgiaStateLegislativeResults()) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateGeorgiaStateLegislativeResults(value)).toThrow("GEORGIA_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
