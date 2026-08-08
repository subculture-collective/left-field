import { describe, expect, it } from "vitest";

import { buildCountyDemographicsProjection, validateCountyDemographicsProjection } from "./county-demographics";

describe("nationwide rapid county demographics", () => {
  it("closes the official 2020-2024 ACS and 2024 Gazetteer county universe", () => {
    const value = buildCountyDemographicsProjection();
    expect(value.rows).toHaveLength(3222);
    expect(value.summary).toMatchObject({ counties: 3222, populationPresent: 3222, densityPresent: 3222, formulaEligibleRows: 0 });
    expect(value.rows.find((row) => row.countyFips === "01001")).toMatchObject({ stateCode: "AL", countyName: "Autauga County", population: 59947, medianHouseholdIncome: 72481, formulaEligible: false });
    expect(value.rows.every((row) => row.renterShare === null || row.renterShare >= 0 && row.renterShare <= 1)).toBe(true);
    expect(value.rows.every((row) => row.age18To34Share === null || row.age18To34Share >= 0 && row.age18To34Share <= 1)).toBe(true);
    expect(validateCountyDemographicsProjection(value)).toEqual(value);
  });

  it.each([["formulaEligible", true], ["population", -1], ["countyFips", "00000"], ["medianHouseholdIncome", 1]])("rejects coherent %s mutation", (field, replacement) => {
    const value = structuredClone(buildCountyDemographicsProjection()) as unknown as Record<string, unknown>;
    (value.rows as Record<string, unknown>[])[0]![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateCountyDemographicsProjection(value)).toThrow("COUNTY_DEMOGRAPHICS_PROJECTION_INVALID");
  });
});
