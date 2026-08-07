/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildOhioPrimaryJointReviewPackage, validateOhioPrimaryJointReviewPackage } from "./ohio-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const input = () => ({
  proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
  identityJson: text("data/metadata/ohio-current-incumbent-primary-linkage-candidate-v1.json"),
  geographyJson: text("data/metadata/ohio-primary-geography-compatibility-candidate-v1.json"),
  sourceLockJson: text("data/source-lock.json"),
});
const build = () => buildOhioPrimaryJointReviewPackage(input());
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.records) {
    const unsigned = structuredClone(row);
    delete unsigned.reviewRecordSha256;
    row.reviewRecordSha256 = digest("dsa-seats:oh-primary-joint-row:v1\0", unsigned);
  }
  value.reviewRecordSetSha256 = digest("dsa-seats:oh-primary-joint-row-set:v1\0", value.records);
  value.decisionSetSha256 = digest("dsa-seats:oh-primary-joint-decision-set:v1\0", value.decisions);
  const unsigned = structuredClone(value);
  delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:oh-primary-joint-package:v1\0", unsigned);
  return value;
};

describe("Ohio primary identity/geography joint review package", () => {
  it("preserves five joint candidates and five CD120 geography-pending identity candidates", () => {
    const value = build();
    expect(value.summary).toEqual({
      reviewRecords: 10, identityAndGeographyCandidates: 5, identityCandidateCd120GeographyPending: 5,
      partialCountyEvidenceExcluded2022: 12, districtReviewRecords2022: 0, cd118ToCd119PlanContinuityCandidates: 0,
      officialAuthorityRecords: 10, identityCandidates: 10, exactIdentityCandidates: 8, derivedIdentityCandidates: 2,
      geographyCandidates: 5, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0,
    });
    expect(value.records.filter((row) => row.reviewCategory === "identity_and_geography_candidates")).toHaveLength(5);
    expect(value.records.filter((row) => row.reviewCategory === "identity_candidate_cd120_geography_pending")).toHaveLength(5);
    expect(value.records.filter((row) => row.identityEvidenceClass === "derived_name_relationship").map((row) => [row.cycleYear, row.districtCode])).toEqual([[2024, "13"], [2026, "13"]]);
    expect(value.records.filter((row) => row.cycleYear === 2026).every((row) => row.historicalCongressSession === "120" && row.historicalGeoid === null && !row.geographyCandidate && !row.jointApproved && !row.scoreEligible)).toBe(true);
  });

  it("preserves exact authority boundaries and five independently scoped decisions", () => {
    const value = build();
    expect(value.records.every((row) => row.resultAuthorityStatus === "secretary_official_canvass_workbook" && row.certificationStatus === "official_canvass_workbook_separate_certificate_not_retained" && row.sourceWinnerStatus === "not_marked_by_source" && row.nominationConclusion === null && row.resultConclusion === null)).toBe(true);
    expect(value.records.some((row) => Number(row.cycleYear) === 2022)).toBe(false);
    expect(value.decisions.map((decision) => [decision.decisionId, decision.parentDecisionId, decision.evidenceRecordIds.length])).toEqual([
      ["oh-primary:accept-official-result-authority-v1", "collect-official-state-primary-results-and-certification-v1", 10],
      ["oh-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1", 10],
      ["oh-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1", 10],
      ["oh-primary:retain-primary-disposition-exclusion-v1", "decide-nonstandard-primary-disposition-treatment-v1", 10],
      ["oh-primary:retain-progressive-classification-exclusion-v1", "approve-progressive-candidate-classification-method-v1", 10],
    ]);
  });

  it.each([
    ["CD120 geography", (value: any) => { const row = value.records.find((item: any) => item.cycleYear === 2026); row.historicalGeoid = row.targetCd119Geoid; row.geographyCandidate = true; row.reviewCategory = "identity_and_geography_candidates"; row.geographyConfidence = "high"; }],
    ["2022 leakage", (value: any) => { value.records[0].cycleYear = 2022; value.records[0].reviewRecordId = `oh-primary-joint:2022:${value.records[0].districtCode}`; }],
    ["derived identity relabeling", (value: any) => { value.records.find((row: any) => row.districtCode === "13").identityEvidenceClass = "exact_name_observation"; }],
    ["source winner", (value: any) => { value.records[0].sourceWinnerStatus = "marked_by_source"; }],
    ["nomination", (value: any) => { value.records[0].nominationConclusion = "nominated"; }],
    ["result conclusion", (value: any) => { value.records[0].resultConclusion = "won"; }],
    ["identity approval", (value: any) => { value.records[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.records[0].geographyApproved = true; }],
    ["joint approval", (value: any) => { value.records[0].jointApproved = true; }],
    ["score eligibility", (value: any) => { value.records[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["classification", (value: any) => { value.records[0].progressiveClassificationStatus = "classified"; }],
    ["reviewer identity", (value: any) => { value.review.reviewer = "fabricated"; value.review.reviewedAt = "2026-08-07T00:00:00Z"; }],
    ["unknown evaluator value", (value: any) => { value.records[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s escalation", (_label, mutate) => {
    const value = structuredClone(build()) as any;
    mutate(value);
    expect(() => validateOhioPrimaryJointReviewPackage(rehash(value))).toThrow("Ohio primary joint review rejected");
  });

  it("validates the generated package and, once present, reproduces the persisted artifact", () => {
    const value = build();
    expect(validateOhioPrimaryJointReviewPackage(value)).toEqual(value);
    const path = "data/metadata/ohio-primary-identity-geography-review-package-v1.json";
    if (existsSync(path)) expect(text(path)).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("rejects parent byte drift and exact source-lock topology drift", () => {
    const parentDrift = input(); parentDrift.identityJson += " ";
    expect(() => buildOhioPrimaryJointReviewPackage(parentDrift)).toThrow("INPUT_HASH_MISMATCH");
    const lockDrift = input(), lock = JSON.parse(lockDrift.sourceLockJson);
    lock.entries.find((entry: any) => entry.id === "ohio-current-incumbent-primary-linkage-candidate-v1").url = "urn:changed";
    lockDrift.sourceLockJson = JSON.stringify(lock);
    expect(() => buildOhioPrimaryJointReviewPackage(lockDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    const parentOrderDrift = input(), parentLock = JSON.parse(parentOrderDrift.sourceLockJson);
    parentLock.entries.find((entry: any) => entry.id === "ohio-primary-geography-compatibility-candidate-v1").parentIds.reverse();
    parentOrderDrift.sourceLockJson = JSON.stringify(parentLock);
    expect(() => buildOhioPrimaryJointReviewPackage(parentOrderDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    const outputEntry = JSON.parse(input().sourceLockJson).entries.find((entry: any) => entry.id === "ohio-primary-identity-geography-review-package-v1");
    if (outputEntry) {
      const outputOrderDrift = input(), outputLock = JSON.parse(outputOrderDrift.sourceLockJson);
      outputLock.entries.find((entry: any) => entry.id === "ohio-primary-identity-geography-review-package-v1").parentIds.reverse();
      outputOrderDrift.sourceLockJson = JSON.stringify(outputLock);
      expect(() => buildOhioPrimaryJointReviewPackage(outputOrderDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    }
  });
});
