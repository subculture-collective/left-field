/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally operate on unvalidated JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { aipacNumericV2HasSameKindCycleReplacement, aipacNumericV2InvalidOriginBlocksScope, validateAipacNumericEvidenceCandidateV2 } from "./aipac-numeric-evidence-candidate-v2";

const path = resolve("data/metadata/aipac-numeric-evidence-candidate-v2.json");
const load = (): any => JSON.parse(readFileSync(path, "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("AIPAC numeric evidence candidate v2", () => {
  it("validates the exact reviewer-only resolution-aware numeric candidate", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    expect(candidate.summary).toEqual({ targetSeats: 212, completeSeats: 206, blockedPendingSeats: 6, partiallyBlockedInvalidOriginSeats: 0, evidenceRows: 274, directEvidenceRows: 256, independentEvidenceRows: 18, seatsWithEvidence: 124, coverageCells: 1272, blockedCoverageCells: 36, notApplicableCoverageCells: 0 });
    expect(candidate.reviewerOnly).toBe(true);
    expect(candidate.publicationEligible).toBe(false);
  });

  it("closes CA-47 through independent valid relationships without using the rejected origin", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    const seat = candidate.seats.find((row) => row.seatCycleId === "seat_house_ca_47_current")!;
    expect(seat.status).toBe("complete");
    expect(seat.resolutionContext.invalidOriginDispositionSha256s).toHaveLength(1);
    expect(seat.coverage.every((cell) => cell.disposition === "complete_no_matching_evidence")).toBe(true);
    expect(seat.evidence).toEqual([]);
  });

  it("requires a same-kind same-cycle replacement before a rejected challenger origin can close", () => {
    const rejected = { sourceRelationship: { relationship: "democratic_primary_challenger" as const, effectiveCycleYears: [2024] } };
    const incumbentOnly = [{ sourceRelationship: { relationship: "incumbent" as const, effectiveCycleYears: [2024] } }];
    const replacementChallenger = { sourceRelationship: { relationship: "democratic_primary_challenger" as const, effectiveCycleYears: [2024] } };
    expect(aipacNumericV2HasSameKindCycleReplacement(rejected, incumbentOnly, 2024)).toBe(false);
    expect(aipacNumericV2HasSameKindCycleReplacement(rejected, [...incumbentOnly, replacementChallenger], 2024)).toBe(true);
    expect(aipacNumericV2HasSameKindCycleReplacement(rejected, [replacementChallenger], 2026)).toBe(false);
    const rejectedOrigin = { ...rejected, resolution: { kind: "challenger_auto_rejected" as const, disposition: { cycleYear: 2024 } } };
    expect(aipacNumericV2InvalidOriginBlocksScope("independent_udp", [rejectedOrigin], incumbentOnly, 2024)).toBe(true);
    expect(aipacNumericV2InvalidOriginBlocksScope("independent_udp", [rejectedOrigin], [...incumbentOnly, replacementChallenger], 2024)).toBe(false);
    expect(aipacNumericV2InvalidOriginBlocksScope("direct_aipac_pac", [rejectedOrigin], incumbentOnly, 2024)).toBe(false);
  });

  it("emits the two independently derived IL-07 UDP groups and no direct group", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    const seat = candidate.seats.find((row) => row.seatCycleId === "seat_house_il_07_current")!;
    expect(seat.status).toBe("complete");
    expect(seat.evidence.map((row) => ({ kind: row.kind, cycleYear: row.cycleYear, candidateId: row.kind === "direct_contribution" ? null : row.targetCandidateId, netAmount: row.netAmount }))).toEqual([
      { kind: "independent_oppose_challenger", cycleYear: 2024, candidateId: "H0IL07167", netAmount: 487329.29 },
      { kind: "independent_oppose_challenger", cycleYear: 2026, candidateId: "H6IL07339", netAmount: 59748.29 },
    ]);
  });

  it("blocks all six cells and suppresses evidence for every pending incumbent resolution", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    const expected = ["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_nh_01_current", "seat_house_ny_04_current"];
    const blocked = candidate.seats.filter((row) => row.status === "blocked_pending_mapping");
    expect(blocked.map((row) => row.seatCycleId)).toEqual(expected);
    for (const seat of blocked) {
      expect(seat.coverage).toHaveLength(6);
      expect(seat.coverage.every((cell) => cell.disposition === "blocked_pending_mapping" && cell.qualifyingEvidenceCount === 0)).toBe(true);
      expect(seat.evidence).toEqual([]);
      expect(seat.evidenceReceipts).toEqual([]);
    }
  });

  it("records MA/NH Senate-transition proposals without converting 2026 into zero or approved N/A", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    for (const seatId of ["seat_house_ma_06_current", "seat_house_nh_01_current"]) {
      const seat = candidate.seats.find((row) => row.seatCycleId === seatId)!;
      expect(seat.resolutionContext.proposedNoHouseCandidacyCycles).toEqual([2026]);
      expect(seat.coverage.filter((cell) => cell.cycleYear === 2026).every((cell) => cell.disposition === "blocked_pending_mapping")).toBe(true);
      expect(seat.coverage.filter((cell) => cell.cycleYear === 2026).some((cell) => cell.disposition === "complete_no_matching_evidence" || cell.disposition === "not_applicable_no_house_candidacy")).toBe(false);
    }
  });

  it("contains no pending canonical aliases or proposed committees in evaluator evidence", () => {
    const candidate = validateAipacNumericEvidenceCandidateV2(load());
    const prohibited = new Set(["H2MD04232", "H2NY04244", "C00792283", "C00840165", "C00856062", "C00850420"]);
    const encodedEvidence = JSON.stringify(candidate.seats.flatMap((row) => row.evidence));
    for (const value of prohibited) expect(encodedEvidence.includes(value)).toBe(false);
  });

  it("rejects false-zero and edit-and-rehash attempts", () => {
    const candidate = load();
    const seat = candidate.seats.find((row: any) => row.seatCycleId === "seat_house_ma_06_current");
    seat.status = "complete";
    seat.coverage = seat.coverage.map((cell: any) => ({ ...cell, disposition: "complete_no_matching_evidence" }));
    const seatUnsigned = { ...seat }; delete seatUnsigned.seatSha256;
    seat.seatSha256 = digest("dsa-seats:aipac-numeric-seat:v2\0", seatUnsigned);
    candidate.derivation.seatSetSha256 = digest("dsa-seats:aipac-numeric-seat-set:v2\0", candidate.seats);
    const unsigned = { ...candidate }; delete unsigned.packageSha256;
    candidate.packageSha256 = digest("dsa-seats:aipac-numeric-evidence-candidate:v2\0", unsigned);
    expect(() => validateAipacNumericEvidenceCandidateV2(candidate)).toThrow();
  });
});
