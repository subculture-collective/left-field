import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV12,
  buildHousePrimaryProjectionV12,
  validateHousePrimaryProjectionV12,
} from "./house-primary-projection-v12";

describe("rapid House-primary projection v12", () => {
  it("closes 2024 SC-06 as source absent without disposition inference", () => {
    const value = buildHousePrimaryProjectionV12();
    expect(value.summary).toEqual({
      stateCycles: 48,
      districtObservations: 78,
      reportedContests: 27,
      sourceAbsent: 3,
      processedDistricts: 30,
      candidateRows: 73,
      retainedCandidateVotes: 1_676_503,
      sourceMarkedWinnerContests: 6,
      scoreEligibleDistricts: 0,
    });
    expect(value.observations.filter((row) => row.stateCode === "SC").map((row) => [row.cycleYear,row.parseStatus,row.missingReason,row.votes,row.sourceContestId])).toEqual([
      [2022,"parsed",null,55_435,"sc:primary:2022:06:democratic"],
      [2024,"source_absent","source_absent_no_disposition_inference",null,null],
      [2026,"source_blocked","source_blocked",null,null],
    ]);
    expect(buildHousePrimaryCoverageLedgerV12(value).rows.filter((row) => row.stateCode === "SC").map((row) => [row.cycleYear,row.status,row.parsedDistrictCount,row.sourceAbsentDistrictCount])).toEqual([
      [2022,"parsed",1,0], [2024,"source_absent",0,1], [2026,"source_blocked",0,0],
    ]);
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
  }, 30_000);

  it("rejects a fabricated contest for the source-absent row", () => {
    const value = structuredClone(buildHousePrimaryProjectionV12()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.observationId === "sc:primary:2024:06")!;
    row.parseStatus = "parsed"; row.sourceContestId = "fabricated"; row.votes = 0;
    expect(() => validateHousePrimaryProjectionV12(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V12_INVALID");
  }, 30_000);
});
