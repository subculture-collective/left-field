import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacEvidenceFoundationCandidateV2, validateAipacEvidenceFoundationCandidateV2 } from "./aipac-evidence-foundation-candidate-v2";

const root = resolve("data/metadata");
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const load = async (file: string) => { const bytes = await readFile(resolve(root, file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) }; };
const inputs = async () => { const foundation = await load("aipac-evidence-foundation-candidate-v1.json"), ambiguity = await load("aipac-challenger-ambiguity-resolution-candidate-v1.json"), incumbent = await load("aipac-incumbent-conflict-resolution-candidate-v1.json"); return { foundation: foundation.value, foundationFileSha256: foundation.sha256, ambiguity: ambiguity.value, ambiguityFileSha256: ambiguity.sha256, incumbent: incumbent.value, incumbentFileSha256: incumbent.sha256 }; };

describe("AIPAC evidence foundation candidate v2", () => {
  it("applies only the mechanical challenger disposition and keeps six incumbent proposals excluded", async () => {
    const input = await inputs();
    const candidate = buildAipacEvidenceFoundationCandidateV2(input);
    expect(candidate.summary).toEqual({ targetSeats: 212, inputRelationships: 229, autoVerifiedDirectRelationships: 206, autoInferredCandidateRelationships: 16, usableReviewerCandidateRelationships: 222, pendingResolutionRelationships: 6, rejectedInvalidOriginRelationships: 1, remainingMappingDecisions: 6, remainingMethodologyAndPromotionDecisions: 4, numericEvidenceRows: 0, evaluatorRouteSelections: 0 });
    expect(candidate.relationships.filter((row) => row.resolution.kind === "inherited")).toHaveLength(221);
    expect(candidate.relationships.filter((row) => row.resolution.kind === "incumbent_pending_authorized_review")).toHaveLength(6);
    expect(candidate.remainingDecisionQueue).toHaveLength(6);
    expect(candidate.remainingDecisionQueue.every((row) => row.reviewer === null && row.reviewedAt === null && row.reviewerResolution === null && row.blocksOtherWork === false)).toBe(true);
    const il = candidate.relationships.find((row) => row.sourceRelationship.seatCycleId === "seat_house_il_07_current" && row.sourceRelationship.candidateId === "H0IL07167");
    const ca = candidate.relationships.find((row) => row.sourceRelationship.seatCycleId === "seat_house_ca_47_current" && row.sourceRelationship.candidateId === "H0IL07167");
    expect(il?.resolution).toMatchObject({ kind: "challenger_auto_accepted", evaluatorUse: "reviewer_only_candidate", disposition: { positiveRecordCount: 20, negativeRecordCount: 1 } });
    expect(ca?.resolution).toMatchObject({ kind: "challenger_auto_rejected", evaluatorUse: "excluded_invalid_origin", disposition: { positiveRecordCount: 0, negativeRecordCount: 1 } });
    expect(validateAipacEvidenceFoundationCandidateV2(candidate)).toEqual(candidate);
  });

  it("preserves every signed v1 relationship exactly under the additive wrapper", async () => {
    const input = await inputs();
    const candidate = buildAipacEvidenceFoundationCandidateV2(input);
    const foundation = input.foundation as { relationships: Array<{ sourceDecisionId: string }> };
    const sourceByDecision = new Map(foundation.relationships.map((row) => [row.sourceDecisionId, row]));
    for (const row of candidate.relationships) expect(row.sourceRelationship).toEqual(sourceByDecision.get(row.sourceRelationship.sourceDecisionId));
    const md = candidate.relationships.find((row) => row.sourceRelationship.seatCycleId === "seat_house_md_04_current" && row.sourceRelationship.relationship === "incumbent");
    expect(md?.sourceRelationship.candidateId).toBe("H2MD04315");
    expect(md?.resolution).toMatchObject({ kind: "incumbent_pending_authorized_review", proposedResolution: { canonicalCandidateId: "H2MD04232", defaultEvaluatorUse: "excluded_pending_authorized_review" } });
  });

  it("fails closed on parent drift, invented publication, or resolution mutation", async () => {
    const input = await inputs();
    expect(() => buildAipacEvidenceFoundationCandidateV2({ ...input, ambiguityFileSha256: "0".repeat(64) })).toThrow("AIPAC_FOUNDATION_V2_INPUT_HASH_MISMATCH");
    const candidate = buildAipacEvidenceFoundationCandidateV2(input);
    expect(() => validateAipacEvidenceFoundationCandidateV2({ ...candidate, publicationEligible: true })).toThrow();
    const changed = structuredClone(candidate);
    const pending = changed.relationships.find((row) => row.resolution.kind === "incumbent_pending_authorized_review")!;
    if (pending.resolution.kind !== "incumbent_pending_authorized_review") throw new Error("test setup");
    pending.resolution.proposedResolution.canonicalCandidateId = "H0ZZ00000";
    expect(() => validateAipacEvidenceFoundationCandidateV2(changed)).toThrow("AIPAC_FOUNDATION_V2_PACKAGE_HASH_MISMATCH");
  });
});
