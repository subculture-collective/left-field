import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV21,
  buildHousePrimaryProjectionV21,
  validateHousePrimaryProjectionV21,
} from "./house-primary-projection-v21";

describe("rapid primary projection v21", () => {
  it("adds South Carolina 2026 while preserving all score exclusions", () => {
    const value = buildHousePrimaryProjectionV21();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 39, sourceAbsent: 4, processedDistricts: 43, candidateRows: 101, retainedCandidateVotes: 2_473_779, sourceMarkedWinnerContests: 9, scoreEligibleDistricts: 0 });
    expect(value.observations.find((row) => row.observationId === "sc:primary:2026:06")).toMatchObject({ parseStatus: "parsed", candidateCount: 2, votes: 83_556, sourceWinnerStatus: "marked_by_source", scoreEligible: false, winner: null, identity: null });
    expect(buildHousePrimaryCoverageLedgerV21(value).rows.find((row) => row.stateCode === "SC" && row.cycleYear === 2026)).toMatchObject({ retainedArtifactCount: 2, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed", missingByReason: [] });
  }, 30_000);

  it("rejects a fabricated winner identity or score", () => {
    const value = structuredClone(buildHousePrimaryProjectionV21()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.observationId === "sc:primary:2026:06")!;
    row.scoreEligible = true;
    row.winner = "fabricated";
    expect(() => validateHousePrimaryProjectionV21(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V21_INVALID");
  }, 30_000);
});
