import { unzipSync } from "fflate";

import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Colorado Secretary of State, county-certified general election results on
 * the Clarity ENR system: a zipped summary.csv with one row per candidate and
 * the contest's statewide total. Contest names read "State Representative -
 * District 1 (Vote For 1)" and "State Senator - District 2 (Vote For 1)".
 *
 * All 65 House districts are elected every two years; Senate terms are four
 * years, so the 2022 file supplies the 17 Senate districts not on the 2024
 * ballot. Legislative contests carry no write-in rows; over- and under-votes
 * are contest-level columns and are not counted as votes cast for a
 * candidate. The file is Latin-1 encoded.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "co-2024-general-clarity-summary-zip", url: "https://results.enr.clarityelections.com/CO/122598/367167/reports/summary.zip", path: "data/source/rapid/state-general/co/2024-general-clarity-summary.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "65 House and 18 Senate contests." },
  { id: "co-2022-general-clarity-summary-zip", url: "https://results.enr.clarityelections.com/CO/115903/316199/reports/summary.zip", path: "data/source/rapid/state-general/co/2022-general-clarity-summary.zip", cycleYear: 2022, electionDate: "2022-11-08", note: "65 House contests (superseded by 2024) and 17 Senate contests." },
];

const fail = (code: string): never => { throw new Error(`COLORADO_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const csv = files["summary.csv"] ?? fail("SUMMARY_MISSING");
  const table = parseCsv(Buffer.from(csv).toString("latin1"));
  const header = table[0]!.map((cell) => cell.trim().toLowerCase());
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const contestCol = column("contest name"), nameCol = column("choice name"), partyCol = column("party name"), votesCol = column("total votes");
  const contests = new Map<string, RawGeneralContest & { candidates: { name: string; rawParty: string; votes: number }[] }>();
  for (const row of table.slice(1)) {
    const contest = row[contestCol]!;
    const match = contest.match(/^State (Representative|Senator) - District (\d+) \(Vote For (\d+)\)$/);
    if (!match) continue;
    const entry = contests.get(contest) ?? { chamber: match[1] === "Senator" ? "upper" as const : "lower" as const, district: match[2]!, seats: Number(match[3]), candidates: [] };
    entry.candidates.push({ name: row[nameCol]!.trim(), rawParty: row[partyCol]!.trim(), votes: integer(row[votesCol]!.trim()) });
    contests.set(contest, entry);
  }
  return [...contests.values()];
}

export const COLORADO_GENERAL: StateGeneralAdapter = {
  stateCode: "CO",
  authority: "Colorado Secretary of State, county-certified results (Clarity ENR)",
  sources: SOURCES,
  expectedContests: { "co-2024-general-clarity-summary-zip": 83, "co-2022-general-clarity-summary-zip": 82 },
  parse: (bytes) => parse(bytes),
};
