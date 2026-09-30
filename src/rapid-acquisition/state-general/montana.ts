import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Montana Secretary of State, general election precinct-by-precinct
 * workbooks (one row per candidate per precinct). Races read "STATE
 * REPRESENTATIVE DISTRICT 70" and "STATE SENATOR DISTRICT 35"; the 2022 file
 * also has two "... UNEXPIRED TERM" Senate races. Column layouts differ by
 * year and are located by header. All 100 House districts are elected every
 * two years; Senate terms are four years, half each cycle, so 2022 supplies
 * the districts not on the 2024 ballot. Write-ins are not in these files.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "mt-2024-general-precinct-by-precinct-workbook", url: "https://sosmt.gov/docs/32/results/66992/2024_general_precinct_by_precinct", path: "data/source/rapid/state-general/mt/2024-general-precinct-by-precinct.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House and 25 Senate contests." },
  { id: "mt-2022-general-precinct-by-precinct-workbook", url: "https://sosmt.gov/docs/32/results/66993/2022_general_precinct_by_precinct", path: "data/source/rapid/state-general/mt/2022-general-precinct-by-precinct.xlsx", cycleYear: 2022, electionDate: "2022-11-08", note: "100 House (superseded by 2024) and 27 Senate contests, two for unexpired terms." },
];

const fail = (code: string): never => { throw new Error(`MONTANA_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, "Sheet1");
  const header = Array.from({ length: sheet.maxColumn }, (_value, index) => sheet.at(index + 1, 1));
  const find = (...names: string[]): number => { const index = header.findIndex((name) => names.includes(name)); return index >= 0 ? index + 1 : fail(`COLUMN_MISSING:${names.join("|")}`); };
  const raceCol = find("Race Name"), partyCol = find("Party"), votesCol = find("Votes"), lastCol = find("Last Name");
  const ballotCol = header.indexOf("Name On Ballot") + 1, firstCol = header.indexOf("First Name") + 1;
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number }> }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    const race = sheet.at(raceCol, row).replace(/\s+/g, " ").trim();
    const match = race.match(/^STATE (REPRESENTATIVE|SENATOR) DISTRICT (\d+)(?: UNEXPIRED TERM)?$/);
    if (!match) continue;
    const entry = contests.get(race) ?? { chamber: match[1] === "SENATOR" ? "upper" as const : "lower" as const, district: match[2]!, candidates: new Map() };
    const name = (ballotCol > 0 ? sheet.at(ballotCol, row) : `${firstCol > 0 ? sheet.at(firstCol, row) : ""} ${sheet.at(lastCol, row)}`).replace(/\s+/g, " ").trim();
    const rawParty = sheet.at(partyCol, row).trim();
    const candidate = entry.candidates.get(`${name}|${rawParty}`) ?? { name, rawParty, votes: 0 };
    candidate.votes += integer(sheet.at(votesCol, row));
    entry.candidates.set(`${name}|${rawParty}`, candidate);
    contests.set(race, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const MONTANA_GENERAL: StateGeneralAdapter = {
  stateCode: "MT",
  authority: "Montana Secretary of State, general election precinct results",
  sources: SOURCES,
  expectedContests: { "mt-2024-general-precinct-by-precinct-workbook": 125, "mt-2022-general-precinct-by-precinct-workbook": 127 },
  parse: (bytes) => parse(bytes),
};
