/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-package mutations */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildMainePrimaryIdentityGeographyReviewPackage, validateMainePrimaryIdentityGeographyReviewPackage } from "./maine-primary-identity-geography-review-package";

const input = () => ({
  proposalJson: readFileSync("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"),
  identityCandidateJson: readFileSync("data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json", "utf8"),
  geographyCandidateJson: readFileSync("data/metadata/maine-primary-geography-compatibility-candidate-v1.json", "utf8"),
  sourceLockJson: readFileSync("data/source-lock.json", "utf8"),
});

describe("Maine primary identity geography review package", () => {
  it("reconstructs six review records and five independently proposed decisions without promoting candidate evidence", () => {
    const value = validateMainePrimaryIdentityGeographyReviewPackage(buildMainePrimaryIdentityGeographyReviewPackage(input()), input());
    expect(value.summary).toEqual({ reviewRecords: 6, identityAndGeographyCandidates: 5, geographyCandidateIdentitySourceUnobserved: 1, exactNameIdentityCandidates: 2, derivedNameIdentityCandidates: 3, identityNonappearanceRecords: 1, cd118Cd119Candidates: 2, sameCd119SessionCandidates: 2, stateLawContinuingPlanCandidatesWithoutCd120Geometry: 2, geographyCandidates: 6, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.map((record) => [record.reviewRecordId, record.reviewCategory, record.identityCandidate, record.geographyCandidate])).toEqual([
      ["me-primary-joint:2022:01", "identity_and_geography_candidates", true, true],
      ["me-primary-joint:2022:02", "identity_and_geography_candidates", true, true],
      ["me-primary-joint:2024:01", "identity_and_geography_candidates", true, true],
      ["me-primary-joint:2024:02", "identity_and_geography_candidates", true, true],
      ["me-primary-joint:2026:01", "identity_and_geography_candidates", true, true],
      ["me-primary-joint:2026:02", "geography_candidate_identity_source_unobserved", false, true],
    ]);
    const me02 = value.records.at(-1)!;
    expect(me02).toMatchObject({ identityStatus: "current_incumbent_not_observed_in_source_candidate_set", sourceCandidateName: null, sourceWinnerStatus: "explicit_rcv_summary_winner", winnerSourceCandidateName: "Dunlap, Matthew G.", rcvFirstChoiceNamedCandidateDelta: 81, historicalGeoid: null, cd120CensusGeometryRetained: false, noCd120CensusGeoidInferred: true, identityApproved: false, geographyApproved: false, jointApproved: false, scoreEligible: false });
    expect(value.decisions.map((decision) => [decision.decisionId, decision.evidenceRecordIds.length, decision.review.resolution, decision.review.reviewer, decision.review.reviewedAt])).toEqual([
      ["me-primary:review-result-authority-v1", 6, null, null, null],
      ["me-primary:review-geography-compatibility-v1", 6, null, null, null],
      ["me-primary:review-identity-links-v1", 6, null, null, null],
      ["me-primary:retain-ranked-choice-nonstandard-disposition-exclusion-v1", 6, null, null, null],
      ["me-primary:retain-progressive-classification-exclusion-v1", 6, null, null, null],
    ]);
    expect(value.records.every((record) => !record.identityApproved && !record.geographyApproved && !record.jointApproved && !record.scoreEligible)).toBe(true);
  });

  it("rejects input, lock, lineage, category, Golden/RCV, decision, approval, reviewer, and rehash tampering", () => {
    const parent = input(); parent.geographyCandidateJson += " ";
    expect(() => buildMainePrimaryIdentityGeographyReviewPackage(parent)).toThrow("MAINE_PRIMARY_IDENTITY_GEOGRAPHY_REVIEW_INVALID:INPUT_BYTES");
    const lock = input(), parsed = JSON.parse(lock.sourceLockJson);
    parsed.entries.find((entry: any) => entry.id === "maine-primary-geography-compatibility-candidate-v1").parentIds.reverse(); lock.sourceLockJson = JSON.stringify(parsed);
    expect(() => buildMainePrimaryIdentityGeographyReviewPackage(lock)).toThrow("MAINE_PRIMARY_IDENTITY_GEOGRAPHY_REVIEW_INVALID:SOURCE_LOCK");
    const outputLock = input(), outputParsed = JSON.parse(outputLock.sourceLockJson);
    outputParsed.entries.find((entry: any) => entry.id === "maine-primary-identity-geography-review-package-v1").url += ":altered"; outputLock.sourceLockJson = JSON.stringify(outputParsed);
    expect(() => buildMainePrimaryIdentityGeographyReviewPackage(outputLock)).toThrow("MAINE_PRIMARY_IDENTITY_GEOGRAPHY_REVIEW_INVALID:OUTPUT_LOCK");

    const baseInput = input(), base = buildMainePrimaryIdentityGeographyReviewPackage(baseInput);
    const mutations: Array<(value: any) => void> = [
      (value) => { value.records[0].identityParentRowSha256 = "0".repeat(64); },
      (value) => { value.records[5].reviewCategory = "identity_and_geography_candidates"; },
      (value) => { value.records[5].winnerSourceCandidateName = "Jared F. Golden"; },
      (value) => { value.records[5].historicalGeoid = "2302"; },
      (value) => { value.records[0].geographyApproved = true; },
      (value) => { value.records[0].scoreEligible = true; },
      (value) => { value.decisions[2].recommendedDecision = "invent_a_link"; },
      (value) => { value.decisions[0].review.reviewer = "fabricated"; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.records[0].reviewRecordSha256 = "0".repeat(64); },
      (value) => { value.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base); mutate(value);
      expect(() => validateMainePrimaryIdentityGeographyReviewPackage(value, baseInput)).toThrow("MAINE_PRIMARY_IDENTITY_GEOGRAPHY_REVIEW_INVALID:SEMANTIC_OR_HASH_DRIFT");
    }
  });
});
