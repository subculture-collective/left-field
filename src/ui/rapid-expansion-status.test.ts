import { describe, expect, it } from "vitest";

import { loadRapidExpansionStatus } from "./rapid-expansion-status";

describe("rapid expansion status", () => {
  it("loads the active v0.4 projection and county-office pilot", async () => {
    const value = await loadRapidExpansionStatus();
    expect(value?.score.activeDistricts.map((row) => [row.districtLabel, row.previousScore, row.activeScore])).toEqual([["DE-AL", 39.3, 39.5], ["SD-AL", 0, 7.2], ["WY-AL", 6.6, 14.5]]);
    expect(value?.countyOffice).toMatchObject({ officeRows: 179, partyContests: 226, exactCountyOfficeRows: 163, formulaEligibleContests: 0 });
  });
});
