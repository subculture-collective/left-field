import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildHawaiiStateLegislativeResults, validateHawaiiStateLegislativeResults } from "./hawaii-state-legislative-results";

describe("Hawaii state-legislative primary results", () => {
  it("closes candidate-bearing Democratic and Republican contests in both retained statewide summaries", () => {
    const value = buildHawaiiStateLegislativeResults();
    expect(value.summary).toEqual({ cycles: 2, reportedPartyContests: 243, upperChamberContests: 67, lowerChamberContests: 176, democraticContests: 136, republicanContests: 107, candidateRows: 352, candidateVotes: 807154, inferredNoContestRows: 0, formulaEligibleContests: 0 });
    expect(value.cycles).toEqual([
      { cycleYear: 2022, reportedPartyContests: 137, candidateRows: 205, candidateVotes: 511495 },
      { cycleYear: 2024, reportedPartyContests: 106, candidateRows: 147, candidateVotes: 295659 },
    ]);
    expect(value.contests.every((contest) => contest.candidates.reduce((sum, row) => sum + row.totalVotes, 0) === contest.totalVotes && contest.sourceWinnerStatus === "not_marked_by_source" && contest.winnerIdentity === null && !contest.formulaEligible)).toBe(true);
  });

  it("reproduces the retained artifact and rejects lifecycle promotion", () => {
    const stored = JSON.parse(readFileSync("data/metadata/rapid-hawaii-state-legislative-primary-results-v1.json", "utf8"));
    expect(validateHawaiiStateLegislativeResults(stored)).toEqual(buildHawaiiStateLegislativeResults());
    const changed = structuredClone(stored);
    changed.contests[0].formulaEligible = true;
    expect(() => validateHawaiiStateLegislativeResults(changed)).toThrow("HAWAII_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
