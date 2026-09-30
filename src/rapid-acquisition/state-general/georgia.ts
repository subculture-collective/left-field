import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Georgia Secretary of State, certified 2024 general election "Total Votes"
 * workbook (results.sos.ga.gov, isOfficialResults). One row per candidate per
 * contest plus a "Total Votes" row; party is a column and also embedded in the
 * ballot name ("Ben Watson (I) (Rep)", where "(I)" marks the incumbent).
 * State Senate districts 1–56 and State House districts 1–180 were all on
 * the ballot. No write-in or blank rows exist in this sheet.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "ga-2024-general-total-votes-workbook",
    url: "https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_3675bf50-5eeb-4407-b538-c04b909ccd08.xlsx",
    path: "data/source/rapid/state-general/ga/2024-general-total-votes.xlsx",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "Certified statewide totals for every contest; both chambers.",
  },
];

const fail = (code: string): never => { throw new Error(`GEORGIA_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, "Total Votes");
  const headers = ["Office Name", "Contest ID", "Ballot Name", "Choice ID", "Party", "Total"];
  headers.forEach((header, index) => { if (sheet.at(index + 1, 1) !== header) fail(`HEADER_INVALID:${header}`); });
  const groups = new Map<string, { office: string; rows: string[][] }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    const fields = headers.map((_header, index) => sheet.at(index + 1, row));
    const office = fields[0]!;
    if (!/^State (Senate|House of Representatives) - District \d+$/.test(office)) continue;
    const key = `${office}\0${fields[1]}`;
    const group = groups.get(key) ?? { office, rows: [] };
    group.rows.push(fields);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const chamber = group.office.startsWith("State Senate") ? "upper" as const : "lower" as const;
    const district = group.office.match(/District (\d+)$/)![1]!;
    const totalRows = group.rows.filter((row) => row[2] === "Total Votes");
    if (totalRows.length !== 1) fail(`TOTAL_ROW_INVALID:${group.office}`);
    const candidates = group.rows.filter((row) => row[2] !== "Total Votes").map((row) => {
      const name = row[2]!.replace(/\s*\((?:I|Rep|Dem|Lib|Grn|Ind)\)/g, "").trim();
      return { name, rawParty: row[4]!, votes: integer(row[5]!) };
    });
    if (candidates.reduce((sum, candidate) => sum + candidate.votes, 0) !== integer(totalRows[0]![5]!)) fail(`TOTAL_MISMATCH:${group.office}`);
    return { chamber, district, candidates };
  });
}

export const GEORGIA_GENERAL: StateGeneralAdapter = {
  stateCode: "GA",
  authority: "Georgia Secretary of State, certified 2024 general election results",
  sources: SOURCES,
  expectedContests: { "ga-2024-general-total-votes-workbook": 236 },
  parse: (bytes) => parse(bytes),
};
