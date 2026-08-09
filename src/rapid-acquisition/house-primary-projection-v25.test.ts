import { describe, expect, it } from "vitest";

import { buildHousePrimaryProjectionV25, validateHousePrimaryProjectionV25 } from "./house-primary-projection-v25";

describe("rapid House-primary projection v25", () => {
  it("adds four Nevada contests and two explicit source-absence observations", () => {
    const value = buildHousePrimaryProjectionV25();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 50, sourceAbsent: 6, processedDistricts: 56, candidateRows: 130, retainedCandidateVotes: 3_282_727, sourceMarkedWinnerContests: 9, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.stateCode === "NV").map((row) => [row.cycleYear, row.districtLabel, row.parseStatus, row.votes])).toEqual([
      [2022, "NV-01", "parsed", 42_047], [2022, "NV-03", "parsed", 41_334], [2022, "NV-04", "source_absent", null],
      [2024, "NV-01", "source_absent", null], [2024, "NV-03", "parsed", 36_937], [2024, "NV-04", "parsed", 38_945],
      [2026, "NV-01", "source_blocked", null], [2026, "NV-03", "source_blocked", null], [2026, "NV-04", "source_blocked", null],
    ]);
  }, 30_000);

  it("rejects a coherent absent-result and 2026-result fabrication", () => {
    const baseline = buildHousePrimaryProjectionV25();
    for (const predicate of [(row: Record<string, unknown>) => row.stateCode === "NV" && row.cycleYear === 2024 && row.districtLabel === "NV-01", (row: Record<string, unknown>) => row.stateCode === "NV" && row.cycleYear === 2026]) {
      const value = structuredClone(baseline) as unknown as Record<string, unknown>, row = (value.observations as Record<string, unknown>[]).find(predicate)!;
      Object.assign(row, { parseStatus: "parsed", missingReason: null, sourceLockIds: ["fabricated"], sourceContestId: "fabricated", candidateCount: 1, votes: 1, sourceWinnerStatus: "not_marked_by_source", resultAuthorityStatus: "archived_official_statewide_primary_results_page" });
      expect(() => validateHousePrimaryProjectionV25(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V25_INVALID");
    }
  }, 45_000);
});
