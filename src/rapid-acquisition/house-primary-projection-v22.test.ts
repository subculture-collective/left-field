import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV22,
  buildHousePrimaryProjectionV22,
  validateHousePrimaryProjectionV22,
} from "./house-primary-projection-v22";

describe("rapid primary projection v22", () => {
  it("adds Tennessee 2026 while preserving the redistricting and score exclusions", () => {
    const value = buildHousePrimaryProjectionV22();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 40, sourceAbsent: 4, processedDistricts: 44, candidateRows: 105, retainedCandidateVotes: 2_522_590, sourceMarkedWinnerContests: 9, scoreEligibleDistricts: 0 });
    expect(value.observations.find((row) => row.observationId === "tn:primary:2026:09")).toMatchObject({ parseStatus: "parsed", candidateCount: 4, votes: 48_811, sourceWinnerStatus: "not_marked_by_source", scoreEligible: false, winner: null, identity: null });
    expect(buildHousePrimaryCoverageLedgerV22(value).rows.find((row) => row.stateCode === "TN" && row.cycleYear === 2026)).toMatchObject({ retainedArtifactCount: 1, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed", missingByReason: [] });
  }, 30_000);

  it("rejects a fabricated identity or score", () => {
    const value = structuredClone(buildHousePrimaryProjectionV22()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.observationId === "tn:primary:2026:09")!;
    row.scoreEligible = true;
    row.identity = "fabricated";
    expect(() => validateHousePrimaryProjectionV22(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V22_INVALID");
  }, 30_000);
});
