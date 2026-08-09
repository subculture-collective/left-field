import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateCountyHouseResultsProjection } from "./county-house-results";

const stored = () => JSON.parse(readFileSync("data/metadata/rapid-county-house-results-projection-v1.json", "utf8"));

describe("county House research projection", () => {
  it("validates the compact 51-archive projection and explicit gaps", () => {
    const value = validateCountyHouseResultsProjection(stored());
    expect(value.summary).toMatchObject({ archives: 51, archivesWithStrictTotalRows: 41, archivesWithoutStrictTotalRows: 10, aggregateRows: 13076, stateCount: 40, formulaEligibleRows: 0 });
    expect(value.rows.every((row) => row.authority === "research_fallback" && row.winnerIdentity === null && row.formulaEligible === false)).toBe(true);
  });

  it("rejects score activation and unknown row fields", () => {
    const activated = stored(); activated.rows[0].formulaEligible = true;
    expect(() => validateCountyHouseResultsProjection(activated)).toThrow("COUNTY_HOUSE_ROW_INVALID");
    const expanded = stored(); expanded.rows[0].fabricatedScore = null;
    expect(() => validateCountyHouseResultsProjection(expanded)).toThrow("COUNTY_HOUSE_ROW_INVALID");
  });
});
