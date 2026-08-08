import { describe, expect, it } from "vitest";

import { buildIndianaCountyOfficeResults, validateIndianaCountyOfficeResults } from "./indiana-county-office-results";

describe("Indiana county commissioner primary results", () => {
  it("retains official party contests while keeping county offices catalog-only", () => {
    const value = buildIndianaCountyOfficeResults();
    expect(value.summary).toEqual({ officeRows: 179, partyContests: 226, candidateRows: 376, candidateVotes: 996853, sourceMarkedWinnerCandidates: 226, exactCountyOfficeRows: 163, unmappedOfficeRows: 16, exactCountyPartyContests: 206, formulaEligibleContests: 0 });
    expect(value.contests.every((row) => row.formulaEligibility === "catalog_only" && row.currentHolderIdentityStatus === "not_collected")).toBe(true);
    expect(value.contests.some((row) => row.countyJoinStatus === "unmapped_irregular_source_title" && row.countyFips === null)).toBe(true);
    expect(validateIndianaCountyOfficeResults(value)).toEqual(value);
  });

  it("rejects a county-office score or holder escalation", () => {
    const value = structuredClone(buildIndianaCountyOfficeResults()) as unknown as { contests: Array<{ formulaEligibility: string; currentHolderIdentityStatus: string }> };
    value.contests[0]!.formulaEligibility = "eligible";
    value.contests[0]!.currentHolderIdentityStatus = "linked";
    expect(() => validateIndianaCountyOfficeResults(value)).toThrow("INDIANA_COUNTY_OFFICE_RESULTS_INVALID");
  });
});
