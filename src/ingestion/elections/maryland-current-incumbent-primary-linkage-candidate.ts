import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMarylandPrimaryResultsReceipt,
  type MarylandPrimaryResultsReceipt,
} from "./maryland-house-democratic-primary-results-receipt";

export const MARYLAND_PRIMARY_IDENTITY_V1 =
  "maryland-current-incumbent-primary-linkage-candidate-v1" as const;
export const MARYLAND_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256 =
  "7c6eee50760b4575d9bab1ae9def4c0a8680636b4a3e8d2d48160652881626fb";
export const MARYLAND_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 =
  "cb22b245da751503939a3b778cb9941696b815b6930da24359c85f2e94938269";
export const MARYLAND_PRIMARY_IDENTITY_PACKAGE_SHA256 =
  "c79fd8233aecd8ff2f2c0cb5cde0a7834df27bf818de1c346848d57727b4f16f";

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "0eb964436022b54e3e797bd8578687b2f0a506d8832200cdf33853fb2de2d59a",
  receiptPackage: "03876280eeb67b63462e568c243e7f015954ec48584f0c86aa0e03bc78025fae",
  receiptSet: "320cb49e83fb3df8266ffe0ef3600264a3a934bce4f926aea4d44693ec36d6f9",
} as const;

const TARGETS = [
  ["02", "O000176", "Johnny Olszewski, Jr."],
  ["03", "E000301", "Sarah Elfreth"],
  ["04", "I000058", "Glenn Ivey"],
  ["05", "H000874", "Steny H. Hoyer"],
  ["06", "M001232", "April McClain Delaney"],
  ["07", "M000687", "Kweisi Mfume"],
  ["08", "R000606", "Jamie Raskin"],
] as const;
const INHERITED_UNRESOLVED_GATES = [
  "retain_independent_final_result_certification",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "review_progressive_candidate_classification",
  "complete_human_data_review_and_publication_approval",
] as const;
const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: ["md-2022-democratic-primary-congressional-breakdown", "md-2024-democratic-primary-congressional-breakdown"],
} as const;
const OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "maryland-house-democratic-primary-results-2022-2024-v1",
] as const;
const OUTPUT_FILE_SHA256 = "632a49ca04113a66b075ac2fe5e9ac37c0af03d52d908297ac77316411f71324";
const OUTPUT_BYTE_SIZE = 34_294;

type MatchMethod =
  | "exact_normalized_official_house_name_same_district"
  | "derived_source_middle_initial_not_in_official_house_name_same_district"
  | "derived_official_middle_initial_not_in_source_name_same_district"
  | "derived_source_quoted_nickname_matches_official_first_name_same_district";
const EXPECTED_MATCHES: Readonly<Record<string, Readonly<{ sourceCandidateName: string; method: MatchMethod }>>> = {
  "2022:04": { sourceCandidateName: "Glenn F. Ivey", method: "derived_source_middle_initial_not_in_official_house_name_same_district" },
  "2022:05": { sourceCandidateName: "Steny Hoyer", method: "derived_official_middle_initial_not_in_source_name_same_district" },
  "2022:07": { sourceCandidateName: "Kweisi Mfume", method: "exact_normalized_official_house_name_same_district" },
  "2022:08": { sourceCandidateName: "Jamie Raskin", method: "exact_normalized_official_house_name_same_district" },
  "2024:02": { sourceCandidateName: "John \"Johnny O\" Olszewski, Jr.", method: "derived_source_quoted_nickname_matches_official_first_name_same_district" },
  "2024:03": { sourceCandidateName: "Sarah Elfreth", method: "exact_normalized_official_house_name_same_district" },
  "2024:04": { sourceCandidateName: "Glenn F. Ivey", method: "derived_source_middle_initial_not_in_official_house_name_same_district" },
  "2024:05": { sourceCandidateName: "Steny Hoyer", method: "derived_official_middle_initial_not_in_source_name_same_district" },
  "2024:06": { sourceCandidateName: "April McClain Delaney", method: "exact_normalized_official_house_name_same_district" },
  "2024:07": { sourceCandidateName: "Kweisi Mfume", method: "exact_normalized_official_house_name_same_district" },
  "2024:08": { sourceCandidateName: "Jamie Raskin", method: "exact_normalized_official_house_name_same_district" },
};

type SourceCandidate = Readonly<{
  sourceCandidateName: string;
  votes: number;
  sourceWinnerMarker: true;
  rowIdentity: string;
}>;
type Observation = Readonly<{
  observationId: string;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-07-19" | "2024-05-14";
  seatCycleId: string;
  districtCode: string;
  rosterIdentity: Readonly<{ bioguideId: string; officialHouseName: string; officialHouseMemberDataSha256: typeof INPUTS.houseFile }>;
  sourceCandidateCount: number;
  sourceContestCandidateVotes: number;
  sourceCandidate: SourceCandidate | null;
  identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod | null;
  evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
  confidence: "high" | null;
  relationshipDisposition: "proposed_identity_link_pending_documented_review" | "not_linked_no_unique_current_incumbent_candidate_same_district";
  resultAuthorityStatus: "state_board_official_result_candidate";
  certificationStatus: "not_independently_retained";
  sourceWinnerStatus: "marked_by_source";
  identityApproved: false;
  historicalGeographyStatus: "separate_candidate_not_approved";
  dispositionDecisionStatus: "unresolved";
  selectionStatus: "unselected_source_winner_marker_not_identity_or_review_approval";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type MarylandPrimaryIdentityCandidate = Readonly<{
  schema: typeof MARYLAND_PRIMARY_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T07:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    targetSeats: 7;
    contestObservations: 14;
    reportedCandidateRows: number;
    reportedCandidateVotes: number;
    proposedIdentityLinks: number;
    exactNameObservations: number;
    derivedNameRelationships: number;
    reportedContestNoUniqueMatch: number;
    directIdentifierBridges: 0;
    automaticallyApprovedRows: 0;
    selectedRows: 0;
    scoreEligibleRows: 0;
  }>;
  observations: readonly Observation[];
  observationSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type MarylandPrimaryIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  receipt: MarylandPrimaryResultsReceipt;
  receiptFileSha256: string;
  houseXml: string;
  houseFileSha256: string;
  congressJson: string;
  congressFileSha256: string;
  sourceLock: unknown;
}>;

const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`Maryland primary identity rejected: ${code}`); };
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
const parentProjection = (rows: readonly Observation[]) => rows.map((row) => ({
  observationId: row.observationId,
  contestId: row.contestId,
  contestSha256: row.contestSha256,
  cycleYear: row.cycleYear,
  seatCycleId: row.seatCycleId,
  districtCode: row.districtCode,
  rosterIdentity: row.rosterIdentity,
  sourceCandidateCount: row.sourceCandidateCount,
  sourceContestCandidateVotes: row.sourceContestCandidateVotes,
  sourceCandidate: row.sourceCandidate,
  identityStatus: row.identityStatus,
  matchMethod: row.matchMethod,
  resultAuthorityStatus: row.resultAuthorityStatus,
  certificationStatus: row.certificationStatus,
  sourceWinnerStatus: row.sourceWinnerStatus,
}));

export function buildMarylandPrimaryIdentityCandidate(input: MarylandPrimaryIdentityInput): MarylandPrimaryIdentityCandidate {
  if (input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile || sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateMarylandPrimaryResultsReceipt(input.receipt);
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    receipt.contests.some((row) => (row.cycleYear as number) === 2026) ||
    proposal.decisions.find((row) => row.decisionId === "approve-historic-primary-candidate-identity-resolution-v1")?.resolution !== null) {
    fail("PARENT_INVALID");
  }
  let people: Array<{ id?: { bioguide?: string } }>;
  try { people = JSON.parse(input.congressJson); } catch { return fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const memberBlocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", SOURCE_LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", SOURCE_LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", SOURCE_LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", SOURCE_LOCK_PARENTS.congress],
    ["maryland-house-democratic-primary-results-2022-2024-v1", INPUTS.receiptFile, "data/metadata/maryland-house-democratic-primary-results-2022-2024-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === MARYLAND_PRIMARY_IDENTITY_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !== "data/metadata/maryland-current-incumbent-primary-linkage-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const [districtCode, bioguideId, expectedOfficialName] of TARGETS) {
    const seatCycleId = `seat_house_md_${districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === bioguideId);
    if (rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== bioguideId || blocks.length !== 1 || matchingPeople.length !== 1 ||
      tag(blocks[0]!, "statedistrict") !== `MD${districtCode}` || tag(blocks[0]!, "official-name") !== expectedOfficialName) {
      fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    }
    const contests = receipt.contests.filter((contest) => contest.districtCode === districtCode);
    if (contests.length !== 2) fail("CONTEST_PARTITION_INVALID");
    for (const contest of contests) {
      if (contest.authority !== "Maryland State Board of Elections" || contest.resultStatus !== "state_board_official_result_candidate" ||
        contest.certificationStatus !== "not_independently_retained" ||
        contest.candidates.filter((candidate) => candidate.winnerMarker).length !== 1 ||
        contest.winnerSourceCandidateName !== contest.candidates.find((candidate) => candidate.winnerMarker)?.sourceCandidateName) {
        fail("CONTEST_STATUS_INVALID");
      }
      const expected = EXPECTED_MATCHES[`${contest.cycleYear}:${districtCode}`];
      const candidate = expected === undefined ? undefined : contest.candidates.find((row) => row.sourceCandidateName === expected.sourceCandidateName);
      if (expected !== undefined && (candidate === undefined || !candidate.winnerMarker)) fail("SOURCE_CANDIDATE_IDENTITY_INVALID");
      const sourceCandidate = candidate === undefined ? null : {
        sourceCandidateName: candidate.sourceCandidateName,
        votes: candidate.votes,
        sourceWinnerMarker: true as const,
        rowIdentity: digest("dsa-seats:md-primary-identity-source-candidate:v1\0", {
          contestId: contest.contestId, contestSha256: contest.contestSha256, ...candidate,
        }),
      };
      const exact = expected?.method === "exact_normalized_official_house_name_same_district";
      const unsigned = {
        observationId: `md:identity:${contest.cycleYear}:${districtCode}`,
        contestId: contest.contestId,
        contestSha256: contest.contestSha256,
        cycleYear: contest.cycleYear,
        electionDate: contest.electionDate,
        seatCycleId,
        districtCode,
        rosterIdentity: { bioguideId, officialHouseName: expectedOfficialName, officialHouseMemberDataSha256: INPUTS.houseFile },
        sourceCandidateCount: contest.candidates.length,
        sourceContestCandidateVotes: contest.candidateVotes,
        sourceCandidate,
        identityStatus: expected === undefined ? "reported_contest_no_unique_candidate_match" as const : "proposed_identity_link" as const,
        directIdentifierBridgeAvailable: false as const,
        matchMethod: expected?.method ?? null,
        evidenceClass: expected === undefined ? null : exact ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: expected === undefined ? null : "high" as const,
        relationshipDisposition: expected === undefined ? "not_linked_no_unique_current_incumbent_candidate_same_district" as const : "proposed_identity_link_pending_documented_review" as const,
        resultAuthorityStatus: contest.resultStatus,
        certificationStatus: contest.certificationStatus,
        sourceWinnerStatus: "marked_by_source" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        dispositionDecisionStatus: "unresolved" as const,
        selectionStatus: "unselected_source_winner_marker_not_identity_or_review_approval" as const,
        evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
        scoreEligible: false as const,
        rationaleCodes: expected === undefined
          ? ["reported_contest_no_unique_current_incumbent_candidate_match", "same_district_and_cycle", "predecessor_candidate_not_cross_linked", "source_winner_marker_not_identity_approval"]
          : [expected.method, "same_district_and_cycle", "finite_audited_name_relationship", "source_candidate_has_no_direct_person_identifier", "source_winner_marker_not_identity_approval"],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:md-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));
  const projectionSha256 = digest("dsa-seats:md-primary-identity-parent-projection:v1\0", parentProjection(observations));
  const observationSetSha256 = digest("dsa-seats:md-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: MARYLAND_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T07:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      roster: { sourceLockId: required[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: roster.rosterSha256 },
      proposal: { sourceLockId: required[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      houseClerk: { sourceLockId: required[2][0], fileSha256: INPUTS.houseFile },
      congressLegislators: { sourceLockId: required[3][0], fileSha256: INPUTS.congressFile },
      receipt: { sourceLockId: required[4][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
    },
    methodology: {
      scope: "seven_current_maryland_democratic_target_seats_times_two_retained_state_board_result_cycles",
      matchTreatment: "finite_audited_exact_and_three_narrow_derived_relationship_methods_no_fuzzy_matching",
      directIdentifierBridgeAvailable: false,
      sourceWinnerTreatment: "marked_by_source_preserved_as_fact_not_identity_or_review_approval",
      noMatchTreatment: "retain_contest_evidence_without_current_incumbent_identity_link",
      futureCycleTreatment: "zero_2026_rows_receipt_scope_is_2022_and_2024_only",
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      parentProjectionSha256: projectionSha256,
    },
    summary: {
      targetSeats: 7 as const,
      contestObservations: 14 as const,
      reportedCandidateRows: observations.reduce((sum, row) => sum + row.sourceCandidateCount, 0),
      reportedCandidateVotes: observations.reduce((sum, row) => sum + row.sourceContestCandidateVotes, 0),
      proposedIdentityLinks: observations.filter((row) => row.identityStatus === "proposed_identity_link").length,
      exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
      derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length,
      reportedContestNoUniqueMatch: observations.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length,
      directIdentifierBridges: 0 as const,
      automaticallyApprovedRows: 0 as const,
      selectedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    observations,
    observationSetSha256,
    decisionSupport: {
      decisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      status: "proposed",
      recommendedResolution: "accept_six_exact_and_five_narrow_derived_links_and_retain_three_predecessor_rows_as_explicit_no_matches",
      defaultAssumption: "exclude_all_fourteen_rows_from_evaluator_until_identity_and_geography_review",
      affectedObservationIds: observations.map((row) => row.observationId),
      proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId),
      noMatchObservationIds: observations.filter((row) => row.identityStatus !== "proposed_identity_link").map((row) => row.observationId),
      reviewerResolution: null,
      reviewer: null,
      reviewedAt: null,
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:md-primary-identity-candidate:v1\0", unsigned) };
}

export function assertMarylandPrimaryIdentitySemanticInvariants(value: MarylandPrimaryIdentityCandidate): void {
  if (value.schema !== MARYLAND_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T07:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)) fail("LIFECYCLE_INVALID");
  const expectedIds = [2022, 2024].flatMap((year) => TARGETS.map(([district]) => `md:identity:${year}:${district}`));
  if (value.observations.length !== 14 || canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    value.observations.some((row) => (row.cycleYear as number) === 2026 || row.districtCode === "01" || row.identityApproved || row.scoreEligible ||
      row.directIdentifierBridgeAvailable || row.resultAuthorityStatus !== "state_board_official_result_candidate" ||
      row.certificationStatus !== "not_independently_retained" || row.sourceWinnerStatus !== "marked_by_source" ||
      row.selectionStatus !== "unselected_source_winner_marker_not_identity_or_review_approval" ||
      row.sourceCandidate !== null && row.sourceCandidate.sourceWinnerMarker !== true)) fail("LIFECYCLE_INVALID");
  if (value.summary.targetSeats !== 7 || value.summary.contestObservations !== 14 || value.summary.reportedCandidateRows !== 84 ||
    value.summary.reportedCandidateVotes !== 1_210_215 || value.summary.proposedIdentityLinks !== 11 ||
    value.summary.exactNameObservations !== 6 || value.summary.derivedNameRelationships !== 5 ||
    value.summary.reportedContestNoUniqueMatch !== 3 || value.summary.directIdentifierBridges !== 0 ||
    value.summary.automaticallyApprovedRows !== 0 || value.summary.selectedRows !== 0 || value.summary.scoreEligibleRows !== 0) {
    fail("SUMMARY_INVALID");
  }
  if (value.observations.some((row) => {
    const unsigned = structuredClone(row) as { rowSha256?: string };
    delete unsigned.rowSha256;
    return row.rowSha256 !== digest("dsa-seats:md-primary-identity-row:v1\0", unsigned);
  }) || value.observationSetSha256 !== digest("dsa-seats:md-primary-identity-row-set:v1\0", value.observations)) fail("ROW_HASH_INVALID");
  const decision = value.decisionSupport as { status?: string; reviewerResolution?: unknown; reviewer?: unknown; reviewedAt?: unknown };
  if (decision.status !== "proposed" || decision.reviewerResolution !== null || decision.reviewer !== null || decision.reviewedAt !== null) fail("LIFECYCLE_INVALID");
}

export function validateMarylandPrimaryIdentityCandidate(value: unknown): MarylandPrimaryIdentityCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("PACKAGE_SHAPE_INVALID");
  const candidate = value as MarylandPrimaryIdentityCandidate;
  assertMarylandPrimaryIdentitySemanticInvariants(candidate);
  const { packageSha256, ...unsigned } = candidate;
  if (packageSha256 !== digest("dsa-seats:md-primary-identity-candidate:v1\0", unsigned)) fail("PACKAGE_HASH_INVALID");
  if ((candidate.methodology as { parentProjectionSha256?: string }).parentProjectionSha256 !== MARYLAND_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256) fail("PARENT_PROJECTION_INVALID");
  if (candidate.observationSetSha256 !== MARYLAND_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256) fail("OBSERVATION_SET_INVALID");
  if (candidate.packageSha256 !== MARYLAND_PRIMARY_IDENTITY_PACKAGE_SHA256) fail("PACKAGE_IDENTITY_INVALID");
  return candidate;
}
