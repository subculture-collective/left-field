import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateArizonaPrimaryReceipt,
  type ArizonaPrimaryReceipt,
} from "./arizona-house-democratic-primary-results-receipt";

export const ARIZONA_PRIMARY_IDENTITY_V1 =
  "arizona-current-incumbent-primary-linkage-candidate-v1" as const;
export const ARIZONA_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256 =
  "0d0c367a09739bade8e5677ce47ba4144dd5b78f7d730dc52c1983f8b3483ba8" as const;
export const ARIZONA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 =
  "e4bac18f0961d7fad61e7a90cfa9e8e2f7d7b64022a2898709b6c1a778a01913" as const;
export const ARIZONA_PRIMARY_IDENTITY_PACKAGE_SHA256 =
  "ba49c03b31206990f5427df19aa60daad3bc4ee05d2fbc92695cb939c1c29ea9" as const;

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "17f6148269291c59942b43f3f012c6f0396b0fc52ef7f0384c4c53762d755e36",
  receiptPackage: "119a76ada904d3d03e121ecce285841492654b02d24572cd3f2b690d974eb752",
  receiptSet: "98e56f97d7c18b72c36f89c5132f82de426cff7292437e4fed9dad10e6417548",
} as const;

const TARGETS = [
  ["03", "A000381", "Yassamin Ansari"],
  ["04", "S001211", "Greg Stanton"],
  ["07", "G000606", "Adelita S. Grijalva"],
] as const;
const INHERITED_UNRESOLVED_GATES = [
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "decide_nonstandard_primary_disposition_treatment",
  "review_progressive_candidate_classification",
  "acquire_separately_versioned_2026_certified_canvass_after_source_cutoff",
  "complete_human_data_review_and_publication_approval",
] as const;
const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: [
    "house-democratic-primary-source-selection-proposal-20260804-v1",
    "az-2022-primary-official-statewide-canvass-pdf",
    "az-2022-primary-official-statewide-canvass-text",
    "az-2024-primary-official-statewide-canvass-pdf",
    "az-2024-primary-official-statewide-canvass-ocr",
    "az-2024-cd03-primary-recount-report-pdf",
    "az-2024-cd03-primary-recount-report-ocr",
    "az-2024-cd03-primary-court-order-pdf",
    "az-2024-cd03-primary-court-order-ocr",
    "az-2026-primary-election-info-snapshot-20260805",
    "az-post-election-procedures-snapshot-20260805",
    "az-2024-cd03-primary-final-recount-table-transcription",
  ],
} as const;
const OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "arizona-house-democratic-primary-results-2022-2026-v1",
] as const;
const OUTPUT_FILE_SHA256 = "3ef6f3a9e8d63e74fc20086101e838fce02b177ee1b5fdf53220b26c396350fd" as const;
const OUTPUT_BYTE_SIZE = 16_580 as const;

type MatchMethod = "exact_normalized_official_house_name_same_district";
type SourceCandidate = Readonly<{
  sourceCandidateName: string;
  votes: number;
  sourceWinnerMarker: boolean | null;
  rowIdentity: string;
}>;
type Observation = Readonly<{
  observationId: string;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-08-02" | "2024-07-30";
  seatCycleId: string;
  districtCode: string;
  rosterIdentity: Readonly<{
    bioguideId: string;
    officialHouseName: string;
    officialHouseMemberDataSha256: typeof INPUTS.houseFile;
  }>;
  sourceCandidateCount: number;
  sourceContestCandidateVotes: number;
  aggregateWriteInVotes: number;
  sourceCandidate: SourceCandidate | null;
  identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod | null;
  evidenceClass: "exact_name_observation" | null;
  confidence: "high" | null;
  relationshipDisposition:
    | "proposed_identity_link_pending_documented_review"
    | "not_linked_no_unique_current_incumbent_candidate_same_district";
  resultAuthorityStatus: "certified_official_statewide_canvass" | "certified_final_recount_and_court_order";
  resultRevisionStatus: "initial_canvass_final_for_contest" | "final_recount_supersedes_initial_canvass";
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

export type ArizonaPrimaryIdentityCandidate = Readonly<{
  schema: typeof ARIZONA_PRIMARY_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T06:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    targetSeats: 3;
    contestObservations: 6;
    reportedCandidateRows: number;
    reportedCandidateVotes: number;
    proposedIdentityLinks: number;
    exactNameObservations: number;
    aggregateWriteInVotes: number;
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

export type ArizonaPrimaryIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  receipt: ArizonaPrimaryReceipt;
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
const normalize = (value: string): string =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fail = (code: string): never => { throw new Error(`Arizona primary identity rejected: ${code}`); };
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
  resultRevisionStatus: row.resultRevisionStatus,
  sourceWinnerStatus: row.sourceWinnerStatus,
}));

export function buildArizonaPrimaryIdentityCandidate(
  input: ArizonaPrimaryIdentityInput,
): ArizonaPrimaryIdentityCandidate {
  if (
    input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile || sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile
  ) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateArizonaPrimaryReceipt(input.receipt);
  if (
    roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    receipt.review.resolution !== null || receipt.contests.some((row) => (row.cycleYear as number) === 2026) ||
    proposal.decisions.find((row) => row.decisionId === "approve-historic-primary-candidate-identity-resolution-v1")?.resolution !== null ||
    proposal.decisions.find((row) => row.decisionId === "decide-nonstandard-primary-disposition-treatment-v1")?.resolution !== null
  ) fail("PARENT_INVALID");
  let people: Array<{ id?: { bioguide?: string }; name?: Record<string, string> }>;
  try { people = JSON.parse(input.congressJson); } catch { return fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const memberBlocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", SOURCE_LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", SOURCE_LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", SOURCE_LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", SOURCE_LOCK_PARENTS.congress],
    ["arizona-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/arizona-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind ||
      canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === ARIZONA_PRIMARY_IDENTITY_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/arizona-current-incumbent-primary-linkage-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const [districtCode, bioguideId, expectedOfficialName] of TARGETS) {
    const seatCycleId = `seat_house_az_${districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === bioguideId);
    if (rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== bioguideId || blocks.length !== 1 || matchingPeople.length !== 1 ||
      tag(blocks[0]!, "statedistrict") !== `AZ${districtCode}` || tag(blocks[0]!, "official-name") !== expectedOfficialName) {
      fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    }
    const official = normalize(expectedOfficialName);
    const contests = receipt.contests.filter((contest) => contest.districtCode === districtCode);
    if (contests.length !== 2) fail("CONTEST_PARTITION_INVALID");
    for (const contest of contests) {
      if (contest.disposition !== "reported_contest" || contest.sourceWinnerStatus !== "marked_by_source" ||
        contest.winnerSourceCandidateName === null ||
        !["certified_official_statewide_canvass", "certified_final_recount_and_court_order"].includes(contest.resultAuthorityStatus)) {
        fail("CONTEST_STATUS_INVALID");
      }
      const matches = contest.candidates.flatMap((candidate) => {
        const source = normalize(candidate.sourceCandidateName);
        const method: MatchMethod | null = source === official
          ? "exact_normalized_official_house_name_same_district"
          : null;
        return method === null ? [] : [{ candidate, method }];
      });
      if (matches.length > 1) fail("SOURCE_CANDIDATE_IDENTITY_AMBIGUOUS");
      const match = matches[0];
      const sourceCandidate = match === undefined ? null : {
        sourceCandidateName: match.candidate.sourceCandidateName,
        votes: match.candidate.votes,
        sourceWinnerMarker: match.candidate.sourceWinnerMarker,
        rowIdentity: digest("dsa-seats:az-primary-identity-source-candidate:v1\0", {
          contestId: contest.contestId, contestSha256: contest.contestSha256, ...match.candidate,
        }),
      };
      const unsigned = {
        observationId: `az:identity:${contest.cycleYear}:${districtCode}`,
        contestId: contest.contestId,
        contestSha256: contest.contestSha256,
        cycleYear: contest.cycleYear,
        electionDate: contest.electionDate,
        seatCycleId,
        districtCode,
        rosterIdentity: { bioguideId, officialHouseName: expectedOfficialName, officialHouseMemberDataSha256: INPUTS.houseFile },
        sourceCandidateCount: contest.candidates.length,
        sourceContestCandidateVotes: contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
        aggregateWriteInVotes: contest.aggregateWriteInVotes,
        sourceCandidate,
        identityStatus: match === undefined ? "reported_contest_no_unique_candidate_match" as const : "proposed_identity_link" as const,
        directIdentifierBridgeAvailable: false as const,
        matchMethod: match?.method ?? null,
        evidenceClass: match === undefined ? null : "exact_name_observation" as const,
        confidence: match === undefined ? null : "high" as const,
        relationshipDisposition: match === undefined
          ? "not_linked_no_unique_current_incumbent_candidate_same_district" as const
          : "proposed_identity_link_pending_documented_review" as const,
        resultAuthorityStatus: contest.resultAuthorityStatus,
        resultRevisionStatus: contest.resultRevisionStatus,
        sourceWinnerStatus: "marked_by_source" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        dispositionDecisionStatus: "unresolved" as const,
        selectionStatus: "unselected_source_winner_marker_not_identity_or_review_approval" as const,
        evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
        scoreEligible: false as const,
        rationaleCodes: match === undefined
          ? ["reported_contest_no_unique_current_incumbent_candidate_match", "same_district_and_cycle", "predecessor_or_other_candidate_not_cross_linked", "source_winner_marker_not_identity_approval"]
          : [match.method, "same_district_and_cycle", "source_candidate_has_no_direct_person_identifier", "source_winner_marker_not_identity_approval"],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:az-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));
  const projectionSha256 = digest("dsa-seats:az-primary-identity-parent-projection:v1\0", parentProjection(observations));
  const observationSetSha256 = digest("dsa-seats:az-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: ARIZONA_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T06:00:00.000Z" as const,
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
      scope: "three_current_arizona_democratic_target_seats_times_two_retained_certified_cycles",
      sourceBallotNameOrder: "source_full_name_normalized_for_exact_comparison",
      directIdentifierBridgeAvailable: false,
      sourceWinnerTreatment: "marked_by_source_preserved_as_fact_not_identity_or_review_approval",
      noMatchTreatment: "retain_contest_evidence_without_current_incumbent_identity_link",
      futureCycleTreatment: "zero_2026_rows_unofficial_boundary_not_promoted",
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      parentProjectionSha256: projectionSha256,
    },
    summary: {
      targetSeats: 3 as const,
      contestObservations: 6 as const,
      reportedCandidateRows: observations.reduce((sum, row) => sum + row.sourceCandidateCount, 0),
      reportedCandidateVotes: observations.reduce((sum, row) => sum + row.sourceContestCandidateVotes, 0),
      aggregateWriteInVotes: observations.reduce((sum, row) => sum + row.aggregateWriteInVotes, 0),
      proposedIdentityLinks: observations.filter((row) => row.identityStatus === "proposed_identity_link").length,
      exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
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
      recommendedResolution: "accept_three_exact_links_and_retain_three_predecessor_rows_as_explicit_no_matches",
      defaultAssumption: "exclude_all_six_rows_from_evaluator_until_identity_and_geography_review",
      affectedObservationIds: observations.map((row) => row.observationId),
      proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId),
      noMatchObservationIds: observations.filter((row) => row.identityStatus !== "proposed_identity_link").map((row) => row.observationId),
      reviewerResolution: null,
      reviewer: null,
      reviewedAt: null,
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:az-primary-identity-candidate:v1\0", unsigned) };
}

export function assertArizonaPrimaryIdentitySemanticInvariants(value: ArizonaPrimaryIdentityCandidate): void {
  if (value.schema !== ARIZONA_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T06:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)) fail("LIFECYCLE_INVALID");
  if (value.observations.length !== 6 || new Set(value.observations.map((row) => row.observationId)).size !== 6 ||
    value.observations.some((row) => row.cycleYear === (2026 as never))) fail("OBSERVATION_CLOSURE_INVALID");
  if (value.observations.some((row) => {
    const { rowSha256, ...unsigned } = row;
    return rowSha256 !== digest("dsa-seats:az-primary-identity-row:v1\0", unsigned) || row.identityApproved || row.scoreEligible ||
      row.directIdentifierBridgeAvailable || !["certified_official_statewide_canvass", "certified_final_recount_and_court_order"].includes(row.resultAuthorityStatus) ||
      row.sourceWinnerStatus !== "marked_by_source" || row.selectionStatus !== "unselected_source_winner_marker_not_identity_or_review_approval";
  })) fail("LIFECYCLE_INVALID");
  const links = value.observations.filter((row) => row.identityStatus === "proposed_identity_link");
  const misses = value.observations.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match");
  if (links.length !== 3 || links.some((row) => row.sourceCandidate === null || row.matchMethod === null || row.confidence !== "high" ||
    row.relationshipDisposition !== "proposed_identity_link_pending_documented_review") || misses.length !== 3 ||
    misses.some((row) => row.sourceCandidate !== null || row.matchMethod !== null || row.evidenceClass !== null || row.confidence !== null ||
      row.relationshipDisposition !== "not_linked_no_unique_current_incumbent_candidate_same_district")) fail("SOURCE_CANDIDATE_FIELDS_INVALID");
  const expectedSummary = {
    targetSeats: 3, contestObservations: 6, reportedCandidateRows: 8, reportedCandidateVotes: 318_970,
    aggregateWriteInVotes: 93, proposedIdentityLinks: 3, exactNameObservations: 3, reportedContestNoUniqueMatch: 3,
    directIdentifierBridges: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0,
  };
  if (canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  if ((value.methodology as { parentProjectionSha256?: string }).parentProjectionSha256 !==
    digest("dsa-seats:az-primary-identity-parent-projection:v1\0", parentProjection(value.observations))) fail("PARENT_PROJECTION_INVALID");
}

export function validateArizonaPrimaryIdentityCandidate(
  value: ArizonaPrimaryIdentityCandidate,
): ArizonaPrimaryIdentityCandidate {
  assertArizonaPrimaryIdentitySemanticInvariants(value);
  const { packageSha256, ...unsigned } = value;
  const set = digest("dsa-seats:az-primary-identity-row-set:v1\0", value.observations);
  if (packageSha256 !== ARIZONA_PRIMARY_IDENTITY_PACKAGE_SHA256 ||
    packageSha256 !== digest("dsa-seats:az-primary-identity-candidate:v1\0", unsigned) ||
    value.observationSetSha256 !== ARIZONA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 || value.observationSetSha256 !== set ||
    (value.methodology as { parentProjectionSha256?: string }).parentProjectionSha256 !== ARIZONA_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256) {
    fail("PACKAGE_INVALID");
  }
  return value;
}

export const ARIZONA_PRIMARY_IDENTITY_OUTPUT_PARENTS = OUTPUT_PARENTS;
