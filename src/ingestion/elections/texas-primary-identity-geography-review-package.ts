import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateTexasCurrentIncumbentPrimaryEventIdentityCandidate,
  type TexasCurrentIncumbentPrimaryEventIdentityCandidate,
} from "./texas-current-incumbent-primary-event-identity-candidate";
import {
  validateTexasPrimaryGeographyCandidate,
  type TexasPrimaryGeographyCandidate,
} from "./texas-primary-geography-compatibility-candidate";

export const TEXAS_PRIMARY_JOINT_REVIEW_V1 =
  "texas-primary-identity-geography-review-package-v1" as const;
export const TEXAS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 =
  "9365dcdf715e99f11909d1d5ea610a9df5fbab0ca2cc468a096d3c908cd4eb7c" as const;
export const TEXAS_PRIMARY_JOINT_RECORD_SET_SHA256 =
  "3c02caebccbb9f88abb906c5901137e393180c986d7170d4464b31d4dbff5a9a" as const;
export const TEXAS_PRIMARY_JOINT_DECISION_SET_SHA256 =
  "2dbae651f20a1c9e3cdb5cdfa635fbf7c06f254b926c40b007df6667114be602" as const;
export const TEXAS_PRIMARY_JOINT_PACKAGE_SHA256 =
  "d964089acf669dc2b95c3dfab19cd93f719619fecc3ac9dce411b3a90749be8b" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "f91d18b3163a610ee60d65519b3ece2e6b627c9a71ca32abd297abb26e256a95",
  identityPackage: "3c9b24b36e1544088a9b85a2ae20d9c972f8fdacd18f15311fe13a4fbc968f2f",
  identitySet: "275727a0e383aebb71e15ee14791e331645d63ebe5d34d230a22d29fc6e51f86",
  identityProjection: "aa907b1c0a796c4605f9136c32b0837933ec4300f612aae44f110b588a827548",
  geographyFile: "66ee61783980ebca966a6d9c70abba9cc2d2616ae91129870d3d398a90026ed8",
  geographyPackage: "cc4aad571b826b10176846e7571bf598eebc245f8f88ef02626c5d50d0fd9335",
  geographySet: "d8b06725f87143c95e7ce24debcca3d51353f51097c06b61283cd75a54d445c4",
  geographyProjection: "68fef20bd2b16f688f1d5bc0203992ddf07ece12b7ad9a24572ca59e8863f7d3",
} as const;
const INHERITED_UNRESOLVED_GATES = [
  "retain_and_reconcile_exact_scope_final_certification_authority",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "decide_nonstandard_primary_disposition_treatment",
  "review_progressive_candidate_classification",
  "complete_human_data_review_and_publication_approval",
] as const;
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
  "texas-house-democratic-primary-results-2022-2026-v1",
] as const;
const GEOGRAPHY_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "texas-house-democratic-primary-results-2022-2026-v1",
  "texas-current-incumbent-primary-event-identity-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-48",
  "tiger-cd119-48",
] as const;

type ReviewCategory =
  | "identity_and_geography_candidates"
  | "geography_candidate_identity_unresolved"
  | "identity_candidate_cd120_geography_pending"
  | "identity_unresolved_cd120_geography_pending";

type ReviewRecord = Readonly<{
  reviewRecordId: string;
  identityObservationId: string;
  geographyObservationId: string;
  eventId: string;
  cycleYear: 2022 | 2024 | 2026;
  electionStage: "regular" | "runoff";
  electionDate: string;
  seatCycleId: string;
  districtCode: string;
  sourceObservationStatus:
    | "reported_contest"
    | "not_observed_in_retained_official_canvass_report_disposition_unresolved";
  sourceContestId: string | null;
  sourceContestSha256: string | null;
  identity: Readonly<{
    parentRowSha256: string;
    status: "candidate" | "unresolved";
    identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match" | "unobserved_district_event";
    bioguideId: string;
    officialHouseName: string;
    sourceCandidateName: string | null;
    evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
    confidence: "high" | null;
    relationshipDisposition: string;
    candidate: boolean;
    approved: false;
  }>;
  geography: Readonly<{
    parentRowSha256: string;
    status: "candidate" | "authority_pending";
    targetCd119Geoid: string;
    historicalCongressSession: "118" | "119" | "120";
    historicalGeoid: string | null;
    evidenceClass: "direct_official_plan_continuity_and_derived_key" | "derived_exact_session_and_key" | "authority_pending";
    confidence: "high" | null;
    compatibilityDisposition: string;
    candidate: boolean;
    approved: false;
  }>;
  reviewCategory: ReviewCategory;
  resultDispositionPreserved: true;
  dispositionDecisionStatus: "unresolved";
  certificationStatus: "official_canvass_report_retained_certification_not_separately_bound";
  progressiveClassificationStatus: "not_retained";
  jointApproved: false;
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false;
  reviewerAction: string;
  rationaleCodes: readonly string[];
  reviewRecordSha256: string;
}>;

type DecisionId =
  | "tx-primary:accept-geography-compatibility-v1"
  | "tx-primary:accept-identity-links-v1"
  | "tx-primary:retain-certification-exclusion-v1"
  | "tx-primary:retain-primary-disposition-exclusion-v1"
  | "tx-primary:retain-progressive-classification-exclusion-v1";
type ParentDecisionId =
  | "collect-official-state-primary-results-and-certification-v1"
  | "approve-historic-primary-candidate-identity-resolution-v1"
  | "approve-historical-district-cd119-compatibility-v1"
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

export type TexasPrimaryIdentityGeographyReviewPackage = Readonly<{
  schema: typeof TEXAS_PRIMARY_JOINT_REVIEW_V1;
  version: 1;
  generatedAt: "2026-08-06T06:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_independent_certification_identity_geography_disposition_classification_and_publication_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    reviewRecords: 78;
    identityAndGeographyCandidates: 25;
    geographyCandidateIdentityUnresolved: 27;
    identityCandidateCd120GeographyPending: 8;
    identityUnresolvedCd120GeographyPending: 18;
    identityCandidates: 33;
    geographyCandidates: 52;
    reportedContestRecords: 44;
    sourceUnobservedEventRecords: 34;
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

export type TexasPrimaryIdentityGeographyReviewInput = Readonly<{
  proposalJson: string;
  identityJson: string;
  geographyJson: string;
  sourceLockJson: string;
}>;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => {
  throw new Error(`Texas primary joint review rejected: ${code}`);
};
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (records: readonly ReviewRecord[]) => records.map((record) => ({
  reviewRecordId: record.reviewRecordId,
  identityObservationId: record.identityObservationId,
  identityParentRowSha256: record.identity.parentRowSha256,
  geographyObservationId: record.geographyObservationId,
  geographyParentRowSha256: record.geography.parentRowSha256,
  eventId: record.eventId,
  cycleYear: record.cycleYear,
  electionStage: record.electionStage,
  electionDate: record.electionDate,
  districtCode: record.districtCode,
  sourceObservationStatus: record.sourceObservationStatus,
  sourceContestId: record.sourceContestId,
  sourceContestSha256: record.sourceContestSha256,
  identityStatus: record.identity.identityStatus,
  identityCandidate: record.identity.candidate,
  geographyDisposition: record.geography.compatibilityDisposition,
  geographyCandidate: record.geography.candidate,
  reviewCategory: record.reviewCategory,
  resultDispositionPreserved: record.resultDispositionPreserved,
  certificationStatus: record.certificationStatus,
  dispositionDecisionStatus: record.dispositionDecisionStatus,
  progressiveClassificationStatus: record.progressiveClassificationStatus,
}));

function makeDecisions(records: readonly ReviewRecord[]): Decision[] {
  const allRecordIds = records.map((record) => record.reviewRecordId);
  const identityRecordIds = records.filter((record) => record.identity.candidate).map((record) => record.reviewRecordId);
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
      decisionId: "tx-primary:accept-geography-compatibility-v1",
      affectedComponent: "historical geography",
      parentDecisionId: "approve-historical-district-cd119-compatibility-v1",
      question: "Should the 52 Texas CD118 continuity and exact CD119 geography candidates be accepted while all 26 CD120 rows remain pending authoritative PlanC2333/CD120 evidence?",
      recommendedDecision: "Accept the 52 retained-evidence candidates without claiming raw geometry equality and retain all 26 CD120 rows as authority pending.",
      alternatives: ["Require block-level crosswalks for the 26 CD118 continuity rows.", "Reject all candidates and retain geography exclusion."],
      consequences: ["Acceptance resolves only the 2022 and 2024 geography candidates; it does not resolve any 2026 row.", "Deferral keeps all 78 records excluded while PlanC2333/CD120 acquisition continues."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All 78 geography rows are joined; 52 candidates and 26 authority-pending rows retain exact parent hashes.",
    },
    {
      ...common,
      decisionId: "tx-primary:accept-identity-links-v1",
      affectedComponent: "current-incumbent identity",
      parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      question: "Should the 33 exact or bounded derived Texas candidate-to-current-incumbent identity links be accepted?",
      recommendedDecision: "Accept the 33 proposed links while preserving the absence of direct person identifiers and leaving all 45 unresolved rows unlinked.",
      alternatives: ["Reject all links and retain identity exclusion.", "Request targeted evidence for the eight derived-name relationships."],
      consequences: ["Acceptance resolves identity only for the 33 proposed rows.", "Deferral leaves all rows excluded without substituting predecessors or cross-district candidates."],
      evidenceRecordIds: identityRecordIds,
      workCompletedWhileWaiting: "Twenty-five exact and eight bounded derived identity candidates are retained with exact parent hashes.",
    },
    {
      ...common,
      decisionId: "tx-primary:retain-certification-exclusion-v1",
      affectedComponent: "exact-scope final certification",
      parentDecisionId: "collect-official-state-primary-results-and-certification-v1",
      question: "Should evaluator and publication exclusion remain while the official canvass reports lack a separately bound exact-scope final certification instrument?",
      recommendedDecision: "Retain the exclusion and acquire exact-scope final authority before promotion.",
      alternatives: ["Treat the retained official canvass reports as sufficient final authority.", "Require contest-specific signed certification before promotion."],
      consequences: ["The recommendation preserves official result observations without overstating certification.", "Either alternative requires a new source-bound authority decision."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Every joined record preserves the separately-unbound certification status.",
    },
    {
      ...common,
      decisionId: "tx-primary:retain-primary-disposition-exclusion-v1",
      affectedComponent: "regular-primary runoff and source-unobserved disposition",
      parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1",
      question: "Should regular and runoff events remain separate and all source-unobserved or no-current-match states remain unresolved until a reviewed disposition rule exists?",
      recommendedDecision: "Retain separate event rows and unresolved dispositions; infer no winner, nominee, advancement, no-contest state, or numeric zero.",
      alternatives: ["Select an event or disposition from vote rank and runoff presence.", "Treat every source-unobserved event as no contest or zero."],
      consequences: ["The recommendation preserves 44 reported and 34 source-unobserved states without false selection.", "Either alternative would create unsupported election facts and requires a new reviewed artifact."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All 78 event records preserve regular/runoff grain, source observation status, and unresolved disposition state.",
    },
    {
      ...common,
      decisionId: "tx-primary:retain-progressive-classification-exclusion-v1",
      affectedComponent: "progressive candidate classification",
      parentDecisionId: "approve-progressive-candidate-classification-method-v1",
      question: "Should evaluator exclusion remain until separate contest-effective progressive classifications are retained?",
      recommendedDecision: "Retain the exclusion; this package contains no progressive classification evidence.",
      alternatives: ["Treat incumbent identity evidence as progressive classification.", "Assign unknown classifications a numeric zero."],
      consequences: ["The recommendation prevents identity or missingness from becoming ideology evidence.", "Either alternative requires a new reviewed methodology and source-bound artifact."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All records explicitly preserve progressiveClassificationStatus not_retained.",
    },
  ];
  return decisions.sort((left, right) => bytewise(left.decisionId, right.decisionId));
}

export function buildTexasPrimaryIdentityGeographyReviewPackage(
  input: TexasPrimaryIdentityGeographyReviewInput,
): TexasPrimaryIdentityGeographyReviewPackage {
  if (
    sha256(input.proposalJson) !== INPUTS.proposalFile || sha256(input.identityJson) !== INPUTS.identityFile ||
    sha256(input.geographyJson) !== INPUTS.geographyFile
  ) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(JSON.parse(input.proposalJson));
  const identity = validateTexasCurrentIncumbentPrimaryEventIdentityCandidate(
    JSON.parse(input.identityJson) as TexasCurrentIncumbentPrimaryEventIdentityCandidate,
  );
  const geography = validateTexasPrimaryGeographyCandidate(
    JSON.parse(input.geographyJson) as TexasPrimaryGeographyCandidate,
  );
  const parentDecisionIds = [
    "collect-official-state-primary-results-and-certification-v1",
    "approve-historic-primary-candidate-identity-resolution-v1",
    "approve-historical-district-cd119-compatibility-v1",
    "decide-nonstandard-primary-disposition-treatment-v1",
    "approve-progressive-candidate-classification-method-v1",
  ];
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet ||
    identity.methodology.parentProjectionSha256 !== INPUTS.identityProjection ||
    geography.packageSha256 !== INPUTS.geographyPackage || geography.rowSetSha256 !== INPUTS.geographySet ||
    geography.methodology.parentProjectionSha256 !== INPUTS.geographyProjection ||
    identity.review.resolution !== null || geography.review.resolution !== null ||
    parentDecisionIds.some((decisionId) => proposal.decisions.find((decision) => decision.decisionId === decisionId)?.resolution !== null) ||
    canonicalJson(identity.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(geography.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("PARENT_INVALID");

  const lock = JSON.parse(input.sourceLockJson) as {
    entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; sha256: string; kind: string; parentIds?: string[] }>;
  };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["texas-current-incumbent-primary-event-identity-candidate-v1", INPUTS.identityFile, "data/metadata/texas-current-incumbent-primary-event-identity-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["texas-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/texas-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
  ] as const;
  if (
    !Array.isArray(lock.entries) || required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = lock.entries!.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== fileSha256 ||
        matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");

  const geographyByIdentityObservation = new Map(geography.rows.map((row) => [row.identityObservationId, row]));
  const records: ReviewRecord[] = identity.observations.map((identityRow) => {
    const geographyRow = geographyByIdentityObservation.get(identityRow.observationId) ?? fail("ROW_JOIN_MISMATCH");
    if (
      geographyRow.eventId !== identityRow.eventId || geographyRow.cycleYear !== identityRow.cycleYear ||
      geographyRow.electionStage !== identityRow.electionStage || geographyRow.electionDate !== identityRow.electionDate ||
      geographyRow.seatCycleId !== identityRow.seatCycleId || geographyRow.districtCode !== identityRow.targetDistrictCode ||
      geographyRow.sourceObservationStatus !== identityRow.sourceObservationStatus ||
      geographyRow.sourceContestId !== identityRow.sourceContestId ||
      geographyRow.sourceContestSha256 !== identityRow.sourceContestSha256 || !geographyRow.resultDispositionPreserved
    ) fail("ROW_JOIN_MISMATCH");
    const identityCandidate = identityRow.identityStatus === "proposed_identity_link";
    const geographyCandidate = geographyRow.compatibilityCandidate;
    const reviewCategory: ReviewCategory = identityCandidate && geographyCandidate
      ? "identity_and_geography_candidates"
      : !identityCandidate && geographyCandidate
        ? "geography_candidate_identity_unresolved"
        : identityCandidate
          ? "identity_candidate_cd120_geography_pending"
          : "identity_unresolved_cd120_geography_pending";
    const unsigned = {
      reviewRecordId: `tx-primary-joint:${identityRow.observationId}`,
      identityObservationId: identityRow.observationId,
      geographyObservationId: geographyRow.observationId,
      eventId: identityRow.eventId,
      cycleYear: identityRow.cycleYear,
      electionStage: identityRow.electionStage,
      electionDate: identityRow.electionDate,
      seatCycleId: identityRow.seatCycleId,
      districtCode: identityRow.targetDistrictCode,
      sourceObservationStatus: identityRow.sourceObservationStatus,
      sourceContestId: identityRow.sourceContestId,
      sourceContestSha256: identityRow.sourceContestSha256,
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
        status: geographyCandidate ? "candidate" as const : "authority_pending" as const,
        targetCd119Geoid: geographyRow.targetCd119Geoid,
        historicalCongressSession: geographyRow.historicalCongressSession,
        historicalGeoid: geographyRow.historicalGeoid,
        evidenceClass: geographyRow.evidenceClass,
        confidence: geographyRow.confidence,
        compatibilityDisposition: geographyRow.compatibilityDisposition,
        candidate: geographyCandidate,
        approved: false as const,
      },
      reviewCategory,
      resultDispositionPreserved: true as const,
      dispositionDecisionStatus: "unresolved" as const,
      certificationStatus: "official_canvass_report_retained_certification_not_separately_bound" as const,
      progressiveClassificationStatus: "not_retained" as const,
      jointApproved: false as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
      scoreEligible: false as const,
      reviewerAction: reviewCategory === "identity_and_geography_candidates"
        ? "review_identity_and_geography_independently"
        : reviewCategory === "geography_candidate_identity_unresolved"
          ? "review_geography_and_retain_identity_unresolved"
          : reviewCategory === "identity_candidate_cd120_geography_pending"
            ? "review_identity_and_retain_cd120_geography_pending"
            : "retain_identity_unresolved_and_cd120_geography_pending",
      rationaleCodes: [reviewCategory, "parent_candidates_not_approved_by_join", "result_disposition_unchanged", "all_independent_review_gates_remain_open"],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:tx-primary-joint-review-record:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.reviewRecordId, right.reviewRecordId));
  const count = (predicate: (record: ReviewRecord) => boolean): number => records.filter(predicate).length;
  if (
    records.length !== 78 || geographyByIdentityObservation.size !== 78 ||
    count((record) => record.reviewCategory === "identity_and_geography_candidates") !== 25 ||
    count((record) => record.reviewCategory === "geography_candidate_identity_unresolved") !== 27 ||
    count((record) => record.reviewCategory === "identity_candidate_cd120_geography_pending") !== 8 ||
    count((record) => record.reviewCategory === "identity_unresolved_cd120_geography_pending") !== 18 ||
    count((record) => record.identity.candidate) !== 33 || count((record) => record.geography.candidate) !== 52 ||
    count((record) => record.sourceObservationStatus === "reported_contest") !== 44
  ) fail("RECORD_CLOSURE_INVALID");
  const parentProjectionSha256 = digest("dsa-seats:tx-primary-joint-parent-projection:v1\0", parentProjection(records));
  if (parentProjectionSha256 !== TEXAS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256) fail("PARENT_FACT_INVALID");
  const decisions = makeDecisions(records);
  const unsigned = {
    schema: TEXAS_PRIMARY_JOINT_REVIEW_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T06:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_independent_certification_identity_geography_disposition_classification_and_publication_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      proposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      identity: { sourceLockId: required[1][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet, parentProjectionSha256: INPUTS.identityProjection },
      geography: { sourceLockId: required[2][0], fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage, rowSetSha256: INPUTS.geographySet, parentProjectionSha256: INPUTS.geographyProjection },
    },
    methodology: {
      scope: "exact_78_texas_current_target_identity_events_joined_one_to_one_to_geography_rows",
      identityAndGeographyReviewedIndependently: true,
      parentCandidatesApprovedByJoin: false,
      regularRunoffCollapseAllowed: false,
      sourceUnobservedDispositionInferenceAllowed: false,
      cd119SubstitutedForCd120: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
      parentProjectionSha256,
    },
    summary: {
      reviewRecords: 78 as const,
      identityAndGeographyCandidates: 25 as const,
      geographyCandidateIdentityUnresolved: 27 as const,
      identityCandidateCd120GeographyPending: 8 as const,
      identityUnresolvedCd120GeographyPending: 18 as const,
      identityCandidates: 33 as const,
      geographyCandidates: 52 as const,
      reportedContestRecords: 44 as const,
      sourceUnobservedEventRecords: 34 as const,
      proposedDecisions: 5 as const,
      jointApprovedRecords: 0 as const,
      scoreEligibleRecords: 0 as const,
    },
    records,
    reviewRecordSetSha256: digest("dsa-seats:tx-primary-joint-review-record-set:v1\0", records),
    decisions,
    decisionSetSha256: digest("dsa-seats:tx-primary-joint-review-decision-set:v1\0", decisions),
    inheritedDecisionResolutions: {
      certification: null,
      identity: null,
      geography: null,
      disposition: null,
      progressiveClassification: null,
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:tx-primary-joint-review-package:v1\0", unsigned) };
}

export function validateTexasPrimaryIdentityGeographyReviewPackage(
  value: TexasPrimaryIdentityGeographyReviewPackage,
): TexasPrimaryIdentityGeographyReviewPackage {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "records", "reviewRecordSetSha256", "decisions", "decisionSetSha256", "inheritedDecisionResolutions", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== TEXAS_PRIMARY_JOINT_REVIEW_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.records.length !== 78 ||
    value.defaultUse !== "exclude_from_evaluator_until_independent_certification_identity_geography_disposition_classification_and_publication_review" ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(value.inheritedDecisionResolutions) !== canonicalJson({ certification: null, identity: null, geography: null, disposition: null, progressiveClassification: null })
  ) fail("LIFECYCLE_INVALID");
  const categories = new Map<ReviewCategory, number>();
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["reviewRecordId", "identityObservationId", "geographyObservationId", "eventId", "cycleYear", "electionStage", "electionDate", "seatCycleId", "districtCode", "sourceObservationStatus", "sourceContestId", "sourceContestSha256", "identity", "geography", "reviewCategory", "resultDispositionPreserved", "dispositionDecisionStatus", "certificationStatus", "progressiveClassificationStatus", "jointApproved", "evaluatorUse", "scoreEligible", "reviewerAction", "rationaleCodes", "reviewRecordSha256"], "RECORD_FIELDS_INVALID");
    exactKeys(record.identity, ["parentRowSha256", "status", "identityStatus", "bioguideId", "officialHouseName", "sourceCandidateName", "evidenceClass", "confidence", "relationshipDisposition", "candidate", "approved"], "IDENTITY_FIELDS_INVALID");
    exactKeys(record.geography, ["parentRowSha256", "status", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "evidenceClass", "confidence", "compatibilityDisposition", "candidate", "approved"], "GEOGRAPHY_FIELDS_INVALID");
    const { reviewRecordSha256, ...unsignedRecord } = record;
    const expectedIdentityCandidate = record.identity.identityStatus === "proposed_identity_link";
    const expectedGeographyCandidate = record.cycleYear !== 2026;
    const expectedIdentityDisposition = record.identity.identityStatus === "proposed_identity_link"
      ? "proposed_identity_link_pending_documented_review"
      : record.identity.identityStatus === "reported_contest_no_unique_candidate_match"
        ? "not_linked_no_unique_current_incumbent_candidate_same_district"
        : "not_linked_no_reported_contest_disposition_unresolved";
    const expectedGeographyDisposition = record.cycleYear === 2022
      ? "official_no_plan_change_declaration_same_geoid_key_candidate"
      : record.cycleYear === 2024
        ? "same_cd119_session_and_geoid_exact_key_candidate"
        : "unassessed_cd120_authority_and_crosswalk_collection_pending";
    const expectedGeographyEvidence = record.cycleYear === 2022
      ? "direct_official_plan_continuity_and_derived_key"
      : record.cycleYear === 2024 ? "derived_exact_session_and_key" : "authority_pending";
    const expectedCategory: ReviewCategory = expectedIdentityCandidate && expectedGeographyCandidate
      ? "identity_and_geography_candidates"
      : !expectedIdentityCandidate && expectedGeographyCandidate
        ? "geography_candidate_identity_unresolved"
        : expectedIdentityCandidate ? "identity_candidate_cd120_geography_pending" : "identity_unresolved_cd120_geography_pending";
    const expectedReviewerAction = expectedCategory === "identity_and_geography_candidates"
      ? "review_identity_and_geography_independently"
      : expectedCategory === "geography_candidate_identity_unresolved"
        ? "review_geography_and_retain_identity_unresolved"
        : expectedCategory === "identity_candidate_cd120_geography_pending"
          ? "review_identity_and_retain_cd120_geography_pending"
          : "retain_identity_unresolved_and_cd120_geography_pending";
    categories.set(record.reviewCategory, (categories.get(record.reviewCategory) ?? 0) + 1);
    if (
      reviewRecordSha256 !== digest("dsa-seats:tx-primary-joint-review-record:v1\0", unsignedRecord) ||
      record.reviewRecordId !== `tx-primary-joint:${record.identityObservationId}` ||
      record.geographyObservationId !== record.identityObservationId.replace("tx:identity:", "tx:geography:") ||
      record.eventId !== `tx:${record.cycleYear}:${record.electionStage}:democratic-primary` ||
      record.seatCycleId !== `seat_house_tx_${record.districtCode}_current` ||
      record.identity.candidate !== expectedIdentityCandidate ||
      record.identity.status !== (expectedIdentityCandidate ? "candidate" : "unresolved") || record.identity.approved ||
      record.identity.relationshipDisposition !== expectedIdentityDisposition ||
      (expectedIdentityCandidate && (record.identity.sourceCandidateName === null || record.identity.evidenceClass === null || record.identity.confidence !== "high")) ||
      (!expectedIdentityCandidate && (record.identity.sourceCandidateName !== null || record.identity.evidenceClass !== null || record.identity.confidence !== null)) ||
      record.geography.candidate !== expectedGeographyCandidate ||
      record.geography.status !== (expectedGeographyCandidate ? "candidate" : "authority_pending") ||
      record.geography.approved || record.geography.historicalCongressSession !== (record.cycleYear === 2022 ? "118" : record.cycleYear === 2024 ? "119" : "120") ||
      record.geography.targetCd119Geoid !== `48${record.districtCode}` ||
      record.geography.historicalGeoid !== (expectedGeographyCandidate ? `48${record.districtCode}` : null) ||
      record.geography.compatibilityDisposition !== expectedGeographyDisposition ||
      record.geography.evidenceClass !== expectedGeographyEvidence ||
      record.geography.confidence !== (expectedGeographyCandidate ? "high" : null) ||
      record.reviewCategory !== expectedCategory || record.jointApproved || record.scoreEligible ||
      !record.resultDispositionPreserved || record.dispositionDecisionStatus !== "unresolved" ||
      record.certificationStatus !== "official_canvass_report_retained_certification_not_separately_bound" ||
      record.progressiveClassificationStatus !== "not_retained" ||
      record.evaluatorUse !== "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" ||
      record.reviewerAction !== expectedReviewerAction ||
      canonicalJson(record.rationaleCodes) !== canonicalJson([expectedCategory, "parent_candidates_not_approved_by_join", "result_disposition_unchanged", "all_independent_review_gates_remain_open"]) ||
      (record.identity.identityStatus === "unobserved_district_event") !== (record.sourceObservationStatus !== "reported_contest") ||
      (record.sourceObservationStatus === "reported_contest" && (record.sourceContestId === null || record.sourceContestSha256 === null)) ||
      (record.sourceObservationStatus !== "reported_contest" && (record.sourceContestId !== null || record.sourceContestSha256 !== null)) ||
      (index > 0 && bytewise(value.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0)
    ) fail("RECORD_INVALID");
  }
  if (
    canonicalJson(value.summary) !== canonicalJson({
      reviewRecords: 78,
      identityAndGeographyCandidates: 25,
      geographyCandidateIdentityUnresolved: 27,
      identityCandidateCd120GeographyPending: 8,
      identityUnresolvedCd120GeographyPending: 18,
      identityCandidates: 33,
      geographyCandidates: 52,
      reportedContestRecords: 44,
      sourceUnobservedEventRecords: 34,
      proposedDecisions: 5,
      jointApprovedRecords: 0,
      scoreEligibleRecords: 0,
    }) || categories.get("identity_and_geography_candidates") !== 25 ||
    categories.get("geography_candidate_identity_unresolved") !== 27 ||
    categories.get("identity_candidate_cd120_geography_pending") !== 8 ||
    categories.get("identity_unresolved_cd120_geography_pending") !== 18
  ) fail("SUMMARY_INVALID");
  const expectedDecisions = makeDecisions(value.records);
  if (canonicalJson(value.decisions) !== canonicalJson(expectedDecisions)) fail("DECISION_INVALID");
  const projection = digest("dsa-seats:tx-primary-joint-parent-projection:v1\0", parentProjection(value.records));
  const { packageSha256, ...unsigned } = value;
  if (
    value.methodology.parentProjectionSha256 !== projection || projection !== TEXAS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 ||
    value.reviewRecordSetSha256 !== digest("dsa-seats:tx-primary-joint-review-record-set:v1\0", value.records) ||
    value.reviewRecordSetSha256 !== TEXAS_PRIMARY_JOINT_RECORD_SET_SHA256 ||
    value.decisionSetSha256 !== digest("dsa-seats:tx-primary-joint-review-decision-set:v1\0", value.decisions) ||
    value.decisionSetSha256 !== TEXAS_PRIMARY_JOINT_DECISION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:tx-primary-joint-review-package:v1\0", unsigned) ||
    packageSha256 !== TEXAS_PRIMARY_JOINT_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
