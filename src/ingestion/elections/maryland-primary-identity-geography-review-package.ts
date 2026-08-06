import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMarylandPrimaryIdentityCandidate,
  type MarylandPrimaryIdentityCandidate,
} from "./maryland-current-incumbent-primary-linkage-candidate";
import {
  validateMarylandPrimaryGeographyCandidate,
  type MarylandPrimaryGeographyCandidate,
} from "./maryland-primary-geography-compatibility-candidate";

export const MARYLAND_PRIMARY_JOINT_REVIEW_V1 =
  "maryland-primary-identity-geography-review-package-v1" as const;
export const MARYLAND_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 = "d9cbe64445e110f5129f61b25063d58972e8c38138fd97c22b056a0731abf345";
export const MARYLAND_PRIMARY_JOINT_RECORD_SET_SHA256 = "c25e71331916e2b47ef0841ca36658ca7d24583f854b66ed0e883d57f57edf6f";
export const MARYLAND_PRIMARY_JOINT_DECISION_SET_SHA256 = "6564b7beea241c673e61b6c9da7f175ac20b57b3c00d5d135c7f337bfd0f2674";
export const MARYLAND_PRIMARY_JOINT_PACKAGE_SHA256 = "9c58994d92156fa552fdfe8b8c3f4259dc47d130404001948694eda688213074";

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "632a49ca04113a66b075ac2fe5e9ac37c0af03d52d908297ac77316411f71324",
  identityPackage: "c79fd8233aecd8ff2f2c0cb5cde0a7834df27bf818de1c346848d57727b4f16f",
  identitySet: "cb22b245da751503939a3b778cb9941696b815b6930da24359c85f2e94938269",
  geographyFile: "9b4dd1d3d9a39ec8cb12d3817953a7dedaf146a73fac74541d489544338ecf1e",
  geographyPackage: "64d0751b3dedd67871b459660ae459a4402443500b9af2a0b5bc6f458a392ea0",
  geographySet: "fec32c7a0508946cf9f33b2ad301e94062fec5aa6c56a868e96ae47737aa9d4b",
} as const;
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;
const IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "maryland-house-democratic-primary-results-2022-2024-v1",
] as const;
const GEOGRAPHY_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "maryland-house-democratic-primary-results-2022-2024-v1",
  "maryland-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-24",
  "tiger-cd119-24",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "maryland-current-incumbent-primary-linkage-candidate-v1",
  "maryland-primary-geography-compatibility-candidate-v1",
] as const;
const OUTPUT_FILE_SHA256 = "20224dd8cf7224f14cfaf94827c65d5e306d3bab3a7b4dc25515396e6fd9091a";
const OUTPUT_BYTE_SIZE = 49_954;
const TARGET_DISTRICTS = ["02", "03", "04", "05", "06", "07", "08"] as const;
const CYCLES = [2022, 2024] as const;

type ReviewRecord = Readonly<{
  reviewRecordId: string;
  identityObservationId: string;
  geographyObservationId: string;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-07-19" | "2024-05-14";
  seatCycleId: string;
  districtCode: string;
  identity: Readonly<{
    parentRowSha256: string;
    status: "candidate" | "unresolved";
    identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
    bioguideId: string;
    officialHouseName: string;
    sourceCandidateName: string | null;
    evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
    confidence: "high" | null;
    relationshipDisposition: "proposed_identity_link_pending_documented_review" | "not_linked_no_unique_current_incumbent_candidate_same_district";
    candidate: boolean;
    approved: false;
  }>;
  geography: Readonly<{
    parentRowSha256: string;
    status: "candidate";
    targetCd119Geoid: string;
    historicalCongressSession: "118" | "119";
    historicalGeoid: string;
    evidenceClass: "direct_official_plan_continuity_and_derived_key" | "derived_exact_session_and_key";
    confidence: "high";
    compatibilityDisposition: string;
    candidate: true;
    approved: false;
  }>;
  reviewCategory: "identity_and_geography_candidates" | "geography_candidate_identity_unresolved";
  resultDispositionPreserved: true;
  dispositionDecisionStatus: "unresolved";
  resultAuthorityStatus: "state_board_official_result_candidate";
  certificationStatus: "not_independently_retained";
  sourceWinnerStatus: "marked_by_source";
  progressiveClassificationStatus: "not_retained";
  jointApproved: false;
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false;
  reviewerAction: "review_identity_and_geography_independently" | "review_geography_while_preserving_identity_no_match";
  rationaleCodes: readonly string[];
  reviewRecordSha256: string;
}>;

type DecisionId =
  | "md-primary:retain-state-board-result-authority-certification-exclusion-v1"
  | "md-primary:accept-geography-compatibility-v1"
  | "md-primary:accept-identity-links-v1"
  | "md-primary:retain-primary-disposition-exclusion-v1"
  | "md-primary:retain-progressive-classification-exclusion-v1";
type ParentDecisionId =
  | "collect-official-state-primary-results-and-certification-v1"
  | "approve-historical-district-cd119-compatibility-v1"
  | "approve-historic-primary-candidate-identity-resolution-v1"
  | "decide-nonstandard-primary-disposition-treatment-v1"
  | "approve-progressive-candidate-classification-method-v1";
type Decision = Readonly<{
  decisionId: DecisionId;
  affectedComponent: string;
  parentDecisionId: ParentDecisionId;
  question: string;
  recommendedDecision: string;
  defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication";
  alternatives: readonly [string, string];
  consequences: readonly [string, string];
  confidence: "high";
  evidenceRecordIds: readonly string[];
  blocksAffectedPublication: true;
  blocksOtherWork: false;
  workCompletedWhileWaiting: string;
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
}>;

export type MarylandPrimaryJointReviewPackage = Readonly<{
  schema: typeof MARYLAND_PRIMARY_JOINT_REVIEW_V1;
  version: 1;
  generatedAt: "2026-08-06T08:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_independent_certification_identity_geography_disposition_and_classification_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    reviewRecords: 14;
    identityAndGeographyCandidates: 11;
    geographyCandidateIdentityUnresolved: 3;
    identityCandidates: 11;
    geographyCandidates: 14;
    stateBoardOfficialResultCandidateRecords: 14;
    reportedContestRecords: 14;
    proposedDecisions: 5;
    jointApprovedRecords: 0;
    scoreEligibleRecords: 0;
  }>;
  records: readonly ReviewRecord[];
  reviewRecordSetSha256: string;
  decisions: readonly Decision[];
  decisionSetSha256: string;
  inheritedDecisionResolutions: Readonly<{
    certification: null;
    identity: null;
    geography: null;
    disposition: null;
    progressiveClassification: null;
  }>;
  packageSha256: string;
}>;

export type MarylandPrimaryJointReviewInput = Readonly<{
  proposalJson: string;
  identityJson: string;
  geographyJson: string;
  sourceLockJson: string;
}>;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`Maryland primary joint review rejected: ${code}`); };
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parse = <T>(value: string, code: string): T => {
  try { return JSON.parse(value) as T; } catch { return fail(code); }
};
const parentProjection = (records: readonly ReviewRecord[]) => records.map((record) => ({
  reviewRecordId: record.reviewRecordId,
  identityObservationId: record.identityObservationId,
  identityParentRowSha256: record.identity.parentRowSha256,
  geographyObservationId: record.geographyObservationId,
  geographyParentRowSha256: record.geography.parentRowSha256,
  contestId: record.contestId,
  contestSha256: record.contestSha256,
  identityStatus: record.identity.identityStatus,
  reviewCategory: record.reviewCategory,
}));

export function buildMarylandPrimaryJointReviewPackage(
  input: MarylandPrimaryJointReviewInput,
): MarylandPrimaryJointReviewPackage {
  if (sha256(input.proposalJson) !== INPUTS.proposalFile || sha256(input.identityJson) !== INPUTS.identityFile ||
    sha256(input.geographyJson) !== INPUTS.geographyFile) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const identity = validateMarylandPrimaryIdentityCandidate(
    parse<MarylandPrimaryIdentityCandidate>(input.identityJson, "IDENTITY_JSON_INVALID"));
  const geography = validateMarylandPrimaryGeographyCandidate(
    parse<MarylandPrimaryGeographyCandidate>(input.geographyJson, "GEOGRAPHY_JSON_INVALID"));
  const decisionIds = [
    "collect-official-state-primary-results-and-certification-v1",
    "approve-historic-primary-candidate-identity-resolution-v1",
    "approve-historical-district-cd119-compatibility-v1",
    "decide-nonstandard-primary-disposition-treatment-v1",
    "approve-progressive-candidate-classification-method-v1",
  ] as const;
  if (proposal.packageSha256 !== INPUTS.proposalPackage || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || geography.packageSha256 !== INPUTS.geographyPackage ||
    geography.rowSetSha256 !== INPUTS.geographySet || identity.review.resolution !== null || geography.review.resolution !== null ||
    decisionIds.some((id) => proposal.decisions.find((decision) => decision.decisionId === id)?.resolution !== null)) fail("PARENT_INVALID");
  const sourceLock = parse<{ entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> }>(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID");
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["maryland-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/maryland-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["maryland-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/maryland-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
  ] as const;
  if (!Array.isArray(sourceLock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const entries = sourceLock.entries as NonNullable<typeof sourceLock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = entries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = entries.filter((entry) => entry.id === MARYLAND_PRIMARY_JOINT_REVIEW_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/maryland-primary-identity-geography-review-package-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_proposal" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const geographyByIdentity = new Map(geography.rows.map((row) => [row.identityObservationId, row]));
  const records: ReviewRecord[] = identity.observations.map((identityRow) => {
    const geographyRow = geographyByIdentity.get(identityRow.observationId) ?? fail("PARENT_JOIN_INVALID");
    if (geographyRow.identityRowSha256 !== identityRow.rowSha256 || geographyRow.contestId !== identityRow.contestId ||
      geographyRow.contestSha256 !== identityRow.contestSha256 || geographyRow.cycleYear !== identityRow.cycleYear ||
      geographyRow.districtCode !== identityRow.districtCode || geographyRow.seatCycleId !== identityRow.seatCycleId ||
      geographyRow.identityStatus !== identityRow.identityStatus) fail("PARENT_JOIN_INVALID");
    const identityCandidate = identityRow.identityStatus === "proposed_identity_link";
    const reviewCategory = identityCandidate ? "identity_and_geography_candidates" as const : "geography_candidate_identity_unresolved" as const;
    const unsigned = {
      reviewRecordId: `md-primary-joint:${identityRow.cycleYear}:${identityRow.districtCode}`,
      identityObservationId: identityRow.observationId,
      geographyObservationId: geographyRow.observationId,
      contestId: identityRow.contestId,
      contestSha256: identityRow.contestSha256,
      cycleYear: identityRow.cycleYear,
      electionDate: identityRow.electionDate,
      seatCycleId: identityRow.seatCycleId,
      districtCode: identityRow.districtCode,
      identity: {
        parentRowSha256: identityRow.rowSha256,
        status: identityCandidate ? "candidate" as const : "unresolved" as const,
        identityStatus: identityRow.identityStatus,
        bioguideId: identityRow.rosterIdentity.bioguideId,
        officialHouseName: identityRow.rosterIdentity.officialHouseName,
        sourceCandidateName: identityRow.sourceCandidate?.sourceCandidateName ?? null,
        evidenceClass: identityRow.evidenceClass,
        confidence: identityRow.confidence,
        relationshipDisposition: identityRow.relationshipDisposition,
        candidate: identityCandidate,
        approved: false as const,
      },
      geography: {
        parentRowSha256: geographyRow.rowSha256,
        status: "candidate" as const,
        targetCd119Geoid: geographyRow.targetCd119Geoid,
        historicalCongressSession: geographyRow.historicalCongressSession,
        historicalGeoid: geographyRow.historicalGeoid,
        evidenceClass: geographyRow.evidenceClass,
        confidence: geographyRow.confidence,
        compatibilityDisposition: geographyRow.compatibilityDisposition,
        candidate: true as const,
        approved: false as const,
      },
      reviewCategory,
      resultDispositionPreserved: true as const,
      dispositionDecisionStatus: "unresolved" as const,
      resultAuthorityStatus: identityRow.resultAuthorityStatus,
      certificationStatus: "not_independently_retained" as const,
      sourceWinnerStatus: "marked_by_source" as const,
      progressiveClassificationStatus: "not_retained" as const,
      jointApproved: false as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
      scoreEligible: false as const,
      reviewerAction: identityCandidate
        ? "review_identity_and_geography_independently" as const
        : "review_geography_while_preserving_identity_no_match" as const,
      rationaleCodes: [reviewCategory, "parent_candidates_not_approved_by_join", "state_board_result_authority_retained_certification_not_independently_retained", "source_winner_marker_not_approval", "all_independent_review_gates_remain_open"],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:md-primary-joint-review-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.reviewRecordId, right.reviewRecordId));
  if (records.length !== 14 || geographyByIdentity.size !== 14 ||
    records.filter((row) => row.reviewCategory === "identity_and_geography_candidates").length !== 11 ||
    records.filter((row) => row.reviewCategory === "geography_candidate_identity_unresolved").length !== 3) fail("JOIN_CLOSURE_INVALID");
  const parentProjectionSha256 = digest("dsa-seats:md-primary-joint-parent-projection:v1\0", parentProjection(records));
  const allRecordIds = records.map((row) => row.reviewRecordId);
  const identityRecordIds = records.filter((row) => row.identity.candidate).map((row) => row.reviewRecordId);
  const common = {
    defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication" as const,
    confidence: "high" as const,
    blocksAffectedPublication: true as const,
    blocksOtherWork: false as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
  };
  const decisions: Decision[] = [
    {
      ...common,
      decisionId: "md-primary:retain-state-board-result-authority-certification-exclusion-v1",
      affectedComponent: "State Board result authority with certification exclusion",
      parentDecisionId: "collect-official-state-primary-results-and-certification-v1",
      question: "Should the fourteen retained Maryland State Board official-result candidates be accepted as source authority while retaining that no separate signed, sealed, or otherwise independently identified final-certification artifact is bound to either result set?",
      recommendedDecision: "Accept the State Board result extracts as scoped source authority, retain not_independently_retained certification status, and prohibit certification-based evaluator or publication use until separately retained final certification is reviewed.",
      alternatives: ["Require separately retained final-certification evidence before accepting any result authority.", "Reject the State Board extracts as source authority and keep all 14 records excluded."],
      consequences: ["Acceptance preserves source authority only and explicitly does not resolve certification, identity, geography, disposition, classification, scoring, or publication.", "Deferral or rejection keeps affected records excluded while the retained State Board evidence remains inspectable."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Official State Board result extracts are hash-bound in the parent receipt; separate final certification remains not independently retained.",
    },
    {
      ...common,
      decisionId: "md-primary:accept-geography-compatibility-v1",
      affectedComponent: "historical geography",
      parentDecisionId: "approve-historical-district-cd119-compatibility-v1",
      question: "Should the seven CD118-to-CD119 continuity rows and seven exact CD119 session/key rows be accepted as geography-compatible candidates?",
      recommendedDecision: "Accept all 14 geography candidates without claiming raw geometry equality, overlap, or population equivalence.",
      alternatives: ["Require a block-level crosswalk before accepting the seven 2022 continuity rows.", "Reject all 14 geography candidates and retain historical-geography exclusion."],
      consequences: ["Acceptance resolves geography only and leaves the three 2022 predecessor identity no-matches unchanged.", "A crosswalk requirement or rejection keeps affected records excluded without discarding the retained Census authorities."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Official CD118/CD119 inventories, Census plan-change authority, parent row hashes, and exact contest joins are retained and validated.",
    },
    {
      ...common,
      decisionId: "md-primary:accept-identity-links-v1",
      affectedComponent: "current-incumbent identity",
      parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      question: "Should the six exact and five finite derived observations be accepted as historical source-candidate relationships to current Maryland incumbents?",
      recommendedDecision: "Accept the 11 proposed links while preserving 2022 MD-02, MD-03, and MD-06 as explicit predecessor no-matches.",
      alternatives: ["Reject all 11 proposed relationships and retain identity exclusion.", "Request external identity evidence for the five derived-name rows before resolving any identity row."],
      consequences: ["Acceptance resolves identity only and does not approve geography, certification, disposition, scoring, or publication.", "Deferral keeps the three predecessor rows unlinked under every option."],
      evidenceRecordIds: identityRecordIds,
      workCompletedWhileWaiting: "Exact and derived name evidence, BioGuide identities, parent hashes, and the predecessor no-match are retained and validated.",
    },
    {
      ...common,
      decisionId: "md-primary:retain-primary-disposition-exclusion-v1",
      affectedComponent: "primary contest disposition and selection",
      parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1",
      question: "Should the 14 source-marked winners remain reported source facts without creating evaluator selection, nominee approval, progressive classification, or a numeric primary factor?",
      recommendedDecision: "Retain every source winner marker as reported while preserving evaluator and disposition exclusion until a versioned rule is approved.",
      alternatives: ["Treat every source winner marker as automatic evaluator selection.", "Require separate nomination evidence before retaining any disposition beyond raw results."],
      consequences: ["The recommendation preserves factual winner markers without turning them into approval or score inputs.", "Any alternative requires a new versioned artifact and cannot be authorized by this join."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All 14 contest candidate totals reconcile in the parent receipt; source winner markers remain nonauthorizing facts.",
    },
    {
      ...common,
      decisionId: "md-primary:retain-progressive-classification-exclusion-v1",
      affectedComponent: "progressive candidate classification",
      parentDecisionId: "approve-progressive-candidate-classification-method-v1",
      question: "Should progressive-primary factors remain excluded because these packages contain no reviewed contest-effective progressive classifications?",
      recommendedDecision: "Retain the exclusion; no progressive classification evidence is present in the identity or geography parents.",
      alternatives: ["Treat all non-incumbent candidates as progressive by default.", "Infer progressive status from candidate names or contest position."],
      consequences: ["The recommendation prevents unsupported ideological values from entering scoring.", "Either alternative would fabricate a classification unsupported by these sources."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Identity, geography, certification, and disposition evidence are isolated so classification work can proceed independently.",
    },
  ];
  decisions.sort((left, right) => bytewise(left.decisionId, right.decisionId));
  const unsigned = {
    schema: MARYLAND_PRIMARY_JOINT_REVIEW_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T08:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_independent_certification_identity_geography_disposition_and_classification_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: {
      proposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      identity: { sourceLockId: required[1][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      geography: { sourceLockId: required[2][0], fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage, rowSetSha256: INPUTS.geographySet },
    },
    methodology: {
      scope: "exact_fourteen_maryland_identity_observations_joined_one_to_one_with_geography_rows",
      identityAndGeographyReviewedIndependently: true,
      certificationReviewedIndependently: true,
      dispositionAndClassificationReviewedIndependently: true,
      jointPackageApprovesParents: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
      parentProjectionSha256,
    },
    summary: {
      reviewRecords: 14 as const,
      identityAndGeographyCandidates: 11 as const,
      geographyCandidateIdentityUnresolved: 3 as const,
      identityCandidates: 11 as const,
      geographyCandidates: 14 as const,
      stateBoardOfficialResultCandidateRecords: 14 as const,
      reportedContestRecords: 14 as const,
      proposedDecisions: 5 as const,
      jointApprovedRecords: 0 as const,
      scoreEligibleRecords: 0 as const,
    },
    records,
    reviewRecordSetSha256: digest("dsa-seats:md-primary-joint-review-row-set:v1\0", records),
    decisions,
    decisionSetSha256: digest("dsa-seats:md-primary-joint-decision-set:v1\0", decisions),
    inheritedDecisionResolutions: { certification: null, identity: null, geography: null, disposition: null, progressiveClassification: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:md-primary-joint-review-package:v1\0", unsigned) };
}

export function validateMarylandPrimaryJointReviewPackage(
  value: MarylandPrimaryJointReviewPackage,
): MarylandPrimaryJointReviewPackage {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "records", "reviewRecordSetSha256", "decisions", "decisionSetSha256", "inheritedDecisionResolutions", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  const nullResolutions = { certification: null, identity: null, geography: null, disposition: null, progressiveClassification: null };
  if (value.schema !== MARYLAND_PRIMARY_JOINT_REVIEW_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T08:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.records.length !== 14 ||
    value.decisions.length !== 5 || canonicalJson(value.inheritedDecisionResolutions) !== canonicalJson(nullResolutions)) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => TARGET_DISTRICTS.map((district) => `md-primary-joint:${cycle}:${district}`)).sort(bytewise);
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["reviewRecordId", "identityObservationId", "geographyObservationId", "contestId", "contestSha256", "cycleYear", "electionDate", "seatCycleId", "districtCode", "identity", "geography", "reviewCategory", "resultDispositionPreserved", "dispositionDecisionStatus", "resultAuthorityStatus", "certificationStatus", "sourceWinnerStatus", "progressiveClassificationStatus", "jointApproved", "evaluatorUse", "scoreEligible", "reviewerAction", "rationaleCodes", "reviewRecordSha256"], "RECORD_FIELDS_INVALID");
    const { reviewRecordSha256, ...unsigned } = record;
    const identityCandidate = !["md-primary-joint:2022:02", "md-primary-joint:2022:03", "md-primary-joint:2022:06"].includes(record.reviewRecordId);
    if (reviewRecordSha256 !== digest("dsa-seats:md-primary-joint-review-row:v1\0", unsigned) ||
      record.reviewRecordId !== `md-primary-joint:${record.cycleYear}:${record.districtCode}` ||
      record.identityObservationId !== `md:identity:${record.cycleYear}:${record.districtCode}` ||
      record.geographyObservationId !== `md:geography:${record.cycleYear}:${record.districtCode}` ||
      record.seatCycleId !== `seat_house_md_${record.districtCode}_current` || record.identity.candidate !== identityCandidate ||
      record.identity.status !== (identityCandidate ? "candidate" : "unresolved") ||
      record.identity.identityStatus !== (identityCandidate ? "proposed_identity_link" : "reported_contest_no_unique_candidate_match") ||
      record.identity.sourceCandidateName === null !== !identityCandidate || record.identity.approved || !record.geography.candidate ||
      record.geography.approved || record.reviewCategory !== (identityCandidate ? "identity_and_geography_candidates" : "geography_candidate_identity_unresolved") ||
      !record.resultDispositionPreserved || record.dispositionDecisionStatus !== "unresolved" ||
      record.resultAuthorityStatus !== "state_board_official_result_candidate" || record.certificationStatus !== "not_independently_retained" || record.sourceWinnerStatus !== "marked_by_source" ||
      record.progressiveClassificationStatus !== "not_retained" || record.jointApproved || record.scoreEligible ||
      (index > 0 && bytewise(value.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0)) fail("RECORD_INVALID");
  }
  const expectedSummary = { reviewRecords: 14, identityAndGeographyCandidates: 11, geographyCandidateIdentityUnresolved: 3,
    identityCandidates: 11, geographyCandidates: 14, stateBoardOfficialResultCandidateRecords: 14, reportedContestRecords: 14,
    proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 };
  if (canonicalJson(value.records.map((row) => row.reviewRecordId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  const expectedDecisions: ReadonlyArray<readonly [DecisionId, ParentDecisionId, number]> = [
    ["md-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1", 14],
    ["md-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1", 11],
    ["md-primary:retain-primary-disposition-exclusion-v1", "decide-nonstandard-primary-disposition-treatment-v1", 14],
    ["md-primary:retain-progressive-classification-exclusion-v1", "approve-progressive-candidate-classification-method-v1", 14],
    ["md-primary:retain-state-board-result-authority-certification-exclusion-v1", "collect-official-state-primary-results-and-certification-v1", 14],
  ];
  for (const [index, decision] of value.decisions.entries()) {
    exactKeys(decision, ["decisionId", "affectedComponent", "parentDecisionId", "question", "recommendedDecision", "defaultReversibleAssumption", "alternatives", "consequences", "confidence", "evidenceRecordIds", "blocksAffectedPublication", "blocksOtherWork", "workCompletedWhileWaiting", "review"], "DECISION_FIELDS_INVALID");
    const expected = expectedDecisions[index];
    if (!expected || decision.decisionId !== expected[0] || decision.parentDecisionId !== expected[1] ||
      decision.evidenceRecordIds.length !== expected[2] || new Set(decision.evidenceRecordIds).size !== expected[2] ||
      decision.evidenceRecordIds.some((id) => !value.records.some((record) => record.reviewRecordId === id)) ||
      decision.defaultReversibleAssumption !== "exclude_affected_records_from_evaluator_and_publication" ||
      decision.confidence !== "high" || !decision.blocksAffectedPublication || decision.blocksOtherWork ||
      decision.alternatives.length !== 2 || decision.consequences.length !== 2 || decision.review.status !== "proposed" ||
      decision.review.reviewer !== null || decision.review.reviewedAt !== null || decision.review.resolution !== null) fail("DECISION_INVALID");
  }
  const { packageSha256, ...unsigned } = value;
  if (digest("dsa-seats:md-primary-joint-parent-projection:v1\0", parentProjection(value.records)) !== MARYLAND_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 ||
    value.reviewRecordSetSha256 !== digest("dsa-seats:md-primary-joint-review-row-set:v1\0", value.records) ||
    value.reviewRecordSetSha256 !== MARYLAND_PRIMARY_JOINT_RECORD_SET_SHA256 ||
    value.decisionSetSha256 !== digest("dsa-seats:md-primary-joint-decision-set:v1\0", value.decisions) ||
    value.decisionSetSha256 !== MARYLAND_PRIMARY_JOINT_DECISION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:md-primary-joint-review-package:v1\0", unsigned) ||
    packageSha256 !== MARYLAND_PRIMARY_JOINT_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}

export const MARYLAND_PRIMARY_JOINT_OUTPUT_PARENTS = OUTPUT_PARENTS;
