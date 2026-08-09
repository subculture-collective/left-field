import { describe, expect, it } from "vitest";

import { loadRapidExpansionStatus } from "./rapid-expansion-status";

describe("rapid expansion status", () => {
  it("loads the active v0.6 projection and county-office pilot", async () => {
    const value = await loadRapidExpansionStatus();
    expect(value?.score.activeDistricts.map((row) => [row.districtLabel, row.previousScore, row.activeScore, row.houseMinusPresidentPercentagePoints])).toEqual([["DE-AL", 39.7, 39.7, 1.23], ["SD-AL", 7.2, 6.3, -6.28], ["WY-AL", 13.6, 13.6, -2.86]]);
    expect(value?.countyOffice).toMatchObject({ officeRows: 179, partyContests: 226, exactCountyOfficeRows: 163, formulaEligibleContests: 0 });
  });
});
