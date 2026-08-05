/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally operate on unvalidated JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateDsaTargetReviewReportV3 } from "./dsa-target-review-report-v3";

const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/dsa-target-evaluation-review-report-20260805-v3.json"), "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("DSA target reviewer report v3", () => {
  it("integrates the numeric candidate without changing the publication gate", () => {
    const report = validateDsaTargetReviewReportV3(load());
    expect(report.summary).toEqual({ seats: 212, aipacCandidateCompleteSeats: 204, aipacEvaluatorCompleteSeats: 196, aipacBlockedSeats: 8, aipacFormulaIncompatibleSeats: 8, aipacCandidateEvidenceRows: 272, aipacNumericEvidenceRowsUsed: 258, seatsWithAipacCandidateEvidence: 123, seatsWithAipacEvidenceUsed: 117, aipacRouteSelections: 51, routeChangesFromV2: 51, partialQualified: 140, partialNotQualified: 72 });
    expect(report.reviewerOnly).toBe(true);
    expect(report.publicationEligible).toBe(false);
    expect(report.inputClosure.priorReport.unchanged).toBe(true);
  });

  it("keeps mapping conflicts unknown while complete absence is numeric zero", () => {
    const report = validateDsaTargetReviewReportV3(load());
    const blocked = report.seats.filter((row) => row.aipac.status === "blocked_mapping_review");
    const zero = report.seats.filter((row) => row.aipac.status === "numeric_candidate_complete" && row.aipac.evidenceCount === 0);
    expect(blocked).toHaveLength(8);
    expect(blocked.every((row) => row.aipac.componentScore === null && !row.aipac.numericEvidenceUsed)).toBe(true);
    expect(zero.length).toBeGreaterThan(0);
    expect(zero.every((row) => row.aipac.componentScore === 0 && row.aipac.numericEvidenceUsed)).toBe(true);
  });

  it("records every route change as a numeric AIPAC route selection", () => {
    const report = validateDsaTargetReviewReportV3(load());
    const changed = report.seats.filter((row) => row.routeChangedFromV2);
    expect(changed).toHaveLength(51);
    expect(changed.every((row) => row.evaluation.selectedRoute === "aipac_supported_blue" && row.aipac.evidenceCount > 0)).toBe(true);
  });

  it("suppresses the partisan-primary route for Washington top-two seats", () => {
    const report = validateDsaTargetReviewReportV3(load()), washington = report.seats.filter((row) => row.stateCode === "WA");
    expect(washington).toHaveLength(8);
    expect(washington.every((row) => row.aipac.status === "formula_incompatible_top_two" && !row.aipac.numericEvidenceUsed && row.aipac.componentScore === null && row.evaluation.selectedRoute !== "aipac_supported_blue")).toBe(true);
  });

  it("rejects a rehashed route manipulation", () => {
    const report = load(), row = report.seats.find((seat: any) => seat.routeChangedFromV2);
    row.routeChangedFromV2 = false;
    const { reportSha256: _old, ...unsigned } = report;
    void _old;
    report.reportSha256 = digest("dsa-seats:dsa-target-evaluation-review-report:v3\0", unsigned);
    expect(() => validateDsaTargetReviewReportV3(report)).toThrow();
  });
});
