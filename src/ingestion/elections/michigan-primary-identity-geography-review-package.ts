import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMichiganPrimaryIdentityCandidate,
  type MichiganPrimaryIdentityCandidate,
} from "./michigan-current-incumbent-primary-linkage-candidate";
import {
  validateMichiganPrimaryGeographyCandidate,
  type MichiganPrimaryGeographyCandidate,
} from "./michigan-primary-geography-compatibility-candidate";

export const MICHIGAN_PRIMARY_JOINT_REVIEW_V1 =
  "michigan-primary-identity-geography-review-package-v1" as const;
export const MICHIGAN_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 =
  "c9c02b08903fd4a816ac48b4d04d100b05761a2110f4c0c88d39bf2abd3d3983" as const;
export const MICHIGAN_PRIMARY_JOINT_RECORD_SET_SHA256 =
  "6e18a5b656135b28299a2a4bd7df1a0cb9d733d37363679226716a9863f35049" as const;
export const MICHIGAN_PRIMARY_JOINT_DECISION_SET_SHA256 =
  "b81b80b2eb08d377f264e9517ae3a6210c1ede459132352e5b86cf95d605f8da" as const;
export const MICHIGAN_PRIMARY_JOINT_PACKAGE_SHA256 =
  "ee997a9bee85c4c7120403ec7b94bc510cbb63ae9bc824057a465ab96ff1c1a4" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "f8b790c4e37bf108e55d6c2970197801b17e6edf0b6a5656e5d1ed2ff98bd3b5",
  identityPackage: "caac838d7b33050ff2924d0aed3a9624aea0c429671536bbb40fd6b0a8463e58",
  identitySet: "67128677a206a56479be0e3d58f1863ac9b9e9c99442fe0605ac6cd3394b9dcc",
  geographyFile: "fc446b4ae756064ec52b2541ea9fd2b6338b975dcc116c47c62a11a657fc6889",
  geographyPackage: "03df08a285b893bc8e6f616f05cb446d02739485e671cf05dfe8873495f9d495",
  geographySet: "2a13fcc368fe0a87d13ef69a4d83895d05c23d0d5c26b02cc9e224d027915286",
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
  "michigan-house-democratic-primary-results-2022-2026-v1",
] as const;
const GEOGRAPHY_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "michigan-house-democratic-primary-results-2022-2026-v1",
  "michigan-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-26",
  "tiger-cd119-26",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "michigan-current-incumbent-primary-linkage-candidate-v1",
  "michigan-primary-geography-compatibility-candidate-v1",
] as const;
const OUTPUT_FILE_SHA256 = "95b2acf40d2464a3ad7449ccca5224785f7c4fd3edea21e4f6c70537cc4018f7" as const;
const OUTPUT_BYTE_SIZE = 43_193 as const;
const TARGET_DISTRICTS = ["03", "06", "08", "11", "12", "13"] as const;
const CYCLES = [2022, 2024] as const;

type ReviewRecord = Readonly<{
  reviewRecordId: string;
  identityObservationId: string;
  geographyObservationId: string;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-08-02" | "2024-08-06";
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
  certificationStatus: "state_board_event_certification_retained";
  sourceWinnerStatus: "not_marked_by_source";
  progressiveClassificationStatus: "not_retained";
  jointApproved: false;
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false;
  reviewerAction: "review_identity_and_geography_independently" | "review_geography_while_preserving_identity_no_match";
  rationaleCodes: readonly string[];
  reviewRecordSha256: string;
}>;

type DecisionId =
  | "mi-primary:accept-certification-authority-v1"
  | "mi-primary:accept-geography-compatibility-v1"
  | "mi-primary:accept-identity-links-v1"
  | "mi-primary:retain-primary-disposition-exclusion-v1"
  | "mi-primary:retain-progressive-classification-exclusion-v1";
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

export type MichiganPrimaryJointReviewPackage = Readonly<{
  schema: typeof MICHIGAN_PRIMARY_JOINT_REVIEW_V1;
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
    reviewRecords: 12;
    identityAndGeographyCandidates: 11;
    geographyCandidateIdentityUnresolved: 1;
    identityCandidates: 11;
    geographyCandidates: 12;
    stateBoardCertifiedRecords: 12;
    reportedContestRecords: 12;
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

export type MichiganPrimaryJointReviewInput = Readonly<{
  proposalJson: string;
  identityJson: string;
  geographyJson: string;
  sourceLockJson: string;
}>;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`Michigan primary joint review rejected: ${code}`); };
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

export function buildMichiganPrimaryJointReviewPackage(
  input: MichiganPrimaryJointReviewInput,
): MichiganPrimaryJointReviewPackage {
  if (sha256(input.proposalJson) !== INPUTS.proposalFile || sha256(input.identityJson) !== INPUTS.identityFile ||
    sha256(input.geographyJson) !== INPUTS.geographyFile) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const identity = validateMichiganPrimaryIdentityCandidate(
    parse<MichiganPrimaryIdentityCandidate>(input.identityJson, "IDENTITY_JSON_INVALID"));
  const geography = validateMichiganPrimaryGeographyCandidate(
    parse<MichiganPrimaryGeographyCandidate>(input.geographyJson, "GEOGRAPHY_JSON_INVALID"));
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
    ["michigan-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/michigan-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["michigan-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/michigan-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
  ] as const;
  if (!Array.isArray(sourceLock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const entries = sourceLock.entries as NonNullable<typeof sourceLock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = entries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = entries.filter((entry) => entry.id === MICHIGAN_PRIMARY_JOINT_REVIEW_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/michigan-primary-identity-geography-review-package-v1.json" ||
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
      reviewRecordId: `mi-primary-joint:${identityRow.cycleYear}:${identityRow.districtCode}`,
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
      certificationStatus: "state_board_event_certification_retained" as const,
      sourceWinnerStatus: "not_marked_by_source" as const,
      progressiveClassificationStatus: "not_retained" as const,
      jointApproved: false as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
      scoreEligible: false as const,
      reviewerAction: identityCandidate
        ? "review_identity_and_geography_independently" as const
        : "review_geography_while_preserving_identity_no_match" as const,
      rationaleCodes: [reviewCategory, "parent_candidates_not_approved_by_join", "state_board_certification_retained_but_not_approved_by_join", "source_winner_unmarked", "all_independent_review_gates_remain_open"],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:mi-primary-joint-review-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.reviewRecordId, right.reviewRecordId));
  if (records.length !== 12 || geographyByIdentity.size !== 12 ||
    records.filter((row) => row.reviewCategory === "identity_and_geography_candidates").length !== 11 ||
    records.filter((row) => row.reviewCategory === "geography_candidate_identity_unresolved").length !== 1) fail("JOIN_CLOSURE_INVALID");
  const parentProjectionSha256 = digest("dsa-seats:mi-primary-joint-parent-projection:v1\0", parentProjection(records));
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
      decisionId: "mi-primary:accept-certification-authority-v1",
      affectedComponent: "state-board event certification",
      parentDecisionId: "collect-official-state-primary-results-and-certification-v1",
      question: "Should the retained Michigan Board of State Canvassers evidence be accepted as exact event-certification authority for these 12 official contest records?",
      recommendedDecision: "Accept the retained 2022 and 2024 state-board event-certification authority while preserving the source's unmarked-winner boundary.",
      alternatives: ["Require an individual contest certificate for every district-cycle before accepting certification authority.", "Reject the retained event-level certification evidence and keep all 12 records certification-excluded."],
      consequences: ["Acceptance resolves certification authority only; it does not approve identity, geography, disposition, classification, scoring, or publication.", "Deferral or rejection keeps affected records excluded while the retained official evidence remains inspectable."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Official 83-of-83-county result pages and state-board certification instruments are hash-bound in the parent receipt.",
    },
    {
      ...common,
      decisionId: "mi-primary:accept-geography-compatibility-v1",
      affectedComponent: "historical geography",
      parentDecisionId: "approve-historical-district-cd119-compatibility-v1",
      question: "Should the six CD118-to-CD119 continuity rows and six exact CD119 session/key rows be accepted as geography-compatible candidates?",
      recommendedDecision: "Accept all 12 geography candidates without claiming raw geometry equality, overlap, or population equivalence.",
      alternatives: ["Require a block-level crosswalk before accepting the six 2022 continuity rows.", "Reject all 12 geography candidates and retain historical-geography exclusion."],
      consequences: ["Acceptance resolves geography only and leaves the MI-08 identity no-match unchanged.", "A crosswalk requirement or rejection keeps affected records excluded without discarding the retained Census authorities."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Official CD118/CD119 inventories, Census plan-change authority, parent row hashes, and exact contest joins are retained and validated.",
    },
    {
      ...common,
      decisionId: "mi-primary:accept-identity-links-v1",
      affectedComponent: "current-incumbent identity",
      parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      question: "Should the 11 exact or middle-initial-omission observations be accepted as historical source-candidate relationships to current Michigan incumbents?",
      recommendedDecision: "Accept the 11 proposed links while preserving MI-08 in 2022 as an explicit predecessor no-match.",
      alternatives: ["Reject all 11 proposed relationships and retain identity exclusion.", "Request external identity evidence for the four derived-name rows before resolving any identity row."],
      consequences: ["Acceptance resolves identity only and does not approve geography, certification, disposition, scoring, or publication.", "Deferral keeps affected records excluded while MI-08 remains unlinked under every option."],
      evidenceRecordIds: identityRecordIds,
      workCompletedWhileWaiting: "Exact and derived name evidence, BioGuide identities, parent hashes, and the predecessor no-match are retained and validated.",
    },
    {
      ...common,
      decisionId: "mi-primary:retain-primary-disposition-exclusion-v1",
      affectedComponent: "primary contest disposition and selection",
      parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1",
      question: "Should the 12 source-winner-unmarked results remain reported contests without inferring a winner, nominee, uncontested status, or numeric primary factor?",
      recommendedDecision: "Retain reported-contest treatment and evaluator exclusion until a versioned selection and disposition rule is approved.",
      alternatives: ["Infer winners from vote rank and select the apparent top candidate.", "Require separate ballot-access and nomination evidence before retaining any disposition beyond raw results."],
      consequences: ["The recommendation preserves factual results without turning absent winner markers into inferred outcomes.", "Any alternative requires a new versioned artifact and cannot be authorized by this join."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All candidate votes and aggregate write-in channels reconcile in the parent receipt; source winner markers remain null.",
    },
    {
      ...common,
      decisionId: "mi-primary:retain-progressive-classification-exclusion-v1",
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
    schema: MICHIGAN_PRIMARY_JOINT_REVIEW_V1,
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
      scope: "exact_twelve_michigan_identity_observations_joined_one_to_one_with_geography_rows",
      identityAndGeographyReviewedIndependently: true,
      certificationReviewedIndependently: true,
      dispositionAndClassificationReviewedIndependently: true,
      jointPackageApprovesParents: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
      parentProjectionSha256,
    },
    summary: {
      reviewRecords: 12 as const,
      identityAndGeographyCandidates: 11 as const,
      geographyCandidateIdentityUnresolved: 1 as const,
      identityCandidates: 11 as const,
      geographyCandidates: 12 as const,
      stateBoardCertifiedRecords: 12 as const,
      reportedContestRecords: 12 as const,
      proposedDecisions: 5 as const,
      jointApprovedRecords: 0 as const,
      scoreEligibleRecords: 0 as const,
    },
    records,
    reviewRecordSetSha256: digest("dsa-seats:mi-primary-joint-review-row-set:v1\0", records),
    decisions,
    decisionSetSha256: digest("dsa-seats:mi-primary-joint-decision-set:v1\0", decisions),
    inheritedDecisionResolutions: { certification: null, identity: null, geography: null, disposition: null, progressiveClassification: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:mi-primary-joint-review-package:v1\0", unsigned) };
}

export function validateMichiganPrimaryJointReviewPackage(
  value: MichiganPrimaryJointReviewPackage,
): MichiganPrimaryJointReviewPackage {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "records", "reviewRecordSetSha256", "decisions", "decisionSetSha256", "inheritedDecisionResolutions", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  const nullResolutions = { certification: null, identity: null, geography: null, disposition: null, progressiveClassification: null };
  if (value.schema !== MICHIGAN_PRIMARY_JOINT_REVIEW_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T08:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.records.length !== 12 ||
    value.decisions.length !== 5 || canonicalJson(value.inheritedDecisionResolutions) !== canonicalJson(nullResolutions)) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => TARGET_DISTRICTS.map((district) => `mi-primary-joint:${cycle}:${district}`)).sort(bytewise);
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["reviewRecordId", "identityObservationId", "geographyObservationId", "contestId", "contestSha256", "cycleYear", "electionDate", "seatCycleId", "districtCode", "identity", "geography", "reviewCategory", "resultDispositionPreserved", "dispositionDecisionStatus", "certificationStatus", "sourceWinnerStatus", "progressiveClassificationStatus", "jointApproved", "evaluatorUse", "scoreEligible", "reviewerAction", "rationaleCodes", "reviewRecordSha256"], "RECORD_FIELDS_INVALID");
    const { reviewRecordSha256, ...unsigned } = record;
    const identityCandidate = record.reviewRecordId !== "mi-primary-joint:2022:08";
    if (reviewRecordSha256 !== digest("dsa-seats:mi-primary-joint-review-row:v1\0", unsigned) ||
      record.reviewRecordId !== `mi-primary-joint:${record.cycleYear}:${record.districtCode}` ||
      record.identityObservationId !== `mi:identity:${record.cycleYear}:${record.districtCode}` ||
      record.geographyObservationId !== `mi:geography:${record.cycleYear}:${record.districtCode}` ||
      record.seatCycleId !== `seat_house_mi_${record.districtCode}_current` || record.identity.candidate !== identityCandidate ||
      record.identity.status !== (identityCandidate ? "candidate" : "unresolved") ||
      record.identity.identityStatus !== (identityCandidate ? "proposed_identity_link" : "reported_contest_no_unique_candidate_match") ||
      record.identity.sourceCandidateName === null !== !identityCandidate || record.identity.approved || !record.geography.candidate ||
      record.geography.approved || record.reviewCategory !== (identityCandidate ? "identity_and_geography_candidates" : "geography_candidate_identity_unresolved") ||
      !record.resultDispositionPreserved || record.dispositionDecisionStatus !== "unresolved" ||
      record.certificationStatus !== "state_board_event_certification_retained" || record.sourceWinnerStatus !== "not_marked_by_source" ||
      record.progressiveClassificationStatus !== "not_retained" || record.jointApproved || record.scoreEligible ||
      (index > 0 && bytewise(value.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0)) fail("RECORD_INVALID");
  }
  const expectedSummary = { reviewRecords: 12, identityAndGeographyCandidates: 11, geographyCandidateIdentityUnresolved: 1,
    identityCandidates: 11, geographyCandidates: 12, stateBoardCertifiedRecords: 12, reportedContestRecords: 12,
    proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 };
  if (canonicalJson(value.records.map((row) => row.reviewRecordId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  const expectedDecisions: ReadonlyArray<readonly [DecisionId, ParentDecisionId, number]> = [
    ["mi-primary:accept-certification-authority-v1", "collect-official-state-primary-results-and-certification-v1", 12],
    ["mi-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1", 12],
    ["mi-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1", 11],
    ["mi-primary:retain-primary-disposition-exclusion-v1", "decide-nonstandard-primary-disposition-treatment-v1", 12],
    ["mi-primary:retain-progressive-classification-exclusion-v1", "approve-progressive-candidate-classification-method-v1", 12],
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
  if (digest("dsa-seats:mi-primary-joint-parent-projection:v1\0", parentProjection(value.records)) !== MICHIGAN_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 ||
    value.reviewRecordSetSha256 !== digest("dsa-seats:mi-primary-joint-review-row-set:v1\0", value.records) || value.reviewRecordSetSha256 !== MICHIGAN_PRIMARY_JOINT_RECORD_SET_SHA256 ||
    value.decisionSetSha256 !== digest("dsa-seats:mi-primary-joint-decision-set:v1\0", value.decisions) || value.decisionSetSha256 !== MICHIGAN_PRIMARY_JOINT_DECISION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:mi-primary-joint-review-package:v1\0", unsigned) || packageSha256 !== MICHIGAN_PRIMARY_JOINT_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}

export const MICHIGAN_PRIMARY_JOINT_OUTPUT_PARENTS = OUTPUT_PARENTS;
