import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Maine Secretary of State, 2024 general election tabulations, one workbook
 * per chamber with every district stacked on one sheet. Each block opens
 * with a header row whose column A reads "DIST" and whose columns D onward
 * hold candidates as "Last, First"; the next row is the candidate's
 * residence, the next the party. Municipality rows follow, then a "Total"
 * row built from SUM formulas. The adapter re-sums the municipality rows and
 * fails if the cached total disagrees. "Blank" and "TBC"/"TBD" columns are
 * ballot accounting; an "Others" column holds write-ins. Both chambers serve
 * two-year terms.
 */
const SOURCES: readonly (StateGeneralSource & { sheet: string; chamber: "upper" | "lower" })[] = [
  { id: "me-2024-general-state-senator-workbook", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/State-20Senator-20FINAL.xlsx", path: "data/source/rapid/state-general/me/2024-general-state-senator.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "35 Senate contests.", sheet: "State Senator", chamber: "upper" },
  { id: "me-2024-general-representative-workbook", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/Rep-20to-20the-20Legislature-20FINAL-20--20Corrected.xlsx", path: "data/source/rapid/state-general/me/2024-general-representative.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "151 House contests (corrected file).", sheet: "Rep to the Legislature", chamber: "lower" },
];

const ACCOUNTING = new Set(["blank", "blanks", "tbc", "tbd", ""]);
const PARTY_LABEL = /^(democratic|republican|unenrolled|green|green independent|libertarian|independent|blank|blanks|tbc|tbd|others?)$/i;
const fail = (code: string): never => { throw new Error(`MAINE_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };
/** "Stewart, Harold L. III" becomes "Harold L. Stewart III". */
const displayName = (value: string): string => {
  const [last, first] = value.split(",").map((part) => part.trim());
  if (!first) return value.trim();
  const suffix = first.match(/\s+(Jr\.?|Sr\.?|II|III|IV)$/)?.[1];
  return suffix ? `${first.slice(0, -suffix.length).trim()} ${last} ${suffix}` : `${first} ${last}`;
};

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  const sheet = readWorkbookSheet(bytes, spec.sheet);
  const starts: number[] = [];
  for (let row = 1; row <= sheet.maxRow; row++) if (sheet.at(1, row) === "DIST") starts.push(row);
  return starts.map((start, index) => {
    const end = (starts[index + 1] ?? sheet.maxRow + 1) - 1;
    // Two block layouts occur: names on the DIST row with parties two rows below, or names two rows above
    // with parties on the DIST row. The DIST row holding only party and accounting labels identifies the second.
    const dataColumns = Array.from({ length: sheet.maxColumn - 3 }, (_value, offset) => offset + 4).filter((column) => sheet.at(column, start) !== "");
    const partiesOnDistRow = dataColumns.length > 0 && dataColumns.every((column) => PARTY_LABEL.test(sheet.at(column, start)));
    const nameRow = partiesOnDistRow ? start - 2 : start, partyRow = partiesOnDistRow ? start : start + 2;
    const columns: { column: number; name: string; rawParty: string; writeIn: boolean }[] = [];
    for (let column = 4; column <= sheet.maxColumn; column++) {
      const name = partiesOnDistRow && ACCOUNTING.has(sheet.at(column, start).toLowerCase()) ? sheet.at(column, start) : sheet.at(column, nameRow), party = sheet.at(column, partyRow);
      if (ACCOUNTING.has(name.toLowerCase()) && ACCOUNTING.has(party.toLowerCase())) continue;
      if (ACCOUNTING.has(name.toLowerCase())) continue;
      const writeIn = /^others?$/i.test(name);
      columns.push({ column, name: writeIn ? "Others" : displayName(name), rawParty: writeIn ? "" : party, writeIn });
    }
    if (columns.length === 0) fail(`NO_CANDIDATES:${start}`);
    let totalRow = 0;
    const districts = new Set<string>();
    const sums = columns.map(() => 0);
    for (let row = partiesOnDistRow ? start + 1 : start + 3; row <= end; row++) {
      if ([1, 2, 3].some((column) => /^total$/i.test(sheet.at(column, row)))) { totalRow = row; break; }
      const district = sheet.at(1, row);
      if (district === "") continue;
      districts.add(district);
      columns.forEach((entry, position) => { sums[position] += integer(sheet.at(entry.column, row)); });
    }
    if (totalRow === 0) fail(`TOTAL_ROW_MISSING:${start}`);
    if (districts.size !== 1) fail(`DISTRICT_AMBIGUOUS:${start}:${[...districts].join(",")}`);
    columns.forEach((entry, position) => { if (integer(sheet.at(entry.column, totalRow)) !== sums[position]) fail(`TOTAL_MISMATCH:${start}:${entry.name}`); });
    return { chamber: spec.chamber, district: String(Number([...districts][0])), candidates: columns.map((entry, position) => ({ name: entry.name, rawParty: entry.rawParty, votes: sums[position]!, writeIn: entry.writeIn })) };
  });
}

export const MAINE_GENERAL: StateGeneralAdapter = {
  stateCode: "ME",
  authority: "Maine Secretary of State, 2024 general election tabulations",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note }) => ({ id, url, path, cycleYear, electionDate, note })),
  expectedContests: { "me-2024-general-state-senator-workbook": 35, "me-2024-general-representative-workbook": 151 },
  parse,
};
