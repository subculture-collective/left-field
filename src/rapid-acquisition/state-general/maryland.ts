import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Maryland State Board of Elections, 2022 general election "legislative
 * breakdown" file. Rows whose County is 00 ("State of Maryland") are
 * statewide candidate rows, with that candidate's votes spread across one
 * column per legislative district; a candidate's total is the row sum.
 *
 * Both chambers were elected in 2022 on four-year terms. Senate districts
 * elect one member; House of Delegates districts elect one, two or three,
 * so a House contest's seat count is the number of named winners the Board
 * marks. District labels are zero-padded in the file ("01A") and not in the
 * roster ("1A"). Each district has one aggregated "Other Write-Ins" row.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "md-2022-general-legislative-breakdown-csv",
    url: "https://elections.maryland.gov/elections/archive/2022/election_data/GG22_LegislativeBreakDown.csv",
    path: "data/source/rapid/state-general/md/2022-general-legislative-breakdown.csv",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "47 Senate and 71 House of Delegates contests (141 delegate seats).",
  },
];

const fail = (code: string): never => { throw new Error(`MARYLAND_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim().replace(/,/g, ""); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };
const unpad = (value: string): string => value.trim().replace(/^0+(?=\d)/, "");

function parse(bytes: Buffer): RawGeneralContest[] {
  const table = parseCsv(bytes.toString("utf8").replace(/^﻿/, ""));
  const header = table[0]!.map((cell) => cell.trim());
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const countyCol = column("County"), officeCol = column("Office Name"), districtCol = column("Office District"), nameCol = column("Candidate Name"), partyCol = column("Party"), winnerCol = column("Winner"), writeInCol = column("Write-In?");
  // One column per geographic piece: whole districts ("3") and House subdistricts ("1A"); a Senate district spans its subdistricts.
  const districtColumns = header.map((name, index) => [name.replace(/^Legislative District /, ""), index] as const).filter(([, index]) => header[index]!.startsWith("Legislative District "));
  if (districtColumns.length === 0) fail("DISTRICT_COLUMNS_MISSING");
  const belongs = (piece: string, chamber: "upper" | "lower", district: string): boolean => chamber === "lower" ? piece === district : piece.replace(/[A-C]$/, "") === district;
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; winners: number; candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[] }>();
  for (const row of table.slice(1)) {
    if (row[countyCol]!.trim() !== "00") continue;
    const office = row[officeCol]!.trim();
    if (office !== "State Senator" && office !== "House of Delegates") continue;
    const chamber = office === "State Senator" ? "upper" as const : "lower" as const;
    const district = unpad(row[districtCol]!);
    const key = `${chamber}|${district}`;
    const entry = contests.get(key) ?? { chamber, district, winners: 0, candidates: [] };
    const writeIn = row[writeInCol]!.trim() === "Y";
    let votes = 0;
    for (const [piece, index] of districtColumns) {
      const value = integer(row[index] ?? "");
      if (value > 0 && !belongs(piece, chamber, district)) fail(`VOTES_OUTSIDE_DISTRICT:${chamber}:${district}:${piece}`);
      votes += value;
    }
    entry.candidates.push({ name: row[nameCol]!.trim(), rawParty: row[partyCol]!.trim(), votes, writeIn });
    if (!writeIn && row[winnerCol]!.trim() === "Y") entry.winners += 1;
    contests.set(key, entry);
  }
  return [...contests.values()].map(({ winners, ...entry }) => {
    if (winners < 1 || winners > 3 || (entry.chamber === "upper" && winners !== 1)) fail(`WINNERS_INVALID:${entry.chamber}:${entry.district}:${winners}`);
    return { ...entry, seats: winners };
  });
}

export const MARYLAND_GENERAL: StateGeneralAdapter = {
  stateCode: "MD",
  authority: "Maryland State Board of Elections, 2022 general election legislative breakdown",
  sources: SOURCES,
  expectedContests: { "md-2022-general-legislative-breakdown-csv": 118 },
  parse: (bytes) => parse(bytes),
};
