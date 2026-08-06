/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-artifact mutations */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIllinoisPrimaryIdentityGeographyReviewPackageV2, validateIllinoisPrimaryIdentityGeographyReviewPackageV2 } from "./illinois-primary-identity-geography-review-package-v2";

const artifact = "data/metadata/illinois-primary-identity-geography-review-package-v2.json";
function input() { return { jointV1Json: readFileSync("data/metadata/illinois-primary-identity-geography-review-package-v1.json", "utf8"), authorityJson: readFileSync("data/metadata/illinois-primary-state-board-certification-authority-receipt-v1.json", "utf8"), sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")) }; }
const load = () => JSON.parse(readFileSync(artifact, "utf8"));

describe("Illinois primary identity/geography joint reviewer package v2", () => {
  it("replays the retained composition from exact immutable parents", () => expect(buildIllinoisPrimaryIdentityGeographyReviewPackageV2(input())).toEqual(validateIllinoisPrimaryIdentityGeographyReviewPackageV2(load(), input())));

  it("attaches election-level certification authority to all 34 records without changing identity or geography", () => {
    const value = load(), parent = JSON.parse(input().jointV1Json);
    expect(value.summary).toEqual({ reviewRecords: 34, identityAndGeographyCandidates: 28, geographyCandidateIdentityOutsideCurrentTargetScope: 6, electionLevelCertificationAuthorityCandidates: 34, certificationApprovals: 0, jointApprovedRecords: 0, scoreEligibleRecords: 0, proposedDecisions: 4 });
    expect(value.records).toHaveLength(34);
    for (const row of value.records) {
      const prior = parent.records.find((candidate: any) => candidate.reviewRecordId === row.reviewRecordId);
      expect(row.parentReviewRecordSha256).toBe(prior.reviewRecordSha256);
      expect(row.identity).toEqual(prior.identity);
      expect(row.geography).toEqual(prior.geography);
      expect(row.certification).toMatchObject({ status: "election_level_authority_candidate", authorityCandidate: true, approved: false, individualContestCertificateRetained: false, candidateCertificationByNameClaimed: false });
      expect(row).toMatchObject({ jointApproved: false, scoreEligible: false, publicationEligible: false });
    }
  });

  it("replaces only the obsolete certification-acquisition decision and keeps all reviews null", () => {
    const value = load();
    expect(value.decisions.map((decision: any) => decision.decisionId)).toEqual(["il-primary:accept-election-level-certification-authority-v2", "il-primary:accept-geography-compatibility-v1", "il-primary:accept-identity-links-v1", "il-primary:retain-progressive-classification-exclusion-v1"]);
    expect(value.decisions.find((decision: any) => decision.decisionId.includes("certification"))).toMatchObject({ recommendedDecision: "Accept election-level State Board certification authority for all 34 records without claiming individual contest certificates or candidate-by-name certification.", defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication", evidenceRecordIds: expect.any(Array), review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null } });
    expect(value.decisions.every((decision: any) => decision.review.resolution === null)).toBe(true);
    expect(value.methodology).toMatchObject({ compositionOnly: true, parentRecordsMutated: false, electionAuthorityReplacesNotRetainedProjection: true, authorityAcceptanceAutomaticallyApprovesRecords: false, automaticDecisionClosure: false, evaluatorNumericValues: 0 });
  });

  it("fails closed on parent, source-lock, record, decision, and lifecycle drift", () => {
    for (const key of ["jointV1Json", "authorityJson"] as const) { const value=input(); value[key]+=" "; expect(()=>buildIllinoisPrimaryIdentityGeographyReviewPackageV2(value)).toThrow(/IL_PRIMARY_JOINT_REVIEW_V2_INVALID/); }
    const lock=input(); lock.sourceLock.entries.find((entry:any)=>entry.id==="illinois-primary-state-board-certification-authority-receipt-v1").parentIds=[]; expect(()=>buildIllinoisPrimaryIdentityGeographyReviewPackageV2(lock)).toThrow(/IL_PRIMARY_JOINT_REVIEW_V2_INVALID/);
    const mutations=[(value:any)=>{value.records[0].identity.bioguideId="invented";},(value:any)=>{value.records[0].certification.approved=true;},(value:any)=>{value.records[0].scoreEligible=true;},(value:any)=>{value.decisions[0].review.resolution="approved";},(value:any)=>{value.methodology.authorityAcceptanceAutomaticallyApprovesRecords=true;},(value:any)=>{value.publicationEligible=true;},(value:any)=>{value.packageSha256="0".repeat(64);}];
    for(const mutate of mutations){const value=structuredClone(load());mutate(value);expect(()=>validateIllinoisPrimaryIdentityGeographyReviewPackageV2(value,input())).toThrow(/IL_PRIMARY_JOINT_REVIEW_V2_INVALID/);}
  });
});
