import { describe, expect, it } from "vitest";

import { buildHousePrimaryCoverageLedgerV7, buildHousePrimaryProjectionV7, validateHousePrimaryProjectionV7 } from "./house-primary-projection-v7";

describe("rapid House-primary Indiana composition", () => {
  it("advances exactly the four retained 2022 and 2024 Indiana target contests", () => {
    const value = buildHousePrimaryProjectionV7();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 19, sourceAbsent: 1, processedDistricts: 20, candidateRows: 43, retainedCandidateVotes: 1215518, sourceMarkedWinnerContests: 4, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.parseStatus === "parsed")).toHaveLength(19);
    expect(value.observations.filter((row) => row.stateCode === "IN" && row.parseStatus === "parsed")).toEqual([
      expect.objectContaining({ observationId: "in:primary:2022:01", candidateCount: 2, votes: 39902, sourceWinnerStatus: "marked_by_source" }),
      expect.objectContaining({ observationId: "in:primary:2022:07", candidateCount: 3, votes: 38598, sourceWinnerStatus: "marked_by_source" }),
      expect.objectContaining({ observationId: "in:primary:2024:01", candidateCount: 1, votes: 31155, sourceWinnerStatus: "marked_by_source" }),
      expect.objectContaining({ observationId: "in:primary:2024:07", candidateCount: 3, votes: 33891, sourceWinnerStatus: "marked_by_source" }),
    ]);
    expect(value.observations.filter((row) => row.stateCode === "IN" && row.cycleYear === 2026).every((row) => row.parseStatus === "source_blocked" && row.votes === null)).toBe(true);
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV7(value).rows).toHaveLength(48);
    expect(validateHousePrimaryProjectionV7(value)).toEqual(value);
  });

  it.each([["scoreEligible", true], ["winner", "Frank J. Mrvan"], ["identity", "incumbent"], ["sourceWinnerStatus", "not_marked_by_source"], ["votes", 0], ["resultAuthorityStatus", "certified"]])("rejects coherent %s escalation or alteration", (field, replacement) => {
    const value = structuredClone(buildHousePrimaryProjectionV7()) as unknown as Record<string, unknown>;
    (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "in:primary:2022:01")![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateHousePrimaryProjectionV7(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V7_INVALID");
  });
});
