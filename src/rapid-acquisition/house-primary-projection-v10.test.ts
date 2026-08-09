import { describe, expect, it } from "vitest";
import { buildHousePrimaryCoverageLedgerV10, buildHousePrimaryProjectionV10, validateHousePrimaryProjectionV10 } from "./house-primary-projection-v10";

describe("rapid House-primary projection v10", () => {
  it("adds both completed Tennessee TN-09 precinct-workbook observations", () => {
    const value = buildHousePrimaryProjectionV10();
    expect(value.summary).toEqual({ stateCycles:48,districtObservations:78,reportedContests:26,sourceAbsent:2,processedDistricts:28,candidateRows:70,retainedCandidateVotes:1621068,sourceMarkedWinnerContests:5,scoreEligibleDistricts:0 });
    expect(value.observations.filter((row) => row.stateCode === "TN").map((row) => [row.cycleYear,row.parseStatus,row.votes,row.candidateCount,row.sourceWinnerStatus])).toEqual([[2022,"parsed",70506,3,"not_marked_by_source"],[2024,"parsed",40759,4,"not_marked_by_source"],[2026,"source_blocked",null,null,null]]);
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV10(value).rows.filter((row) => row.stateCode === "TN").map((row) => [row.cycleYear,row.status,row.parsedDistrictCount])).toEqual([[2022,"parsed",1],[2024,"parsed",1],[2026,"source_blocked",0]]);
  }, 30000);

  it("rejects lifecycle escalation", () => {
    const value = structuredClone(buildHousePrimaryProjectionV10()) as unknown as Record<string, unknown>;
    (value.observations as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateHousePrimaryProjectionV10(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V10_INVALID");
  }, 30000);
});
