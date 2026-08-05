import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateCurrentIncumbentPrimaryCandidateLinkageCandidate } from "./current-incumbent-primary-candidate-linkage-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNjPaPrimaryGeographyCompatibilityCandidate } from "./nj-pa-primary-geography-compatibility-candidate";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  linkageFile: "d4b05e851c9024cad4076e07cf921cc21176ae3d2e92caaf4e847b5a9d85f53d",
  linkagePackage: "cea679fcc77960acf076de64d1d8fe4bbac668a024af7e345332f1effa76a4f4",
  geographyFile: "e4f5594d073524b13bfd0e950cb897fdfae60f866489712b7a3c000efc81f9cf",
  geographyPackage: "cb662d10fcec1726518ac4329b16e2110ed4776d047b6b838421deb633f62a52",
} as const;
const EXPECTED_PACKAGE = "63f3e0fa2e5514a5a91c10e75c641e81cc7b765ae71258480b2e1969c24f3666";
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));

const DECISION_IDS = [
  "approve-historic-primary-candidate-identity-resolution-v1",
  "approve-historical-district-cd119-compatibility-v1",
] as const;

const identity = z.strictObject({
  evidenceClass: z.enum(["exact_name_observation", "derived_name_relationship", "inferred_name_relationship", "unresolved"]),
  confidence: z.enum(["high", "medium", "none"]),
  relationshipDisposition: z.enum(["proposed_identity_link_pending_documented_review", "not_linked_no_unique_candidate"]),
  reviewTier: z.enum(["high_confidence_candidate", "medium_confidence_inference_candidate", "unresolved_no_unique_candidate"]),
  parentRowSha256: SHA,
});
const geography = z.strictObject({
  compatibilityDisposition: z.enum(["official_no_plan_change_declaration_same_geoid_key_candidate", "same_cd119_session_and_geoid_exact_key_candidate", "unassessed_cd120_authority_collection_pending"]),
  evidenceClass: z.enum(["direct_official_plan_continuity_and_derived_key", "derived_exact_session_and_key", "authority_pending"]),
  confidence: z.enum(["high", "none"]),
  compatibilityCandidate: z.boolean(),
  parentRowSha256: SHA,
});
const category = z.enum([
  "both_candidates_pending_independent_reviews",
  "identity_candidate_cd120_geography_pending",
  "geography_candidate_identity_unresolved",
  "identity_unresolved_cd120_geography_pending",
]);
const action = z.enum([
  "review_identity_and_geography_under_existing_decisions",
  "review_identity_retain_cd120_geography_pending",
  "review_geography_retain_identity_unresolved",
  "retain_identity_and_cd120_geography_pending",
]);
const rationale = z.enum([
  "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS",
  "IDENTITY_CANDIDATE_PRESENT_CD120_AUTHORITY_NOT_RETAINED",
  "GEOGRAPHY_CANDIDATE_PRESENT_NO_UNIQUE_IDENTITY_CANDIDATE",
  "NO_UNIQUE_IDENTITY_CANDIDATE_AND_CD120_AUTHORITY_NOT_RETAINED",
]);
const reviewRow = z.strictObject({
  linkageId: z.string(), contestSha256: SHA, seatCycleId: z.string(), stateCode: z.enum(["NJ", "PA"]), districtCode: z.string().regex(/^\d{2}$/), cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  identity, geography, jointCategory: category, recommendedAction: action, rationaleCode: rationale,
  identityApproved: z.literal(false), geographyApproved: z.literal(false), jointApproved: z.literal(false),
  evaluatorUse: z.literal("excluded_pending_parent_decisions_and_all_other_gates"), scoreEligible: z.literal(false), rowSha256: SHA,
});
const parentDecisionReview = z.strictObject({
  reviewOfDecisionId: z.enum(DECISION_IDS), ownerSourceLockId: z.literal("house-democratic-primary-source-selection-proposal-20260804-v1"),
  ownerFileSha256: z.literal(INPUTS.proposalFile), ownerPackageSha256: z.literal(INPUTS.proposalPackage), inherited: z.literal(true),
  createsIndependentDecision: z.literal(false), supersedesDecisionIds: z.array(z.never()).length(0),
  parentQuestion: z.string().min(1), parentRecommendedDecision: z.string().min(1),
  parentDefaultReversibleAssumption: z.literal("retain_plan_exclude_from_evaluator_and_publication"),
  parentResolution: z.null(), evidenceSha256s: z.array(SHA).length(4), categorySet: z.array(category).min(1),
  proposedResolution: z.null(), reviewer: z.null(), reviewedAt: z.null(), reviewRecordSha256: SHA,
});

export const njPaPrimaryIdentityGeographyReviewPackageSchema = z.strictObject({
  schema: z.literal("nj-pa-primary-identity-geography-review-package-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-06T16:00:00.000Z"),
  sourceCutoff: z.literal("2026-08-05"), parentSourceCutoff: z.literal("2026-08-04"), parentSuperseded: z.literal(false), reviewerOnly: z.literal(true), publicationEligible: z.literal(false),
  defaultUse: z.literal("exclude_from_evaluator_and_publication_until_exact_parent_decisions_and_all_other_gates_are_approved"),
  review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null(), resolution: z.null() }),
  inputs: z.strictObject({
    sourceSelectionProposal: z.strictObject({ sourceLockId: z.literal("house-democratic-primary-source-selection-proposal-20260804-v1"), fileSha256: z.literal(INPUTS.proposalFile), packageSha256: z.literal(INPUTS.proposalPackage), parentDecisionIds: z.tuple([z.literal(DECISION_IDS[0]), z.literal(DECISION_IDS[1])]), decisionsUnresolved: z.literal(true) }),
    linkageCandidate: z.strictObject({ sourceLockId: z.literal("current-incumbent-primary-candidate-linkage-candidate-v1"), fileSha256: z.literal(INPUTS.linkageFile), packageSha256: z.literal(INPUTS.linkagePackage) }),
    geographyCandidate: z.strictObject({ sourceLockId: z.literal("nj-pa-primary-geography-compatibility-candidate-v1"), fileSha256: z.literal(INPUTS.geographyFile), packageSha256: z.literal(INPUTS.geographyPackage) }),
  }),
  methodology: z.strictObject({
    role: z.literal("strict_join_and_review_queue_over_existing_parent_decisions"), joinKey: z.literal("linkageId_with_exact_contest_and_seat_cycle_closure"),
    parentDecisionsInheritedNotCreated: z.literal(true), publicationDecisionPresent: z.literal(false), promotionNotAssessed: z.literal(true),
    highConfidenceIdentityRule: z.literal("exact_or_derived_name_relationship_with_high_confidence_is_still_only_a_candidate"),
    mediumConfidenceIdentityRule: z.literal("inferred_name_relationship_requires_individual_review"), unresolvedIdentityRule: z.literal("retain_no_link_when_no_unique_candidate"),
    geographyRule: z.literal("retain_32_candidates_and_9_cd120_pending_without_approval"), allOtherParentGatesRemainRequired: z.literal(true), automaticApprovals: z.literal(0), evaluatorNumericValues: z.literal(0),
  }),
  privacy: z.strictObject({ candidateNamesExcluded: z.literal(true), candidateNumbersVotesAndMarkersExcluded: z.literal(true), addressesContactsDobDonorsExcluded: z.literal(true), rawGeometryExcluded: z.literal(true), rawSourceTextExcluded: z.literal(true) }),
  summary: z.strictObject({
    observations: z.literal(41), bothCandidatesPendingIndependentReviews: z.literal(25), identityCandidateCd120GeographyPending: z.literal(8), geographyCandidateIdentityUnresolved: z.literal(7), identityUnresolvedCd120GeographyPending: z.literal(1),
    exactIdentityCandidates: z.literal(18), derivedIdentityCandidates: z.literal(9), inferredIdentityCandidates: z.literal(6), unresolvedIdentityRows: z.literal(8), geographyCandidates: z.literal(32), cd120PendingRows: z.literal(9), parentDecisionReviews: z.literal(2), automaticApprovals: z.literal(0), scoreEligibleRows: z.literal(0),
  }),
  rows: z.array(reviewRow).length(41), rowSetSha256: SHA, parentDecisionReviews: z.array(parentDecisionReview).length(2), reviewRecordSetSha256: SHA, packageSha256: SHA,
});
export type NjPaPrimaryIdentityGeographyReviewPackage = z.infer<typeof njPaPrimaryIdentityGeographyReviewPackageSchema>;
type Row = z.infer<typeof reviewRow>;
type ParentDecisionReview = z.infer<typeof parentDecisionReview>;

function expectedRowDisposition(row: Row): { category: z.infer<typeof category>; action: z.infer<typeof action>; rationale: z.infer<typeof rationale> } {
  const identityCandidate = row.identity.relationshipDisposition === "proposed_identity_link_pending_documented_review";
  const geographyCandidate = row.geography.compatibilityCandidate;
  if (identityCandidate && geographyCandidate) return { category: "both_candidates_pending_independent_reviews", action: "review_identity_and_geography_under_existing_decisions", rationale: "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS" };
  if (identityCandidate) return { category: "identity_candidate_cd120_geography_pending", action: "review_identity_retain_cd120_geography_pending", rationale: "IDENTITY_CANDIDATE_PRESENT_CD120_AUTHORITY_NOT_RETAINED" };
  if (geographyCandidate) return { category: "geography_candidate_identity_unresolved", action: "review_geography_retain_identity_unresolved", rationale: "GEOGRAPHY_CANDIDATE_PRESENT_NO_UNIQUE_IDENTITY_CANDIDATE" };
  return { category: "identity_unresolved_cd120_geography_pending", action: "retain_identity_and_cd120_geography_pending", rationale: "NO_UNIQUE_IDENTITY_CANDIDATE_AND_CD120_AUTHORITY_NOT_RETAINED" };
}

export function assertNjPaPrimaryJointReviewRowSemantics(value: unknown): void {
  const rows = z.array(reviewRow).length(41).parse(value);
  const invalid = rows.some((row, index) => {
    const { rowSha256, ...unsigned } = row;
    const expected = expectedRowDisposition(row);
    const tier = row.identity.evidenceClass === "exact_name_observation" || row.identity.evidenceClass === "derived_name_relationship" ? "high_confidence_candidate" : row.identity.evidenceClass === "inferred_name_relationship" ? "medium_confidence_inference_candidate" : "unresolved_no_unique_candidate";
    const identityEvidenceIsCandidate = row.identity.evidenceClass !== "unresolved";
    const identityDispositionIsCandidate = row.identity.relationshipDisposition === "proposed_identity_link_pending_documented_review";
    const geographyTupleValid = row.cycleYear === 2026
      ? row.stateCode === "NJ" && row.geography.compatibilityDisposition === "unassessed_cd120_authority_collection_pending" && row.geography.evidenceClass === "authority_pending" && row.geography.confidence === "none" && !row.geography.compatibilityCandidate
      : row.cycleYear === 2022
        ? row.geography.compatibilityDisposition === "official_no_plan_change_declaration_same_geoid_key_candidate" && row.geography.evidenceClass === "direct_official_plan_continuity_and_derived_key" && row.geography.confidence === "high" && row.geography.compatibilityCandidate
        : row.geography.compatibilityDisposition === "same_cd119_session_and_geoid_exact_key_candidate" && row.geography.evidenceClass === "derived_exact_session_and_key" && row.geography.confidence === "high" && row.geography.compatibilityCandidate;
    return rowSha256 !== digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", unsigned)
      || (index > 0 && bytewise(rows[index - 1]!.linkageId, row.linkageId) >= 0)
      || row.jointCategory !== expected.category || row.recommendedAction !== expected.action || row.rationaleCode !== expected.rationale
      || row.identity.reviewTier !== tier || row.identityApproved || row.geographyApproved || row.jointApproved || row.scoreEligible
      || identityEvidenceIsCandidate !== identityDispositionIsCandidate || !geographyTupleValid
      || (tier === "high_confidence_candidate" && row.identity.confidence !== "high")
      || (tier === "medium_confidence_inference_candidate" && row.identity.confidence !== "medium")
      || (tier === "unresolved_no_unique_candidate" && row.identity.confidence !== "none")
      || (row.geography.compatibilityCandidate !== (row.geography.confidence === "high"));
  });
  if (invalid) throw new Error("PRIMARY_JOINT_REVIEW_ROW_SEMANTICS_INVALID");
}

const sealReview = (value: Omit<ParentDecisionReview, "reviewRecordSha256">): ParentDecisionReview => parentDecisionReview.parse({ ...value, reviewRecordSha256: digest("dsa-seats:nj-pa-primary-parent-decision-review:v1\0", value) });

export function buildNjPaPrimaryIdentityGeographyReviewPackage(input: Readonly<{ proposal: unknown; proposalFileSha256: string; linkage: unknown; linkageFileSha256: string; geography: unknown; geographyFileSha256: string; sourceLock: unknown }>): NjPaPrimaryIdentityGeographyReviewPackage {
  if (input.proposalFileSha256 !== INPUTS.proposalFile || input.linkageFileSha256 !== INPUTS.linkageFile || input.geographyFileSha256 !== INPUTS.geographyFile) throw new Error("PRIMARY_JOINT_REVIEW_INPUT_FILE_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const linkage = validateCurrentIncumbentPrimaryCandidateLinkageCandidate(input.linkage);
  const geographyCandidate = validateNjPaPrimaryGeographyCompatibilityCandidate(input.geography);
  const parentDecisions = DECISION_IDS.map((id) => proposal.decisions.find((decision) => decision.decisionId === id));
  if (proposal.packageSha256 !== INPUTS.proposalPackage || proposal.sourceCutoff !== "2026-08-04" || parentDecisions.some((decision) => !decision || decision.resolution !== null)
    || linkage.packageSha256 !== INPUTS.linkagePackage || geographyCandidate.packageSha256 !== INPUTS.geographyPackage
    || linkage.sourceCutoff !== "2026-08-05" || geographyCandidate.sourceCutoff !== "2026-08-05" || linkage.parentSourceCutoff !== "2026-08-04" || geographyCandidate.parentSourceCutoff !== "2026-08-04"
    || linkage.review.resolution !== null || geographyCandidate.review.resolution !== null
    || linkage.decisionSupport.informsDecisionId !== DECISION_IDS[0] || geographyCandidate.decisionSupport.informsDecisionId !== DECISION_IDS[1]) throw new Error("PRIMARY_JOINT_REVIEW_PARENT_INVALID");

  const lock = z.object({ entries: z.array(z.object({ id: z.string(), retainedPath: z.string().nullable().optional(), retainedStatus: z.string(), sha256: SHA, kind: z.string() })) }).parse(input.sourceLock);
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal"],
    ["current-incumbent-primary-candidate-linkage-candidate-v1", INPUTS.linkageFile, "data/metadata/current-incumbent-primary-candidate-linkage-candidate-v1.json", "review_candidate"],
    ["nj-pa-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/nj-pa-primary-geography-compatibility-candidate-v1.json", "review_candidate"],
  ] as const;
  if (required.some(([id, sha, path, kind]) => { const matches = lock.entries.filter((entry) => entry.id === id); return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== sha || matches[0]!.retainedPath !== path || matches[0]!.kind !== kind; })) throw new Error("PRIMARY_JOINT_REVIEW_SOURCE_LOCK_MISMATCH");

  const geographyById = new Map(geographyCandidate.rows.map((row) => [row.linkageId, row]));
  const rows: Row[] = linkage.links.map((link) => {
    const geo = geographyById.get(link.linkageId);
    if (!geo || geo.contestSha256 !== link.contestSha256 || geo.seatCycleId !== link.seatCycleId || geo.stateCode !== link.stateCode || geo.districtCode !== link.districtCode || geo.cycleYear !== link.cycleYear) throw new Error("PRIMARY_JOINT_REVIEW_PARENT_ROW_MISMATCH");
    const reviewTier = link.evidenceClass === "exact_name_observation" || link.evidenceClass === "derived_name_relationship" ? "high_confidence_candidate" as const : link.evidenceClass === "inferred_name_relationship" ? "medium_confidence_inference_candidate" as const : "unresolved_no_unique_candidate" as const;
    const skeleton = { identity: { evidenceClass: link.evidenceClass, confidence: link.confidence, relationshipDisposition: link.relationshipDisposition, reviewTier, parentRowSha256: link.rowSha256 }, geography: { compatibilityDisposition: geo.compatibilityDisposition, evidenceClass: geo.evidenceClass, confidence: geo.confidence, compatibilityCandidate: geo.compatibilityCandidate, parentRowSha256: geo.rowSha256 } };
    const disposition = expectedRowDisposition({ ...skeleton, linkageId: link.linkageId, contestSha256: link.contestSha256, seatCycleId: link.seatCycleId, stateCode: link.stateCode, districtCode: link.districtCode, cycleYear: link.cycleYear, jointCategory: "both_candidates_pending_independent_reviews", recommendedAction: "review_identity_and_geography_under_existing_decisions", rationaleCode: "IDENTITY_CANDIDATE_AND_GEOGRAPHY_CANDIDATE_REQUIRE_SEPARATE_APPROVALS", identityApproved: false, geographyApproved: false, jointApproved: false, evaluatorUse: "excluded_pending_parent_decisions_and_all_other_gates", scoreEligible: false, rowSha256: "0".repeat(64) });
    const unsigned = { linkageId: link.linkageId, contestSha256: link.contestSha256, seatCycleId: link.seatCycleId, stateCode: link.stateCode, districtCode: link.districtCode, cycleYear: link.cycleYear, ...skeleton, jointCategory: disposition.category, recommendedAction: disposition.action, rationaleCode: disposition.rationale, identityApproved: false as const, geographyApproved: false as const, jointApproved: false as const, evaluatorUse: "excluded_pending_parent_decisions_and_all_other_gates" as const, scoreEligible: false as const };
    return reviewRow.parse({ ...unsigned, rowSha256: digest("dsa-seats:nj-pa-primary-joint-review-row:v1\0", unsigned) });
  }).sort((left, right) => bytewise(left.linkageId, right.linkageId));
  if (geographyById.size !== rows.length) throw new Error("PRIMARY_JOINT_REVIEW_PARENT_SET_MISMATCH");

  const categorySet = [...new Set(rows.map((row) => row.jointCategory))].sort(bytewise);
  const parentDecisionReviews = parentDecisions.map((decision, index) => sealReview({
    reviewOfDecisionId: DECISION_IDS[index]!, ownerSourceLockId: "house-democratic-primary-source-selection-proposal-20260804-v1", ownerFileSha256: INPUTS.proposalFile, ownerPackageSha256: INPUTS.proposalPackage,
    inherited: true, createsIndependentDecision: false, supersedesDecisionIds: [], parentQuestion: decision!.question, parentRecommendedDecision: decision!.recommendedDecision,
    parentDefaultReversibleAssumption: decision!.defaultReversibleAssumption, parentResolution: null,
    evidenceSha256s: [INPUTS.proposalPackage, index === 0 ? INPUTS.linkagePackage : INPUTS.geographyPackage, index === 0 ? linkage.linkSetSha256 : geographyCandidate.rowSetSha256, digest("dsa-seats:nj-pa-primary-joint-review-category-set:v1\0", categorySet)],
    categorySet, proposedResolution: null, reviewer: null, reviewedAt: null,
  })).sort((left, right) => bytewise(left.reviewOfDecisionId, right.reviewOfDecisionId));

  const unsigned = {
    schema: "nj-pa-primary-identity-geography-review-package-v1" as const, version: 1 as const, generatedAt: "2026-08-06T16:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const, parentSourceCutoff: "2026-08-04" as const, parentSuperseded: false as const, reviewerOnly: true as const, publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_and_publication_until_exact_parent_decisions_and_all_other_gates_are_approved" as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: { sourceSelectionProposal: { sourceLockId: "house-democratic-primary-source-selection-proposal-20260804-v1" as const, fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, parentDecisionIds: [...DECISION_IDS] as [typeof DECISION_IDS[0], typeof DECISION_IDS[1]], decisionsUnresolved: true as const }, linkageCandidate: { sourceLockId: "current-incumbent-primary-candidate-linkage-candidate-v1" as const, fileSha256: INPUTS.linkageFile, packageSha256: INPUTS.linkagePackage }, geographyCandidate: { sourceLockId: "nj-pa-primary-geography-compatibility-candidate-v1" as const, fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage } },
    methodology: { role: "strict_join_and_review_queue_over_existing_parent_decisions" as const, joinKey: "linkageId_with_exact_contest_and_seat_cycle_closure" as const, parentDecisionsInheritedNotCreated: true as const, publicationDecisionPresent: false as const, promotionNotAssessed: true as const, highConfidenceIdentityRule: "exact_or_derived_name_relationship_with_high_confidence_is_still_only_a_candidate" as const, mediumConfidenceIdentityRule: "inferred_name_relationship_requires_individual_review" as const, unresolvedIdentityRule: "retain_no_link_when_no_unique_candidate" as const, geographyRule: "retain_32_candidates_and_9_cd120_pending_without_approval" as const, allOtherParentGatesRemainRequired: true as const, automaticApprovals: 0 as const, evaluatorNumericValues: 0 as const },
    privacy: { candidateNamesExcluded: true as const, candidateNumbersVotesAndMarkersExcluded: true as const, addressesContactsDobDonorsExcluded: true as const, rawGeometryExcluded: true as const, rawSourceTextExcluded: true as const },
    summary: { observations: 41 as const, bothCandidatesPendingIndependentReviews: 25 as const, identityCandidateCd120GeographyPending: 8 as const, geographyCandidateIdentityUnresolved: 7 as const, identityUnresolvedCd120GeographyPending: 1 as const, exactIdentityCandidates: 18 as const, derivedIdentityCandidates: 9 as const, inferredIdentityCandidates: 6 as const, unresolvedIdentityRows: 8 as const, geographyCandidates: 32 as const, cd120PendingRows: 9 as const, parentDecisionReviews: 2 as const, automaticApprovals: 0 as const, scoreEligibleRows: 0 as const },
    rows, rowSetSha256: digest("dsa-seats:nj-pa-primary-joint-review-row-set:v1\0", rows), parentDecisionReviews, reviewRecordSetSha256: digest("dsa-seats:nj-pa-primary-parent-decision-review-set:v1\0", parentDecisionReviews),
  };
  return validateNjPaPrimaryIdentityGeographyReviewPackage({ ...unsigned, packageSha256: digest("dsa-seats:nj-pa-primary-joint-review-package:v1\0", unsigned) });
}

export function validateNjPaPrimaryIdentityGeographyReviewPackage(value: unknown): NjPaPrimaryIdentityGeographyReviewPackage {
  const parsed = njPaPrimaryIdentityGeographyReviewPackageSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  assertNjPaPrimaryJointReviewRowSemantics(parsed.rows);
  const invalidReview = parsed.parentDecisionReviews.some((review) => { const { reviewRecordSha256, ...reviewUnsigned } = review; return reviewRecordSha256 !== digest("dsa-seats:nj-pa-primary-parent-decision-review:v1\0", reviewUnsigned); });
  if (parsed.rowSetSha256 !== digest("dsa-seats:nj-pa-primary-joint-review-row-set:v1\0", parsed.rows) || parsed.reviewRecordSetSha256 !== digest("dsa-seats:nj-pa-primary-parent-decision-review-set:v1\0", parsed.parentDecisionReviews) || invalidReview) throw new Error("PRIMARY_JOINT_REVIEW_SET_HASH_MISMATCH");
  const counts = Object.fromEntries(category.options.map((key) => [key, parsed.rows.filter((row) => row.jointCategory === key).length]));
  const evidenceCounts = Object.fromEntries(["exact_name_observation", "derived_name_relationship", "inferred_name_relationship", "unresolved"].map((key) => [key, parsed.rows.filter((row) => row.identity.evidenceClass === key).length]));
  if (canonicalJson(counts) !== canonicalJson({ both_candidates_pending_independent_reviews: 25, identity_candidate_cd120_geography_pending: 8, geography_candidate_identity_unresolved: 7, identity_unresolved_cd120_geography_pending: 1 })
    || canonicalJson(evidenceCounts) !== canonicalJson({ exact_name_observation: 18, derived_name_relationship: 9, inferred_name_relationship: 6, unresolved: 8 })
    || canonicalJson(parsed.parentDecisionReviews.map((review) => review.reviewOfDecisionId).sort(bytewise)) !== canonicalJson([...DECISION_IDS].sort(bytewise))) throw new Error("PRIMARY_JOINT_REVIEW_SUMMARY_INVALID");
  if ((EXPECTED_PACKAGE && packageSha256 !== EXPECTED_PACKAGE) || packageSha256 !== digest("dsa-seats:nj-pa-primary-joint-review-package:v1\0", unsigned)) throw new Error("PRIMARY_JOINT_REVIEW_PACKAGE_HASH_MISMATCH");
  return parsed;
}
