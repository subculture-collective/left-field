import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * New York State Board of Elections, Elections Database export (one row per
 * candidate per party line per county). Both chambers serve two-year terms,
 * so the 2024 general covers all 63 Senate and 150 Assembly districts.
 *
 * New York uses fusion voting: a candidate's votes are summed across every
 * party line, and the candidate is attributed to the Democratic or Republican
 * line when one is present. Three candidates ran on both major lines; each
 * is attributed to whichever of the two lines drew more votes, with the
 * other line kept in rawParty. "Scattering" is the write-in row; "Blank",
 * "Void" and "Total Votes" are ballot accounting rows and are dropped. The
 * export also contains the June primary and a February special, which are
 * skipped by election id.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "ny-2024-general-legislative-contests-csv",
    url: "https://ny.elstats.civera.com/api/download_search.csv?search=%7B%22global%22%3A%7B%22years%22%3A%7B%22from%22%3A2024%2C%22to%22%3A2024%7D%7D%2C%22ballotQuestions%22%3A%7B%22text%22%3A%22%22%2C%22types%22%3A%5B%5D%2C%22number%22%3A%22%22%2C%22divisions%22%3A%5B%5D%7D%2C%22contests%22%3A%7B%22candidates%22%3A%5B%5D%2C%22offices%22%3A%5B%7B%22id%22%3A5%7D%2C%7B%22id%22%3A14%7D%5D%2C%22divisions%22%3A%5B%5D%7D%2C%22voterStats%22%3Afalse%2C%22stages%22%3A%5B%5D%2C%22specialElectionsOnly%22%3Afalse%7D",
    path: "data/source/rapid/state-general/ny/2024-legislative-contests.csv",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "State Senator (office 5) and Member of Assembly (office 14) contests for 2024; general election id 161.",
  },
];

const GENERAL_ELECTION_ID = "161";
const ACCOUNTING_ROWS = new Set(["Blank", "Void", "Total Votes", "Blank Enrollment", "Yes", "No"]);

const fail = (code: string): never => { throw new Error(`NEW_YORK_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8"));
  const header = table[0] ?? fail("EMPTY");
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const electionCol = column("election_id"), officeCol = column("office_name"), districtCol = column("district_name"), contestCol = column("contest_id"), candidateIdCol = column("candidate_id"), nameCol = column("candidate_name"), partyCol = column("candidate_party_name"), votesCol = column("votes"), seatsCol = column("number_seats");
  type Candidate = { name: string; lines: Map<string, number>; writeIn: boolean };
  const contests = new Map<string, { chamber: "lower" | "upper"; district: string; seats: number; candidates: Map<string, Candidate> }>();
  for (const row of table.slice(1)) {
    if (row[electionCol] !== GENERAL_ELECTION_ID) continue;
    const name = row[nameCol]!;
    if (ACCOUNTING_ROWS.has(name)) continue;
    const office = row[officeCol]!;
    const chamber = office === "State Senator" ? "upper" as const : office === "Member of Assembly" ? "lower" as const : fail(`OFFICE_UNKNOWN:${office}`);
    const key = row[contestCol]!;
    const entry = contests.get(key) ?? { chamber, district: row[districtCol]!, seats: integer(row[seatsCol]!), candidates: new Map<string, Candidate>() };
    if (entry.chamber !== chamber || entry.district !== row[districtCol]) fail(`CONTEST_INCONSISTENT:${key}`);
    const writeIn = name === "Scattering";
    const candidate = entry.candidates.get(row[candidateIdCol]!) ?? { name, lines: new Map<string, number>(), writeIn };
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
      const major = ["Democratic", "Republican"].filter((party) => candidate.lines.has(party)).sort((left, right) => (candidate.lines.get(right) ?? 0) - (candidate.lines.get(left) ?? 0));
      const rawParty = candidate.writeIn ? "" : major.length === 2 ? `${major[0]} (also ${major[1]} line)` : major[0] ?? lines[0]![0];
      return { name: candidate.name, rawParty, party: major.length === 2 ? (major[0] as "Democratic" | "Republican") : undefined, votes, writeIn: candidate.writeIn };
    }),
  }));
}

export const NEW_YORK_GENERAL: StateGeneralAdapter = {
  stateCode: "NY",
  authority: "New York State Board of Elections, Elections Database",
  sources: SOURCES,
  expectedContests: { "ny-2024-general-legislative-contests-csv": 213 },
  parse: (bytes) => parse(bytes),
};
