/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildOhioPrimaryIdentityCandidate, validateOhioPrimaryIdentityCandidate } from "./ohio-current-incumbent-primary-linkage-candidate";

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) }; };
const input = () => {
  const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const house = readFileSync("data/source/identity/house-member-data.xml");
  const congress = readFileSync("data/source/identity/congress-legislators-current-20260804.json");
  const receipt = json("data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json");
  return {
    roster: roster.value, rosterFileSha256: roster.sha256,
    proposal: proposal.value, proposalFileSha256: proposal.sha256,
    houseXml: house.toString("utf8"), houseFileSha256: sha256(house),
    congressJson: congress.toString("utf8"), congressFileSha256: sha256(congress),
    receipt: receipt.value, receiptFileSha256: receipt.sha256,
    sourceLock: json("data/source-lock.json").value,
  };
};
const build = () => buildOhioPrimaryIdentityCandidate(input());

describe("Ohio current-incumbent primary linkage candidate", () => {
  it("closes ten reported observations without converting partial 2022 county evidence into district identities", () => {
    const value = build();
    expect(value.summary).toEqual({
      targetSeats: 5,
      reportedContestObservations: 10,
      exactNameObservations: 8,
      derivedNameRelationships: 2,
      proposedIdentityLinks: 10,
      partialCountyEvidenceExcluded2022: 12,
      districtIdentityObservations2022: 0,
      directIdentifierBridges: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.observations).toHaveLength(10);
    expect(value.observations.every((row) => !row.observationId.includes(":2022:") && row.identityStatus === "proposed_identity_link" && row.sourceWinnerStatus === "not_marked_by_source" && !row.identityApproved && !row.scoreEligible)).toBe(true);
    expect(value.observations.filter((row) => row.evidenceClass === "derived_name_relationship").map((row) => row.observationId)).toEqual(["oh:identity:2024:13", "oh:identity:2026:13"]);
  });

  it("reproduces the persisted package and exact authority boundary", () => {
    const value = build();
    expect(value).toEqual(validateOhioPrimaryIdentityCandidate(json("data/metadata/ohio-current-incumbent-primary-linkage-candidate-v1.json").value));
    expect(value.observations.every((row) => row.resultAuthorityStatus === "secretary_official_canvass_workbook" && row.certificationStatus === "official_canvass_workbook_separate_certificate_not_retained")).toBe(true);
  });

  it("rejects fully rehashed winner, approval, 2022, and unknown evaluator escalation", () => {
    for (const mutate of [
      (value: any) => { value.observations[0].sourceWinnerStatus = "marked_by_source"; },
      (value: any) => { value.observations[0].identityApproved = true; },
      (value: any) => { value.observations[0].cycleYear = 2022; },
      (value: any) => { value.observations[0].opportunityScore = 99; },
    ]) {
      const value: any = structuredClone(build()); mutate(value);
      for (const row of value.observations) { const unsigned = structuredClone(row); delete unsigned.rowSha256; row.rowSha256 = createHash("sha256").update("dsa-seats:oh-primary-identity-row:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex"); }
      value.observationSetSha256 = createHash("sha256").update("dsa-seats:oh-primary-identity-row-set:v1\0", "ascii").update(canonicalJson(value.observations), "utf8").digest("hex");
      const unsigned = structuredClone(value); delete unsigned.packageSha256;
      value.packageSha256 = createHash("sha256").update("dsa-seats:oh-primary-identity-package:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
      expect(() => validateOhioPrimaryIdentityCandidate(value)).toThrow("Ohio primary identity rejected");
    }
  });

  it("rejects input and exact source-lock topology drift", () => {
    const value: any = structuredClone(build()); value.review.reviewer = "fabricated";
    expect(() => validateOhioPrimaryIdentityCandidate(value)).toThrow("LIFECYCLE_INVALID");
    const drifted: any = input();
    drifted.sourceLock.entries.find((entry: any) => entry.id === "ohio-current-incumbent-primary-linkage-candidate-v1").parentIds.reverse();
    expect(() => buildOhioPrimaryIdentityCandidate(drifted)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
