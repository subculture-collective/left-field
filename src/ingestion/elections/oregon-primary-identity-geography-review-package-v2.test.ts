/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-package mutations */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOregonPrimaryJointPackageV2, validateOregonPrimaryJointPackageV2 } from "./oregon-primary-identity-geography-review-package-v2";

const input=()=>{const base="data/source/elections/primary-results/geography/oregon/2026";return{jointV1Json:readFileSync("data/metadata/oregon-primary-identity-geography-review-package-v1.json","utf8"),geographyV2Json:readFileSync("data/metadata/oregon-primary-geography-compatibility-candidate-v2.json","utf8"),geographyV1Json:readFileSync("data/metadata/oregon-primary-geography-compatibility-candidate-v1.json","utf8"),authorityReceiptJson:readFileSync("data/metadata/oregon-2026-congressional-plan-authority-receipt-v1.json","utf8"),redistrictingPageBytes:readFileSync(`${base}/redistricting.html`),enrolledBillBytes:readFileSync(`${base}/sb881-enrolled.pdf`),enrolledBillTextBytes:readFileSync(`${base}/sb881-enrolled.txt`),mapGuideBytes:readFileSync(`${base}/interactive-map-data.pdf`),mapGuideTextBytes:readFileSync(`${base}/interactive-map-data.txt`),currentBlocksBytes:readFileSync("data/source/elections/primary-results/geography/oregon/current/41_OR_CD119.txt"),sourceLock:JSON.parse(readFileSync("data/source-lock.json","utf8"))}};

describe("Oregon primary joint review v2",()=>{
  it("composes all fifteen geography candidates while preserving every identity and record coordinate",()=>{
    const value=buildOregonPrimaryJointPackageV2(input());
    expect(value.summary).toEqual({reviewRecords:15,identityAndGeographyCandidates:13,geographyCandidateIdentityUnresolved:2,identityCandidates:13,geographyCandidates:15,jointApprovedRecords:0,scoreEligibleRecords:0});
    const parent=JSON.parse(readFileSync("data/metadata/oregon-primary-identity-geography-review-package-v1.json","utf8"));
    const byId=new Map(parent.records.map((record:any)=>[record.reviewRecordId,record]));
    for(const record of value.records){const previous=byId.get(record.reviewRecordId) as any;expect(record.identity).toEqual(previous.identity);expect(record.parentReviewRecordSha256).toBe(previous.reviewRecordSha256);for(const key of ["reviewRecordId","contestId","contestSha256","seatCycleId","districtCode","cycleYear"] as const)expect(record[key]).toBe(previous[key]);}
    const current=value.records.filter(record=>record.cycleYear===2026);
    expect(current).toHaveLength(5);
    expect(current.every(record=>record.geography.historicalGeoid===null&&record.geography.candidate&&record.geography.planContinuityEvidence!==null&&!record.geography.planContinuityEvidence.sourcePlanToCd119ExactBlockConcordanceAssessed)).toBe(true);
    expect(value.decisionSupport.resolutions).toEqual({identity:null,geography:null});
    expect(value.records.every(record=>!record.identity.identityApproved&&!record.geography.approved&&!record.jointApproved&&!record.scoreEligible)).toBe(true);
    expect(Buffer.from(`${JSON.stringify(value,null,2)}\n`)).toEqual(readFileSync("data/metadata/oregon-primary-identity-geography-review-package-v2.json"));
  });

  it("rejects both parent byte streams and required parent or output lock drift",()=>{
    const joint=input();joint.jointV1Json+=" ";expect(()=>buildOregonPrimaryJointPackageV2(joint)).toThrow("OREGON_PRIMARY_JOINT_V2_INVALID:input_bytes");
    const geography=input();geography.geographyV2Json+=" ";expect(()=>buildOregonPrimaryJointPackageV2(geography)).toThrow("OREGON_PRIMARY_JOINT_V2_INVALID:input_bytes");
    const parentLock=input();parentLock.sourceLock.entries.find((entry:{id:string})=>entry.id==="oregon-primary-geography-compatibility-candidate-v2").parentIds=[];expect(()=>buildOregonPrimaryJointPackageV2(parentLock)).toThrow();
    const outputLock=input();outputLock.sourceLock.entries.find((entry:{id:string})=>entry.id==="oregon-primary-identity-geography-review-package-v2").parentIds=[];expect(()=>buildOregonPrimaryJointPackageV2(outputLock)).toThrow("OREGON_PRIMARY_JOINT_V2_INVALID");
  });

  it("rejects concordance invention, approvals, scoring, publication, review closure, and unknown fields",()=>{
    const currentInput=input(),base=buildOregonPrimaryJointPackageV2(currentInput);
    const mutations=[(v:any)=>{v.records[0].jointApproved=true},(v:any)=>{v.records[0].geography.approved=true},(v:any)=>{v.records[0].scoreEligible=true},(v:any)=>{v.publicationEligible=true},(v:any)=>{v.review.reviewer="fabricated"},(v:any)=>{v.decisionSupport.resolutions.geography="approved"},(v:any)=>{v.records.find((r:any)=>r.cycleYear===2026).geography.historicalGeoid="4101"},(v:any)=>{v.records.find((r:any)=>r.cycleYear===2026).geography.planContinuityEvidence.sourcePlanToCd119ExactBlockConcordanceAssessed=true},(v:any)=>{v.unexpected=true}];
    for(const mutate of mutations){const value=structuredClone(base);mutate(value);expect(()=>validateOregonPrimaryJointPackageV2(value,currentInput)).toThrow("OREGON_PRIMARY_JOINT_V2_INVALID:semantic_or_hash_drift")}
  });
});
