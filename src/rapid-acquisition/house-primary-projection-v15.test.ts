import { describe, expect, it } from "vitest";
import { buildHousePrimaryProjectionV15, validateHousePrimaryProjectionV15 } from "./house-primary-projection-v15";

describe("rapid House-primary projection v15",()=>{
  it("adds both NH 2022 contests without changing score eligibility",()=>{
    const value=buildHousePrimaryProjectionV15();
    expect(value.summary).toEqual({stateCycles:48,districtObservations:78,reportedContests:32,sourceAbsent:3,processedDistricts:35,candidateRows:81,retainedCandidateVotes:1_974_475,sourceMarkedWinnerContests:6,scoreEligibleDistricts:0});
    expect(value.observations.filter(row=>row.stateCode==="NH"&&row.cycleYear===2022)).toEqual([
      expect.objectContaining({observationId:"nh:primary:2022:01",parseStatus:"parsed",candidateCount:1,votes:41_990,sourceWinnerStatus:"not_marked_by_source",winner:null,identity:null,scoreEligible:false}),
      expect.objectContaining({observationId:"nh:primary:2022:02",parseStatus:"parsed",candidateCount:1,votes:48_630,sourceWinnerStatus:"not_marked_by_source",winner:null,identity:null,scoreEligible:false}),
    ]);
  },30_000);
  it("rejects lifecycle escalation",()=>{const value=structuredClone(buildHousePrimaryProjectionV15())as unknown as Record<string,unknown>;(value.observations as Record<string,unknown>[]).find(row=>row.observationId==="nh:primary:2022:01")!.scoreEligible=true;expect(()=>validateHousePrimaryProjectionV15(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V15_INVALID");},30_000);
});
