import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateTexasPrimaryResultsReceipt,
  type TexasPrimaryResultsReceipt,
} from "./texas-house-democratic-primary-results-receipt";

export const TEXAS_PRIMARY_EVENT_IDENTITY_V1 =
  "texas-current-incumbent-primary-event-identity-candidate-v1" as const;
export const TEXAS_PRIMARY_EVENT_IDENTITY_PARENT_PROJECTION_SHA256 =
  "aa907b1c0a796c4605f9136c32b0837933ec4300f612aae44f110b588a827548" as const;
export const TEXAS_PRIMARY_EVENT_IDENTITY_OBSERVATION_SET_SHA256 =
  "275727a0e383aebb71e15ee14791e331645d63ebe5d34d230a22d29fc6e51f86" as const;
export const TEXAS_PRIMARY_EVENT_IDENTITY_PACKAGE_SHA256 =
  "3c9b24b36e1544088a9b85a2ae20d9c972f8fdacd18f15311fe13a4fbc968f2f" as const;

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "fa5db68682dd7f3183e834e881ddac016833065c5424dc1c95b92cddb489488e",
  receiptPackage: "f010c5c0a4915d2c73feb46e7cf6617e109e1c7bfc6e1b94449e393410e809e1",
  receiptSet: "10ac515b35866e680ca1741a30136e364fbaffff0248c87648f85204c98eb9ba",
} as const;

const TARGETS = [
  ["07", "F000468", "Lizzie Fletcher"],
  ["09", "G000553", "Al Green"],
  ["16", "E000299", "Veronica Escobar"],
  ["18", "M001245", "Christian D. Menefee"],
  ["20", "C001091", "Joaquin Castro"],
  ["28", "C001063", "Henry Cuellar"],
  ["29", "G000587", "Sylvia R. Garcia"],
  ["30", "C001130", "Jasmine Crockett"],
  ["32", "J000310", "Julie Johnson"],
  ["33", "V000131", "Marc A. Veasey"],
  ["34", "G000581", "Vicente Gonzalez"],
  ["35", "C001131", "Greg Casar"],
  ["37", "D000399", "Lloyd Doggett"],
] as const;
const CYCLES = [2022, 2024, 2026] as const;
const STAGES = ["regular", "runoff"] as const;
const INHERITED_UNRESOLVED_GATES = [
  "retain_and_reconcile_exact_scope_final_certification_authority",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "decide_nonstandard_primary_disposition_treatment",
  "review_progressive_candidate_classification",
  "complete_human_data_review_and_publication_approval",
] as const;
const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: [
    "house-democratic-primary-source-selection-proposal-20260804-v1",
    "tx-2022-democratic-primary-official-canvass-pdf",
    "tx-2022-democratic-primary-official-canvass-text",
    "tx-2022-democratic-primary-runoff-official-canvass-pdf",
    "tx-2022-democratic-primary-runoff-official-canvass-text",
    "tx-2024-democratic-primary-official-canvass-pdf",
    "tx-2024-democratic-primary-official-canvass-text",
    "tx-2024-democratic-primary-runoff-official-canvass-pdf",
    "tx-2024-democratic-primary-runoff-official-canvass-text",
    "tx-2026-democratic-primary-official-canvass-pdf",
    "tx-2026-democratic-primary-official-canvass-text",
    "tx-2026-democratic-primary-runoff-official-canvass-pdf",
    "tx-2026-democratic-primary-runoff-official-canvass-text",
  ],
} as const;
const OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "texas-house-democratic-primary-results-2022-2026-v1",
] as const;
const OUTPUT_FILE_SHA256 = "f91d18b3163a610ee60d65519b3ece2e6b627c9a71ca32abd297abb26e256a95" as const;
const OUTPUT_BYTE_SIZE = 168_229 as const;

type MatchMethod =
  | "exact_normalized_official_house_name_same_district"
  | "derived_middle_initial_omission_same_district"
  | "derived_retained_public_alias_same_district"
  | "derived_retained_full_middle_name_same_district";
type Observation = Readonly<{
  observationId: string;
  eventId: string;
  cycleYear: 2022 | 2024 | 2026;
  electionStage: "regular" | "runoff";
  electionDate: string;
  seatCycleId: string;
  targetDistrictCode: string;
  rosterIdentity: Readonly<{
    bioguideId: string;
    officialHouseName: string;
    officialHouseMemberDataSha256: typeof INPUTS.houseFile;
  }>;
  sourceObservationStatus:
    | "reported_contest"
    | "not_observed_in_retained_official_canvass_report_disposition_unresolved";
  sourceContestId: string | null;
  sourceContestSha256: string | null;
  sourceDistrictCode: string | null;
  sourceCandidateCount: number | null;
  sourceContestCandidateVotes: number | null;
  sourceCandidate: Readonly<{
    sourceCandidateName: string;
    votes: number;
    canvassPercent: string;
    incumbentMarker: boolean;
    rowIdentity: string;
  }> | null;
  identityStatus:
    | "proposed_identity_link"
    | "reported_contest_no_unique_candidate_match"
    | "unobserved_district_event";
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod | null;
  evidenceClass: "exact_name_observation" | "derived_name_relationship" | null;
  confidence: "high" | null;
  relationshipDisposition:
    | "proposed_identity_link_pending_documented_review"
    | "not_linked_no_unique_current_incumbent_candidate_same_district"
    | "not_linked_no_reported_contest_disposition_unresolved";
  certificationStatus: "official_canvass_report_retained_certification_not_separately_bound";
  sourceWinnerStatus: "not_marked_by_source" | "not_applicable_unobserved_contest";
  identityApproved: false;
  historicalGeographyStatus: "separate_candidate_not_approved";
  dispositionDecisionStatus: "unresolved";
  selectionStatus: "unselected_no_source_winner_or_disposition_resolution";
  evaluatorUse: "excluded_pending_certification_identity_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type TexasCurrentIncumbentPrimaryEventIdentityCandidate = Readonly<{
  schema: typeof TEXAS_PRIMARY_EVENT_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T05:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_certification_identity_geography_disposition_classification_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    targetSeats: 13;
    eventObservations: 78;
    regularEventObservations: 39;
    runoffEventObservations: 39;
    reportedContestObservations: 44;
    reportedCandidateRows: 115;
    reportedCandidateVotes: 2_041_818;
    unobservedDistrictEventObservations: 34;
    proposedIdentityLinks: 33;
    exactNameObservations: 25;
    derivedNameRelationships: 8;
    reportedContestNoUniqueMatch: 11;
    regularIdentityCandidates: 30;
    runoffIdentityCandidates: 3;
    sourceIncumbentMarkedIdentityCandidates: 25;
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

export type TexasCurrentIncumbentPrimaryEventIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  receipt: TexasPrimaryResultsReceipt;
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
const fail = (code: string): never => {
  throw new Error(`Texas primary event identity rejected: ${code}`);
};
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (rows: readonly Observation[]) => rows.map((row) => ({
  observationId: row.observationId,
  eventId: row.eventId,
  cycleYear: row.cycleYear,
  electionStage: row.electionStage,
  seatCycleId: row.seatCycleId,
  targetDistrictCode: row.targetDistrictCode,
  rosterIdentity: row.rosterIdentity,
  sourceObservationStatus: row.sourceObservationStatus,
  sourceContestId: row.sourceContestId,
  sourceContestSha256: row.sourceContestSha256,
  sourceCandidateCount: row.sourceCandidateCount,
  sourceContestCandidateVotes: row.sourceContestCandidateVotes,
  sourceCandidate: row.sourceCandidate,
  identityStatus: row.identityStatus,
  matchMethod: row.matchMethod,
  certificationStatus: row.certificationStatus,
}));

export function buildTexasCurrentIncumbentPrimaryEventIdentityCandidate(
  input: TexasCurrentIncumbentPrimaryEventIdentityInput,
): TexasCurrentIncumbentPrimaryEventIdentityCandidate {
  if (
    input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile || sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile
  ) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateTexasPrimaryResultsReceipt(input.receipt);
  if (
    roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    proposal.decisions.find((row) => row.decisionId === "approve-historic-primary-candidate-identity-resolution-v1")?.resolution !== null ||
    proposal.decisions.find((row) => row.decisionId === "decide-nonstandard-primary-disposition-treatment-v1")?.resolution !== null
  ) fail("PARENT_INVALID");
  let people: Array<{ id?: { bioguide?: string; wikipedia?: string; ballotpedia?: string }; name?: { first?: string; middle?: string; last?: string; official_full?: string } }>;
  try {
    people = JSON.parse(input.congressJson);
  } catch {
    return fail("CONGRESS_JSON_INVALID");
  }
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const memberBlocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", SOURCE_LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", SOURCE_LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", SOURCE_LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", SOURCE_LOCK_PARENTS.congress],
    ["texas-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/texas-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind ||
      canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === TEXAS_PRIMARY_EVENT_IDENTITY_V1);
  if (
    outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
      "data/metadata/texas-current-incumbent-primary-event-identity-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)
  ) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const [districtCode, bioguideId, expectedOfficialName] of TARGETS) {
    const seatCycleId = `seat_house_tx_${districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === bioguideId);
    if (rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== bioguideId || blocks.length !== 1 || matchingPeople.length !== 1) {
      fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    }
    const officialHouseName = tag(blocks[0]!, "official-name");
    if (officialHouseName !== expectedOfficialName || tag(blocks[0]!, "statedistrict") !== `TX${districtCode}`) {
      fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    }
    const person = matchingPeople[0]!;
    const withoutMiddleInitial = normalize(officialHouseName).split(" ").filter((token) => token.length !== 1).join(" ");
    const publicAliases = new Set([person.id?.wikipedia ?? "", person.id?.ballotpedia ?? ""].map(normalize).filter(Boolean));
    const fullMiddleName = normalize([person.name?.first, person.name?.middle, person.name?.last].filter(Boolean).join(" "));
    for (const cycleYear of CYCLES) for (const electionStage of STAGES) {
      const coverage = receipt.eventCoverage.find((row) => row.cycleYear === cycleYear && row.electionStage === electionStage) ??
        fail("EVENT_COVERAGE_INVALID");
      const contests = receipt.contests.filter((row) =>
        row.cycleYear === cycleYear && row.electionStage === electionStage && row.districtCode === districtCode
      );
      const observed = coverage.observedDistrictCodes.includes(districtCode);
      if (contests.length !== (observed ? 1 : 0) || observed === coverage.unobservedDistrictCodes.includes(districtCode)) {
        fail("EVENT_COVERAGE_INVALID");
      }
      const contest = contests[0];
      const matches = contest?.candidates.flatMap((candidate) => {
        const source = normalize(candidate.sourceCandidateName);
        const matchMethod: MatchMethod | null = source === normalize(officialHouseName)
          ? "exact_normalized_official_house_name_same_district"
          : source === withoutMiddleInitial && source !== normalize(officialHouseName)
            ? "derived_middle_initial_omission_same_district"
            : publicAliases.has(source) && source !== normalize(officialHouseName)
              ? "derived_retained_public_alias_same_district"
              : source === fullMiddleName && source !== normalize(officialHouseName)
                ? "derived_retained_full_middle_name_same_district"
                : null;
        return matchMethod === null ? [] : [{ candidate, matchMethod }];
      }) ?? [];
      if (matches.length > 1) fail("SOURCE_CANDIDATE_IDENTITY_AMBIGUOUS");
      const match = matches[0];
      const identityStatus = contest === undefined
        ? "unobserved_district_event" as const
        : match === undefined
          ? "reported_contest_no_unique_candidate_match" as const
          : "proposed_identity_link" as const;
      const sourceCandidate = match === undefined ? null : {
        sourceCandidateName: match.candidate.sourceCandidateName,
        votes: match.candidate.votes,
        canvassPercent: match.candidate.canvassPercent,
        incumbentMarker: match.candidate.incumbentMarker,
        rowIdentity: digest("dsa-seats:tx-primary-event-identity-source-candidate:v1\0", {
          contestId: contest!.contestId,
          contestSha256: contest!.contestSha256,
          ...match.candidate,
        }),
      };
      const unsigned = {
        observationId: `tx:identity:${cycleYear}:${electionStage}:${districtCode}`,
        eventId: coverage.eventId,
        cycleYear,
        electionStage,
        electionDate: coverage.electionDate,
        seatCycleId,
        targetDistrictCode: districtCode,
        rosterIdentity: { bioguideId, officialHouseName, officialHouseMemberDataSha256: INPUTS.houseFile },
        sourceObservationStatus: contest === undefined
          ? "not_observed_in_retained_official_canvass_report_disposition_unresolved" as const
          : "reported_contest" as const,
        sourceContestId: contest?.contestId ?? null,
        sourceContestSha256: contest?.contestSha256 ?? null,
        sourceDistrictCode: contest?.districtCode ?? null,
        sourceCandidateCount: contest?.candidates.length ?? null,
        sourceContestCandidateVotes: contest?.candidateVotes ?? null,
        sourceCandidate,
        identityStatus,
        directIdentifierBridgeAvailable: false as const,
        matchMethod: match?.matchMethod ?? null,
        evidenceClass: match === undefined ? null : match.matchMethod.startsWith("exact_")
          ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: match === undefined ? null : "high" as const,
        relationshipDisposition: contest === undefined
          ? "not_linked_no_reported_contest_disposition_unresolved" as const
          : match === undefined
            ? "not_linked_no_unique_current_incumbent_candidate_same_district" as const
            : "proposed_identity_link_pending_documented_review" as const,
        certificationStatus: "official_canvass_report_retained_certification_not_separately_bound" as const,
        sourceWinnerStatus: contest === undefined ? "not_applicable_unobserved_contest" as const : "not_marked_by_source" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        dispositionDecisionStatus: "unresolved" as const,
        selectionStatus: "unselected_no_source_winner_or_disposition_resolution" as const,
        evaluatorUse: "excluded_pending_certification_identity_geography_disposition_classification_review_and_publication_approval" as const,
        scoreEligible: false as const,
        rationaleCodes: contest === undefined
          ? ["district_event_not_observed_disposition_unresolved", "absence_not_no_runoff_or_no_contest", "identity_not_inferred"]
          : match === undefined
            ? ["reported_contest_has_no_unique_current_incumbent_name_match", "predecessor_and_cross_district_substitution_forbidden", "identity_not_inferred"]
            : [match.matchMethod, "same_target_district_and_event", "source_has_no_direct_person_identifier", "source_winner_not_marked"],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:tx-primary-event-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));
  const count = (predicate: (row: Observation) => boolean) => observations.filter(predicate).length;
  const reportedCandidateRows = observations.reduce<number>(
    (sum, row) => sum + (row.sourceCandidateCount ?? 0),
    0,
  );
  const reportedCandidateVotes = observations.reduce<number>(
    (sum, row) => sum + (row.sourceContestCandidateVotes ?? 0),
    0,
  );
  if (
    observations.length !== 78 || count((row) => row.sourceObservationStatus === "reported_contest") !== 44 ||
    reportedCandidateRows !== 115 || reportedCandidateVotes !== 2_041_818 ||
    count((row) => row.identityStatus === "unobserved_district_event") !== 34 ||
    count((row) => row.identityStatus === "proposed_identity_link") !== 33 ||
    count((row) => row.identityStatus === "reported_contest_no_unique_candidate_match") !== 11 ||
    count((row) => row.evidenceClass === "exact_name_observation") !== 25 ||
    count((row) => row.evidenceClass === "derived_name_relationship") !== 8
  ) fail("OBSERVATION_CLOSURE_INVALID");
  const parentProjectionSha256 = digest("dsa-seats:tx-primary-event-identity-parent-projection:v1\0", parentProjection(observations));
  if (parentProjectionSha256 !== TEXAS_PRIMARY_EVENT_IDENTITY_PARENT_PROJECTION_SHA256) fail("PARENT_FACT_INVALID");
  const unsigned = {
    schema: TEXAS_PRIMARY_EVENT_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T05:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_certification_identity_geography_disposition_classification_review_and_publication_approval" as const,
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
      scope: "thirteen_current_texas_target_seats_times_three_cycles_times_regular_and_runoff_events",
      nameMatchingScope: "same_target_district_and_event_only",
      crossDistrictMatchingAllowed: false,
      maxVoteSelectionAllowed: false,
      incumbentMarkerSelectionAllowed: false,
      regularRunoffCollapseAllowed: false,
      automaticDecisionClosure: false,
      parentProjectionSha256,
      evaluatorNumericValues: 0,
    },
    summary: {
      targetSeats: 13 as const,
      eventObservations: 78 as const,
      regularEventObservations: 39 as const,
      runoffEventObservations: 39 as const,
      reportedContestObservations: 44 as const,
      reportedCandidateRows: reportedCandidateRows as 115,
      reportedCandidateVotes: reportedCandidateVotes as 2_041_818,
      unobservedDistrictEventObservations: 34 as const,
      proposedIdentityLinks: 33 as const,
      exactNameObservations: 25 as const,
      derivedNameRelationships: 8 as const,
      reportedContestNoUniqueMatch: 11 as const,
      regularIdentityCandidates: count((row) => row.electionStage === "regular" && row.identityStatus === "proposed_identity_link") as 30,
      runoffIdentityCandidates: count((row) => row.electionStage === "runoff" && row.identityStatus === "proposed_identity_link") as 3,
      sourceIncumbentMarkedIdentityCandidates: count((row) => row.sourceCandidate?.incumbentMarker === true) as 25,
      directIdentifierBridges: 0 as const,
      automaticallyApprovedRows: 0 as const,
      selectedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    observations,
    observationSetSha256: digest("dsa-seats:tx-primary-event-identity-row-set:v1\0", observations),
    decisionSupport: {
      identityDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      dispositionDecisionId: "decide-nonstandard-primary-disposition-treatment-v1",
      resolutions: { identity: null, disposition: null },
      lifecycle: "evidence_for_bound_existing_decisions_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:tx-primary-event-identity-candidate:v1\0", unsigned) };
}

export function validateTexasCurrentIncumbentPrimaryEventIdentityCandidate(
  value: TexasCurrentIncumbentPrimaryEventIdentityCandidate,
): TexasCurrentIncumbentPrimaryEventIdentityCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "observations", "observationSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== TEXAS_PRIMARY_EVENT_IDENTITY_V1 || value.version !== 1 || !value.reviewerOnly || value.publicationEligible ||
    value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null ||
    value.review.resolution !== null || value.observations.length !== 78 ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = TARGETS.flatMap(([district]) => CYCLES.flatMap((cycle) =>
    STAGES.map((stage) => `tx:identity:${cycle}:${stage}:${district}`)
  )).sort(bytewise);
  for (const [index, row] of value.observations.entries()) {
    exactKeys(row, ["observationId", "eventId", "cycleYear", "electionStage", "electionDate", "seatCycleId", "targetDistrictCode", "rosterIdentity", "sourceObservationStatus", "sourceContestId", "sourceContestSha256", "sourceDistrictCode", "sourceCandidateCount", "sourceContestCandidateVotes", "sourceCandidate", "identityStatus", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "relationshipDisposition", "certificationStatus", "sourceWinnerStatus", "identityApproved", "historicalGeographyStatus", "dispositionDecisionStatus", "selectionStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    exactKeys(row.rosterIdentity, ["bioguideId", "officialHouseName", "officialHouseMemberDataSha256"], "ROSTER_FIELDS_INVALID");
    if (row.sourceCandidate !== null) exactKeys(row.sourceCandidate, ["sourceCandidateName", "votes", "canvassPercent", "incumbentMarker", "rowIdentity"], "SOURCE_CANDIDATE_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    const target = TARGETS.find(([district]) => district === row.targetDistrictCode);
    const unobserved = row.identityStatus === "unobserved_district_event";
    const linked = row.identityStatus === "proposed_identity_link";
    if (
      rowSha256 !== digest("dsa-seats:tx-primary-event-identity-row:v1\0", unsignedRow) || !target ||
      row.observationId !== `tx:identity:${row.cycleYear}:${row.electionStage}:${row.targetDistrictCode}` ||
      row.eventId !== `tx:${row.cycleYear}:${row.electionStage}:democratic-primary` ||
      row.seatCycleId !== `seat_house_tx_${row.targetDistrictCode}_current` || row.rosterIdentity.bioguideId !== target[1] ||
      row.rosterIdentity.officialHouseName !== target[2] || row.rosterIdentity.officialHouseMemberDataSha256 !== INPUTS.houseFile ||
      row.directIdentifierBridgeAvailable || row.identityApproved || row.scoreEligible ||
      row.selectionStatus !== "unselected_no_source_winner_or_disposition_resolution" ||
      row.dispositionDecisionStatus !== "unresolved" || row.historicalGeographyStatus !== "separate_candidate_not_approved" ||
      row.certificationStatus !== "official_canvass_report_retained_certification_not_separately_bound" ||
      row.evaluatorUse !== "excluded_pending_certification_identity_geography_disposition_classification_review_and_publication_approval" ||
      (unobserved && (row.sourceObservationStatus !== "not_observed_in_retained_official_canvass_report_disposition_unresolved" ||
        row.sourceContestId !== null || row.sourceContestSha256 !== null || row.sourceDistrictCode !== null ||
        row.sourceCandidateCount !== null || row.sourceContestCandidateVotes !== null || row.sourceCandidate !== null ||
        row.matchMethod !== null || row.evidenceClass !== null ||
        row.confidence !== null || row.sourceWinnerStatus !== "not_applicable_unobserved_contest")) ||
      (!unobserved && (row.sourceObservationStatus !== "reported_contest" || row.sourceContestId === null ||
        row.sourceContestSha256 === null || row.sourceDistrictCode !== row.targetDistrictCode || row.sourceCandidateCount === null ||
        row.sourceContestCandidateVotes === null ||
        row.sourceWinnerStatus !== "not_marked_by_source")) ||
      (linked && (row.sourceCandidate === null || row.matchMethod === null || row.evidenceClass === null || row.confidence !== "high")) ||
      (!linked && row.sourceCandidate !== null) ||
      (index > 0 && bytewise(value.observations[index - 1]!.observationId, row.observationId) >= 0)
    ) fail("ROW_INVALID");
  }
  if (canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds)) fail("OBSERVATION_SET_INVALID");
  if (
    digest("dsa-seats:tx-primary-event-identity-parent-projection:v1\0", parentProjection(value.observations)) !==
      TEXAS_PRIMARY_EVENT_IDENTITY_PARENT_PROJECTION_SHA256
  ) fail("PARENT_FACT_INVALID");
  if (canonicalJson(value.summary) !== canonicalJson({
    targetSeats: 13, eventObservations: 78, regularEventObservations: 39, runoffEventObservations: 39,
    reportedContestObservations: 44, reportedCandidateRows: 115, reportedCandidateVotes: 2_041_818,
    unobservedDistrictEventObservations: 34, proposedIdentityLinks: 33,
    exactNameObservations: 25, derivedNameRelationships: 8, reportedContestNoUniqueMatch: 11,
    regularIdentityCandidates: 30, runoffIdentityCandidates: 3, sourceIncumbentMarkedIdentityCandidates: 25,
    directIdentifierBridges: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0,
  })) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.observationSetSha256 !== digest("dsa-seats:tx-primary-event-identity-row-set:v1\0", value.observations) ||
    value.observationSetSha256 !== TEXAS_PRIMARY_EVENT_IDENTITY_OBSERVATION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:tx-primary-event-identity-candidate:v1\0", unsigned) ||
    packageSha256 !== TEXAS_PRIMARY_EVENT_IDENTITY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
