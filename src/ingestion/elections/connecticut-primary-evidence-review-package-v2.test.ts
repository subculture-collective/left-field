/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildConnecticutPrimaryEvidenceReviewPackageV2, validateConnecticutPrimaryEvidenceReviewPackageV2 } from "./connecticut-primary-evidence-review-package-v2";

const read = (path: string) => readFileSync(path);
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const build = () => buildConnecticutPrimaryEvidenceReviewPackageV2({ jointBytes: read("data/metadata/connecticut-primary-identity-geography-review-package-v1.json"), generalBytes: read("data/metadata/connecticut-general-election-crosscheck-receipt-v1.json"), statutoryBytes: read("data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json"), sourceLockBytes: read("data/source-lock.json") });
const rehash = (value: any) => { for (const row of value.records) { const unsigned = { ...row }; delete unsigned.reviewRecordSha256; row.reviewRecordSha256 = digest("dsa-seats:ct-primary-evidence-review-row:v2\0", unsigned); } value.reviewRecordSetSha256 = digest("dsa-seats:ct-primary-evidence-review-row-set:v2\0", value.records); const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:ct-primary-evidence-review-package:v2\0", unsigned); return value; };

describe("Connecticut primary evidence review package v2", () => {
  it("joins all three reviewer parents without resolving nomination, result, approval, or scoring", () => {
    const value = build();
    expect(value.records).toHaveLength(10);
    expect(value.records.every((row) => row.generalElectionAppearanceStatus === "party_labeled_vote_column_present" && row.primaryNominationStatus === null && row.resultStatus === null && row.statutoryTriggerFactsResolved === 0 && row.statutoryNominationConclusion === null && !row.approved && !row.scoreEligible)).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2022).every((row) => row.electedDeclarationStatus === "not_present_in_retained_instrument" && row.cancellationTiming === "prior_to_opening_of_polls")).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2024).every((row) => row.electedDeclarationStatus === "declared_elected_in_exact_scope_canvass" && row.cancellationTiming === "before_commencement_of_early_voting")).toBe(true);
    expect(value.summary).toEqual({ reviewRecords: 10, generalElectionAppearances: 10, exactScopeElectedDeclarations: 5, statutoryTriggerFactsResolved: 0, primaryNominationConclusions: 0, resultConclusions: 0, approvedRecords: 0, scoreEligibleRecords: 0 });
    expect(validateConnecticutPrimaryEvidenceReviewPackageV2(value)).toEqual(value);
  });

  it("rejects output source-lock lineage drift", () => {
    const lock = JSON.parse(readFileSync("data/source-lock.json", "utf8")); lock.entries.find((entry: { id: string }) => entry.id === "connecticut-primary-evidence-review-package-v2").parentIds = [];
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV2({ jointBytes: read("data/metadata/connecticut-primary-identity-geography-review-package-v1.json"), generalBytes: read("data/metadata/connecticut-general-election-crosscheck-receipt-v1.json"), statutoryBytes: read("data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json"), sourceLockBytes: Buffer.from(JSON.stringify(lock)) })).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V2_INVALID");
  });

  it.each([
    ["primary nominee", (value: any) => { value.records[0].primaryNominationStatus = "nominee"; }],
    ["result conclusion", (value: any) => { value.records[0].resultStatus = "winner"; }],
    ["2022 declaration", (value: any) => { value.records[0].electedDeclarationStatus = "declared_elected_in_exact_scope_canvass"; }],
    ["statutory trigger resolution", (value: any) => { value.records[0].statutoryTriggerFactsResolved = 5; }],
    ["statutory nomination conclusion", (value: any) => { value.records[0].statutoryNominationConclusion = "nominee"; }],
    ["approval escalation", (value: any) => { value.records[0].approved = true; value.records[0].scoreEligible = true; }],
    ["unknown row claim", (value: any) => { value.records[0].certified = true; }],
    ["unknown package claim", (value: any) => { value.nominationConclusion = "nominee"; }],
    ["publication escalation", (value: any) => { value.publicationEligible = true; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const value = structuredClone(build()) as any; mutate(value); expect(() => validateConnecticutPrimaryEvidenceReviewPackageV2(rehash(value))).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V2_INVALID"); });
});
