import { createHash } from "node:crypto";
import { z } from "zod";
import { aipacChallengerAmbiguityResolutionCandidateSchema, validateAipacChallengerAmbiguityResolutionCandidate } from "./aipac-challenger-ambiguity-resolution-candidate";
import { aipacEvidenceFoundationCandidateSchema, validateAipacEvidenceFoundationCandidate } from "./aipac-evidence-foundation-candidate";
import { aipacIncumbentConflictResolutionCandidateSchema, validateAipacIncumbentConflictResolutionCandidate } from "./aipac-incumbent-conflict-resolution-candidate";
import { canonicalJson } from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const PARENT_HASHES = {
  foundation: "a0fe151080a0958c6cdddc447d50db4044700e31960d37dd2326ea86d6f7a7b7",
  ambiguity: "65d037d3ad8488f1086603fd22c33288f92a235c1ba0fcb969b7349542f8d0b7",
  incumbent: "5b77073fe20a37ab9478fe147afe48cb9abc1902b9304c4dc956f0fbe3677b1b",
} as const;
const RELATIONSHIP_SET_SHA256 = "74d145ce6fd968d8b7f64aac43bc64c71056b87aba2e777d9e68e592e82f6914";
const DECISION_SET_SHA256 = "0b59bb7ccd47c0d1e6ee4d9f1c3bd3d448139b682a665204ac34633df9fc99d0";
const PACKAGE_SHA256 = "034d940df8f36c890c742ca94820836738fd242a37e62476b57d9bb266d2f178";

const sourceRelationship = aipacEvidenceFoundationCandidateSchema.shape.relationships.element;
const challengerDisposition = aipacChallengerAmbiguityResolutionCandidateSchema.shape.dispositions.element;
const incumbentResolution = aipacIncumbentConflictResolutionCandidateSchema.shape.resolutions.element;
const resolutionApplication = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("inherited"), evaluatorUse: z.literal("reviewer_only_candidate") }),
  z.strictObject({ kind: z.literal("challenger_auto_accepted"), evaluatorUse: z.literal("reviewer_only_candidate"), disposition: challengerDisposition }),
  z.strictObject({ kind: z.literal("challenger_auto_rejected"), evaluatorUse: z.literal("excluded_invalid_origin"), disposition: challengerDisposition }),
  z.strictObject({ kind: z.literal("incumbent_pending_authorized_review"), evaluatorUse: z.literal("excluded_pending_authorized_review"), proposedResolution: incumbentResolution }),
]);
const relationship = z.strictObject({
  sourceRelationship,
  resolution: resolutionApplication,
  relationshipSha256: SHA,
});

const cycleResolution = aipacIncumbentConflictResolutionCandidateSchema.shape.resolutions.element.shape.cycleDispositions.element;
const decision = z.strictObject({
  decisionId: z.string().min(1),
  sourceDecisionId: z.string().min(1),
  seatCycleId: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  canonicalCandidateId: z.string().min(1),
  alternateCandidateIds: z.array(z.string().min(1)),
  partyTreatment: z.enum(["exact_dem", "explicit_dfl_alias_required"]),
  question: z.string().min(1),
  recommendedDecision: z.literal("Accept the cycle-specific resolution candidate only after confirming its identifier, party, committee, and office-change evidence."),
  defaultReversibleAssumption: z.literal("exclude_affected_relationship"),
  consequences: z.array(z.string().min(1)).min(1),
  cycleDispositions: z.array(cycleResolution).min(1),
  officialFilingSourceLockIds: z.array(z.string().min(1)).min(1),
  resolutionCandidateSha256: SHA,
  blocksPublicationForRelationship: z.literal(true),
  blocksOtherWork: z.literal(false),
  reviewerResolution: z.null(),
  reviewer: z.null(),
  reviewedAt: z.null(),
  decisionSha256: SHA,
});

export const aipacEvidenceFoundationCandidateV2Schema = z.strictObject({
  schema: z.literal("aipac-evidence-foundation-candidate-v2"),
  version: z.literal(2),
  generatedAt: z.literal("2026-08-05T18:15:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  status: z.literal("additive_resolution_candidate_closure"),
  defaultUse: z.literal("use_automatic_ambiguity_disposition_keep_six_incumbent_candidates_excluded"),
  inputs: z.strictObject({
    foundationV1: z.strictObject({ sourceLockId: z.literal("aipac-evidence-foundation-candidate-v1"), fileSha256: z.literal(PARENT_HASHES.foundation) }),
    challengerAmbiguity: z.strictObject({ sourceLockId: z.literal("aipac-challenger-ambiguity-resolution-candidate-v1"), fileSha256: z.literal(PARENT_HASHES.ambiguity) }),
    incumbentConflict: z.strictObject({ sourceLockId: z.literal("aipac-incumbent-conflict-resolution-candidate-v1"), fileSha256: z.literal(PARENT_HASHES.incumbent) }),
  }),
  policy: z.strictObject({
    automaticAmbiguity: z.literal("apply_mechanical_positive_origin_rule_without_reviewer_identity"),
    incumbentCandidates: z.literal("attach_evidence_specific_proposals_but_exclude_until_authorized_review"),
    officeChanges: z.literal("preserve_not_applicable_house_cycle_and_never_convert_to_zero"),
    publication: z.literal("separate_review_and_promotion_required"),
  }),
  summary: z.strictObject({
    targetSeats: z.literal(212),
    inputRelationships: z.literal(229),
    autoVerifiedDirectRelationships: z.literal(206),
    autoInferredCandidateRelationships: z.literal(16),
    usableReviewerCandidateRelationships: z.literal(222),
    pendingResolutionRelationships: z.literal(6),
    rejectedInvalidOriginRelationships: z.literal(1),
    remainingMappingDecisions: z.literal(6),
    remainingMethodologyAndPromotionDecisions: z.literal(4),
    numericEvidenceRows: z.literal(0),
    evaluatorRouteSelections: z.literal(0),
  }),
  automaticDispositionsApplied: z.array(z.strictObject({ sourceDecisionId: z.string().min(1), seatCycleId: z.string().min(1), disposition: z.enum(["auto_accept_unique_positive_target", "auto_reject_negative_adjustment_only_target"]), dispositionSha256: SHA })).length(2),
  derivation: z.strictObject({ relationshipSetSha256: z.literal(RELATIONSHIP_SET_SHA256), remainingDecisionSetSha256: z.literal(DECISION_SET_SHA256) }),
  relationships: z.array(relationship).length(229),
  remainingDecisionQueue: z.array(decision).length(6),
  review: z.strictObject({ status: z.literal("automatic_plus_proposed_candidate"), reviewer: z.null(), reviewedAt: z.null() }),
  packageSha256: SHA,
});

export type AipacEvidenceFoundationCandidateV2 = z.infer<typeof aipacEvidenceFoundationCandidateV2Schema>;
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function buildAipacEvidenceFoundationCandidateV2(input: Readonly<{ foundation: unknown; foundationFileSha256: string; ambiguity: unknown; ambiguityFileSha256: string; incumbent: unknown; incumbentFileSha256: string }>): AipacEvidenceFoundationCandidateV2 {
  if (input.foundationFileSha256 !== PARENT_HASHES.foundation || input.ambiguityFileSha256 !== PARENT_HASHES.ambiguity || input.incumbentFileSha256 !== PARENT_HASHES.incumbent) throw new Error("AIPAC_FOUNDATION_V2_INPUT_HASH_MISMATCH");
  const foundation = validateAipacEvidenceFoundationCandidate(input.foundation);
  const ambiguity = validateAipacChallengerAmbiguityResolutionCandidate(input.ambiguity);
  const incumbent = validateAipacIncumbentConflictResolutionCandidate(input.incumbent);
  const ambiguityByDecision = new Map(ambiguity.dispositions.map((row) => [row.sourceDecisionId, row]));
  const incumbentByDecision = new Map(incumbent.resolutions.map((row) => [row.sourceDecisionId, row]));
  if (ambiguityByDecision.size !== 2 || incumbentByDecision.size !== 6 || foundation.sourceCutoff !== ambiguity.sourceCutoff || foundation.sourceCutoff !== incumbent.sourceCutoff) throw new Error("AIPAC_FOUNDATION_V2_RESOLUTION_UNIVERSE_INVALID");

  const relationships = foundation.relationships.map((row) => {
    const ambiguityResolution = ambiguityByDecision.get(row.sourceDecisionId);
    const incumbentResolution = incumbentByDecision.get(row.sourceDecisionId);
    if (ambiguityResolution && incumbentResolution) throw new Error("AIPAC_FOUNDATION_V2_OVERLAPPING_RESOLUTION");
    let resolution: z.infer<typeof resolutionApplication>;
    if (ambiguityResolution) {
      const accepted = ambiguityResolution.disposition === "auto_accept_unique_positive_target";
      resolution = accepted
        ? { kind: "challenger_auto_accepted", evaluatorUse: "reviewer_only_candidate", disposition: ambiguityResolution }
        : { kind: "challenger_auto_rejected", evaluatorUse: "excluded_invalid_origin", disposition: ambiguityResolution };
    } else if (incumbentResolution) {
      resolution = { kind: "incumbent_pending_authorized_review", evaluatorUse: "excluded_pending_authorized_review", proposedResolution: incumbentResolution };
    } else {
      if (row.evaluatorUse !== "reviewer_only_candidate") throw new Error("AIPAC_FOUNDATION_V2_UNRESOLVED_CONFLICT");
      resolution = { kind: "inherited", evaluatorUse: "reviewer_only_candidate" };
    }
    const unsigned = { sourceRelationship: row, resolution };
    return relationship.parse({ ...unsigned, relationshipSha256: digest("dsa-seats:aipac-foundation-relationship:v2\0", unsigned) });
  }).sort((a, b) => bytewise(a.sourceRelationship.sourceDecisionId, b.sourceRelationship.sourceDecisionId));

  const remainingDecisionQueue = incumbent.resolutions.map((row) => {
    const unsigned = {
      decisionId: `aipac-mapping-resolution:${row.sourceDecisionId}`,
      sourceDecisionId: row.sourceDecisionId,
      seatCycleId: row.seatCycleId,
      sourceCandidateId: row.sourceCandidateId,
      canonicalCandidateId: row.canonicalCandidateId,
      alternateCandidateIds: row.alternateCandidateIds,
      partyTreatment: row.partyTreatment,
      question: `Should the evidence-specific cycle mapping for ${row.seatCycleId} be accepted?`,
      recommendedDecision: "Accept the cycle-specific resolution candidate only after confirming its identifier, party, committee, and office-change evidence." as const,
      defaultReversibleAssumption: "exclude_affected_relationship" as const,
      consequences: ["Acceptance allows only the approved House cycle relationships into a later numeric build.", "Office-change cycles remain not applicable rather than zero.", "Deferral leaves this relationship excluded and does not block other seats."],
      cycleDispositions: row.cycleDispositions,
      officialFilingSourceLockIds: row.officialFilingSourceLockIds,
      resolutionCandidateSha256: row.resolutionSha256,
      blocksPublicationForRelationship: true as const,
      blocksOtherWork: false as const,
      reviewerResolution: null,
      reviewer: null,
      reviewedAt: null,
    };
    return decision.parse({ ...unsigned, decisionSha256: digest("dsa-seats:aipac-foundation-decision:v2\0", unsigned) });
  }).sort((a, b) => bytewise(a.decisionId, b.decisionId));

  const automaticDispositionsApplied = ambiguity.dispositions.map((row) => ({ sourceDecisionId: row.sourceDecisionId, seatCycleId: row.seatCycleId, disposition: row.disposition, dispositionSha256: row.dispositionSha256 })).sort((a, b) => bytewise(a.sourceDecisionId, b.sourceDecisionId));
  const unsigned = {
    schema: "aipac-evidence-foundation-candidate-v2" as const,
    version: 2 as const,
    generatedAt: "2026-08-05T18:15:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    status: "additive_resolution_candidate_closure" as const,
    defaultUse: "use_automatic_ambiguity_disposition_keep_six_incumbent_candidates_excluded" as const,
    inputs: { foundationV1: { sourceLockId: "aipac-evidence-foundation-candidate-v1" as const, fileSha256: PARENT_HASHES.foundation }, challengerAmbiguity: { sourceLockId: "aipac-challenger-ambiguity-resolution-candidate-v1" as const, fileSha256: PARENT_HASHES.ambiguity }, incumbentConflict: { sourceLockId: "aipac-incumbent-conflict-resolution-candidate-v1" as const, fileSha256: PARENT_HASHES.incumbent } },
    policy: { automaticAmbiguity: "apply_mechanical_positive_origin_rule_without_reviewer_identity" as const, incumbentCandidates: "attach_evidence_specific_proposals_but_exclude_until_authorized_review" as const, officeChanges: "preserve_not_applicable_house_cycle_and_never_convert_to_zero" as const, publication: "separate_review_and_promotion_required" as const },
    summary: { targetSeats: 212 as const, inputRelationships: 229 as const, autoVerifiedDirectRelationships: 206 as const, autoInferredCandidateRelationships: 16 as const, usableReviewerCandidateRelationships: 222 as const, pendingResolutionRelationships: 6 as const, rejectedInvalidOriginRelationships: 1 as const, remainingMappingDecisions: 6 as const, remainingMethodologyAndPromotionDecisions: 4 as const, numericEvidenceRows: 0 as const, evaluatorRouteSelections: 0 as const },
    automaticDispositionsApplied,
    derivation: { relationshipSetSha256: digest("dsa-seats:aipac-foundation-relationship-set:v2\0", relationships), remainingDecisionSetSha256: digest("dsa-seats:aipac-foundation-decision-set:v2\0", remainingDecisionQueue) },
    relationships,
    remainingDecisionQueue,
    review: { status: "automatic_plus_proposed_candidate" as const, reviewer: null, reviewedAt: null },
  };
  return validateAipacEvidenceFoundationCandidateV2({ ...unsigned, packageSha256: digest("dsa-seats:aipac-evidence-foundation-candidate:v2\0", unsigned) });
}

export function validateAipacEvidenceFoundationCandidateV2(value: unknown): AipacEvidenceFoundationCandidateV2 {
  const parsed = aipacEvidenceFoundationCandidateV2Schema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-evidence-foundation-candidate:v2\0", unsigned)) throw new Error("AIPAC_FOUNDATION_V2_PACKAGE_HASH_MISMATCH");
  if (packageSha256 !== PACKAGE_SHA256) throw new Error("AIPAC_FOUNDATION_V2_RELEASE_DERIVATION_MISMATCH");
  const counts = { direct: 0, inferred: 0, accepted: 0, pending: 0, rejected: 0, usable: 0 };
  for (const row of parsed.relationships) {
    if (row.resolution.kind === "inherited" && row.sourceRelationship.disposition === "auto_verified_direct") counts.direct++;
    if (row.resolution.kind === "inherited" && row.sourceRelationship.disposition === "auto_inferred_candidate") counts.inferred++;
    if (row.resolution.kind === "challenger_auto_accepted") counts.accepted++;
    if (row.resolution.kind === "incumbent_pending_authorized_review") counts.pending++;
    if (row.resolution.kind === "challenger_auto_rejected") counts.rejected++;
    if (row.resolution.evaluatorUse === "reviewer_only_candidate") counts.usable++;
    const { relationshipSha256, ...rowUnsigned } = row;
    if (relationshipSha256 !== digest("dsa-seats:aipac-foundation-relationship:v2\0", rowUnsigned)) throw new Error("AIPAC_FOUNDATION_V2_RELATIONSHIP_HASH_MISMATCH");
  }
  if (canonicalJson(counts) !== canonicalJson({ direct: 206, inferred: 15, accepted: 1, pending: 6, rejected: 1, usable: 222 }) || new Set(parsed.relationships.map((row) => row.sourceRelationship.sourceDecisionId)).size !== 229 || new Set(parsed.remainingDecisionQueue.map((row) => row.sourceDecisionId)).size !== 6) throw new Error("AIPAC_FOUNDATION_V2_UNIVERSE_MISMATCH");
  for (const row of parsed.remainingDecisionQueue) {
    const { decisionSha256, ...rowUnsigned } = row;
    if (decisionSha256 !== digest("dsa-seats:aipac-foundation-decision:v2\0", rowUnsigned)) throw new Error("AIPAC_FOUNDATION_V2_DECISION_HASH_MISMATCH");
  }
  if (parsed.derivation.relationshipSetSha256 !== digest("dsa-seats:aipac-foundation-relationship-set:v2\0", parsed.relationships) || parsed.derivation.remainingDecisionSetSha256 !== digest("dsa-seats:aipac-foundation-decision-set:v2\0", parsed.remainingDecisionQueue)) throw new Error("AIPAC_FOUNDATION_V2_DERIVATION_MISMATCH");
  return parsed;
}
