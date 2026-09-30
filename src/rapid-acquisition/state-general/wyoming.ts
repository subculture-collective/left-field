import { unzipSync } from "fflate";

import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Wyoming Secretary of State, official general election results zip; the
 * "Results Summaries" workbook inside it has one sheet per office group.
 * Each district is a block of columns: row 3 names the district ("House
 * District 1"), row 4 the candidate ("Chip\nNeiman (R)") or an accounting
 * column ("Write-Ins", "Overvotes", "Undervotes"). County rows follow, with
 * "-" where a county is outside the district, and a "Total" row.
 *
 * All 62 House districts are elected every two years; Senate terms are four
 * years, even districts in 2024 (sheet "Statewide Senate Even") and odd
 * districts in 2022 (sheet "Statewide Senate"). The 2024 workbook's
 * "Statewide Senate Odd" sheet holds stale 2022 primary figures and is not
 * read.
 */
const SOURCES: readonly (StateGeneralSource & { workbook: string; sheets: readonly string[] })[] = [
  { id: "wy-2024-general-results-zip", url: "https://sos.wyo.gov/Elections/Docs/2024/Results/General/2024_Wyoming_General_Results.zip", path: "data/source/rapid/state-general/wy/2024-general-results.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "62 House and 15 even-numbered Senate contests.", workbook: "2024 General Results Summaries - OFFICIAL.xlsx", sheets: ["Statewide House", "Statewide Senate Even"] },
  { id: "wy-2022-general-results-zip", url: "https://sos.wyo.gov/Elections/Docs/2022/Results/General/2022_Wyoming_General_Results.zip", path: "data/source/rapid/state-general/wy/2022-general-results.zip", cycleYear: 2022, electionDate: "2022-11-08", note: "Read only for the 16 odd-numbered Senate contests.", workbook: "2022_General_Summaries_Results.xlsx", sheets: ["Statewide Senate"] },
];

const ACCOUNTING = new Set(["Overvotes", "Undervotes"]);
const fail = (code: string): never => { throw new Error(`WYOMING_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" || trimmed === "-" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const workbook = Buffer.from(files[spec.workbook] ?? fail(`WORKBOOK_MISSING:${spec.workbook}`));
  const contests: RawGeneralContest[] = [];
  for (const sheetName of spec.sheets) {
    const sheet = readWorkbookSheet(workbook, sheetName);
    let totalRow = 0;
    for (let row = 5; row <= sheet.maxRow; row++) if (sheet.at(1, row) === "Total") { totalRow = row; break; }
    if (totalRow === 0) fail(`TOTAL_ROW_MISSING:${sheetName}`);
    const blocks = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[] }>();
    for (let column = 2; column <= sheet.maxColumn; column++) {
      const heading = sheet.at(column, 3).trim();
      const match = heading.match(/^(House|Senate) District (\d+)$/);
      if (!match) continue;
      const label = sheet.at(column, 4).replace(/\s+/g, " ").trim();
      if (label === "" || ACCOUNTING.has(label)) continue;
      const entry = blocks.get(heading) ?? { chamber: match[1] === "Senate" ? "upper" as const : "lower" as const, district: match[2]!, candidates: [] };
      const writeIn = label === "Write-Ins";
      const party = label.match(/\(([A-Z]+)\)$/)?.[1] ?? "";
      entry.candidates.push({ name: writeIn ? "Write-Ins" : label.replace(/\s*\([A-Z]+\)$/, ""), rawParty: writeIn ? "" : party, votes: integer(sheet.at(column, totalRow)), writeIn });
      blocks.set(heading, entry);
    }
    contests.push(...blocks.values());
  }
  return contests;
}

export const WYOMING_GENERAL: StateGeneralAdapter = {
  stateCode: "WY",
  authority: "Wyoming Secretary of State, official general election results summaries",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note }) => ({ id, url, path, cycleYear, electionDate, note })),
  expectedContests: { "wy-2024-general-results-zip": 77, "wy-2022-general-results-zip": 16 },
  parse,
};
