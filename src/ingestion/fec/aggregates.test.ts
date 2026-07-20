import { describe, expect, it } from "vitest";
import { aggregateFecFinance, aggregateOutsideSpending, FecAggregateError, type FecCandidateMapping, type FinanceScope } from "./aggregates";
import { resolveFecAmendments, type FecReportVersion } from "./amendments";
const target: FinanceScope = { reportForm: "F3", reportType: "Q3", coverageStartDate: "2024-07-01", coverageEndDate: "2024-09-30", asOf: "2024-10-01", cutoff: "2024-10-15" };
const mapping = (committees = ["P", "A"]): FecCandidateMapping => ({ candidateId: "C", electionCycle: 2024, candidacyId: "cand", seatCycleId: "seat", snapshotId: "snap", committees: committees.map(committeeId => ({ committeeId, relationshipType: committeeId === "P" ? "principal_campaign_committee" : "authorized", effectiveFrom: "2024-01-01", effectiveTo: null })) });
const report = (committeeId: string, n: number, values: [string | null, string | null, string | null] = ["10.00", "20.00", "5.00"], extra: Partial<FecReportVersion> = {}): FecReportVersion => ({ candidateId: "C", electionCycle: 2024, committeeId, reportForm: "F3", reportType: "Q3", coverageStartDate: "2024-07-01", coverageEndDate: "2024-09-30", receiptDate: "2024-10-01", fileNumber: n, previousFileNumber: null, amendmentIndicator: "N", amendmentChain: [n], mostRecent: true, mostRecentFileNumber: n, cashOnHandEndPeriod: values[0], totalReceiptsYtd: values[1], totalDisbursementsYtd: values[2], ...extra });
const resolve = (reports: readonly FecReportVersion[]) => reports.flatMap(r => resolveFecAmendments([r]));
describe("FEC finance aggregation", () => {
  it("Oracle multiple reporting periods selects only explicit target", () => {
    const old = report("P", 1, ["1.00", "2.00", "3.00"], { coverageStartDate: "2024-04-01", coverageEndDate: "2024-06-30" });
    const out = aggregateFecFinance([mapping(["P"])], "C", 2024, target, resolve([old, report("P", 2)]));
    expect(out).toMatchObject({ reportingPeriodStart: "2024-07-01", cashOnHand: { value: "10.00" } });
  });
  it("Oracle zero filings and committees have defined aggregate dates", () => {
    expect(aggregateFecFinance([mapping(["P"])], "C", 2024, target, [])).toMatchObject({ reportingPeriodStart: "2024-07-01", coverageThrough: "2024-09-30" });
    expect(aggregateFecFinance([mapping([])], "C", 2024, target, [])).toMatchObject({ kind: "no_aggregate", reportingPeriodStart: "2024-07-01", coverageThrough: "2024-09-30" });
  });
  it("Oracle relationship boundaries/inversion/partial-period", () => {
    expect(aggregateFecFinance([{ ...mapping(["P"]), committees: [{ ...mapping(["P"]).committees[0]!, effectiveTo: "2024-10-01" }] }], "C", 2024, target, resolve([report("P", 1)])).kind).toBe("aggregate");
    expect(() => aggregateFecFinance([{ ...mapping(["P"]), committees: [{ ...mapping(["P"]).committees[0]!, effectiveTo: "2024-09-30" }] }], "C", 2024, target, [])).toThrow("RELATIONSHIP_NOT_EFFECTIVE_FOR_PERIOD");
    expect(() => aggregateFecFinance([{ ...mapping(["P"]), committees: [{ ...mapping(["P"]).committees[0]!, effectiveFrom: "2024-09-01" }] }], "C", 2024, target, [])).toThrow("RELATIONSHIP_NOT_EFFECTIVE_FOR_PERIOD");
    expect(() => aggregateFecFinance([{ ...mapping(["P"]), committees: [{ ...mapping(["P"]).committees[0]!, effectiveFrom: "2024-09-30", effectiveTo: "2024-09-30" }] }], "C", 2024, target, [])).toThrow("INVALID_MAPPING_DATE");
  });
  it("Oracle decimal cent arithmetic and malformed/nonfinite/too-many-decimal amounts", () => {
    const out = aggregateFecFinance([mapping()], "C", 2024, target, resolve([report("P", 1, ["0.10", "0.20", "0.30"]), report("A", 2, ["0.20", "0.10", "0.40"])]));
    expect(out).toMatchObject({ cashOnHand: { value: "0.30" }, receipts: { value: "0.30" }, disbursements: { value: "0.70" } });
    for (const bad of ["NaN", "Infinity", "1.234", "-1", "1e2"]) expect(() => aggregateFecFinance([mapping(["P"])], "C", 2024, target, resolve([report("P", 1, [bad, "1.00", "1.00"])]))).toThrow("INVALID_MONEY_AMOUNT");
  });
  it("Oracle rejects malformed selected money despite null fields or missing committees", () => {
    const malformedValues: [string | null, string | null, string | null][] = [["1.234", null, null], [null, "1.234", null], [null, null, "1.234"]];
    for (const values of malformedValues) {
      expect(() => aggregateFecFinance([mapping(["P", "A"])], "C", 2024, target, resolve([report("P", 1, values)]))).toThrow("INVALID_MONEY_AMOUNT");
    }
  });
  it("Oracle rejects invalid and post-as-of canonical filing receipt dates", () => {
    const canonical = resolve([report("P", 1)])[0]!;
    expect(() => aggregateFecFinance([mapping(["P"])], "C", 2024, target, [{ ...canonical, receiptDate: "2024-10-02" }])).toThrow("POST_AS_OF_FILING");
    expect(() => aggregateFecFinance([mapping(["P"])], "C", 2024, target, [{ ...canonical, receiptDate: "2024-10-32" }])).toThrow("INVALID_RECEIPT_DATE");
  });
  it("Oracle YTD-vs-cycle reconciliation", () => {
    const out = aggregateFecFinance([mapping(["P"])], "C", 2024, target, resolve([report("P", 1)]), { candidateId: "C", electionCycle: 2024, ...target, basis: "ytd", cashOnHand: "10", receipts: "20", disbursements: "5" });
    expect(out).toMatchObject({ reconciliation: { status: "matched" } });
    expect(aggregateFecFinance([mapping(["P"])], "C", 2024, target, resolve([report("P", 1)]), { candidateId: "C", electionCycle: 2024, ...target, coverageStartDate: "2024-01-01", basis: "ytd", cashOnHand: "10", receipts: "20", disbursements: "5" })).toMatchObject({ reconciliation: { status: "not_applicable" } });
  });
  it("Schedule E is committee/cycle scoped and sums dispositions across committees", () => {
    const row = (committeeId: string, disposition: "support" | "oppose", amount: string) => ({ candidateId: "C", committeeId, cycle: 2024, disposition, electionFull: false as const, amount });
    expect(aggregateOutsideSpending("C", 2024, [row("C00000001", "support", "2"), row("C00000002", "support", "3")], true, true)).toMatchObject({ supportAmount: "5.00", publishableAsExactElection: false });
    expect(() => aggregateOutsideSpending("C", 2024, [row("C00000001", "support", "2"), row("C00000001", "support", "3")], true, true)).toThrow("DUPLICATE_OUTSIDE_SPENDING_RECORD");
    expect(() => aggregateOutsideSpending("C", 2024, [{ ...row("C00000001", "support", "2"), cycle: 2022 }], true, true)).toThrow("OUTSIDE_SPENDING_SCOPE_MISMATCH");
    expect(() => aggregateOutsideSpending("C", 2024, [], false, true)).toThrow("INCOMPLETE_SCHEDULE_E_ATTESTATION");
    expect(aggregateOutsideSpending("C", 2024, [], true, true)).toMatchObject({ supportAmount: "0.00", opposeAmount: "0.00" });
    expect(new FecAggregateError("X").message).toBe("FEC aggregate failed: X");
  });
});
