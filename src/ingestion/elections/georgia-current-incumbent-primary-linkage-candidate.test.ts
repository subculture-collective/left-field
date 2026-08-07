import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildGeorgiaPrimaryIdentityCandidate, validateGeorgiaPrimaryIdentityCandidate, type GeorgiaPrimaryIdentityCandidate } from "./georgia-current-incumbent-primary-linkage-candidate";
import type { GeorgiaPrimaryResultsReceipt } from "./georgia-house-democratic-primary-results-receipt";

const read = (path: string) => readFileSync(resolve(path));
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const input = () => {
  const roster = read("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposal = read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receipt = read("data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json"), house = read("data/source/identity/house-member-data.xml"), congress = read("data/source/identity/congress-legislators-current-20260804.json"), lock = read("data/source-lock.json");
  return { roster: JSON.parse(roster.toString("utf8")) as unknown, rosterFileSha256: hash(roster), proposal: JSON.parse(proposal.toString("utf8")) as unknown, proposalFileSha256: hash(proposal), receipt: JSON.parse(receipt.toString("utf8")) as GeorgiaPrimaryResultsReceipt, receiptFileSha256: hash(receipt), houseXml: house.toString("utf8"), houseFileSha256: hash(house), congressJson: congress.toString("utf8"), congressFileSha256: hash(congress), sourceLock: JSON.parse(lock.toString("utf8")) as unknown };
};
const stored = () => JSON.parse(read("data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json").toString("utf8")) as GeorgiaPrimaryIdentityCandidate;

describe("Georgia current-incumbent primary identity candidate", () => {
  it("proposes twelve bounded identity links while keeping 2022 Lucy McBath geography separate", () => {
    const value = buildGeorgiaPrimaryIdentityCandidate(input());
    expect(value.summary).toEqual(expect.objectContaining({ targetSeats: 4, observations: 12, proposedIdentityLinks: 12, exactNameObservations: 7, derivedNameRelationships: 5, linkedCandidateVotes: 881_116, automaticallyApprovedRows: 0, scoreEligibleRows: 0 }));
    expect(value.observations.find((row) => row.observationId === "ga:identity:2022:06")).toEqual(expect.objectContaining({ sourceDistrictCode: "07", currentTargetDistrictCode: "06", sourceCandidateName: "Lucy McBath (I)", identityStatus: "proposed_identity_link", geographyStatus: "separate_candidate_not_approved", identityApproved: false }));
  });
  it("rebuilds the pinned artifact and rejects lifecycle escalation",()=>{expect(validateGeorgiaPrimaryIdentityCandidate(buildGeorgiaPrimaryIdentityCandidate(input()))).toEqual(stored());const changed=structuredClone(stored());(changed.observations[0] as unknown as {identityApproved:boolean}).identityApproved=true;expect(()=>validateGeorgiaPrimaryIdentityCandidate(changed)).toThrow("PACKAGE_INVARIANT_INVALID")});
});
