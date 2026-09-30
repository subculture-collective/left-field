import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Indiana Election Division, election night reporting archive,
 * "AllOfficeResults.csv". Each county reports at either precinct or locality
 * level, never both, so rows sum to district totals without double counting.
 * Offices read "State Representative, District 01" and "State Senator,
 * District 02". All 100 House districts are elected every two years; Senate
 * terms are four years, half the districts each cycle, so the 2022 file
 * supplies the other half. Write-in candidates are marked "(W/I)".
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "in-2024-general-all-office-results-csv", url: "https://enr.indianavoters.in.gov/archive/2024General/download/AllOfficeResults.csv", path: "data/source/rapid/state-general/in/2024-general-all-office-results.csv", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House and 25 Senate contests." },
  { id: "in-2022-general-all-office-results-csv", url: "https://enr.indianavoters.in.gov/archive/2022General/download/AllOfficeResults.csv", path: "data/source/rapid/state-general/in/2022-general-all-office-results.csv", cycleYear: 2022, electionDate: "2022-11-08", note: "100 House (superseded by 2024) and 25 Senate contests." },
];

const fail = (code: string): never => { throw new Error(`INDIANA_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  const header = table[0] ?? fail("EMPTY");
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const officeCol = column("Office"), nameCol = column("NameonBallot"), partyCol = column("PoliticalParty"), votesCol = column("TotalVotes"), seatsCol = column("NumberofOfficeSeats");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; seats: number; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (const row of table.slice(1)) {
    const office = row[officeCol]!.trim();
    const match = office.match(/^State (Representative|Senator), District (\d+)$/);
    if (!match) continue;
    const entry = contests.get(office) ?? { chamber: match[1] === "Senator" ? "upper" as const : "lower" as const, district: String(Number(match[2])), seats: integer(row[seatsCol]!), candidates: new Map() };
    const raw = row[nameCol]!.replace(/\s+/g, " ").trim(), writeIn = /\(W\/I\)/i.test(raw);
    const candidate = entry.candidates.get(raw) ?? { name: raw.replace(/\s*\(W\/I\)\s*/i, "").trim(), rawParty: writeIn ? "" : row[partyCol]!.trim(), votes: 0, writeIn };
    candidate.votes += integer(row[votesCol]!);
    entry.candidates.set(raw, candidate);
    contests.set(office, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, seats: entry.seats, candidates: [...entry.candidates.values()] }));
}

export const INDIANA_GENERAL: StateGeneralAdapter = {
  stateCode: "IN",
  authority: "Indiana Election Division, election night reporting archive",
  sources: SOURCES,
  expectedContests: { "in-2024-general-all-office-results-csv": 125, "in-2022-general-all-office-results-csv": 125 },
  parse: (bytes) => parse(bytes),
};
