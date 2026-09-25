import { unzipSync } from "fflate";

import { readRetainedSource, type SourceLock } from "./intake/source-lock";

/**
 * FEC candidate master (cnYY.zip): one row per candidate id registered in the
 * cycle. Column order is fixed by the FEC bulk-data description. The status
 * field says whether the person is a statutory candidate for the cycle; it
 * does not say whether an incumbent is seeking re-election, so this file is
 * used only for what it states: which offices a person has filed for.
 */
export interface FecCandidateMasterRow {
  readonly candidateId: string;
  readonly candidateName: string;
  readonly party: string;
  readonly electionYear: number | null;
  readonly officeState: string;
  readonly office: "H" | "S" | "P" | null;
  readonly officeDistrict: string;
  readonly incumbentChallengerStatus: "I" | "C" | "O" | null;
  readonly status: "C" | "F" | "N" | "P" | null;
  readonly principalCommitteeId: string | null;
}

const COLUMNS = 15;
const fail = (code: string): never => { throw new Error(`FEC_CANDIDATE_MASTER_${code}`); };

export function parseFecCandidateMaster(text: string): FecCandidateMasterRow[] {
  const rows: FecCandidateMasterRow[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const cols = line.replace(/\r$/, "").split("|");
    if (cols.length !== COLUMNS) fail(`COLUMN_COUNT:${cols.length}`);
    const office = cols[5]!, ici = cols[7]!, status = cols[8]!;
    rows.push({
      candidateId: cols[0]!,
      candidateName: cols[1]!,
      party: cols[2]!,
      electionYear: /^\d{4}$/.test(cols[3]!) ? Number(cols[3]) : null,
      officeState: cols[4]!,
      office: office === "H" || office === "S" || office === "P" ? office : null,
      officeDistrict: cols[6]!,
      incumbentChallengerStatus: ici === "I" || ici === "C" || ici === "O" ? ici : null,
      status: status === "C" || status === "F" || status === "N" || status === "P" ? status : null,
      principalCommitteeId: cols[9] === "" ? null : cols[9]!,
    });
  }
  if (new Set(rows.map((row) => row.candidateId)).size !== rows.length) fail("DUPLICATE_CANDIDATE_ID");
  return rows;
}

export function readFecCandidateMaster(lock: SourceLock, id: string, root = process.cwd()): FecCandidateMasterRow[] {
  const { bytes } = readRetainedSource(lock, id, root);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const names = Object.keys(files).filter((name) => /^cn\d{0,2}\.txt$/.test(name));
  if (names.length !== 1) fail("ZIP_MEMBER_INVALID");
  return parseFecCandidateMaster(Buffer.from(files[names[0]!]!).toString("utf8"));
}
