import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTexasPrimaryJointReviewPackageV2, validateTexasPrimaryJointReviewPackageV2 } from "./texas-primary-identity-geography-review-package-v2";

const input = () => ({
  jointV1Json: readFileSync("data/metadata/texas-primary-identity-geography-review-package-v1.json", "utf8"),
  geographyV2Json: readFileSync("data/metadata/texas-primary-geography-compatibility-candidate-v2.json", "utf8"),
  geographyV1Json: readFileSync("data/metadata/texas-primary-geography-compatibility-candidate-v1.json", "utf8"),
  crosswalkJson: readFileSync("data/metadata/texas-2026-primary-block-crosswalk-candidate-v1.json", "utf8"),
  currentStatusBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/texas-current-districts-status.html"), enrolledLawBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/hb4-enrolled.html"), datasetBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/planc2333-dataset.json"), planBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/PLANC2333.csv"), currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/current/48_TX_CD119.txt"), sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});

describe("Texas primary identity-geography review package v2", () => {
  it("replaces the 26 pending geography projections with split-review evidence while preserving five null decisions", () => {
    const value = buildTexasPrimaryJointReviewPackageV2(input());
    expect(value.summary).toEqual({ reviewRecords: 78, identityAndGeographyCandidates: 25, geographyCandidateIdentityUnresolved: 27, identityCandidateCrosswalkReviewRequired: 8, identityUnresolvedCrosswalkReviewRequired: 18, identityCandidates: 33, geographyCandidates: 52, reportedContestRecords: 44, sourceUnobservedEventRecords: 34, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.filter((row) => row.cycleYear === 2026)).toHaveLength(26);
    expect(value.records.filter((row) => row.cycleYear === 2026).every((row) => row.geography.status === "crosswalk_review_required" && !row.geography.candidate && row.geography.planBlockCrosswalk !== null)).toBe(true);
    expect(value.decisions).toHaveLength(5);
    expect(value.decisions.every((decision) => decision.review.status === "proposed" && decision.review.reviewer === null && decision.review.reviewedAt === null && decision.review.resolution === null)).toBe(true);
    expect(value.records.every((row) => !row.identity.approved && !row.geography.approved && !row.jointApproved && !row.scoreEligible)).toBe(true);
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/texas-primary-identity-geography-review-package-v2.json"));
  }, 30_000);

  it("rejects parent drift, fabricated decisions, approval, scoring, publication, and event-state mutation", () => {
    const drift = input(); drift.geographyV2Json += " "; expect(() => buildTexasPrimaryJointReviewPackageV2(drift)).toThrow("TX_PRIMARY_JOINT_REVIEW_V2_INVALID");
    const currentInput = input(), base = buildTexasPrimaryJointReviewPackageV2(currentInput);
    type Mutable = { decisions: Array<{ review: Record<string, unknown> }>; records: Array<Record<string, unknown>>; publicationEligible: boolean };
    const mutations: Array<(value: Mutable) => void> = [(value) => { value.decisions[0]!.review.resolution = "approved"; }, (value) => { value.records[0]!.jointApproved = true; }, (value) => { value.records[0]!.scoreEligible = true; }, (value) => { value.publicationEligible = true; }, (value) => { value.records[0]!.electionStage = "runoff"; }, (value) => { value.records[0]!.sourceObservationStatus = "not_observed_in_retained_official_canvass_report_disposition_unresolved"; }];
    for (const mutate of mutations) { const value = structuredClone(base) as unknown as Mutable; mutate(value); expect(() => validateTexasPrimaryJointReviewPackageV2(value as never, currentInput)).toThrow("TX_PRIMARY_JOINT_REVIEW_V2_INVALID:semantic_or_hash_drift"); }
  }, 60_000);
});
