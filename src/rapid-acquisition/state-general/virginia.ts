import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Virginia Department of Elections, election night reporting API
 * (enr.elections.virginia.gov, official results). The ballot-items document
 * lists every contest with district-level totals per ballot option, the
 * party abbreviation, and an explicit write-in flag.
 *
 * Both chambers were elected in November 2023; the House of Delegates again
 * in November 2025. The 2025 file supersedes the 2023 House contests; the
 * 2023 Senate contests stand until 2027.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "va-2023-general-ballot-items-json",
    url: "https://enr.elections.virginia.gov/results/public/api/elections/Virginia/2023-Nov-Gen/ballot-items",
    path: "data/source/rapid/state-general/va/2023-general-ballot-items.json",
    cycleYear: 2023,
    electionDate: "2023-11-07",
    note: "100 House of Delegates and 40 Senate contests.",
  },
  {
    id: "va-2025-general-ballot-items-json",
    url: "https://enr.elections.virginia.gov/results/public/api/elections/Virginia/2025-November-General/ballot-items",
    path: "data/source/rapid/state-general/va/2025-general-ballot-items.json",
    cycleYear: 2025,
    electionDate: "2025-11-04",
    note: "100 House of Delegates contests.",
  },
];

type BallotItem = {
  name: { languageId: string; text: string }[];
  voteTotal: number;
  summaryResults: { ballotOptions: { name: { languageId: string; text: string }[]; voteCount: number; party: { abbreviation: string } | null; isWriteIn: boolean }[] };
};

const fail = (code: string): never => { throw new Error(`VIRGINIA_GENERAL_${code}`); };
const english = (names: { languageId: string; text: string }[]): string => names.find((name) => name.languageId === "en")?.text ?? fail("NAME_MISSING");

function parse(bytes: Buffer): RawGeneralContest[] {
  const document = JSON.parse(bytes.toString("utf8")) as { data: BallotItem[]; totalRecordCount: number };
  if (!Array.isArray(document.data) || document.data.length !== document.totalRecordCount) fail("PAGINATION_INCOMPLETE");
  return document.data.flatMap((item): RawGeneralContest[] => {
    const title = english(item.name);
    const match = title.match(/^Member, (House of Delegates|Senate of Virginia) \((\d+)(?:st|nd|rd|th) District\)$/);
    if (!match) return [];
    const candidates = item.summaryResults.ballotOptions.map((option) => ({ name: english(option.name), rawParty: option.party?.abbreviation ?? "", votes: option.voteCount, writeIn: option.isWriteIn }));
    if (candidates.reduce((sum, candidate) => sum + candidate.votes, 0) !== item.voteTotal) fail(`TOTAL_MISMATCH:${title}`);
    return [{ chamber: match[1] === "House of Delegates" ? "lower" : "upper", district: match[2]!, candidates }];
  });
}

export const VIRGINIA_GENERAL: StateGeneralAdapter = {
  stateCode: "VA",
  authority: "Virginia Department of Elections, official election night reporting results",
  sources: SOURCES,
  expectedContests: { "va-2023-general-ballot-items-json": 140, "va-2025-general-ballot-items-json": 100 },
  parse: (bytes) => parse(bytes),
};
