/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally alter sealed artifacts */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacEvidenceFoundationCandidateV3, validateAipacEvidenceFoundationCandidateV3 } from "./aipac-evidence-foundation-candidate-v3";
import { canonicalJson } from "./aipac-proposed-packages";

const load = (file: string) => { const bytes = readFileSync(resolve("data/metadata", file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const build = () => { const foundation = load("aipac-evidence-foundation-candidate-v2.json"), dispositions = load("aipac-incumbent-resolution-dispositions-v2.json"); return buildAipacEvidenceFoundationCandidateV3({ foundationV2: foundation.value, foundationV2FileSha256: foundation.sha256, dispositionsV2: dispositions.value, dispositionsV2FileSha256: dispositions.sha256 }); };

describe("AIPAC evidence foundation candidate v3", () => {
  it("applies six evidence dispositions while retaining exactly one cycle decision", () => {
    const value = build();
    expect(value.summary).toEqual({ targetSeats: 212, inputRelationships: 229, inheritedDirectRelationships: 206, inheritedInferredRelationships: 15, challengerAutoAcceptedRelationships: 1, challengerRejectedInvalidOrigins: 1, incumbentDispositionRelationships: 6, usableReviewerCandidateRelationships: 228, autoUsableIncumbentHouseCycles: 9, autoNotApplicableHouseCycles: 2, pendingIncumbentHouseCycles: 1, remainingMappingDecisions: 1, numericEvidenceRows: 0, evaluatorRouteSelections: 0 });
    expect(value.remainingDecisionQueue[0]).toMatchObject({ seatCycleId: "seat_house_ca_31_current", cycleYear: 2024, resolution: null });
    expect(validateAipacEvidenceFoundationCandidateV3(value)).toEqual(value);
  });

  it("uses corrected native IDs without rewriting source relationships", () => {
    const value = build(), md = value.relationships.find((row) => row.sourceRelationship.sourceDecisionId === "incumbent:seat_house_md_04_current:H2MD04315")!, ny = value.relationships.find((row) => row.sourceRelationship.sourceDecisionId === "incumbent:seat_house_ny_04_current:H4NY04158")!;
    expect(md.sourceRelationship.candidateId).toBe("H2MD04315");
    expect(md.resolution).toMatchObject({ kind: "incumbent_evidence_disposition_v2", effectiveCandidateId: "H2MD04232", disposition: { alternateCandidateIds: ["H2MD04315"] } });
    expect(ny.resolution).toMatchObject({ kind: "incumbent_evidence_disposition_v2", effectiveCandidateId: "H2NY04244", disposition: { alternateCandidateIds: ["H4NY04158"] } });
  });

  it("fails closed on stale inputs or a self-rehashed pending-cycle admission", () => {
    const foundation = load("aipac-evidence-foundation-candidate-v2.json"), dispositions = load("aipac-incumbent-resolution-dispositions-v2.json");
    expect(() => buildAipacEvidenceFoundationCandidateV3({ foundationV2: foundation.value, foundationV2FileSha256: foundation.sha256, dispositionsV2: dispositions.value, dispositionsV2FileSha256: "0".repeat(64) })).toThrow("INPUT_FILE_HASH_MISMATCH");
    const value: any = build(), ca = value.relationships.find((row: any) => row.sourceRelationship.seatCycleId === "seat_house_ca_31_current");
    ca.resolution.disposition.cycleDispositions.find((cycle: any) => cycle.cycleYear === 2024).evaluatorUse = "reviewer_only_candidate";
    expect(() => validateAipacEvidenceFoundationCandidateV3(value)).toThrow();
  });

  it("rejects a fully rehashed embedded disposition with the pending cycle moved", () => {
    const value: any = build(), ca = value.relationships.find((row: any) => row.sourceRelationship.sourceDecisionId === "incumbent:seat_house_ca_31_current:H8CA39174"), nh = value.relationships.find((row: any) => row.sourceRelationship.sourceDecisionId === "incumbent:seat_house_nh_01_current:H8NH01210");
    ca.resolution.disposition.cycleDispositions[0] = { ...ca.resolution.disposition.cycleDispositions[1], cycleYear: 2024 };
    nh.resolution.disposition.cycleDispositions[1] = { ...nh.resolution.disposition.cycleDispositions[0], disposition: "pending_source_precedence_review", evaluatorUse: "excluded_pending_review", provenanceKind: "derived", confidence: "high", rationaleCodes: ["TERMINAL_FORM2_PRECEDENCE_RECEIPT_REQUIRED"] };
    for (const wrapper of [ca, nh]) {
      const disposition = wrapper.resolution.disposition, { dispositionSha256: _rowHash, ...dispositionUnsigned } = disposition; void _rowHash;
      disposition.dispositionSha256 = createHash("sha256").update("dsa-seats:aipac-incumbent-resolution-disposition:v2\0").update(canonicalJson(dispositionUnsigned)).digest("hex");
      const { relationshipSha256: _relationshipHash, ...relationshipUnsigned } = wrapper; void _relationshipHash;
      wrapper.relationshipSha256 = createHash("sha256").update("dsa-seats:aipac-foundation-relationship:v3\0").update(canonicalJson(relationshipUnsigned)).digest("hex");
    }
    value.derivation.relationshipSetSha256 = createHash("sha256").update("dsa-seats:aipac-foundation-relationship-set:v3\0").update(canonicalJson(value.relationships)).digest("hex");
    const { packageSha256: _package, ...unsigned } = value; void _package;
    value.packageSha256 = createHash("sha256").update("dsa-seats:aipac-evidence-foundation-candidate:v3\0").update(canonicalJson(unsigned)).digest("hex");
    expect(() => validateAipacEvidenceFoundationCandidateV3(value)).toThrow("INCUMBENT_SEMANTICS_MISMATCH");
  });

  it("rejects a fully rehashed pending queue that severs its evidence provenance", () => {
    const value: any = build();
    value.remainingDecisionQueue[0].sourceResolutionSha256 = "0".repeat(64);
    value.remainingDecisionQueue[0].officialFilingSourceLockIds = ["fec-form2-1818491"];
    value.derivation.remainingDecisionSetSha256 = createHash("sha256").update("dsa-seats:aipac-incumbent-resolution-decision-set:v2\0").update(canonicalJson(value.remainingDecisionQueue)).digest("hex");
    const { packageSha256: _package, ...unsigned } = value; void _package;
    value.packageSha256 = createHash("sha256").update("dsa-seats:aipac-evidence-foundation-candidate:v3\0").update(canonicalJson(unsigned)).digest("hex");
    expect(() => validateAipacEvidenceFoundationCandidateV3(value)).toThrow("PENDING_PROVENANCE_MISMATCH");
  });
});
