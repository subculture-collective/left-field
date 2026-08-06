/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial external-input mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildConnecticutPrimaryGeographyCandidate,
  validateConnecticutPrimaryGeographyCandidate,
} from "./connecticut-primary-geography-compatibility-candidate";

const sha=(value:Buffer)=>createHash("sha256").update(value).digest("hex");
const digest=(domain:string,value:unknown)=>createHash("sha256").update(domain,"ascii").update(canonicalJson(value),"utf8").digest("hex");
const json=(path:string)=>{const bytes=readFileSync(path);return{value:JSON.parse(bytes.toString("utf8")),sha256:sha(bytes)};};
const dbf=(path:string)=>execFileSync("unzip",["-p",path,"*.dbf"],{maxBuffer:4*1024*1024});

function build(options?:{sourceLock?:unknown;cd118Dbf?:Buffer}){
  const proposal=json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt=json("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json");
  const identity=json("data/metadata/connecticut-current-incumbent-nomination-linkage-candidate-v1.json");
  const authority=readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const cd118Path="data/source/tiger2022/tl_2022_09_cd118.zip",cd119Path="data/source/tiger2025/tl_2025_09_cd119.zip";
  const cd118=readFileSync(cd118Path),cd119=readFileSync(cd119Path);
  return buildConnecticutPrimaryGeographyCandidate({proposal:proposal.value,proposalFileSha256:proposal.sha256,receipt:receipt.value,receiptFileSha256:receipt.sha256,identity:identity.value,identityFileSha256:identity.sha256,authorityHtml:authority.toString("utf8"),authorityFileSha256:sha(authority),cd118Zip:cd118,cd118FileSha256:sha(cd118),cd118Dbf:options?.cd118Dbf??dbf(cd118Path),cd119Zip:cd119,cd119FileSha256:sha(cd119),cd119Dbf:dbf(cd119Path),sourceLock:options?.sourceLock??json("data/source-lock.json").value});
}

describe("Connecticut primary geography compatibility candidate",()=>{
  it("builds ten unapproved candidates with a five-and-five evidence partition",()=>{
    const value=build();
    expect(value.summary).toEqual({authorityObservations:10,cd118ToCd119PlanContinuityCandidates:5,exactCd119SessionKeyCandidates:5,compatibilityCandidates:10,automaticallyApprovedRows:0,scoreEligibleRows:0});
    expect(value.rows).toHaveLength(10);
    expect(value.rows.every(row=>row.compatibilityCandidate&&!row.compatibilityApproved&&!row.identityApproved&&!row.scoreEligible)).toBe(true);
    expect(validateConnecticutPrimaryGeographyCandidate(value)).toEqual(value);
  });

  it("keeps continuity evidence distinct from exact-session key evidence",()=>{
    const rows=build().rows;
    expect(rows.filter(row=>row.cycleYear===2022).every(row=>row.historicalCongressSession==="118"&&row.compatibilityDisposition==="official_no_plan_change_declaration_same_geoid_key_candidate"&&row.evidenceClass==="direct_official_plan_continuity_and_derived_key")).toBe(true);
    expect(rows.filter(row=>row.cycleYear===2024).every(row=>row.historicalCongressSession==="119"&&row.compatibilityDisposition==="same_cd119_session_and_geoid_exact_key_candidate"&&row.evidenceClass==="derived_exact_session_and_key")).toBe(true);
  });

  it("binds every row to its nomination and identity parent without creating a nomination conclusion",()=>{
    const value=build();
    expect(value.rows.every(row=>row.nominationStatus===null&&row.resultStatus===null&&row.authorityObservationId.startsWith("ct-nomination:")&&row.identityObservationId.startsWith("ct:identity:"))).toBe(true);
  });

  it("rejects a changed official inventory and source-lock drift",()=>{
    const changed=Buffer.from(dbf("data/source/tiger2022/tl_2022_09_cd118.zip"));changed[changed.length-2]^=1;
    expect(()=>build({cd118Dbf:changed})).toThrow();
    const lock=json("data/source-lock.json").value as any,drift=structuredClone(lock);drift.entries.find((entry:any)=>entry.id==="tiger-cd118-09").kind="derived_artifact";
    expect(()=>build({sourceLock:drift})).toThrow("SOURCE_LOCK_MISMATCH");
    const outputDrift=structuredClone(lock);outputDrift.entries.find((entry:any)=>entry.id==="connecticut-primary-geography-compatibility-candidate-v1").parentIds=[];
    expect(()=>build({sourceLock:outputDrift})).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it.each([
    ["approval and score escalation",0,(row:any)=>{row.compatibilityApproved=true;row.scoreEligible=true;}],
    ["2022 continuity method substitution",0,(row:any)=>{row.compatibilityDisposition="same_cd119_session_and_geoid_exact_key_candidate";row.evidenceClass="derived_exact_session_and_key";}],
    ["invented nomination outcome",5,(row:any)=>{row.nominationStatus="nominee";row.resultStatus="winner";}],
  ])("rejects a fully rehashed %s",(_label,index,mutate)=>{
    const changed=structuredClone(build()) as any;mutate(changed.rows[index as number]);
    const row={...changed.rows[index as number]};delete row.rowSha256;changed.rows[index as number].rowSha256=digest("dsa-seats:ct-primary-geography-row:v1\0",row);
    changed.rowSetSha256=digest("dsa-seats:ct-primary-geography-row-set:v1\0",changed.rows);const unsigned={...changed};delete unsigned.packageSha256;changed.packageSha256=digest("dsa-seats:ct-primary-geography-candidate:v1\0",unsigned);
    expect(()=>validateConnecticutPrimaryGeographyCandidate(changed)).toThrow("RETAINED_FACT_INVALID");
  });
});
