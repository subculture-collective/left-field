import { describe, expect, it } from "vitest";

import {
  buildMississippiPrimaryResultsV3,
  validateMississippiPrimaryResultsV3,
} from "./house-primary-mississippi-results-v3";

describe("Mississippi primary results v3", () => {
  it("adds the official 2026 MS-02 Democratic contest", () => {
    const value = buildMississippiPrimaryResultsV3();
    expect(value.summary).toEqual({
      observations: 3,
      candidateRows: 6,
      candidateVotes: 170_629,
      scoreEligibleRows: 0,
    });
    expect(value.results[2]).toMatchObject({
      resultId: "ms:primary:2026:02:democratic",
      sourceCandidateNames: [
        "Bennie G. Thompson",
        "Evan Littleton Turnage",
        "Pertis Herman Williams III",
      ],
      candidateVotes: [64_334, 9_249, 917],
      totalVotes: 74_500,
      sourceWinnerStatus: "not_marked_by_source",
      identity: null,
      scoreEligible: false,
    });
    expect(validateMississippiPrimaryResultsV3(value)).toEqual(value);
  });
});
