/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-assessment mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { assertNjPaPrimaryCertificationRows, buildNjPaPrimaryCertificationAvailabilityAssessment, validateNjPaPrimaryCertificationAvailabilityAssessment } from "./nj-pa-primary-certification-availability-assessment";

const read = (path: string) => { const bytes = readFileSync(resolve(path)); return { bytes, text: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex"), value: path.endsWith(".json") ? JSON.parse(bytes.toString("utf8")) : undefined }; };
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
function inputs(sourceLockOverride?: unknown) {
  const proposal = read("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), nj = read("data/metadata/new-jersey-house-democratic-primary-results-2022-2026-v1.json"), pa = read("data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json"), njStatute = read("data/source/elections/primary-results/certification/new-jersey/election-statutes-title-19-chapters-20-29.html"), paBoundary = read("data/source/elections/primary-results/certification/pennsylvania/election-data-authority-boundary.html"), pa2024 = read("data/source/elections/primary-results/certification/pennsylvania/2024-primary-certification.html"), pa2026 = read("data/source/elections/primary-results/certification/pennsylvania/2026-primary-certification.html");
  return { proposal: proposal.value, proposalFileSha256: proposal.sha256, newJerseyReceipt: nj.value, newJerseyReceiptFileSha256: nj.sha256, pennsylvaniaReceipt: pa.value, pennsylvaniaReceiptFileSha256: pa.sha256, njStatuteHtml: njStatute.text, njStatuteFileSha256: njStatute.sha256, paBoundaryHtml: paBoundary.text, paBoundaryFileSha256: paBoundary.sha256, pa2024CertificationHtml: pa2024.text, pa2024CertificationFileSha256: pa2024.sha256, pa2026CertificationHtml: pa2026.text, pa2026CertificationFileSha256: pa2026.sha256, sourceLock: sourceLockOverride ?? read("data/source-lock.json").value };
}
const build = (sourceLockOverride?: unknown) => buildNjPaPrimaryCertificationAvailabilityAssessment(inputs(sourceLockOverride));

describe("NJ/PA primary certification availability assessment", () => {
  it("rebuilds the retained assessment exactly", () => expect(build()).toEqual(read("data/metadata/nj-pa-primary-certification-availability-assessment-v1.json").value));

  it("assesses six cycles without certifying, approving, scoring, or publishing one", () => {
    const value = build();
    expect(value.summary).toEqual({ stateCyclesAssessed: 6, exactResultArtifactsRetained: 5, officialNjResultCandidates: 3, paDepartmentExtractCandidates: 2, statewideCertificationStatementsRetained: 2, exactResultCertificationReconciliations: 0, missingResultExtracts: 1, automaticApprovals: 0, scoreEligibleRows: 0 });
    expect(value.rows.every((row) => !row.exactResultCertificationReconciled && !row.automaticApproval && !row.scoreEligible)).toBe(true);
    expect(value.publicationEligible).toBe(false);
  });

  it("preserves New Jersey official-result evidence and the distinct post-canvass certificate gap", () => {
    expect(build().rows.filter((row) => row.stateCode === "NJ")).toHaveLength(3);
    expect(build().rows.filter((row) => row.stateCode === "NJ").every((row) => row.exactResultBytesRetained && !row.cycleCertificationContextRetained && row.certificationContextStatus === "post_canvass_secretary_certificate_not_retained")).toBe(true);
  });

  it("preserves Pennsylvania cycle distinctions and unresolved 2022 districts", () => {
    const rows = build().rows, pa2022 = rows.find((row) => row.stateCycleId === "PA:2022")!, pa2024 = rows.find((row) => row.stateCycleId === "PA:2024")!, pa2026 = rows.find((row) => row.stateCycleId === "PA:2026")!;
    expect(pa2022.unresolvedNoRowDistrictCodes).toEqual(["13", "14", "15"]); expect(pa2022.cycleCertificationContextRetained).toBe(false);
    expect(pa2024).toMatchObject({ cycleCertificationContextRetained: true, exactResultBytesRetained: true, exactResultCertificationReconciled: false });
    expect(pa2026).toMatchObject({ resultReceiptSourceLockId: null, exactResultBytesRetained: false, cycleCertificationContextRetained: true, exactResultCertificationReconciled: false });
    expect(pa2026.rationaleCodes).toContain("absence_of_retained_extract_is_not_zero_or_no_contest");
    expect(JSON.stringify(pa2026)).not.toMatch(/candidateVotes|winner|margin|voteTotal|evaluatorValues/i);
  });

  it("informs only the existing nationwide authority decision and creates no decision", () => {
    const value: any = build();
    expect(value.decisionSupport).toEqual({ informsDecisionId: "collect-official-state-primary-results-and-certification-v1", analysisConclusion: "nj_official_lists_and_pa_statewide_certification_context_improve_authority_visibility_but_zero_exact_result_artifacts_are_certification_reconciled", lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" });
    expect(value.decisions).toBeUndefined(); expect(value.parentDecisionReviews).toBeUndefined();
    expect(value.methodology).toMatchObject({ availabilityIsNotCertification: true, noCycleOrStateClosureDecisionMade: true, full114CycleClosureStillRequired: true, allOtherPrimaryGatesRemainRequired: true, promotionNotAssessed: true });
  });

  it("binds exact source bytes and the seven-parent output source-lock closure", () => {
    const artifact = read("data/metadata/nj-pa-primary-certification-availability-assessment-v1.json"), entry = read("data/source-lock.json").value.entries.find((candidate: any) => candidate.id === "nj-pa-primary-certification-availability-assessment-v1");
    expect(entry).toMatchObject({ retainedPath: "data/metadata/nj-pa-primary-certification-availability-assessment-v1.json", retainedStatus: "retained", byteSize: artifact.bytes.byteLength, sha256: artifact.sha256, kind: "review_candidate" });
    expect(entry.parentIds).toEqual(["house-democratic-primary-source-selection-proposal-20260804-v1", "new-jersey-house-democratic-primary-results-2022-2026-v1", "pennsylvania-house-democratic-primary-results-2022-2024-v1", "nj-primary-post-canvass-certification-statute-20260805", "pa-election-result-authority-boundary-20260805", "pa-2024-primary-certification-announcement", "pa-2026-primary-certification-announcement"]);
  });

  it("rejects parent file drift and a resolved owner decision", () => {
    const wrongFile = inputs(); wrongFile.njStatuteFileSha256 = "0".repeat(64); expect(() => buildNjPaPrimaryCertificationAvailabilityAssessment(wrongFile)).toThrow("PRIMARY_CERTIFICATION_AVAILABILITY_INPUT_FILE_HASH_MISMATCH");
    const resolved: any = inputs(); const decision = resolved.proposal.decisions.find((candidate: any) => candidate.decisionId === "collect-official-state-primary-results-and-certification-v1"); decision.resolution = "approved"; const proposalUnsigned = { ...resolved.proposal }; delete proposalUnsigned.packageSha256; resolved.proposal.packageSha256 = digest("dsa-seats:house-democratic-primary-source-selection-proposal:v1\0", proposalUnsigned); expect(() => buildNjPaPrimaryCertificationAvailabilityAssessment(resolved)).toThrow();
  });

  it("rejects wrong source-lock kind, path, status, and duplicate IDs", () => {
    for (const mutate of [(entry: any) => { entry.kind = "review_candidate"; }, (entry: any) => { entry.retainedPath = "data/source/substituted.html"; }, (entry: any) => { entry.retainedStatus = "nonretained"; }]) {
      const lock = structuredClone(read("data/source-lock.json").value), entry = lock.entries.find((candidate: any) => candidate.id === "pa-2024-primary-certification-announcement"); mutate(entry); expect(() => build(lock)).toThrow("PRIMARY_CERTIFICATION_AVAILABILITY_SOURCE_LOCK_MISMATCH");
    }
    const duplicate = structuredClone(read("data/source-lock.json").value), entry = duplicate.entries.find((candidate: any) => candidate.id === "nj-primary-post-canvass-certification-statute-20260805"); duplicate.entries.push(structuredClone(entry)); expect(() => build(duplicate)).toThrow("PRIMARY_CERTIFICATION_AVAILABILITY_SOURCE_LOCK_MISMATCH");
  });

  it("rejects fully rehashed row status or rationale escalation", () => {
    const value: any = build(); value.rows[4].rationaleCodes = ["exact_extract_certified", "approved"];
    const rowUnsigned = { ...value.rows[4] }; delete rowUnsigned.rowSha256; value.rows[4].rowSha256 = digest("dsa-seats:nj-pa-primary-certification-availability-row:v1\0", rowUnsigned);
    expect(() => assertNjPaPrimaryCertificationRows(value.rows)).toThrow("PRIMARY_CERTIFICATION_AVAILABILITY_ROW_INVALID");
  });

  it("rejects fabricated review, certification, approval, scoring, and publication states", () => {
    for (const mutate of [(value: any) => { value.review.reviewer = "fabricated"; }, (value: any) => { value.rows[0].exactResultCertificationReconciled = true; }, (value: any) => { value.rows[0].automaticApproval = true; }, (value: any) => { value.rows[0].scoreEligible = true; }, (value: any) => { value.publicationEligible = true; }]) { const value: any = build(); mutate(value); expect(() => validateNjPaPrimaryCertificationAvailabilityAssessment(value)).toThrow(); }
  });

  it("excludes candidate identity, vote, address, and contact data", () => expect(JSON.stringify(build().rows)).not.toMatch(/candidateName|candidateVotes|address|phone|email|dateOfBirth|donor/i));
});
