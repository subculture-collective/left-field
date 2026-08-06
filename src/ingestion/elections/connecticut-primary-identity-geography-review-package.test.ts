/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildConnecticutPrimaryJointReviewPackage,
  validateConnecticutPrimaryJointReviewPackage,
} from "./connecticut-primary-identity-geography-review-package";

const text=(path:string)=>readFileSync(path,"utf8");
const digest=(domain:string,value:unknown)=>createHash("sha256").update(domain,"ascii").update(canonicalJson(value),"utf8").digest("hex");
const rehash=(value:any)=>{for(const record of value.records){const unsigned={...record};delete unsigned.reviewRecordSha256;record.reviewRecordSha256=digest("dsa-seats:ct-primary-joint-review-row:v1\0",unsigned);}value.reviewRecordSetSha256=digest("dsa-seats:ct-primary-joint-review-row-set:v1\0",value.records);value.decisionSetSha256=digest("dsa-seats:ct-primary-joint-review-decision-set:v1\0",value.decisions);const unsigned={...value};delete unsigned.packageSha256;value.packageSha256=digest("dsa-seats:ct-primary-joint-review-package:v1\0",unsigned);return value;};
const build=(sourceLockJson=text("data/source-lock.json"))=>buildConnecticutPrimaryJointReviewPackage({proposalJson:text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),identityJson:text("data/metadata/connecticut-current-incumbent-nomination-linkage-candidate-v1.json"),geographyJson:text("data/metadata/connecticut-primary-geography-compatibility-candidate-v1.json"),sourceLockJson});

describe("Connecticut primary identity/geography joint reviewer package",()=>{
  it("joins ten identity-and-geography candidates into five independent proposed decisions",()=>{
    const value=build();
    expect(value.summary).toEqual({reviewRecords:10,identityAndGeographyCandidates:10,exactIdentityObservations:8,derivedIdentityObservations:2,uniqueDerivedIdentityRelationships:1,cd118ContinuityCandidates:5,exactCd119KeyCandidates:5,nominationConclusions:0,resultConclusions:0,proposedDecisions:5,jointApprovedRecords:0,scoreEligibleRecords:0});
    expect(value.records).toHaveLength(10);
    expect(value.decisions.map(decision=>decision.decisionId)).toEqual(["ct-primary:accept-geography-compatibility-v1","ct-primary:accept-identity-links-v1","ct-primary:retain-endorsement-nomination-result-certification-exclusion-v1","ct-primary:retain-nomination-disposition-selection-exclusion-v1","ct-primary:retain-progressive-classification-exclusion-v1"]);
    expect(value.records.every(record=>record.reviewCategory==="identity_and_geography_candidates_pending_nomination_closure"&&!record.identity.identityApproved&&!record.geography.compatibilityApproved&&!record.jointApproved&&!record.scoreEligible)).toBe(true);
    expect(value.decisions.every(decision=>decision.review.resolution===null)).toBe(true);
    expect(validateConnecticutPrimaryJointReviewPackage(value)).toEqual(value);
  });

  it("preserves null nomination and result states across every join",()=>{
    expect(build().records.every(record=>record.nominationStatus===null&&record.resultStatus===null)).toBe(true);
  });

  it("rebuilds the persisted package and rejects output lineage drift",()=>{
    expect(build()).toEqual(validateConnecticutPrimaryJointReviewPackage(JSON.parse(text("data/metadata/connecticut-primary-identity-geography-review-package-v1.json"))));
    const lock=JSON.parse(text("data/source-lock.json"));lock.entries.find((entry:{id:string})=>entry.id==="connecticut-primary-identity-geography-review-package-v1").parentIds=[];
    expect(()=>build(JSON.stringify(lock))).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it.each([
    ["identity parent hash",(value:any)=>{value.records[0].identity.parentRowSha256="0".repeat(64);}],
    ["Himes evidence class",(value:any)=>{value.records[3].identity.evidenceClass="exact_name_observation";}],
    ["geography parent hash",(value:any)=>{value.records[0].geography.parentRowSha256="0".repeat(64);}],
    ["2022 geography disposition",(value:any)=>{value.records[0].geography.compatibilityDisposition="same_cd119_session_and_geoid_exact_key_candidate";}],
    ["unknown nested record field",(value:any)=>{value.records[0].identity.nominee=true;}],
    ["default evaluator use",(value:any)=>{value.defaultUse="evaluator_enabled";}],
    ["source cutoff",(value:any)=>{value.sourceCutoff="2099-01-01";}],
    ["unexpected top-level conclusion",(value:any)=>{value.nominationConclusion="approved nominee";}],
    ["decision parent",(value:any)=>{value.decisions[0].parentDecisionId="approve-regular-democratic-primary-selection-rule-v1";}],
    ["decision question",(value:any)=>{value.decisions[0].question="Publish certified winners?";}],
    ["decision recommendation",(value:any)=>{value.decisions[0].recommendedDecision="Approve evaluator use.";}],
    ["decision confidence",(value:any)=>{value.decisions[0].confidence="low";}],
    ["decision review approval",(value:any)=>{value.decisions[0].review={status:"approved",reviewer:"Auditor",reviewedAt:"2026-08-06T12:00:00.000Z",resolution:"approved"};}],
    ["unknown decision field",(value:any)=>{value.decisions[0].nominationConclusion="approved";}],
  ])("rejects a fully rehashed %s substitution",(_label,mutate)=>{
    const changed=structuredClone(build()) as any;mutate(changed);
    expect(()=>validateConnecticutPrimaryJointReviewPackage(rehash(changed))).toThrow("PACKAGE_INVALID");
  });
});
