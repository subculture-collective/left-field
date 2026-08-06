/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewYorkPrimaryJointReviewPackage, validateNewYorkPrimaryJointReviewPackage } from "./new-york-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = (sourceLockJson = text("data/source-lock.json")) => buildNewYorkPrimaryJointReviewPackage({
  proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
  identityJson: text("data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json"),
  geographyJson: text("data/metadata/new-york-primary-geography-compatibility-candidate-v1.json"),
  sourceLockJson,
});

describe("New York primary identity/geography joint reviewer package", () => {
  it("rebuilds the persisted reviewer proposal exactly", () => {
    expect(build()).toEqual(validateNewYorkPrimaryJointReviewPackage(JSON.parse(text("data/metadata/new-york-primary-identity-geography-review-package-v1.json"))));
  });

  it("joins the exact five-category 38-record matrix without approval", () => {
    const value = build();
    expect(value.summary).toEqual({
      reviewRecords: 38,
      identityAndGeographyCandidates: 4,
      identityCandidateGeographyPending: 8,
      geographyCandidateIdentityNotApplicable: 15,
      geographyPendingIdentityNoMatch: 4,
      geographyPendingIdentityNotApplicable: 7,
      identityCandidates: 12,
      geographyCandidates: 19,
      reportedContestRecords: 16,
      certifiedUncontestedRecords: 7,
      unresolvedRecords: 15,
      proposedDecisions: 5,
      jointApprovedRecords: 0,
      scoreEligibleRecords: 0,
    });
    expect(value.records.every((row) => !row.jointApproved && !row.identity.approved && !row.geography.approved && !row.scoreEligible)).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2022).every((row) => row.geography.status === "redraw_crosswalk_required" && !row.geography.candidate)).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2024).every((row) => row.geography.status === "candidate" && row.geography.candidate)).toBe(true);
  });

  it("keeps five scoped decisions proposed and independently unresolved", () => {
    const value = build();
    expect(value.decisions.map((row) => [row.decisionId, row.evidenceRecordIds.length])).toEqual([
      ["ny-primary:accept-geography-candidates-retain-crosswalk-pending-v1", 38],
      ["ny-primary:accept-identity-links-v1", 12],
      ["ny-primary:retain-primary-disposition-exclusion-v1", 38],
      ["ny-primary:retain-progressive-classification-exclusion-v1", 38],
      ["ny-primary:retain-reported-result-authority-boundaries-v1", 16],
    ]);
    expect(value.decisions.every((row) => row.review.status === "proposed" && row.review.reviewer === null && row.review.reviewedAt === null && row.review.resolution === null)).toBe(true);
  });

  it("rejects fully rehashed fabricated approval", () => {
    const drifted = structuredClone(build()) as any;
    drifted.review.status = "approved";
    drifted.review.reviewer = "fabricated-reviewer";
    drifted.records[0].jointApproved = true;
    const row = structuredClone(drifted.records[0]); delete row.reviewRecordSha256;
    drifted.records[0].reviewRecordSha256 = digest("dsa-seats:ny-primary-joint-review-row:v1\0", row);
    drifted.reviewRecordSetSha256 = digest("dsa-seats:ny-primary-joint-review-row-set:v1\0", drifted.records);
    const unsigned = structuredClone(drifted); delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ny-primary-joint-review-package:v1\0", unsigned);
    expect(() => validateNewYorkPrimaryJointReviewPackage(drifted)).toThrow("LIFECYCLE_INVALID");
  });
});
