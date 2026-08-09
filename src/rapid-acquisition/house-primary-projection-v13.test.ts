import { describe, expect, it } from "vitest";

import { buildHousePrimaryProjectionV13, validateHousePrimaryProjectionV13 } from "./house-primary-projection-v13";

describe("rapid House-primary projection v13", () => {
  it("adds both 2024 New Hampshire contests and changes no score eligibility", () => {
    const value = buildHousePrimaryProjectionV13();
    expect(value.summary).toEqual({ stateCycles:48,districtObservations:78,reportedContests:29,sourceAbsent:3,processedDistricts:32,candidateRows:77,retainedCandidateVotes:1_801_515,sourceMarkedWinnerContests:6,scoreEligibleDistricts:0 });
    expect(value.observations.filter((row) => row.stateCode === "NH" && row.cycleYear === 2024)).toEqual([
      expect.objectContaining({ districtLabel:"NH-01",parseStatus:"parsed",candidateCount:2,votes:57_710,sourceWinnerStatus:"not_marked_by_source",winner:null,identity:null,scoreEligible:false }),
      expect.objectContaining({ districtLabel:"NH-02",parseStatus:"parsed",candidateCount:2,votes:67_302,sourceWinnerStatus:"not_marked_by_source",winner:null,identity:null,scoreEligible:false }),
    ]);
  },30_000);
  it("rejects lifecycle escalation", () => {
    const value=structuredClone(buildHousePrimaryProjectionV13()) as unknown as Record<string,unknown>;
    (value.observations as Record<string,unknown>[]).find(row=>row.observationId==="nh:primary:2024:01")!.scoreEligible=true;
    expect(()=>validateHousePrimaryProjectionV13(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V13_INVALID");
  },30_000);
});
