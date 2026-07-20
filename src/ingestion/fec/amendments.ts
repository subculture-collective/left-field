/** Pure, deliberately small projection of the fields needed to version FEC reports. */
export type DecimalMoney = string;
export type FecReportVersion = Readonly<{
  candidateId: string; electionCycle: number; committeeId: string; reportForm: string; reportType: string;
  coverageStartDate: string; coverageEndDate: string; receiptDate: string; fileNumber: number;
  /** Corroborating source metadata only; the official chain below is authoritative. */
  previousFileNumber: number | null; amendmentIndicator: "N" | "A" | "T" | "C" | "M" | "S" | null; amendmentChain: readonly number[];
  mostRecent: boolean | null; mostRecentFileNumber: number | null;
  cashOnHandEndPeriod: DecimalMoney | null; totalReceiptsYtd: DecimalMoney | null; totalDisbursementsYtd: DecimalMoney | null;
}>;

export type ResolvedFecReportVersion = FecReportVersion & Readonly<{
  filingId: string; amendmentNumber: number; amendsSourceFilingId: string | null;
  status: "new" | "amended" | "superseded"; canonical: boolean;
}>;

export class FecAmendmentError extends Error { constructor(readonly code: string) { super(`FEC amendment resolution failed: ${code}`); this.name = "FecAmendmentError"; } }
const fail = (code: string): never => { throw new FecAmendmentError(code); };
const bytes = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const date = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const scope = (v: FecReportVersion): string => [v.candidateId, v.electionCycle, v.committeeId, v.reportForm, v.reportType, v.coverageStartDate, v.coverageEndDate].join("\u0000");
const id = (v: FecReportVersion): string => `fec:${v.committeeId}:${v.fileNumber}`;

/** Resolves complete official root-to-current chains.  `previousFileNumber` never chooses a version. */
export function resolveFecAmendments(input: readonly FecReportVersion[]): ResolvedFecReportVersion[] {
  const byFile = new Map<number, FecReportVersion>();
  for (const v of input) {
    if (!Number.isInteger(v.fileNumber) || v.fileNumber <= 0) fail("INVALID_FILE_NUMBER");
    if (!date(v.coverageStartDate) || !date(v.coverageEndDate) || !date(v.receiptDate) || v.coverageStartDate > v.coverageEndDate) fail("INVALID_DATE");
    if (byFile.has(v.fileNumber)) fail("DUPLICATE_FILE_NUMBER");
    if (v.previousFileNumber !== null && (!Number.isInteger(v.previousFileNumber) || v.previousFileNumber <= 0)) fail("INVALID_PREDECESSOR");
    if (!Array.isArray(v.amendmentChain) || !v.amendmentChain.length || v.amendmentChain.at(-1) !== v.fileNumber || new Set(v.amendmentChain).size !== v.amendmentChain.length) fail("INVALID_OFFICIAL_CHAIN");
    byFile.set(v.fileNumber, v);
  }
  for (const v of input) for (const member of v.amendmentChain) {
    const referenced = byFile.get(member);
    if (!referenced) fail("OFFICIAL_CHAIN_MEMBER_MISSING");
    if (scope(referenced!) !== scope(v)) fail("SCOPE_MISMATCH");
  }
  const groups = new Map<string, FecReportVersion[]>();
  for (const v of input) { const key = scope(v); const group = groups.get(key) ?? []; group.push(v); groups.set(key, group); }
  return [...groups.entries()].sort(([a], [b]) => bytes(a, b)).flatMap(([, group]) => {
    const ordered = [...group].sort((a, b) => b.amendmentChain.length - a.amendmentChain.length || a.fileNumber - b.fileNumber);
    const official = ordered[0]!.amendmentChain;
    if (new Set(official).size !== group.length || group.some(v => !official.includes(v.fileNumber))) fail("DISCONNECTED_VERSION");
    for (let index = 0; index < official.length; index += 1) {
      const fileNumber = official[index]!; const v = byFile.get(fileNumber)!;
      if (v.amendmentChain.length !== index + 1 || v.amendmentChain.some((member, i) => member !== official[i])) fail("CONFLICTING_CHAIN_METADATA");
      if ((index === 0 && v.amendmentIndicator === "A") || (index > 0 && v.amendmentIndicator === "N")) fail("CONFLICTING_AMENDMENT_INDICATOR");
      const predecessor = index ? official[index - 1]! : null;
      if (v.previousFileNumber !== null && v.previousFileNumber !== predecessor) fail("CONFLICTING_PREDECESSOR_METADATA");
    }
    const leaf = official.at(-1)!;
    return official.map((fileNumber, amendmentNumber) => {
      const v = byFile.get(fileNumber)!; const canonical = fileNumber === leaf;
      if (v.mostRecentFileNumber !== null && v.mostRecentFileNumber !== leaf) fail("CONFLICTING_MOST_RECENT_METADATA");
      if (v.mostRecent !== null && v.mostRecent !== canonical) fail("CONFLICTING_MOST_RECENT_METADATA");
      return { ...v, filingId: id(v), amendmentNumber, amendsSourceFilingId: amendmentNumber ? id(byFile.get(official[amendmentNumber - 1]!)!) : null, status: canonical ? (amendmentNumber ? "amended" : "new") : "superseded", canonical };
    });
  });
}
