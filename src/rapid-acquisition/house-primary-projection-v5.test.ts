import { describe, expect, it } from "vitest";
import { buildHousePrimaryCoverageLedgerV5, buildHousePrimaryProjectionV5, validateHousePrimaryProjectionV5 } from "./house-primary-projection-v5";

describe("rapid House-primary Missouri composition", () => {
  it("advances only the two Missouri 2024 target districts", () => {
    const value = buildHousePrimaryProjectionV5();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 14, sourceAbsent: 1, processedDistricts: 15, candidateRows: 33, retainedCandidateVotes: 1027677, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.parseStatus === "parsed")).toHaveLength(14);
    expect(value.observations.find((row) => row.observationId === "mo:primary:2024:01")).toMatchObject({ candidateCount: 4, votes: 124258, parseStatus: "parsed" });
    expect(value.observations.find((row) => row.observationId === "mo:primary:2024:05")).toMatchObject({ candidateCount: 1, votes: 65248, parseStatus: "parsed" });
    expect(value.observations.find((row) => row.observationId === "mo:primary:2022:01")).toMatchObject({ parseStatus: "source_blocked", votes: null });
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV5(value).rows).toHaveLength(48);
    expect(validateHousePrimaryProjectionV5(value)).toEqual(value);
  });
  it.each([["scoreEligible", true], ["winner", "fabricated"], ["votes", 0], ["resultAuthorityStatus", "certified"]])("rejects coherent %s escalation", (field, replacement) => { const value = structuredClone(buildHousePrimaryProjectionV5()) as unknown as Record<string, unknown>; (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "mo:primary:2024:01")![field] = replacement; value.packageSha256 = "0".repeat(64); expect(() => validateHousePrimaryProjectionV5(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V5_INVALID"); });
});
