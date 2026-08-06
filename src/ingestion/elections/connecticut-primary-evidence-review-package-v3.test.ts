/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildConnecticutPrimaryEvidenceReviewPackageV3, validateConnecticutPrimaryEvidenceReviewPackageV3 } from "./connecticut-primary-evidence-review-package-v3";

const read = (path: string) => readFileSync(path);
const input = () => ({ v2Bytes: read("data/metadata/connecticut-primary-evidence-review-package-v2.json"), ballotBytes: read("data/metadata/connecticut-final-primary-ballot-receipt-v1.json"), catalogBytes: read("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json"), sourceLockBytes: read("data/source-lock.json") });
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const rehash = (value: any) => { for (const row of value.records) { const unsigned = { ...row }; delete unsigned.reviewRecordSha256; row.reviewRecordSha256 = digest("dsa-seats:ct-primary-evidence-review-row:v3\0", unsigned); } value.reviewRecordSetSha256 = digest("dsa-seats:ct-primary-evidence-review-row-set:v3\0", value.records.map(({ reviewRecordId, reviewRecordSha256 }: any) => ({ reviewRecordId, reviewRecordSha256 }))); value.decisionSetSha256 = digest("dsa-seats:ct-primary-evidence-review-decision-set:v3\0", value.decisions); const unsigned = { ...value }; delete unsigned.reviewRecordSetSha256; delete unsigned.decisionSetSha256; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:ct-primary-evidence-review-package:v3\0", unsigned); return value; };

describe("Connecticut primary evidence review package v3", () => {
  it("attaches statewide cycle evidence to ten rows without district or legal inference", () => {
    const value = buildConnecticutPrimaryEvidenceReviewPackageV3(input());
    expect(value.summary).toEqual({ reviewRecords: 10, cycles: 2, ballotIndexTownRows: 338, linkedDemocraticBallots: 196, noDemocraticBallotLinkRows: 142, linkedBallotsWithHouseOfficeContest: 0, ballotEvidenceAttachedRecords: 10, districtSpecificBallotJoins: 0, primaryNominationConclusions: 0, resultConclusions: 0, approvedRecords: 0, scoreEligibleRecords: 0 });
    expect(value.records.filter((row) => row.cycleYear === 2022).every((row) => row.ballotCorpusEvidence.indexedTownRows === 169 && row.ballotCorpusEvidence.linkedDemocraticBallots === 168 && row.ballotCorpusEvidence.noDemocraticBallotLinkRows === 1)).toBe(true);
    expect(value.records.filter((row) => row.cycleYear === 2024).every((row) => row.ballotCorpusEvidence.indexedTownRows === 169 && row.ballotCorpusEvidence.linkedDemocraticBallots === 28 && row.ballotCorpusEvidence.noDemocraticBallotLinkRows === 141)).toBe(true);
    expect(value.records.every((row) => row.ballotCorpusEvidence.evidenceScope === "cycle_level_statewide_context_not_district_assignment" && row.ballotCorpusEvidence.townToDistrictCoverage === "not_assessed" && row.ballotCorpusEvidence.districtBallotExhaustiveness === "not_assessed" && row.ballotCorpusEvidence.ballotNominationConclusion === null && row.primaryNominationStatus === null && row.resultStatus === null && !row.approved && !row.scoreEligible)).toBe(true);
    expect(value.decisions.map((decision) => [decision.decisionId, decision.evidenceRecordIds.length, decision.status])).toEqual([["ct-primary-v3:accept-posted-ballot-corpus-scope-v1",10,"proposed"],["ct-primary-v3:retain-primary-disposition-exclusion-v1",10,"proposed"],["ct-primary-v3:retain-statutory-nomination-exclusion-v1",10,"proposed"]]);
  });

  it("rejects substituted parent bytes and parent source-lock lineage", () => {
    const changed = input(); changed.ballotBytes = Buffer.concat([changed.ballotBytes, Buffer.from(" ")]);
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV3(changed)).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V3_INVALID:parent_bytes");
    const changedLock = input(), lock = JSON.parse(changedLock.sourceLockBytes.toString("utf8")); lock.entries.find((entry: any) => entry.id === "connecticut-final-primary-ballot-receipt-v1").parentIds = []; changedLock.sourceLockBytes = Buffer.from(JSON.stringify(lock));
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV3(changedLock)).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V3_INVALID");
    const outputDrift = input(), outputLock = JSON.parse(outputDrift.sourceLockBytes.toString("utf8")); outputLock.entries.find((entry: any) => entry.id === "connecticut-primary-evidence-review-package-v3").parentIds = []; outputDrift.sourceLockBytes = Buffer.from(JSON.stringify(outputLock));
    expect(() => buildConnecticutPrimaryEvidenceReviewPackageV3(outputDrift)).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V3_INVALID");
  });

  it.each([
    ["town district join", (value: any) => { value.records[0].ballotCorpusEvidence.townToDistrictCoverage = "complete"; }],
    ["district completeness", (value: any) => { value.records[0].ballotCorpusEvidence.districtBallotExhaustiveness = "complete"; }],
    ["no-primary inference", (value: any) => { value.records[0].ballotCorpusEvidence.ballotResultConclusion = "no_primary"; }],
    ["nominee", (value: any) => { value.records[0].primaryNominationStatus = "nominee"; }],
    ["statutory trigger", (value: any) => { value.records[0].inheritedEvidence.statutoryTriggerFactsResolved = 1; }],
    ["approval and scoring", (value: any) => { value.records[0].approved = true; value.records[0].scoreEligible = true; }],
    ["decision scope", (value: any) => { value.decisions[0].evidenceRecordIds.pop(); }],
    ["decision resolution", (value: any) => { value.decisions[0].status = "approved"; value.decisions[0].reviewer = "fabricated"; }],
    ["publication", (value: any) => { value.publicationEligible = true; }],
    ["unknown package field", (value: any) => { value.certified = true; }],
  ])("rejects fully rehashed %s", (_label, mutate) => { const currentInput = input(), value = structuredClone(buildConnecticutPrimaryEvidenceReviewPackageV3(currentInput)) as any; mutate(value); expect(() => validateConnecticutPrimaryEvidenceReviewPackageV3(rehash(value), currentInput)).toThrow("CT_PRIMARY_EVIDENCE_REVIEW_V3_INVALID:semantic_or_hash_drift"); });
});
