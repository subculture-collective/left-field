import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * California Secretary of State, Statement of Vote candidate export (one row
 * per candidate per county). Assembly districts 1–80 are elected every two
 * years; Senate districts serve four-year staggered terms, odd numbers in
 * 2024 and even numbers in 2022, so both workbooks are read.
 *
 * California's top-two general has one or two candidates per contest, who may
 * share a party; a single-candidate contest is uncontested. No write-in rows
 * exist for legislative contests.
 */
const SOURCES: readonly (StateGeneralSource & { sheet: string })[] = [
  {
    id: "ca-2024-general-sov-candidates-workbook",
    url: "https://elections.cdn.sos.ca.gov/sov/2024-general/sov/csv-all-candidates.xlsx",
    path: "data/source/rapid/state-general/ca/2024-general-sov-candidates.xlsx",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "80 Assembly and 20 odd-numbered Senate contests.",
    sheet: "SOV Candidates Export",
  },
  {
    id: "ca-2022-general-sov-candidates-workbook",
    url: "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/csv-candidates.xlsx",
    path: "data/source/rapid/state-general/ca/2022-general-sov-candidates.xlsx",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "20 even-numbered Senate contests; the 80 Assembly contests are superseded by 2024.",
    sheet: "csv-candidates",
  },
];

const fail = (code: string): never => { throw new Error(`CALIFORNIA_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, SOURCES.find((candidate) => candidate.id === source.id)?.sheet ?? fail(`SOURCE_UNKNOWN:${source.id}`));
  const header = Array.from({ length: sheet.maxColumn }, (_value, index) => sheet.at(index + 1, 1));
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index + 1 : fail(`COLUMN_MISSING:${name}`); };
  const contestCol = column("Contest Name"), nameCol = column("Candidate Name"), partyCol = column("Party Name"), writeInCol = column("Write-in Flag"), votesCol = column("Vote Total"), idCol = column("Candidate ID");
  const contests = new Map<string, { chamber: "lower" | "upper"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    const contest = sheet.at(contestCol, row);
    const match = contest.match(/^State (Senate|Assembly Member) District (\d+)$/);
    if (!match) continue;
    const key = contest, entry = contests.get(key) ?? { chamber: match[1] === "Senate" ? "upper" as const : "lower" as const, district: match[2]!, candidates: new Map() };
    const candidateId = sheet.at(idCol, row), name = sheet.at(nameCol, row), rawParty = sheet.at(partyCol, row), writeIn = sheet.at(writeInCol, row) === "Y";
    const candidate = entry.candidates.get(candidateId) ?? { name, rawParty, votes: 0, writeIn };
    if (candidate.name !== name || candidate.rawParty !== rawParty) fail(`CANDIDATE_INCONSISTENT:${contest}:${candidateId}`);
    candidate.votes += integer(sheet.at(votesCol, row));
    entry.candidates.set(candidateId, candidate);
    contests.set(key, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const CALIFORNIA_GENERAL: StateGeneralAdapter = {
  stateCode: "CA",
  authority: "California Secretary of State, Statement of Vote",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note }) => ({ id, url, path, cycleYear, electionDate, note })),
  expectedContests: { "ca-2024-general-sov-candidates-workbook": 100, "ca-2022-general-sov-candidates-workbook": 100 },
  parse,
};
