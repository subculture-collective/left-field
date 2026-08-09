import { describe, expect, it } from "vitest";

import {
  buildSouthCarolinaPrimaryResultsV3,
  validateSouthCarolinaPrimaryResultsV3,
} from "./house-primary-south-carolina-results-v3";

describe("rapid South Carolina House-primary results v3", () => {
  it("adds the official 2026 SC-06 portal result without approving identity or score use", () => {
    const value = buildSouthCarolinaPrimaryResultsV3();
    expect(value.summary).toEqual({ reportedContests: 2, sourceAbsentObservations: 1, candidateRows: 5, candidateVotes: 138_991, sourceMarkedWinnerContests: 2, scoreEligibleRows: 0 });
    expect(value.results.at(-1)).toMatchObject({
      resultId: "sc:primary:2026:06:democratic",
      districtLabel: "SC-06",
      sourceCandidateNames: ["James E Jim Clyburn", "Frederick R Goodwin"],
      candidateVotes: [75_411, 8_145],
      totalVotes: 83_556,
      sourceWinnerCandidateName: "James E Jim Clyburn",
      sourceWinnerStatus: "marked_by_source",
      certificationStatus: "portal_current_results_no_final_upload_or_separate_certificate",
      winnerIdentity: null,
      identity: null,
      scoreEligible: false,
    });
  }, 30_000);

  it("rejects lifecycle or source-result mutation", () => {
    const value = structuredClone(buildSouthCarolinaPrimaryResultsV3()) as unknown as Record<string, unknown>;
    const row = (value.results as Record<string, unknown>[]).at(-1)!;
    row.scoreEligible = true;
    row.sourceWinnerCandidateName = "Frederick R Goodwin";
    expect(() => validateSouthCarolinaPrimaryResultsV3(value)).toThrow("SOUTH_CAROLINA_RESULTS_V3_INVALID");
  }, 30_000);
});
