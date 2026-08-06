/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted candidate mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildIllinoisPrimaryIdentityCandidate,
  validateIllinoisPrimaryIdentityCandidate,
} from "./illinois-current-incumbent-primary-linkage-candidate";

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
  const receipt = json("data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json");
  const sourceLock = json("data/source-lock.json");
  return buildIllinoisPrimaryIdentityCandidate({
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

describe("Illinois current-incumbent primary linkage candidate", () => {
  it("rebuilds the persisted reviewer candidate exactly", () => {
    expect(build()).toEqual(validateIllinoisPrimaryIdentityCandidate(
      json("data/metadata/illinois-current-incumbent-primary-linkage-candidate-v1.json").value,
    ));
  });

  it("closes all twenty-eight target seat-cycle observations without approval or evaluator use", () => {
    const value = build();
    expect(value.inheritedUnresolvedGates).toEqual([
      "retain_final_state_canvass_or_certification",
      "review_incumbent_candidate_identity",
      "review_historical_district_compatibility",
      "review_progressive_candidate_classification",
    ]);
    expect(value.defaultUse).toBe(
      "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review",
    );
    expect(value.summary).toEqual({
      targetSeats: 14,
      contestObservations: 28,
      exactNameObservations: 20,
      derivedNameRelationships: 8,
      proposedIdentityLinks: 28,
      directIdentifierBridges: 0,
      certificationReceipts: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.observations).toHaveLength(28);
    expect(value.observations.every((row) =>
      !row.identityApproved && !row.scoreEligible && row.certificationStatus === "not_retained" &&
      row.evaluatorUse ===
        "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review"
    )).toBe(true);
    expect(value.observations.every((row) => /^\d+$/.test(row.sourceCandidate.sourceAuthorityCandidateId))).toBe(true);
  });

  it("limits derived relationships to four retained same-district aliases in both cycles", () => {
    expect(build().observations.filter((row) => row.evidenceClass === "derived_name_relationship").map((row) => [
      row.cycleYear,
      row.districtCode,
      row.rosterIdentity.officialHouseName,
      row.sourceCandidate.sourceCandidateName,
      row.matchMethod,
    ])).toEqual([
      [2022, "02", "Robin L. Kelly", "ROBIN KELLY", "derived_middle_name_omission_same_district"],
      [2022, "03", "Delia C. Ramirez", "DELIA RAMIREZ", "derived_middle_name_omission_same_district"],
      [2022, "04", "Jesús G. \"Chuy\" García", "JESUS \"CHUY\" GARCIA", "derived_middle_name_omission_same_district"],
      [2022, "10", "Bradley Scott Schneider", "BRAD SCHNEIDER", "derived_retained_public_alias_same_district"],
      [2024, "02", "Robin L. Kelly", "ROBIN KELLY", "derived_middle_name_omission_same_district"],
      [2024, "03", "Delia C. Ramirez", "DELIA RAMIREZ", "derived_middle_name_omission_same_district"],
      [2024, "04", "Jesús G. \"Chuy\" García", "JESUS \"CHUY\" GARCIA", "derived_middle_name_omission_same_district"],
      [2024, "10", "Bradley Scott Schneider", "BRAD SCHNEIDER", "derived_retained_public_alias_same_district"],
    ]);
  });

  it("rejects source-byte substitution and source-lock lineage drift", () => {
    const house = readFileSync("data/source/identity/house-member-data.xml", "utf8");
    expect(() => build({ houseXml: house.replace("Jonathan L. Jackson", "Forged House Name") })).toThrow("INPUT_HASH_MISMATCH");

    const drifted = structuredClone(json("data/source-lock.json").value) as any;
    drifted.entries.find((entry: any) => entry.id === "illinois-house-democratic-primary-results-receipt-2022-2024-v1").parentIds = [];
    expect(() => build({ sourceLock: drifted })).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it("attests the emitted artifact and rejects output source-lock lineage drift", () => {
    const sourceLock = json("data/source-lock.json").value as any;
    const artifact = sourceLock.entries.find((entry: any) =>
      entry.id === "illinois-current-incumbent-primary-linkage-candidate-v1"
    );
    expect(artifact).toMatchObject({
      retainedPath: "data/metadata/illinois-current-incumbent-primary-linkage-candidate-v1.json",
      retainedStatus: "retained",
      byteSize: 52649,
      sha256: "d9f46120064cd293cb63876866c5fa261c142f621d3e1c0662d7dd8dfcd27e25",
      kind: "review_candidate",
      parentIds: [
        "dsa-target-incumbent-roster-20260804-v1",
        "house-democratic-primary-source-selection-proposal-20260804-v1",
        "house-xml",
        "congress-legislators-current-20260804",
        "illinois-house-democratic-primary-results-receipt-2022-2024-v1",
      ],
    });

    const drifted = structuredClone(sourceLock);
    drifted.entries.find((entry: any) =>
      entry.id === "illinois-current-incumbent-primary-linkage-candidate-v1"
    ).parentIds = [];
    expect(() => build({ sourceLock: drifted })).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it("rejects fully rehashed drift from retained contest and candidate facts", () => {
    const drifted = structuredClone(build()) as any;
    drifted.observations[0].sourceCandidate.namedCandidateVotes += 1;
    const unsignedRow = structuredClone(drifted.observations[0]);
    delete unsignedRow.rowSha256;
    drifted.observations[0].rowSha256 = digest("dsa-seats:il-primary-identity-row:v1\0", unsignedRow);
    drifted.observationSetSha256 = digest("dsa-seats:il-primary-identity-row-set:v1\0", drifted.observations);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:il-primary-identity-candidate:v1\0", unsigned);
    expect(() => validateIllinoisPrimaryIdentityCandidate(drifted)).toThrow("PARENT_FACT_INVALID");
  });

  it("rejects fully rehashed fabricated approval and score eligibility", () => {
    const drifted = structuredClone(build()) as any;
    drifted.observations[0].identityApproved = true;
    drifted.observations[0].scoreEligible = true;
    const unsignedRow = structuredClone(drifted.observations[0]);
    delete unsignedRow.rowSha256;
    drifted.observations[0].rowSha256 = digest("dsa-seats:il-primary-identity-row:v1\0", unsignedRow);
    drifted.observationSetSha256 = digest("dsa-seats:il-primary-identity-row-set:v1\0", drifted.observations);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:il-primary-identity-candidate:v1\0", unsigned);
    expect(() => validateIllinoisPrimaryIdentityCandidate(drifted)).toThrow("ROW_INVALID");
  });
});
