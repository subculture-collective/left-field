import { describe, expect, it } from "vitest";

import {
  buildOhioStateLegislativeResults,
  validateOhioStateLegislativeResults,
} from "./ohio-state-legislative-results";

describe("Ohio Democratic state-legislative primary context", () => {
  it("closes the retained 2024 and 2026 official canvass workbooks", () => {
    const value = buildOhioStateLegislativeResults();
    expect(value.summary).toEqual({
      cycles: 2,
      reportedPartyContests: 221,
      stateSenateContests: 31,
      stateHouseContests: 190,
      candidateRows: 282,
      candidateVotes: 1_632_849,
      contestedContests: 42,
      namedWriteInCandidates: 17,
      republicanCyclesRetained: 0,
      formulaEligibleContests: 0,
    });
    expect(value.cycles).toEqual([
      {
        cycleYear: 2024,
        electionDate: "2024-03-19",
        reportedPartyContests: 108,
        candidateRows: 137,
        candidateVotes: 621_192,
        sourceCountyRows: 88,
      },
      {
        cycleYear: 2026,
        electionDate: "2026-05-05",
        reportedPartyContests: 113,
        candidateRows: 145,
        candidateVotes: 1_011_657,
        sourceCountyRows: 88,
      },
    ]);
  });

  it("keeps winner, identity, Republican coverage, and formula state unset", () => {
    const value = buildOhioStateLegislativeResults();
    expect(
      value.contests.every(
        (row) =>
          row.rawParty === "DEM" &&
          row.sourceWinnerStatus === "not_marked_by_source" &&
          row.currentHolderIdentity === null &&
          !row.formulaEligible,
      ),
    ).toBe(true);
    expect(value.limitations).toContain(
      "republican_summary_workbooks_not_retained",
    );
    expect(value.limitations).toContain(
      "ohio_2022_state_legislative_primary_workbooks_not_retained",
    );
  });

  it("rejects coherent lifecycle escalation", () => {
    const value = structuredClone(
      buildOhioStateLegislativeResults(),
    ) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateOhioStateLegislativeResults(value)).toThrow(
      "OHIO_STATE_LEGISLATIVE_RESULTS_INVALID",
    );
  });
});
