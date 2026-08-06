/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-receipt mutations */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildConnecticutGeneralElectionCrosscheckReceipt,
  validateConnecticutGeneralElectionCrosscheckReceipt,
} from "./connecticut-general-election-crosscheck-receipt";

const sha=(value:Buffer)=>createHash("sha256").update(value).digest("hex"),pdf=(path:string)=>readFileSync(path),text=(path:string)=>execFileSync("pdftotext",["-layout",path,"-"],{encoding:"utf8",maxBuffer:16*1024*1024});
const digest=(domain:string,value:unknown)=>createHash("sha256").update(domain,"ascii").update(canonicalJson(value),"utf8").digest("hex");
const build=(sourceLock=JSON.parse(readFileSync("data/source-lock.json","utf8")))=>{const path2022="data/source/elections/general-results/connecticut/2022-statement-of-vote.pdf",path2024="data/source/elections/general-results/connecticut/2024-statement-of-vote.pdf",bytes2022=pdf(path2022),bytes2024=pdf(path2024);return buildConnecticutGeneralElectionCrosscheckReceipt({pdf2022:bytes2022,pdf2022Sha256:sha(bytes2022),text2022:text(path2022),pdf2024:bytes2024,pdf2024Sha256:sha(bytes2024),text2024:text(path2024),sourceLock});};
const rehash=(value:any)=>{for(const row of value.rows){const unsigned={...row};delete unsigned.rowSha256;row.rowSha256=digest("dsa-seats:ct-general-crosscheck-row:v1\0",unsigned);}value.rowSetSha256=digest("dsa-seats:ct-general-crosscheck-row-set:v1\0",value.rows);const unsigned={...value};delete unsigned.packageSha256;value.packageSha256=digest("dsa-seats:ct-general-crosscheck-package:v1\0",unsigned);return value;};

describe("Connecticut general-election nominee/result cross-check receipt",()=>{
  it("retains ten Democratic appearances and only five exact elected declarations",()=>{
    const value=build();
    expect(value.summary).toEqual({districtCycleRows:10,democraticGeneralElectionAppearances:10,democraticColumnVotes2022:712823,democraticColumnVotes2024:981919,electedDeclarationsPresent:5,electedDeclarationsNotPresentInInstrument:5,primaryNominationConclusions:0,automaticallyApprovedRows:0,scoreEligibleRows:0});
    expect(value.rows).toHaveLength(10);
    expect(value.rows.filter(row=>row.cycleYear===2022).every(row=>row.electedDeclarationStatus==="not_present_in_retained_instrument")).toBe(true);
    expect(value.rows.filter(row=>row.cycleYear===2024).every(row=>row.electedDeclarationStatus==="declared_elected_in_exact_scope_canvass")).toBe(true);
    expect(value.rows.every(row=>row.generalElectionAppearanceStatus==="party_labeled_vote_column_present"&&row.primaryNominationStatus===null&&!row.approved&&!row.scoreEligible)).toBe(true);
    expect(validateConnecticutGeneralElectionCrosscheckReceipt(value)).toEqual(value);
  });

  it("pins the exact district/name/vote observations",()=>{
    expect(build().rows.map(row=>[row.cycleYear,row.districtCode,row.candidateName,row.democraticColumnVotes])).toEqual([[2022,"01","John B. Larson",144873],[2022,"02","Joe Courtney",165946],[2022,"03","Rosa L. DeLauro",137924],[2022,"04","Jim Himes",140262],[2022,"05","Jahana Hayes",123818],[2024,"01","John B. Larson",197788],[2024,"02","Joe Courtney",218294],[2024,"03","Rosa L. DeLauro",193684],[2024,"04","Jim Himes",200791],[2024,"05","Jahana Hayes",171362]]);
  });

  it("rejects output source-lock lineage drift",()=>{const lock=JSON.parse(readFileSync("data/source-lock.json","utf8"));lock.entries.find((entry:{id:string})=>entry.id==="connecticut-general-election-crosscheck-receipt-v1").parentIds=[];expect(()=>build(lock)).toThrow("SOURCE_LOCK_MISMATCH");});

  it.each([
    ["invented 2022 elected declaration",(value:any)=>{value.rows[0].electedDeclarationStatus="declared_elected_in_exact_scope_canvass";}],
    ["invented primary nomination",(value:any)=>{value.rows[0].primaryNominationStatus="nominee";}],
    ["vote substitution",(value:any)=>{value.rows[0].democraticColumnVotes=144874;}],
    ["approval escalation",(value:any)=>{value.rows[0].approved=true;value.rows[0].scoreEligible=true;}],
    ["unexpected top-level nomination conclusion",(value:any)=>{value.nominationConclusion="approved nominee";}],
  ])("rejects a fully rehashed %s",(_label,mutate)=>{const changed=structuredClone(build()) as any;mutate(changed);expect(()=>validateConnecticutGeneralElectionCrosscheckReceipt(rehash(changed))).toThrow("PACKAGE_INVALID");});
});
