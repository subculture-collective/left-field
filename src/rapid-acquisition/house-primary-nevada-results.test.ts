import { describe, expect, it } from "vitest";

import { buildNevadaPrimaryResults, validateNevadaPrimaryResults } from "./house-primary-nevada-results";

describe("rapid Nevada House-primary results", () => {
  it("closes six target observations from archived official statewide pages", () => {
    const value = buildNevadaPrimaryResults();
    expect(value.summary).toEqual({ targetObservations: 6, reportedContests: 4, sourceAbsent: 2, candidateRows: 8, candidateVotes: 159_263, scoreEligibleRows: 0 });
    expect(value.observations.map((row) => [row.cycleYear, row.districtLabel, row.observationStatus, row.sourceCandidateNames, row.candidateVotes, row.totalVotes])).toEqual([
      [2022, "NV-01", "reported_contest", ["TITUS, DINA", "VILELA, AMY"], [33_565, 8_482], 42_047],
      [2022, "NV-03", "reported_contest", ["HYNES, RANDELL \"RANDY\"", "LEE, SUSIE"], [4_265, 37_069], 41_334],
      [2022, "NV-04", "source_absent_complete_official_statewide_results_page", null, null, null],
      [2024, "NV-01", "source_absent_complete_official_statewide_results_page", null, null, null],
      [2024, "NV-03", "reported_contest", ["BRITTAIN, ROCKATHENA", "LEE, SUSIE"], [3_036, 33_901], 36_937],
      [2024, "NV-04", "reported_contest", ["HORSFORD, STEVEN", "SHULTZ, LEVY"], [34_861, 4_084], 38_945],
    ]);
  });

  it("rejects coherent source-absence, winner, identity, and score escalation", () => {
    const value = structuredClone(buildNevadaPrimaryResults()) as unknown as Record<string, unknown>;
    const absent = (value.observations as Record<string, unknown>[]).find((row) => row.observationStatus !== "reported_contest")!;
    Object.assign(absent, { observationStatus: "reported_contest", sourceCandidateNames: ["fabricated"], candidateVotes: [0], totalVotes: 0, sourceWinnerStatus: "not_marked_by_source", identity: "fabricated", winnerIdentity: "fabricated", scoreEligible: true });
    expect(() => validateNevadaPrimaryResults(value)).toThrow("NEVADA_PRIMARY_RESULTS_INVALID");
  });
});
