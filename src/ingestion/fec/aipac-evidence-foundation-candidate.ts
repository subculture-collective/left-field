import { createHash } from "node:crypto";
import { z } from "zod";
import {
  aipacEvidenceClosureProposalSchema,
  aipacMappingProposalSchema,
  aipacNetworkClassificationProposalSchema,
  canonicalJson,
  validateProposedPackage,
} from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const MAPPING_FILE_SHA256 = "6e47107b725e2f92aba68af7f90a4910289d7e2b6356941c242245c5fe5cd8f6";
const CLOSURE_FILE_SHA256 = "7b9fd96d102a2367b67e21c969542a9bb2ae5a94a82997ea5baaabdb64d5a15b";
const CLASSIFICATION_FILE_SHA256 = "3530b66182e02b629c75e785bfd87055f262f2396544d4c18db89ecc1e73fc0c";
const MAPPING_PACKAGE_SHA256 = "6ab17a7f25aea70e0b3e0efffcc8d045e0ff50e9a84d9c1f44dd7b7b1718d6eb";
const CLOSURE_PACKAGE_SHA256 = "ea3847aa48dfadb9e9fa81eaba7cef6cf27982ea9301e163307730145f8f5b34";
const CLASSIFICATION_PACKAGE_SHA256 = "4e5874be01a618e66dc28de2f66ea3bc0ed57e6f9302d61f97ab60688b3d3c0f";
const RELATIONSHIP_SET_SHA256 = "80617e658de4274ec9d2e1bc7da61cec232d01f9a069cc3b48b6377753fb7f67";
const DECISION_SET_SHA256 = "7ceb1f8caee08ae57ac7658f97437b628ba483f88c8e84794ba305df1c946c58";

const relationship = z.strictObject({
  sourceDecisionId: z.string().min(1),
  candidateId: z.string().regex(/^[HSP][A-Z0-9]{8}$/),
  seatCycleId: z.string().min(1),
  relationship: z.enum(["incumbent", "democratic_primary_challenger"]),
  effectiveCycleYears: z.array(z.union([z.literal(2022), z.literal(2024), z.literal(2026)])).min(1),
  authorizedCommitteeIdsByCycle: z.array(z.strictObject({
    cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
    committeeIds: z.array(z.string().regex(/^C\d{8}$/)),
    principalCommitteeCrosscheck: z.enum(["matched", "missing", "conflict"]),
  })),
  disposition: z.enum(["auto_verified_direct", "auto_inferred_candidate", "needs_review_conflict"]),
  confidence: z.enum(["high", "medium", "low"]),
  provenanceKind: z.enum(["direct", "inferred"]),
  evaluatorUse: z.enum(["reviewer_only_candidate", "excluded_conflict"]),
  rationaleCodes: z.array(z.string().min(1)).min(1),
  evidenceRecordSha256s: z.array(SHA).min(1),
  relationshipSha256: SHA,
});

const decision = z.strictObject({
  decisionId: z.string().min(1),
  candidateId: z.string().regex(/^[HSP][A-Z0-9]{8}$/),
  seatCycleId: z.string().min(1),
  relationship: z.enum(["incumbent", "democratic_primary_challenger"]),
  question: z.string().min(1),
  recommendedDecision: z.string().min(1),
  defaultReversibleAssumption: z.literal("exclude_affected_relationship"),
  alternatives: z.array(z.string().min(1)).min(1),
  consequences: z.array(z.string().min(1)).min(1),
  confidence: z.literal("low"),
  blocksPublicationForRelationship: z.literal(true),
  blocksOtherWork: z.literal(false),
  workCompletedWhileWaiting: z.array(z.string().min(1)).min(1),
  evidenceRecordSha256s: z.array(SHA).min(1),
  rationaleCodes: z.array(z.string().min(1)).min(1),
  resolution: z.null(),
  reviewer: z.null(),
  reviewedAt: z.null(),
  decisionSha256: SHA,
});

export const aipacEvidenceFoundationCandidateSchema = z.strictObject({
  schema: z.literal("aipac-evidence-foundation-candidate-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-05T04:46:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  status: z.literal("automatic_candidate_closure"),
  policy: z.strictObject({
    deterministicDirectRelationships: z.literal("auto_verify_when_exact_bioguide_fec_house_state_district_party_and_authorized_committee_checks_are_nonconflicting"),
    deterministicInferences: z.literal("retain_as_labeled_medium_confidence_candidate_when_exact_udp_primary_target_is_unique"),
    conflicts: z.literal("exclude_only_the_affected_relationship_and_queue_for_review"),
    reviewerIdentity: z.literal("not_applicable_to_automatic_closure"),
    publication: z.literal("separate_promotion_required"),
  }),
  inputs: z.strictObject({
    mapping: z.strictObject({ sourceLockId: z.literal("aipac-candidate-seat-mappings-proposal-v1"), fileSha256: z.literal(MAPPING_FILE_SHA256), packageSha256: z.literal(MAPPING_PACKAGE_SHA256) }),
    evidenceClosure: z.strictObject({ sourceLockId: z.literal("aipac-evidence-closure-proposal-v1"), fileSha256: z.literal(CLOSURE_FILE_SHA256), packageSha256: z.literal(CLOSURE_PACKAGE_SHA256) }),
    networkClassification: z.strictObject({ sourceLockId: z.literal("org-classification-aipac-network-proposal-v1"), fileSha256: z.literal(CLASSIFICATION_FILE_SHA256), packageSha256: z.literal(CLASSIFICATION_PACKAGE_SHA256) }),
  }),
  acquisitionClosure: z.strictObject({
    disposition: z.literal("auto_verified_derived_candidate"),
    confidence: z.literal("high"),
    completePassesPerEndpoint: z.literal(2),
    terminalEmptyPages: z.literal(true),
    aipacPacFilings: z.literal(84),
    udpFilings: z.literal(270),
    udpScheduleERecords: z.literal(1145),
    numericEvidenceRows: z.literal(0),
    rationaleCodes: z.tuple([z.literal("TWO_COMPLETE_FEC_PASSES"), z.literal("CUTOFF_BOUND_FILING_LEDGER"), z.literal("SANITIZED_SCHEDULE_E")]),
  }),
  networkClassification: z.strictObject({
    subjectCommitteeId: z.literal("C00799031"),
    relationship: z.literal("aipac_backed_super_pac"),
    disposition: z.literal("auto_verified_direct_candidate"),
    confidence: z.literal("high"),
    sourceArtifactSha256s: z.array(SHA).length(3),
    rationaleCodes: z.tuple([z.literal("AIPAC_PRIMARY_STATEMENT_EXPLICIT"), z.literal("FEC_COMMITTEE_IDENTITIES_EXACT")]),
  }),
  summary: z.strictObject({
    targetSeats: z.literal(212),
    inputRelationships: z.literal(229),
    autoVerifiedDirectRelationships: z.literal(206),
    autoInferredCandidateRelationships: z.literal(15),
    usableReviewerCandidateRelationships: z.literal(221),
    unresolvedConflictRelationships: z.literal(8),
    remainingHumanDecisions: z.literal(8),
    numericEvidenceRows: z.literal(0),
    evaluatorRouteSelections: z.literal(0),
  }),
  derivation: z.strictObject({ relationshipSetSha256: z.literal(RELATIONSHIP_SET_SHA256), remainingDecisionSetSha256: z.literal(DECISION_SET_SHA256) }),
  relationships: z.array(relationship).length(229),
  remainingDecisionQueue: z.array(decision).length(8),
  packageSha256: SHA,
});

export type AipacEvidenceFoundationCandidate = z.infer<typeof aipacEvidenceFoundationCandidateSchema>;

const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "utf8").update(canonicalJson(value), "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));

function relationshipRow(row: z.infer<typeof aipacMappingProposalSchema>["proposedDecisions"][number]): z.infer<typeof relationship> {
  const conflict = row.status === "needs_review";
  const unsigned = {
    sourceDecisionId: row.decisionId,
    candidateId: row.candidateId,
    seatCycleId: row.seatCycleId,
    relationship: row.relationship,
    effectiveCycleYears: row.effectiveCycleYears,
    authorizedCommitteeIdsByCycle: row.authorizedCommitteeIdsByCycle,
    disposition: conflict ? "needs_review_conflict" as const : row.inferred ? "auto_inferred_candidate" as const : "auto_verified_direct" as const,
    confidence: conflict ? "low" as const : row.inferred ? "medium" as const : "high" as const,
    provenanceKind: row.inferred ? "inferred" as const : "direct" as const,
    evaluatorUse: conflict ? "excluded_conflict" as const : "reviewer_only_candidate" as const,
    rationaleCodes: row.rationaleCodes,
    evidenceRecordSha256s: row.evidenceRecordSha256s,
  };
  return relationship.parse({ ...unsigned, relationshipSha256: digest("dsa-seats:aipac-auto-relationship:v1\0", unsigned) });
}

function conflictDecision(row: z.infer<typeof relationship>): z.infer<typeof decision> {
  const ambiguity = row.rationaleCodes.includes("CANDIDATE_ID_MULTIPLE_SEATS_CONFLICT");
  const unsigned = {
    decisionId: `aipac-conflict:${row.sourceDecisionId}`,
    candidateId: row.candidateId,
    seatCycleId: row.seatCycleId,
    relationship: row.relationship,
    question: ambiguity
      ? `Which single seat, if either, is the correct relationship for ${row.candidateId}?`
      : `What corrected FEC candidate and principal-committee relationship applies to ${row.seatCycleId}?`,
    recommendedDecision: ambiguity
      ? "Resolve the candidate-to-seat ambiguity and accept at most one corrected unique relationship."
      : "Resolve the candidate/principal-committee conflict and accept only an exact corrected relationship.",
    defaultReversibleAssumption: "exclude_affected_relationship" as const,
    alternatives: ambiguity ? ["Correct the candidate ID or seat relationship.", "Reject both ambiguous relationships."] : ["Correct the candidate or committee mapping.", "Reject the relationship."],
    consequences: ["A corrected relationship can enter a later evidence build.", "Deferral affects only this relationship; every non-conflicting relationship continues."],
    confidence: "low" as const,
    blocksPublicationForRelationship: true as const,
    blocksOtherWork: false as const,
    workCompletedWhileWaiting: ["All non-conflicting relationships were automatically closed.", "The affected relationship remains excluded from numeric evidence."],
    evidenceRecordSha256s: row.evidenceRecordSha256s,
    rationaleCodes: row.rationaleCodes,
    resolution: null,
    reviewer: null,
    reviewedAt: null,
  };
  return decision.parse({ ...unsigned, decisionSha256: digest("dsa-seats:aipac-conflict-decision:v1\0", unsigned) });
}

export function buildAipacEvidenceFoundationCandidate(input: Readonly<{
  mapping: unknown;
  mappingFileSha256: string;
  evidenceClosure: unknown;
  evidenceClosureFileSha256: string;
  networkClassification: unknown;
  networkClassificationFileSha256: string;
}>): AipacEvidenceFoundationCandidate {
  for (const value of [input.mapping, input.evidenceClosure, input.networkClassification]) validateProposedPackage(value);
  if (input.mappingFileSha256 !== MAPPING_FILE_SHA256 || input.evidenceClosureFileSha256 !== CLOSURE_FILE_SHA256 || input.networkClassificationFileSha256 !== CLASSIFICATION_FILE_SHA256) throw new Error("AIPAC_FOUNDATION_INPUT_FILE_HASH_MISMATCH");
  const mapping = aipacMappingProposalSchema.parse(input.mapping);
  const closure = aipacEvidenceClosureProposalSchema.parse(input.evidenceClosure);
  const classification = aipacNetworkClassificationProposalSchema.parse(input.networkClassification);
  if (mapping.packageSha256 !== MAPPING_PACKAGE_SHA256 || closure.packageSha256 !== CLOSURE_PACKAGE_SHA256 || classification.packageSha256 !== CLASSIFICATION_PACKAGE_SHA256) throw new Error("AIPAC_FOUNDATION_INPUT_PACKAGE_HASH_MISMATCH");
  if (mapping.sourceCutoff !== closure.sourceCutoff || mapping.sourceCutoff !== "2026-08-04") throw new Error("AIPAC_FOUNDATION_CUTOFF_MISMATCH");
  const relationships = mapping.proposedDecisions.map(relationshipRow).sort((a, b) => bytewise(a.sourceDecisionId, b.sourceDecisionId));
  const remainingDecisionQueue = relationships.filter((row) => row.disposition === "needs_review_conflict").map(conflictDecision).sort((a, b) => bytewise(a.decisionId, b.decisionId));
  const aipacLedger = closure.filingLedgers.find((row) => row.committeeId === "C00797670");
  const udpLedger = closure.filingLedgers.find((row) => row.committeeId === "C00799031");
  if (!aipacLedger || !udpLedger || closure.filingLedgers.some((row) => row.completePasses !== 2 || !row.terminalEmptyPages) || closure.scheduleE.completePasses !== 2 || !closure.scheduleE.terminalEmptyPages) throw new Error("AIPAC_FOUNDATION_ACQUISITION_NOT_CLOSED");
  const unsigned = {
    schema: "aipac-evidence-foundation-candidate-v1" as const,
    version: 1 as const,
    generatedAt: "2026-08-05T04:46:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    status: "automatic_candidate_closure" as const,
    policy: {
      deterministicDirectRelationships: "auto_verify_when_exact_bioguide_fec_house_state_district_party_and_authorized_committee_checks_are_nonconflicting" as const,
      deterministicInferences: "retain_as_labeled_medium_confidence_candidate_when_exact_udp_primary_target_is_unique" as const,
      conflicts: "exclude_only_the_affected_relationship_and_queue_for_review" as const,
      reviewerIdentity: "not_applicable_to_automatic_closure" as const,
      publication: "separate_promotion_required" as const,
    },
    inputs: {
      mapping: { sourceLockId: "aipac-candidate-seat-mappings-proposal-v1" as const, fileSha256: MAPPING_FILE_SHA256, packageSha256: mapping.packageSha256 },
      evidenceClosure: { sourceLockId: "aipac-evidence-closure-proposal-v1" as const, fileSha256: CLOSURE_FILE_SHA256, packageSha256: closure.packageSha256 },
      networkClassification: { sourceLockId: "org-classification-aipac-network-proposal-v1" as const, fileSha256: CLASSIFICATION_FILE_SHA256, packageSha256: classification.packageSha256 },
    },
    acquisitionClosure: { disposition: "auto_verified_derived_candidate" as const, confidence: "high" as const, completePassesPerEndpoint: 2 as const, terminalEmptyPages: true as const, aipacPacFilings: aipacLedger.filings.length, udpFilings: udpLedger.filings.length, udpScheduleERecords: closure.scheduleE.records.length, numericEvidenceRows: 0 as const, rationaleCodes: ["TWO_COMPLETE_FEC_PASSES", "CUTOFF_BOUND_FILING_LEDGER", "SANITIZED_SCHEDULE_E"] as const },
    networkClassification: { subjectCommitteeId: classification.classification.subjectCommitteeId, relationship: classification.classification.relationship, disposition: "auto_verified_direct_candidate" as const, confidence: "high" as const, sourceArtifactSha256s: classification.sources.map((source) => source.artifactSha256), rationaleCodes: ["AIPAC_PRIMARY_STATEMENT_EXPLICIT", "FEC_COMMITTEE_IDENTITIES_EXACT"] as const },
    summary: { targetSeats: 212 as const, inputRelationships: 229 as const, autoVerifiedDirectRelationships: 206 as const, autoInferredCandidateRelationships: 15 as const, usableReviewerCandidateRelationships: 221 as const, unresolvedConflictRelationships: 8 as const, remainingHumanDecisions: 8 as const, numericEvidenceRows: 0 as const, evaluatorRouteSelections: 0 as const },
    derivation: { relationshipSetSha256: RELATIONSHIP_SET_SHA256, remainingDecisionSetSha256: DECISION_SET_SHA256 },
    relationships,
    remainingDecisionQueue,
  };
  return validateAipacEvidenceFoundationCandidate({ ...unsigned, packageSha256: digest("dsa-seats:aipac-evidence-foundation-candidate:v1\0", unsigned) });
}

export function validateAipacEvidenceFoundationCandidate(value: unknown): AipacEvidenceFoundationCandidate {
  const parsed = aipacEvidenceFoundationCandidateSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-evidence-foundation-candidate:v1\0", unsigned)) throw new Error("AIPAC_FOUNDATION_PACKAGE_HASH_MISMATCH");
  const counts = {
    direct: parsed.relationships.filter((row) => row.disposition === "auto_verified_direct").length,
    inferred: parsed.relationships.filter((row) => row.disposition === "auto_inferred_candidate").length,
    conflicts: parsed.relationships.filter((row) => row.disposition === "needs_review_conflict").length,
  };
  if (counts.direct !== 206 || counts.inferred !== 15 || counts.conflicts !== 8 || parsed.remainingDecisionQueue.length !== counts.conflicts || new Set(parsed.relationships.map((row) => row.sourceDecisionId)).size !== 229 || new Set(parsed.remainingDecisionQueue.map((row) => row.decisionId)).size !== 8) throw new Error("AIPAC_FOUNDATION_UNIVERSE_MISMATCH");
  for (const row of parsed.relationships) {
    const { relationshipSha256, ...relationshipUnsigned } = row;
    if (relationshipSha256 !== digest("dsa-seats:aipac-auto-relationship:v1\0", relationshipUnsigned)) throw new Error("AIPAC_FOUNDATION_RELATIONSHIP_HASH_MISMATCH");
  }
  for (const row of parsed.remainingDecisionQueue) {
    const { decisionSha256, ...decisionUnsigned } = row;
    if (decisionSha256 !== digest("dsa-seats:aipac-conflict-decision:v1\0", decisionUnsigned)) throw new Error("AIPAC_FOUNDATION_DECISION_HASH_MISMATCH");
  }
  if (digest("dsa-seats:aipac-relationship-set:v1\0", parsed.relationships) !== RELATIONSHIP_SET_SHA256 || digest("dsa-seats:aipac-conflict-decision-set:v1\0", parsed.remainingDecisionQueue) !== DECISION_SET_SHA256) throw new Error("AIPAC_FOUNDATION_DERIVATION_SET_MISMATCH");
  return parsed;
}
