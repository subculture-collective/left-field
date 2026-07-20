import { describe, expect, it } from "vitest";
import { FecAmendmentError, resolveFecAmendments, type FecReportVersion } from "./amendments";

const report = (n: number, chain: readonly number[] = [n], extra: Partial<FecReportVersion> = {}): FecReportVersion => ({ candidateId: "C", electionCycle: 2024, committeeId: "P", reportForm: "F3", reportType: "Q3", coverageStartDate: "2024-07-01", coverageEndDate: "2024-09-30", receiptDate: "2024-10-01", fileNumber: n, previousFileNumber: n === chain[0] ? null : chain.at(-2)!, amendmentIndicator: n === chain[0] ? "N" : "A", amendmentChain: chain, mostRecent: null, mostRecentFileNumber: null, cashOnHandEndPeriod: "10.00", totalReceiptsYtd: "20.00", totalDisbursementsYtd: "5.00", ...extra });
describe("resolveFecAmendments", () => {
  it("uses chain position for official null and status indicators", () => {
    const root = report(1, [1], { amendmentIndicator: "T" });
    const amended = report(2, [1, 2], {
      amendmentIndicator: null,
      previousFileNumber: 1,
    });
    expect(
      resolveFecAmendments([root, amended]).map((row) => row.canonical),
    ).toEqual([false, true]);
  });
  it("Oracle official-shape root/multi-amendment chains", () => {
    const input = [report(3, [1, 2, 3]), report(1), report(2, [1, 2])];
    const result = resolveFecAmendments(input);
    expect(result.map(x => [x.amendmentNumber, x.status, x.canonical, x.amendsSourceFilingId])).toEqual([[0, "superseded", false, null], [1, "superseded", false, "fec:P:1"], [2, "amended", true, "fec:P:2"]]);
    expect(resolveFecAmendments([...input].reverse())).toEqual(result);
  });
  it("Oracle indicator conflicts and scope-changing chain reject", () => {
    expect(() => resolveFecAmendments([report(1), report(2, [1, 2], { amendmentIndicator: "N" })])).toThrow("CONFLICTING_AMENDMENT_INDICATOR");
    expect(() => resolveFecAmendments([report(1), report(2, [1, 2], { coverageEndDate: "2024-10-31" })])).toThrow("SCOPE_MISMATCH");
    expect(() => resolveFecAmendments([report(1, [1, 2])])).toThrow("INVALID_OFFICIAL_CHAIN");
  });
  it("uses previousFileNumber only as corroboration", () => {
    expect(() => resolveFecAmendments([report(1), report(2, [1, 2], { previousFileNumber: 9 })])).toThrow("CONFLICTING_PREDECESSOR_METADATA");
    expect(new FecAmendmentError("X").message).toBe("FEC amendment resolution failed: X");
  });
});
