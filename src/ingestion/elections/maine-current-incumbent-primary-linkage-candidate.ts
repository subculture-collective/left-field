import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateMainePrimaryResultsReceipt, type MainePrimaryResultsReceipt } from "./maine-house-democratic-primary-results-receipt";

export const MAINE_PRIMARY_IDENTITY_V1 = "maine-current-incumbent-primary-linkage-candidate-v1" as const;
export const MAINE_PRIMARY_IDENTITY_SET_SHA256 = "439adc45936c851bcf73e941702bd653e7067842b6ffd4cb20dac8f769feadd1";
export const MAINE_PRIMARY_IDENTITY_PACKAGE_SHA256 = "d3defe9629eb9b79cf1cf5c7672aee783a85e912d1b563a8277b893fda1f6fd3";
export const MAINE_PRIMARY_IDENTITY_FILE_SHA256 = "1f0f95696754675439438901679256f875e3612185bf66265f244419ad775474";
export const MAINE_PRIMARY_IDENTITY_FILE_BYTES = 21_612;

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "8a24a92134030c90dc946bcadf35a4c40b5af2f930acf3f9c007735bd045504c",
  receiptPackage: "cc50030cb023eb43b1cced7b893563f98e70082cc6ae21484360775cd2e81c3e",
  receiptContestSet: "2499c8b1d270d192b5372594c87b516b971fe19f6452b017945ed54492af105c",
  receiptTargetSet: "fc0e3ed9891c3b2bca20aa245bc9225e9314d7dcb119e31c2cf85d30a63414bd",
} as const;

const TARGETS = {
  "01": { seat: "seat_house_me_01_current", bioguide: "P000597", official: "Chellie Pingree" },
  "02": { seat: "seat_house_me_02_current", bioguide: "G000592", official: "Jared F. Golden" },
} as const;

export const MAINE_PRIMARY_IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "maine-house-democratic-primary-results-2022-2026-v1",
] as const;

const RECEIPT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "maine-2022-house-democratic-primary-cd01-results",
  "maine-2022-house-democratic-primary-cd02-results",
  "maine-2024-house-democratic-primary-cd01-results",
  "maine-2024-house-democratic-primary-cd02-results",
  "maine-2026-house-democratic-primary-cd01-results",
  "maine-2026-house-democratic-primary-cd02-first-choice-results",
  "maine-2026-house-democratic-primary-cd02-rcv-summary-layout-text",
] as const;

const REQUIRED_LOCK_ENTRIES = [
  [MAINE_PRIMARY_IDENTITY_PARENTS[0], "urn:dsa-seats:dsa-target-incumbent-roster:v1:2026-08-04", "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", 21_001, INPUTS.rosterFile, "production_projection_receipt", ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"]],
  [MAINE_PRIMARY_IDENTITY_PARENTS[1], "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411_793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  [MAINE_PRIMARY_IDENTITY_PARENTS[2], "https://clerk.house.gov/xml/lists/MemberData.xml", "data/source/identity/house-member-data.xml", 556_140, INPUTS.houseFile, "source", []],
  [MAINE_PRIMARY_IDENTITY_PARENTS[3], "https://unitedstates.github.io/congress-legislators/legislators-current.json", "data/source/identity/congress-legislators-current-20260804.json", 1_466_894, INPUTS.congressFile, "source", []],
  [MAINE_PRIMARY_IDENTITY_PARENTS[4], "urn:dsa-seats:maine-house-democratic-primary-results:v1:2022-2026", "data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json", 26_429, INPUTS.receiptFile, "review_candidate", RECEIPT_PARENTS],
] as const;

const EXPECTED = [
  { id: "me:identity:2022:01", year: 2022, district: "01", parent: "1718906cb5095a53f646d98e093adc31261ef2f71c42ca69cebbe672b583685e", contest: "fa96255f0d961c549e60d6cd7e66bd0fa1e0f597ca11523a757c80f6af383ff9", source: "Pingree, Chellie M.", votes: 43_007, method: "derived_source_middle_initial_not_in_official_house_name_reordered_same_district", evidence: "derived_name_relationship" },
  { id: "me:identity:2022:02", year: 2022, district: "02", parent: "66c896688ff144b8885f17f37d670b09395a44046b8906dd5e42a1989fded519", contest: "d664af22cde70d8a60941b6c740e47b177ebd15f69202f2e5af3f17d76860c07", source: "Golden, Jared Forrest", votes: 25_684, method: "derived_source_full_middle_name_matches_congress_legislators_middle_name_reordered_same_district", evidence: "derived_name_relationship" },
  { id: "me:identity:2024:01", year: 2024, district: "01", parent: "f97e1d7b59f3d512a987f0274592e39b8b8a71ddf566ece0b00dd62bc1214f36", contest: "63a485ef18ae2c4787965c17da51b9c9891afe1e07df89358a9ddbb58f2657ac", source: "Pingree, Chellie", votes: 46_307, method: "exact_normalized_reordered_official_house_name_same_district", evidence: "exact_name_observation" },
  { id: "me:identity:2024:02", year: 2024, district: "02", parent: "76d66ed735bc9772f31e36d587320ae4833c0ec41588deeab100f2d2500bee8a", contest: "00ee61704be536fda0b774da830840f141379e63d5e4c1fba9d8f2123004ff88", source: "Golden, Jared Forrest", votes: 23_183, method: "derived_source_full_middle_name_matches_congress_legislators_middle_name_reordered_same_district", evidence: "derived_name_relationship" },
  { id: "me:identity:2026:01", year: 2026, district: "01", parent: "6a362539fa9d32dcaf0c37fc5502c03a8ad45ac1248ea338039b0cb9957bb33e", contest: "571258a7410168890c11ebe3ccc7bea2af422e7ce3637f1c1ccf04ea6e405378", source: "PINGREE, CHELLIE", votes: 128_257, method: "exact_normalized_reordered_official_house_name_same_district", evidence: "exact_name_observation" },
  { id: "me:identity:2026:02", year: 2026, district: "02", parent: "7ed886c1f8d11985a95e6a6d584e63a5298905f01e81f9dd25f0bc2b76885694", contest: "ebe7c8770eb404681d06c681723f0574c77ccd495d96e88df0c9b5bc6ae32f19", source: null, votes: null, method: "no_unique_candidate_match_current_incumbent_not_observed", evidence: "unresolved_current_incumbent_nonappearance" },
] as const;

const EXPECTED_SOURCE_FACTS = [
  ["2022-06-14", 1, 43_007, 2_722, 45_729, "separate_signed_certification_not_retained", "not_marked_by_source", null],
  ["2022-06-14", 1, 25_684, 2_898, 28_582, "separate_signed_certification_not_retained", "not_marked_by_source", null],
  ["2024-06-11", 1, 46_307, 2_914, 49_221, "final_labeled_workbook_retained_separate_signed_certification_not_retained", "not_marked_by_source", null],
  ["2024-06-11", 1, 23_183, 1_948, 25_131, "final_labeled_workbook_retained_separate_signed_certification_not_retained", "not_marked_by_source", null],
  ["2026-06-09", 1, 128_257, 10_664, 138_921, "final_labeled_workbook_retained_separate_signed_certification_not_retained", "not_marked_by_source", null],
  ["2026-06-09", 4, 78_724, 4_756, 83_480, "rcv_central_count_summary_retained_separate_signed_certification_not_retained", "explicit_rcv_summary_winner", "Dunlap, Matthew G."],
] as const;

const EXPECTED_METHODOLOGY = { scope: "two_current_maine_target_seats_times_three_completed_regular_primary_cycles", identityMethod: "finite_audited_reordered_exact_and_documented_middle_name_relationships_without_fuzzy_matching", directIdentifierBridgeAvailable: false, candidateIdTreatment: "source_workbooks_have_no_direct_person_identifier", nonappearanceTreatment: "retain_current_incumbent_nonappearance_without_zero_retirement_withdrawal_loss_or_nomination_inference", winnerTreatment: "preserve_explicit_2026_cd02_rcv_winner_as_result_evidence_not_current_incumbent_identity_evidence", rcvProjectionTreatment: "preserve_distinct_workbook_and_central_count_projections_and_81_vote_delta_without_precedence_resolution", singleCandidateTreatment: "do_not_infer_winner_nominee_or_uncontested_status", historicalDistrictTreatment: "same_district_number_does_not_approve_geography", automaticDecisionClosure: false, evaluatorNumericValues: 0 } as const;

const expectedRationale = (expected: typeof EXPECTED[number]): readonly string[] => expected.source === null
  ? ["current_incumbent_not_observed_in_exact_source_candidate_set", "explicit_rcv_winner_is_not_current_incumbent_identity_evidence", "nonappearance_is_not_zero_retirement_withdrawal_loss_or_nomination", "rcv_projections_remain_distinct_without_precedence_resolution"]
  : [expected.evidence === "exact_name_observation" ? "normalized_reordered_source_name_matches_current_official_house_name" : expected.district === "01" ? "finite_source_middle_initial_variant_same_first_last_and_district" : "congress_legislators_full_middle_name_documents_source_relationship", "same_district_number_is_not_geography_approval", "source_workbook_has_no_direct_person_identifier"];

type Input = Readonly<{ roster: unknown; rosterFileSha256: string; proposal: unknown; proposalFileSha256: string; receipt: MainePrimaryResultsReceipt; receiptFileSha256: string; houseXml: string; houseFileSha256: string; congressJson: string; congressFileSha256: string; sourceLock: unknown }>;
type LockEntry = { id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: string[] };
const fail = (code: string): never => { throw new Error(`Maine primary identity rejected: ${code}`); };
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`))?.[1] ?? "";
const normalizedForward = (value: string) => {
  const parts = value.split(",").map((part) => part.trim());
  const forward = parts.length === 2 ? `${parts[1]} ${parts[0]}` : value;
  return forward.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
};

export function buildMainePrimaryIdentityCandidate(input: Input) {
  if (input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile || input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile || input.congressFileSha256 !== INPUTS.congressFile || sha(input.houseXml) !== INPUTS.houseFile || sha(input.congressJson) !== INPUTS.congressFile) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateMainePrimaryResultsReceipt(input.receipt);
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptContestSet || receipt.summary.targetObservationSetSha256 !== INPUTS.receiptTargetSet || proposal.decisions.find((item) => item.decisionId === "approve-historic-primary-candidate-identity-resolution-v1")?.resolution !== null) fail("PARENT_INVALID");

  const lock = input.sourceLock as { entries?: LockEntry[] };
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const entries = lock.entries as LockEntry[];
  if (REQUIRED_LOCK_ENTRIES.some(([id, url, path, size, hash, kind, parents]) => {
    const matches = entries.filter((entry) => entry.id === id); const entry = matches[0];
    return matches.length !== 1 || entry?.url !== url || entry.retainedPath !== path || entry.retainedStatus !== "retained" || entry.byteSize !== size || entry.sha256 !== hash || entry.kind !== kind || canonicalJson(entry.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const output = entries.filter((entry) => entry.id === MAINE_PRIMARY_IDENTITY_V1);
  if (MAINE_PRIMARY_IDENTITY_FILE_SHA256 ? output.length !== 1 || output[0]?.url !== "urn:dsa-seats:maine-current-incumbent-primary-linkage-candidate:v1:2022-2026" || output[0].retainedPath !== "data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json" || output[0].retainedStatus !== "retained" || output[0].byteSize !== MAINE_PRIMARY_IDENTITY_FILE_BYTES || output[0].sha256 !== MAINE_PRIMARY_IDENTITY_FILE_SHA256 || output[0].kind !== "review_candidate" || canonicalJson(output[0].parentIds) !== canonicalJson(MAINE_PRIMARY_IDENTITY_PARENTS) : output.length !== 0) fail("SOURCE_LOCK_MISMATCH");

  let people: Array<{ id?: { bioguide?: string }; name?: { first?: string; middle?: string; last?: string; official_full?: string }; terms?: Array<{ type?: string; state?: string; district?: number }> }>;
  try { people = JSON.parse(input.congressJson); } catch { return fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("CONGRESS_JSON_INVALID");
  const members = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  for (const [district, target] of Object.entries(TARGETS)) {
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === target.seat && row.bioguideId === target.bioguide);
    const personRows = people.filter((person) => person.id?.bioguide === target.bioguide);
    const clerkRows = members.filter((member) => tag(member, "bioguideID") === target.bioguide);
    const term = personRows[0]?.terms?.at(-1);
    if (rosterRows.length !== 1 || personRows.length !== 1 || personRows[0]?.name?.official_full !== target.official || term?.type !== "rep" || term.state !== "ME" || String(term.district).padStart(2, "0") !== district || clerkRows.length !== 1 || tag(clerkRows[0]!, "statedistrict") !== `ME${district}` || tag(clerkRows[0]!, "official-name") !== target.official || tag(clerkRows[0]!, "party") !== "D") fail("CURRENT_IDENTITY_INVALID");
    if (district === "02" && (personRows[0]?.name?.first !== "Jared" || personRows[0]?.name?.middle !== "Forrest" || personRows[0]?.name?.last !== "Golden" || tag(clerkRows[0]!, "middlename") !== "F.")) fail("DOCUMENTED_NAME_RELATIONSHIP_INVALID");
  }

  const contests = new Map(receipt.contests.map((contest) => [contest.contestId, contest]));
  const parentRows = new Map(receipt.targetObservations.map((row) => [row.observationId, row]));
  const observations = EXPECTED.map((expected) => {
    const target = TARGETS[expected.district];
    const parent = parentRows.get(`me:target:${expected.year}:${expected.district}`) ?? fail("PARENT_OBSERVATION_MISSING");
    const contest = contests.get(parent.contestId) ?? fail("SOURCE_CONTEST_MISSING");
    if (parent.observationSha256 !== expected.parent || contest.contestSha256 !== expected.contest || parent.targetSeatId !== target.seat || parent.bioguideId !== target.bioguide || parent.currentTargetDistrictCode !== expected.district || parent.sourceDistrictCode !== expected.district || contest.cycleYear !== expected.year || contest.districtCode !== expected.district) fail("LINK_CLOSURE_INVALID");
    const candidates = expected.source === null ? [] : contest.candidates.filter((candidate) => candidate.sourceCandidateName === expected.source && candidate.workbookFirstChoiceVotes === expected.votes);
    if (expected.source === null ? parent.sourceCandidateNameObservation !== null || contest.candidates.some((candidate) => normalizedForward(candidate.sourceCandidateName).includes("jared") || normalizedForward(candidate.sourceCandidateName).includes("golden")) : candidates.length !== 1 || parent.sourceCandidateNameObservation !== expected.source) fail("SOURCE_CANDIDATE_INVALID");
    if (expected.method === "exact_normalized_reordered_official_house_name_same_district" && normalizedForward(expected.source!) !== normalizedForward(target.official)) fail("SOURCE_CANDIDATE_INVALID");
    if (expected.id === "me:identity:2022:01" && normalizedForward(expected.source!) !== "chellie m pingree") fail("SOURCE_CANDIDATE_INVALID");
    if (expected.district === "02" && expected.source !== null && normalizedForward(expected.source) !== "jared forrest golden") fail("SOURCE_CANDIDATE_INVALID");
    const linked = expected.source !== null;
    const unsigned = {
      observationId: expected.id, cycleYear: expected.year, electionDate: contest.electionDate,
      targetSeatId: target.seat, bioguideId: target.bioguide, officialHouseName: target.official,
      currentTargetDistrictCode: expected.district, sourceDistrictCode: expected.district,
      parentTargetObservationId: parent.observationId, parentTargetObservationSha256: parent.observationSha256,
      sourceContestId: contest.contestId, sourceContestSha256: contest.contestSha256,
      sourceCandidateCount: contest.candidates.length, sourceContestWorkbookCandidateVotes: contest.workbookCandidateVotes,
      sourceContestBlankVotes: contest.blankVotes, sourceContestTotalBallotsCast: contest.totalBallotsCast,
      sourceCandidateId: null, sourceCandidateName: expected.source, sourceCandidateVotes: expected.votes,
      sourceCandidateIdStatus: "source_workbook_has_no_direct_person_identifier" as const,
      identityStatus: linked ? "proposed_identity_link" as const : "current_incumbent_not_observed_in_source_candidate_set" as const,
      relationshipDisposition: linked ? "proposed_identity_link_pending_documented_review" as const : "not_linked_current_incumbent_not_observed" as const,
      directIdentifierBridgeAvailable: false as const, matchMethod: expected.method, evidenceClass: expected.evidence,
      confidence: linked ? "high" as const : "none" as const,
      resultAuthorityStatus: contest.resultAuthorityStatus, certificationStatus: contest.certificationStatus,
      sourceWinnerStatus: contest.sourceWinnerStatus, winnerSourceCandidateName: contest.winnerSourceCandidateName,
      sourceWinnerIdentityTreatment: linked ? "source_winner_state_retained_but_not_used_as_identity_evidence" as const : "retained_source_winner_is_not_current_incumbent_identity_evidence" as const,
      rcvFirstChoiceNamedCandidateDelta: contest.rankedChoice?.firstChoiceNamedCandidateDelta ?? null,
      rcvSourcePrecedenceResolution: contest.rankedChoice?.sourcePrecedenceResolution ?? null,
      winnerConclusion: null, nominationConclusion: null, identityApproved: false as const,
      geographyStatus: "separate_candidate_not_approved" as const, historicalGeographyCompatibilityClaim: null,
      selectionStatus: linked ? "unselected" as const : "not_selected_current_incumbent_not_observed" as const,
      evaluatorUse: "excluded_pending_identity_geography_disposition_classification_and_publication_review" as const,
      evaluatorValues: { priorPrimaryMargin: null, priorDemocraticPrimaryVotes: null, priorProgressivePrimaryShare: null },
      scoreEligible: false as const,
      rationaleCodes: expectedRationale(expected),
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:me-primary-identity-row:v1\0", unsigned) };
  });
  const summary = { targetSeats: 2 as const, observations: 6 as const, proposedIdentityLinks: 5 as const, exactNameObservations: 2 as const, derivedNameRelationships: 3 as const, currentIncumbentNonappearances: 1 as const, linkedCandidateVotes: observations.reduce((sum, row) => sum + (row.sourceCandidateVotes ?? 0), 0), sourceContestCandidates: observations.reduce((sum, row) => sum + row.sourceCandidateCount, 0), sourceContestWorkbookCandidateVotes: observations.reduce((sum, row) => sum + row.sourceContestWorkbookCandidateVotes, 0), directIdentifierBridges: 0 as const, sourceWinnerMarkers: observations.filter((row) => row.sourceWinnerStatus !== "not_marked_by_source").length, linkedSourceWinnerMarkers: observations.filter((row) => row.sourceCandidateName !== null && row.sourceWinnerStatus !== "not_marked_by_source").length, automaticallyApprovedRows: 0 as const, geographyApprovedRows: 0 as const, selectedRows: 0 as const, scoreEligibleRows: 0 as const, evaluatorNumericValues: 0 as const };
  if (summary.linkedCandidateVotes !== 266_438 || summary.sourceContestCandidates !== 9 || summary.sourceContestWorkbookCandidateVotes !== 345_162 || summary.sourceWinnerMarkers !== 1 || summary.linkedSourceWinnerMarkers !== 0) fail("SUMMARY_INVALID");
  const observationSetSha256 = digest("dsa-seats:me-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: MAINE_PRIMARY_IDENTITY_V1, version: 1 as const, generatedAt: "2026-08-07T09:30:00.000Z" as const, sourceCutoff: "2026-08-07" as const,
    reviewerOnly: true as const, publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_identity_geography_primary_disposition_classification_human_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: ["review_incumbent_candidate_identity", "review_historical_district_compatibility", "review_ranked_choice_primary_disposition_and_formula", "review_progressive_candidate_classification", "complete_human_data_review_and_publication_approval"] as const,
    inputs: {
      roster: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage },
      proposal: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[1], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      houseClerk: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[2], fileSha256: INPUTS.houseFile },
      congressLegislators: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[3], fileSha256: INPUTS.congressFile },
      receipt: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[4], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptContestSet, targetObservationSetSha256: INPUTS.receiptTargetSet },
    },
    methodology: EXPECTED_METHODOLOGY,
    summary, observations, observationSetSha256,
    decisionSupport: { decisionId: "approve-historic-primary-candidate-identity-resolution-v1" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const, status: "proposed" as const, recommendedResolution: "accept_two_exact_reordered_and_three_documented_middle_name_relationship_candidates_while_retaining_2026_me02_current_incumbent_nonappearance" as const, defaultAssumption: "exclude_all_rows_from_evaluator_until_identity_geography_disposition_classification_and_publication_review" as const, affectedObservationIds: observations.map((row) => row.observationId), proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId), nonappearanceObservationIds: observations.filter((row) => row.identityStatus !== "proposed_identity_link").map((row) => row.observationId), reviewerResolution: null, reviewer: null, reviewedAt: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:me-primary-identity-candidate:v1\0", unsigned) };
}

export type MainePrimaryIdentityCandidate = ReturnType<typeof buildMainePrimaryIdentityCandidate>;

export function validateMainePrimaryIdentityCandidate(value: MainePrimaryIdentityCandidate): MainePrimaryIdentityCandidate {
  const { packageSha256, ...unsigned } = value;
  const topKeys = ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "observations", "observationSetSha256", "decisionSupport", "packageSha256"].sort();
  const rowKeys = ["observationId", "cycleYear", "electionDate", "targetSeatId", "bioguideId", "officialHouseName", "currentTargetDistrictCode", "sourceDistrictCode", "parentTargetObservationId", "parentTargetObservationSha256", "sourceContestId", "sourceContestSha256", "sourceCandidateCount", "sourceContestWorkbookCandidateVotes", "sourceContestBlankVotes", "sourceContestTotalBallotsCast", "sourceCandidateId", "sourceCandidateName", "sourceCandidateVotes", "sourceCandidateIdStatus", "identityStatus", "relationshipDisposition", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "resultAuthorityStatus", "certificationStatus", "sourceWinnerStatus", "winnerSourceCandidateName", "sourceWinnerIdentityTreatment", "rcvFirstChoiceNamedCandidateDelta", "rcvSourcePrecedenceResolution", "winnerConclusion", "nominationConclusion", "identityApproved", "geographyStatus", "historicalGeographyCompatibilityClaim", "selectionStatus", "evaluatorUse", "evaluatorValues", "scoreEligible", "rationaleCodes", "rowSha256"].sort();
  const decisionKeys = ["decisionId", "lifecycle", "status", "recommendedResolution", "defaultAssumption", "affectedObservationIds", "proposedIdentityObservationIds", "nonappearanceObservationIds", "reviewerResolution", "reviewer", "reviewedAt"].sort();
  const set = digest("dsa-seats:me-primary-identity-row-set:v1\0", value.observations);
  const expectedIds = EXPECTED.map((row) => row.id);
  const expectedInputs = { roster: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage }, proposal: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[1], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, houseClerk: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[2], fileSha256: INPUTS.houseFile }, congressLegislators: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[3], fileSha256: INPUTS.congressFile }, receipt: { sourceLockId: MAINE_PRIMARY_IDENTITY_PARENTS[4], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptContestSet, targetObservationSetSha256: INPUTS.receiptTargetSet } };
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(topKeys) || value.schema !== MAINE_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-07T09:30:00.000Z" || value.sourceCutoff !== "2026-08-07" || !value.reviewerOnly || value.publicationEligible || value.defaultUse !== "exclude_from_evaluator_until_identity_geography_primary_disposition_classification_human_review_and_publication_approval" || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || canonicalJson(value.inputs) !== canonicalJson(expectedInputs) || canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(["review_incumbent_candidate_identity", "review_historical_district_compatibility", "review_ranked_choice_primary_disposition_and_formula", "review_progressive_candidate_classification", "complete_human_data_review_and_publication_approval"]) || canonicalJson(value.methodology) !== canonicalJson(EXPECTED_METHODOLOGY) || canonicalJson(Object.keys(value.decisionSupport).sort()) !== canonicalJson(decisionKeys) || value.decisionSupport.decisionId !== "approve-historic-primary-candidate-identity-resolution-v1" || value.decisionSupport.lifecycle !== "evidence_for_bound_existing_decision_not_an_independent_decision" || value.decisionSupport.status !== "proposed" || value.decisionSupport.recommendedResolution !== "accept_two_exact_reordered_and_three_documented_middle_name_relationship_candidates_while_retaining_2026_me02_current_incumbent_nonappearance" || value.decisionSupport.defaultAssumption !== "exclude_all_rows_from_evaluator_until_identity_geography_disposition_classification_and_publication_review" || value.decisionSupport.reviewerResolution !== null || value.decisionSupport.reviewer !== null || value.decisionSupport.reviewedAt !== null || canonicalJson(value.decisionSupport.affectedObservationIds) !== canonicalJson(expectedIds) || canonicalJson(value.decisionSupport.proposedIdentityObservationIds) !== canonicalJson(expectedIds.slice(0, 5)) || canonicalJson(value.decisionSupport.nonappearanceObservationIds) !== canonicalJson(expectedIds.slice(5)) || canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds) || canonicalJson(value.summary) !== canonicalJson({ targetSeats: 2, observations: 6, proposedIdentityLinks: 5, exactNameObservations: 2, derivedNameRelationships: 3, currentIncumbentNonappearances: 1, linkedCandidateVotes: 266438, sourceContestCandidates: 9, sourceContestWorkbookCandidateVotes: 345162, directIdentifierBridges: 0, sourceWinnerMarkers: 1, linkedSourceWinnerMarkers: 0, automaticallyApprovedRows: 0, geographyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0, evaluatorNumericValues: 0 })) fail("PACKAGE_INVARIANT_INVALID");
  for (let index = 0; index < value.observations.length; index += 1) {
    const row = value.observations[index]!, expected = EXPECTED[index]!, source = EXPECTED_SOURCE_FACTS[index]!;
    const { rowSha256, ...rest } = row;
    const target = TARGETS[expected.district];
    if (canonicalJson(Object.keys(row).sort()) !== canonicalJson(rowKeys) || rowSha256 !== digest("dsa-seats:me-primary-identity-row:v1\0", rest) || row.observationId !== expected.id || row.cycleYear !== expected.year || row.targetSeatId !== target.seat || row.bioguideId !== target.bioguide || row.officialHouseName !== target.official || row.currentTargetDistrictCode !== expected.district || row.sourceDistrictCode !== expected.district || row.parentTargetObservationId !== `me:target:${expected.year}:${expected.district}` || row.parentTargetObservationSha256 !== expected.parent || row.sourceContestId !== `me:${expected.year}:regular:us-house:${expected.district}:democratic` || row.sourceContestSha256 !== expected.contest || row.sourceCandidateName !== expected.source || row.sourceCandidateVotes !== expected.votes || row.matchMethod !== expected.method || row.evidenceClass !== expected.evidence || canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationale(expected)) || row.electionDate !== source[0] || row.sourceCandidateCount !== source[1] || row.sourceContestWorkbookCandidateVotes !== source[2] || row.sourceContestBlankVotes !== source[3] || row.sourceContestTotalBallotsCast !== source[4] || row.resultAuthorityStatus !== "maine_secretary_of_state_primary_tabulation_retained" || row.certificationStatus !== source[5] || row.sourceWinnerStatus !== source[6] || row.winnerSourceCandidateName !== source[7] || row.sourceCandidateId !== null || row.sourceCandidateIdStatus !== "source_workbook_has_no_direct_person_identifier" || row.directIdentifierBridgeAvailable || row.identityApproved || row.geographyStatus !== "separate_candidate_not_approved" || row.historicalGeographyCompatibilityClaim !== null || row.winnerConclusion !== null || row.nominationConclusion !== null || row.evaluatorUse !== "excluded_pending_identity_geography_disposition_classification_and_publication_review" || canonicalJson(row.evaluatorValues) !== canonicalJson({ priorPrimaryMargin: null, priorDemocraticPrimaryVotes: null, priorProgressivePrimaryShare: null }) || row.scoreEligible) fail("PACKAGE_INVARIANT_INVALID");
    if (expected.source === null ? row.identityStatus !== "current_incumbent_not_observed_in_source_candidate_set" || row.relationshipDisposition !== "not_linked_current_incumbent_not_observed" || row.sourceCandidateId !== null || row.confidence !== "none" || row.sourceWinnerStatus !== "explicit_rcv_summary_winner" || row.winnerSourceCandidateName !== "Dunlap, Matthew G." || row.sourceWinnerIdentityTreatment !== "retained_source_winner_is_not_current_incumbent_identity_evidence" || row.rcvFirstChoiceNamedCandidateDelta !== 81 || row.rcvSourcePrecedenceResolution !== null || row.selectionStatus !== "not_selected_current_incumbent_not_observed" : row.identityStatus !== "proposed_identity_link" || row.relationshipDisposition !== "proposed_identity_link_pending_documented_review" || row.confidence !== "high" || row.sourceWinnerStatus !== "not_marked_by_source" || row.winnerSourceCandidateName !== null || row.sourceWinnerIdentityTreatment !== "source_winner_state_retained_but_not_used_as_identity_evidence" || row.rcvFirstChoiceNamedCandidateDelta !== null || row.rcvSourcePrecedenceResolution !== null || row.selectionStatus !== "unselected") fail("PACKAGE_INVARIANT_INVALID");
  }
  if (value.observationSetSha256 !== set || (MAINE_PRIMARY_IDENTITY_SET_SHA256 && set !== MAINE_PRIMARY_IDENTITY_SET_SHA256) || packageSha256 !== digest("dsa-seats:me-primary-identity-candidate:v1\0", unsigned) || (MAINE_PRIMARY_IDENTITY_PACKAGE_SHA256 && packageSha256 !== MAINE_PRIMARY_IDENTITY_PACKAGE_SHA256)) fail("PACKAGE_INVARIANT_INVALID");
  return value;
}
