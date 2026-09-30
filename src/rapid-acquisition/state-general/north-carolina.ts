import { unzipSync } from "fflate";

import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * North Carolina State Board of Elections, 2024 general election precinct
 * results (zipped tab-delimited text). Rows are one per candidate per
 * precinct, including non-geographic "precincts" (absentee, provisional,
 * transfer, early-voting sites, Real Precinct = N), all of which belong in
 * the district total. Contest names read "NC HOUSE OF REPRESENTATIVES
 * DISTRICT 001" and "NC STATE SENATE DISTRICT 49". Both chambers serve
 * two-year terms. Named write-ins ("Name (Write-In)") and the
 * "Write-In (Miscellaneous)" line have no party.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "nc-2024-general-results-pct-zip", url: "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip", path: "data/source/rapid/state-general/nc/2024-general-results-pct.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "120 House and 50 Senate contests, precinct level." },
];

const fail = (code: string): never => { throw new Error(`NORTH_CAROLINA_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const name = Object.keys(files).find((file) => /^results_pct_\d{8}\.txt$/.test(file)) ?? fail("RESULTS_FILE_MISSING");
  const lines = Buffer.from(files[name]!).toString("latin1").split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0]!.split("\t").map((cell) => cell.trim());
  const column = (label: string): number => { const index = header.indexOf(label); return index >= 0 ? index : fail(`COLUMN_MISSING:${label}`); };
  const contestCol = column("Contest Name"), choiceCol = column("Choice"), partyCol = column("Choice Party"), votesCol = column("Total Votes"), seatsCol = column("Vote For");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; seats: number; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (const line of lines.slice(1)) {
    const cells = line.split("\t");
    const contest = cells[contestCol]!.trim();
    const match = contest.match(/^NC (HOUSE OF REPRESENTATIVES|STATE SENATE) DISTRICT (\d+)$/);
    if (!match) continue;
    const entry = contests.get(contest) ?? { chamber: match[1] === "STATE SENATE" ? "upper" as const : "lower" as const, district: String(Number(match[2])), seats: integer(cells[seatsCol]!.trim()), candidates: new Map() };
    const choice = cells[choiceCol]!.trim(), writeIn = /\(Write-In\)$|^Write-In \(Miscellaneous\)$/.test(choice);
    const candidate = entry.candidates.get(choice) ?? { name: choice.replace(/\s*\(Write-In\)$/, ""), rawParty: cells[partyCol]!.trim(), votes: 0, writeIn };
    candidate.votes += integer(cells[votesCol]!.trim());
    entry.candidates.set(choice, candidate);
    contests.set(contest, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, seats: entry.seats, candidates: [...entry.candidates.values()] }));
}

export const NORTH_CAROLINA_GENERAL: StateGeneralAdapter = {
  stateCode: "NC",
  authority: "North Carolina State Board of Elections, 2024 general precinct results",
  sources: SOURCES,
  expectedContests: { "nc-2024-general-results-pct-zip": 170 },
  parse: (bytes) => parse(bytes),
};
