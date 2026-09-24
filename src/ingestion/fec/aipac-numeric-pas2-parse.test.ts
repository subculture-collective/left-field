import { describe, expect, it } from "vitest";

import {
  aipacNumericParsePas2,
  aipacNumericSelectLatestDirect,
  aipacNumericTerminalFilings,
  type AipacNumericFiling,
} from "./aipac-numeric-evidence-candidate";

/**
 * Offline coverage for the PAS2 parsing path. The v4 builder pins the real FEC
 * archive digests, so it cannot run on a synthetic archive; these tests drive
 * the exported parse and selection helpers with hand-written 22-field rows.
 */
const filings: AipacNumericFiling[] = [
  { cycleYear: 2024, fileNumber: 1001, amendmentChain: [1001], receiptDate: "2024-04-15", formType: "F3X" },
  { cycleYear: 2024, fileNumber: 1002, amendmentChain: [1001, 1002], receiptDate: "2024-06-01", formType: "F3XA" },
  { cycleYear: 2024, fileNumber: 1003, amendmentChain: [1003], receiptDate: "2024-07-20", formType: "F3X" },
];

const row = (overrides: Partial<Record<number, string>> = {}): string => {
  const fields = new Array<string>(22).fill("");
  Object.assign(fields, {
    0: "C00797670", 3: "P2024", 5: "24K", 13: "03152024", 14: "5000.00", 15: "C00500001", 16: "H8CA39174", 17: "TXN-1", 18: "1002", 19: "", 21: "4021520241234567890",
  }, overrides);
  return fields.join("|");
};

describe("PAS2 direct-contribution parsing", () => {
  it("keeps only terminal filings from the ledger", () => {
    const terminal = aipacNumericTerminalFilings(filings, "AIPAC");
    expect([...terminal.keys()].sort()).toEqual([1002, 1003]);
    expect(() => aipacNumericTerminalFilings([...filings, filings[0]!], "AIPAC")).toThrow("AIPAC_NUMERIC_AIPAC_LEDGER_DUPLICATE");
  });

  it("parses qualifying rows and skips memo, zero-amount, foreign-committee, and superseded rows", () => {
    const terminal = aipacNumericTerminalFilings(filings, "AIPAC");
    const text = [
      row(),
      row({ 17: "TXN-2", 19: "X" }),
      row({ 17: "TXN-3", 14: "0.00" }),
      row({ 0: "C00000001", 17: "TXN-4" }),
      row({ 17: "TXN-5", 18: "1001" }),
      row({ 17: "TXN-6", 3: "G2024" }),
      row({ 17: "TXN-7", 5: "24A" }),
      "",
    ].join("\n");
    const parsed = aipacNumericParsePas2(text, 2024, terminal);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ cycleYear: 2024, fileNumber: 1002, receiptDate: "2024-06-01", transactionType: "24K", transactionPgi: "P2024", transactionDate: "2024-03-15", amountCents: BigInt(500000), recipientCommitteeId: "C00500001", candidateId: "H8CA39174", memoCode: null });
    expect(parsed[0]!.transactionIdSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects malformed widths, dates, amounts, and cross-cycle ledgers", () => {
    const terminal = aipacNumericTerminalFilings(filings, "AIPAC");
    expect(() => aipacNumericParsePas2("a|b|c", 2024, terminal)).toThrow("AIPAC_NUMERIC_PAS2_WIDTH_INVALID");
    expect(() => aipacNumericParsePas2(row({ 13: "13452024" }), 2024, terminal)).toThrow("AIPAC_NUMERIC_PAS2_DATE_INVALID");
    expect(() => aipacNumericParsePas2(row({ 14: "5,000" }), 2024, terminal)).toThrow("AIPAC_NUMERIC_PAS2_AMOUNT_INVALID");
    expect(() => aipacNumericParsePas2(row(), 2022, terminal)).toThrow("AIPAC_NUMERIC_PAS2_LEDGER_CYCLE_MISMATCH");
  });

  it("selects the latest filing per transaction and refuses conflicting economics", () => {
    const terminal = aipacNumericTerminalFilings(filings, "AIPAC");
    const twoFilings = aipacNumericParsePas2([row({ 18: "1002" }), row({ 18: "1003", 21: "9999999999999999999" })].join("\n"), 2024, terminal);
    const selected = aipacNumericSelectLatestDirect(twoFilings);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.fileNumber).toBe(1003);
    const conflicting = aipacNumericParsePas2([row({ 18: "1003", 21: "1" }), row({ 18: "1003", 21: "2", 14: "6000.00" })].join("\n"), 2024, terminal);
    expect(() => aipacNumericSelectLatestDirect(conflicting)).toThrow("AIPAC_NUMERIC_PAS2_LATEST_IDENTITY_CONFLICT");
  });
});
