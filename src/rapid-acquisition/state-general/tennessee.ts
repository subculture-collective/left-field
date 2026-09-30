import { unzipSync } from "fflate";

import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Tennessee Secretary of State, "All by Precinct" general election workbooks:
 * one row per precinct per office, with candidate slots repeated across the
 * row as RNAMEk / PARTYk / PVTALLYk. Offices read "Tennessee House of
 * Representatives District 1" and "Tennessee Senate District 2". Column
 * positions differ between years (2022 adds CANDGROUP), so every column is
 * located by its header. District totals are the sum over precincts per
 * candidate. Write-in candidates appear as "Write-In - Name".
 *
 * All 99 House districts are elected every two years. Senate terms are four
 * years: even districts in 2024, odd districts in 2022.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "tn-2024-general-all-by-precinct-workbook", url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx", path: "data/source/rapid/state-general/tn/2024-general-all-by-precinct.xlsx", cycleYear: 2024, electionDate: "2024-11-05", note: "99 House and 16 even-numbered Senate contests." },
  { id: "tn-2022-general-all-by-precinct-workbook", url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20221108AllbyPrecinct.xlsx", path: "data/source/rapid/state-general/tn/2022-general-all-by-precinct.xlsx", cycleYear: 2022, electionDate: "2022-11-08", note: "99 House (superseded by 2024) and 17 odd-numbered Senate contests." },
];

const fail = (code: string): never => { throw new Error(`TENNESSEE_GENERAL_${code}`); };
const integer = (value: string): number => { const trimmed = value.trim(); return trimmed === "" ? 0 : /^\d+$/.test(trimmed) ? Number(trimmed) : fail(`INTEGER_INVALID:${value}`); };

function firstSheet(bytes: Buffer): string {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("XLSX_INVALID"); }
  const workbook = Buffer.from(files["xl/workbook.xml"] ?? fail("WORKBOOK_MISSING")).toString("utf8");
  return workbook.match(/<sheet\b[^>]*\bname="([^"]+)"/)?.[1] ?? fail("SHEET_MISSING");
}

function parse(bytes: Buffer): RawGeneralContest[] {
  const sheet = readWorkbookSheet(bytes, firstSheet(bytes));
  const header = Array.from({ length: sheet.maxColumn }, (_value, index) => sheet.at(index + 1, 1));
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index + 1 : fail(`COLUMN_MISSING:${name}`); };
  const officeCol = column("OFFICENAME");
  const slots: { name: number; party: number; votes: number }[] = [];
  for (let slot = 1; header.includes(`RNAME${slot}`); slot++) slots.push({ name: column(`RNAME${slot}`), party: column(`PARTY${slot}`), votes: column(`PVTALLY${slot}`) });
  if (slots.length === 0) fail("CANDIDATE_SLOTS_MISSING");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (let row = 2; row <= sheet.maxRow; row++) {
    const office = sheet.at(officeCol, row);
    const match = office.match(/^Tennessee (House of Representatives|Senate) District (\d+)$/);
    if (!match) continue;
    const entry = contests.get(office) ?? { chamber: match[1] === "Senate" ? "upper" as const : "lower" as const, district: match[2]!, candidates: new Map() };
    for (const slot of slots) {
      const raw = sheet.at(slot.name, row).replace(/\s+/g, " ").trim();
      if (raw === "") continue;
      const writeIn = /^Write-In\b/i.test(raw);
      const name = raw.replace(/^Write-In\s*-\s*/i, "");
      const candidate = entry.candidates.get(raw) ?? { name, rawParty: writeIn ? "" : sheet.at(slot.party, row), votes: 0, writeIn };
      candidate.votes += integer(sheet.at(slot.votes, row));
      entry.candidates.set(raw, candidate);
    }
    contests.set(office, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const TENNESSEE_GENERAL: StateGeneralAdapter = {
  stateCode: "TN",
  authority: "Tennessee Secretary of State, general election results by precinct",
  sources: SOURCES,
  expectedContests: { "tn-2024-general-all-by-precinct-workbook": 115, "tn-2022-general-all-by-precinct-workbook": 116 },
  parse: (bytes) => parse(bytes),
};
