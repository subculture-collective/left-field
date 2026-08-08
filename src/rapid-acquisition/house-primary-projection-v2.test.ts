import { describe, expect, it } from "vitest";

import { buildHousePrimaryCoverageLedgerV2, buildHousePrimaryProjectionV2, validateHousePrimaryProjectionV2 } from "./house-primary-projection-v2";

describe("rapid House-primary parsed coverage composition", () => {
  it("advances exactly nine contests and one source absence without score use", () => {
    const value = buildHousePrimaryProjectionV2();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 9, sourceAbsent: 1, processedDistricts: 10, candidateRows: 23, contestVotes: 643748, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.parseStatus === "parsed")).toHaveLength(9);
    expect(value.observations.filter((row) => row.parseStatus === "source_absent")).toHaveLength(1);
    expect(value.observations.find((row) => row.observationId === "de:primary:2022:al")).toMatchObject({ parseStatus: "source_absent", votes: null, sourceContestId: null });
    expect(value.coverageRows.find((row) => row.stateCode === "DE" && row.cycleYear === 2022)).toMatchObject({ parsedDistrictCount: 0, sourceAbsentDistrictCount: 1, status: "source_absent" });
    expect(value.coverageRows.reduce((sum, row) => sum + row.parsedDistrictCount, 0)).toBe(9);
    expect(value.coverageRows.reduce((sum, row) => sum + row.sourceAbsentDistrictCount, 0)).toBe(1);
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV2(value).rows).toHaveLength(48);
    expect(validateHousePrimaryProjectionV2(value)).toEqual(value);
  });
  it.each([["scoreEligible", true], ["winner", "fabricated"], ["votes", 0]])("rejects coherent %s escalation", (field, replacement) => { const value = structuredClone(buildHousePrimaryProjectionV2()) as unknown as Record<string, unknown>; (value.observations as Record<string, unknown>[])[0]![field] = replacement; value.packageSha256 = "0".repeat(64); expect(() => validateHousePrimaryProjectionV2(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V2_INVALID"); });
});
