/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally operate on unvalidated JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateDsaTargetReviewReportV4 } from "./dsa-target-review-report-v4";

const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/dsa-target-evaluation-review-report-20260805-v4.json"), "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("DSA target reviewer report v4", () => {
  it("recomputes the numeric-v2 candidate while preserving the publication gate", () => {
    const report = validateDsaTargetReviewReportV4(load());
    expect(report.summary).toEqual({ seats: 212, aipacCandidateCompleteSeats: 206, aipacEvaluatorCompleteSeats: 198, aipacBlockedPendingSeats: 6, aipacBlockedInvalidOriginSeats: 0, aipacFormulaIncompatibleSeats: 8, aipacCandidateEvidenceRows: 274, aipacNumericEvidenceRowsUsed: 260, seatsWithAipacCandidateEvidence: 124, seatsWithAipacEvidenceUsed: 118, aipacRouteSelections: 52, routeChangesFromV2: 52, partialQualified: 140, partialNotQualified: 72 });
    expect(report.reviewerOnly).toBe(true);
    expect(report.publicationEligible).toBe(false);
    expect(report.inputClosure.priorReport.unchanged).toBe(true);
  });

  it("prevents all noncomplete seats from receiving an AIPAC score or route", () => {
    const report = validateDsaTargetReviewReportV4(load()), blocked = report.seats.filter((row) => row.aipac.status === "blocked_pending_mapping_review"), washington = report.seats.filter((row) => row.aipac.status === "formula_incompatible_top_two");
    expect(blocked).toHaveLength(6);
    expect(washington).toHaveLength(8);
    expect([...blocked, ...washington].every((row) => row.aipac.componentScore === null && !row.aipac.numericEvidenceUsed && row.evaluation.selectedRoute !== "aipac_supported_blue")).toBe(true);
  });

  it("distinguishes a resolved invalid origin from an unresolved mapping", () => {
    const report = validateDsaTargetReviewReportV4(load()), ca47 = report.seats.find((row) => row.seatCycleId === "seat_house_ca_47_current")!, il07 = report.seats.find((row) => row.seatCycleId === "seat_house_il_07_current")!;
    expect(ca47.aipac).toMatchObject({ status: "numeric_candidate_complete", numericSeatStatus: "complete", invalidOriginRejected: true, evidenceCount: 0, componentScore: 0, coverageComplete: true });
    expect(il07.aipac).toMatchObject({ status: "numeric_candidate_complete", evidenceCount: 2, coverageComplete: true });
    expect(il07.evaluation.components.aipacSupport.score).not.toBeNull();
  });

  it("retains proposed House-cycle inapplicability as blocked context", () => {
    const report = validateDsaTargetReviewReportV4(load());
    for (const id of ["seat_house_ma_06_current", "seat_house_nh_01_current"]) {
      const row = report.seats.find((seat) => seat.seatCycleId === id)!;
      expect(row.aipac.proposedNoHouseCandidacyCycles).toEqual([2026]);
      expect(row.aipac.status).toBe("blocked_pending_mapping_review");
      expect(row.aipac.componentScore).toBeNull();
    }
  });

  it("rejects a self-rehashed noncomplete route manipulation", () => {
    const report = load(), row = report.seats.find((seat: any) => seat.aipac.status === "blocked_pending_mapping_review");
    row.evaluation.selectedRoute = "aipac_supported_blue";
    const { reportSha256: _old, ...unsigned } = report;
    void _old;
    report.reportSha256 = digest("dsa-seats:dsa-target-evaluation-review-report:v4\0", unsigned);
    expect(() => validateDsaTargetReviewReportV4(report)).toThrow();
  });
});
