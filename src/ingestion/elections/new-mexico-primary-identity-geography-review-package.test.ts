/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewMexicoPrimaryJointReviewPackage, validateNewMexicoPrimaryJointReviewPackage } from "./new-mexico-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const input = () => ({ proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), identityJson: text("data/metadata/new-mexico-current-incumbent-primary-linkage-candidate-v1.json"), geographyJson: text("data/metadata/new-mexico-primary-geography-compatibility-candidate-v1.json"), sourceLockJson: text("data/source-lock.json") });
const build = () => buildNewMexicoPrimaryJointReviewPackage(input());
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any): any => {
  for (const row of value.records) { const unsigned = structuredClone(row); delete unsigned.reviewRecordSha256; row.reviewRecordSha256 = digest("dsa-seats:nm-primary-joint-row:v1\0", unsigned); }
  value.reviewRecordSetSha256 = digest("dsa-seats:nm-primary-joint-row-set:v1\0", value.records);
  value.decisionSetSha256 = digest("dsa-seats:nm-primary-joint-decision-set:v1\0", value.decisions);
  const unsigned = structuredClone(value); delete unsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:nm-primary-joint-package:v1\0", unsigned);
  return value;
};

describe("New Mexico primary identity/geography joint review package", () => {
  it("preserves six joint candidates and three CD120 geography-pending identity candidates", () => {
    const value = build();
    expect(value.summary).toEqual({ reviewRecords: 9, identityAndGeographyCandidates: 6, identityCandidateCd120GeographyPending: 3, officialAuthorityRecords: 9, identityCandidates: 9, geographyCandidates: 6, exactIdentityCandidates: 3, derivedIdentityCandidates: 6, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.filter((row) => row.reviewCategory === "identity_and_geography_candidates")).toHaveLength(6);
    expect(value.records.filter((row) => row.reviewCategory === "identity_candidate_cd120_geography_pending")).toHaveLength(3);
    expect(value.records.filter((row) => row.cycleYear === 2026).every((row) => row.identityCandidate && !row.geographyCandidate && row.historicalCongressSession === "120" && row.historicalGeoid === null && row.geographyEvidenceClass === "authority_pending" && row.geographyConfidence === "none")).toBe(true);
  });

  it("preserves exact identity and authority boundaries with five independent scopes", () => {
    const value = build();
    expect(value.records.filter((row) => row.identityEvidenceClass === "exact_name_observation")).toHaveLength(3);
    expect(value.records.filter((row) => row.identityEvidenceClass === "derived_name_relationship")).toHaveLength(6);
    expect(value.records.every((row) => !row.directIdentifierBridgeAvailable && row.resultAuthorityStatus === "secretary_official_federal_results_export_retained" && row.sourceWinnerStatus === "not_marked_by_source" && row.winnerConclusion === null && row.nominationConclusion === null && row.resultConclusion === null)).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2022).every((row) => row.certificationStatus === "official_results_archive_retained_no_separate_signed_certificate")).toBe(true);
    expect(value.records.filter((row) => row.cycleYear !== 2022).every((row) => row.certificationStatus === "state_canvass_certification_announcement_retained_exact_certificate_bytes_not_retained")).toBe(true);
    expect(value.decisions.map((decision) => [decision.decisionId, decision.evidenceRecordIds.length])).toEqual([
      ["nm-primary:accept-official-result-authority-v1", 9],
      ["nm-primary:accept-geography-compatibility-v1", 9],
      ["nm-primary:accept-identity-links-v1", 9],
      ["nm-primary:retain-primary-disposition-exclusion-v1", 9],
      ["nm-primary:retain-progressive-classification-exclusion-v1", 9],
    ]);
  });

  it("reproduces the persisted artifact exactly", () => {
    const value = build();
    expect(validateNewMexicoPrimaryJointReviewPackage(value)).toEqual(value);
    expect(text("data/metadata/new-mexico-primary-identity-geography-review-package-v1.json")).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it.each([
    ["CD120 geography escalation", (value: any) => { const row = value.records[6]; row.historicalGeoid = row.targetCd119Geoid; row.geographyCandidate = true; row.reviewCategory = "identity_and_geography_candidates"; }],
    ["derived identity relabeled exact", (value: any) => { value.records[0].identityEvidenceClass = "exact_name_observation"; }],
    ["direct identifier bridge", (value: any) => { value.records[0].directIdentifierBridgeAvailable = true; }],
    ["source winner", (value: any) => { value.records[0].sourceWinnerStatus = "marked_by_source"; }],
    ["winner conclusion", (value: any) => { value.records[0].winnerConclusion = "won"; }],
    ["nomination conclusion", (value: any) => { value.records[0].nominationConclusion = "nominated"; }],
    ["certification escalation", (value: any) => { value.records[0].certificationStatus = "signed_candidate_certificate_retained"; }],
    ["identity approval", (value: any) => { value.records[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.records[0].geographyApproved = true; }],
    ["joint approval", (value: any) => { value.records[0].jointApproved = true; }],
    ["score eligibility", (value: any) => { value.records[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["classification", (value: any) => { value.records[0].progressiveClassificationStatus = "classified"; }],
    ["fabricated reviewer", (value: any) => { value.review.reviewer = "fabricated"; }],
    ["unknown evaluator value", (value: any) => { value.records[0].opportunityScore = 99; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateNewMexicoPrimaryJointReviewPackage(rehash(value))).toThrow("New Mexico primary joint review rejected"); });

  it("rejects parent bytes and exact source-lock topology drift", () => {
    const parentDrift = input(); parentDrift.identityJson += " ";
    expect(() => buildNewMexicoPrimaryJointReviewPackage(parentDrift)).toThrow("INPUT_HASH_MISMATCH");
    for (const [id, mutate] of [
      ["new-mexico-current-incumbent-primary-linkage-candidate-v1", (entry: any) => { entry.url += "?drift"; }],
      ["new-mexico-primary-geography-compatibility-candidate-v1", (entry: any) => { entry.parentIds.reverse(); }],
      ["new-mexico-primary-identity-geography-review-package-v1", (entry: any) => { entry.parentIds.reverse(); }],
    ] as const) {
      const changed = input(), lock = JSON.parse(changed.sourceLockJson); mutate(lock.entries.find((entry: any) => entry.id === id)); changed.sourceLockJson = JSON.stringify(lock);
      expect(() => buildNewMexicoPrimaryJointReviewPackage(changed)).toThrow("SOURCE_LOCK_MISMATCH");
    }
  });
});
