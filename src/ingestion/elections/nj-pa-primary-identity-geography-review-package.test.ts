/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-review mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { assertNjPaPrimaryJointReviewRowSemantics, buildNjPaPrimaryIdentityGeographyReviewPackage, validateNjPaPrimaryIdentityGeographyReviewPackage } from "./nj-pa-primary-identity-geography-review-package";

const read = (path: string) => { const bytes = readFileSync(resolve(path)); return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), value: JSON.parse(bytes.toString("utf8")) }; };
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
function inputs(sourceLockOverride?: unknown) {
  const proposal = read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const linkage = read("data/metadata/current-incumbent-primary-candidate-linkage-candidate-v1.json");
  const geography = read("data/metadata/nj-pa-primary-geography-compatibility-candidate-v1.json");
  return { proposal: proposal.value, proposalFileSha256: proposal.sha256, linkage: linkage.value, linkageFileSha256: linkage.sha256, geography: geography.value, geographyFileSha256: geography.sha256, sourceLock: sourceLockOverride ?? read("data/source-lock.json").value };
}
const build = (sourceLockOverride?: unknown) => buildNjPaPrimaryIdentityGeographyReviewPackage(inputs(sourceLockOverride));

describe("NJ/PA primary identity-geography review package", () => {
  it("rebuilds the retained review package exactly", () => expect(build()).toEqual(read("data/metadata/nj-pa-primary-identity-geography-review-package-v1.json").value));

  it("closes the exact 25/8/7/1 queue without approval or scoring", () => {
    const value = build();
    expect(value.summary).toMatchObject({ observations: 41, bothCandidatesPendingIndependentReviews: 25, identityCandidateCd120GeographyPending: 8, geographyCandidateIdentityUnresolved: 7, identityUnresolvedCd120GeographyPending: 1, automaticApprovals: 0, scoreEligibleRows: 0 });
    expect(value.rows.every((row) => !row.identityApproved && !row.geographyApproved && !row.jointApproved && !row.scoreEligible)).toBe(true);
  });

  it("preserves exact identity evidence counts and geography closure", () => {
    const rows = build().rows;
    expect(rows.filter((row) => row.identity.evidenceClass === "exact_name_observation")).toHaveLength(18);
    expect(rows.filter((row) => row.identity.evidenceClass === "derived_name_relationship")).toHaveLength(9);
    expect(rows.filter((row) => row.identity.evidenceClass === "inferred_name_relationship")).toHaveLength(6);
    expect(rows.filter((row) => row.identity.evidenceClass === "unresolved")).toHaveLength(8);
    expect(rows.filter((row) => row.geography.compatibilityCandidate)).toHaveLength(32);
  });

  it("inherits only the two unresolved owner decisions without creating or superseding one", () => {
    const value = build();
    expect(value.parentDecisionReviews.map((review) => review.reviewOfDecisionId).sort()).toEqual(["approve-historic-primary-candidate-identity-resolution-v1", "approve-historical-district-cd119-compatibility-v1"]);
    expect(value.parentDecisionReviews.every((review) => review.inherited && !review.createsIndependentDecision && review.supersedesDecisionIds.length === 0 && review.parentResolution === null && review.proposedResolution === null)).toBe(true);
    expect(value.methodology).toMatchObject({ publicationDecisionPresent: false, promotionNotAssessed: true, allOtherParentGatesRemainRequired: true });
  });

  it("excludes names, candidate numbers, votes, markers, and private fields from joined rows", () => {
    const rows = JSON.stringify(build().rows);
    expect(rows).not.toMatch(/officialHouseName|sourceCandidateName|candidateNumber|candidateVotes|winnerMarker|incumbentMarker|address|phone|email|dateOfBirth|donor/i);
  });

  it("binds the retained bytes and exact three-parent source-lock closure", () => {
    const path = "data/metadata/nj-pa-primary-identity-geography-review-package-v1.json", artifact = read(path);
    const entry = read("data/source-lock.json").value.entries.find((candidate: { id: string }) => candidate.id === "nj-pa-primary-identity-geography-review-package-v1");
    expect(entry).toMatchObject({ retainedPath: path, retainedStatus: "retained", byteSize: artifact.bytes.byteLength, sha256: artifact.sha256, kind: "review_proposal", parentIds: ["house-democratic-primary-source-selection-proposal-20260804-v1", "current-incumbent-primary-candidate-linkage-candidate-v1", "nj-pa-primary-geography-compatibility-candidate-v1"] });
  });

  it("rejects wrong source-lock kind, path, status, and duplicate parent IDs", () => {
    for (const mutate of [
      (entry: any) => { entry.kind = "review_candidate"; },
      (entry: any) => { entry.retainedPath = "data/metadata/substituted.json"; },
      (entry: any) => { entry.retainedStatus = "nonretained"; },
    ]) {
      const lock = structuredClone(read("data/source-lock.json").value), entry = lock.entries.find((candidate: any) => candidate.id === "house-democratic-primary-source-selection-proposal-20260804-v1"); mutate(entry); expect(() => build(lock)).toThrow("PRIMARY_JOINT_REVIEW_SOURCE_LOCK_MISMATCH");
    }
    const duplicate = structuredClone(read("data/source-lock.json").value), entry = duplicate.entries.find((candidate: any) => candidate.id === "current-incumbent-primary-candidate-linkage-candidate-v1"); duplicate.entries.push(structuredClone(entry)); expect(() => build(duplicate)).toThrow("PRIMARY_JOINT_REVIEW_SOURCE_LOCK_MISMATCH");
  });

  it("rejects parent file and row closure mismatches", () => {
    const wrongFile = inputs(); wrongFile.proposalFileSha256 = "0".repeat(64); expect(() => buildNjPaPrimaryIdentityGeographyReviewPackage(wrongFile)).toThrow("PRIMARY_JOINT_REVIEW_INPUT_FILE_HASH_MISMATCH");
    const mismatch = inputs(); mismatch.geography = structuredClone(mismatch.geography); mismatch.geography.rows[0].contestSha256 = "0".repeat(64); expect(() => buildNjPaPrimaryIdentityGeographyReviewPackage(mismatch)).toThrow();
  });

  it("rejects a category escalation even when its row is fully rehashed", () => {
    const value: any = build(), row = value.rows.find((candidate: any) => candidate.jointCategory === "identity_candidate_cd120_geography_pending");
    row.jointCategory = "both_candidates_pending_independent_reviews"; row.recommendedAction = "review_identity_and_geography_under_existing_decisions"; row.rationaleCode = "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS";
    const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", unsigned);
    expect(() => assertNjPaPrimaryJointReviewRowSemantics(value.rows)).toThrow("PRIMARY_JOINT_REVIEW_ROW_SEMANTICS_INVALID");
  });

  it("rejects an unresolved identity promoted through a contradictory disposition after rehashing", () => {
    const value: any = build(), row = value.rows.find((candidate: any) => candidate.identity.evidenceClass === "unresolved" && candidate.geography.compatibilityCandidate);
    row.identity.relationshipDisposition = "proposed_identity_link_pending_documented_review"; row.jointCategory = "both_candidates_pending_independent_reviews"; row.recommendedAction = "review_identity_and_geography_under_existing_decisions"; row.rationaleCode = "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS";
    const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", unsigned);
    expect(() => assertNjPaPrimaryJointReviewRowSemantics(value.rows)).toThrow("PRIMARY_JOINT_REVIEW_ROW_SEMANTICS_INVALID");
  });

  it("rejects CD120-pending geography promoted through a contradictory candidate tuple after rehashing", () => {
    const value: any = build(), row = value.rows.find((candidate: any) => candidate.cycleYear === 2026 && candidate.identity.relationshipDisposition === "proposed_identity_link_pending_documented_review");
    row.geography.confidence = "high"; row.geography.compatibilityCandidate = true; row.jointCategory = "both_candidates_pending_independent_reviews"; row.recommendedAction = "review_identity_and_geography_under_existing_decisions"; row.rationaleCode = "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS";
    const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", unsigned);
    expect(() => assertNjPaPrimaryJointReviewRowSemantics(value.rows)).toThrow("PRIMARY_JOINT_REVIEW_ROW_SEMANTICS_INVALID");
  });

  it("rejects a fully rehashed semantic parent-row substitution", () => {
    const value: any = build(); value.rows[0].identity.parentRowSha256 = "0".repeat(64);
    const rowUnsigned = { ...value.rows[0] }; delete rowUnsigned.rowSha256; value.rows[0].rowSha256 = digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", rowUnsigned);
    value.rowSetSha256 = digest("dsa-seats:nj-pa-primary-joint-review-row-set:v1\0", value.rows); const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:nj-pa-primary-joint-review-package:v1\0", unsigned);
    expect(() => validateNjPaPrimaryIdentityGeographyReviewPackage(value)).toThrow("PRIMARY_JOINT_REVIEW_PACKAGE_HASH_MISMATCH");
  });

  it("rejects fabricated review, approval, promotion, and publication states", () => {
    for (const mutate of [
      (value: any) => { value.review.reviewer = "fabricated"; },
      (value: any) => { value.rows[0].jointApproved = true; },
      (value: any) => { value.methodology.promotionNotAssessed = false; },
      (value: any) => { value.publicationEligible = true; },
    ]) { const value: any = build(); mutate(value); expect(() => validateNjPaPrimaryIdentityGeographyReviewPackage(value)).toThrow(); }
  });
});
