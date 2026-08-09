import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildTennesseeStateLegislativeResults, validateTennesseeStateLegislativeResults } from "./tennessee-state-legislative-results";

describe("Tennessee state-legislative primary results", () => {
  it("closes both official precinct workbooks without inferring winners or score inputs", () => {
    const value = buildTennesseeStateLegislativeResults();
    expect(value.summary).toEqual({ officeDistrictRows: 231, partyContests: 462, sourceObservationRows: 571, candidateVotes: 1793535, precinctPartyRows: 12938, sourceNoCandidateQualifiedMarkers: 114, formulaEligibleContests: 0 });
    expect(value.contests).toHaveLength(462);
    expect(value.contests.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.winnerIdentity === null && row.formulaEligible === false)).toBe(true);
    expect(value.contests.filter((row) => row.sourceObservations.some((entry) => entry.entryKind === "source_no_candidate_qualified_marker"))).toHaveLength(114);
    expect(value.contests.find((row) => row.contestId === "tn:state-leg-primary:2022:upper:05:D")?.sourceObservations).toEqual([{ sourceName: "No Candidate Qualified", votes: 0, entryKind: "source_no_candidate_qualified_marker" }]);
    expect(value.contests.find((row) => row.contestId === "tn:state-leg-primary:2024:upper:24:R")?.sourceObservations.map((row) => [row.sourceName, row.votes])).toEqual([["Charles \"Charlie\" Cooper", 4156], ["John D. Stevens", 12488]]);
  });

  it("rebuilds the persisted projection and rejects semantic mutation", () => {
    const value = buildTennesseeStateLegislativeResults();
    expect(() => validateTennesseeStateLegislativeResults(value)).not.toThrow();
    const changed = structuredClone(value) as unknown as { contests: { formulaEligible: boolean }[] };
    changed.contests[0].formulaEligible = true;
    expect(() => validateTennesseeStateLegislativeResults(changed)).toThrow("TENNESSEE_STATE_LEGISLATIVE_RESULTS_INVALID");
  }, 30_000);

  it("is source-bound to the retained official workbooks", () => {
    const lock = JSON.parse(readFileSync("data/source-lock.json", "utf8")) as { entries: readonly { id: string }[] };
    expect(lock.entries.filter((entry) => ["tn-2022-primary-precinct-results", "tn-2024-primary-precinct-results"].includes(entry.id))).toHaveLength(2);
  });
});
