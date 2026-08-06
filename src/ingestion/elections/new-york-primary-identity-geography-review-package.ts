import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNewYorkPrimaryIdentityCandidate } from "./new-york-current-incumbent-primary-linkage-candidate";
import { validateNewYorkPrimaryGeographyCandidate } from "./new-york-primary-geography-compatibility-candidate";

export const NEW_YORK_PRIMARY_JOINT_REVIEW_V1 = "new-york-primary-identity-geography-review-package-v1" as const;
export const NEW_YORK_PRIMARY_JOINT_RECORD_SET_SHA256 = "f891eaaeb7dca0fdae46fe3e849a750cd46907b7d3ea5de467604f2a9a5fc19b";
export const NEW_YORK_PRIMARY_JOINT_DECISION_SET_SHA256 = "981a57a584b043c2cd1856d82ed2163c3e87c9b276596f87e1f9294276558da2";
export const NEW_YORK_PRIMARY_JOINT_PACKAGE_SHA256 = "9abd860d67af83460ecc5e121344903c7a25e5d28691914f87a7f92ec94ed6e7";
const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  identityFile: "094eccb9a8c9e14a22cc3133d92775fa58c6fd60bebf8aa9df2a870f53061edc",
  identityPackage: "193cf7041b027d542f6a72a9a40bc356f8ba3e502d1b61db7e85440df51418fe",
  identitySet: "b62cb6048e08fc09a0e983b50d2ac36d7b0ad5e1efb3ca3bc43f00e5f0220768",
  geographyFile: "8f0410959243684b03a2575eb989d23839854c17d3b4b4fe4e6416be932f5096",
  geographyPackage: "c5839d2fb9dd4cc6f463a3adf2520a43b1c6484e2f7d95c6b2e1eb0470611b5d",
  geographySet: "81d251dbbc6bbd9c1e3185abb7e161ab01b0332ec8439df69edb02a739aa85fb",
} as const;
const PROPOSAL_PARENTS = ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"] as const;
const IDENTITY_PARENTS = ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "new-york-house-democratic-primary-dispositions-2022-2024-v2", "new-york-house-democratic-primary-reported-results-2022-2024-v1", "new-york-city-house-democratic-primary-certified-results-2022-2024-v1"] as const;
const GEOGRAPHY_PARENTS = ["house-democratic-primary-source-selection-proposal-20260804-v1", "new-york-house-democratic-primary-dispositions-2022-2024-v2", "new-york-current-incumbent-primary-linkage-candidate-v1", "census-cd119-plan-change-authority-20260805", "tiger-cd118-36", "tiger-cd119-36"] as const;
const OUTPUT_PARENTS = ["house-democratic-primary-source-selection-proposal-20260804-v1", "new-york-current-incumbent-primary-linkage-candidate-v1", "new-york-primary-geography-compatibility-candidate-v1"] as const;
const OUTPUT_FILE_SHA256 = "7c626a550f1e644db1977cd39af1437384ad31e1f76602fc0f2d024cc9cc4fb8";
const OUTPUT_BYTE_SIZE = 102_113;

type Category = "identity_and_geography_candidates" | "identity_candidate_geography_pending" | "geography_candidate_identity_not_applicable" | "geography_pending_identity_no_match" | "geography_pending_identity_not_applicable";
type ReviewRecord = Readonly<{
  reviewRecordId: string; identityObservationId: string; geographyObservationId: string; cycleYear: 2022 | 2024; districtCode: string;
  seatCycleId: string; contestId: string | null; contestSha256: string | null;
  resultDisposition: "reported_contest" | "certified_uncontested" | "unresolved_outside_retained_authority_scope";
  identity: Readonly<{ parentRowSha256: string; status: "candidate" | "no_match" | "not_applicable"; identityStatus: string; bioguideId: string; officialHouseName: string; sourceCandidateName: string | null; candidate: boolean; approved: false }>;
  geography: Readonly<{ parentRowSha256: string; status: "candidate" | "redraw_crosswalk_required"; targetCd119Geoid: string; historicalCongressSession: "118" | "119"; historicalGeoid: string; compatibilityDisposition: string; confidence: "none" | "high"; candidate: boolean; approved: false }>;
  reviewCategory: Category; resultAuthorityStatus: "official_reported_contest_candidate" | "local_canvassing_board_certified_candidate" | null;
  certificationStatus: "not_independently_retained" | "local_canvassing_board_certified" | null; sourceWinnerStatus: "not_established_by_composition";
  identityDispositionPreserved: true; resultDispositionPreserved: true; progressiveClassificationStatus: "not_retained";
  jointApproved: false; evaluatorUse: "excluded_pending_authority_identity_historical_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false; reviewerAction: string; rationaleCodes: readonly string[]; reviewRecordSha256: string;
}>;
type Decision = Readonly<{ decisionId: string; parentDecisionId: string; affectedComponent: string; question: string; recommendedDecision: string; defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication"; alternatives: readonly string[]; consequences: readonly string[]; confidence: "high"; evidenceRecordIds: readonly string[]; blocksAffectedPublication: true; blocksOtherWork: false; workCompletedWhileWaiting: string; review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }> }>;
export type NewYorkPrimaryJointReviewPackage = Readonly<{
  schema: typeof NEW_YORK_PRIMARY_JOINT_REVIEW_V1; version: 1; generatedAt: "2026-08-06T14:00:00.000Z"; sourceCutoff: "2026-08-05";
  reviewerOnly: true; publicationEligible: false; defaultUse: "exclude_from_evaluator_until_authority_identity_geography_disposition_and_classification_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>; inputs: Readonly<Record<string, unknown>>; methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{ reviewRecords: 38; identityAndGeographyCandidates: number; identityCandidateGeographyPending: number; geographyCandidateIdentityNotApplicable: number; geographyPendingIdentityNoMatch: number; geographyPendingIdentityNotApplicable: number; identityCandidates: number; geographyCandidates: number; reportedContestRecords: number; certifiedUncontestedRecords: number; unresolvedRecords: number; proposedDecisions: 5; jointApprovedRecords: 0; scoreEligibleRecords: 0 }>;
  records: readonly ReviewRecord[]; reviewRecordSetSha256: string; decisions: readonly Decision[]; decisionSetSha256: string;
  inheritedDecisionResolutions: Readonly<{ authority: null; identity: null; geography: null; disposition: null; progressiveClassification: null }>;
  packageSha256: string;
}>;
export type NewYorkPrimaryJointReviewInput = Readonly<{ proposalJson: string; identityJson: string; geographyJson: string; sourceLockJson: string }>;

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const order = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`New York primary joint review rejected: ${code}`); };
const parse = (value: string, code: string): unknown => { try { return JSON.parse(value); } catch { return fail(code); } };

export function buildNewYorkPrimaryJointReviewPackage(input: NewYorkPrimaryJointReviewInput): NewYorkPrimaryJointReviewPackage {
  if (sha(input.proposalJson) !== INPUTS.proposalFile || sha(input.identityJson) !== INPUTS.identityFile || sha(input.geographyJson) !== INPUTS.geographyFile) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const identity = validateNewYorkPrimaryIdentityCandidate(parse(input.identityJson, "IDENTITY_JSON_INVALID"));
  const geography = validateNewYorkPrimaryGeographyCandidate(parse(input.geographyJson, "GEOGRAPHY_JSON_INVALID"));
  const parentDecisionIds = ["collect-official-state-primary-results-and-certification-v1", "approve-historic-primary-candidate-identity-resolution-v1", "approve-historical-district-cd119-compatibility-v1", "decide-nonstandard-primary-disposition-treatment-v1", "approve-progressive-candidate-classification-method-v1"];
  if (proposal.packageSha256 !== INPUTS.proposalPackage || identity.packageSha256 !== INPUTS.identityPackage || identity.observationSetSha256 !== INPUTS.identitySet || geography.packageSha256 !== INPUTS.geographyPackage || geography.rowSetSha256 !== INPUTS.geographySet || identity.review.resolution !== null || geography.review.resolution !== null || parentDecisionIds.some((id) => proposal.decisions.find((row) => row.decisionId === id)?.resolution !== null)) fail("PARENT_INVALID");
  const lock = parse(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID") as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["new-york-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["new-york-primary-geography-compatibility-candidate-v1", INPUTS.geographyFile, "data/metadata/new-york-primary-geography-compatibility-candidate-v1.json", "review_candidate", GEOGRAPHY_PARENTS],
  ] as const;
  const entries: NonNullable<typeof lock.entries> = lock.entries ?? fail("SOURCE_LOCK_MISMATCH");
  if (required.some(([id, hash, path, kind, parents]) => { const rows = entries.filter((entry) => entry.id === id); return rows.length !== 1 || rows[0]!.sha256 !== hash || rows[0]!.retainedPath !== path || rows[0]!.retainedStatus !== "retained" || rows[0]!.kind !== kind || canonicalJson(rows[0]!.parentIds) !== canonicalJson(parents); })) fail("SOURCE_LOCK_MISMATCH");
  const output = entries.filter((entry) => entry.id === NEW_YORK_PRIMARY_JOINT_REVIEW_V1);
  if (!OUTPUT_FILE_SHA256) { if (output.length) fail("SOURCE_LOCK_MISMATCH"); }
  else if (output.length !== 1 || output[0]!.retainedPath !== "data/metadata/new-york-primary-identity-geography-review-package-v1.json" || output[0]!.retainedStatus !== "retained" || output[0]!.byteSize !== OUTPUT_BYTE_SIZE || output[0]!.sha256 !== OUTPUT_FILE_SHA256 || output[0]!.kind !== "review_proposal" || canonicalJson(output[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const geographyByIdentity = new Map(geography.rows.map((row) => [row.identityObservationId, row]));
  const records: ReviewRecord[] = identity.observations.map((identityRow) => {
    const geographyRow = geographyByIdentity.get(identityRow.observationId) ?? fail("PARENT_JOIN_INVALID");
    if (geographyRow.identityRowSha256 !== identityRow.rowSha256 || geographyRow.contestId !== identityRow.contestId || geographyRow.contestSha256 !== identityRow.contestSha256 || geographyRow.resultDisposition !== identityRow.disposition || geographyRow.identityStatus !== identityRow.identityStatus) fail("PARENT_JOIN_INVALID");
    const identityCandidate = identityRow.identityStatus === "proposed_identity_link", identityNoMatch = identityRow.identityStatus === "reported_contest_no_unique_candidate_match", geographyCandidate = geographyRow.compatibilityCandidate;
    const category: Category = identityCandidate && geographyCandidate ? "identity_and_geography_candidates" : identityCandidate ? "identity_candidate_geography_pending" : geographyCandidate ? "geography_candidate_identity_not_applicable" : identityNoMatch ? "geography_pending_identity_no_match" : "geography_pending_identity_not_applicable";
    const unsigned = {
      reviewRecordId: `ny-primary-joint:${identityRow.cycleYear}:${identityRow.districtCode}`, identityObservationId: identityRow.observationId,
      geographyObservationId: geographyRow.observationId, cycleYear: identityRow.cycleYear, districtCode: identityRow.districtCode,
      seatCycleId: identityRow.seatCycleId, contestId: identityRow.contestId, contestSha256: identityRow.contestSha256, resultDisposition: identityRow.disposition,
      identity: { parentRowSha256: identityRow.rowSha256, status: identityCandidate ? "candidate" as const : identityNoMatch ? "no_match" as const : "not_applicable" as const, identityStatus: identityRow.identityStatus, bioguideId: identityRow.rosterIdentity.bioguideId, officialHouseName: identityRow.rosterIdentity.officialHouseName, sourceCandidateName: identityRow.sourceCandidate?.sourceCandidateName ?? null, candidate: identityCandidate, approved: false as const },
      geography: { parentRowSha256: geographyRow.rowSha256, status: geographyCandidate ? "candidate" as const : "redraw_crosswalk_required" as const, targetCd119Geoid: geographyRow.targetCd119Geoid, historicalCongressSession: geographyRow.historicalCongressSession, historicalGeoid: geographyRow.historicalGeoid, compatibilityDisposition: geographyRow.compatibilityDisposition, confidence: geographyRow.confidence, candidate: geographyCandidate, approved: false as const },
      reviewCategory: category, resultAuthorityStatus: identityRow.resultAuthorityStatus, certificationStatus: identityRow.certificationStatus,
      sourceWinnerStatus: identityRow.sourceWinnerStatus, identityDispositionPreserved: true as const, resultDispositionPreserved: true as const,
      progressiveClassificationStatus: "not_retained" as const, jointApproved: false as const,
      evaluatorUse: "excluded_pending_authority_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
      scoreEligible: false as const,
      reviewerAction: category === "identity_and_geography_candidates" ? "review_identity_and_geography_independently" : category === "identity_candidate_geography_pending" ? "review_identity_while_retaining_geography_crosswalk_requirement" : category === "geography_candidate_identity_not_applicable" ? "review_geography_while_preserving_no_reported_identity_evidence" : "retain_unresolved_parent_boundaries",
      rationaleCodes: [category, "parent_candidates_not_approved_by_join", "identity_and_result_dispositions_preserved", "source_winner_not_established_by_composition", "all_independent_review_gates_remain_open"],
    };
    return { ...unsigned, reviewRecordSha256: digest("dsa-seats:ny-primary-joint-review-row:v1\0", unsigned) };
  }).sort((left, right) => order(left.reviewRecordId, right.reviewRecordId));
  if (records.length !== 38 || geographyByIdentity.size !== 38) fail("JOIN_CLOSURE_INVALID");
  const all = records.map((row) => row.reviewRecordId), identities = records.filter((row) => row.identity.candidate).map((row) => row.reviewRecordId), reported = records.filter((row) => row.resultDisposition === "reported_contest").map((row) => row.reviewRecordId);
  const common = { defaultReversibleAssumption: "exclude_affected_records_from_evaluator_and_publication" as const, confidence: "high" as const, blocksAffectedPublication: true as const, blocksOtherWork: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null } };
  const decisions: Decision[] = [
    { ...common, decisionId: "ny-primary:accept-geography-candidates-retain-crosswalk-pending-v1", parentDecisionId: "approve-historical-district-cd119-compatibility-v1", affectedComponent: "historical geography", question: "Should 19 exact 2024 CD119 keys be accepted while all 19 2022 rows remain redraw-crosswalk-required?", recommendedDecision: "Accept only the 2024 exact-session candidates and retain every 2022 row as crosswalk-required.", alternatives: ["Require additional evidence for all 38 rows.", "Treat matching 2022 district numbers as continuity."], consequences: ["The recommendation resolves no 2022 geography and preserves the Census redraw boundary.", "The second alternative is unsupported and must require a new source-locked artifact."], evidenceRecordIds: all, workCompletedWhileWaiting: "Complete CD118/CD119 inventories and the Census New York redraw declaration are retained." },
    { ...common, decisionId: "ny-primary:accept-identity-links-v1", parentDecisionId: "approve-historic-primary-candidate-identity-resolution-v1", affectedComponent: "current-incumbent identity", question: "Should the 12 finite identity links be accepted?", recommendedDecision: "Accept six exact and six finite derived links while preserving four predecessor no-matches and 22 nonreported rows.", alternatives: ["Reject all proposed links.", "Require additional external identity evidence."], consequences: ["Acceptance resolves identity only.", "Deferral leaves every affected record excluded."], evidenceRecordIds: identities, workCompletedWhileWaiting: "All finite name and retained-alias evidence is hash-bound in the identity parent." },
    { ...common, decisionId: "ny-primary:retain-primary-disposition-exclusion-v1", parentDecisionId: "decide-nonstandard-primary-disposition-treatment-v1", affectedComponent: "primary disposition", question: "Should reported, certified-uncontested, and unresolved states remain excluded from numeric evaluator use?", recommendedDecision: "Preserve all three dispositions without inferring winners, nominees, or zero values.", alternatives: ["Infer selection from candidate vote rank.", "Convert nonreported rows to zero."], consequences: ["The recommendation preserves factual boundaries.", "Either alternative would create unsupported facts."], evidenceRecordIds: all, workCompletedWhileWaiting: "All 38 disposition coordinates and 16 result payloads are retained in parent artifacts." },
    { ...common, decisionId: "ny-primary:retain-progressive-classification-exclusion-v1", parentDecisionId: "approve-progressive-candidate-classification-method-v1", affectedComponent: "progressive classification", question: "Should progressive-primary factors remain excluded?", recommendedDecision: "Retain exclusion because no reviewed progressive classification is present.", alternatives: ["Treat non-incumbents as progressive.", "Infer ideology from names or ballot order."], consequences: ["The recommendation prevents unsupported ideological scores.", "Either alternative fabricates classifications."], evidenceRecordIds: all, workCompletedWhileWaiting: "Identity and geography evidence is isolated for later classification work." },
    { ...common, decisionId: "ny-primary:retain-reported-result-authority-boundaries-v1", parentDecisionId: "collect-official-state-primary-results-and-certification-v1", affectedComponent: "reported result authority", question: "Should nine statewide reported and seven NYC certified contests retain their distinct authority boundaries?", recommendedDecision: "Retain the distinct authorities and preserve that statewide final certification is not independently retained.", alternatives: ["Require separate final certification for every reported row.", "Flatten local and statewide authorities."], consequences: ["The recommendation preserves source status without authorizing publication or scoring.", "Flattening would erase material provenance."], evidenceRecordIds: reported, workCompletedWhileWaiting: "The exact statewide and NYC result packages remain independently source-locked." },
  ].sort((left, right) => order(left.decisionId, right.decisionId));
  const summary = { reviewRecords: 38 as const, identityAndGeographyCandidates: records.filter((row) => row.reviewCategory === "identity_and_geography_candidates").length, identityCandidateGeographyPending: records.filter((row) => row.reviewCategory === "identity_candidate_geography_pending").length, geographyCandidateIdentityNotApplicable: records.filter((row) => row.reviewCategory === "geography_candidate_identity_not_applicable").length, geographyPendingIdentityNoMatch: records.filter((row) => row.reviewCategory === "geography_pending_identity_no_match").length, geographyPendingIdentityNotApplicable: records.filter((row) => row.reviewCategory === "geography_pending_identity_not_applicable").length, identityCandidates: identities.length, geographyCandidates: records.filter((row) => row.geography.candidate).length, reportedContestRecords: reported.length, certifiedUncontestedRecords: records.filter((row) => row.resultDisposition === "certified_uncontested").length, unresolvedRecords: records.filter((row) => row.resultDisposition === "unresolved_outside_retained_authority_scope").length, proposedDecisions: 5 as const, jointApprovedRecords: 0 as const, scoreEligibleRecords: 0 as const };
  const unsigned = { schema: NEW_YORK_PRIMARY_JOINT_REVIEW_V1, version: 1 as const, generatedAt: "2026-08-06T14:00:00.000Z" as const, sourceCutoff: "2026-08-05" as const, reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_authority_identity_geography_disposition_and_classification_review" as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null }, inputs: { proposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, identity: { sourceLockId: required[1][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet }, geography: { sourceLockId: required[2][0], fileSha256: INPUTS.geographyFile, packageSha256: INPUTS.geographyPackage, rowSetSha256: INPUTS.geographySet } }, methodology: { scope: "exact_thirty_eight_new_york_identity_observations_joined_one_to_one_with_geography_rows", parentCandidatesReviewedIndependently: true, jointPackageApprovesParents: false, automaticApprovals: 0, evaluatorNumericValues: 0 }, summary, records, reviewRecordSetSha256: digest("dsa-seats:ny-primary-joint-review-row-set:v1\0", records), decisions, decisionSetSha256: digest("dsa-seats:ny-primary-joint-decision-set:v1\0", decisions), inheritedDecisionResolutions: { authority: null, identity: null, geography: null, disposition: null, progressiveClassification: null } };
  return { ...unsigned, packageSha256: digest("dsa-seats:ny-primary-joint-review-package:v1\0", unsigned) };
}

export function validateNewYorkPrimaryJointReviewPackage(value: unknown): NewYorkPrimaryJointReviewPackage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("PACKAGE_SHAPE_INVALID");
  const candidate = value as NewYorkPrimaryJointReviewPackage;
  if (candidate.schema !== NEW_YORK_PRIMARY_JOINT_REVIEW_V1 || candidate.version !== 1 || !candidate.reviewerOnly || candidate.publicationEligible || candidate.review.status !== "proposed" || candidate.review.reviewer !== null || candidate.review.reviewedAt !== null || candidate.review.resolution !== null || candidate.records.length !== 38 || candidate.decisions.length !== 5 || candidate.records.some((row) => row.jointApproved || row.identity.approved || row.geography.approved || row.scoreEligible) || candidate.decisions.some((decision) => decision.review.status !== "proposed" || decision.review.reviewer !== null || decision.review.reviewedAt !== null || decision.review.resolution !== null)) fail("LIFECYCLE_INVALID");
  const expectedSummary = { reviewRecords: 38, identityAndGeographyCandidates: 4, identityCandidateGeographyPending: 8, geographyCandidateIdentityNotApplicable: 15, geographyPendingIdentityNoMatch: 4, geographyPendingIdentityNotApplicable: 7, identityCandidates: 12, geographyCandidates: 19, reportedContestRecords: 16, certifiedUncontestedRecords: 7, unresolvedRecords: 15, proposedDecisions: 5, jointApprovedRecords: 0, scoreEligibleRecords: 0 };
  if (canonicalJson(candidate.summary) !== canonicalJson(expectedSummary) || candidate.records.some((record, index) => { const { reviewRecordSha256, ...unsigned } = record; return reviewRecordSha256 !== digest("dsa-seats:ny-primary-joint-review-row:v1\0", unsigned) || record.reviewRecordId !== `ny-primary-joint:${record.cycleYear}:${record.districtCode}` || record.identityObservationId !== `ny:identity:${record.cycleYear}:${record.districtCode}` || record.geographyObservationId !== `ny:geography:${record.cycleYear}:${record.districtCode}` || (index > 0 && order(candidate.records[index - 1]!.reviewRecordId, record.reviewRecordId) >= 0); })) fail("RECORD_INVALID");
  if (candidate.reviewRecordSetSha256 !== digest("dsa-seats:ny-primary-joint-review-row-set:v1\0", candidate.records) || candidate.decisionSetSha256 !== digest("dsa-seats:ny-primary-joint-decision-set:v1\0", candidate.decisions)) fail("SET_HASH_INVALID");
  const { packageSha256, ...unsigned } = candidate;
  if (packageSha256 !== digest("dsa-seats:ny-primary-joint-review-package:v1\0", unsigned)) fail("PACKAGE_HASH_INVALID");
  if (NEW_YORK_PRIMARY_JOINT_RECORD_SET_SHA256 && candidate.reviewRecordSetSha256 !== NEW_YORK_PRIMARY_JOINT_RECORD_SET_SHA256) fail("RECORD_SET_IDENTITY_INVALID");
  if (NEW_YORK_PRIMARY_JOINT_DECISION_SET_SHA256 && candidate.decisionSetSha256 !== NEW_YORK_PRIMARY_JOINT_DECISION_SET_SHA256) fail("DECISION_SET_IDENTITY_INVALID");
  if (NEW_YORK_PRIMARY_JOINT_PACKAGE_SHA256 && candidate.packageSha256 !== NEW_YORK_PRIMARY_JOINT_PACKAGE_SHA256) fail("PACKAGE_IDENTITY_INVALID");
  return candidate;
}
