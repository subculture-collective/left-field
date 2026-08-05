import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./aipac-proposed-packages";
import { aipacIncumbentConflictResolutionCandidateSchema, validateAipacIncumbentConflictResolutionCandidate } from "./aipac-incumbent-conflict-resolution-candidate";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const PARENT_FILE_SHA256 = "5b77073fe20a37ab9478fe147afe48cb9abc1902b9304c4dc956f0fbe3677b1b";
const PARENT_PACKAGE_SHA256 = "5e7359b73934933ee4cab184f69cf3e18ebaf6b2684ab1d60b9374d3e86c04c8";
export const AIPAC_INCUMBENT_RESOLUTION_SEMANTICS_SHA256 = "1cfe1ded15d90b8aa96523db32faad98caddbb14da4ed5db57a720c3f8a61efc";
const cycleYear = z.union([z.literal(2022), z.literal(2024), z.literal(2026)]);
const sourceResolution = aipacIncumbentConflictResolutionCandidateSchema.shape.resolutions.element;

const cycleDisposition = z.strictObject({
  cycleYear,
  disposition: z.enum(["auto_verified_house_relationship", "auto_derived_house_relationship", "auto_verified_no_house_candidacy", "pending_source_precedence_review"]),
  committeeIds: z.array(z.string().regex(/^C\d{8}$/)).max(1),
  evidenceRule: sourceResolution.shape.cycleDispositions.element.shape.evidenceRule,
  provenanceKind: z.enum(["direct", "derived"]),
  confidence: z.enum(["certain", "high"]),
  evaluatorUse: z.enum(["reviewer_only_candidate", "not_applicable_no_house_candidacy", "excluded_pending_review"]),
  rationaleCodes: z.array(z.string().min(1)).min(1),
});

const disposition = z.strictObject({
  sourceDecisionId: z.string().min(1),
  seatCycleId: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  canonicalCandidateId: z.string().min(1),
  alternateCandidateIds: z.array(z.string().min(1)),
  identityDisposition: z.enum(["auto_verified_exact", "auto_corrected_native_id", "auto_derived_party_alias"]),
  rawPartyTreatment: z.enum(["exact_dem", "preserve_dfl_with_sourced_democratic_affiliation"]),
  cycleDispositions: z.array(cycleDisposition).min(1),
  sourceResolutionSha256: SHA,
  officialFilingSourceLockIds: z.array(z.string().min(1)).min(1),
  sourceEvidenceRecordSha256s: z.array(SHA).min(1),
  rationaleCodes: z.array(z.string().min(1)).min(1),
  dispositionSha256: SHA,
});

const pendingDecision = z.strictObject({
  decisionId: z.literal("aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174"),
  component: z.literal("candidate_committee_source_precedence"),
  seatCycleId: z.literal("seat_house_ca_31_current"),
  cycleYear: z.literal(2024),
  question: z.literal("Should the 2024 CA-31 relationship use C00850420 when CN24 names stale committee C00650648, CCL24 supplies no link, and the retained direct Form 2 evidence has no cutoff-bounded terminal-amendment-chain receipt?"),
  recommendedDecision: z.literal("Defer the 2024 relationship until a source-locked terminal amendment chain proves which filing controlled at the cutoff; retain the exact 2026 relationship independently."),
  defaultReversibleAssumption: z.literal("exclude_only_ca31_2024_relationship"),
  alternatives: z.tuple([z.literal("Accept the direct Form 2 override after retaining terminal-chain evidence."), z.literal("Reject the 2024 override and keep the cycle unavailable.")]),
  consequences: z.tuple([z.literal("Deferral blocks only CA-31's 2024 direct relationship and does not block its exact 2026 mapping."), z.literal("Acceptance without the missing precedence receipt would overstate the current evidence closure.")]),
  confidence: z.literal("high_but_insufficiently_closed"),
  blocksPublicationForRelationship: z.literal(true),
  blocksOtherWork: z.literal(false),
  workCompletedWhileWaiting: z.tuple([z.literal("The 2026 CN/CCL relationship is independently auto-verified."), z.literal("Every other incumbent case is resolved from exact or explicitly derived locked evidence.")]),
  requiredEvidence: z.tuple([z.literal("cutoff_bounded_terminal_form2_amendment_chain_receipt")]),
  sourceResolutionSha256: SHA,
  officialFilingSourceLockIds: z.array(z.string().min(1)).min(1),
  resolution: z.null(),
  reviewer: z.null(),
  reviewedAt: z.null(),
  decisionSha256: SHA,
});

export const aipacIncumbentResolutionDispositionsV2Schema = z.strictObject({
  schema: z.literal("aipac-incumbent-resolution-dispositions-v2"),
  version: z.literal(2),
  generatedAt: z.literal("2026-08-05T21:00:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  status: z.literal("automatic_evidence_dispositions_with_one_pending_precedence_decision"),
  defaultUse: z.literal("apply_only_to_a_new_reviewer_only_foundation_never_as_publication_approval"),
  inputs: z.strictObject({ parentFileSha256: z.literal(PARENT_FILE_SHA256), parentPackageSha256: z.literal(PARENT_PACKAGE_SHA256) }),
  policy: z.strictObject({
    exactRelationships: z.literal("auto_verify_cycle_scoped_candidate_committee_relationships_when_locked_cn_ccl_or_official_filings_are_nonconflicting"),
    correctedIdentifiers: z.literal("retain_source_alias_and_use_native_fec_identifier_only_for_exact_supported_cycles"),
    partyAliases: z.literal("preserve_raw_dfl_and_label_the_source_backed_democratic_affiliation_as_derived"),
    officeChanges: z.literal("classify_later_senate_cycles_as_not_applicable_to_house_never_zero"),
    sourcePrecedence: z.literal("keep_conflicting_or_incomplete_terminal_filing_precedence_excluded"),
    publication: z.literal("separate_methodology_review_and_release_promotion_required"),
  }),
  summary: z.strictObject({ inputCases: z.literal(6), fullyResolvedCases: z.literal(5), partiallyResolvedCases: z.literal(1), autoUsableHouseCycles: z.literal(9), autoNotApplicableHouseCycles: z.literal(2), pendingHouseCycles: z.literal(1), remainingMappingDecisions: z.literal(1), fabricatedReviewerApprovals: z.literal(0) }),
  dispositions: z.array(disposition).length(6),
  remainingDecisionQueue: z.tuple([pendingDecision]),
  derivation: z.strictObject({ dispositionSetSha256: SHA, remainingDecisionSetSha256: SHA }),
  review: z.strictObject({ status: z.literal("automatic_dispositions_plus_proposed_decision"), reviewer: z.null(), reviewedAt: z.null() }),
  packageSha256: SHA,
});

export type AipacIncumbentResolutionDispositionsV2 = z.infer<typeof aipacIncumbentResolutionDispositionsV2Schema>;
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const order = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
export function aipacIncumbentResolutionSemanticsSha256(rows: readonly z.infer<typeof disposition>[]): string {
  const semantics = rows.map(({ seatCycleId, sourceCandidateId, canonicalCandidateId, alternateCandidateIds, identityDisposition, rawPartyTreatment, sourceResolutionSha256, cycleDispositions }) => ({ seatCycleId, sourceCandidateId, canonicalCandidateId, alternateCandidateIds, identityDisposition, rawPartyTreatment, sourceResolutionSha256, cycleDispositions }));
  return digest("dsa-seats:aipac-incumbent-resolution-semantics:v2\0", semantics);
}

function cycleOutcome(seatCycleId: string, source: z.infer<typeof sourceResolution>["cycleDispositions"][number]): z.infer<typeof cycleDisposition> {
  const base = { cycleYear: source.cycleYear, committeeIds: source.committeeIds, evidenceRule: source.evidenceRule };
  if (seatCycleId === "seat_house_ca_31_current" && source.cycleYear === 2024) return cycleDisposition.parse({ ...base, disposition: "pending_source_precedence_review", provenanceKind: "derived", confidence: "high", evaluatorUse: "excluded_pending_review", rationaleCodes: ["CN24_STALE_COMMITTEE", "CCL24_RELATIONSHIP_ABSENT", "TERMINAL_FORM2_PRECEDENCE_RECEIPT_REQUIRED"] });
  if (source.disposition === "office_changed_to_senate") return cycleDisposition.parse({ ...base, disposition: "auto_verified_no_house_candidacy", provenanceKind: "direct", confidence: "certain", evaluatorUse: "not_applicable_no_house_candidacy", rationaleCodes: ["LATER_OFFICIAL_FILING_CHANGED_OFFICE_TO_SENATE", "HOUSE_CYCLE_NOT_APPLICABLE_NOT_ZERO"] });
  const derived = seatCycleId === "seat_house_mn_03_current";
  return cycleDisposition.parse({ ...base, disposition: derived ? "auto_derived_house_relationship" : "auto_verified_house_relationship", provenanceKind: derived ? "derived" : "direct", confidence: derived ? "high" : "certain", evaluatorUse: "reviewer_only_candidate", rationaleCodes: derived ? ["EXACT_CANDIDATE_COMMITTEE_MATCH", "RAW_DFL_PRESERVED", "SOURCED_DEMOCRATIC_AFFILIATION_INFERENCE"] : ["EXACT_CYCLE_SCOPED_OFFICIAL_RELATIONSHIP"] });
}

export function buildAipacIncumbentResolutionDispositionsV2(input: Readonly<{ parent: unknown; parentFileSha256: string }>): AipacIncumbentResolutionDispositionsV2 {
  if (input.parentFileSha256 !== PARENT_FILE_SHA256) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_PARENT_FILE_HASH_MISMATCH");
  const parent = validateAipacIncumbentConflictResolutionCandidate(input.parent);
  if (parent.packageSha256 !== PARENT_PACKAGE_SHA256) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_PARENT_PACKAGE_HASH_MISMATCH");
  const dispositions = parent.resolutions.map((row) => {
    const identityDisposition = row.seatCycleId === "seat_house_md_04_current" || row.seatCycleId === "seat_house_ny_04_current" ? "auto_corrected_native_id" as const : row.seatCycleId === "seat_house_mn_03_current" ? "auto_derived_party_alias" as const : "auto_verified_exact" as const;
    const unsigned = { sourceDecisionId: row.sourceDecisionId, seatCycleId: row.seatCycleId, sourceCandidateId: row.sourceCandidateId, canonicalCandidateId: row.canonicalCandidateId, alternateCandidateIds: row.alternateCandidateIds, identityDisposition, rawPartyTreatment: row.partyTreatment === "explicit_dfl_alias_required" ? "preserve_dfl_with_sourced_democratic_affiliation" as const : "exact_dem" as const, cycleDispositions: row.cycleDispositions.map((cycle) => cycleOutcome(row.seatCycleId, cycle)), sourceResolutionSha256: row.resolutionSha256, officialFilingSourceLockIds: row.officialFilingSourceLockIds, sourceEvidenceRecordSha256s: row.sourceEvidenceRecordSha256s, rationaleCodes: row.rationaleCodes };
    return disposition.parse({ ...unsigned, dispositionSha256: digest("dsa-seats:aipac-incumbent-resolution-disposition:v2\0", unsigned) });
  }).sort((a, b) => order(a.seatCycleId, b.seatCycleId));
  const ca = dispositions.find((row) => row.seatCycleId === "seat_house_ca_31_current");
  if (!ca) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_CA31_MISSING");
  const decisionUnsigned = { decisionId: "aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174" as const, component: "candidate_committee_source_precedence" as const, seatCycleId: "seat_house_ca_31_current" as const, cycleYear: 2024 as const, question: "Should the 2024 CA-31 relationship use C00850420 when CN24 names stale committee C00650648, CCL24 supplies no link, and the retained direct Form 2 evidence has no cutoff-bounded terminal-amendment-chain receipt?" as const, recommendedDecision: "Defer the 2024 relationship until a source-locked terminal amendment chain proves which filing controlled at the cutoff; retain the exact 2026 relationship independently." as const, defaultReversibleAssumption: "exclude_only_ca31_2024_relationship" as const, alternatives: ["Accept the direct Form 2 override after retaining terminal-chain evidence.", "Reject the 2024 override and keep the cycle unavailable."] as const, consequences: ["Deferral blocks only CA-31's 2024 direct relationship and does not block its exact 2026 mapping.", "Acceptance without the missing precedence receipt would overstate the current evidence closure."] as const, confidence: "high_but_insufficiently_closed" as const, blocksPublicationForRelationship: true as const, blocksOtherWork: false as const, workCompletedWhileWaiting: ["The 2026 CN/CCL relationship is independently auto-verified.", "Every other incumbent case is resolved from exact or explicitly derived locked evidence."] as const, requiredEvidence: ["cutoff_bounded_terminal_form2_amendment_chain_receipt"] as const, sourceResolutionSha256: ca.sourceResolutionSha256, officialFilingSourceLockIds: ca.officialFilingSourceLockIds, resolution: null, reviewer: null, reviewedAt: null };
  const remainingDecisionQueue = [pendingDecision.parse({ ...decisionUnsigned, decisionSha256: digest("dsa-seats:aipac-incumbent-resolution-decision:v2\0", decisionUnsigned) })] as const;
  const unsigned = { schema: "aipac-incumbent-resolution-dispositions-v2" as const, version: 2 as const, generatedAt: "2026-08-05T21:00:00.000Z" as const, sourceCutoff: "2026-08-04" as const, reviewerOnly: true as const, publicationEligible: false as const, status: "automatic_evidence_dispositions_with_one_pending_precedence_decision" as const, defaultUse: "apply_only_to_a_new_reviewer_only_foundation_never_as_publication_approval" as const, inputs: { parentFileSha256: PARENT_FILE_SHA256, parentPackageSha256: PARENT_PACKAGE_SHA256 }, policy: { exactRelationships: "auto_verify_cycle_scoped_candidate_committee_relationships_when_locked_cn_ccl_or_official_filings_are_nonconflicting" as const, correctedIdentifiers: "retain_source_alias_and_use_native_fec_identifier_only_for_exact_supported_cycles" as const, partyAliases: "preserve_raw_dfl_and_label_the_source_backed_democratic_affiliation_as_derived" as const, officeChanges: "classify_later_senate_cycles_as_not_applicable_to_house_never_zero" as const, sourcePrecedence: "keep_conflicting_or_incomplete_terminal_filing_precedence_excluded" as const, publication: "separate_methodology_review_and_release_promotion_required" as const }, summary: { inputCases: 6 as const, fullyResolvedCases: 5 as const, partiallyResolvedCases: 1 as const, autoUsableHouseCycles: 9 as const, autoNotApplicableHouseCycles: 2 as const, pendingHouseCycles: 1 as const, remainingMappingDecisions: 1 as const, fabricatedReviewerApprovals: 0 as const }, dispositions, remainingDecisionQueue, derivation: { dispositionSetSha256: digest("dsa-seats:aipac-incumbent-resolution-disposition-set:v2\0", dispositions), remainingDecisionSetSha256: digest("dsa-seats:aipac-incumbent-resolution-decision-set:v2\0", remainingDecisionQueue) }, review: { status: "automatic_dispositions_plus_proposed_decision" as const, reviewer: null, reviewedAt: null } };
  return validateAipacIncumbentResolutionDispositionsV2({ ...unsigned, packageSha256: digest("dsa-seats:aipac-incumbent-resolution-dispositions:v2\0", unsigned) });
}

export function validateAipacIncumbentResolutionDispositionsV2(value: unknown): AipacIncumbentResolutionDispositionsV2 {
  const parsed = aipacIncumbentResolutionDispositionsV2Schema.parse(value), { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-incumbent-resolution-dispositions:v2\0", unsigned)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_PACKAGE_HASH_MISMATCH");
  if (parsed.derivation.dispositionSetSha256 !== digest("dsa-seats:aipac-incumbent-resolution-disposition-set:v2\0", parsed.dispositions) || parsed.derivation.remainingDecisionSetSha256 !== digest("dsa-seats:aipac-incumbent-resolution-decision-set:v2\0", parsed.remainingDecisionQueue)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_DERIVATION_MISMATCH");
  const cycles = parsed.dispositions.flatMap((row) => row.cycleDispositions);
  if (new Set(parsed.dispositions.map((row) => row.seatCycleId)).size !== 6 || cycles.filter((row) => row.evaluatorUse === "reviewer_only_candidate").length !== 9 || cycles.filter((row) => row.evaluatorUse === "not_applicable_no_house_candidacy").length !== 2 || cycles.filter((row) => row.evaluatorUse === "excluded_pending_review").length !== 1) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_UNIVERSE_MISMATCH");
  if (aipacIncumbentResolutionSemanticsSha256(parsed.dispositions) !== AIPAC_INCUMBENT_RESOLUTION_SEMANTICS_SHA256) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_SEMANTICS_MISMATCH");
  for (const row of parsed.dispositions) { const { dispositionSha256, ...rowUnsigned } = row; if (dispositionSha256 !== digest("dsa-seats:aipac-incumbent-resolution-disposition:v2\0", rowUnsigned)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_ROW_HASH_MISMATCH"); }
  const decision = parsed.remainingDecisionQueue[0], { decisionSha256, ...decisionUnsigned } = decision;
  const ca = parsed.dispositions.find((row) => row.seatCycleId === "seat_house_ca_31_current");
  if (!ca || decision.sourceResolutionSha256 !== ca.sourceResolutionSha256 || canonicalJson(decision.officialFilingSourceLockIds) !== canonicalJson(ca.officialFilingSourceLockIds)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_DECISION_BINDING_MISMATCH");
  if (decisionSha256 !== digest("dsa-seats:aipac-incumbent-resolution-decision:v2\0", decisionUnsigned)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_DECISION_HASH_MISMATCH");
  return parsed;
}
