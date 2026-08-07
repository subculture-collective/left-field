/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildNewMexicoPrimaryIdentityCandidate, validateNewMexicoPrimaryIdentityCandidate } from "./new-mexico-current-incumbent-primary-linkage-candidate";

const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { bytes, value: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) }; };
const input = () => { const roster=json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"),proposal=json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),receipt=json("data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json"),house=readFileSync("data/source/identity/house-member-data.xml"),congress=readFileSync("data/source/identity/congress-legislators-current-20260804.json"); return { roster:roster.value,rosterFileSha256:roster.hash,proposal:proposal.value,proposalFileSha256:proposal.hash,receipt:receipt.value,receiptFileSha256:receipt.hash,houseXml:house.toString("utf8"),houseFileSha256:sha(house),congressJson:congress.toString("utf8"),congressFileSha256:sha(congress),sourceLock:json("data/source-lock.json").value }; };
const stored = () => json("data/metadata/new-mexico-current-incumbent-primary-linkage-candidate-v1.json").value as any;
const digest=(domain:string,value:unknown)=>createHash("sha256").update(domain,"ascii").update(canonicalJson(value),"utf8").digest("hex");
function rehash(value:any){for(const row of value.observations){const rest={...row};delete rest.rowSha256;row.rowSha256=digest("dsa-seats:nm-primary-identity-row:v1\0",rest)}value.observationSetSha256=digest("dsa-seats:nm-primary-identity-row-set:v1\0",value.observations);const unsigned={...value};delete unsigned.packageSha256;value.packageSha256=digest("dsa-seats:nm-primary-identity-candidate:v1\0",unsigned);return value}

describe("New Mexico current-incumbent primary linkage candidate",()=>{
  it("partitions nine observations into three exact and six documented derived links",()=>{const value=buildNewMexicoPrimaryIdentityCandidate(input());expect(value.summary).toEqual(expect.objectContaining({targetSeats:3,observations:9,exactNameObservations:3,derivedNameRelationships:6,proposedIdentityLinks:9,directIdentifierBridges:0,automaticallyApprovedRows:0,scoreEligibleRows:0}));expect(value.observations.filter((row:any)=>row.evidenceClass==="exact_name_observation").map((row:any)=>row.bioguideId)).toEqual(["L000273","L000273","L000273"]);expect(value.observations.every((row:any)=>row.sourceWinnerStatus==="not_marked_by_source"&&!row.identityApproved&&!row.scoreEligible)).toBe(true)});
  it("rejects lock drift and fully rehashed identity, winner, or lifecycle escalation",()=>{const changed=input();const lock=changed.sourceLock as any;lock.entries.find((entry:any)=>entry.id==="house-xml").url="https://invalid.example";expect(()=>buildNewMexicoPrimaryIdentityCandidate(changed)).toThrow("SOURCE_LOCK_MISMATCH");for(const mutate of [(v:any)=>v.observations[0].identityApproved=true,(v:any)=>v.observations[0].sourceWinnerStatus="plurality_inferred",(v:any)=>v.publicationEligible=true]){const value=stored();mutate(value);expect(()=>validateNewMexicoPrimaryIdentityCandidate(rehash(value))).toThrow()}});
  it("rebuilds the canonical checked-in artifact exactly",()=>expect(validateNewMexicoPrimaryIdentityCandidate(buildNewMexicoPrimaryIdentityCandidate(input()))).toEqual(stored()));
});
