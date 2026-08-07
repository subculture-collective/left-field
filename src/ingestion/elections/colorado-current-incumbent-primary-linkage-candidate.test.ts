/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildColoradoPrimaryIdentityCandidate, validateColoradoPrimaryIdentityCandidate } from "./colorado-current-incumbent-primary-linkage-candidate";

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const json = (path: string) => { const bytes = readFileSync(path); return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) }; };
const input = () => {
  const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const house = readFileSync("data/source/identity/house-member-data.xml");
  const congress = json("data/source/identity/congress-legislators-current-20260804.json");
  const receipt = json("data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json");
  return {
    roster: roster.value, rosterFileSha256: roster.sha256,
    proposal: proposal.value, proposalFileSha256: proposal.sha256,
    houseXml: house.toString("utf8"), houseFileSha256: sha256(house),
    congressJson: congress.bytes.toString("utf8"), congressFileSha256: congress.sha256,
    receipt: receipt.value, receiptFileSha256: receipt.sha256,
    sourceLock: json("data/source-lock.json").value,
  };
};
const build = () => buildColoradoPrimaryIdentityCandidate(input());

describe("Colorado current-incumbent primary linkage candidate", () => {
  it("closes the twelve target contest observations as exact unapproved identity candidates", () => {
    const value = build();
    expect(value.summary).toEqual({
      targetSeats: 4,
      contestObservations: 12,
      exactNameObservations: 12,
      derivedNameRelationships: 0,
      proposedIdentityLinks: 12,
      directIdentifierBridges: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.observations.map((row) => row.observationId)).toEqual([
      "co:identity:2022:01", "co:identity:2022:02", "co:identity:2022:06", "co:identity:2022:07",
      "co:identity:2024:01", "co:identity:2024:02", "co:identity:2024:06", "co:identity:2024:07",
      "co:identity:2026:01", "co:identity:2026:02", "co:identity:2026:06", "co:identity:2026:07",
    ]);
    expect(value.observations.every((row) => row.identityStatus === "proposed_identity_link" && row.evidenceClass === "exact_name_observation" && row.sourceWinnerStatus === "not_marked_by_source" && !row.identityApproved && !row.scoreEligible)).toBe(true);
    expect(value.publicationEligible).toBe(false);
  });

  it("validates the package while preserving cycle-specific authority and no source winner", () => {
    const value = build();
    expect(validateColoradoPrimaryIdentityCandidate(value)).toEqual(value);
    expect(value.observations.filter((row) => row.cycleYear === 2022).every((row) => row.resultAuthorityStatus === "official_secretary_abstract" && row.certificationStatus === "certification_announcement_and_signed_statewide_abstract_retained")).toBe(true);
    expect(value.observations.filter((row) => row.cycleYear === 2024).every((row) => row.resultAuthorityStatus === "official_certified_biennial_abstract" && row.certificationStatus === "certified_publication_no_separate_signed_certificate_retained")).toBe(true);
    expect(value.observations.filter((row) => row.cycleYear === 2026).every((row) => row.resultAuthorityStatus === "signed_secretary_statewide_abstract" && row.certificationStatus === "signed_secretary_certificate_bound_to_abstract")).toBe(true);
  });

  it("rejects a fully rehashed unknown identity or evaluator claim", () => {
    const value = structuredClone(build()) as any;
    value.observations[0].winner = true;
    for (const row of value.observations) {
      const unsigned = structuredClone(row); delete unsigned.rowSha256;
      row.rowSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-row:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    }
    value.observationSetSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-row-set:v1\0", "ascii").update(canonicalJson(value.observations), "utf8").digest("hex");
    const unsigned = structuredClone(value); delete unsigned.packageSha256;
    value.packageSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-package:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    expect(() => validateColoradoPrimaryIdentityCandidate(value)).toThrow("ROW_FIELDS_INVALID");
  });

  it("rebuilds the persisted reviewer candidate exactly", () => {
    expect(build()).toEqual(validateColoradoPrimaryIdentityCandidate(json("data/metadata/colorado-current-incumbent-primary-linkage-candidate-v1.json").value));
  });

  it("rejects fully rehashed nested candidate semantics", () => {
    const value = structuredClone(build()) as any;
    value.observations[0].sourceCandidate.winner = true;
    for (const row of value.observations) {
      const unsigned = structuredClone(row); delete unsigned.rowSha256;
      row.rowSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-row:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    }
    value.observationSetSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-row-set:v1\0", "ascii").update(canonicalJson(value.observations), "utf8").digest("hex");
    const unsigned = structuredClone(value); delete unsigned.packageSha256;
    value.packageSha256 = createHash("sha256").update("dsa-seats:co-primary-identity-package:v1\0", "ascii").update(canonicalJson(unsigned), "utf8").digest("hex");
    expect(() => validateColoradoPrimaryIdentityCandidate(value)).toThrow("NESTED_FIELDS_INVALID");
  });

  it("rejects fabricated review state and exact source-lock drift", () => {
    const fabricated = structuredClone(build()) as any;
    fabricated.review.reviewer = "fabricated";
    expect(() => validateColoradoPrimaryIdentityCandidate(fabricated)).toThrow("LIFECYCLE_INVALID");
    const drifted = input() as any, lock = structuredClone(drifted.sourceLock);
    lock.entries.find((entry: any) => entry.id === "colorado-current-incumbent-primary-linkage-candidate-v1").url = "urn:changed";
    drifted.sourceLock = lock;
    expect(() => buildColoradoPrimaryIdentityCandidate(drifted)).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
