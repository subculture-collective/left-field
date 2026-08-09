import { describe, expect, it } from "vitest";
import { buildNewMexicoCountyOfficeResults, validateNewMexicoCountyOfficeResults } from "./new-mexico-county-office-results";

describe("New Mexico county-office primary results", () => {
  it("closes six official county-office families across three cycles", () => {
    const value = buildNewMexicoCountyOfficeResults();
    expect(value.summary).toEqual({ officeFamilies: 6, officeContests: 589, democraticContests: 275, republicanContests: 306, libertarianContests: 8, candidateRows: 966, candidateVotes: 1998553, formulaEligibleContests: 0 });
    expect(value.cycles).toEqual([
      { cycleYear: 2022, officeContests: 206, candidateRows: 350, candidateVotes: 644874 },
      { cycleYear: 2024, officeContests: 173, candidateRows: 254, candidateVotes: 474778 },
      { cycleYear: 2026, officeContests: 210, candidateRows: 362, candidateVotes: 878901 },
    ]);
    expect(value.contests.every((row) => row.precinctReportingStatus === "all_source_precincts_reporting" && row.sourceWinnerStatus === "not_marked_by_source" && row.currentHolderIdentity === null && !row.formulaEligible)).toBe(true);
  });

  it("preserves source party, county FIPS, and component-total boundaries", () => {
    const value = buildNewMexicoCountyOfficeResults();
    expect(new Set(value.contests.map((row) => row.countyFips)).size).toBe(33);
    expect(value.contests.filter((row) => row.rawParty === "LIB")).toHaveLength(8);
    expect(value.contests.flatMap((row) => row.candidates).every((row) => row.voteComponents === null || row.voteComponents.absentee + row.voteComponents.electionDay + row.voteComponents.early === row.votes)).toBe(true);
  });

  it("rejects coherent score escalation", () => {
    const value = structuredClone(buildNewMexicoCountyOfficeResults()) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateNewMexicoCountyOfficeResults(value)).toThrow("NEW_MEXICO_COUNTY_OFFICE_RESULTS_INVALID");
  });
});
