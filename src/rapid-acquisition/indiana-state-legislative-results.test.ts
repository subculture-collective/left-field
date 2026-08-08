import { describe, expect, it } from "vitest";

import { buildIndianaStateLegislativeResults, validateIndianaStateLegislativeResults } from "./indiana-state-legislative-results";

describe("rapid Indiana state-legislative primary corpus", () => {
  it("closes both chambers and preserves party-specific source winner markers", () => {
    const value = buildIndianaStateLegislativeResults();
    expect(value.summary).toEqual({ officeDistrictRows: 250, partyContests: 361, candidateRows: 486, candidateVotes: 1683754, sourceMarkedWinnerCandidates: 361, formulaEligibleContests: 0 });
    expect(value.contests.filter((row) => row.cycleYear === 2022 && row.chamber === "lower")).toHaveLength(140);
    expect(value.contests.filter((row) => row.cycleYear === 2024 && row.chamber === "lower")).toHaveLength(149);
    expect(value.contests.every((row) => row.candidates.filter((candidate) => candidate.sourceWinnerMarked).length === 1 && !row.formulaEligible)).toBe(true);
    expect(validateIndianaStateLegislativeResults(value)).toEqual(value);
  });
  it.each([["formulaEligible", true], ["totalVotes", 0], ["rawParty", "I"], ["certificationStatus", "certified"]])("rejects coherent %s mutation", (field, replacement) => { const value = structuredClone(buildIndianaStateLegislativeResults()) as unknown as Record<string, unknown>; (value.contests as Record<string, unknown>[])[0]![field] = replacement; value.packageSha256 = "0".repeat(64); expect(() => validateIndianaStateLegislativeResults(value)).toThrow("INDIANA_STATE_LEGISLATIVE_RESULTS_INVALID"); });
});
