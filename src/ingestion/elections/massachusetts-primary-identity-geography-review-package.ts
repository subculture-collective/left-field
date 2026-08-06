import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  validateMassachusettsPrimaryIdentityCandidate,
  type MassachusettsPrimaryIdentityCandidate,
} from "./massachusetts-current-incumbent-primary-linkage-candidate";
import {
  validateMassachusettsPrimaryGeographyCandidate,
  type MassachusettsPrimaryGeographyCandidate,
} from "./massachusetts-primary-geography-compatibility-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";

export const MASSACHUSETTS_PRIMARY_JOINT_REVIEW_V1 =
  "massachusetts-primary-identity-geography-review-package-v1" as const;
export const MASSACHUSETTS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256 =
  "0bd8532c35298f884a20dd9095b24768360b1d66d1499430f04106793e082723" as const;
export const MASSACHUSETTS_PRIMARY_JOINT_RECORD_SET_SHA256 =
  "224be033db1ca876721191f7cfc95a3b5ee3919d9cba3ed77a2fdf3993ae5791" as const;
export const MASSACHUSETTS_PRIMARY_JOINT_DECISION_SET_SHA256 =
  "57bf5771cdaefab8e46ec3e9fe1a4a3d00e1b1cdf57b145e9e9faf4021abfaca" as const;
export const MASSACHUSETTS_PRIMARY_JOINT_PACKAGE_SHA256 =
  "04e07185560b6fe7e41292c10a2575cfe24fcd8a0b81b87be16e022ff7ddf75f" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "71566ac5dd105b846f6977ad3269d0419ff8df954cf36775864873b324bbe3a5",
  identityPackage: "364d4e42d293c5b81408f9b71daa90d2d7ed21c96119e92a82dcd631f1590e3d",
  identitySet: "6d2989f28b08974243a984bac3e3c71a23f597825e6c30f6c6a73dbbcb5c076b",
  geographyFile: "f74670eca7741c0fb000a61a623c6ece845f3da203cabb53644b8383a4e69174",
  geographyPackage: "7b73e142ec8a6d8024b5845bd0d19eda4569b69a72a03dc83edcb7d231bd11c1",
  geographySet: "9dc75c5963c0467adaa684723a82792a50eb9435e4a1d3abf32d2c7dd6c7c2e1",
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
  "massachusetts-house-democratic-primary-results-2022-2026-v1",
] as const;
const GEOGRAPHY_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "massachusetts-house-democratic-primary-results-2022-2026-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-25",
  "tiger-cd119-25",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "massachusetts-current-incumbent-primary-linkage-candidate-v1",
  "massachusetts-primary-geography-compatibility-candidate-v1",
] as const;
const OUTPUT_FILE_SHA256 = "08d2063b358c510cda2131cec07e6ad775d4f1db784e4161f332f23c85a9322a" as const;
const OUTPUT_BYTE_SIZE = 50_791 as const;

type ReviewRecord = Readonly<{
  reviewRecordId: string;
  contestId: string;
  contestSha256: string;
  seatCycleId: string;
  districtCode: string;
  cycleYear: 2022 | 2024;
  identity: Readonly<{
    parentObservationId: string;
    parentRowSha256: string;
    bioguideId: string;
    officialHouseName: string;
    sourceCandidateName: string;
    evidenceClass: "exact_name_observation" | "derived_name_relationship";
    relationshipDisposition: "proposed_identity_link_pending_documented_review";
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
  primaryDisposition: Readonly<{
    sourceTreatment: "reported_single_named_candidate_not_uncontested_inference";
    parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1";
    parentDecisionUnresolved: true;
    evaluatorSelectionStatus: "excluded_pending_nonstandard_disposition_decision";
  }>;
  reviewDisposition: "identity_and_geography_candidates_pending_independent_review";
  jointApproved: false;
  evaluatorUse: "excluded_pending_independent_identity_geography_and_disposition_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  reviewRecordSha256: string;
}>;

type Decision = Readonly<{
  decisionId:
    | "ma-primary:accept-identity-links-v1"
    | "ma-primary:accept-geography-compatibility-v1"
    | "ma-primary:retain-single-named-reported-contest-treatment-v1";
  affectedComponent: "current-incumbent identity" | "historical geography" | "primary contest disposition";
  parentDecisionId:
    | "approve-historic-primary-candidate-identity-resolution-v1"
    | "approve-historical-district-cd119-compatibility-v1"
    | "decide-nonstandard-primary-disposition-treatment-v1";
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

export type MassachusettsPrimaryJointReviewPackage = Readonly<{
  schema: typeof MASSACHUSETTS_PRIMARY_JOINT_REVIEW_V1;
  version: 1;
  generatedAt: "2026-08-06T04:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_independent_identity_geography_and_disposition_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    reviewRecords: 18;
    identityAndGeographyCandidates: 18;
    identityCandidates: 18;
    geographyCandidates: 18;
    proposedDecisions: 3;
    jointApprovedRecords: 0;
    scoreEligibleRecords: 0;
  }>;
  records: readonly ReviewRecord[];
  reviewRecordSetSha256: string;
  decisions: readonly Decision[];
  decisionSetSha256: string;
  inheritedDecisionResolutions: Readonly<{
    identity: null;
    geography: null;
    disposition: null;
  }>;
  packageSha256: string;
}>;

export type MassachusettsPrimaryJointReviewInput = Readonly<{
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
  throw new Error(`Massachusetts primary joint review rejected: ${code}`);
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
  identityParentObservationId: record.identity.parentObservationId,
  identityParentRowSha256: record.identity.parentRowSha256,
  geographyParentObservationId: record.geography.parentObservationId,
  geographyParentRowSha256: record.geography.parentRowSha256,
}));

export function buildMassachusettsPrimaryJointReviewPackage(
  input: MassachusettsPrimaryJointReviewInput,
): MassachusettsPrimaryJointReviewPackage {
  if (
    sha256(input.proposalJson) !== INPUTS.proposalFile || sha256(input.identityJson) !== INPUTS.identityFile ||
    sha256(input.geographyJson) !== INPUTS.geographyFile
  ) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const identity = validateMassachusettsPrimaryIdentityCandidate(
    parse<MassachusettsPrimaryIdentityCandidate>(input.identityJson, "IDENTITY_JSON_INVALID"),
  );
  const geography = validateMassachusettsPrimaryGeographyCandidate(
    parse<MassachusettsPrimaryGeographyCandidate>(input.geographyJson, "GEOGRAPHY_JSON_INVALID"),
  );
  const identityDecision = proposal.decisions.find((decision) =>
    decision.decisionId === "approve-historic-primary-candidate-identity-resolution-v1");
  const geographyDecision = proposal.decisions.find((decision) =>
    decision.decisionId === "approve-historical-district-cd119-compatibility-v1");
  const dispositionDecision = proposal.decisions.find((decision) =>
    decision.decisionId === "decide-nonstandard-primary-disposition-treatment-v1");
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || geography.packageSha256 !== INPUTS.geographyPackage ||
    geography.rowSetSha256 !== INPUTS.geographySet || identity.review.resolution !== null || geography.review.resolution !== null ||
    identityDecision?.resolution !== null || geographyDecision?.resolution !== null || dispositionDecision?.resolution !== null
  ) fail("PARENT_INVALID");

  const sourceLock = parse<{ entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> }>(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID");
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["massachusetts-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["massachusetts-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/massachusetts-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
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
  const outputMatches = sourceLockEntries.filter((entry) => entry.id === MASSACHUSETTS_PRIMARY_JOINT_REVIEW_V1);
  if (
    outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
      "data/metadata/massachusetts-primary-identity-geography-review-package-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_proposal" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)
  ) fail("SOURCE_LOCK_MISMATCH");

  const geographyByKey = new Map(geography.rows.map((row) => [`${row.cycleYear}:${row.districtCode}`, row]));
  const records: ReviewRecord[] = identity.observations.map((identityRow) => {
    const key = `${identityRow.cycleYear}:${identityRow.districtCode}`;
    const geographyRow = geographyByKey.get(key) ?? fail("PARENT_JOIN_INVALID");
    if (
      geographyRow.contestId !== identityRow.contestId || geographyRow.contestSha256 !== identityRow.contestSha256 ||
      geographyRow.seatCycleId !== identityRow.seatCycleId || geographyRow.cycleYear !== identityRow.cycleYear ||
      geographyRow.districtCode !== identityRow.districtCode
    ) fail("PARENT_JOIN_INVALID");
    const unsigned = {
      reviewRecordId: `ma-primary-joint:${identityRow.cycleYear}:${identityRow.districtCode}`,
      contestId: identityRow.contestId,
      contestSha256: identityRow.contestSha256,
      seatCycleId: identityRow.seatCycleId,
      districtCode: identityRow.districtCode,
      cycleYear: identityRow.cycleYear,
      identity: {
        parentObservationId: identityRow.observationId,
        parentRowSha256: identityRow.rowSha256,
        bioguideId: identityRow.rosterIdentity.bioguideId,
        officialHouseName: identityRow.rosterIdentity.officialHouseName,
        sourceCandidateName: identityRow.sourceCandidate.sourceCandidateName,
        evidenceClass: identityRow.evidenceClass,
        relationshipDisposition: identityRow.relationshipDisposition,
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
      primaryDisposition: {
        sourceTreatment: "reported_single_named_candidate_not_uncontested_inference" as const,
        parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1" as const,
        parentDecisionUnresolved: true as const,
        evaluatorSelectionStatus: "excluded_pending_nonstandard_disposition_decision" as const,
      },
      reviewDisposition: "identity_and_geography_candidates_pending_independent_review" as const,
      jointApproved: false as const,
      evaluatorUse: "excluded_pending_independent_identity_geography_and_disposition_review" as const,
      scoreEligible: false as const,
      rationaleCodes: [
        "identity_candidate_pending_independent_review",
        "geography_candidate_pending_independent_review",
        "single_named_contest_disposition_pending_independent_review",
        "parent_candidates_not_approved_by_join",
      ],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:ma-primary-joint-review-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.reviewRecordId, right.reviewRecordId));
  if (records.length !== 18 || geographyByKey.size !== 18) fail("JOIN_CLOSURE_INVALID");
  const parentProjectionSha256 = digest("dsa-seats:ma-primary-joint-parent-projection:v1\0", parentProjection(records));
  if (parentProjectionSha256 !== MASSACHUSETTS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256) fail("PARENT_FACT_INVALID");

  const evidenceRecordIds = records.map((record) => record.reviewRecordId);
  const common = {
    defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication" as const,
    confidence: "high" as const,
    evidenceRecordIds,
    blocksAffectedPublication: true as const,
    blocksOtherWork: false as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
  };
  const decisions: Decision[] = [
    {
      ...common,
      decisionId: "ma-primary:accept-identity-links-v1",
      affectedComponent: "current-incumbent identity",
      parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      question: "Should the 18 same-district exact or retained-alias observations be accepted as historical source-candidate relationships to the nine current Massachusetts incumbents?",
      recommendedDecision: "Accept the 18 proposed identity relationships while preserving the absence of a direct person identifier in PD43+.",
      alternatives: ["Reject all 18 relationships and retain identity exclusion.", "Request targeted external identity evidence for the eight derived-name rows before resolving any row."],
      consequences: ["Acceptance resolves only identity evidence and does not approve geography, contest treatment, scoring, or publication.", "Rejection or deferral keeps the affected records excluded while unrelated acquisition and review continue."],
      workCompletedWhileWaiting: "Exact and derived name classes, parent row hashes, source names, votes, and official identities are retained and validated.",
    },
    {
      ...common,
      decisionId: "ma-primary:accept-geography-compatibility-v1",
      affectedComponent: "historical geography",
      parentDecisionId: "approve-historical-district-cd119-compatibility-v1",
      question: "Should the nine CD118-to-CD119 continuity rows and nine exact CD119 session/key rows be accepted as geography-compatible evidence candidates?",
      recommendedDecision: "Accept all 18 geography candidates under the retained Census authority and complete district inventories without claiming raw geometry equality.",
      alternatives: ["Require a block-level crosswalk before accepting the nine 2022 continuity rows.", "Reject all geography candidates and retain historical-geography exclusion."],
      consequences: ["Acceptance resolves only geography evidence and does not approve identity, contest treatment, scoring, or publication.", "A crosswalk requirement or rejection keeps affected records excluded while preserving the retained authority package."],
      workCompletedWhileWaiting: "Official CD118/CD119 layers, DBF member hashes, complete inventories, Census authority, and parent row hashes are retained and validated.",
    },
    {
      ...common,
      decisionId: "ma-primary:retain-single-named-reported-contest-treatment-v1",
      affectedComponent: "primary contest disposition",
      parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1",
      question: "Should each PD43+ single-named-candidate result remain a reported contest without inferring that the Democratic primary was uncontested?",
      recommendedDecision: "Retain the reported-contest treatment and do not infer uncontested status from one printed candidate plus All Others and blanks.",
      alternatives: ["Classify all 18 contests as uncontested based on the single printed candidate.", "Require separate ballot-access evidence for each contest before assigning any disposition beyond reported result."],
      consequences: ["The recommendation preserves factual result observations but leaves evaluator selection and numeric primary factors excluded until the broader disposition rule is resolved.", "An alternative classification would require a new versioned artifact and must not be inferred from these result rows alone."],
      workCompletedWhileWaiting: "All Others, blank-vote, named-candidate, and total-vote channels are retained and exactly reconciled in the parent receipt.",
    },
  ];
  decisions.sort((left, right) => bytewise(left.decisionId, right.decisionId));

  const unsigned = {
    schema: MASSACHUSETTS_PRIMARY_JOINT_REVIEW_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T04:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_independent_identity_geography_and_disposition_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: {
      proposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      identity: { sourceLockId: required[1][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      geography: { sourceLockId: required[2][0], fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage, rowSetSha256: INPUTS.geographySet },
    },
    methodology: {
      scope: "exact_eighteen_massachusetts_identity_rows_joined_one_to_one_with_geography_rows",
      parentRowsJoinedOn: ["contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear"],
      decisionsReviewedIndependently: true,
      decisionEvidenceModel: "each_decision_binds_all_eighteen_affected_records",
      parentProjectionSha256,
      jointPackageApprovesParents: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
    },
    summary: {
      reviewRecords: 18 as const,
      identityAndGeographyCandidates: 18 as const,
      identityCandidates: 18 as const,
      geographyCandidates: 18 as const,
      proposedDecisions: 3 as const,
      jointApprovedRecords: 0 as const,
      scoreEligibleRecords: 0 as const,
    },
    records,
    reviewRecordSetSha256: digest("dsa-seats:ma-primary-joint-review-row-set:v1\0", records),
    decisions,
    decisionSetSha256: digest("dsa-seats:ma-primary-joint-review-decision-set:v1\0", decisions),
    inheritedDecisionResolutions: { identity: null, geography: null, disposition: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:ma-primary-joint-review-package:v1\0", unsigned) };
}

export function validateMassachusettsPrimaryJointReviewPackage(
  value: MassachusettsPrimaryJointReviewPackage,
): MassachusettsPrimaryJointReviewPackage {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "records", "reviewRecordSetSha256", "decisions", "decisionSetSha256", "inheritedDecisionResolutions", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== MASSACHUSETTS_PRIMARY_JOINT_REVIEW_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.records.length !== 18 || value.decisions.length !== 3
  ) fail("LIFECYCLE_INVALID");
  const expectedRecordIds = [2022, 2024].flatMap((year) =>
    Array.from({ length: 9 }, (_, index) => `ma-primary-joint:${year}:${String(index + 1).padStart(2, "0")}`)
  ).sort(bytewise);
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["reviewRecordId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "identity", "geography", "primaryDisposition", "reviewDisposition", "jointApproved", "evaluatorUse", "scoreEligible", "rationaleCodes", "reviewRecordSha256"], "RECORD_FIELDS_INVALID");
    exactKeys(record.identity, ["parentObservationId", "parentRowSha256", "bioguideId", "officialHouseName", "sourceCandidateName", "evidenceClass", "relationshipDisposition", "identityApproved"], "IDENTITY_FIELDS_INVALID");
    exactKeys(record.geography, ["parentObservationId", "parentRowSha256", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "compatibilityCandidate", "compatibilityApproved"], "GEOGRAPHY_FIELDS_INVALID");
    exactKeys(record.primaryDisposition, ["sourceTreatment", "parentDecisionId", "parentDecisionUnresolved", "evaluatorSelectionStatus"], "DISPOSITION_FIELDS_INVALID");
    const { reviewRecordSha256, ...unsignedRecord } = record;
    if (
      reviewRecordSha256 !== digest("dsa-seats:ma-primary-joint-review-row:v1\0", unsignedRecord) ||
      record.identity.identityApproved || record.geography.compatibilityApproved || record.jointApproved || record.scoreEligible ||
      !record.geography.compatibilityCandidate || record.primaryDisposition.parentDecisionUnresolved !== true ||
      record.reviewRecordId !== `ma-primary-joint:${record.cycleYear}:${record.districtCode}` ||
      record.identity.parentObservationId !== `ma:identity:${record.cycleYear}:${record.districtCode}` ||
      record.geography.parentObservationId !== `ma:geography:${record.cycleYear}:${record.districtCode}` ||
      record.seatCycleId !== `seat_house_ma_${record.districtCode}_current` ||
      record.geography.targetCd119Geoid !== `25${record.districtCode}` ||
      (index > 0 && bytewise(value.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0)
    ) fail("RECORD_INVALID");
  }
  if (canonicalJson(value.records.map((record) => record.reviewRecordId)) !== canonicalJson(expectedRecordIds)) {
    fail("RECORD_SET_INVALID");
  }
  if (
    digest("dsa-seats:ma-primary-joint-parent-projection:v1\0", parentProjection(value.records)) !==
    MASSACHUSETTS_PRIMARY_JOINT_PARENT_PROJECTION_SHA256
  ) fail("PARENT_FACT_INVALID");
  const expectedDecisions = [
    ["ma-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1"],
    ["ma-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1"],
    ["ma-primary:retain-single-named-reported-contest-treatment-v1", "decide-nonstandard-primary-disposition-treatment-v1"],
  ];
  for (const [index, decision] of value.decisions.entries()) {
    exactKeys(decision, ["decisionId", "affectedComponent", "parentDecisionId", "question", "recommendedDecision", "defaultReversibleAssumption", "alternatives", "consequences", "confidence", "evidenceRecordIds", "blocksAffectedPublication", "blocksOtherWork", "workCompletedWhileWaiting", "review"], "DECISION_FIELDS_INVALID");
    if (
      canonicalJson([decision.decisionId, decision.parentDecisionId]) !== canonicalJson(expectedDecisions[index]) ||
      decision.defaultReversibleAssumption !== "exclude_affected_records_from_evaluator_and_publication" ||
      decision.alternatives.length !== 2 || decision.consequences.length !== 2 || decision.confidence !== "high" ||
      canonicalJson(decision.evidenceRecordIds) !== canonicalJson(expectedRecordIds) || !decision.blocksAffectedPublication ||
      decision.blocksOtherWork || decision.review.status !== "proposed" || decision.review.reviewer !== null ||
      decision.review.reviewedAt !== null || decision.review.resolution !== null
    ) fail("DECISION_INVALID");
  }
  if (canonicalJson(value.summary) !== canonicalJson({
    reviewRecords: 18,
    identityAndGeographyCandidates: 18,
    identityCandidates: 18,
    geographyCandidates: 18,
    proposedDecisions: 3,
    jointApprovedRecords: 0,
    scoreEligibleRecords: 0,
  })) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.reviewRecordSetSha256 !== digest("dsa-seats:ma-primary-joint-review-row-set:v1\0", value.records) ||
    value.reviewRecordSetSha256 !== MASSACHUSETTS_PRIMARY_JOINT_RECORD_SET_SHA256 ||
    value.decisionSetSha256 !== digest("dsa-seats:ma-primary-joint-review-decision-set:v1\0", value.decisions) ||
    value.decisionSetSha256 !== MASSACHUSETTS_PRIMARY_JOINT_DECISION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:ma-primary-joint-review-package:v1\0", unsigned) ||
    packageSha256 !== MASSACHUSETTS_PRIMARY_JOINT_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
