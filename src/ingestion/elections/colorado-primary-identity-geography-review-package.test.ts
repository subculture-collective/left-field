/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildColoradoPrimaryJointReviewPackage, validateColoradoPrimaryJointReviewPackage } from "./colorado-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const input = () => ({
  proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
  identityJson: text("data/metadata/colorado-current-incumbent-primary-linkage-candidate-v1.json"),
  geographyJson: text("data/metadata/colorado-primary-geography-compatibility-candidate-v1.json"),
  sourceLockJson: text("data/source-lock.json"),
});
const build = () => buildColoradoPrimaryJointReviewPackage(input());
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.records) {
    const unsigned = structuredClone(row);
    delete unsigned.reviewRecordSha256;
    row.reviewRecordSha256 = digest("dsa-seats:co-primary-joint-row:v1\0", unsigned);
  }
  value.reviewRecordSetSha256 = digest("dsa-seats:co-primary-joint-row-set:v1\0", value.records);
  value.decisionSetSha256 = digest("dsa-seats:co-primary-joint-decision-set:v1\0", value.decisions);
  const unsigned = structuredClone(value);
  delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:co-primary-joint-package:v1\0", unsigned);
  return value;
};

describe("Colorado primary identity/geography joint review package", () => {
  it("preserves eight joint candidates and four CD120 geography-pending identity candidates", () => {
    const value = build();
    expect(value.summary).toEqual({ reviewRecords: 12, identityAndGeographyCandidates: 8, identityCandidateCd120GeographyPending: 4, officialAuthorityRecords: 12, identityCandidates: 12, geographyCandidates: 8, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.filter((row) => row.reviewCategory === "identity_and_geography_candidates")).toHaveLength(8);
    expect(value.records.filter((row) => row.reviewCategory === "identity_candidate_cd120_geography_pending")).toHaveLength(4);
    expect(value.records.filter((row) => row.cycleYear === 2026).every((row) => row.identityCandidate && !row.geographyCandidate && row.historicalCongressSession === "120" && row.historicalGeoid === null && row.geographyEvidenceClass === "authority_pending" && row.geographyConfidence === "none" && !row.jointApproved && !row.scoreEligible)).toBe(true);
  });

  it("preserves exact authority boundaries and five independently scoped decisions", () => {
    const value = build();
    expect(value.records.filter((row) => row.cycleYear === 2022).every((row) => row.resultAuthorityStatus === "official_secretary_abstract" && row.certificationStatus === "certification_announcement_and_signed_statewide_abstract_retained")).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2024).every((row) => row.resultAuthorityStatus === "official_certified_biennial_abstract" && row.certificationStatus === "certified_publication_no_separate_signed_certificate_retained")).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2026).every((row) => row.resultAuthorityStatus === "signed_secretary_statewide_abstract" && row.certificationStatus === "signed_secretary_certificate_bound_to_abstract")).toBe(true);
    expect(value.records.every((row) => row.sourceWinnerStatus === "not_marked_by_source" && row.nominationConclusion === null && row.resultConclusion === null)).toBe(true);
    expect(value.decisions.map((decision) => [decision.decisionId, decision.evidenceRecordIds.length])).toEqual([
      ["co-primary:accept-official-result-authority-v1", 12],
      ["co-primary:accept-geography-compatibility-v1", 12],
      ["co-primary:accept-identity-links-v1", 12],
      ["co-primary:retain-primary-disposition-exclusion-v1", 12],
      ["co-primary:retain-progressive-classification-exclusion-v1", 12],
    ]);
  });

  it.each([
    ["CD120 geography", (value: any) => { const row = value.records.find((item: any) => item.cycleYear === 2026); row.historicalGeoid = row.targetCd119Geoid; row.geographyCandidate = true; row.reviewCategory = "identity_and_geography_candidates"; }],
    ["source winner", (value: any) => { value.records[0].sourceWinnerStatus = "marked_by_source"; }],
    ["nomination", (value: any) => { value.records[0].nominationConclusion = "nominated"; }],
    ["result conclusion", (value: any) => { value.records[0].resultConclusion = "won"; }],
    ["identity approval", (value: any) => { value.records[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.records[0].geographyApproved = true; }],
    ["joint approval", (value: any) => { value.records[0].jointApproved = true; }],
    ["score eligibility", (value: any) => { value.records[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["classification", (value: any) => { value.records[0].progressiveClassificationStatus = "classified"; }],
    ["unknown evaluator value", (value: any) => { value.records[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s escalation", (_label, mutate) => {
    const value = structuredClone(build()) as any;
    mutate(value);
    expect(() => validateColoradoPrimaryJointReviewPackage(rehash(value))).toThrow("Colorado primary joint review rejected");
  });

  it("validates the generated package and, once present, reproduces the persisted artifact", () => {
    const value = build();
    expect(validateColoradoPrimaryJointReviewPackage(value)).toEqual(value);
    const path = "data/metadata/colorado-primary-identity-geography-review-package-v1.json";
    if (existsSync(path)) expect(text(path)).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("rejects parent byte drift and exact source-lock topology drift", () => {
    const parentDrift = input(); parentDrift.identityJson += " ";
    expect(() => buildColoradoPrimaryJointReviewPackage(parentDrift)).toThrow("INPUT_HASH_MISMATCH");
    const lockDrift = input(), lock = JSON.parse(lockDrift.sourceLockJson);
    lock.entries.find((entry: any) => entry.id === "colorado-current-incumbent-primary-linkage-candidate-v1").url = "urn:changed";
    lockDrift.sourceLockJson = JSON.stringify(lock);
    expect(() => buildColoradoPrimaryJointReviewPackage(lockDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    const parentOrderDrift = input(), parentLock = JSON.parse(parentOrderDrift.sourceLockJson);
    parentLock.entries.find((entry: any) => entry.id === "colorado-primary-geography-compatibility-candidate-v1").parentIds.reverse();
    parentOrderDrift.sourceLockJson = JSON.stringify(parentLock);
    expect(() => buildColoradoPrimaryJointReviewPackage(parentOrderDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    const outputOrderDrift = input(), outputLock = JSON.parse(outputOrderDrift.sourceLockJson);
    outputLock.entries.find((entry: any) => entry.id === "colorado-primary-identity-geography-review-package-v1").parentIds.reverse();
    outputOrderDrift.sourceLockJson = JSON.stringify(outputLock);
    expect(() => buildColoradoPrimaryJointReviewPackage(outputOrderDrift)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
