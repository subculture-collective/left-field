import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV18,
  buildHousePrimaryProjectionV18,
  validateHousePrimaryProjectionV18,
} from "./house-primary-projection-v18";

describe("rapid primary projection v18", () => {
  it("adds the official 2026 MS-02 contest outside the score", () => {
    const value = buildHousePrimaryProjectionV18();
    expect(value.summary).toEqual({
      stateCycles: 48,
      districtObservations: 78,
      reportedContests: 36,
      sourceAbsent: 3,
      processedDistricts: 39,
      candidateRows: 93,
      retainedCandidateVotes: 2_265_373,
      sourceMarkedWinnerContests: 6,
      scoreEligibleDistricts: 0,
    });
    expect(value.observations.find((row) => row.observationId === "ms:primary:2026:02")).toMatchObject({
      parseStatus: "parsed",
      candidateCount: 3,
      votes: 74_500,
      sourceWinnerStatus: "not_marked_by_source",
      winner: null,
      identity: null,
      scoreEligible: false,
    });
    expect(buildHousePrimaryCoverageLedgerV18(value).rows.find((row) => row.stateCode === "MS" && row.cycleYear === 2026)).toMatchObject({
      parsedDistrictCount: 1,
      sourceAbsentDistrictCount: 0,
      status: "parsed",
    });
  }, 30_000);

  it("rejects score escalation", () => {
    const value = structuredClone(buildHousePrimaryProjectionV18()) as unknown as Record<string, unknown>;
    (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "ms:primary:2026:02")!.scoreEligible = true;
    expect(() => validateHousePrimaryProjectionV18(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V18_INVALID");
  }, 30_000);
});
