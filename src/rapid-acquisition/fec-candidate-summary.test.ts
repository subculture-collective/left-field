import { describe, expect, it } from "vitest";

import { fecDate, parseFecCandidateSummary, readFecCandidateSummary } from "./fec-candidate-summary";
import { readSourceLock } from "./intake/source-lock";

describe("FEC candidate summary", () => {
  it("parses the 30-column pipe layout and normalizes dates", () => {
    const row = "S0AA00001|DOE, JANE|I|1|DEM|1000.5|0|400|0|10|600.5|0|0|0|0|0|0|900|AA|00||||||0|0|06/30/2026|0|0";
    expect(parseFecCandidateSummary(`${row}\n`)[0]).toMatchObject({ candidateId: "S0AA00001", incumbentChallengerStatus: "I", party: "DEM", totalReceipts: 1000.5, totalDisbursements: 400, cashOnHandClose: 600.5, officeState: "AA", coverageEndDate: "2026-06-30" });
    expect(fecDate("")).toBeNull();
    expect(() => fecDate("13/40/2026")).toThrow("FEC_CANDIDATE_SUMMARY_DATE_INVALID");
    expect(() => parseFecCandidateSummary("a|b")).toThrow("COLUMN_COUNT");
  });

  it("reads the retained snapshot through the lock", () => {
    const rows = readFecCandidateSummary(readSourceLock(), "fec-candidate-summary-2026-20260924");
    expect(rows.size).toBeGreaterThan(4000);
    expect([...rows.values()].filter((row) => row.candidateId.startsWith("S") && row.incumbentChallengerStatus === "I").length).toBeGreaterThan(90);
  });
});
