import type { IntakeSpec, ParsedContest } from "../package";
import { readWorkbookSheet, workbookInteger } from "../workbook";

/**
 * Worked example: Ohio Secretary of State Democratic summary workbooks.
 *
 * This reproduces the contest set of the frozen `ohio-state-legislative-results`
 * module (221 contests, 282 candidate rows, 1,632,849 votes) in roughly a
 * tenth of the code, because source verification, summaries, hashing, and
 * validation come from the shared builder. Copy this file for the next state.
 */
const AUTHORITY_INDEX = "oh-election-results-files-index-20260806";

export const ohioStateLegislativeSpec: IntakeSpec = {
  id: "rapid-ohio-state-legislative-primary-results-v2",
  version: 2,
  state: "OH",
  label: "Ohio Democratic state-legislative primary context",
  scope:
    "Ohio 2024 and 2026 Democratic state House and Senate official-canvass contests",
  authority: "official_ohio_secretary_democratic_canvass_workbooks",
  limitations: [
    "republican_summary_workbooks_not_retained",
    "ohio_2022_state_legislative_primary_workbooks_not_retained",
    "source_plurality_does_not_create_winner_or_nomination_inference",
  ],
  sources: [
    {
      lockId: "oh-2024-march-primary-democratic-summary",
      cycleYear: 2024,
      electionDate: "2024-03-19",
      authorityLockIds: [AUTHORITY_INDEX],
      expect: { contests: 108, candidateRows: 137, candidateVotes: 621_192 },
    },
    {
      lockId: "oh-2026-may-primary-democratic-summary",
      cycleYear: 2026,
      electionDate: "2026-05-05",
      authorityLockIds: [AUTHORITY_INDEX],
      expect: { contests: 113, candidateRows: 145, candidateVotes: 1_011_657 },
    },
  ],
  expect: { contests: 221, candidateRows: 282, candidateVotes: 1_632_849 },
  parse(bytes, _source, { fail }) {
    const sheet = readWorkbookSheet(bytes, "Master");
    const totalRow = sheet.rowsWhereColumnEquals(1, "Total")[0] ?? fail("TOTAL_ROW_MISSING");
    const percentageRow =
      sheet.rowsWhereColumnEquals(1, "Percentage")[0] ?? fail("PERCENTAGE_ROW_MISSING");
    if (percentageRow <= totalRow) fail("TOTAL_ROWS_INVALID");
    const countyRows: number[] = [];
    for (let row = percentageRow + 1; row <= sheet.maxRow; row++)
      if (sheet.at(1, row)) countyRows.push(row);
    if (countyRows.length !== 88) fail("COUNTY_CLOSURE_INVALID");

    const grouped = new Map<
      string,
      { contest: Omit<ParsedContest, "candidates">; columns: number[] }
    >();
    for (let column = 1; column <= sheet.maxColumn; column++) {
      const title = sheet.at(column, 1);
      const match = title.match(/^State (Senator|Representative) - District (\d{1,3})$/);
      if (!match) continue;
      const office = match[1] === "Senator" ? "state_senate" : "state_house";
      const districtCode = match[2]!.padStart(3, "0");
      const key = `${office}:${districtCode}`;
      const group = grouped.get(key) ?? {
        contest: {
          officeLevel: "state_legislative",
          office,
          districtCode,
          jurisdiction: null,
          rawOfficeTitle: title,
          rawParty: "DEM",
          reconciliation: "candidate_totals_equal_sum_of_88_county_rows",
        },
        columns: [],
      };
      group.columns.push(column);
      grouped.set(key, group);
    }

    return [...grouped.values()].map(({ contest, columns }) => ({
      ...contest,
      candidates: columns.map((column) => {
        const rawCandidate = sheet.at(column, 2);
        if (!rawCandidate.endsWith(" (D)")) fail("PARTY_LABEL_INVALID");
        let sourceName = rawCandidate.slice(0, -4).trim();
        let candidacyKind: "named_candidate" | "named_write_in" = "named_candidate";
        if (/\s+\(WI\)\*?$/.test(sourceName)) {
          sourceName = sourceName.replace(/\s+\(WI\)\*?$/, "").trim();
          candidacyKind = "named_write_in";
        }
        if (!sourceName) fail("CANDIDATE_NAME_INVALID");
        const votes = workbookInteger(sheet.at(column, totalRow));
        const countySum = countyRows.reduce(
          (sum, row) => sum + workbookInteger(sheet.at(column, row), { blankAsZero: true }),
          0,
        );
        if (votes !== countySum) fail("VOTE_RECONCILIATION_INVALID");
        return { sourceName, candidacyKind, votes };
      }),
    }));
  },
};
