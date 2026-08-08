import { describe, expect, it } from "vitest";

import { buildCountyCvapProjection, validateCountyCvapProjection } from "./county-cvap";

describe("county CVAP projection", () => {
  it("closes the official ACS county universe without enabling scoring", () => {
    const value = buildCountyCvapProjection();
    expect(value.summary).toEqual({ counties: 3222, cvapPresent: 3222, votingAgePresent: 3222, formulaEligibleRows: 0 });
    expect(value.rows.find((row) => row.countyFips === "01001")).toMatchObject({ citizenVotingAgePopulation: 45204, votingAgePopulation: 45917, formulaEligible: false });
    expect(validateCountyCvapProjection(value)).toEqual(value);
  });

  it("rejects a coherently shaped CVAP mutation", () => {
    const value = structuredClone(buildCountyCvapProjection()) as unknown as { rows: Array<{ citizenVotingAgePopulation: number }> };
    value.rows[0].citizenVotingAgePopulation += 1;
    expect(() => validateCountyCvapProjection(value)).toThrow("COUNTY_CVAP_PROJECTION_INVALID");
  });
});
