import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateIllinoisPrimaryIdentityCandidate,
  type IllinoisPrimaryIdentityCandidate,
} from "./illinois-current-incumbent-primary-linkage-candidate";
import {
  validateIllinoisPrimaryGeographyCandidate,
  type IllinoisPrimaryGeographyCandidate,
} from "./illinois-primary-geography-compatibility-candidate";

export const ILLINOIS_PRIMARY_JOINT_REVIEW_V1 =
  "illinois-primary-identity-geography-review-package-v1" as const;
export const ILLINOIS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 =
  "00580f013d9f208951f194c798c1c45825daa5903eef70e6dda366d7f2b6698e" as const;
export const ILLINOIS_PRIMARY_JOINT_RECORD_SET_SHA256 =
  "4df05250803ce13fc85bf8bec43cc341d89e961855a2da09bca2497d3d983a59" as const;
export const ILLINOIS_PRIMARY_JOINT_DECISION_SET_SHA256 =
  "e73a6bf0e4428692cd1571c2e9f8fc33b3c6384797098359a8021e318592ad54" as const;
export const ILLINOIS_PRIMARY_JOINT_PACKAGE_SHA256 =
  "3eccc7f17da59e4a3bb427e339d7af63b0181327b1e80c80226b43ae173a474d" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "d9f46120064cd293cb63876866c5fa261c142f621d3e1c0662d7dd8dfcd27e25",
  identityPackage: "f678f9bd0b65f20bba40c4e9c0620fbcfdcd159fc989597a7dd1cc0e6288980e",
  identitySet: "5d72e4bda79491d4e1a430148fa2ecd5cfd22f83cd5de80e6b7f75439f7fed34",
  geographyFile: "258c70fe0b9a7962dea8865df20e19b5874dd73542fa09bcb37ab2d49887665d",
  geographyPackage: "ff38dcc70c8390f9bdb0a6ec04f05b0e1d187690bcde5c6af5a5a83b3bc73819",
  geographySet: "86cc65b2f8b8158d4c15a091e14723bd6724224c34f5057b5e04ff4e2fe71421",
} as const;

const INHERITED_UNRESOLVED_GATES = [
  "retain_final_state_canvass_or_certification",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "review_progressive_candidate_classification",
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
  "illinois-house-democratic-primary-results-receipt-2022-2024-v1",
] as const;
const GEOGRAPHY_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "illinois-house-democratic-primary-results-receipt-2022-2024-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-17",
  "tiger-cd119-17",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "illinois-current-incumbent-primary-linkage-candidate-v1",
  "illinois-primary-geography-compatibility-candidate-v1",
] as const;
const OUTPUT_FILE_SHA256 = "795843b2b1a7e8a276b0ccfdcbab75f251adc5db4ae227c6a1f56601dc596c37" as const;
const OUTPUT_BYTE_SIZE = 85_008 as const;
const OUTSIDE_TARGET_KEYS = new Set(["2022:12", "2022:15", "2022:16", "2024:12", "2024:15", "2024:16"]);

type ReviewRecord = Readonly<{
  reviewRecordId: string;
  contestId: string;
  contestSha256: string;
  seatCycleId: string;
  districtCode: string;
  cycleYear: 2022 | 2024;
  identity: Readonly<{
    status: "candidate" | "outside_current_target_identity_scope";
    parentObservationId: string | null;
    parentRowSha256: string | null;
    bioguideId: string | null;
    officialHouseName: string | null;
    sourceCandidateName: string | null;
    evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
    relationshipDisposition: "proposed_identity_link_pending_documented_review" | null;
    identityApproved: false;
  }>;
  geography: Readonly<{
    parentObservationId: string;
    parentRowSha256: string;
    targetCd119Geoid: string;
    historicalCongressSession: "118" | "119";
    historicalGeoid: string;
    compatibilityDisposition: string;
    evidenceClass: string;
    compatibilityCandidate: true;
    compatibilityApproved: false;
  }>;
  certificationStatus: "not_retained";
  progressiveClassificationStatus: "not_retained";
  reviewDisposition:
    | "identity_and_geography_candidates_pending_four_gate_review"
    | "geography_candidate_identity_outside_current_target_scope_pending_certification_geography_and_classification_review";
  jointApproved: false;
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  reviewRecordSha256: string;
}>;

type Decision = Readonly<{
  decisionId:
    | "il-primary:accept-geography-compatibility-v1"
    | "il-primary:accept-identity-links-v1"
    | "il-primary:retain-certification-exclusion-v1"
    | "il-primary:retain-progressive-classification-exclusion-v1";
  affectedComponent: string;
  parentDecisionId:
    | "collect-official-state-primary-results-and-certification-v1"
    | "approve-historic-primary-candidate-identity-resolution-v1"
    | "approve-historical-district-cd119-compatibility-v1"
    | "approve-progressive-candidate-classification-method-v1";
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

export type IllinoisPrimaryIdentityGeographyReviewPackage = Readonly<{
  schema: typeof ILLINOIS_PRIMARY_JOINT_REVIEW_V1;
  version: 1;
  generatedAt: "2026-08-06T04:30:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    reviewRecords: 34;
    identityAndGeographyCandidates: 28;
    geographyCandidateIdentityOutsideCurrentTargetScope: 6;
    identityCandidates: 28;
    exactIdentityCandidates: 20;
    derivedIdentityCandidates: 8;
    identityOutsideCurrentTargetScope: 6;
    geographyCandidates: 34;
    proposedDecisions: 4;
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
    progressiveClassification: null;
  }>;
  packageSha256: string;
}>;

export type IllinoisPrimaryIdentityGeographyReviewInput = Readonly<{
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
  throw new Error(`Illinois primary joint review rejected: ${code}`);
};
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parse = <T>(value: string, code: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fail(code);
  }
};
const parentProjection = (records: readonly ReviewRecord[]) => records.map((record) => ({
  reviewRecordId: record.reviewRecordId,
  contestId: record.contestId,
  contestSha256: record.contestSha256,
  seatCycleId: record.seatCycleId,
  districtCode: record.districtCode,
  cycleYear: record.cycleYear,
  identityStatus: record.identity.status,
  identityParentObservationId: record.identity.parentObservationId,
  identityParentRowSha256: record.identity.parentRowSha256,
  geographyParentObservationId: record.geography.parentObservationId,
  geographyParentRowSha256: record.geography.parentRowSha256,
  certificationStatus: record.certificationStatus,
  progressiveClassificationStatus: record.progressiveClassificationStatus,
}));

export function buildIllinoisPrimaryIdentityGeographyReviewPackage(
  input: IllinoisPrimaryIdentityGeographyReviewInput,
): IllinoisPrimaryIdentityGeographyReviewPackage {
  if (
    sha256(input.proposalJson) !== INPUTS.proposalFile || sha256(input.identityJson) !== INPUTS.identityFile ||
    sha256(input.geographyJson) !== INPUTS.geographyFile
  ) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const identity = validateIllinoisPrimaryIdentityCandidate(
    parse<IllinoisPrimaryIdentityCandidate>(input.identityJson, "IDENTITY_JSON_INVALID"),
  );
  const geography = validateIllinoisPrimaryGeographyCandidate(
    parse<IllinoisPrimaryGeographyCandidate>(input.geographyJson, "GEOGRAPHY_JSON_INVALID"),
  );
  const decisionIds = [
    "collect-official-state-primary-results-and-certification-v1",
    "approve-historic-primary-candidate-identity-resolution-v1",
    "approve-historical-district-cd119-compatibility-v1",
    "approve-progressive-candidate-classification-method-v1",
  ];
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || geography.packageSha256 !== INPUTS.geographyPackage ||
    geography.rowSetSha256 !== INPUTS.geographySet || identity.review.resolution !== null ||
    geography.review.resolution !== null ||
    canonicalJson(identity.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(geography.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    decisionIds.some((decisionId) => proposal.decisions.find((decision) => decision.decisionId === decisionId)?.resolution !== null)
  ) fail("PARENT_INVALID");

  const sourceLock = parse<{ entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> }>(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID");
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["illinois-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/illinois-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["illinois-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/illinois-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
  ] as const;
  if (!Array.isArray(sourceLock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const sourceLockEntries = sourceLock.entries as NonNullable<typeof sourceLock.entries>;
  if (
    required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = sourceLockEntries.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== fileSha256 ||
        matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = sourceLockEntries.filter((entry) => entry.id === ILLINOIS_PRIMARY_JOINT_REVIEW_V1);
  if (
    outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
      "data/metadata/illinois-primary-identity-geography-review-package-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 ||
    outputMatches[0]!.kind !== "review_proposal" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS) ||
    outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE
  ) fail("SOURCE_LOCK_MISMATCH");

  const identityByKey = new Map(identity.observations.map((row) => [`${row.cycleYear}:${row.districtCode}`, row]));
  const records: ReviewRecord[] = geography.rows.map((geographyRow) => {
    const key = `${geographyRow.cycleYear}:${geographyRow.districtCode}`;
    const identityRow = identityByKey.get(key);
    if (identityRow && (
      identityRow.contestId !== geographyRow.contestId || identityRow.contestSha256 !== geographyRow.contestSha256 ||
      identityRow.seatCycleId !== geographyRow.seatCycleId
    )) fail("PARENT_JOIN_INVALID");
    if ((identityRow === undefined) !== OUTSIDE_TARGET_KEYS.has(key)) fail("PARENT_JOIN_INVALID");
    const hasIdentity = identityRow !== undefined;
    const unsigned = {
      reviewRecordId: `il-primary-joint:${geographyRow.cycleYear}:${geographyRow.districtCode}`,
      contestId: geographyRow.contestId,
      contestSha256: geographyRow.contestSha256,
      seatCycleId: geographyRow.seatCycleId,
      districtCode: geographyRow.districtCode,
      cycleYear: geographyRow.cycleYear,
      identity: hasIdentity ? {
        status: "candidate" as const,
        parentObservationId: identityRow.observationId,
        parentRowSha256: identityRow.rowSha256,
        bioguideId: identityRow.rosterIdentity.bioguideId,
        officialHouseName: identityRow.rosterIdentity.officialHouseName,
        sourceCandidateName: identityRow.sourceCandidate.sourceCandidateName,
        evidenceClass: identityRow.evidenceClass,
        relationshipDisposition: identityRow.relationshipDisposition,
        identityApproved: false as const,
      } : {
        status: "outside_current_target_identity_scope" as const,
        parentObservationId: null,
        parentRowSha256: null,
        bioguideId: null,
        officialHouseName: null,
        sourceCandidateName: null,
        evidenceClass: null,
        relationshipDisposition: null,
        identityApproved: false as const,
      },
      geography: {
        parentObservationId: geographyRow.observationId,
        parentRowSha256: geographyRow.rowSha256,
        targetCd119Geoid: geographyRow.targetCd119Geoid,
        historicalCongressSession: geographyRow.historicalCongressSession,
        historicalGeoid: geographyRow.historicalGeoid,
        compatibilityDisposition: geographyRow.compatibilityDisposition,
        evidenceClass: geographyRow.evidenceClass,
        compatibilityCandidate: true as const,
        compatibilityApproved: false as const,
      },
      certificationStatus: "not_retained" as const,
      progressiveClassificationStatus: "not_retained" as const,
      reviewDisposition: hasIdentity
        ? "identity_and_geography_candidates_pending_four_gate_review" as const
        : "geography_candidate_identity_outside_current_target_scope_pending_certification_geography_and_classification_review" as const,
      jointApproved: false as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" as const,
      scoreEligible: false as const,
      rationaleCodes: hasIdentity ? [
        "identity_candidate_pending_independent_review",
        "geography_candidate_pending_independent_review",
        "final_certification_not_retained",
        "progressive_classification_not_retained",
        "parent_candidates_not_approved_by_join",
      ] : [
        "identity_outside_current_target_scope",
        "geography_candidate_pending_independent_review",
        "final_certification_not_retained",
        "progressive_classification_not_retained",
        "parent_candidate_not_approved_by_join",
      ],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:il-primary-joint-review-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.reviewRecordId, right.reviewRecordId));
  if (
    records.length !== 34 || identityByKey.size !== 28 ||
    records.filter((record) => record.identity.status !== "candidate").length !== 6 ||
    records.filter((record) => record.identity.evidenceClass === "exact_name_observation").length !== 20 ||
    records.filter((record) => record.identity.evidenceClass === "derived_name_relationship").length !== 8
  ) {
    fail("JOIN_CLOSURE_INVALID");
  }
  const parentProjectionSha256 = digest("dsa-seats:il-primary-joint-parent-projection:v1\0", parentProjection(records));
  if (parentProjectionSha256 !== ILLINOIS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256) fail("PARENT_FACT_INVALID");

  const allRecordIds = records.map((record) => record.reviewRecordId);
  const identityRecordIds = records.filter((record) => record.identity.status === "candidate").map((record) => record.reviewRecordId);
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
      decisionId: "il-primary:accept-geography-compatibility-v1",
      affectedComponent: "historical geography",
      parentDecisionId: "approve-historical-district-cd119-compatibility-v1",
      question: "Should the 34 Illinois geography candidates be accepted under the retained Census authority and exact numbered inventories?",
      recommendedDecision: "Accept the 34 candidates without claiming raw geometry equality.",
      alternatives: ["Require block-level crosswalks for the 17 CD118 continuity rows.", "Reject the candidates and retain geography exclusion."],
      consequences: ["Acceptance resolves only geography evidence.", "Deferral keeps all records excluded while other work continues."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All 34 geography parent rows and their exact hashes are retained and joined.",
    },
    {
      ...common,
      decisionId: "il-primary:accept-identity-links-v1",
      affectedComponent: "current-incumbent identity",
      parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      question: "Should the 28 exact or bounded derived Illinois candidate-to-incumbent identity links be accepted?",
      recommendedDecision: "Accept the 28 links while preserving the absence of a direct person identifier in the state exports.",
      alternatives: ["Reject all links and retain identity exclusion.", "Request targeted evidence for the eight derived-name links."],
      consequences: ["Acceptance resolves identity only for the 28 current-target rows.", "Deferral leaves those records excluded without inventing identities for six out-of-scope rows."],
      evidenceRecordIds: identityRecordIds,
      workCompletedWhileWaiting: "Twenty exact and eight bounded derived identity candidates are retained with parent hashes.",
    },
    {
      ...common,
      decisionId: "il-primary:retain-certification-exclusion-v1",
      affectedComponent: "final state certification",
      parentDecisionId: "collect-official-state-primary-results-and-certification-v1",
      question: "Should evaluator and publication exclusion remain until final statewide canvass or certification is retained?",
      recommendedDecision: "Retain the exclusion and acquire a final authority artifact before promotion.",
      alternatives: ["Accept the current exports as sufficient final authority.", "Require contest-specific signed certification before promotion."],
      consequences: ["The recommendation preserves official result candidates without overstating certification.", "Any alternative requires a new source-bound authority decision."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "Every joined record preserves certificationStatus not_retained.",
    },
    {
      ...common,
      decisionId: "il-primary:retain-progressive-classification-exclusion-v1",
      affectedComponent: "progressive candidate classification",
      parentDecisionId: "approve-progressive-candidate-classification-method-v1",
      question: "Should evaluator exclusion remain until separate contest-effective progressive classifications are retained?",
      recommendedDecision: "Retain the exclusion; this package contains no progressive classification evidence.",
      alternatives: ["Treat incumbent identity evidence as progressive classification.", "Assign unknown classifications a numeric zero."],
      consequences: ["The recommendation prevents identity or missingness from becoming ideology evidence.", "Either alternative would require a new reviewed methodology and artifact."],
      evidenceRecordIds: allRecordIds,
      workCompletedWhileWaiting: "All records explicitly preserve progressiveClassificationStatus not_retained.",
    },
  ];
  decisions.sort((left, right) => bytewise(left.decisionId, right.decisionId));

  const unsigned = {
    schema: ILLINOIS_PRIMARY_JOINT_REVIEW_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T04:30:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      proposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      identity: { sourceLockId: required[1][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      geography: { sourceLockId: required[2][0], fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage, rowSetSha256: INPUTS.geographySet },
    },
    methodology: {
      scope: "all_thirty_four_geography_rows_with_optional_identity_only_for_twenty_eight_current_target_rows",
      parentRowsJoinedOn: ["contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear"],
      outsideCurrentTargetIdentityKeys: [...OUTSIDE_TARGET_KEYS].sort(bytewise),
      decisionsReviewedIndependently: true,
      decisionEvidenceModel: "identity_decision_binds_28_candidate_rows_other_decisions_bind_all_34_records",
      parentProjectionSha256,
      jointPackageApprovesParents: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
    },
    summary: {
      reviewRecords: 34 as const,
      identityAndGeographyCandidates: 28 as const,
      geographyCandidateIdentityOutsideCurrentTargetScope: 6 as const,
      identityCandidates: 28 as const,
      exactIdentityCandidates: records.filter((record) => record.identity.evidenceClass === "exact_name_observation").length as 20,
      derivedIdentityCandidates: records.filter((record) => record.identity.evidenceClass === "derived_name_relationship").length as 8,
      identityOutsideCurrentTargetScope: records.filter((record) => record.identity.status === "outside_current_target_identity_scope").length as 6,
      geographyCandidates: 34 as const,
      proposedDecisions: 4 as const,
      jointApprovedRecords: 0 as const,
      scoreEligibleRecords: 0 as const,
    },
    records,
    reviewRecordSetSha256: digest("dsa-seats:il-primary-joint-review-row-set:v1\0", records),
    decisions,
    decisionSetSha256: digest("dsa-seats:il-primary-joint-review-decision-set:v1\0", decisions),
    inheritedDecisionResolutions: { certification: null, identity: null, geography: null, progressiveClassification: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:il-primary-joint-review-package:v1\0", unsigned) };
}

export function validateIllinoisPrimaryIdentityGeographyReviewPackage(
  value: IllinoisPrimaryIdentityGeographyReviewPackage,
): IllinoisPrimaryIdentityGeographyReviewPackage {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "records", "reviewRecordSetSha256", "decisions", "decisionSetSha256", "inheritedDecisionResolutions", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== ILLINOIS_PRIMARY_JOINT_REVIEW_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.records.length !== 34 ||
    value.decisions.length !== 4 || canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("LIFECYCLE_INVALID");
  const expectedRecordIds = [2022, 2024].flatMap((year) =>
    Array.from({ length: 17 }, (_, index) => `il-primary-joint:${year}:${String(index + 1).padStart(2, "0")}`)
  ).sort(bytewise);
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["reviewRecordId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "identity", "geography", "certificationStatus", "progressiveClassificationStatus", "reviewDisposition", "jointApproved", "evaluatorUse", "scoreEligible", "rationaleCodes", "reviewRecordSha256"], "RECORD_FIELDS_INVALID");
    exactKeys(record.identity, ["status", "parentObservationId", "parentRowSha256", "bioguideId", "officialHouseName", "sourceCandidateName", "evidenceClass", "relationshipDisposition", "identityApproved"], "IDENTITY_FIELDS_INVALID");
    exactKeys(record.geography, ["parentObservationId", "parentRowSha256", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "compatibilityCandidate", "compatibilityApproved"], "GEOGRAPHY_FIELDS_INVALID");
    const { reviewRecordSha256, ...unsignedRecord } = record;
    const key = `${record.cycleYear}:${record.districtCode}`;
    const outside = OUTSIDE_TARGET_KEYS.has(key);
    if (
      reviewRecordSha256 !== digest("dsa-seats:il-primary-joint-review-row:v1\0", unsignedRecord) ||
      record.identity.identityApproved || record.geography.compatibilityApproved || record.jointApproved || record.scoreEligible ||
      !record.geography.compatibilityCandidate || record.certificationStatus !== "not_retained" ||
      record.progressiveClassificationStatus !== "not_retained" ||
      record.evaluatorUse !== "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" ||
      record.reviewRecordId !== `il-primary-joint:${key}` || record.geography.parentObservationId !== `il:geography:${key}` ||
      record.seatCycleId !== `seat_house_il_${record.districtCode}_current` ||
      record.geography.targetCd119Geoid !== `17${record.districtCode}` ||
      (outside && (record.identity.status !== "outside_current_target_identity_scope" ||
        [record.identity.parentObservationId, record.identity.parentRowSha256, record.identity.bioguideId,
          record.identity.officialHouseName, record.identity.sourceCandidateName, record.identity.evidenceClass,
          record.identity.relationshipDisposition].some((entry) => entry !== null))) ||
      (!outside && (record.identity.status !== "candidate" || record.identity.parentObservationId !== `il:identity:${key}` ||
        [record.identity.parentRowSha256, record.identity.bioguideId, record.identity.officialHouseName,
          record.identity.sourceCandidateName, record.identity.evidenceClass, record.identity.relationshipDisposition].some((entry) => entry === null))) ||
      (index > 0 && bytewise(value.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0)
    ) fail("RECORD_INVALID");
  }
  if (canonicalJson(value.records.map((record) => record.reviewRecordId)) !== canonicalJson(expectedRecordIds)) {
    fail("RECORD_SET_INVALID");
  }
  if (
    digest("dsa-seats:il-primary-joint-parent-projection:v1\0", parentProjection(value.records)) !==
      ILLINOIS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256
  ) fail("PARENT_FACT_INVALID");
  const expectedDecisions = [
    ["il-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1"],
    ["il-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1"],
    ["il-primary:retain-certification-exclusion-v1", "collect-official-state-primary-results-and-certification-v1"],
    ["il-primary:retain-progressive-classification-exclusion-v1", "approve-progressive-candidate-classification-method-v1"],
  ];
  const identityRecordIds = value.records.filter((record) => record.identity.status === "candidate").map((record) => record.reviewRecordId);
  for (const [index, decision] of value.decisions.entries()) {
    exactKeys(decision, ["decisionId", "affectedComponent", "parentDecisionId", "question", "recommendedDecision", "defaultReversibleAssumption", "alternatives", "consequences", "confidence", "evidenceRecordIds", "blocksAffectedPublication", "blocksOtherWork", "workCompletedWhileWaiting", "review"], "DECISION_FIELDS_INVALID");
    const expectedEvidence = decision.decisionId === "il-primary:accept-identity-links-v1" ? identityRecordIds : expectedRecordIds;
    if (
      canonicalJson([decision.decisionId, decision.parentDecisionId]) !== canonicalJson(expectedDecisions[index]) ||
      decision.defaultReversibleAssumption !== "exclude_affected_records_from_evaluator_and_publication" ||
      decision.alternatives.length !== 2 || decision.consequences.length !== 2 || decision.confidence !== "high" ||
      canonicalJson(decision.evidenceRecordIds) !== canonicalJson(expectedEvidence) || !decision.blocksAffectedPublication ||
      decision.blocksOtherWork || decision.review.status !== "proposed" || decision.review.reviewer !== null ||
      decision.review.reviewedAt !== null || decision.review.resolution !== null
    ) fail("DECISION_INVALID");
  }
  if (canonicalJson(value.summary) !== canonicalJson({
    reviewRecords: 34,
    identityAndGeographyCandidates: 28,
    geographyCandidateIdentityOutsideCurrentTargetScope: 6,
    identityCandidates: 28,
    exactIdentityCandidates: 20,
    derivedIdentityCandidates: 8,
    identityOutsideCurrentTargetScope: 6,
    geographyCandidates: 34,
    proposedDecisions: 4,
    jointApprovedRecords: 0,
    scoreEligibleRecords: 0,
  })) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.reviewRecordSetSha256 !== digest("dsa-seats:il-primary-joint-review-row-set:v1\0", value.records) ||
    value.reviewRecordSetSha256 !== ILLINOIS_PRIMARY_JOINT_RECORD_SET_SHA256 ||
    value.decisionSetSha256 !== digest("dsa-seats:il-primary-joint-review-decision-set:v1\0", value.decisions) ||
    value.decisionSetSha256 !== ILLINOIS_PRIMARY_JOINT_DECISION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:il-primary-joint-review-package:v1\0", unsigned) ||
    packageSha256 !== ILLINOIS_PRIMARY_JOINT_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
