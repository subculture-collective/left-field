import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateFloridaPrimaryReceipt,
  type FloridaPrimaryReceipt,
} from "./florida-house-democratic-primary-results-receipt";

export const FLORIDA_PRIMARY_IDENTITY_V1 =
  "florida-current-incumbent-primary-linkage-candidate-v1" as const;
export const FLORIDA_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256 =
  "8e9e2c530a196f613c57fc50417fc9fa0a71d1d8420ab0a7ef4440a525288f36";
export const FLORIDA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 =
  "220bdca66add6e79a35933ddc6ac918d169e24a47b8500daccb52c93f89c97fc";
export const FLORIDA_PRIMARY_IDENTITY_PACKAGE_SHA256 =
  "d92bbd35721c2fc40877c7a625bb4c1a85d23cd73fe6e3b0384dcb8dfae1fce3";

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "f817315d140d18de6ad29cb4b0cf604f9c2b2df9b1f3714a16b46f07d7717fb3",
  receiptPackage: "1240cd10778f3bf37acce392353b0dcc0d2deaad18b3cad5b753284cc874a2e8",
  receiptSet: "c866bf532a678bfe92c72b734386b2ae9318589e690ee96f0e4f1180e6a1df40",
} as const;

const TARGETS = [
  ["09", "S001200", "Darren Soto"],
  ["10", "F000476", "Maxwell Frost"],
  ["14", "C001066", "Kathy Castor"],
  ["22", "F000462", "Lois Frankel"],
  ["23", "M001217", "Jared Moskowitz"],
  ["24", "W000808", "Frederica S. Wilson"],
  ["25", "W000797", "Debbie Wasserman Schultz"],
] as const;
const INHERITED_UNRESOLVED_GATES = [
  "Independent reviewer approval is required before factual promotion.",
  "Absent district-cycle dispositions and current identity/geography mappings remain unresolved.",
  "The precinct ZIP and 2022 congressional recount overlay require a separate reconciliation package before use.",
] as const;
const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: [
    "house-democratic-primary-source-selection-proposal-20260804-v1",
    "fl-2022-primary-results-download-html",
    "fl-2022-house-democratic-primary-results-tsv",
    "fl-2024-primary-results-download-html",
    "fl-2024-house-democratic-primary-results-tsv",
    "fl-election-results-archive-snapshot-20260805",
    "fl-election-dates-snapshot-20260805",
    "fl-2026-primary-results-reporting-timeline-pdf",
    "fl-2026-primary-results-reporting-timeline-text",
  ],
} as const;
const OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "florida-house-democratic-primary-results-2022-2026-v1",
] as const;
const OUTPUT_FILE_SHA256 = "c71e77ba87f073c967edffdc564ac5cdaee19a285c55c4b72afb08a537d21b83";
const OUTPUT_BYTE_SIZE = 31_615;
const CYCLES = [2022, 2024] as const;
const SOURCE_UNOBSERVED = new Set([
  "2022:09", "2022:22",
  "2024:09", "2024:14", "2024:22", "2024:23", "2024:24",
]);

type MatchMethod =
  | "exact_normalized_official_house_name_same_district"
  | "derived_source_middle_name_not_in_official_house_name_same_district"
  | "derived_official_middle_initial_not_in_source_name_same_district";
type SourceCandidate = Readonly<{
  sourceCandidateName: string;
  votes: number;
  sourceWinnerMarker: null;
  rowIdentity: string;
}>;
type Observation = Readonly<{
  observationId: string;
  contestId: string | null;
  contestSha256: string | null;
  cycleYear: 2022 | 2024;
  electionDate: "2022-08-23" | "2024-08-20";
  seatCycleId: string;
  districtCode: string;
  rosterIdentity: Readonly<{
    bioguideId: string;
    officialHouseName: string;
    officialHouseMemberDataSha256: typeof INPUTS.houseFile;
  }>;
  sourceCandidateCount: number | null;
  sourceContestCandidateVotes: number | null;
  sourceCandidate: SourceCandidate | null;
  identityStatus: "proposed_identity_link" | "source_unobserved_district_cycle_unresolved";
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod | null;
  evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
  confidence: "high" | null;
  relationshipDisposition:
    | "proposed_identity_link_pending_documented_review"
    | "not_linked_no_reported_contest_disposition_unresolved";
  resultAuthorityStatus: "division_official_results_extract_retained" | null;
  certificationStatus: "official_results_flag_retained_no_separate_signed_certificate" | null;
  sourceWinnerStatus: "not_marked_by_source" | "not_applicable_source_unobserved";
  identityApproved: false;
  historicalGeographyStatus: "separate_candidate_not_approved";
  dispositionDecisionStatus: "unresolved";
  selectionStatus: "unselected_source_winner_unmarked" | "unselected_source_unobserved";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type FloridaPrimaryIdentityCandidate = Readonly<{
  schema: typeof FLORIDA_PRIMARY_IDENTITY_V1;
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
    targetSeats: 7;
    contestObservations: 14;
    reportedObservations: 7;
    sourceUnobservedObservations: 7;
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

export type FloridaPrimaryIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  receipt: FloridaPrimaryReceipt;
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
const fail = (code: string): never => { throw new Error(`Florida primary identity rejected: ${code}`); };
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

export function buildFloridaPrimaryIdentityCandidate(
  input: FloridaPrimaryIdentityInput,
): FloridaPrimaryIdentityCandidate {
  if (
    input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile || sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile
  ) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateFloridaPrimaryReceipt(input.receipt);
  if (
    roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    receipt.review.resolution !== null || receipt.summary.contests2026 !== 0 ||
    receipt.summary.unofficialResultRowsRetained !== 0 || receipt.contests.some((row) => (row.cycleYear as number) === 2026) ||
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
    ["florida-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/florida-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind ||
      canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === FLORIDA_PRIMARY_IDENTITY_V1);
  if (String(OUTPUT_FILE_SHA256).length === 0) {
    if (outputMatches.length !== 0) fail("SOURCE_LOCK_MISMATCH");
  } else if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
      "data/metadata/florida-current-incumbent-primary-linkage-candidate-v1.json" ||
      outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
      outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
      canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const [districtCode, bioguideId, expectedOfficialName] of TARGETS) {
    const seatCycleId = `seat_house_fl_${districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === bioguideId);
    if (rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== bioguideId || blocks.length !== 1 || matchingPeople.length !== 1 ||
      tag(blocks[0]!, "statedistrict") !== `FL${districtCode}` || tag(blocks[0]!, "official-name") !== expectedOfficialName) {
      fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    }
    const official = normalize(expectedOfficialName);
    for (const cycleYear of CYCLES) {
      const contests = receipt.contests.filter((contest) => contest.districtCode === districtCode && contest.cycleYear === cycleYear);
      const unobserved = SOURCE_UNOBSERVED.has(`${cycleYear}:${districtCode}`);
      if (contests.length !== (unobserved ? 0 : 1)) fail("CONTEST_PARTITION_INVALID");
      const electionDate = cycleYear === 2022 ? "2022-08-23" as const : "2024-08-20" as const;
      if (unobserved) {
        const unsigned = {
          observationId: `fl:identity:${cycleYear}:${districtCode}`,
          contestId: null,
          contestSha256: null,
          cycleYear,
          electionDate,
          seatCycleId,
          districtCode,
          rosterIdentity: { bioguideId, officialHouseName: expectedOfficialName, officialHouseMemberDataSha256: INPUTS.houseFile },
          sourceCandidateCount: null,
          sourceContestCandidateVotes: null,
          sourceCandidate: null,
          identityStatus: "source_unobserved_district_cycle_unresolved" as const,
          directIdentifierBridgeAvailable: false as const,
          matchMethod: null,
          evidenceClass: null,
          confidence: null,
          relationshipDisposition: "not_linked_no_reported_contest_disposition_unresolved" as const,
          resultAuthorityStatus: null,
          certificationStatus: null,
          sourceWinnerStatus: "not_applicable_source_unobserved" as const,
          identityApproved: false as const,
          historicalGeographyStatus: "separate_candidate_not_approved" as const,
          dispositionDecisionStatus: "unresolved" as const,
          selectionStatus: "unselected_source_unobserved" as const,
          evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
          scoreEligible: false as const,
          rationaleCodes: [
            "official_extract_has_no_reported_district_cycle_contest",
            "absence_not_interpreted_as_zero_votes_or_no_primary",
            "nonstandard_primary_disposition_unresolved",
          ],
        };
        observations.push({ ...unsigned, rowSha256: digest("dsa-seats:fl-primary-identity-row:v1\0", unsigned) });
        continue;
      }
      const contest = contests[0]!;
      if (contest.disposition !== "reported_contest" || contest.sourceWinnerStatus !== "not_marked_by_source" ||
        contest.winnerSourceCandidateName !== null || contest.resultAuthorityStatus !== "division_official_results_extract_retained" ||
        contest.certificationStatus !== "official_results_flag_retained_no_separate_signed_certificate") fail("CONTEST_STATUS_INVALID");
      const matches = contest.candidates.flatMap((candidate) => {
        const source = normalize(candidate.sourceCandidateName);
        let method: MatchMethod | null = source === official
          ? "exact_normalized_official_house_name_same_district" : null;
        if (source === "maxwell alejandro frost" && official === "maxwell frost") {
          method = "derived_source_middle_name_not_in_official_house_name_same_district";
        } else if (source === "frederica wilson" && official === "frederica s wilson") {
          method = "derived_official_middle_initial_not_in_source_name_same_district";
        }
        return method === null ? [] : [{ candidate, method }];
      });
      if (matches.length !== 1) fail("SOURCE_CANDIDATE_IDENTITY_AMBIGUOUS");
      const match = matches[0]!;
      const sourceCandidate = {
        sourceCandidateName: match.candidate.sourceCandidateName,
        votes: match.candidate.votes,
        sourceWinnerMarker: match.candidate.sourceWinnerMarker,
        rowIdentity: digest("dsa-seats:fl-primary-identity-source-candidate:v1\0", {
          contestId: contest.contestId, contestSha256: contest.contestSha256, ...match.candidate,
        }),
      };
      const unsigned = {
        observationId: `fl:identity:${contest.cycleYear}:${districtCode}`,
        contestId: contest.contestId,
        contestSha256: contest.contestSha256,
        cycleYear: contest.cycleYear,
        electionDate,
        seatCycleId,
        districtCode,
        rosterIdentity: { bioguideId, officialHouseName: expectedOfficialName, officialHouseMemberDataSha256: INPUTS.houseFile },
        sourceCandidateCount: contest.candidates.length,
        sourceContestCandidateVotes: contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
        sourceCandidate,
        identityStatus: "proposed_identity_link" as const,
        directIdentifierBridgeAvailable: false as const,
        matchMethod: match.method,
        evidenceClass: match.method === "exact_normalized_official_house_name_same_district"
          ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: "high" as const,
        relationshipDisposition: "proposed_identity_link_pending_documented_review" as const,
        resultAuthorityStatus: contest.resultAuthorityStatus,
        certificationStatus: contest.certificationStatus,
        sourceWinnerStatus: "not_marked_by_source" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        dispositionDecisionStatus: "unresolved" as const,
        selectionStatus: "unselected_source_winner_unmarked" as const,
        evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
        scoreEligible: false as const,
        rationaleCodes: [match.method, "same_district_and_cycle", "source_candidate_has_no_direct_person_identifier", "source_winner_unmarked_not_identity_approval"],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:fl-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));
  const projectionSha256 = digest("dsa-seats:fl-primary-identity-parent-projection:v1\0", parentProjection(observations));
  const observationSetSha256 = digest("dsa-seats:fl-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: FLORIDA_PRIMARY_IDENTITY_V1,
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
      scope: "seven_current_florida_democratic_target_seats_times_two_historic_cycles",
      sourceBallotNameOrder: "source_full_name_normalized_for_exact_comparison",
      directIdentifierBridgeAvailable: false,
      sourceWinnerTreatment: "source_does_not_mark_winner_and_no_winner_is_inferred",
      noMatchTreatment: "source_unobserved_district_cycle_blocks_remain_unresolved_not_zero_or_no_primary",
      futureCycleTreatment: "zero_2026_rows_unofficial_boundary_not_promoted",
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      parentProjectionSha256: projectionSha256,
    },
    summary: {
      targetSeats: 7 as const,
      contestObservations: 14 as const,
      reportedObservations: 7 as const,
      sourceUnobservedObservations: 7 as const,
      reportedCandidateRows: observations.reduce((sum, row) => sum + (row.sourceCandidateCount ?? 0), 0),
      reportedCandidateVotes: observations.reduce((sum, row) => sum + (row.sourceContestCandidateVotes ?? 0), 0),
      proposedIdentityLinks: observations.filter((row) => row.identityStatus === "proposed_identity_link").length,
      exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
      derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length,
      reportedContestNoUniqueMatch: 0,
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
      recommendedResolution: "accept_four_exact_and_three_derived_name_links_and_retain_seven_source_unobserved_rows_as_unresolved",
      defaultAssumption: "exclude_all_fourteen_rows_from_evaluator_until_identity_and_geography_review",
      affectedObservationIds: observations.map((row) => row.observationId),
      proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId),
      sourceUnobservedObservationIds: observations.filter((row) => row.identityStatus !== "proposed_identity_link").map((row) => row.observationId),
      reviewerResolution: null,
      reviewer: null,
      reviewedAt: null,
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:fl-primary-identity-candidate:v1\0", unsigned) };
}

export function assertFloridaPrimaryIdentitySemanticInvariants(value: FloridaPrimaryIdentityCandidate): void {
  if (value.schema !== FLORIDA_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T06:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)) fail("LIFECYCLE_INVALID");
  const expectedIds = TARGETS.flatMap(([district]) => CYCLES.map((cycle) => `fl:identity:${cycle}:${district}`)).sort(bytewise);
  if (value.observations.length !== 14 || new Set(value.observations.map((row) => row.observationId)).size !== 14 ||
    canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    value.observations.some((row) => row.cycleYear === (2026 as never))) fail("OBSERVATION_CLOSURE_INVALID");
  if (value.observations.some((row) => {
    const { rowSha256, ...unsigned } = row;
    return rowSha256 !== digest("dsa-seats:fl-primary-identity-row:v1\0", unsigned) || row.identityApproved || row.scoreEligible ||
      row.directIdentifierBridgeAvailable;
  })) fail("LIFECYCLE_INVALID");
  const links = value.observations.filter((row) => row.identityStatus === "proposed_identity_link");
  const unobserved = value.observations.filter((row) => row.identityStatus === "source_unobserved_district_cycle_unresolved");
  if (links.length !== 7 || links.some((row) => row.sourceCandidate === null || row.matchMethod === null || row.confidence !== "high" ||
    row.relationshipDisposition !== "proposed_identity_link_pending_documented_review" ||
    row.resultAuthorityStatus !== "division_official_results_extract_retained" ||
    row.certificationStatus !== "official_results_flag_retained_no_separate_signed_certificate" ||
    row.sourceWinnerStatus !== "not_marked_by_source" || row.selectionStatus !== "unselected_source_winner_unmarked") ||
    unobserved.length !== 7 || unobserved.some((row) => row.contestId !== null || row.contestSha256 !== null ||
      row.sourceCandidateCount !== null || row.sourceContestCandidateVotes !== null || row.sourceCandidate !== null ||
      row.matchMethod !== null || row.evidenceClass !== null || row.confidence !== null || row.resultAuthorityStatus !== null ||
      row.certificationStatus !== null || row.sourceWinnerStatus !== "not_applicable_source_unobserved" ||
      row.selectionStatus !== "unselected_source_unobserved" ||
      row.relationshipDisposition !== "not_linked_no_reported_contest_disposition_unresolved")) fail("SOURCE_CANDIDATE_FIELDS_INVALID");
  const expectedSummary = {
    targetSeats: 7, contestObservations: 14, reportedObservations: 7, sourceUnobservedObservations: 7,
    reportedCandidateRows: 27, reportedCandidateVotes: 393_063, proposedIdentityLinks: 7,
    exactNameObservations: 4, derivedNameRelationships: 3, reportedContestNoUniqueMatch: 0,
    directIdentifierBridges: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0,
  };
  if (canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  if ((value.methodology as { parentProjectionSha256?: string }).parentProjectionSha256 !==
    digest("dsa-seats:fl-primary-identity-parent-projection:v1\0", parentProjection(value.observations))) fail("PARENT_PROJECTION_INVALID");
}

export function validateFloridaPrimaryIdentityCandidate(
  value: FloridaPrimaryIdentityCandidate,
): FloridaPrimaryIdentityCandidate {
  assertFloridaPrimaryIdentitySemanticInvariants(value);
  const { packageSha256, ...unsigned } = value;
  const set = digest("dsa-seats:fl-primary-identity-row-set:v1\0", value.observations);
  if (packageSha256 !== FLORIDA_PRIMARY_IDENTITY_PACKAGE_SHA256 ||
    packageSha256 !== digest("dsa-seats:fl-primary-identity-candidate:v1\0", unsigned) ||
    value.observationSetSha256 !== FLORIDA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 || value.observationSetSha256 !== set ||
    (value.methodology as { parentProjectionSha256?: string }).parentProjectionSha256 !== FLORIDA_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256) {
    fail("PACKAGE_INVALID");
  }
  return value;
}

export const FLORIDA_PRIMARY_IDENTITY_OUTPUT_PARENTS = OUTPUT_PARENTS;
