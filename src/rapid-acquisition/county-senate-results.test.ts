import { describe, expect, it } from "vitest";

import { buildCountySenateResultsProjection, validateCountySenateResultsProjection } from "./county-senate-results";

describe("rapid county Senate results", () => {
  it("retains exact-county official 2024 general-election TOTAL rows without deriving winners", () => {
    const value = buildCountySenateResultsProjection();

    expect(value.summary).toEqual({ selectedSourceRows: 8713, candidateRows: 8659, exactCountyCount: 1714, stateCount: 29, specialElectionRows: 186, writeInRows: 2274, zeroVoteRows: 1259, quarantined: { countyNameFipsConflict: 6, geographyVintageMismatch: 45, nonCounty: 3 }, formulaEligibleRows: 0, missingHouseCountyCoverage: true });
    expect(value.rows.find((row) => row.countyFips === "04001" && row.candidateName === "RUBEN GALLEGO")).toMatchObject({ stateCode: "AZ", countyName: "APACHE", candidateParty: "DEMOCRAT", votes: 19901, totalVotes: 31859, specialElection: false, writeIn: false, formulaEligible: false });
    expect(value.rows.find((row) => row.countyFips === "12001" && row.candidateName === "HOWARD KNEPPER")).toMatchObject({ votes: 0, writeIn: true, formulaEligible: false });
    expect(value.rows.every((row) => row.winnerIdentity === null && row.formulaEligible === false)).toBe(true);
    const lacledeRows = value.rows.filter((row) => row.countyFips === "29105");
    expect(lacledeRows).toHaveLength(6);
    expect(lacledeRows.every((row) => row.countyName === "LACLEDE")).toBe(true);
    expect(lacledeRows.some((row) => row.candidateName === "JOSH HAWLEY")).toBe(true);
    expect(validateCountySenateResultsProjection(value)).toEqual(value);
  });

  it.each([["formulaEligible", true], ["winnerIdentity", "invented"], ["countyFips", "00000"], ["votes", -1]])("rejects coherent %s mutation", (field, replacement) => {
    const value = structuredClone(buildCountySenateResultsProjection()) as unknown as Record<string, unknown>;
    (value.rows as Record<string, unknown>[])[0]![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateCountySenateResultsProjection(value)).toThrow("COUNTY_SENATE_RESULTS_PROJECTION_INVALID");
  });
});
