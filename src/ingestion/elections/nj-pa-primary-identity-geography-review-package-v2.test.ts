import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildNjPaPrimaryIdentityGeographyReviewPackageV2,
  validateNjPaPrimaryIdentityGeographyReviewPackageV2,
} from "./nj-pa-primary-identity-geography-review-package-v2";

const input = () => {
  const base = "data/source/elections/primary-results/geography/new-jersey/2026";
  return {
    jointV1Json: readFileSync("data/metadata/nj-pa-primary-identity-geography-review-package-v1.json", "utf8"),
    geographyV2Json: readFileSync("data/metadata/nj-pa-primary-geography-compatibility-candidate-v2.json", "utf8"),
    geographyV1Json: readFileSync("data/metadata/nj-pa-primary-geography-compatibility-candidate-v1.json", "utf8"),
    authorityReceiptJson: readFileSync("data/metadata/new-jersey-2026-congressional-plan-authority-receipt-v1.json", "utf8"),
    publicationsBytes: readFileSync(`${base}/division-of-elections-publications.html`),
    mapBytes: readFileSync(`${base}/2022-2031-congressional-map.pdf`),
    mapTextBytes: readFileSync(`${base}/2022-2031-congressional-map.txt`),
    statuteBytes: readFileSync(`${base}/njsa-19-46-12.html`),
    componentsBytes: readFileSync(`${base}/njcd-2022-plan-components-report.pdf`),
    componentsTextBytes: readFileSync(`${base}/njcd-2022-plan-components-report.txt`),
    currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt"),
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  };
};

describe("NJ/PA primary identity-geography review package v2", () => {
  it("composes all 41 geography candidates while preserving identity and unresolved decision gates", () => {
    const value = buildNjPaPrimaryIdentityGeographyReviewPackageV2(input());
    expect(value.summary).toEqual({
      observations: 41,
      bothCandidatesPendingIndependentReviews: 33,
      geographyCandidateIdentityUnresolved: 8,
      exactIdentityCandidates: 18,
      derivedIdentityCandidates: 9,
      inferredIdentityCandidates: 6,
      unresolvedIdentityRows: 8,
      geographyCandidates: 41,
      cd120PendingRows: 0,
      parentDecisionReviews: 2,
      automaticApprovals: 0,
      scoreEligibleRows: 0,
    });
    const current = value.rows.filter((row) => row.cycleYear === 2026);
    expect(current.map((row) => row.districtCode)).toEqual(["01", "03", "05", "06", "08", "09", "10", "11", "12"]);
    expect(current.every((row) => row.stateCode === "NJ" && row.geography.historicalCongressSession === "120" && row.geography.historicalGeoid === null && row.geography.compatibilityCandidate && row.geography.planContinuityEvidence !== null)).toBe(true);
    expect(new Set(value.rows.map((row) => row.jointCategory))).toEqual(new Set(["both_candidates_pending_independent_reviews", "geography_candidate_identity_unresolved"]));

    const parent = JSON.parse(readFileSync("data/metadata/nj-pa-primary-identity-geography-review-package-v1.json", "utf8"));
    const parentById = new Map(parent.rows.map((row: { linkageId: string }) => [row.linkageId, row]));
    for (const row of value.rows) {
      const parentRow = parentById.get(row.linkageId) as { identity: unknown; geography: { parentRowSha256: string }; rowSha256: string };
      expect(row.identity).toEqual(parentRow.identity);
      expect(row.parentReviewRowSha256).toBe(parentRow.rowSha256);
      expect(row.geography.parentV1GeographyRowSha256).toBe(parentRow.geography.parentRowSha256);
      expect(row.identityApproved || row.geographyApproved || row.jointApproved || row.scoreEligible).toBe(false);
    }
    expect(value.parentDecisionReviews.map((review) => ({ parentResolution: review.parentResolution, proposedResolution: review.proposedResolution, reviewer: review.reviewer, reviewedAt: review.reviewedAt }))).toEqual([
      { parentResolution: null, proposedResolution: null, reviewer: null, reviewedAt: null },
      { parentResolution: null, proposedResolution: null, reviewer: null, reviewedAt: null },
    ]);
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/nj-pa-primary-identity-geography-review-package-v2.json"));
  });

  it("rejects parent bytes, retained-source drift, lineage drift, and output-lock drift", () => {
    const joint = input(); joint.jointV1Json += " "; expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV2(joint)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V2_INVALID:input_bytes");
    const geography = input(); geography.geographyV2Json += " "; expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV2(geography)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V2_INVALID:input_bytes");
    const statute = input(); statute.statuteBytes = Buffer.concat([statute.statuteBytes, Buffer.from(" ")]); expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV2(statute)).toThrow();
    const parentLock = input(); parentLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "nj-pa-primary-geography-compatibility-candidate-v2").parentIds = []; expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV2(parentLock)).toThrow();
    const outputLock = input(); outputLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "nj-pa-primary-identity-geography-review-package-v2").parentIds = []; expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV2(outputLock)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V2_INVALID");
  });

  it("rejects CD120 GEOID invention, approvals, scoring, publication, fabricated review, decision closure, and unknown fields", () => {
    const currentInput = input();
    const base = buildNjPaPrimaryIdentityGeographyReviewPackageV2(currentInput);
    type Mutable = { rows: Array<Record<string, unknown>>; methodology: Record<string, unknown>; review: Record<string, unknown>; parentDecisionReviews: Array<Record<string, unknown>>; publicationEligible: boolean; [key: string]: unknown };
    const mutations: Array<(value: Mutable) => void> = [
      (value) => { const row = value.rows.find((candidate) => candidate.cycleYear === 2026)!; (row.geography as Record<string, unknown>).historicalGeoid = (row.geography as Record<string, unknown>).targetCd119Geoid; },
      (value) => { value.methodology.componentsReportUsedAsMembershipEvidence = true; },
      (value) => { value.rows[0]!.identityApproved = true; },
      (value) => { value.rows[0]!.geographyApproved = true; },
      (value) => { value.rows[0]!.jointApproved = true; },
      (value) => { value.rows[0]!.scoreEligible = true; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.review.reviewer = "fabricated"; },
      (value) => { value.parentDecisionReviews[0]!.proposedResolution = "approved"; },
      (value) => { value.unexpected = true; },
      (value) => { value.rows[0]!.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base) as unknown as Mutable;
      mutate(value);
      expect(() => validateNjPaPrimaryIdentityGeographyReviewPackageV2(value as never, currentInput)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V2_INVALID:semantic_or_hash_drift");
    }
  });
});
