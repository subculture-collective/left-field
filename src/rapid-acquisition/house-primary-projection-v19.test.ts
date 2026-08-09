import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV19,
  buildHousePrimaryProjectionV19,
  validateHousePrimaryProjectionV19,
} from "./house-primary-projection-v19";

describe("rapid primary projection v19", () => {
  it("adds Kentucky 2026 source absence without a disposition or score", () => {
    const value = buildHousePrimaryProjectionV19();
    expect(value.summary).toEqual({
      stateCycles: 48,
      districtObservations: 78,
      reportedContests: 36,
      sourceAbsent: 4,
      processedDistricts: 40,
      candidateRows: 93,
      retainedCandidateVotes: 2_265_373,
      sourceMarkedWinnerContests: 6,
      scoreEligibleDistricts: 0,
    });
    expect(value.observations.find((row) => row.observationId === "ky:primary:2026:03")).toMatchObject({
      parseStatus: "source_absent",
      missingReason: "source_absent_no_disposition_inference",
      sourceContestId: null,
      candidateCount: null,
      votes: null,
      sourceWinnerStatus: null,
      resultAuthorityStatus: null,
      winner: null,
      identity: null,
      scoreEligible: false,
    });
    expect(buildHousePrimaryCoverageLedgerV19(value).rows.find((row) => row.stateCode === "KY" && row.cycleYear === 2026)).toMatchObject({
      parsedDistrictCount: 0,
      sourceAbsentDistrictCount: 1,
      status: "source_absent",
      missingByReason: [{ reason: "source_absent_no_disposition_inference", count: 1 }],
    });
  }, 30_000);

  it("rejects a fabricated contest or score", () => {
    const value = structuredClone(buildHousePrimaryProjectionV19()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.observationId === "ky:primary:2026:03")!;
    row.parseStatus = "parsed";
    row.sourceContestId = "fabricated";
    row.votes = 0;
    row.scoreEligible = true;
    expect(() => validateHousePrimaryProjectionV19(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V19_INVALID");
  }, 30_000);
});
