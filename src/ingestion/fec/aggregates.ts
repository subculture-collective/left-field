import type { DecimalMoney, FecReportVersion, ResolvedFecReportVersion } from "./amendments";
import { fecMoneyToCents, formatFecCents, isFecCommitteeId } from "./values";

export type CommitteeRelationshipType = "principal_campaign_committee" | "authorized";
export type FecCommitteeMapping = Readonly<{ committeeId: string; relationshipType: CommitteeRelationshipType; effectiveFrom: string; effectiveTo: string | null }>;
export type FecCandidateMapping = Readonly<{ candidateId: string; electionCycle: number; candidacyId: string; seatCycleId: string; snapshotId: string; committees: readonly FecCommitteeMapping[] }>;
export type FinanceScope = Readonly<{ reportForm: string; reportType: string; coverageStartDate: string; coverageEndDate: string; asOf: string; cutoff: string }>;
export type FinanceFact = Readonly<{ kind: "value"; value: DecimalMoney } | { kind: "missing"; reason: "not_reported" | "not_yet_reported" }>;
export type CommitteeInput = Readonly<{ kind: "included"; committeeId: string; filingId: string } | { kind: "missing"; committeeId: string; reason: "not_reported" | "not_yet_reported" }>;
export type ReconciliationStatus = Readonly<{ status: "matched" } | { status: "not_applicable"; reason: "no_candidate_total" | "different_ytd_basis_or_window" }>;
export type FinanceAggregate = Readonly<{ kind: "aggregate"; candidacyId: string; seatCycleId: string; mappingSnapshotId: string; reportingPeriodStart: string; coverageThrough: string; methodologyVersion: "fec-gross-ytd-v1"; methodology: string; committeeInputs: readonly CommitteeInput[]; cashOnHand: FinanceFact; receipts: FinanceFact; disbursements: FinanceFact; reconciliation: ReconciliationStatus }>;
export type NoAggregate = Readonly<{ kind: "no_aggregate"; reason: "not_reported"; mappingSnapshotId: string; reportingPeriodStart: string; coverageThrough: string; evidence: readonly string[] }>;
export type CandidateCycleReconciliation = Readonly<{ candidateId: string; electionCycle: number; reportForm: string; reportType: string; coverageStartDate: string; coverageEndDate: string; basis: "ytd"; cutoff: string; cashOnHand: DecimalMoney; receipts: DecimalMoney; disbursements: DecimalMoney }>;
/** Official Schedule E is committee-scoped and two-year-cycle scoped, not election scoped. */
export type OutsideSpendingRecord = Readonly<{ candidateId: string; committeeId: string; cycle: number; disposition: "support" | "oppose"; electionFull: false; amount: DecimalMoney }>;
export type OutsideSpendingAggregate = Readonly<{ candidateId: string; cycle: number; supportAmount: DecimalMoney; opposeAmount: DecimalMoney; methodologyVersion: "fec-schedule-e-cycle-v1"; publishableAsExactElection: false }>;
export class FecAggregateError extends Error { constructor(readonly code: string) { super(`FEC aggregate failed: ${code}`); this.name = "FecAggregateError"; } }
const fail = (code: string): never => { throw new FecAggregateError(code); };
const validDate = (d: string): boolean => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const parsed = new Date(`${d}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d; };
const money = (value: DecimalMoney): number => fecMoneyToCents(value) ?? fail("INVALID_MONEY_AMOUNT");
const format = (cents: number): DecimalMoney => formatFecCents(cents) ?? fail("INVALID_MONEY_AMOUNT");
const fact = (values: readonly (DecimalMoney | null)[]): FinanceFact => {
  if (values.some(v => v === null)) return { kind: "missing", reason: "not_reported" };
  const cents = values.reduce((sum, value) => { const next = sum + money(value!); if (!Number.isSafeInteger(next)) fail("INVALID_MONEY_AMOUNT"); return next; }, 0);
  return { kind: "value", value: format(cents) };
};
const sameScope = (f: ResolvedFecReportVersion, s: FinanceScope): boolean => f.reportForm === s.reportForm && f.reportType === s.reportType && f.coverageStartDate === s.coverageStartDate && f.coverageEndDate === s.coverageEndDate;

export function aggregateFecFinance(mappings: readonly FecCandidateMapping[], candidateId: string, electionCycle: number, target: FinanceScope, filings: readonly ResolvedFecReportVersion[], reconciliation?: CandidateCycleReconciliation): FinanceAggregate | NoAggregate {
  if (![target.coverageStartDate, target.coverageEndDate, target.asOf, target.cutoff].every(validDate) || target.coverageStartDate > target.coverageEndDate || target.asOf < target.coverageEndDate || target.cutoff < target.asOf) fail("INVALID_TARGET_SCOPE");
  const matches = mappings.filter(m => m.candidateId === candidateId && m.electionCycle === electionCycle);
  if (matches.length !== 1) fail(matches.length ? "AMBIGUOUS_MAPPING" : "MAPPING_NOT_FOUND");
  const mapping = matches[0]!; const committeeIds = new Set<string>();
  for (const c of mapping.committees) {
    if (committeeIds.has(c.committeeId)) fail("DUPLICATE_COMMITTEE"); committeeIds.add(c.committeeId);
    if (!validDate(c.effectiveFrom) || (c.effectiveTo !== null && (!validDate(c.effectiveTo) || c.effectiveFrom >= c.effectiveTo))) fail("INVALID_MAPPING_DATE");
    // FEC report coverage dates are inclusive; relationship intervals are half-open.
    if (c.effectiveFrom > target.coverageStartDate || (c.effectiveTo !== null && c.effectiveTo <= target.coverageEndDate)) fail("RELATIONSHIP_NOT_EFFECTIVE_FOR_PERIOD");
  }
  if (!mapping.committees.length) return { kind: "no_aggregate", reason: "not_reported", mappingSnapshotId: mapping.snapshotId, reportingPeriodStart: target.coverageStartDate, coverageThrough: target.coverageEndDate, evidence: [mapping.snapshotId] };
  const selected: ResolvedFecReportVersion[] = []; const inputs: CommitteeInput[] = [];
  for (const c of mapping.committees) {
    const found = filings.filter(f => f.canonical && f.candidateId === candidateId && f.electionCycle === electionCycle && f.committeeId === c.committeeId && sameScope(f, target));
    if (found.length > 1) fail("MULTIPLE_CANONICAL_FILINGS");
    if (!found.length) inputs.push({ kind: "missing", committeeId: c.committeeId, reason: "not_reported" }); else {
      const filing = found[0]!;
      if (!validDate(filing.receiptDate)) fail("INVALID_RECEIPT_DATE");
      if (filing.receiptDate > target.asOf) fail("POST_AS_OF_FILING");
      selected.push(filing); inputs.push({ kind: "included", committeeId: c.committeeId, filingId: filing.filingId });
    }
  }
  for (const filing of selected) for (const value of [filing.cashOnHandEndPeriod, filing.totalReceiptsYtd, filing.totalDisbursementsYtd]) if (value !== null) money(value);
  const missing = inputs.some(i => i.kind === "missing"); const unavailable = (): FinanceFact => ({ kind: "missing", reason: "not_reported" });
  const cashOnHand = missing ? unavailable() : fact(selected.map(f => f.cashOnHandEndPeriod)); const receipts = missing ? unavailable() : fact(selected.map(f => f.totalReceiptsYtd)); const disbursements = missing ? unavailable() : fact(selected.map(f => f.totalDisbursementsYtd));
  let reconciliationStatus: ReconciliationStatus = { status: "not_applicable", reason: "no_candidate_total" };
  if (reconciliation) {
    const aligned = reconciliation.candidateId === candidateId && reconciliation.electionCycle === electionCycle && reconciliation.reportForm === target.reportForm && reconciliation.reportType === target.reportType && reconciliation.coverageStartDate === target.coverageStartDate && reconciliation.coverageEndDate === target.coverageEndDate && reconciliation.cutoff === target.cutoff && reconciliation.basis === "ytd";
    if (!aligned) reconciliationStatus = { status: "not_applicable", reason: "different_ytd_basis_or_window" };
    else { for (const [f, total] of [[cashOnHand, reconciliation.cashOnHand], [receipts, reconciliation.receipts], [disbursements, reconciliation.disbursements]] as const) if (f.kind !== "value" || f.value !== format(money(total))) fail("RECONCILIATION_MISMATCH"); reconciliationStatus = { status: "matched" }; }
  }
  return { kind: "aggregate", candidacyId: mapping.candidacyId, seatCycleId: mapping.seatCycleId, mappingSnapshotId: mapping.snapshotId, reportingPeriodStart: target.coverageStartDate, coverageThrough: target.coverageEndDate, methodologyVersion: "fec-gross-ytd-v1", methodology: "Gross official FEC YTD receipts and disbursements; official refund treatment is preserved and transfers are not netted.", committeeInputs: inputs, cashOnHand, receipts, disbursements, reconciliation: reconciliationStatus };
}

export function aggregateOutsideSpending(candidateId: string, cycle: number, records: readonly OutsideSpendingRecord[], paginationComplete: boolean, reconciliationComplete: boolean): OutsideSpendingAggregate {
  if (!paginationComplete || !reconciliationComplete) fail("INCOMPLETE_SCHEDULE_E_ATTESTATION");
  const seen = new Set<string>(); let support = 0; let oppose = 0;
  for (const r of records) { const key = `${r.candidateId}\0${r.committeeId}\0${r.cycle}\0${r.disposition}`; if (r.candidateId !== candidateId || r.cycle !== cycle || r.electionFull !== false || !isFecCommitteeId(r.committeeId)) fail("OUTSIDE_SPENDING_SCOPE_MISMATCH"); if (seen.has(key)) fail("DUPLICATE_OUTSIDE_SPENDING_RECORD"); seen.add(key); if (r.disposition === "support") support += money(r.amount); else oppose += money(r.amount); if (!Number.isSafeInteger(support) || !Number.isSafeInteger(oppose)) fail("INVALID_MONEY_AMOUNT"); }
  return { candidateId, cycle, supportAmount: format(support), opposeAmount: format(oppose), methodologyVersion: "fec-schedule-e-cycle-v1", publishableAsExactElection: false };
}
export type { FecReportVersion };
