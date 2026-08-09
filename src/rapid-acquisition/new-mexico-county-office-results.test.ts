import { describe, expect, it } from "vitest";
import {
  buildNewMexicoCountyOfficeResults,
  validateNewMexicoCountyOfficeResults,
} from "./new-mexico-county-office-results";

describe("New Mexico county-office primary results", () => {
  it("closes six official county-office families across three cycles", () => {
    const value = buildNewMexicoCountyOfficeResults();
    expect(value.summary).toEqual({
      officeFamilies: 6,
      officeContests: 581,
      democraticContests: 271,
      republicanContests: 302,
      libertarianContests: 8,
      candidateRows: 926,
      candidateVotes: 1967348,
      quarantinedContests: 8,
      quarantinedObservationRows: 40,
      quarantinedVoteObservationSum: 31205,
      formulaEligibleContests: 0,
    });
    expect(value.cycles).toEqual([
      {
        cycleYear: 2022,
        sourceContests: 206,
        sourceObservationRows: 350,
        sourceVoteObservationSum: 644874,
        retainedContests: 201,
        retainedCandidateRows: 325,
        retainedCandidateVotes: 625250,
        quarantinedContests: 5,
        quarantinedObservationRows: 25,
        quarantinedVoteObservationSum: 19624,
      },
      {
        cycleYear: 2024,
        sourceContests: 173,
        sourceObservationRows: 254,
        sourceVoteObservationSum: 474778,
        retainedContests: 170,
        retainedCandidateRows: 239,
        retainedCandidateVotes: 463197,
        quarantinedContests: 3,
        quarantinedObservationRows: 15,
        quarantinedVoteObservationSum: 11581,
      },
      {
        cycleYear: 2026,
        sourceContests: 210,
        sourceObservationRows: 362,
        sourceVoteObservationSum: 878901,
        retainedContests: 210,
        retainedCandidateRows: 362,
        retainedCandidateVotes: 878901,
        quarantinedContests: 0,
        quarantinedObservationRows: 0,
        quarantinedVoteObservationSum: 0,
      },
    ]);
    expect(
      value.contests.every(
        (row) =>
          row.precinctReportingStatus === "all_source_precincts_reporting" &&
          row.sourceWinnerStatus === "not_marked_by_source" &&
          row.currentHolderIdentity === null &&
          !row.formulaEligible,
      ),
    ).toBe(true);
  });

  it("quarantines conflicting duplicate candidate projections instead of summing them", () => {
    const value = buildNewMexicoCountyOfficeResults();
    expect(value.quarantines).toHaveLength(8);
    expect(
      value.quarantines.every(
        (row) =>
          row.reason ===
            "duplicate_candidate_ids_with_conflicting_source_projection_semantics" &&
          row.duplicatedSourceCandidateIds.length > 0,
      ),
    ).toBe(true);
    expect(
      value.contests.every(
        (contest) =>
          new Set(
            contest.candidates.map((candidate) => candidate.sourceCandidateId),
          ).size === contest.candidates.length,
      ),
    ).toBe(true);
    expect(
      value.quarantines.map((row) => [row.cycleYear, row.sourceRaceId]),
    ).toEqual([
      [2022, "8239"],
      [2022, "8366"],
      [2022, "8244"],
      [2022, "8222"],
      [2022, "8291"],
      [2024, "9657"],
      [2024, "9552"],
      [2024, "9474"],
    ]);
  });

  it("preserves source party, county FIPS, and component-total boundaries", () => {
    const value = buildNewMexicoCountyOfficeResults();
    expect(new Set(value.contests.map((row) => row.countyFips)).size).toBe(33);
    expect(value.contests.filter((row) => row.rawParty === "LIB")).toHaveLength(
      8,
    );
    expect(
      value.contests
        .flatMap((row) => row.candidates)
        .every(
          (row) =>
            row.voteComponents === null ||
            row.voteComponents.absentee +
              row.voteComponents.electionDay +
              row.voteComponents.early ===
              row.votes,
        ),
    ).toBe(true);
  });

  it("rejects coherent score escalation", () => {
    const value = structuredClone(
      buildNewMexicoCountyOfficeResults(),
    ) as unknown as { contests: { formulaEligible: boolean }[] };
    value.contests[0]!.formulaEligible = true;
    expect(() => validateNewMexicoCountyOfficeResults(value)).toThrow(
      "NEW_MEXICO_COUNTY_OFFICE_RESULTS_INVALID",
    );
  });
});
