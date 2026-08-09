import { describe, expect, it } from "vitest";

import {
  buildHousePrimaryCoverageLedgerV23,
  buildHousePrimaryProjectionV23,
  validateHousePrimaryProjectionV23,
} from "./house-primary-projection-v23";

describe("rapid House primary projection v23", () => {
  it("adds both Hawaii 2026 observations while preserving score exclusion", () => {
    const value = buildHousePrimaryProjectionV23();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 42, sourceAbsent: 4, processedDistricts: 46, candidateRows: 114, retainedCandidateVotes: 2_708_176, sourceMarkedWinnerContests: 9, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.stateCode === "HI" && row.cycleYear === 2026).map((row) => [row.districtLabel, row.parseStatus, row.candidateCount, row.votes, row.sourceWinnerStatus, row.scoreEligible])).toEqual([
      ["HI-01", "parsed", 5, 98_078, "not_marked_by_source", false],
      ["HI-02", "parsed", 4, 87_508, "not_marked_by_source", false],
    ]);
    expect(validateHousePrimaryProjectionV23(value)).toEqual(value);
    const ledger = buildHousePrimaryCoverageLedgerV23(value);
    expect(ledger.rows.find((row) => row.stateCode === "HI" && row.cycleYear === 2026)).toMatchObject({ retainedArtifactCount: 1, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed", artifactLockIds: ["hi-2026-primary-summary"] });
  }, 30_000);
});
