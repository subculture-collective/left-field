import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Pennsylvania Department of State, precinct election returns bulk file
 * (headerless comma-delimited, one row per candidate per precinct; field
 * order per the Department's transmittal readme). State Senate is office
 * code STS and State House STH; field 6 is the candidate district, field 10
 * the party code, field 11 the candidate number, field 16 the vote total.
 * District totals are the sum over precincts per candidate number.
 *
 * All 203 House districts are elected every two years; Senate terms are four
 * years, odd districts in 2024 and even districts in 2022. The bulk file has
 * no write-in or blank rows. A candidate who won both major primaries appears
 * once with party "D/R"; such candidates are resolved through the explicit
 * table below, and any cross-filed candidate not listed fails the build.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "pa-2024-general-precinct-returns-txt",
    url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt",
    path: "data/source/rapid/state-general/pa/2024-general-precinct-returns.txt",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "203 House and 25 odd-numbered Senate contests, precinct level.",
  },
  {
    id: "pa-2022-general-precinct-returns-txt",
    url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/ElectionReturns_2022_General_PrecinctReturns.txt",
    path: "data/source/rapid/state-general/pa/2022-general-precinct-returns.txt",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "25 even-numbered Senate and 203 House contests; the House contests are superseded by 2024.",
  },
];

/** Cross-filed (D/R) candidates, keyed by the Department's candidate number, with the caucus the Open States roster records. */
const CROSS_FILED: Readonly<Record<string, "Democratic" | "Republican">> = {
  "2024C0131": "Democratic", // Joseph McAndrew, House District 32
};

const F = { office: 8, district: 5, party: 9, number: 10, last: 11, first: 12, middle: 13, suffix: 14, votes: 15 } as const;
const fail = (code: string): never => { throw new Error(`PENNSYLVANIA_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);
const title = (value: string): string => value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

function parse(bytes: Buffer): RawGeneralContest[] {
  type Candidate = { name: string; rawParty: string; party?: "Democratic" | "Republican"; votes: number };
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, Candidate> }>();
  for (const row of parseCsv(bytes.toString("latin1"))) {
    const office = row[F.office];
    if (office !== "STS" && office !== "STH") continue;
    const district = String(integer(row[F.district]!));
    const key = `${office}|${district}`;
    const entry = contests.get(key) ?? { chamber: office === "STS" ? "upper" as const : "lower" as const, district, candidates: new Map<string, Candidate>() };
    const number = row[F.number]!, rawParty = row[F.party]!;
    const name = [row[F.first], row[F.middle], row[F.last], row[F.suffix]].map((part) => title((part ?? "").trim())).filter(Boolean).join(" ");
    const candidate = entry.candidates.get(number) ?? { name, rawParty, votes: 0, ...(rawParty === "D/R" ? { party: CROSS_FILED[number] ?? fail(`CROSS_FILED_UNRESOLVED:${number}:${name}`) } : {}) };
    if (candidate.name !== name || candidate.rawParty !== rawParty) fail(`CANDIDATE_INCONSISTENT:${key}:${number}`);
    candidate.votes += integer(row[F.votes]!);
    entry.candidates.set(number, candidate);
    contests.set(key, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const PENNSYLVANIA_GENERAL: StateGeneralAdapter = {
  stateCode: "PA",
  authority: "Pennsylvania Department of State, precinct election returns",
  sources: SOURCES,
  // The 2022 file also holds all 203 House contests; the score layer keeps the latest per district.
  expectedContests: { "pa-2024-general-precinct-returns-txt": 228, "pa-2022-general-precinct-returns-txt": 228 },
  parse: (bytes) => parse(bytes),
};
