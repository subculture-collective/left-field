/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally operate on unvalidated JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { aipacNumericEvidenceCandidateTestHooks, validateAipacNumericEvidenceCandidate } from "./aipac-numeric-evidence-candidate";

const path = resolve("data/metadata/aipac-numeric-evidence-candidate-v1.json");
const load = (): any => JSON.parse(readFileSync(path, "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("AIPAC numeric evidence candidate", () => {
  it("validates the exact reviewer-only, nonpublication candidate", () => {
    const candidate = validateAipacNumericEvidenceCandidate(load());
    expect(candidate.summary).toEqual({ targetSeats: 212, completeSeats: 204, blockedSeats: 8, evidenceRows: 272, directEvidenceRows: 256, independentEvidenceRows: 16, seatsWithEvidence: 123, coverageCells: 1272 });
    expect(candidate.reviewerOnly).toBe(true);
    expect(candidate.publicationEligible).toBe(false);
  });

  it("requires exactly six channel-cycle cells and never converts conflicts into zero", () => {
    const candidate = validateAipacNumericEvidenceCandidate(load());
    for (const row of candidate.seats) {
      expect(new Set(row.coverage.map((cell) => `${cell.cycleYear}:${cell.channel}`))).toHaveLength(6);
      if (row.status === "blocked_mapping_review") {
        expect(row.evidence).toEqual([]);
        expect(row.coverage.every((cell) => cell.disposition === "blocked_mapping_review")).toBe(true);
      } else {
        expect(row.coverage.every((cell) => cell.disposition !== "blocked_mapping_review")).toBe(true);
      }
    }
  });

  it("retains signed-net positive evidence with cutoff-valid revision receipts", () => {
    const candidate = validateAipacNumericEvidenceCandidate(load());
    for (const evidence of candidate.seats.flatMap((row) => row.evidence)) {
      expect(evidence.netAmount).toBeGreaterThan(0);
      expect(evidence.observedAt <= candidate.sourceCutoff).toBe(true);
      expect(evidence.sourceTransactionIdSha256s.length).toBeGreaterThan(0);
      expect(evidence.revisionStatus).toBe("latest_net_positive");
    }
    expect(candidate.seats.flatMap((row) => row.evidenceReceipts)).toHaveLength(272);
    for (const row of candidate.seats) expect(row.evidenceReceipts).toHaveLength(row.evidence.length);
  });

  it("rejects edit-and-rehash attempts at both seat and package layers", () => {
    const candidate = load();
    const seat = candidate.seats.find((row: any) => row.status === "complete" && row.evidence.length === 0);
    seat.status = "blocked_mapping_review";
    seat.coverage = seat.coverage.map((cell: any) => ({ ...cell, disposition: "blocked_mapping_review" }));
    const { seatSha256: _oldSeatHash, ...seatUnsigned } = seat;
    void _oldSeatHash;
    seat.seatSha256 = digest("dsa-seats:aipac-numeric-seat:v1\0", seatUnsigned);
    candidate.derivation.seatSetSha256 = digest("dsa-seats:aipac-numeric-seat-set:v1\0", candidate.seats);
    const { packageSha256: _oldPackageHash, ...unsigned } = candidate;
    void _oldPackageHash;
    candidate.packageSha256 = digest("dsa-seats:aipac-numeric-evidence-candidate:v1\0", unsigned);
    expect(() => validateAipacNumericEvidenceCandidate(candidate)).toThrow();
  });

  it("contains no raw PAS2 identity or free-text fields", () => {
    const prohibited = new Set(["name", "address", "city", "state", "zip", "employer", "occupation", "memoText", "payee"]);
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) { expect(prohibited.has(key)).toBe(false); visit(child); }
    };
    visit(load());
  });

  it("fails closed when one terminal PAS2 transaction ID has multiple line records", () => {
    const row = { cycleYear: 2026, fileNumber: 1, receiptDate: "2026-01-01", transactionIdSha256: "1".repeat(64), sourceRecordIdentitySha256: "2".repeat(64), transactionType: "24K", transactionPgi: "P2026", transactionDate: "2026-01-01", amountCents: BigInt(100), recipientCommitteeId: "C00000001", candidateId: "H0AA00001", memoCode: null };
    expect(() => aipacNumericEvidenceCandidateTestHooks.selectLatestDirect([row, { ...row, sourceRecordIdentitySha256: "3".repeat(64) }])).toThrow("AIPAC_NUMERIC_PAS2_LINE_IDENTITY_AMBIGUOUS");
  });

  it("accepts only an exact terminal F24/F3X corroboration pair for repeated Schedule E transaction IDs", () => {
    const filing = { cycleYear: 2026, fileNumber: 1, amendmentChain: [1], receiptDate: "2026-01-01", formType: "F24" };
    const terminal = new Map([[1, filing], [2, { ...filing, fileNumber: 2, amendmentChain: [2], formType: "F3X" }]]);
    const row = { cycleYear: 2026, fileNumber: 1, candidateId: "H0AA00001", electionType: "P2026", memoedSubtotal: false, memoCode: null, transactionIdSha256: "1".repeat(64), filingForm: "F24", supportOppose: "S", amount: 100, expenditureDate: "2026-01-01", filingDate: "2026-01-02", isNotice: true, recordIdentitySha256: "2".repeat(64) };
    const pair = aipacNumericEvidenceCandidateTestHooks.selectUniqueUdpRows([row, { ...row, fileNumber: 2, filingForm: "F3X", isNotice: false, recordIdentitySha256: "3".repeat(64) }], terminal);
    expect(pair).toHaveLength(1);
    expect(pair[0]!.sourceRecordIdentitySha256s).toHaveLength(2);
    expect(() => aipacNumericEvidenceCandidateTestHooks.selectUniqueUdpRows([row, { ...row, fileNumber: 2, recordIdentitySha256: "3".repeat(64) }], terminal)).toThrow("AIPAC_NUMERIC_UDP_LINE_IDENTITY_AMBIGUOUS");
    expect(() => aipacNumericEvidenceCandidateTestHooks.selectUniqueUdpRows([row, { ...row, fileNumber: 2, filingForm: "F3X", amount: 101, recordIdentitySha256: "3".repeat(64) }], terminal)).toThrow("AIPAC_NUMERIC_UDP_TRANSACTION_CONFLICT");
    expect(() => aipacNumericEvidenceCandidateTestHooks.selectUniqueUdpRows([{ ...row, isNotice: false }, { ...row, fileNumber: 2, filingForm: "F3X", isNotice: true, recordIdentitySha256: "3".repeat(64) }], terminal)).toThrow("AIPAC_NUMERIC_UDP_CORROBORATION_INVALID");
    expect(() => aipacNumericEvidenceCandidateTestHooks.selectUniqueUdpRows([row, { ...row, fileNumber: 2, filingForm: "F3X", isNotice: false }], terminal)).toThrow("AIPAC_NUMERIC_UDP_CORROBORATION_INVALID");
  });

  it("rejects rehashed receipts that are not correlated to evaluator transaction identities", () => {
    const candidate = load(), seat = candidate.seats.find((row: any) => row.evidenceReceipts.length > 0), receipt = seat.evidenceReceipts[0];
    receipt.transactionReceipts[0].transactionIdentitySha256 = "f".repeat(64);
    const seatUnsigned = { ...seat };
    delete seatUnsigned.seatSha256;
    seat.seatSha256 = digest("dsa-seats:aipac-numeric-seat:v1\0", seatUnsigned);
    candidate.derivation.seatSetSha256 = digest("dsa-seats:aipac-numeric-seat-set:v1\0", candidate.seats);
    const unsigned = { ...candidate };
    delete unsigned.packageSha256;
    candidate.packageSha256 = digest("dsa-seats:aipac-numeric-evidence-candidate:v1\0", unsigned);
    expect(() => validateAipacNumericEvidenceCandidate(candidate)).toThrow();
  });
});
