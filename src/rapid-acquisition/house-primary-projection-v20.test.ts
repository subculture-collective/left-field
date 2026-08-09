import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV20,
  buildHousePrimaryProjectionV20,
  validateHousePrimaryProjectionV20,
} from "./house-primary-projection-v20";

describe("rapid primary projection v20", () => {
  it("adds both certified Indiana 2026 target contests without making them score eligible", () => {
    const value = buildHousePrimaryProjectionV20();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 38, sourceAbsent: 4, processedDistricts: 42, candidateRows: 99, retainedCandidateVotes: 2_390_223, sourceMarkedWinnerContests: 8, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.stateCode === "IN" && row.cycleYear === 2026).map((row) => [row.districtLabel, row.candidateCount, row.votes, row.sourceWinnerStatus, row.scoreEligible])).toEqual([
      ["IN-01", 2, 52_986, "marked_by_source", false],
      ["IN-07", 4, 71_864, "marked_by_source", false],
    ]);
    expect(buildHousePrimaryCoverageLedgerV20(value).rows.find((row) => row.stateCode === "IN" && row.cycleYear === 2026)).toMatchObject({ parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed", missingByReason: [] });
  }, 30_000);

  it("rejects a fabricated score or winner identity", () => {
    const value = structuredClone(buildHousePrimaryProjectionV20()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.observationId === "in:primary:2026:01")!;
    row.scoreEligible = true;
    row.winner = "fabricated";
    expect(() => validateHousePrimaryProjectionV20(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V20_INVALID");
  }, 30_000);
});
