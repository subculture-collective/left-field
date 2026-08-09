import { describe, expect, it } from "vitest";
import { buildHousePrimaryProjectionV16, validateHousePrimaryProjectionV16 } from "./house-primary-projection-v16";

describe("rapid House-primary projection v16", () => {
  it("adds both Missouri 2022 contests without changing score eligibility", () => {
    const value = buildHousePrimaryProjectionV16();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 34, sourceAbsent: 3, processedDistricts: 37, candidateRows: 88, retainedCandidateVotes: 2_139_039, sourceMarkedWinnerContests: 6, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.stateCode === "MO" && row.cycleYear === 2022)).toEqual([
      expect.objectContaining({ observationId: "mo:primary:2022:01", parseStatus: "parsed", candidateCount: 5, votes: 94_018, sourceWinnerStatus: "not_marked_by_source", winner: null, identity: null, scoreEligible: false }),
      expect.objectContaining({ observationId: "mo:primary:2022:05", parseStatus: "parsed", candidateCount: 2, votes: 70_546, sourceWinnerStatus: "not_marked_by_source", winner: null, identity: null, scoreEligible: false }),
    ]);
  }, 30_000);
  it("rejects lifecycle escalation", () => { const value = structuredClone(buildHousePrimaryProjectionV16()) as unknown as Record<string, unknown>; (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "mo:primary:2022:01")!.scoreEligible = true; expect(() => validateHousePrimaryProjectionV16(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V16_INVALID"); }, 30_000);
});
