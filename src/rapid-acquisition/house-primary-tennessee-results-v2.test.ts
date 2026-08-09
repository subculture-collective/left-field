import { describe, expect, it } from "vitest";

import {
  buildTennesseePrimaryResultsV2,
  validateTennesseePrimaryResultsV2,
} from "./house-primary-tennessee-results-v2";

describe("rapid Tennessee House-primary results v2", () => {
  it("adds the 2026 TN-09 final-unofficial portal observation without identity or score claims", () => {
    const value = buildTennesseePrimaryResultsV2();
    expect(value.summary).toEqual({ reportedContests: 3, candidateRows: 11, candidateVotes: 160_076, scoreEligibleRows: 0 });
    expect(value.results.find((row) => row.cycleYear === 2026)).toMatchObject({
      resultId: "tn:primary:2026:09:democratic",
      electionDate: "2026-08-06",
      districtLabel: "TN-09",
      sourceCandidateNames: ["Justin J. Pearson", "London Lamar", "M. LaTroy A-Williams", "Jim Torino"],
      candidateVotes: [32_092, 11_870, 3_318, 1_531],
      totalVotes: 48_811,
      sourceWinnerStatus: "not_marked_by_source",
      resultAuthorityStatus: "official_state_enr_final_unofficial_result_snapshot_retained",
      certificationStatus: "final_unofficial_no_separate_certification_instrument_retained",
      winnerIdentity: null,
      identity: null,
      scoreEligible: false,
    });
  });

  it("rejects a coherently supplied lifecycle escalation", () => {
    const value = structuredClone(buildTennesseePrimaryResultsV2()) as unknown as Record<string, unknown>;
    const row = (value.results as Record<string, unknown>[]).find((item) => item.cycleYear === 2026)!;
    row.sourceWinnerStatus = "marked_by_source";
    row.winnerIdentity = "Justin J. Pearson";
    row.scoreEligible = true;
    expect(() => validateTennesseePrimaryResultsV2(value)).toThrow("TENNESSEE_RESULTS_V2_INVALID");
  });
});
