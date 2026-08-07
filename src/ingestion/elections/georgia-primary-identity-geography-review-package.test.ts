/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildGeorgiaPrimaryJointReviewPackage, validateGeorgiaPrimaryJointReviewPackage } from "./georgia-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const input = () => ({ proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), identityJson: text("data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json"), geographyJson: text("data/metadata/georgia-primary-geography-compatibility-candidate-v1.json"), sourceLockJson: text("data/source-lock.json") });
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => { for (const row of value.records) { const unsigned = structuredClone(row); delete unsigned.reviewRecordSha256; row.reviewRecordSha256 = digest("dsa-seats:ga-primary-joint-row:v1\0", unsigned); } value.reviewRecordSetSha256 = digest("dsa-seats:ga-primary-joint-row-set:v1\0", value.records); value.decisionSetSha256 = digest("dsa-seats:ga-primary-joint-decision-set:v1\0", value.decisions); const unsigned = structuredClone(value); delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:ga-primary-joint-package:v1\0", unsigned); return value; };

describe("Georgia primary identity/geography review package", () => {
  it("closes the twelve-row review matrix without approvals", () => {
    const value = buildGeorgiaPrimaryJointReviewPackage(input());
    expect(value.summary).toEqual({ reviewRecords: 12, identityAndGeographyCandidates: 5, identityCandidateCrosswalkReview: 2, identityCandidateNoSameBlockGeography: 1, identityCandidateCd120GeographyPending: 4, officialAuthorityRecords: 12, identityCandidates: 12, geographyCandidates: 5, exactIdentityCandidates: 7, derivedIdentityCandidates: 5, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.map((row) => row.reviewCategory)).toEqual(["identity_and_geography_candidates", "identity_candidate_crosswalk_review", "identity_candidate_crosswalk_review", "identity_candidate_no_same_block_geography", "identity_and_geography_candidates", "identity_and_geography_candidates", "identity_and_geography_candidates", "identity_and_geography_candidates", "identity_candidate_cd120_geography_pending", "identity_candidate_cd120_geography_pending", "identity_candidate_cd120_geography_pending", "identity_candidate_cd120_geography_pending"]);
    expect(value.records.every((row) => !row.identityApproved && !row.geographyApproved && !row.jointApproved && !row.scoreEligible)).toBe(true);
    expect(value.decisions.every((decision) => decision.evidenceRecordIds.length === 12 && decision.review.resolution === null)).toBe(true);
    expect(value).toEqual(validateGeorgiaPrimaryJointReviewPackage(JSON.parse(text("data/metadata/georgia-primary-identity-geography-review-package-v1.json"))));
  });

  it.each([
    ["CD120 escalation", (value: any) => { const row = value.records.find((candidate: any) => candidate.cycleYear === 2026); row.historicalGeoid = row.targetCd119Geoid; row.geographyCandidate = true; row.reviewCategory = "identity_and_geography_candidates"; }],
    ["zero-membership promotion", (value: any) => { const row = value.records.find((candidate: any) => candidate.reviewCategory === "identity_candidate_no_same_block_geography"); row.geographyCandidate = true; row.reviewCategory = "identity_and_geography_candidates"; }],
    ["derived identity flattening", (value: any) => { value.records.find((candidate: any) => candidate.identityEvidenceClass === "derived_name_relationship").identityEvidenceClass = "exact_name_observation"; }],
    ["winner", (value: any) => { value.records[0].sourceWinnerStatus = "marked_by_source"; }],
    ["nomination", (value: any) => { value.records[0].nominationConclusion = "nominated"; }],
    ["identity approval", (value: any) => { value.records[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.records[0].geographyApproved = true; }],
    ["joint approval", (value: any) => { value.records[0].jointApproved = true; }],
    ["score", (value: any) => { value.records[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["unknown evaluator", (value: any) => { value.records[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(buildGeorgiaPrimaryJointReviewPackage(input())) as any; mutate(value); expect(() => validateGeorgiaPrimaryJointReviewPackage(rehash(value))).toThrow("Georgia primary joint review rejected"); });

  it("rejects exact direct and output source-lock topology drift", () => {
    for (const id of ["georgia-primary-geography-compatibility-candidate-v1", "georgia-primary-identity-geography-review-package-v1"]) { const value = input(), lock = JSON.parse(value.sourceLockJson); lock.entries.find((entry: any) => entry.id === id).parentIds.reverse(); value.sourceLockJson = JSON.stringify(lock); expect(() => buildGeorgiaPrimaryJointReviewPackage(value)).toThrow("SOURCE_LOCK_MISMATCH"); }
  });
});
