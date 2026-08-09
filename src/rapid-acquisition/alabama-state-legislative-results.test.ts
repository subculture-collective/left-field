import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAlabamaStateLegislativeResults, validateAlabamaStateLegislativeResults } from "./alabama-state-legislative-results";

describe("Alabama state-legislative primary results", () => {
  it("closes the candidate-bearing 2022 official county-workbook corpus", () => {
    const value = buildAlabamaStateLegislativeResults();
    expect(value.summary).toEqual({ sourceCountyWorkbooks: 67, reportedPartyContests: 60, upperChamberContests: 14, lowerChamberContests: 46, democraticContests: 17, republicanContests: 43, candidateRows: 148, candidateVotes: 564383, countyWorkbookCandidateRows: 310, populatedVoteCells: 5516, inferredNoContestRows: 0, formulaEligibleContests: 0 });
    expect(value.contests.find((row) => row.contestId === "al:state-leg-primary:2022:upper:27:REP")?.candidates).toEqual([{ sourceName: "Jay Hovey", votes: 8373 }, { sourceName: "Tom Whatley", votes: 8372 }]);
    expect(value.contests.every((row) => row.candidates.length >= 2 && row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null && row.identity === null && !row.formulaEligible)).toBe(true);
  });

  it("reproduces the retained artifact and rejects semantic mutation", () => {
    const stored = JSON.parse(readFileSync("data/metadata/rapid-alabama-state-legislative-primary-results-v1.json", "utf8"));
    expect(validateAlabamaStateLegislativeResults(stored)).toEqual(buildAlabamaStateLegislativeResults());
    const altered = structuredClone(stored); altered.contests[0].winnerIdentity = "fabricated";
    expect(() => validateAlabamaStateLegislativeResults(altered)).toThrow("ALABAMA_STATE_LEGISLATIVE_RESULTS_INVALID");
  });
});
