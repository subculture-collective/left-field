import { describe, expect, it } from "vitest";

import { buildStructuredPrimaryResults, validateStructuredPrimaryResults } from "./house-primary-structured-results";

describe("structured rapid House-primary result families", () => {
  it("parses exact DE, HI, and RI target observations without winner or score inference", () => {
    const value = buildStructuredPrimaryResults();
    expect(value.summary).toEqual({ observations: 10, reportedContests: 9, sourceAbsent: 1, candidateRows: 23, contestVotes: 643748, scoreEligibleRows: 0 });
    expect(value.observations.find((row) => row.observationId === "de:structured-primary:2022:al")).toMatchObject({ status: "source_absent_no_disposition_inference", contestId: null });
    expect(value.contests.find((row) => row.contestId === "de:primary:2024:al:democratic")).toMatchObject({ totalVotes: 83607 });
    expect(value.contests.find((row) => row.contestId === "hi:primary:2022:02:democratic")).toMatchObject({ totalVotes: 108145, reportingPrecincts: 0 });
    expect(value.contests.find((row) => row.contestId === "ri:primary:2022:02:democratic")).toMatchObject({ totalVotes: 56102, totalPrecincts: 207, reportingPrecincts: 206 });
    expect(value.contests.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.candidates.every((candidate) => candidate.winnerStatus === "not_marked_by_source"))).toBe(true);
    expect(validateStructuredPrimaryResults(value)).toEqual(value);
  });

  it.each([["votes", 1], ["winner", "fabricated"], ["scoreEligible", true]])("rejects %s tampering", (field, replacement) => {
    const value = structuredClone(buildStructuredPrimaryResults()) as unknown as Record<string, unknown>;
    if (field === "scoreEligible") (value.observations as Record<string, unknown>[])[0]![field] = replacement;
    else (value.contests as Record<string, unknown>[])[0]![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateStructuredPrimaryResults(value)).toThrow("STRUCTURED_PRIMARY_RESULTS_INVALID");
  });
});
