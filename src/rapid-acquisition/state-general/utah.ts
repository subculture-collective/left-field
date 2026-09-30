import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Utah Lieutenant Governor's Office, 2024 general election results API
 * (electionresults.utah.gov, Civera ballot items). Contests read "State House
 * 12", "State Senate 2 (Multi-County)" or "State Senate 12 (2 year term)",
 * with irregular trailing spaces. All 75 House districts were on the 2024
 * ballot, and 15 of the 29 Senate districts. The 14 Senate districts elected
 * in 2022 have no machine-readable official source (the 2022 canvass is a
 * scanned PDF), so those holders stay unscored with the reason.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "ut-2024-general-ballot-items-json", url: "https://electionresults.utah.gov/results/public/api/elections/utah/general11052024/ballot-items", path: "data/source/rapid/state-general/ut/2024-general-ballot-items.json", cycleYear: 2024, electionDate: "2024-11-05", note: "75 House and 15 Senate contests." },
];

type BallotItem = { name: { languageId: string; text: string }[]; voteTotal: number; summaryResults: { ballotOptions: { name: { languageId: string; text: string }[]; voteCount: number; party: { abbreviation: string } | null; isWriteIn: boolean }[] } };
const fail = (code: string): never => { throw new Error(`UTAH_GENERAL_${code}`); };
const english = (names: { languageId: string; text: string }[]): string => (names.find((name) => name.languageId === "en") ?? names[0] ?? fail("NAME_MISSING")).text;

function parse(bytes: Buffer): RawGeneralContest[] {
  const document = JSON.parse(bytes.toString("utf8")) as { data: BallotItem[]; totalRecordCount: number };
  if (document.data.length !== document.totalRecordCount) fail("PAGINATION_INCOMPLETE");
  return document.data.flatMap((item): RawGeneralContest[] => {
    const title = english(item.name).replace(/\s+/g, " ").trim();
    const match = title.match(/^State (House|Senate) (\d+)(?: \((?:Multi-County|2 year term)\))?$/);
    if (!match) return [];
    const candidates = item.summaryResults.ballotOptions.map((option) => ({ name: english(option.name).replace(/\s+/g, " ").trim(), rawParty: option.party?.abbreviation ?? "", votes: option.voteCount, writeIn: option.isWriteIn }));
    return [{ chamber: match[1] === "Senate" ? "upper" : "lower", district: match[2]!, candidates }];
  });
}

export const UTAH_GENERAL: StateGeneralAdapter = {
  stateCode: "UT",
  authority: "Utah Lieutenant Governor's Office, 2024 general election results",
  sources: SOURCES,
  expectedContests: { "ut-2024-general-ballot-items-json": 90 },
  parse: (bytes) => parse(bytes),
};
