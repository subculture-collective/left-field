import { describe, expect, it } from "vitest";
import { fecMoneyToCents, formatFecCents, isFecCandidateId, isFecReportType, normalizeFecMoney, openFecTimestampDate } from "./values";

describe("FEC scalar values", () => {
  it.each(["H6GA14300", "S4TX00086", "P80001571"])("accepts official alphanumeric candidate ID %s", (value) => {
    expect(isFecCandidateId(value)).toBe(true);
  });

  it.each([["1", "1.00"], [".5", "0.50"], ["-.5", "-0.50"], [-2.25, "-2.25"], ["-0", "0.00"]])("normalizes signed money %s", (value, expected) => {
    expect(normalizeFecMoney(value)).toBe(expected);
  });

  it.each(["1e2", "1.234", "90071992547409.92"])("rejects unsafe money %s", (value) => {
    expect(normalizeFecMoney(value)).toBeUndefined();
  });

  it("round-trips signed cents", () => {
    expect(fecMoneyToCents("-12.34")).toBe(-1234);
    expect(formatFecCents(-1234)).toBe("-12.34");
  });

  it("requires a complete valid OpenFEC timestamp", () => {
    expect(openFecTimestampDate("2026-07-18T12:34:56")).toBe("2026-07-18");
    expect(openFecTimestampDate("2026-07-18T12:34:56Zjunk")).toBeUndefined();
    expect(openFecTimestampDate("2026-02-30T00:00:00")).toBeUndefined();
  });
  it.each(["Q1", "24", "48", "12G", "30G"])("accepts report type %s", value => expect(isFecReportType(value)).toBe(true));
  it.each(["", "Q_1", "q1", "Q 1", "ABCDEFGHI"])("rejects non-grammar report type %s", value => expect(isFecReportType(value)).toBe(false));
});
