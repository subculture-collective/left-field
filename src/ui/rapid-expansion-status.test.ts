import { describe, expect, it } from "vitest";

import { loadRapidExpansionStatus } from "./rapid-expansion-status";

describe("rapid expansion status", () => {
  it("loads the active v0.8 projection and county-office pilot", async () => {
    const value = await loadRapidExpansionStatus();
    expect(value?.score).toMatchObject({ version: "v0.8", directPrimaryActiveSeats: 21, unresolvedPrimaryRows: 1, unchangedSeats: 410 });
    expect(value?.score.activeDistricts.map((row) => [row.districtLabel, row.houseMinusPresidentPercentagePoints])).toEqual([["DE-AL", 1.23], ["ND-AL", -0.41], ["SD-AL", -6.28], ["WY-AL", -2.86]]);
    expect(value?.countyOffice).toMatchObject({ officeCategories: 12, officeRows: 682, partyContests: 816, sourceMarkedWinnerCandidates: 1049, formulaEligibleContests: 0 });
    expect(value?.northCarolinaLocalOffice).toMatchObject({ officeFamilies: 7, officeContests: 1095, democraticContests: 228, republicanContests: 546, nonpartisanContests: 321, candidateRows: 3758, formulaEligibleContests: 0 });
  });
});
