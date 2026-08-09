import { describe, expect, it } from "vitest";
import { buildSouthCarolinaPrimaryResults, validateSouthCarolinaPrimaryResults } from "./house-primary-south-carolina-results";

describe("rapid South Carolina House-primary results", () => {
  it("retains the official 2022 SC-06 Democratic contest", () => {
    const value = buildSouthCarolinaPrimaryResults();
    expect(value.summary).toEqual({ reportedContests: 1, candidateRows: 3, candidateVotes: 55435, sourceMarkedWinnerContests: 1, scoreEligibleRows: 0 });
    expect(value.results[0]).toMatchObject({ cycleYear: 2022, districtLabel: "SC-06", sourceCandidateNames: ["James E. Jim Clyburn", "Michael Addison", "Gregg Marcel Dixon"], candidateVotes: [48729, 4203, 2503], totalVotes: 55435, sourceWinnerStatus: "marked_by_source", sourceWinnerCandidateName: "James E. Jim Clyburn", identity: null, scoreEligible: false });
  });

  it("rejects a lifecycle escalation", () => {
    const value = structuredClone(buildSouthCarolinaPrimaryResults()) as unknown as Record<string, unknown>;
    (value.results as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateSouthCarolinaPrimaryResults(value)).toThrow("SOUTH_CAROLINA_RESULTS_INVALID");
  });
});
