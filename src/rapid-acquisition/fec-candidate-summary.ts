import { unzipSync } from "fflate";

import { readRetainedSource, type SourceLock } from "./intake/source-lock";

/**
 * FEC "all candidates" summary file (weballYY.zip), one pipe-delimited row per
 * candidate with cash on hand, receipts, and disbursements through the latest
 * filing. Column order is fixed by the FEC bulk-data description.
 */
export interface FecCandidateSummaryRow {
  readonly candidateId: string;
  readonly candidateName: string;
  readonly incumbentChallengerStatus: "I" | "C" | "O" | null;
  readonly party: string;
  readonly totalReceipts: number;
  readonly totalDisbursements: number;
  readonly cashOnHandClose: number;
  readonly officeState: string;
  readonly officeDistrict: string;
  readonly coverageEndDate: string | null;
}

const COLUMNS = 30;
const fail = (code: string): never => { throw new Error(`FEC_CANDIDATE_SUMMARY_${code}`); };

const money = (value: string, column: string): number => {
  const parsed = Number(value === "" ? "0" : value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fail(`AMOUNT_INVALID:${column}`);
};

/** `MM/DD/YYYY` → `YYYY-MM-DD`; empty stays null. */
export const fecDate = (value: string): string | null => {
  if (value === "") return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) fail(`DATE_INVALID:${value}`);
  const [, month, day, year] = match!;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) fail(`DATE_INVALID:${value}`);
  return `${year}-${month}-${day}`;
};

export function parseFecCandidateSummary(text: string): FecCandidateSummaryRow[] {
  const rows: FecCandidateSummaryRow[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const cols = line.replace(/\r$/, "").split("|");
    if (cols.length !== COLUMNS) fail(`COLUMN_COUNT:${cols.length}`);
    const status = cols[2]!;
    rows.push({
      candidateId: cols[0]!,
      candidateName: cols[1]!,
      incumbentChallengerStatus: status === "I" || status === "C" || status === "O" ? status : null,
      party: cols[4]!,
      totalReceipts: money(cols[5]!, "TTL_RECEIPTS"),
      totalDisbursements: money(cols[7]!, "TTL_DISB"),
      cashOnHandClose: money(cols[10]!, "COH_COP"),
      officeState: cols[18]!,
      officeDistrict: cols[19]!,
      coverageEndDate: fecDate(cols[27]!),
    });
  }
  if (new Set(rows.map((row) => row.candidateId)).size !== rows.length) fail("DUPLICATE_CANDIDATE_ID");
  return rows;
}

/** Reads a retained weball zip through the lock and returns rows keyed by candidate id. */
export function readFecCandidateSummary(lock: SourceLock, id: string, root = process.cwd()): Map<string, FecCandidateSummaryRow> {
  const { bytes } = readRetainedSource(lock, id, root);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const names = Object.keys(files).filter((name) => /^weball\d{2}\.txt$/.test(name));
  if (names.length !== 1) fail("ZIP_MEMBER_INVALID");
  return new Map(parseFecCandidateSummary(Buffer.from(files[names[0]!]!).toString("utf8")).map((row) => [row.candidateId, row]));
}
