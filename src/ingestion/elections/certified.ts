import { NATIONWIDE_JURISDICTIONS, PRESIDENTIAL_JURISDICTIONS, type ElectionDecisionStatus } from "./gate";
export const MAX_CERTIFIED_UNITS = 5_000;
export const MAX_CERTIFIED_OPTIONS = 100;
export const MAX_CERTIFIED_ROWS = 500_000;
export type CertifiedOption = Readonly<{ contestKey: string; optionKey: string; reportingUnitKey: string; votes: number; sourceSnapshotId: string; electionTimeGeographyId: string }>;
export type CertifiedTotal = Readonly<{ contestKey: string; reportingUnitKey: string; votes: number; sourceSnapshotId: string; electionTimeGeographyId: string }>;
export type CertifiedContestDescriptor = Readonly<{ jurisdictionCode: string; electionYear: number; contestKey: string; sourceSnapshotId: string; electionTimeGeographyId: string; reportingUnitKeys: readonly string[]; optionKeys: readonly string[]; denominatorVotes: number }>;
export type CertifiedDecision = Readonly<{ status: ElectionDecisionStatus; jurisdictionCode: string; electionYear: number; evidenceSnapshotIds: readonly string[] }>;
export class CertifiedElectionError extends Error { constructor(readonly code: string) { super(`Certified election rejected: ${code}`); this.name = "CertifiedElectionError"; } }
const fail = (code: string): never => { throw new CertifiedElectionError(code); };
const valid = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(v);
const votes = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const orderedUnique = (v: readonly string[]) => v.length > 0 && v.every(valid) && v.every((x, i) => i === 0 || v[i - 1]! < x);
/** Validates a declared, source-exact original-boundary contest without adjustment. */
export function certifyOriginalBoundaryOptions(decision: CertifiedDecision, descriptor: CertifiedContestDescriptor, options: readonly CertifiedOption[], totals: readonly CertifiedTotal[]): readonly CertifiedOption[] {
  const permittedJurisdiction = decision.electionYear === 2022 ? NATIONWIDE_JURISDICTIONS.includes(decision.jurisdictionCode as never) : PRESIDENTIAL_JURISDICTIONS.includes(decision.jurisdictionCode as never);
  if (decision.status !== "approved" || decision.jurisdictionCode !== descriptor.jurisdictionCode || decision.electionYear !== descriptor.electionYear || !permittedJurisdiction || (decision.electionYear !== 2020 && decision.electionYear !== 2022 && decision.electionYear !== 2024) || !orderedUnique(decision.evidenceSnapshotIds) || !decision.evidenceSnapshotIds.includes(descriptor.sourceSnapshotId)) fail("DECISION_NOT_APPROVED");
  if (!valid(descriptor.jurisdictionCode) || !Number.isInteger(descriptor.electionYear) || !valid(descriptor.contestKey) || !/^snap_[A-Za-z0-9:_-]{1,123}$/.test(descriptor.sourceSnapshotId) || !/^geo_[A-Za-z0-9:_-]{1,124}$/.test(descriptor.electionTimeGeographyId) || !orderedUnique(descriptor.reportingUnitKeys) || descriptor.reportingUnitKeys.length > MAX_CERTIFIED_UNITS || !orderedUnique(descriptor.optionKeys) || descriptor.optionKeys.length > MAX_CERTIFIED_OPTIONS || !votes(descriptor.denominatorVotes)) fail("INVALID_CONTEST_DESCRIPTOR");
  if (options.length > MAX_CERTIFIED_ROWS || totals.length > MAX_CERTIFIED_UNITS || options.length > descriptor.reportingUnitKeys.length * descriptor.optionKeys.length) fail("CERTIFIED_INPUT_TOO_LARGE");
  const units = new Set(descriptor.reportingUnitKeys), optionNames = new Set(descriptor.optionKeys), totalsByUnit = new Map<string, bigint>();
  for (const total of totals) { if (total.contestKey !== descriptor.contestKey || !units.has(total.reportingUnitKey) || total.sourceSnapshotId !== descriptor.sourceSnapshotId || total.electionTimeGeographyId !== descriptor.electionTimeGeographyId || !votes(total.votes) || totalsByUnit.has(total.reportingUnitKey)) fail("INVALID_OR_DUPLICATE_TOTAL"); totalsByUnit.set(total.reportingUnitKey, BigInt(total.votes)); }
  if (totalsByUnit.size !== units.size) fail("INCOMPLETE_REPORTING_UNITS");
  const rows = new Map<string, bigint>(); for (const row of options) { const key = `${row.reportingUnitKey}\0${row.optionKey}`; if (row.contestKey !== descriptor.contestKey || !units.has(row.reportingUnitKey) || !optionNames.has(row.optionKey) || row.sourceSnapshotId !== descriptor.sourceSnapshotId || row.electionTimeGeographyId !== descriptor.electionTimeGeographyId || !votes(row.votes) || rows.has(key)) fail("INVALID_OR_DUPLICATE_OPTION"); rows.set(key, BigInt(row.votes)); }
  if (rows.size !== units.size * optionNames.size) fail("INCOMPLETE_OPTIONS"); let grand = BigInt(0);
  for (const unit of descriptor.reportingUnitKeys) { let subtotal = BigInt(0); for (const option of descriptor.optionKeys) subtotal += rows.get(`${unit}\0${option}`)!; if (subtotal !== totalsByUnit.get(unit)) fail("CERTIFIED_SUBTOTAL_MISMATCH"); grand += subtotal; }
  if (grand !== BigInt(descriptor.denominatorVotes)) fail("CERTIFIED_GRAND_TOTAL_MISMATCH");
  return [...options].sort((a, b) => `${a.contestKey}\0${a.reportingUnitKey}\0${a.optionKey}` < `${b.contestKey}\0${b.reportingUnitKey}\0${b.optionKey}` ? -1 : 1);
}
