import { z } from "zod";
import {
  aipacEvidenceClosureProposalSchema,
  aipacMappingProposalSchema,
  aipacNetworkClassificationProposalSchema,
  canonicalJson,
  sha256Text,
  validateProposedPackage,
} from "./aipac-proposed-packages";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const review = z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() });

const decision = z.strictObject({
  decisionId: z.string().min(1),
  component: z.enum(["candidate_mapping", "evidence_closure", "network_classification"]),
  sourceStatus: z.enum(["proposed", "needs_review"]),
  question: z.string().min(1),
  recommendedDecision: z.string().min(1),
  defaultReversibleAssumption: z.literal("exclude_from_scoring_and_publication"),
  alternatives: z.array(z.string().min(1)).min(1),
  consequences: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["high", "medium", "low"]),
  blocksPublication: z.literal(true),
  blocksOtherWork: z.boolean(),
  workCompletedWhileWaiting: z.array(z.string().min(1)).min(1),
  provenance: z.strictObject({
    kind: z.enum(["direct", "inferred", "derived"]),
    packageSha256: sha256,
    evidenceRecordSha256s: z.array(sha256),
    rationaleCodes: z.array(z.string().min(1)).min(1),
  }),
  subject: z.strictObject({
    candidateId: z.string().nullable(),
    seatCycleId: z.string().nullable(),
    relationship: z.string().nullable(),
  }),
  resolution: z.null(),
});

export const aipacReviewDecisionQueueSchema = z.strictObject({
  schema: z.literal("aipac-review-decision-queue-v1"),
  version: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  sourceCutoff: z.iso.date(),
  publicationEligible: z.literal(false),
  review,
  inputs: z.strictObject({
    mappingPackageSha256: sha256,
    evidenceClosurePackageSha256: sha256,
    networkClassificationPackageSha256: sha256,
  }),
  summary: z.strictObject({
    mappingDecisions: z.literal(229),
    directIncumbentMappings: z.literal(212),
    inferredChallengerMappings: z.literal(17),
    mappingConflicts: z.literal(8),
    candidateSeatAmbiguities: z.literal(1),
    totalDecisions: z.literal(231),
  }),
  decisions: z.array(decision).length(231),
  packageSha256: sha256,
});

export type AipacReviewDecisionQueue = z.infer<typeof aipacReviewDecisionQueueSchema>;

function assertDecisionUniverse(decisions: readonly z.infer<typeof decision>[]): void {
  const mappings = decisions.filter((row) => row.component === "candidate_mapping");
  const ambiguous = mappings.filter((row) => row.provenance.rationaleCodes.includes("CANDIDATE_ID_MULTIPLE_SEATS_CONFLICT"));
  const uniqueIds = new Set(decisions.map((row) => row.decisionId));
  if (uniqueIds.size !== decisions.length
    || mappings.length !== 229
    || mappings.filter((row) => row.subject.relationship === "incumbent").length !== 212
    || mappings.filter((row) => row.subject.relationship === "democratic_primary_challenger").length !== 17
    || mappings.filter((row) => row.provenance.kind === "inferred").length !== 17
    || mappings.filter((row) => row.sourceStatus === "needs_review").length !== 8
    || ambiguous.length !== 2
    || new Set(ambiguous.map((row) => row.subject.candidateId)).size !== 1) throw new Error("AIPAC_REVIEW_QUEUE_UNIVERSE_MISMATCH");
}

function queueSha256(value: Record<string, unknown>): string {
  return sha256Text("dsa-seats:aipac-review-decision-queue:v1\0", canonicalJson(value));
}

function unresolvedStatus(status: "proposed" | "needs_review" | "rejected"): "proposed" | "needs_review" {
  if (status === "rejected") throw new Error("AIPAC_REVIEW_QUEUE_REJECTED_MAPPING_INPUT");
  return status;
}

export function buildAipacReviewDecisionQueue(input: Readonly<{
  mapping: unknown;
  evidenceClosure: unknown;
  networkClassification: unknown;
}>): AipacReviewDecisionQueue {
  for (const value of [input.mapping, input.evidenceClosure, input.networkClassification]) validateProposedPackage(value);
  const mapping = aipacMappingProposalSchema.parse(input.mapping);
  const closure = aipacEvidenceClosureProposalSchema.parse(input.evidenceClosure);
  const classification = aipacNetworkClassificationProposalSchema.parse(input.networkClassification);
  if (mapping.sourceCutoff !== closure.sourceCutoff) throw new Error("AIPAC_REVIEW_QUEUE_CUTOFF_MISMATCH");

  const mappingDecisions = mapping.proposedDecisions.map((row) => {
    const conflict = row.status === "needs_review";
    const inferred = row.inferred;
    const ambiguity = row.rationaleCodes.includes("CANDIDATE_ID_MULTIPLE_SEATS_CONFLICT");
    return {
      decisionId: `mapping:${row.decisionId}`,
      component: "candidate_mapping" as const,
      sourceStatus: unresolvedStatus(row.status),
      question: `Should ${row.candidateId} be accepted as ${row.relationship} for ${row.seatCycleId} in cycles ${row.effectiveCycleYears.join(", ")}?`,
      recommendedDecision: ambiguity ? "resolve the candidate-to-seat ambiguity and accept only one corrected unique relationship" : conflict ? "resolve the FEC candidate and principal-committee conflict before acceptance" : inferred ? "accept only after reviewing the cited UDP primary evidence" : "accept the exact Bioguide, FEC candidate, district, party, and authorized-committee match",
      defaultReversibleAssumption: "exclude_from_scoring_and_publication" as const,
      alternatives: ambiguity ? ["correct the candidate ID or seat relationship", "reject both ambiguous mappings"] : conflict ? ["correct the candidate or committee mapping", "reject the mapping"] : ["request individual review", "reject the mapping"],
      consequences: ["Acceptance permits this relationship to enter a later reviewed evidence build.", "Rejection or deferral keeps the relationship out of every score and public release."],
      confidence: conflict ? "low" as const : inferred ? "medium" as const : "high" as const,
      blocksPublication: true as const,
      blocksOtherWork: conflict,
      workCompletedWhileWaiting: ["Source artifacts were byte-identified.", "The relationship was classified without publishing it."],
      provenance: { kind: inferred ? "inferred" as const : "direct" as const, packageSha256: mapping.packageSha256, evidenceRecordSha256s: row.evidenceRecordSha256s, rationaleCodes: row.rationaleCodes },
      subject: { candidateId: row.candidateId, seatCycleId: row.seatCycleId, relationship: row.relationship },
      resolution: null,
    };
  });

  const closureDecision = {
    decisionId: "evidence-closure:aipac-pac-and-udp-2022-2026",
    component: "evidence_closure" as const,
    sourceStatus: "proposed" as const,
    question: `Should the two-pass AIPAC PAC and UDP filing/Schedule E closure through ${closure.sourceCutoff} be accepted for reviewer-only evaluation?`,
    recommendedDecision: "independently replay the retained receipts and approve only if filing and amendment closure matches",
    defaultReversibleAssumption: "exclude_from_scoring_and_publication" as const,
    alternatives: ["request a corrected closure package", "reject the closure"],
    consequences: ["Approval permits reviewed evidence calculation at this exact cutoff.", "Deferral keeps AIPAC coverage explicitly not collected."],
    confidence: "medium" as const,
    blocksPublication: true as const,
    blocksOtherWork: false,
    workCompletedWhileWaiting: ["Two complete terminal passes were recorded.", "Filing and Schedule E records were privacy-sanitized and hash-bound."],
    provenance: { kind: "derived" as const, packageSha256: closure.packageSha256, evidenceRecordSha256s: [], rationaleCodes: ["TWO_COMPLETE_FEC_PASSES", "CUTOFF_BOUND_FILING_LEDGER", "SANITIZED_SCHEDULE_E"] },
    subject: { candidateId: null, seatCycleId: null, relationship: "aipac_evidence_closure" },
    resolution: null,
  };

  const classificationDecision = {
    decisionId: "network-classification:C00799031",
    component: "network_classification" as const,
    sourceStatus: "proposed" as const,
    question: "Should United Democracy Project (C00799031) be classified as AIPAC-backed for this methodology version?",
    recommendedDecision: "accept after reviewing the versioned AIPAC primary statement and FEC committee identities",
    defaultReversibleAssumption: "exclude_from_scoring_and_publication" as const,
    alternatives: ["narrow the effective relationship", "reject the classification"],
    consequences: ["Approval permits qualifying UDP transactions to contribute to the AIPAC component.", "Deferral keeps UDP evidence out of every score and public release."],
    confidence: "high" as const,
    blocksPublication: true as const,
    blocksOtherWork: false,
    workCompletedWhileWaiting: ["The organizational statement and both FEC committee records were hash-bound.", "Committee identity was kept separate from editorial network classification."],
    provenance: { kind: "direct" as const, packageSha256: classification.packageSha256, evidenceRecordSha256s: classification.sources.map((source) => source.artifactSha256), rationaleCodes: ["AIPAC_PRIMARY_STATEMENT", "FEC_COMMITTEE_IDENTITIES_EXACT"] },
    subject: { candidateId: null, seatCycleId: null, relationship: "aipac_backed_super_pac" },
    resolution: null,
  };

  const decisions = [...mappingDecisions, closureDecision, classificationDecision].sort((a, b) => Buffer.compare(Buffer.from(a.decisionId), Buffer.from(b.decisionId)));
  assertDecisionUniverse(decisions);
  const unsigned = {
    schema: "aipac-review-decision-queue-v1" as const,
    version: 1 as const,
    generatedAt: mapping.generatedAt,
    sourceCutoff: mapping.sourceCutoff,
    publicationEligible: false as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null },
    inputs: { mappingPackageSha256: mapping.packageSha256, evidenceClosurePackageSha256: closure.packageSha256, networkClassificationPackageSha256: classification.packageSha256 },
    summary: { mappingDecisions: 229 as const, directIncumbentMappings: 212 as const, inferredChallengerMappings: 17 as const, mappingConflicts: 8 as const, candidateSeatAmbiguities: 1 as const, totalDecisions: 231 as const },
    decisions,
  };
  const value = { ...unsigned, packageSha256: queueSha256(unsigned) };
  return aipacReviewDecisionQueueSchema.parse(value);
}

export function validateAipacReviewDecisionQueue(value: unknown): AipacReviewDecisionQueue {
  const parsed = aipacReviewDecisionQueueSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== queueSha256(unsigned)) throw new Error("AIPAC_REVIEW_QUEUE_HASH_MISMATCH");
  assertDecisionUniverse(parsed.decisions);
  if (parsed.review.status !== "proposed" || parsed.publicationEligible) throw new Error("AIPAC_REVIEW_QUEUE_PUBLICATION_FORBIDDEN");
  return parsed;
}
