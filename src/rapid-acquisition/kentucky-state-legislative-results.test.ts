import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildKentuckyStateLegislativeResults, validateKentuckyStateLegislativeResults } from "./kentucky-state-legislative-results";

describe("Kentucky state-legislative primary results", () => {
  it("closes every reported Democratic and Republican legislative table", () => {
    const value = buildKentuckyStateLegislativeResults();
    expect(value.summary).toEqual({ cycles: 3, reportedPartyContests: 134, upperChamberContests: 25, lowerChamberContests: 109, democraticContests: 43, republicanContests: 91, candidateRows: 298, candidateVotes: 689016, formulaEligibleContests: 0 });
    expect(value.contests.every((row) => row.totalVotes === row.candidates.reduce((sum, candidate) => sum + candidate.votes, 0) && row.winnerIdentity === null && !row.formulaEligible)).toBe(true);
  });
  it("reproduces the artifact and rejects promotion", () => {
    const stored = JSON.parse(readFileSync("data/metadata/rapid-kentucky-state-legislative-primary-results-v1.json", "utf8"));
    expect(validateKentuckyStateLegislativeResults(stored)).toEqual(buildKentuckyStateLegislativeResults());
    const changed = structuredClone(stored); changed.contests[0].formulaEligible = true;
    expect(() => validateKentuckyStateLegislativeResults(changed)).toThrow("KENTUCKY_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
