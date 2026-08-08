import { describe, expect, it } from "vitest";

import { loadRapidExpansionStatus } from "./rapid-expansion-status";

describe("rapid expansion status", () => {
  it("loads the retained shadow and county-office pilot", async () => {
    const value = await loadRapidExpansionStatus();
    expect(value?.shadow.eligibleDistricts.map((row) => row.districtLabel)).toEqual(["DE-AL", "SD-AL", "WY-AL"]);
    expect(value?.countyOffice).toMatchObject({ officeRows: 179, partyContests: 226, exactCountyOfficeRows: 163, formulaEligibleContests: 0 });
  });
});
