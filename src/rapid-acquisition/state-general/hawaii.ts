import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Hawaii Office of Elections, 2024 general election summary (UTF-16 CSV after
 * a "Format#1" line). Contests read "State Senator, Dist 3" and "State
 * Representative, Dist 12"; candidate names carry the party in parentheses
 * ("(D) KANUHA, Dru Mamo").
 *
 * Only contested general-election races appear: a seat settled in the
 * primary has no general row. Those seats stay unscored rather than borrowing
 * an older contest, so the 2022 file is not read (Senate terms are staggered,
 * and an older contest could stand in for a newer race decided in the
 * primary).
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "hi-2024-general-summary-txt", url: "https://files.hawaii.gov/elections/files/results/2024/General/summary.txt", path: "data/source/rapid/state-general/hi/2024-general-summary.txt", cycleYear: 2024, electionDate: "2024-11-05", note: "35 contested House and 8 contested Senate races." },
];

const fail = (code: string): never => { throw new Error(`HAWAII_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value.trim()) ? Number(value.trim()) : fail(`INTEGER_INVALID:${value}`);
/** "(D) KANUHA, Dru Mamo" becomes ["Dru Mamo Kanuha", "D"]. */
function candidate(value: string): [string, string] {
  const match = value.trim().match(/^\(([A-Z]+)\)\s*(.*)$/);
  const party = match?.[1] ?? "", rest = (match?.[2] ?? value).trim();
  const [last, first] = rest.split(",").map((part) => part.trim());
  const title = (text: string): string => text.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
  return [first ? `${first} ${title(last!)}` : rest, party];
}

function parse(bytes: Buffer): RawGeneralContest[] {
  const text = bytes.toString("utf16le").replace(/^﻿/, "");
  const table = parseCsv(text.split(/\r?\n/).slice(1).join("\n"));
  const header = (table[0] ?? fail("EMPTY")).map((cell) => cell.replace(/^#/, "").trim());
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const titleCol = column("Contest Title"), nameCol = column("Candidate Name"), votesCol = column("Total Votes");
  const contests = new Map<string, RawGeneralContest & { candidates: { name: string; rawParty: string; votes: number }[] }>();
  for (const row of table.slice(1)) {
    const title = (row[titleCol] ?? "").trim();
    const match = title.match(/^State (Senator|Representative), Dist (\d+)$/);
    if (!match) continue;
    const entry = contests.get(title) ?? { chamber: match[1] === "Senator" ? "upper" as const : "lower" as const, district: match[2]!, candidates: [] };
    const [name, rawParty] = candidate(row[nameCol]!);
    entry.candidates.push({ name, rawParty, votes: integer(row[votesCol]!) });
    contests.set(title, entry);
  }
  return [...contests.values()];
}

export const HAWAII_GENERAL: StateGeneralAdapter = {
  stateCode: "HI",
  authority: "Hawaii Office of Elections, 2024 general election summary",
  sources: SOURCES,
  expectedContests: { "hi-2024-general-summary-txt": 43 },
  parse: (bytes) => parse(bytes),
};
