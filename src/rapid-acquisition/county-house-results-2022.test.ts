import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateCountyHouseResults2022Projection } from "./county-house-results-2022";

const stored = () => JSON.parse(readFileSync("data/metadata/rapid-county-house-results-2022-projection-v1.json", "utf8"));

describe("2022 county House research projection", () => {
  it("validates all 51 source archives and retains explicit coverage gaps", () => {
    const value = validateCountyHouseResults2022Projection(stored());
    expect(value.summary).toMatchObject({ archives: 51, formulaEligibleRows: 0, incompleteNationwideCoverage: true });
    expect(value.rows.every((row) => row.cycleYear === 2022 && row.authority === "research_fallback" && row.winnerIdentity === null && row.formulaEligible === false)).toBe(true);
  });

  it("rejects score activation and unknown row fields", () => {
    const activated = stored(); activated.rows[0].formulaEligible = true;
    expect(() => validateCountyHouseResults2022Projection(activated)).toThrow("COUNTY_HOUSE_2022_ROW_INVALID");
    const expanded = stored(); expanded.rows[0].fabricatedScore = null;
    expect(() => validateCountyHouseResults2022Projection(expanded)).toThrow("COUNTY_HOUSE_2022_ROW_INVALID");
  });
});
