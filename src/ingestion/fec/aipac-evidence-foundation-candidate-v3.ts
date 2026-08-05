import { createHash } from "node:crypto";
import { z } from "zod";
import { aipacEvidenceFoundationCandidateV2Schema, validateAipacEvidenceFoundationCandidateV2 } from "./aipac-evidence-foundation-candidate-v2";
import { AIPAC_INCUMBENT_RESOLUTION_SEMANTICS_SHA256, aipacIncumbentResolutionSemanticsSha256, aipacIncumbentResolutionDispositionsV2Schema, validateAipacIncumbentResolutionDispositionsV2 } from "./aipac-incumbent-resolution-dispositions-v2";
import { canonicalJson } from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const FOUNDATION_FILE_SHA256 = "e4e2bfe3818fdbb99bbb0b92671a3419656d38f4d0679eb132a5c17e2b443686";
const FOUNDATION_PACKAGE_SHA256 = "034d940df8f36c890c742ca94820836738fd242a37e62476b57d9bb266d2f178";
const DISPOSITIONS_FILE_SHA256 = "c4babb56fe21a99cde0dd9a5a9922f3510899cd507709f9d72afe892f05686fe";
const DISPOSITIONS_PACKAGE_SHA256 = "81f0d5996356ccae3747104009eaf5fdb4a96a2c8bf5a2c8da838eadcd924a7a";
const sourceRelationship = aipacEvidenceFoundationCandidateV2Schema.shape.relationships.element.shape.sourceRelationship;
const legacyResolution = aipacEvidenceFoundationCandidateV2Schema.shape.relationships.element.shape.resolution;
const disposition = aipacIncumbentResolutionDispositionsV2Schema.shape.dispositions.element;
const incumbentResolution = z.strictObject({
  kind: z.literal("incumbent_evidence_disposition_v2"),
  evaluatorUse: z.literal("reviewer_only_candidate_with_cycle_exclusions"),
  effectiveCandidateId: z.string().regex(/^H[A-Z0-9]{8}$/),
  disposition,
});
const relationship = z.strictObject({ sourceRelationship, resolution: z.union([legacyResolution, incumbentResolution]), relationshipSha256: SHA });

export const aipacEvidenceFoundationCandidateV3Schema = z.strictObject({
  schema: z.literal("aipac-evidence-foundation-candidate-v3"), version: z.literal(3), generatedAt: z.literal("2026-08-05T21:15:00.000Z"), sourceCutoff: z.literal("2026-08-04"), reviewerOnly: z.literal(true), publicationEligible: z.literal(false), status: z.literal("automatic_cycle_resolution_candidate_closure"),
  defaultUse: z.literal("use_cycle_eligible_relationships_in_next_reviewer_only_numeric_candidate_exclude_from_publication"),
  inputs: z.strictObject({ foundationV2: z.strictObject({ sourceLockId: z.literal("aipac-evidence-foundation-candidate-v2"), fileSha256: z.literal(FOUNDATION_FILE_SHA256), packageSha256: z.literal(FOUNDATION_PACKAGE_SHA256) }), incumbentDispositionsV2: z.strictObject({ sourceLockId: z.literal("aipac-incumbent-resolution-dispositions-v2"), fileSha256: z.literal(DISPOSITIONS_FILE_SHA256), packageSha256: z.literal(DISPOSITIONS_PACKAGE_SHA256) }) }),
  policy: z.strictObject({ incumbentCycles: z.literal("apply_exact_or_explicitly_derived_cycle_dispositions_without_claiming_human_approval"), partialRelationships: z.literal("admit_only_eligible_cycles_and_keep_unclosed_cycles_excluded"), officeChanges: z.literal("retain_not_applicable_house_cycles_never_zero"), publication: z.literal("separate_methodology_review_and_release_promotion_required") }),
  summary: z.strictObject({ targetSeats: z.literal(212), inputRelationships: z.literal(229), inheritedDirectRelationships: z.literal(206), inheritedInferredRelationships: z.literal(15), challengerAutoAcceptedRelationships: z.literal(1), challengerRejectedInvalidOrigins: z.literal(1), incumbentDispositionRelationships: z.literal(6), usableReviewerCandidateRelationships: z.literal(228), autoUsableIncumbentHouseCycles: z.literal(9), autoNotApplicableHouseCycles: z.literal(2), pendingIncumbentHouseCycles: z.literal(1), remainingMappingDecisions: z.literal(1), numericEvidenceRows: z.literal(0), evaluatorRouteSelections: z.literal(0) }),
  relationships: z.array(relationship).length(229),
  remainingDecisionQueue: aipacIncumbentResolutionDispositionsV2Schema.shape.remainingDecisionQueue,
  derivation: z.strictObject({ relationshipSetSha256: SHA, remainingDecisionSetSha256: SHA }),
  review: z.strictObject({ status: z.literal("automatic_dispositions_plus_proposed_decision"), reviewer: z.null(), reviewedAt: z.null() }),
  packageSha256: SHA,
});

export type AipacEvidenceFoundationCandidateV3 = z.infer<typeof aipacEvidenceFoundationCandidateV3Schema>;
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const order = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function buildAipacEvidenceFoundationCandidateV3(input: Readonly<{ foundationV2: unknown; foundationV2FileSha256: string; dispositionsV2: unknown; dispositionsV2FileSha256: string }>): AipacEvidenceFoundationCandidateV3 {
  if (input.foundationV2FileSha256 !== FOUNDATION_FILE_SHA256 || input.dispositionsV2FileSha256 !== DISPOSITIONS_FILE_SHA256) throw new Error("AIPAC_FOUNDATION_V3_INPUT_FILE_HASH_MISMATCH");
  const foundation = validateAipacEvidenceFoundationCandidateV2(input.foundationV2), dispositions = validateAipacIncumbentResolutionDispositionsV2(input.dispositionsV2);
  if (foundation.packageSha256 !== FOUNDATION_PACKAGE_SHA256 || dispositions.packageSha256 !== DISPOSITIONS_PACKAGE_SHA256) throw new Error("AIPAC_FOUNDATION_V3_INPUT_PACKAGE_HASH_MISMATCH");
  const byDecision = new Map(dispositions.dispositions.map((row) => [row.sourceDecisionId, row]));
  const relationships = foundation.relationships.map((row) => {
    const replacement = row.resolution.kind === "incumbent_pending_authorized_review" ? byDecision.get(row.sourceRelationship.sourceDecisionId) : undefined;
    if (row.resolution.kind === "incumbent_pending_authorized_review" && (!replacement || replacement.sourceResolutionSha256 !== row.resolution.proposedResolution.resolutionSha256)) throw new Error("AIPAC_FOUNDATION_V3_INCUMBENT_DISPOSITION_MISMATCH");
    const resolution = replacement ? { kind: "incumbent_evidence_disposition_v2" as const, evaluatorUse: "reviewer_only_candidate_with_cycle_exclusions" as const, effectiveCandidateId: replacement.canonicalCandidateId, disposition: replacement } : row.resolution;
    const unsigned = { sourceRelationship: row.sourceRelationship, resolution };
    return relationship.parse({ ...unsigned, relationshipSha256: digest("dsa-seats:aipac-foundation-relationship:v3\0", unsigned) });
  }).sort((a, b) => order(a.sourceRelationship.sourceDecisionId, b.sourceRelationship.sourceDecisionId));
  if (byDecision.size !== 6 || relationships.filter((row) => row.resolution.kind === "incumbent_evidence_disposition_v2").length !== 6) throw new Error("AIPAC_FOUNDATION_V3_INCUMBENT_UNIVERSE_MISMATCH");
  const unsigned = { schema: "aipac-evidence-foundation-candidate-v3" as const, version: 3 as const, generatedAt: "2026-08-05T21:15:00.000Z" as const, sourceCutoff: "2026-08-04" as const, reviewerOnly: true as const, publicationEligible: false as const, status: "automatic_cycle_resolution_candidate_closure" as const, defaultUse: "use_cycle_eligible_relationships_in_next_reviewer_only_numeric_candidate_exclude_from_publication" as const, inputs: { foundationV2: { sourceLockId: "aipac-evidence-foundation-candidate-v2" as const, fileSha256: FOUNDATION_FILE_SHA256, packageSha256: FOUNDATION_PACKAGE_SHA256 }, incumbentDispositionsV2: { sourceLockId: "aipac-incumbent-resolution-dispositions-v2" as const, fileSha256: DISPOSITIONS_FILE_SHA256, packageSha256: DISPOSITIONS_PACKAGE_SHA256 } }, policy: { incumbentCycles: "apply_exact_or_explicitly_derived_cycle_dispositions_without_claiming_human_approval" as const, partialRelationships: "admit_only_eligible_cycles_and_keep_unclosed_cycles_excluded" as const, officeChanges: "retain_not_applicable_house_cycles_never_zero" as const, publication: "separate_methodology_review_and_release_promotion_required" as const }, summary: { targetSeats: 212 as const, inputRelationships: 229 as const, inheritedDirectRelationships: 206 as const, inheritedInferredRelationships: 15 as const, challengerAutoAcceptedRelationships: 1 as const, challengerRejectedInvalidOrigins: 1 as const, incumbentDispositionRelationships: 6 as const, usableReviewerCandidateRelationships: 228 as const, autoUsableIncumbentHouseCycles: 9 as const, autoNotApplicableHouseCycles: 2 as const, pendingIncumbentHouseCycles: 1 as const, remainingMappingDecisions: 1 as const, numericEvidenceRows: 0 as const, evaluatorRouteSelections: 0 as const }, relationships, remainingDecisionQueue: dispositions.remainingDecisionQueue, derivation: { relationshipSetSha256: digest("dsa-seats:aipac-foundation-relationship-set:v3\0", relationships), remainingDecisionSetSha256: dispositions.derivation.remainingDecisionSetSha256 }, review: { status: "automatic_dispositions_plus_proposed_decision" as const, reviewer: null, reviewedAt: null } };
  return validateAipacEvidenceFoundationCandidateV3({ ...unsigned, packageSha256: digest("dsa-seats:aipac-evidence-foundation-candidate:v3\0", unsigned) });
}

export function validateAipacEvidenceFoundationCandidateV3(value: unknown): AipacEvidenceFoundationCandidateV3 {
  const parsed = aipacEvidenceFoundationCandidateV3Schema.parse(value), { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-evidence-foundation-candidate:v3\0", unsigned)) throw new Error("AIPAC_FOUNDATION_V3_PACKAGE_HASH_MISMATCH");
  if (parsed.derivation.relationshipSetSha256 !== digest("dsa-seats:aipac-foundation-relationship-set:v3\0", parsed.relationships) || parsed.derivation.remainingDecisionSetSha256 !== digest("dsa-seats:aipac-incumbent-resolution-decision-set:v2\0", parsed.remainingDecisionQueue)) throw new Error("AIPAC_FOUNDATION_V3_DERIVATION_MISMATCH");
  if (new Set(parsed.relationships.map((row) => row.sourceRelationship.sourceDecisionId)).size !== 229 || parsed.relationships.filter((row) => row.resolution.kind === "incumbent_evidence_disposition_v2").length !== 6 || parsed.remainingDecisionQueue.length !== 1) throw new Error("AIPAC_FOUNDATION_V3_UNIVERSE_MISMATCH");
  const incumbents = parsed.relationships.filter((row): row is typeof row & { resolution: z.infer<typeof incumbentResolution> } => row.resolution.kind === "incumbent_evidence_disposition_v2");
  if (aipacIncumbentResolutionSemanticsSha256(incumbents.map((row) => row.resolution.disposition)) !== AIPAC_INCUMBENT_RESOLUTION_SEMANTICS_SHA256 || incumbents.some((row) => row.sourceRelationship.sourceDecisionId !== row.resolution.disposition.sourceDecisionId || row.sourceRelationship.seatCycleId !== row.resolution.disposition.seatCycleId || row.sourceRelationship.candidateId !== row.resolution.disposition.sourceCandidateId || row.resolution.effectiveCandidateId !== row.resolution.disposition.canonicalCandidateId)) throw new Error("AIPAC_FOUNDATION_V3_INCUMBENT_SEMANTICS_MISMATCH");
  const pending = parsed.remainingDecisionQueue[0], pendingDisposition = incumbents.find((row) => row.resolution.disposition.seatCycleId === pending.seatCycleId)?.resolution.disposition;
  if (!pendingDisposition || pending.sourceResolutionSha256 !== pendingDisposition.sourceResolutionSha256 || canonicalJson(pending.officialFilingSourceLockIds) !== canonicalJson(pendingDisposition.officialFilingSourceLockIds)) throw new Error("AIPAC_FOUNDATION_V3_PENDING_PROVENANCE_MISMATCH");
  for (const row of parsed.relationships) { const { relationshipSha256, ...rowUnsigned } = row; if (relationshipSha256 !== digest("dsa-seats:aipac-foundation-relationship:v3\0", rowUnsigned)) throw new Error("AIPAC_FOUNDATION_V3_RELATIONSHIP_HASH_MISMATCH"); }
  return parsed;
}
