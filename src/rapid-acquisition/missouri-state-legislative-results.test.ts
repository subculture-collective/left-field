import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMissouriStateLegislativeResults, validateMissouriStateLegislativeResults } from "./missouri-state-legislative-results";

describe("Missouri state-legislative primary results", () => {
  it("closes every legislative district table and Democratic/Republican party contest", () => {
    const value = buildMissouriStateLegislativeResults();
    expect(value.summary).toEqual({ cycles: 2, districtTables: 360, partyContests: 565, upperChamberContests: 59, lowerChamberContests: 506, democraticContests: 257, republicanContests: 308, candidateRows: 758, candidateVotes: 2700680, formulaEligibleContests: 0 });
    expect(value.contests.every((row) => row.candidates.reduce((sum, candidate) => sum + candidate.votes, 0) === row.totalVotes && row.sourceWinnerStatus === "not_marked_by_source" && !row.formulaEligible)).toBe(true);
  });
  it("reproduces the artifact and rejects promotion", () => {
    const stored = JSON.parse(readFileSync("data/metadata/rapid-missouri-state-legislative-primary-results-v1.json", "utf8"));
    expect(validateMissouriStateLegislativeResults(stored)).toEqual(buildMissouriStateLegislativeResults());
    const changed = structuredClone(stored); changed.contests[0].formulaEligible = true;
    expect(() => validateMissouriStateLegislativeResults(changed)).toThrow("MISSOURI_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
