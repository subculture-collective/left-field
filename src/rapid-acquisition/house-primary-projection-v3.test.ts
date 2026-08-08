import { describe, expect, it } from "vitest";

import { buildHousePrimaryCoverageLedgerV3, buildHousePrimaryProjectionV3, validateHousePrimaryProjectionV3 } from "./house-primary-projection-v3";

describe("rapid House-primary Kansas composition", () => {
  it("advances two Kansas observations without changing score eligibility", () => {
    const value = buildHousePrimaryProjectionV3();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 11, sourceAbsent: 1, processedDistricts: 12, candidateRows: 25, retainedCandidateVotes: 785530, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.parseStatus === "parsed")).toHaveLength(11);
    expect(value.observations.filter((row) => row.parseStatus === "source_absent")).toHaveLength(1);
    expect(value.observations.find((row) => row.observationId === "ks:primary:2022:03")).toMatchObject({ parseStatus: "parsed", candidateCount: 1, votes: 103945, resultAuthorityStatus: "official_precinct_workbook_retained_not_claimed_certified" });
    expect(value.observations.find((row) => row.observationId === "ks:primary:2024:03")).toMatchObject({ parseStatus: "parsed", candidateCount: 1, votes: 37837, resultAuthorityStatus: "official_precinct_workbook_retained_not_claimed_certified" });
    expect(value.coverageRows.find((row) => row.stateCode === "KS" && row.cycleYear === 2022)).toMatchObject({ parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed" });
    expect(value.coverageRows.reduce((sum, row) => sum + row.parsedDistrictCount, 0)).toBe(11);
    expect(value.coverageRows.reduce((sum, row) => sum + row.sourceAbsentDistrictCount, 0)).toBe(1);
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV3(value).rows).toHaveLength(48);
    expect(validateHousePrimaryProjectionV3(value)).toEqual(value);
  });

  it.each([["scoreEligible", true], ["winner", "fabricated"], ["votes", 0], ["resultAuthorityStatus", "certified"]])("rejects coherent %s escalation", (field, replacement) => {
    const value = structuredClone(buildHousePrimaryProjectionV3()) as unknown as Record<string, unknown>;
    (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "ks:primary:2022:03")![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateHousePrimaryProjectionV3(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V3_INVALID");
  });
});
