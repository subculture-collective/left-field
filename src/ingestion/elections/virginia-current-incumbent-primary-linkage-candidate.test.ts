/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-candidate mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildVirginiaCurrentIncumbentPrimaryLinkageCandidate, validateVirginiaCurrentIncumbentPrimaryLinkageCandidate } from "./virginia-current-incumbent-primary-linkage-candidate";

const read = (path: string) => readFileSync(path);
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = () => buildVirginiaCurrentIncumbentPrimaryLinkageCandidate({ rosterBytes: read("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposalBytes: read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receiptBytes: read("data/metadata/virginia-house-democratic-primary-results-2022-2026-v1.json"), houseBytes: read("data/source/identity/house-member-data.xml"), congressBytes: read("data/source/identity/congress-legislators-current-20260804.json"), sourceLockBytes: read("data/source-lock.json") });
const rehash = (value: any) => { for (const row of value.observations) { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:va-primary-identity-row:v1\0", unsigned); } value.observationSetSha256 = digest("dsa-seats:va-primary-identity-row-set:v1\0", value.observations); const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:va-primary-identity-package:v1\0", unsigned); return value; };

describe("Virginia current-incumbent primary identity candidate", () => {
  it("closes twelve target-cycle rows using only certified 2022/2024 evidence", () => {
    const value = build();
    expect(value.summary).toEqual({ targetSeats: 6, targetCycleRows: 12, officialContestsPresent: 4, officialResultsAbsent: 8, proposedIdentityLinks: 3, exactNameObservations: 2, derivedNameRelationships: 1, reportedContestNoCurrentIncumbentMatch: 1, unofficial2026RowsImported: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0 });
    expect(value.observations.map((row) => row.observationId)).toEqual([2022, 2024].flatMap((year) => ["03", "04", "07", "08", "10", "11"].map((district) => `va:identity:${year}:${district}`)));
    expect(value.observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => [row.cycleYear, row.districtCode, row.sourceCandidateName, row.matchMethod])).toEqual([[2022, "08", "Donald S. Beyer, Jr.", "exact_normalized_official_house_name_same_district"], [2024, "07", "Eugene S. Vindman", "derived_official_middle_name_expands_source_middle_initial_same_district"], [2024, "10", "Suhas Subramanyam", "exact_normalized_official_house_name_same_district"]]);
    expect(value.observations.find((row) => row.observationId === "va:identity:2024:11")).toEqual(expect.objectContaining({ identityStatus: "reported_contest_no_current_incumbent_match", sourceCandidateName: null, officialResultWinnerName: "Gerald E. \"Gerry\" Connolly" }));
    expect(value.observations.every((row) => row.cycleYear !== (2026 as number) && !row.identityApproved && !row.selected && !row.scoreEligible)).toBe(true);
    expect(validateVirginiaCurrentIncumbentPrimaryLinkageCandidate(value)).toEqual(value);
    expect(read("data/metadata/virginia-current-incumbent-primary-linkage-candidate-v1.json").toString("utf8")).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it.each([
    ["ancestry", (entry: any) => { entry.parentIds = ["virginia-house-democratic-primary-results-2022-2026-v1"]; }],
    ["URL", (entry: any) => { entry.url = "urn:forged:lineage"; }],
  ])("rejects source-lock output %s drift", (_label, mutate) => {
    const lock = JSON.parse(read("data/source-lock.json").toString("utf8"));
    mutate(lock.entries.find((entry: any) => entry.id === "virginia-current-incumbent-primary-linkage-candidate-v1"));
    expect(() => buildVirginiaCurrentIncumbentPrimaryLinkageCandidate({ rosterBytes: read("data/metadata/dsa-target-incumbent-roster-20260804-v1.json"), proposalBytes: read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), receiptBytes: read("data/metadata/virginia-house-democratic-primary-results-2022-2026-v1.json"), houseBytes: read("data/source/identity/house-member-data.xml"), congressBytes: read("data/source/identity/congress-legislators-current-20260804.json"), sourceLockBytes: Buffer.from(JSON.stringify(lock)) })).toThrow("VA_PRIMARY_IDENTITY_CANDIDATE_INVALID");
  });

  it.each([
    ["2026 import", (value: any) => { value.observations[0].cycleYear = 2026; }],
    ["predecessor link", (value: any) => { value.observations.find((row: any) => row.observationId === "va:identity:2024:11").identityStatus = "proposed_identity_link"; }],
    ["absent result as zero", (value: any) => { value.observations[0].officialContestStatus = "zero_vote_contest"; }],
    ["approval", (value: any) => { value.observations[0].identityApproved = true; value.observations[0].selected = true; value.observations[0].scoreEligible = true; }],
    ["unknown row claim", (value: any) => { value.observations[0].nominee = true; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateVirginiaCurrentIncumbentPrimaryLinkageCandidate(rehash(value))).toThrow("VA_PRIMARY_IDENTITY_CANDIDATE_INVALID"); });
});
