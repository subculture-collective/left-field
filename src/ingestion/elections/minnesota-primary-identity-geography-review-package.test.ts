/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildMinnesotaPrimaryJointReviewPackage, validateMinnesotaPrimaryJointReviewPackage } from "./minnesota-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const input = () => ({
  proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
  identityJson: text("data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json"),
  geographyJson: text("data/metadata/minnesota-primary-geography-compatibility-candidate-v1.json"),
  sourceLockJson: text("data/source-lock.json"),
});
const build = () => buildMinnesotaPrimaryJointReviewPackage(input());
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.records) {
    const unsigned = structuredClone(row);
    delete unsigned.reviewRecordSha256;
    row.reviewRecordSha256 = digest("dsa-seats:mn-primary-joint-row:v1\0", unsigned);
  }
  value.parentProjectionSha256 = digest("dsa-seats:mn-primary-joint-parent-projection:v1\0", value.records.map((row: any) => ({
    reviewRecordId: row.reviewRecordId, identityObservationId: row.identityObservationId, identityParentRowSha256: row.identity.parentRowSha256,
    geographyObservationId: row.geographyObservationId, geographyParentRowSha256: row.geography.parentRowSha256, contestId: row.contestId,
    contestSha256: row.contestSha256, identityStatus: row.identity.identityStatus, reviewCategory: row.reviewCategory,
    resultAuthorityStatus: row.resultAuthorityStatus, certificationStatus: row.certificationStatus, sourceWinnerStatus: row.sourceWinnerStatus,
    compatibilityDisposition: row.geography.compatibilityDisposition, compatibilityCandidate: row.geography.candidate,
  })));
  value.reviewRecordSetSha256 = digest("dsa-seats:mn-primary-joint-row-set:v1\0", value.records);
  value.decisionSetSha256 = digest("dsa-seats:mn-primary-joint-decision-set:v1\0", value.decisions);
  const unsigned = structuredClone(value);
  delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:mn-primary-joint-package:v1\0", unsigned);
  return value;
};

describe("Minnesota primary identity/geography joint review package", () => {
  it("joins all eight rows without converting source absence into identity evidence", () => {
    const value = build();
    expect(value.summary).toEqual({
      reviewRecords: 8,
      identityAndGeographyCandidates: 5,
      geographyCandidateIdentitySourceUnobserved: 3,
      identityCandidates: 5,
      geographyCandidates: 8,
      officialPortalReportedAuthorityRecords: 5,
      reportedContestRecords: 5,
      sourceUnobservedRecords: 3,
      proposedDecisions: 5,
      jointApprovedRecords: 0,
      scoreEligibleRecords: 0,
    });
    expect(value.records.filter((row) => row.reviewCategory === "identity_and_geography_candidates")).toHaveLength(5);
    expect(value.records.filter((row) => row.reviewCategory === "geography_candidate_identity_source_unobserved")).toHaveLength(3);
    expect(value.records.every((row) => !row.identity.approved && !row.geography.approved && !row.jointApproved && !row.scoreEligible)).toBe(true);
  });

  it("preserves the five reported observations and complete three-row source-absence bundle", () => {
    const value = build();
    const absent = value.records.filter((row) => row.reviewCategory === "geography_candidate_identity_source_unobserved");
    expect(absent.map((row) => row.reviewRecordId)).toEqual(["mn-primary-joint:2022:02", "mn-primary-joint:2022:03", "mn-primary-joint:2024:03"]);
    expect(absent.every((row) => row.contestId === null && row.contestSha256 === null && row.identity.status === "source_unobserved" && row.identity.sourceCandidateId === null && row.identity.sourceCandidateName === null && row.identity.sourceCandidateVotes === null && row.identity.sourceCandidatePercentage === null && row.identity.evidenceClass === null && row.identity.confidence === null && !row.identity.candidate && row.resultAuthorityStatus === null && row.certificationStatus === null && row.sourceWinnerStatus === "not_applicable_no_reported_contest")).toBe(true);
    const reported = value.records.filter((row) => row.identity.candidate);
    expect(reported).toHaveLength(5);
    expect(reported.every((row) => row.sourcePartyCode === "DFL" && row.resultAuthorityStatus === "official_portal_reported_result_not_claimed_as_certified_result_bytes" && row.certificationStatus === "event_metadata_only_exact_report_bytes_not_retained" && row.sourceWinnerStatus === "not_marked_by_source")).toBe(true);
    expect(value.records.find((row) => row.reviewRecordId === "mn-primary-joint:2024:04")).toEqual(expect.objectContaining({ nominationConclusion: null, resultConclusion: null, sourceWinnerStatus: "not_marked_by_source", jointApproved: false, scoreEligible: false }));
  });

  it("keeps five independently scoped proposed decisions", () => {
    const value = build();
    expect(value.decisions.map((row) => [row.decisionId, row.evidenceRecordIds.length])).toEqual([
      ["mn-primary:accept-official-portal-result-authority-v1", 5],
      ["mn-primary:accept-geography-compatibility-v1", 8],
      ["mn-primary:accept-identity-links-v1", 5],
      ["mn-primary:retain-primary-disposition-exclusion-v1", 8],
      ["mn-primary:retain-progressive-classification-exclusion-v1", 8],
    ]);
    expect(value.decisions.every((row) => row.review.status === "proposed" && row.review.reviewer === null && row.review.reviewedAt === null && row.review.resolution === null)).toBe(true);
  });

  it.each([
    ["source-absent contest", (value: any) => { const row = value.records[0]; row.contestId = "fabricated"; row.identity.sourceCandidateName = "Fabricated"; }],
    ["single-row winner", (value: any) => { value.records.find((row: any) => row.reviewRecordId === "mn-primary-joint:2024:04").sourceWinnerStatus = "marked_by_source"; }],
    ["nomination", (value: any) => { value.records[0].nominationConclusion = "nominated"; }],
    ["identity approval", (value: any) => { value.records[0].identity.approved = true; }],
    ["geography approval", (value: any) => { value.records[0].geography.approved = true; }],
    ["joint approval", (value: any) => { value.records[0].jointApproved = true; }],
    ["score eligibility", (value: any) => { value.records[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["classification", (value: any) => { value.records[0].progressiveClassificationStatus = "classified"; }],
    ["unknown evaluator value", (value: any) => { value.records[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s escalation", (_label, mutate) => {
    const value = structuredClone(build()) as any;
    mutate(value);
    expect(() => validateMinnesotaPrimaryJointReviewPackage(rehash(value))).toThrow("Minnesota primary joint review rejected");
  });

  it("validates the generated package and, once present, reproduces the persisted artifact", () => {
    const value = build();
    expect(validateMinnesotaPrimaryJointReviewPackage(value)).toEqual(value);
    const path = "data/metadata/minnesota-primary-identity-geography-review-package-v1.json";
    if (existsSync(path)) expect(text(path)).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("rejects parent byte drift and exact source-lock topology drift", () => {
    const parentDrift = input();
    parentDrift.identityJson += " ";
    expect(() => buildMinnesotaPrimaryJointReviewPackage(parentDrift)).toThrow("INPUT_HASH_MISMATCH");
    const lockDrift = input(), lock = JSON.parse(lockDrift.sourceLockJson);
    lock.entries.find((entry: any) => entry.id === "minnesota-primary-identity-geography-review-package-v1").url = "urn:changed";
    lockDrift.sourceLockJson = JSON.stringify(lock);
    expect(() => buildMinnesotaPrimaryJointReviewPackage(lockDrift)).toThrow("SOURCE_LOCK_MISMATCH");
    const parentOrderDrift = input(), parentLock = JSON.parse(parentOrderDrift.sourceLockJson), output = parentLock.entries.find((entry: any) => entry.id === "minnesota-primary-identity-geography-review-package-v1");
    output.parentIds = [...output.parentIds].reverse();
    parentOrderDrift.sourceLockJson = JSON.stringify(parentLock);
    expect(() => buildMinnesotaPrimaryJointReviewPackage(parentOrderDrift)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
