import { describe,expect,it } from "vitest";
import { buildKentuckyPrimaryResultsV2,validateKentuckyPrimaryResultsV2 } from "./house-primary-kentucky-results-v2";
describe("rapid Kentucky House-primary results v2",()=>{
  it("adds the official 2022 KY-03 Democratic table",()=>{const value=buildKentuckyPrimaryResultsV2();expect(value.summary).toEqual({observations:2,candidateRows:5,candidateVotes:134_981,scoreEligibleRows:0});expect(value.results[0]).toEqual(expect.objectContaining({resultId:"ky:primary:2022:03:democratic",sourceCandidateNames:["Morgan McGARVEY","Attica SCOTT"],candidateVotes:[52_157,30_183],totalVotes:82_340,sourceWinnerStatus:"not_marked_by_source",identity:null,scoreEligible:false}));});
  it("rejects lifecycle escalation",()=>{const value=structuredClone(buildKentuckyPrimaryResultsV2()) as unknown as Record<string,unknown>;(value.results as Record<string,unknown>[])[0]!.scoreEligible=true;expect(()=>validateKentuckyPrimaryResultsV2(value)).toThrow("KENTUCKY_RESULTS_V2_INVALID");});
});
