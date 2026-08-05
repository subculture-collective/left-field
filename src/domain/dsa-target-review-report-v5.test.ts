/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally alter sealed artifacts */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateDsaTargetReviewReportV5 } from "./dsa-target-review-report-v5";

const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/dsa-target-evaluation-review-report-20260805-v5.json"), "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("DSA target reviewer report v5", () => {
  it("binds numeric v3 while retaining its reviewer-only publication firewall", () => {
    const report = validateDsaTargetReviewReportV5(load());
    expect(report.inputClosure.aipacCandidate).toMatchObject({ sourceLockId: "aipac-numeric-evidence-candidate-v3", packageSha256: "e30956852e24f9cdd9a95f8d978b3c3bdbd5978eae293f6e5aa5c0d57f04eeb8", reviewerOnly: true, publicationEligible: false });
    expect(report.summary).toEqual({ seats: 212, aipacCandidateCompleteSeats: 211, aipacEvaluatorCompleteSeats: 201, aipacBlockedPendingSeats: 1, aipacNotApplicableCurrentCycleSeats: 2, aipacFormulaIncompatibleSeats: 8, aipacCandidateEvidenceRows: 278, aipacNumericEvidenceRowsUsed: 261, seatsWithAipacCandidateEvidence: 127, seatsWithAipacEvidenceUsed: 119, aipacRouteSelections: 52, routeChangesFromV2: 52, partialQualified: 140, partialNotQualified: 72 });
    expect(report.reviewerOnly).toBe(true);
    expect(report.publicationEligible).toBe(false);
  });

  it("admits only 201 complete, formula-compatible seats to the unchanged v0.1 AIPAC route", () => {
    const report = validateDsaTargetReviewReportV5(load());
    const excluded = report.seats.filter((row) => ["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_nh_01_current"].includes(row.seatCycleId));
    expect(excluded).toHaveLength(3);
    expect(excluded.every((row) => row.aipac.componentScore === null && !row.aipac.numericEvidenceUsed && row.evaluation.selectedRoute !== "aipac_supported_blue")).toBe(true);
    expect(report.seats.filter((row) => row.aipac.status === "formula_incompatible_top_two")).toHaveLength(8);
  });

  it("makes MD-04, MN-03, and NY-04 scoreable only under their completed numeric-v3 closure", () => {
    const report = validateDsaTargetReviewReportV5(load());
    for (const id of ["seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_ny_04_current"]) {
      const row = report.seats.find((candidate) => candidate.seatCycleId === id)!;
      expect(row.aipac).toMatchObject({ status: "numeric_candidate_complete", coverageComplete: true, numericEvidenceUsed: true });
      expect(row.aipac.componentScore).not.toBeNull();
    }
  });

  it("rejects a fully rehashed attempt to route a noncomplete seat through AIPAC", () => {
    const report = load();
    const row = report.seats.find((candidate: any) => candidate.seatCycleId === "seat_house_ca_31_current");
    row.evaluation.selectedRoute = "aipac_supported_blue";
    const { reportSha256: _old, ...unsigned } = report;
    void _old;
    report.reportSha256 = digest("dsa-seats:dsa-target-evaluation-review-report:v5\0", unsigned);
    expect(() => validateDsaTargetReviewReportV5(report)).toThrow();
  });
});
