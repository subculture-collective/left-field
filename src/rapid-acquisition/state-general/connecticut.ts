import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Connecticut Secretary of the State, Election History database export
 * (electionhistory.ct.gov, event 582, 2024 November general), one file per
 * office: State Senator (office 48) and State Representative (office 49).
 * Both chambers serve two-year terms.
 *
 * Rows are one per candidate per party line per division per vote channel,
 * and every result appears twice: at "City/Town" level and at "Polling Place"
 * level. Only City/Town rows are read, because polling-place rows omit
 * centrally counted ballots. Connecticut uses fusion voting, so a candidate's
 * votes are summed across party lines and attributed to the Democratic or
 * Republican line when present. "Write In" party rows are write-ins;
 * "Total Votes Cast", "Total Ballots Cast" and the ballot-question rows
 * (blank office) are dropped. In House districts 48 and 101 the published
 * "Total Votes Cast" differs from the candidate sum by 31 and 1 votes; the
 * margin uses the candidate sum.
 */
const searchUrl = (office: number): string =>
  `https://electionhistory.ct.gov/api/download_search.csv?search=${encodeURIComponent(JSON.stringify({ global: { events: [582] }, ballotQuestions: { text: "", types: [], number: "", divisions: [] }, contests: { candidates: [], divisions: [], offices: [{ id: office }] }, specialElectionsOnly: false, voterStats: false, stages: [] }))}`;

const SOURCES: readonly StateGeneralSource[] = [
  { id: "ct-2024-general-state-senator-csv", url: searchUrl(48), path: "data/source/rapid/state-general/ct/2024-general-state-senator.csv", cycleYear: 2024, electionDate: "2024-11-05", note: "36 Senate contests." },
  { id: "ct-2024-general-state-representative-csv", url: searchUrl(49), path: "data/source/rapid/state-general/ct/2024-general-state-representative.csv", cycleYear: 2024, electionDate: "2024-11-05", note: "151 House contests." },
];

const ACCOUNTING_ROWS = new Set(["Total Votes Cast", "Total Ballots Cast", "Yes", "No"]);
const fail = (code: string): never => { throw new Error(`CONNECTICUT_GENERAL_${code}`); };
const integer = (value: string): number => value === "" ? 0 : /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  const header = table[0] ?? fail("EMPTY");
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const officeCol = column("office_name"), districtCol = column("district_name"), divisionCol = column("division_type"), candidateIdCol = column("candidate_id"), nameCol = column("candidate_name"), partyCol = column("candidate_party_name"), votesCol = column("votes"), seatsCol = column("number_seats"), typeCol = column("election_type");
  type Candidate = { name: string; lines: Map<string, number> };
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; seats: number; candidates: Map<string, Candidate> }>();
  for (const row of table.slice(1)) {
    const office = row[officeCol]!;
    if (office === "") continue;
    if (row[typeCol] !== "General") fail(`ELECTION_TYPE:${row[typeCol]}`);
    if (row[divisionCol] !== "City/Town") continue;
    const name = row[nameCol]!;
    if (ACCOUNTING_ROWS.has(name)) continue;
    const chamber = office === "State Senator" ? "upper" as const : office === "State Representative" ? "lower" as const : fail(`OFFICE_UNKNOWN:${office}`);
    const district = row[districtCol]!;
    const key = `${chamber}|${district}`;
    const entry = contests.get(key) ?? { chamber, district, seats: integer(row[seatsCol]!), candidates: new Map<string, Candidate>() };
    const candidate = entry.candidates.get(row[candidateIdCol]!) ?? { name, lines: new Map<string, number>() };
    const line = row[partyCol]!.trim();
    candidate.lines.set(line, (candidate.lines.get(line) ?? 0) + integer(row[votesCol]!));
    entry.candidates.set(row[candidateIdCol]!, candidate);
    contests.set(key, entry);
  }
  return [...contests.values()].map((entry) => ({
    chamber: entry.chamber, district: entry.district, seats: entry.seats,
    candidates: [...entry.candidates.values()].map((candidate) => {
      const lines = [...candidate.lines.entries()].sort((left, right) => right[1] - left[1]);
      const votes = lines.reduce((sum, [, count]) => sum + count, 0);
      const writeIn = candidate.lines.has("Write In") && lines.every(([line]) => line === "Write In");
      const major = ["Democratic", "Republican"].filter((party) => candidate.lines.has(party)).sort((left, right) => (candidate.lines.get(right) ?? 0) - (candidate.lines.get(left) ?? 0));
      const rawParty = writeIn ? "" : major.length === 2 ? `${major[0]} (also ${major[1]} line)` : major[0] ?? lines[0]![0];
      return { name: candidate.name, rawParty, ...(major.length > 0 ? { party: major[0] as "Democratic" | "Republican" } : {}), votes, writeIn };
    }),
  }));
}

export const CONNECTICUT_GENERAL: StateGeneralAdapter = {
  stateCode: "CT",
  authority: "Connecticut Secretary of the State, Election History database",
  sources: SOURCES,
  expectedContests: { "ct-2024-general-state-senator-csv": 36, "ct-2024-general-state-representative-csv": 151 },
  parse: (bytes) => parse(bytes),
};
