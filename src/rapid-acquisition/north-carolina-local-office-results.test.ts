import { describe, expect, it } from "vitest";
import { buildNorthCarolinaLocalOfficeResults, validateNorthCarolinaLocalOfficeResults } from "./north-carolina-local-office-results";

describe("North Carolina local-office primary results", () => {
  it("catalogs seven office families across three official precinct archives", () => {
    const value = buildNorthCarolinaLocalOfficeResults();
    expect(value.summary).toEqual({ officeFamilies: 7, officeContests: 1095, democraticContests: 228, republicanContests: 546, nonpartisanContests: 321, candidateRows: 3758, precinctCandidateRows: 99614, blankChoiceRowsExcluded: 14, candidateVotes: 12273926, formulaEligibleContests: 0 });
    expect(value.cycles).toEqual([
      { cycleYear: 2022, officeContests: 505, candidateRows: 1709, precinctCandidateRows: 45616, blankChoiceRowsExcluded: 12, candidateVotes: 4754030 },
      { cycleYear: 2024, officeContests: 236, candidateRows: 851, precinctCandidateRows: 21365, blankChoiceRowsExcluded: 0, candidateVotes: 3400353 },
      { cycleYear: 2026, officeContests: 354, candidateRows: 1198, precinctCandidateRows: 32633, blankChoiceRowsExcluded: 2, candidateVotes: 4119543 },
    ]);
    expect(value.contests.every((row) => row.formulaEligible === false && row.sourceWinnerStatus === "not_marked_by_source" && row.currentHolderIdentity === null)).toBe(true);
    expect(value.contests.some((row) => /REFERENDUM|BOND|TAX|BEVERAGE ELECTION/.test(row.rawOfficeTitle))).toBe(false);
    expect(new Set(value.contests.map((row) => row.countyFips)).size).toBe(100);
  });

  it("preserves multi-seat and nonpartisan source semantics", () => {
    const value = buildNorthCarolinaLocalOfficeResults();
    expect(value.contests.some((row) => row.seats > 1)).toBe(true);
    expect(value.contests.filter((row) => row.rawParty === "NONPARTISAN")).toHaveLength(321);
    expect(value.contests.find((row) => row.rawOfficeTitle === "MOREHEAD CITY MAYOR")?.officeFamily).toBe("municipal_mayor");
  });

  it("rejects coherent lifecycle mutation", () => {
    const value = structuredClone(buildNorthCarolinaLocalOfficeResults()) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateNorthCarolinaLocalOfficeResults(value)).toThrow("NORTH_CAROLINA_LOCAL_OFFICE_RESULTS_INVALID");
  });
});
