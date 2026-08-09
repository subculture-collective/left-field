import { describe, expect, it } from "vitest";

import {
  buildSouthCarolinaPrimaryResultsV2,
  validateSouthCarolinaPrimaryResultsV2,
} from "./house-primary-south-carolina-results-v2";

describe("rapid South Carolina House-primary results v2", () => {
  it("retains the complete 2024 House event inventory without inventing a Democratic SC-06 contest", () => {
    const value = buildSouthCarolinaPrimaryResultsV2();
    expect(value.summary).toEqual({
      reportedContests: 1,
      sourceAbsentObservations: 1,
      eventInventoryContests: 9,
      democraticEventContests: 4,
      republicanEventContests: 5,
      candidateRows: 3,
      candidateVotes: 55_435,
      sourceMarkedWinnerContests: 1,
      scoreEligibleRows: 0,
    });
    expect(value.sourceAbsences).toEqual([
      expect.objectContaining({
        observationId: "sc:primary:2024:06:democratic",
        districtLabel: "SC-06",
        status: "source_absent_no_disposition_inference",
        sourceContestId: null,
        candidateCount: null,
        votes: null,
        winner: null,
        identity: null,
        scoreEligible: false,
      }),
    ]);
    expect(value.eventInventory.map((row) => [row.contestId, row.primaryParty, row.district])).toEqual([
      ["6898", "Democratic", "01"], ["6899", "Republican", "01"],
      ["6900", "Democratic", "02"], ["6901", "Republican", "02"],
      ["6902", "Democratic", "03"], ["6903", "Republican", "03"],
      ["6904", "Republican", "04"], ["6905", "Republican", "06"],
      ["6906", "Democratic", "07"],
    ]);
  }, 30_000);

  it("rejects lifecycle escalation", () => {
    const value = structuredClone(buildSouthCarolinaPrimaryResultsV2()) as unknown as Record<string, unknown>;
    (value.sourceAbsences as Record<string, unknown>[])[0]!.scoreEligible = true;
    expect(() => validateSouthCarolinaPrimaryResultsV2(value)).toThrow("SOUTH_CAROLINA_RESULTS_V2_INVALID");
  }, 30_000);
});
