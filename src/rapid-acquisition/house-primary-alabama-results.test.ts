import { describe, expect, it } from "vitest";
import { buildAlabamaPrimaryResults, validateAlabamaPrimaryResults } from "./house-primary-alabama-results";

describe("Alabama rapid House-primary results", () => {
  it("closes three regular contests, one source absence, and distinct runoff evidence", () => {
    const value = buildAlabamaPrimaryResults();
    expect(value.summary).toEqual({ reportedContests: 3, sourceAbsent: 1, regularCandidateRows: 15, regularCandidateVotes: 145878, runoffCandidateRows: 2, runoffCandidateVotes: 35968, scoreEligibleRows: 0 });
    expect(value.results.map((row) => [row.cycleYear, row.districtLabel, row.totalVotes])).toEqual([[2022, "AL-02", 24557], [2024, "AL-02", 57518], [2024, "AL-07", 63803]]);
    expect(value.sourceAbsent).toEqual([{ observationId: "al:primary:2022:07", sourceLockIds: ["al-2022-primary-precinct-results"], status: "source_absent_no_disposition_inference" }]);
    expect(value.runoffEvidence.totalVotes).toBe(35968);
    expect(value.results.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null && !row.scoreEligible)).toBe(true);
    expect(validateAlabamaPrimaryResults(value)).toEqual(value);
  }, 30000);
  it("rejects lifecycle escalation", () => { const value = structuredClone(buildAlabamaPrimaryResults()) as unknown as Record<string, unknown>; (value.results as Record<string, unknown>[])[0]!.scoreEligible = true; expect(() => validateAlabamaPrimaryResults(value)).toThrow("ALABAMA_RESULTS_INVALID"); }, 30000);
});
