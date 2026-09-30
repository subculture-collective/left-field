import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Arkansas Secretary of State, 2024 general election precinct-level results
 * workbook (one row per candidate per precinct). Contests read "State
 * Representative District 61" and "State Senate District 08"; party codes
 * appear as both DEM/REP and D/R. All 100 House districts and 18 of the 35
 * Senate districts were on the 2024 ballot. The 2022 Senate results exist
 * only through the vendor's results API, whose party codes are numeric with
 * no published key, so senators elected in 2022 stay unscored.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "ar-2024-general-precinct-results-workbook", url: "https://www.sos.arkansas.gov/uploads/elections/2024_General_Election_and_Nonpartisan_Judicial_Runoff_Election_Precinct_Level_Results.xlsx", path: "data/source/rapid/state-general/ar/2024-general-precinct-results.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House and 18 Senate contests." },
];

const fail = (code: string): never => { throw new Error(`ARKANSAS_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, "Sheet1");
  const header = Array.from({ length: sheet.maxColumn }, (_value, index) => sheet.at(index + 1, 1));
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index + 1 : fail(`COLUMN_MISSING:${name}`); };
  const contestCol = column("contest"), choiceCol = column("choice"), partyCol = column("party"), votesCol = column("total votes");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    const contest = sheet.at(contestCol, row).replace(/\s+/g, " ").trim();
    const match = contest.match(/^State (Representative|Senate) District (\d+)$/);
    if (!match) continue;
    const entry = contests.get(contest) ?? { chamber: match[1] === "Senate" ? "upper" as const : "lower" as const, district: String(Number(match[2])), candidates: new Map() };
    const name = sheet.at(choiceCol, row).replace(/\s+/g, " ").trim(), writeIn = /^write-?ins?$/i.test(name);
    const candidate = entry.candidates.get(name) ?? { name, rawParty: writeIn ? "" : sheet.at(partyCol, row).trim(), votes: 0, writeIn };
    candidate.votes += integer(sheet.at(votesCol, row));
    entry.candidates.set(name, candidate);
    contests.set(contest, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const ARKANSAS_GENERAL: StateGeneralAdapter = {
  stateCode: "AR",
  authority: "Arkansas Secretary of State, 2024 general election precinct results",
  sources: SOURCES,
  expectedContests: { "ar-2024-general-precinct-results-workbook": 118 },
  parse: (bytes) => parse(bytes),
};
