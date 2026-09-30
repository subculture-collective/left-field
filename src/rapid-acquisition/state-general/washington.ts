import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Washington Secretary of State, results export (results.vote.wa.gov),
 * legislative file: one statewide-total row per candidate. Each district
 * elects a State Senator and two State Representatives, Pos. 1 and Pos. 2,
 * as separate contests; the score layer matches a holder to their position
 * by name. Senate terms are four years (half the districts each cycle), so
 * the 2022 file supplies the Senate districts not on the 2024 ballot.
 *
 * Washington's top-two general records a party preference, e.g.
 * "(Prefers Democratic Party)"; the preference is mapped to a caucus family.
 * WRITE-IN rows are write-ins. Race names vary in case between years.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "wa-2024-general-legislative-csv",
    url: "https://results.vote.wa.gov/results/20241105/export/20241105_Legislative.csv",
    path: "data/source/rapid/state-general/wa/2024-general-legislative.csv",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "98 House position contests and 25 Senate contests.",
  },
  {
    id: "wa-2022-general-legislative-csv",
    url: "https://results.vote.wa.gov/results/20221108/export/20221108_Legislative.csv",
    path: "data/source/rapid/state-general/wa/2022-general-legislative.csv",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "98 House position contests (superseded by 2024) and 25 Senate contests.",
  },
];

const fail = (code: string): never => { throw new Error(`WASHINGTON_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

/** "(Prefers Democratic Party)" → "Democratic"; "(States No Party Preference)" → "No Party Preference". */
export const washingtonPreference = (value: string): string =>
  value.trim().replace(/^\((?:Prefers|States)\s+/i, "").replace(/\s+Party\)$/i, "").replace(/\)$/, "").trim();

function caucusOf(preference: string): "Democratic" | "Republican" | undefined {
  const key = preference.toLowerCase();
  if (key === "democratic" || key === "democrat") return "Democratic";
  if (key === "republican" || key === "gop") return "Republican";
  return undefined;
}

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  const header = table[0] ?? fail("EMPTY");
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const raceCol = column("Race"), nameCol = column("Candidate"), partyCol = column("Party"), votesCol = column("Votes");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; position?: string; candidates: { name: string; rawParty: string; party?: "Democratic" | "Republican" | "Independent" | "Other"; votes: number; writeIn: boolean }[] }>();
  for (const row of table.slice(1)) {
    const race = row[raceCol]!.toUpperCase().replace(/\s+/g, " ").trim();
    const match = race.match(/^LEGISLATIVE DISTRICT (\d+) - STATE (SENATOR|REPRESENTATIVE POS\. ([12]))$/);
    if (!match) fail(`RACE_UNRECOGNIZED:${row[raceCol]}`);
    const key = race;
    const entry = contests.get(key) ?? { chamber: match![2] === "SENATOR" ? "upper" as const : "lower" as const, district: match![1]!, ...(match![3] ? { position: match![3] } : {}), candidates: [] };
    const name = row[nameCol]!.trim(), writeIn = name.toUpperCase() === "WRITE-IN";
    const preference = writeIn ? "" : washingtonPreference(row[partyCol]!);
    const caucus = caucusOf(preference);
    entry.candidates.push({ name: writeIn ? "Write-In" : name, rawParty: preference, ...(caucus ? { party: caucus } : preference === "" || /^no party/i.test(preference) || /^independent$/i.test(preference) ? { party: "Independent" as const } : { party: "Other" as const }), votes: integer(row[votesCol]!), writeIn });
    contests.set(key, entry);
  }
  return [...contests.values()];
}

export const WASHINGTON_GENERAL: StateGeneralAdapter = {
  stateCode: "WA",
  authority: "Washington Secretary of State, general election results export",
  sources: SOURCES,
  expectedContests: { "wa-2024-general-legislative-csv": 123, "wa-2022-general-legislative-csv": 123 },
  parse: (bytes) => parse(bytes),
};
