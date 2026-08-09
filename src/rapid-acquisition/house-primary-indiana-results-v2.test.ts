import { describe, expect, it } from "vitest";

import {
  buildIndianaPrimaryResultsV2,
  validateIndianaPrimaryResultsV2,
} from "./house-primary-indiana-results-v2";

describe("Indiana rapid House-primary results v2", () => {
  it("adds the two certified 2026 target contests while keeping scores and identities unset", () => {
    const value = buildIndianaPrimaryResultsV2();
    expect(value.summary).toEqual({
      observations: 6,
      candidateRows: 15,
      candidateVotes: 268_396,
      sourceMarkedWinnerCandidates: 6,
      scoreEligibleRows: 0,
    });
    expect(value.results.filter((row) => row.cycleYear === 2026).map((row) => [
      row.districtLabel,
      row.sourceCandidateNames,
      row.candidateVotes,
      row.totalVotes,
      row.sourceWinnerNames,
    ])).toEqual([
      ["IN-01", ["Frank J. Mrvan", "LaVetta Sparks-Wade"], [42_519, 10_467], 52_986, ["Frank J. Mrvan"]],
      ["IN-07", ["André Carson", "Destiny Wells", "George Hornedo", "Denise Paul Hatch"], [44_849, 16_852, 7_517, 2_646], 71_864, ["André Carson"]],
    ]);
    expect(value.results.every((row) => row.winnerIdentity === null && row.identity === null && !row.scoreEligible)).toBe(true);
    expect(validateIndianaPrimaryResultsV2(value)).toEqual(value);
  });

  it("rejects a coherent score or identity escalation", () => {
    for (const [field, replacement] of [["scoreEligible", true], ["winnerIdentity", "fabricated"], ["identity", "fabricated"]] as const) {
      const value = structuredClone(buildIndianaPrimaryResultsV2()) as unknown as Record<string, unknown>;
      (value.results as Record<string, unknown>[])[4]![field] = replacement;
      value.packageSha256 = "0".repeat(64);
      expect(() => validateIndianaPrimaryResultsV2(value)).toThrow("INDIANA_RESULTS_V2_INVALID");
    }
  });
});
