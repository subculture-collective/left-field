import { unzipSync } from "fflate";

import { readWorkbookSheet } from "../intake/workbook";
import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Wisconsin Elections Commission canvass reports, one sheet per contest.
 * Each sheet carries the contest title ("STATE SENATOR DISTRICT 2",
 * "REPRESENTATIVE TO THE ASSEMBLY DISTRICT 1"), then two header rows whose
 * column C reads "Total Votes Cast": the first holds party codes (DEM, REP,
 * blank for independents), the second candidate names, with SCATTERING as
 * the last column. The final row, "Office Totals:", is the district total.
 *
 * All 99 Assembly districts and the even-numbered Senate districts were on
 * the 2024 ballot; odd-numbered Senate districts were last elected in 2022,
 * read from that year's county-by-county State Senator report.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "wi-2024-general-ward-by-ward-federal-state-workbook",
    url: "https://elections.wi.gov/sites/default/files/documents/Ward%20by%20Ward%20Report_November%205%202024%20General%20Election_Federal%20and%20State%20Contests.xlsx",
    path: "data/source/rapid/state-general/wi/2024-general-ward-by-ward-federal-state.xlsx",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "99 Assembly and 16 even-numbered Senate contests among the federal and state sheets.",
  },
  {
    id: "wi-2022-general-county-by-county-state-senator-workbook",
    url: "https://elections.wi.gov/sites/default/files/documents/County%20by%20County%20Report_State%20Senator_0.xlsx",
    path: "data/source/rapid/state-general/wi/2022-general-county-by-county-state-senator.xlsx",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "17 odd-numbered Senate contests.",
  },
];

const fail = (code: string): never => { throw new Error(`WISCONSIN_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);
const tidy = (value: string): string => value.replace(/\s+/g, " ").trim();

function sheetNames(bytes: Buffer): string[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("XLSX_INVALID"); }
  const workbook = Buffer.from(files["xl/workbook.xml"] ?? fail("WORKBOOK_MISSING")).toString("utf8");
  return [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]!).filter((name) => name !== "Document map");
}

function parse(bytes: Buffer): RawGeneralContest[] {
  const contests: RawGeneralContest[] = [];
  for (const name of sheetNames(bytes)) {
    const sheet = readWorkbookSheet(bytes, name);
    let title = "";
    const headerRows: number[] = [];
    for (let row = 1; row <= Math.min(sheet.maxRow, 14); row++) {
      const first = sheet.at(1, row);
      if (/DISTRICT \d+$/.test(first)) title = first;
      if (sheet.at(3, row) === "Total Votes Cast") headerRows.push(row);
    }
    const match = title.match(/^(STATE SENATOR|REPRESENTATIVE TO THE ASSEMBLY) DISTRICT (\d+)$/);
    if (!match) continue;
    if (headerRows.length !== 2) fail(`HEADER_ROWS:${title}:${headerRows.length}`);
    const [partyRow, nameRow] = headerRows as [number, number];
    if (sheet.at(1, sheet.maxRow) !== "Office Totals:") fail(`OFFICE_TOTALS_MISSING:${title}`);
    const totalRow = sheet.maxRow;
    const candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[] = [];
    for (let column = 4; column <= sheet.maxColumn; column++) {
      const candidate = tidy(sheet.at(column, nameRow));
      if (candidate === "") continue;
      const scattering = candidate === "SCATTERING", declaredWriteIn = /\(write-?in\)/i.test(candidate);
      candidates.push({ name: scattering ? "Scattering" : tidy(candidate.replace(/\(write-?in\)/i, "")), rawParty: scattering ? "" : tidy(sheet.at(column, partyRow)), votes: integer(sheet.at(column, totalRow)), writeIn: scattering || declaredWriteIn });
      // SCATTERING is the last column; a merged cell can repeat it in the next column, which must not be counted twice.
      if (scattering) break;
    }
    if (candidates.reduce((sum, candidate) => sum + candidate.votes, 0) !== integer(sheet.at(3, totalRow))) fail(`TOTAL_MISMATCH:${title}`);
    contests.push({ chamber: match[1] === "STATE SENATOR" ? "upper" : "lower", district: match[2]!, candidates });
  }
  return contests;
}

export const WISCONSIN_GENERAL: StateGeneralAdapter = {
  stateCode: "WI",
  authority: "Wisconsin Elections Commission, canvass reporting system",
  sources: SOURCES,
  expectedContests: { "wi-2024-general-ward-by-ward-federal-state-workbook": 115, "wi-2022-general-county-by-county-state-senator-workbook": 17 },
  parse: (bytes) => parse(bytes),
};
