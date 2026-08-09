import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDelawareStateLegislativeResults, validateDelawareStateLegislativeResults } from "./delaware-state-legislative-results";
describe("Delaware state-legislative primary results", () => {
  it("closes the reported 2022 and 2024 state-legislative contests", () => { const value = buildDelawareStateLegislativeResults(); expect(value.summary).toMatchObject({ reportedPartyContests: 25, candidateRows: 58, candidateVotes: 63570, inferredNoContestRows: 0, formulaEligibleContests: 0 }); expect(value.contests.every((row) => row.candidates.reduce((sum, candidate) => sum + candidate.totalVotes, 0) === row.totalVotes && row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null && !row.formulaEligible)).toBe(true); });
  it("reproduces the artifact and rejects promotion", () => { const stored = JSON.parse(readFileSync("data/metadata/rapid-delaware-state-legislative-primary-results-v1.json", "utf8")); expect(validateDelawareStateLegislativeResults(stored)).toEqual(buildDelawareStateLegislativeResults()); const changed = structuredClone(stored); changed.contests[0].formulaEligible = true; expect(() => validateDelawareStateLegislativeResults(changed)).toThrow("DELAWARE_STATE_LEGISLATIVE_RESULTS_INVALID"); });
});
