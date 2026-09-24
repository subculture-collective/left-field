import { describe, expect, it } from "vitest";

import { buildIntakePackage } from "../package";
import { ohioStateLegislativeSpec } from "./ohio-state-legislative";

describe("Ohio state-legislative spec through the shared intake builder", () => {
  it("reproduces the frozen v1 catalog closure counts", () => {
    const value = buildIntakePackage(ohioStateLegislativeSpec);
    expect(value.summary).toMatchObject({
      cycles: 2,
      contests: 221,
      candidateRows: 282,
      candidateVotes: 1_632_849,
      contestedContests: 42,
      writeInCandidates: 17,
      contestsByOffice: { state_house: 190, state_senate: 31 },
      contestsByParty: { DEM: 221 },
      formulaEligibleContests: 0,
    });
    expect(value.cycles.map((cycle) => [cycle.cycleYear, cycle.contests, cycle.candidateRows, cycle.candidateVotes])).toEqual([
      [2024, 108, 137, 621_192],
      [2026, 113, 145, 1_011_657],
    ]);
    expect(value.contests[0]).toMatchObject({
      contestId: "oh:ohio-democratic-state-legislative-primary-context:2024:state_house:001:dem",
      sourceLockIds: ["oh-2024-march-primary-democratic-summary", "oh-election-results-files-index-20260806"],
      reconciliation: "candidate_totals_equal_sum_of_88_county_rows",
    });
  });
});
