import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateAipacNumericEvidenceCandidateV3 } from "./aipac-numeric-evidence-candidate-v3";

const load = () => JSON.parse(readFileSync(resolve("data/metadata/aipac-numeric-evidence-candidate-v3.json"), "utf8"));
const seat = (value: ReturnType<typeof load>, id: string) => value.seats.find((row: { seatCycleId: string }) => row.seatCycleId === id)!;
describe("AIPAC numeric evidence candidate v3", () => {
  it("validates the cycle-resolution successor and exact global outcome", () => {
    const value = validateAipacNumericEvidenceCandidateV3(load());
    expect(value.summary).toEqual({ targetSeats: 212, completeSeats: 211, partiallyBlockedPendingSeats: 1, partiallyBlockedInvalidOriginSeats: 0, evidenceRows: 278, directEvidenceRows: 259, independentEvidenceRows: 19, seatsWithEvidence: 127, coverageCells: 1272, completeMatchingCoverageCells: 273, completeZeroCoverageCells: 993, blockedCoverageCells: 2, notApplicableCoverageCells: 4 });
    expect(value.reviewerOnly).toBe(true); expect(value.publicationEligible).toBe(false);
  });
  it("blocks only both CA-31 2024 channels", () => {
    const value = validateAipacNumericEvidenceCandidateV3(load()), ca = seat(value, "seat_house_ca_31_current");
    expect(ca.status).toBe("partially_blocked_pending_mapping");
    expect(ca.coverage.filter((row: { disposition: string }) => row.disposition === "blocked_pending_mapping").map((row: { cycleYear: number; channel: string }) => [row.cycleYear, row.channel])).toEqual([[2024, "direct_aipac_pac"], [2024, "independent_udp"]]);
    expect(ca.evidence).toEqual([]);
  });
  it("makes only MA/NH 2026 channels not applicable rather than zero", () => {
    const value = validateAipacNumericEvidenceCandidateV3(load());
    for (const id of ["seat_house_ma_06_current", "seat_house_nh_01_current"]) expect(seat(value, id).coverage.filter((row: { cycleYear: number }) => row.cycleYear === 2026).map((row: { disposition: string }) => row.disposition)).toEqual(["not_applicable_no_house_candidacy", "not_applicable_no_house_candidacy"]);
  });
  it("uses corrected effective identities and exposes the four newly unblocked groups", () => {
    const value = validateAipacNumericEvidenceCandidateV3(load());
    expect(seat(value, "seat_house_md_04_current").incumbentCandidateId).toBe("H2MD04232"); expect(seat(value, "seat_house_ny_04_current").incumbentCandidateId).toBe("H2NY04244");
    expect(seat(value, "seat_house_ma_06_current").evidence.map((row: { netAmount: number }) => row.netAmount)).toEqual([5000]);
    expect(seat(value, "seat_house_md_04_current").evidence.map((row: { netAmount: number }) => row.netAmount)).toEqual([4258735.79]);
    expect(seat(value, "seat_house_nh_01_current").evidence.map((row: { netAmount: number }) => row.netAmount)).toEqual([2100, 10003]);
  });
  it("preserves the v2 challenger safety cases and rejects tampered terminal states", () => {
    const value = load(), ca47 = seat(value, "seat_house_ca_47_current"), il07 = seat(value, "seat_house_il_07_current");
    expect(ca47.evidence).toEqual([]); expect(il07.evidence.map((row: { netAmount: number }) => row.netAmount)).toEqual([487329.29, 59748.29]);
    value.seats.find((row: { seatCycleId: string }) => row.seatCycleId === "seat_house_ca_31_current").coverage.find((row: { cycleYear: number; channel: string }) => row.cycleYear === 2024 && row.channel === "direct_aipac_pac").disposition = "complete_no_matching_evidence";
    expect(() => validateAipacNumericEvidenceCandidateV3(value)).toThrow();
    const receipt = load(); receipt.seats.find((row: { seatCycleId: string }) => row.seatCycleId === "seat_house_ma_06_current").evidenceReceipts[0].selectionRule = "schedule_e_terminal_transaction_or_exact_f24_f3x_corroboration";
    expect(() => validateAipacNumericEvidenceCandidateV3(receipt)).toThrow();
  });
});
