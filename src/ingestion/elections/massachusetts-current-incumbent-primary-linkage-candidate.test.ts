/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted candidate mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildMassachusettsPrimaryIdentityCandidate,
  validateMassachusettsPrimaryIdentityCandidate,
} from "./massachusetts-current-incumbent-primary-linkage-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const json = (path: string) => {
  const bytes = readFileSync(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
};

function build(options?: { sourceLock?: unknown; houseXml?: string; congressJson?: string }) {
  const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const house = readFileSync("data/source/identity/house-member-data.xml");
  const congress = json("data/source/identity/congress-legislators-current-20260804.json");
  const receipt = json("data/metadata/massachusetts-house-democratic-primary-results-2022-2026-v1.json");
  const sourceLock = json("data/source-lock.json");
  return buildMassachusettsPrimaryIdentityCandidate({
    roster: roster.value,
    rosterFileSha256: roster.sha256,
    proposal: proposal.value,
    proposalFileSha256: proposal.sha256,
    houseXml: options?.houseXml ?? house.toString("utf8"),
    houseFileSha256: sha256(house),
    congressJson: options?.congressJson ?? congress.bytes.toString("utf8"),
    congressFileSha256: congress.sha256,
    receipt: receipt.value,
    receiptFileSha256: receipt.sha256,
    sourceLock: options?.sourceLock ?? sourceLock.value,
  });
}

describe("Massachusetts current-incumbent primary linkage candidate", () => {
  it("rebuilds the persisted reviewer candidate exactly", () => {
    expect(build()).toEqual(validateMassachusettsPrimaryIdentityCandidate(
      json("data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json").value,
    ));
  });

  it("closes all eighteen retained district-cycle observations without approval or evaluator use", () => {
    const value = build();
    expect(value.summary).toEqual({
      targetSeats: 9,
      contestObservations: 18,
      exactNameObservations: 10,
      derivedNameRelationships: 8,
      proposedIdentityLinks: 18,
      directIdentifierBridges: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.observations).toHaveLength(18);
    expect(value.observations.every((row) => !row.identityApproved && !row.scoreEligible)).toBe(true);
    expect(validateMassachusettsPrimaryIdentityCandidate(value)).toEqual(value);
  });

  it("limits derived relationships to retained same-district aliases", () => {
    const value = build();
    expect(value.observations.filter((row) => row.evidenceClass === "derived_name_relationship").map((row) => [
      row.cycleYear,
      row.districtCode,
      row.rosterIdentity.officialHouseName,
      row.sourceCandidate.sourceCandidateName,
      row.matchMethod,
    ])).toEqual([
      [2022, "03", "Lori Trahan", "Lori Loureiro Trahan", "derived_middle_name_expansion_same_district"],
      [2022, "06", "Seth Moulton", "Seth W. Moulton", "derived_middle_name_expansion_same_district"],
      [2022, "07", "Ayanna Pressley", "Ayanna S. Pressley", "derived_middle_name_expansion_same_district"],
      [2022, "09", "William R. Keating", "Bill Keating", "derived_retained_public_alias_same_district"],
      [2024, "03", "Lori Trahan", "Lori Loureiro Trahan", "derived_middle_name_expansion_same_district"],
      [2024, "06", "Seth Moulton", "Seth W. Moulton", "derived_middle_name_expansion_same_district"],
      [2024, "07", "Ayanna Pressley", "Ayanna S. Pressley", "derived_middle_name_expansion_same_district"],
      [2024, "09", "William R. Keating", "Bill Keating", "derived_retained_public_alias_same_district"],
    ]);
    expect(value.observations.every((row) =>
      row.relationshipDisposition === "proposed_identity_link_pending_documented_review" &&
      row.historicalGeographyStatus === "separate_candidate_not_approved" &&
      row.evaluatorUse === "excluded_pending_authorized_identity_and_historical_geography_review"
    )).toBe(true);
  });

  it("rejects fully rehashed drift from retained contest facts", () => {
    const drifted = structuredClone(build()) as any;
    drifted.observations[0].sourceCandidate.namedCandidateVotes += 1;
    const unsignedRow = structuredClone(drifted.observations[0]);
    delete unsignedRow.rowSha256;
    drifted.observations[0].rowSha256 = digest("dsa-seats:ma-primary-identity-row:v1\0", unsignedRow);
    drifted.observationSetSha256 = digest("dsa-seats:ma-primary-identity-row-set:v1\0", drifted.observations);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-identity-candidate:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryIdentityCandidate(drifted)).toThrow("RETAINED_FACT_INVALID");
  });

  it("rejects fully rehashed unknown row semantics", () => {
    const drifted = structuredClone(build()) as any;
    drifted.observations[0].approvalOverride = true;
    const unsignedRow = structuredClone(drifted.observations[0]);
    delete unsignedRow.rowSha256;
    drifted.observations[0].rowSha256 = digest("dsa-seats:ma-primary-identity-row:v1\0", unsignedRow);
    drifted.observationSetSha256 = digest("dsa-seats:ma-primary-identity-row-set:v1\0", drifted.observations);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-identity-candidate:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryIdentityCandidate(drifted)).toThrow("ROW_FIELDS_INVALID");
  });

  it("rejects source-lock drift and fabricated review state", () => {
    const sourceLock = json("data/source-lock.json").value as any;
    const driftedLock = structuredClone(sourceLock);
    driftedLock.entries.find((entry: any) => entry.id === "house-xml").kind = "derived_artifact";
    expect(() => build({ sourceLock: driftedLock })).toThrow("SOURCE_LOCK_MISMATCH");

    const fabricated = structuredClone(build()) as any;
    fabricated.review.reviewer = "fabricated-reviewer";
    expect(() => validateMassachusettsPrimaryIdentityCandidate(fabricated)).toThrow("LIFECYCLE_INVALID");
  });

  it("rejects identity content that does not match its claimed byte hashes", () => {
    const house = readFileSync("data/source/identity/house-member-data.xml", "utf8");
    const congress = readFileSync("data/source/identity/congress-legislators-current-20260804.json", "utf8");
    expect(() => build({ houseXml: house.replace("Richard E. Neal", "Forged House Name") })).toThrow("INPUT_HASH_MISMATCH");
    expect(() => build({ congressJson: congress.replace(/Bill Keating/g, "Forged Alias") })).toThrow("INPUT_HASH_MISMATCH");
  });

  it("rejects source-lock parent drift and attests the emitted artifact entry", () => {
    const sourceLock = json("data/source-lock.json").value as any;
    const drifted = structuredClone(sourceLock);
    drifted.entries.find((entry: any) => entry.id === "massachusetts-house-democratic-primary-results-2022-2026-v1").parentIds = [];
    expect(() => build({ sourceLock: drifted })).toThrow("SOURCE_LOCK_MISMATCH");

    const artifact = drifted.entries.find((entry: any) => entry.id === "massachusetts-current-incumbent-primary-linkage-candidate-v1");
    expect(artifact).toMatchObject({
      byteSize: 31549,
      sha256: "71566ac5dd105b846f6977ad3269d0419ff8df954cf36775864873b324bbe3a5",
      retainedPath: "data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json",
      kind: "review_candidate",
      parentIds: [
        "dsa-target-incumbent-roster-20260804-v1",
        "house-democratic-primary-source-selection-proposal-20260804-v1",
        "house-xml",
        "congress-legislators-current-20260804",
        "massachusetts-house-democratic-primary-results-2022-2026-v1",
      ],
    });
  });
});
