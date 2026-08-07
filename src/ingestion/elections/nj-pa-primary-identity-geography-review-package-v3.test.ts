/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNjPaPrimaryIdentityGeographyReviewPackageV3, validateNjPaPrimaryIdentityGeographyReviewPackageV3 } from "./nj-pa-primary-identity-geography-review-package-v3";

const input = () => ({
  jointV2Json: readFileSync("data/metadata/nj-pa-primary-identity-geography-review-package-v2.json", "utf8"),
  assessmentJson: readFileSync("data/metadata/nj-pa-primary-certification-availability-assessment-v1.json", "utf8"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});
const build = () => buildNjPaPrimaryIdentityGeographyReviewPackageV3(input());

describe("NJ/PA primary identity/geography review package v3", () => {
  it("attaches bounded certification availability to 41 parent rows without creating a reconciliation", () => {
    const value = build();
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
      certificationAvailabilityAttachedRecords: 41,
      njOfficialResultCandidateRecords: 27,
      paDepartmentExtractCandidateRecords: 14,
      statewideCertificationContextRetainedRecords: 7,
      exactResultCertificationReconciledRecords: 0,
      stateCyclesAssessed: 6,
      jointStateCyclesCovered: 5,
      assessmentOnlyStateCycles: 1,
      missingResultStateCycles: 1,
      parentDecisionReviews: 3,
      authorityApprovals: 0,
      automaticApprovals: 0,
      scoreEligibleRows: 0,
    });
  });

  it("preserves every parent row and joins only its exact state-cycle assessment", () => {
    const value = build(), parent = JSON.parse(input().jointV2Json), assessment = JSON.parse(input().assessmentJson);
    expect(value.rows).toHaveLength(41);
    for (const row of value.rows) {
      const prior = parent.rows.find((candidate: any) => candidate.linkageId === row.linkageId);
      const authority = assessment.rows.find((candidate: any) => candidate.stateCode === row.stateCode && candidate.cycleYear === row.cycleYear);
      expect(row.parentV2RowSha256).toBe(prior.rowSha256);
      expect(row.certificationAvailability).toMatchObject({ stateCycleId: `${row.stateCode}:${row.cycleYear}`, assessmentRowSha256: authority.rowSha256, exactResultCertificationReconciled: false, authorityApproved: false, scoreEligible: false });
      expect(row.identity).toEqual(prior.identity);
      expect(row.geography).toEqual(prior.geography);
      expect(row).toMatchObject({ identityApproved: false, geographyApproved: false, jointApproved: false, scoreEligible: false });
    }
    expect(value.authorityOnlyStateCycles).toEqual([expect.objectContaining({ stateCycleId: "PA:2026", resultReceiptSourceLockId: null, exactResultBytesRetained: false, exactResultCertificationReconciled: false, automaticApproval: false, scoreEligible: false })]);
  });

  it("adds only an inherited unresolved authority review", () => {
    const value = build();
    expect(value.parentDecisionReviews.map((item: any) => item.reviewOfDecisionId)).toEqual(["approve-historic-primary-candidate-identity-resolution-v1", "approve-historical-district-cd119-compatibility-v1", "collect-official-state-primary-results-and-certification-v1"]);
    expect(value.parentDecisionReviews.every((item: any) => item.parentResolution === null && item.proposedResolution === null && item.reviewer === null && item.reviewedAt === null)).toBe(true);
    expect(value.parentDecisionReviews[2]).toMatchObject({ inherited: true, createsIndependentDecision: false });
    expect(value.methodology).toMatchObject({ compositionOnly: true, parentRowsSemanticallyPreserved: true, authorityJoinedByStateAndCycleOnly: true, availabilityIsNotCertification: true, exactResultCertificationReconciliationClaimed: false, pa2026ResultRowCreated: false, automaticDecisionClosure: false, evaluatorNumericValues: 0 });
  });

  it("reproduces the persisted artifact once present", () => {
    const value = build();
    expect(validateNjPaPrimaryIdentityGeographyReviewPackageV3(value, input())).toEqual(value);
    const path = "data/metadata/nj-pa-primary-identity-geography-review-package-v3.json";
    if (existsSync(path)) expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("rejects parent bytes and exact direct/output source-lock topology drift", () => {
    for (const key of ["jointV2Json", "assessmentJson"] as const) { const value = input(); value[key] += " "; expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV3(value)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V3_INVALID:input_bytes"); }
    const parentLock = input(); parentLock.sourceLock.entries.find((entry: any) => entry.id === "nj-pa-primary-certification-availability-assessment-v1").parentIds = [];
    expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV3(parentLock)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V3_INVALID:source_lock");
    const outputEntry = input().sourceLock.entries.find((entry: any) => entry.id === "nj-pa-primary-identity-geography-review-package-v3");
    if (outputEntry) { const outputLock = input(); outputLock.sourceLock.entries.find((entry: any) => entry.id === "nj-pa-primary-identity-geography-review-package-v3").parentIds.reverse(); expect(() => buildNjPaPrimaryIdentityGeographyReviewPackageV3(outputLock)).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V3_INVALID:source_lock"); }
  });

  it.each([
    ["certification reconciliation", (value: any) => { value.rows[0].certificationAvailability.exactResultCertificationReconciled = true; }],
    ["PA 2024 certification promotion", (value: any) => { value.rows.find((row: any) => row.stateCode === "PA" && row.cycleYear === 2024).certificationAvailability.certificationContextStatus = "exact_extract_certified"; }],
    ["NJ certificate fabrication", (value: any) => { value.rows.find((row: any) => row.stateCode === "NJ").certificationAvailability.certificationContextStatus = "post_canvass_secretary_certificate_retained"; }],
    ["PA 2026 result fabrication", (value: any) => { value.authorityOnlyStateCycles[0].resultReceiptSourceLockId = "invented"; value.authorityOnlyStateCycles[0].exactResultBytesRetained = true; }],
    ["authority approval", (value: any) => { value.rows[0].certificationAvailability.authorityApproved = true; }],
    ["identity approval", (value: any) => { value.rows[0].identityApproved = true; }],
    ["geography approval", (value: any) => { value.rows[0].geographyApproved = true; }],
    ["joint approval", (value: any) => { value.rows[0].jointApproved = true; }],
    ["score", (value: any) => { value.rows[0].scoreEligible = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["review resolution", (value: any) => { value.parentDecisionReviews[2].proposedResolution = "approved"; }],
    ["independent decision", (value: any) => { value.parentDecisionReviews[2].createsIndependentDecision = true; }],
    ["unknown evaluator field", (value: any) => { value.rows[0].opportunityScore = 99; }],
  ])("rejects %s semantic escalation even with coherent in-package mutations", (_label, mutate) => {
    const value = structuredClone(build()) as any;
    mutate(value);
    expect(() => validateNjPaPrimaryIdentityGeographyReviewPackageV3(value, input())).toThrow("NJ_PA_PRIMARY_JOINT_REVIEW_V3_INVALID:semantic_or_hash_drift");
  });
});
