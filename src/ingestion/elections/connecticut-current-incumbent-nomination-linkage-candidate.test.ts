/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-candidate mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConnecticutNominationIdentityCandidate, validateConnecticutNominationIdentityCandidate } from "./connecticut-current-incumbent-nomination-linkage-candidate";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const load = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), text: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const loadText = (path: string) => { const bytes = readFileSync(path); return { text: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const digest = (domain:string,value:unknown) => createHash("sha256").update(domain,"ascii").update(canonicalJson(value),"utf8").digest("hex");
const rehash = (changed:any,rowIndex=0) => {
  const row={...changed.observations[rowIndex]};
  delete row.rowSha256;
  changed.observations[rowIndex].rowSha256=digest("dsa-seats:ct-nomination-identity-row:v1\0",row);
  changed.observationSetSha256=digest("dsa-seats:ct-nomination-identity-row-set:v1\0",changed.observations);
  const unsigned={...changed};
  delete unsigned.packageSha256;
  delete unsigned.observationSetSha256;
  changed.packageSha256=digest("dsa-seats:ct-nomination-identity-package:v1\0",unsigned);
  return changed;
};
const build = () => {
  const roster=load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposal=load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), house=loadText("data/source/identity/house-member-data.xml"), congress=load("data/source/identity/congress-legislators-current-20260804.json"), receipt=load("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json"), sourceLock=load("data/source-lock.json");
  return buildConnecticutNominationIdentityCandidate({ roster:roster.value, rosterFileSha256:roster.sha256, proposal:proposal.value, proposalFileSha256:proposal.sha256, houseXml:house.text, houseFileSha256:house.sha256, congressJson:congress.text, congressFileSha256:congress.sha256, receipt:receipt.value, receiptFileSha256:receipt.sha256, sourceLock:sourceLock.value });
};

describe("Connecticut current-incumbent nomination linkage candidate", () => {
  it("links ten endorsement observations with an eight-exact two-derived partition and no nomination conclusion", () => {
    const value = build();
    expect(value).toEqual(validateConnecticutNominationIdentityCandidate(load("data/metadata/connecticut-current-incumbent-nomination-linkage-candidate-v1.json").value));
    expect(value.summary).toEqual({ targetSeats:5, authorityObservations:10, exactNameObservations:8, derivedNameRelationships:2, uniqueDerivedIdentityRelationships:1, proposedIdentityLinks:10, directIdentifierBridges:0, nominationConclusions:0, resultConclusions:0, automaticallyApprovedRows:0, selectedRows:0, scoreEligibleRows:0 });
    expect(value.observations).toHaveLength(10);
    expect(value.observations.every((row) => row.endorsementCandidate.formSelection === "endorsed" && row.endorsementCandidate.nominationStatus === null && row.endorsementCandidate.resultStatus === null && !row.identityApproved && !row.selected && !row.scoreEligible)).toBe(true);
    expect(value.observations.filter((row) => row.evidenceClass === "derived_name_relationship").map((row) => [row.cycleYear,row.districtCode,row.rosterIdentity.officialHouseName,row.endorsementCandidate.candidateName,row.matchMethod])).toEqual([[2022,"04","James A. Himes","Jim Himes","source_shortened_first_name_and_omitted_middle_initial_same_district"],[2024,"04","James A. Himes","Jim Himes","source_shortened_first_name_and_omitted_middle_initial_same_district"]]);
    expect(validateConnecticutNominationIdentityCandidate(value)).toEqual(value);
  });

  it("rejects source-lock and parent lifecycle substitution", () => {
    const sourceLock=load("data/source-lock.json").value, changedLock=structuredClone(sourceLock), changedReceipt=structuredClone(load("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json").value);
    changedLock.entries.find((entry:{id:string})=>entry.id==="house-xml").kind="derived_artifact";
    const base=()=>{const roster=load("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),proposal=load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),house=loadText("data/source/identity/house-member-data.xml"),congress=load("data/source/identity/congress-legislators-current-20260804.json"),receipt=load("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json");return{roster:roster.value,rosterFileSha256:roster.sha256,proposal:proposal.value,proposalFileSha256:proposal.sha256,houseXml:house.text,houseFileSha256:house.sha256,congressJson:congress.text,congressFileSha256:congress.sha256,receipt:receipt.value,receiptFileSha256:receipt.sha256,sourceLock};};
    expect(()=>buildConnecticutNominationIdentityCandidate({...base(),sourceLock:changedLock})).toThrow("SOURCE_LOCK_MISMATCH");
    changedReceipt.review.status="approved";
    expect(()=>buildConnecticutNominationIdentityCandidate({...base(),receipt:changedReceipt})).toThrow("PARENT_LIFECYCLE_INVALID");
  });

  it("rejects fully rehashed nomination and selection escalation", () => {
    const changed=structuredClone(build()) as any; changed.observations[0].endorsementCandidate.nominationStatus="nominee"; changed.observations[0].selected=true;
    expect(()=>validateConnecticutNominationIdentityCandidate(rehash(changed))).toThrow("RETAINED_FACT_INVALID");
  });

  it.each([
    ["candidate name",0,(row:any)=>{row.endorsementCandidate.candidateName="Substituted Candidate";}],
    ["derived match method",3,(row:any)=>{row.matchMethod="exact_normalized_official_house_name_same_district";}],
    ["derived evidence class",3,(row:any)=>{row.evidenceClass="exact_name_observation";}],
    ["parent observation id",0,(row:any)=>{row.authorityObservationId="ct-nomination:2022:99:democratic";}],
    ["parent observation hash",0,(row:any)=>{row.authorityObservationSha256="0".repeat(64);}],
    ["form selection",0,(row:any)=>{row.endorsementCandidate.formSelection="ballot";}],
  ])("rejects a fully rehashed %s substitution",(_label,rowIndex,mutate)=>{
    const changed=structuredClone(build()) as any;
    mutate(changed.observations[rowIndex as number]);
    expect(()=>validateConnecticutNominationIdentityCandidate(rehash(changed,rowIndex as number))).toThrow("RETAINED_FACT_INVALID");
  });

  it.each([
    ["reviewer-only boundary",(value:any)=>{value.reviewerOnly=false;}],
    ["review attribution",(value:any)=>{value.review.reviewer="Auditor";value.review.reviewedAt="2026-08-06T12:00:00.000Z";value.review.resolution="approved";}],
    ["default evaluator use",(value:any)=>{value.defaultUse="use_in_evaluator";}],
    ["limitations",(value:any)=>{value.limitations=["This establishes a nominee and a certified result."];}],
    ["unexpected conclusion",(value:any)=>{value.nominationConclusion="approved nominee";}],
  ])("rejects a fully rehashed top-level %s substitution",(_label,mutate)=>{
    const changed=structuredClone(build()) as any;
    mutate(changed);
    expect(()=>validateConnecticutNominationIdentityCandidate(rehash(changed))).toThrow("PACKAGE_INVARIANT_INVALID");
  });
});
