import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Delaware Department of Elections results as published on the state open
 * data portal (data.delaware.gov dataset 4hbv-7brf), filtered by election
 * name: one row per candidate with the district total. Offices read "State
 * Senator District 2" and "State Representative District 14". All 41 House
 * districts are elected every two years. After redistricting all 21 Senate
 * districts were elected in 2022, some for two-year terms; the ten elected
 * again in 2024 take their 2024 contest. Uncontested candidates are listed
 * with their votes; there are no write-in rows.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "de-2024-general-results-csv", url: "https://data.delaware.gov/resource/4hbv-7brf.csv?$limit=50000&electionname=2024%20General%20Election", path: "data/source/rapid/state-general/de/2024-general-results.csv", cycleYear: 2024, electionDate: "2024-11-05", note: "41 House and 10 Senate contests." },
  { id: "de-2022-general-results-csv", url: "https://data.delaware.gov/resource/4hbv-7brf.csv?$limit=50000&electionname=2022%20General%20Election", path: "data/source/rapid/state-general/de/2022-general-results.csv", cycleYear: 2022, electionDate: "2022-11-08", note: "41 House and 21 Senate contests; superseded by 2024 where re-elected." },
];

const fail = (code: string): never => { throw new Error(`DELAWARE_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value.trim()) ? Number(value.trim()) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8"));
  const header = table[0] ?? fail("EMPTY");
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const officeCol = column("office"), nameCol = column("candidatename"), partyCol = column("partyname"), votesCol = column("totalvotessum");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: { name: string; rawParty: string; votes: number }[] }>();
  for (const row of table.slice(1)) {
    const office = row[officeCol]!.trim();
    const match = office.match(/^State (Senator|Representative) District (\d+)$/);
    if (!match) continue;
    const entry = contests.get(office) ?? { chamber: match[1] === "Senator" ? "upper" as const : "lower" as const, district: match[2]!, candidates: [] };
    entry.candidates.push({ name: row[nameCol]!.trim(), rawParty: row[partyCol]!.trim(), votes: integer(row[votesCol]!) });
    contests.set(office, entry);
  }
  return [...contests.values()];
}

export const DELAWARE_GENERAL: StateGeneralAdapter = {
  stateCode: "DE",
  authority: "Delaware Department of Elections, results on the state open data portal",
  sources: SOURCES,
  expectedContests: { "de-2024-general-results-csv": 51, "de-2022-general-results-csv": 62 },
  parse: (bytes) => parse(bytes),
};
