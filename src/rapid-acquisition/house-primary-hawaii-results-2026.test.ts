import { describe, expect, it } from "vitest";

import {
  buildHawaiiPrimaryResults2026,
  validateHawaiiPrimaryResults2026,
} from "./house-primary-hawaii-results-2026";

describe("Hawaii 2026 House primary results", () => {
  it("closes both official statewide Democratic House result observations without inference", () => {
    const value = buildHawaiiPrimaryResults2026();

    expect(value.summary).toEqual({
      reportedContests: 2,
      candidateRows: 9,
      candidateVotes: 185_586,
      scoreEligibleRows: 0,
    });
    expect(value.results.map((row) => [
      row.districtLabel,
      row.sourceCandidateNames,
      row.candidateVotes,
      row.totalVotes,
      row.totalPrecincts,
      row.countedPrecincts,
    ])).toEqual([
      ["HI-01", ["CASE, Ed", "KEOHOKALOLE, Jarrett K.", "BOOKER, Jennifer", "KISWANTO, Nicholas (Nick)", "FATULA, Ben"], [58_853, 35_371, 2_158, 859, 837], 98_078, 223, 1],
      ["HI-02", ["TOKUDA, Jill N.", "KING, Steven", "GUITHUES, Greg", "BASIN, Kirill"], [80_133, 3_434, 2_621, 1_320], 87_508, 273, 0],
    ]);
    expect(value.results.every((row) =>
      row.sourceWinnerStatus === "not_marked_by_source"
      && row.certificationStatus === "official_report_snapshot_no_certification_claim"
      && row.winnerIdentity === null
      && row.identity === null
      && row.scoreEligible === false
    )).toBe(true);
    expect(validateHawaiiPrimaryResults2026(value)).toEqual(value);
  });
});
