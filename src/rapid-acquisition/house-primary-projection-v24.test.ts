import { describe, expect, it } from "vitest";

import { buildHousePrimaryProjectionV24, validateHousePrimaryProjectionV24 } from "./house-primary-projection-v24";

describe("rapid House-primary projection v24", () => {
  it("adds four Wisconsin canvass contests while retaining 2026 as future", () => {
    const value = buildHousePrimaryProjectionV24();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 46, sourceAbsent: 4, processedDistricts: 50, candidateRows: 122, retainedCandidateVotes: 3_123_464, sourceMarkedWinnerContests: 9, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.stateCode === "WI").map((row) => [row.cycleYear, row.districtLabel, row.parseStatus, row.votes])).toEqual([
      [2022, "WI-02", "parsed", 106_793], [2022, "WI-04", "parsed", 73_170],
      [2024, "WI-02", "parsed", 149_897], [2024, "WI-04", "parsed", 85_428],
      [2026, "WI-02", "future_event", null], [2026, "WI-04", "future_event", null],
    ]);
  }, 30_000);

  it("rejects a coherent 2026 result fabrication", () => {
    const value = structuredClone(buildHousePrimaryProjectionV24()) as unknown as Record<string, unknown>;
    const row = (value.observations as Record<string, unknown>[]).find((item) => item.stateCode === "WI" && item.cycleYear === 2026)!;
    Object.assign(row, { parseStatus: "parsed", missingReason: null, sourceLockIds: ["wi-2024-primary-us-house-canvass"], sourceContestId: "fabricated", candidateCount: 1, votes: 1 });
    expect(() => validateHousePrimaryProjectionV24(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V24_INVALID");
  }, 30_000);
});
