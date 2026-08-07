/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-candidate mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildMinnesotaPrimaryIdentityCandidate, validateMinnesotaPrimaryIdentityCandidate } from "./minnesota-current-incumbent-primary-linkage-candidate";

const json = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any, index: number) => {
  const rowUnsigned = structuredClone(value.observations[index]);
  delete rowUnsigned.rowSha256;
  value.observations[index].rowSha256 = digest("dsa-seats:mn-primary-identity-row:v1\0", rowUnsigned);
  value.observationSetSha256 = digest("dsa-seats:mn-primary-identity-row-set:v1\0", value.observations);
  const packageUnsigned = structuredClone(value);
  delete packageUnsigned.packageSha256;
  value.packageSha256 = digest("dsa-seats:mn-primary-identity-candidate:v1\0", packageUnsigned);
};
const build = () => {
  const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
  const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = json("data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json");
  const house = readFileSync("data/source/identity/house-member-data.xml");
  const congress = readFileSync("data/source/identity/congress-legislators-current-20260804.json");
  return buildMinnesotaPrimaryIdentityCandidate({
    roster: roster.value, rosterFileSha256: roster.sha256,
    proposal: proposal.value, proposalFileSha256: proposal.sha256,
    receipt: receipt.value, receiptFileSha256: receipt.sha256,
    houseXml: house.toString("utf8"), houseFileSha256: createHash("sha256").update(house).digest("hex"),
    congressJson: congress.toString("utf8"), congressFileSha256: createHash("sha256").update(congress).digest("hex"),
    sourceLock: json("data/source-lock.json").value,
  });
};

describe("Minnesota current-incumbent primary linkage candidate", () => {
  it("closes eight target observations with five exact links and three unresolved source absences", () => {
    const value = build();
    expect(value.summary).toEqual({ targetSeats: 4, contestObservations: 8, reportedObservations: 5, sourceAbsentObservations: 3, reportedCandidateRows: 15, reportedContestVotes: 372_009, proposedIdentityLinks: 5, exactNameObservations: 5, directIdentifierBridges: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0 });
    expect(value.observations.map((row: any) => [row.cycleYear, row.districtCode, row.identityStatus, row.sourceCandidate?.sourceCandidateName ?? null])).toEqual([
      [2022, "02", "source_absent_district_cycle_unresolved", null],
      [2022, "03", "source_absent_district_cycle_unresolved", null],
      [2022, "04", "proposed_identity_link", "Betty McCollum"],
      [2022, "05", "proposed_identity_link", "Ilhan Omar"],
      [2024, "02", "proposed_identity_link", "Angie Craig"],
      [2024, "03", "source_absent_district_cycle_unresolved", null],
      [2024, "04", "proposed_identity_link", "Betty McCollum"],
      [2024, "05", "proposed_identity_link", "Ilhan Omar"],
    ]);
    expect(value.observations.every((row: any) => !row.identityApproved && !row.scoreEligible && row.selectionStatus === "unselected")).toBe(true);
  });

  it("preserves absent evidence as null and does not elevate portal rows to certified winners", () => {
    const value = build();
    const absent = value.observations.filter((row: any) => row.identityStatus === "source_absent_district_cycle_unresolved");
    expect(absent).toHaveLength(3);
    expect(absent.every((row: any) => row.sourceContestId === null && row.sourceContestSha256 === null &&
      row.sourceCandidateCount === null && row.sourceContestVotes === null && row.sourceCandidate === null &&
      row.matchMethod === null && row.evidenceClass === null && row.confidence === null &&
      row.relationshipDisposition === "not_linked_source_absent_without_candidate_record" &&
      row.sourceAbsenceMeaning === "not_zero_not_no_primary_not_uncontested_not_nominated")).toBe(true);

    const reported = value.observations.filter((row: any) => row.identityStatus === "proposed_identity_link");
    expect(reported.map((row: any) => [row.observationId, row.sourceCandidate.sourceCandidateId, row.sourceCandidate.votes, row.sourceContestVotes])).toEqual([
      ["mn:identity:2022:04", "01070403", 58_043, 69_597],
      ["mn:identity:2022:05", "01080405", 57_683, 114_567],
      ["mn:identity:2024:02", "01050401", 26_865, 29_514],
      ["mn:identity:2024:04", "01070401", 37_530, 37_530],
      ["mn:identity:2024:05", "01080401", 67_926, 120_801],
    ]);
    expect(reported.every((row: any) => row.sourcePartyCode === "DFL" &&
      row.resultAuthorityStatus === "official_portal_reported_result_not_claimed_as_certified_result_bytes" &&
      row.sourceWinnerStatus === "not_marked_by_source" && row.certificationStatus === "event_metadata_only_exact_report_bytes_not_retained" &&
      row.relationshipDisposition === "proposed_identity_link_pending_documented_review")).toBe(true);
  });

  it("rejects source-lock lineage drift for every immutable parent", () => {
    const roster = json("data/metadata/dsa-target-incumbent-roster-20260804-v1.json");
    const proposal = json("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
    const receipt = json("data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json");
    const house = readFileSync("data/source/identity/house-member-data.xml");
    const congress = readFileSync("data/source/identity/congress-legislators-current-20260804.json");
    const lock = json("data/source-lock.json").value;
    const changed = structuredClone(lock);
    changed.entries.find((entry: any) => entry.id === "minnesota-house-democratic-primary-results-2022-2026-v1").parentIds = [];
    expect(() => buildMinnesotaPrimaryIdentityCandidate({
      roster: roster.value, rosterFileSha256: roster.sha256,
      proposal: proposal.value, proposalFileSha256: proposal.sha256,
      receipt: receipt.value, receiptFileSha256: receipt.sha256,
      houseXml: house.toString("utf8"), houseFileSha256: createHash("sha256").update(house).digest("hex"),
      congressJson: congress.toString("utf8"), congressFileSha256: createHash("sha256").update(congress).digest("hex"),
      sourceLock: changed,
    })).toThrow(/SOURCE_LOCK_MISMATCH/);
    const changedUrl = structuredClone(lock);
    changedUrl.entries.find((entry: any) => entry.id === "house-xml").url = "https://example.invalid/member-data.xml";
    expect(() => buildMinnesotaPrimaryIdentityCandidate({
      roster: roster.value, rosterFileSha256: roster.sha256,
      proposal: proposal.value, proposalFileSha256: proposal.sha256,
      receipt: receipt.value, receiptFileSha256: receipt.sha256,
      houseXml: house.toString("utf8"), houseFileSha256: createHash("sha256").update(house).digest("hex"),
      congressJson: congress.toString("utf8"), congressFileSha256: createHash("sha256").update(congress).digest("hex"),
      sourceLock: changedUrl,
    })).toThrow(/SOURCE_LOCK_MISMATCH/);
  });

  it("is a self-validating proposed package and rejects lifecycle tampering after full rehash", () => {
    const value = build();
    expect(validateMinnesotaPrimaryIdentityCandidate(value)).toBe(value);
    expect(value).toMatchObject({
      schema: "minnesota-current-incumbent-primary-linkage-candidate-v1",
      version: 1,
      reviewerOnly: true,
      publicationEligible: false,
      review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null },
    });
    const changed: any = structuredClone(value);
    changed.observations[0].identityApproved = true;
    rehash(changed, 0);
    expect(() => validateMinnesotaPrimaryIdentityCandidate(changed)).toThrow(/LIFECYCLE_INVALID/);
  });

  it("rejects altered source-candidate facts even after all package hashes are recomputed", () => {
    const changed: any = structuredClone(build());
    const index = changed.observations.findIndex((row: any) => row.observationId === "mn:identity:2024:04");
    changed.observations[index].sourceCandidate.votes += 1;
    rehash(changed, index);
    expect(() => validateMinnesotaPrimaryIdentityCandidate(changed)).toThrow(/LINK_CLOSURE_INVALID/);
  });

  it("persists a deterministic reviewer artifact identical to a fresh build", () => {
    const artifact = json("data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json").value;
    expect(validateMinnesotaPrimaryIdentityCandidate(artifact)).toEqual(build());
  });

  it("rejects altered parent metadata even when the package hash is recomputed", () => {
    const changed: any = structuredClone(build());
    changed.inputs.receipt.packageSha256 = "0".repeat(64);
    const packageUnsigned = structuredClone(changed);
    delete packageUnsigned.packageSha256;
    changed.packageSha256 = digest("dsa-seats:mn-primary-identity-candidate:v1\0", packageUnsigned);
    expect(() => validateMinnesotaPrimaryIdentityCandidate(changed)).toThrow(/PARENT_METADATA_INVALID/);
  });
});
