import { describe, expect, it } from "vitest";

import {
  buildKentuckyPrimaryResultsV3,
  validateKentuckyPrimaryResultsV3,
} from "./house-primary-kentucky-results-v3";

describe("Kentucky primary results v3", () => {
  it("adds 2026 KY-03 as source absent without a disposition inference", () => {
    const value = buildKentuckyPrimaryResultsV3();
    expect(value.summary).toEqual({
      reportedContests: 2,
      sourceAbsent: 1,
      candidateRows: 5,
      candidateVotes: 134_981,
      scoreEligibleRows: 0,
    });
    expect(value.sourceAbsent).toEqual([{
      observationId: "ky:primary:2026:03:democratic",
      cycleYear: 2026,
      electionDate: "2026-05-19",
      districtLabel: "KY-03",
      status: "source_absent_no_disposition_inference",
      sourceLockIds: [
        "ky-2026-primary-certification-vote-totals",
        "ky-2026-primary-certification-vote-totals-layout-text",
      ],
      sourceContestId: null,
      candidateCount: null,
      votes: null,
      sourceWinnerStatus: null,
      resultAuthorityStatus: null,
      winner: null,
      identity: null,
      scoreEligible: false,
      absenceSha256: expect.any(String),
    }]);
    expect(validateKentuckyPrimaryResultsV3(value)).toEqual(value);
  });
});
