import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Idaho Secretary of State, 2024 general election raw race results by
 * precinct (sheet raw_races). Legislative rows have RaceType "Legislative".
 * Each district elects a State Senator and two House members in separate
 * seats, "State Representative District 1 Seat A" and "Seat B"; the Open
 * States roster labels those seats "1A" and "1B", so the seat letter joins
 * the district label. Both chambers serve two-year terms. Named write-ins
 * read "Name (Write-In)"; "Overvotes" and "Undervotes" rows are dropped.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "id-2024-general-raw-races-workbook", url: "https://archive.sos.idaho.gov/elections/data/results/2024/raw_races_general.xlsx", path: "data/source/rapid/state-general/id/2024-general-raw-races.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "70 House seat contests and 35 Senate contests." },
];

const fail = (code: string): never => { throw new Error(`IDAHO_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, "raw_races");
  const header = Array.from({ length: sheet.maxColumn }, (_value, index) => sheet.at(index + 1, 1));
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index + 1 : fail(`COLUMN_MISSING:${name}`); };
  const typeCol = column("RaceType"), raceCol = column("Race"), partyCol = column("Party"), nameCol = column("Candidate"), votesCol = column("Votes");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    if (sheet.at(typeCol, row) !== "Legislative") continue;
    const race = sheet.at(raceCol, row).replace(/\s+/g, " ").trim();
    const match = race.match(/^State (Senator|Representative) District (\d+)(?: Seat ([AB]))?$/);
    if (!match) fail(`RACE_UNRECOGNIZED:${race}`);
    const raw = sheet.at(nameCol, row).replace(/\s+/g, " ").trim();
    if (raw === "Overvotes" || raw === "Undervotes") continue;
    const chamber = match![1] === "Senator" ? "upper" as const : "lower" as const;
    if (chamber === "lower" && !match![3]) fail(`SEAT_MISSING:${race}`);
    const entry = contests.get(race) ?? { chamber, district: `${match![2]}${chamber === "lower" ? match![3] : ""}`, candidates: new Map() };
    const writeIn = /\(Write-In\)$/i.test(raw);
    const candidate = entry.candidates.get(raw) ?? { name: raw.replace(/\s*\(Write-In\)$/i, ""), rawParty: writeIn ? "" : sheet.at(partyCol, row), votes: 0, writeIn };
    candidate.votes += integer(sheet.at(votesCol, row));
    entry.candidates.set(raw, candidate);
    contests.set(race, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const IDAHO_GENERAL: StateGeneralAdapter = {
  stateCode: "ID",
  authority: "Idaho Secretary of State, 2024 general election raw results",
  sources: SOURCES,
  expectedContests: { "id-2024-general-raw-races-workbook": 105 },
  parse: (bytes) => parse(bytes),
};
