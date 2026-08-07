import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMinnesotaPrimaryReceipt,
  type MinnesotaPrimaryReceipt,
} from "./minnesota-house-democratic-primary-results-receipt";

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "8ccf5fb90e7851e62a953a3e211db55fad0e5891b9178ff8186de0abf5b827d2",
  receiptPackage: "336094811277f867f5370b53f7b8568733a73a3d2c45b7fa4e5faa3071866e84",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
} as const;

const TARGETS = {
  "02": { seatCycleId: "seat_house_mn_02_current", bioguideId: "C001119", officialHouseName: "Angie Craig" },
  "03": { seatCycleId: "seat_house_mn_03_current", bioguideId: "M001234", officialHouseName: "Kelly Morrison" },
  "04": { seatCycleId: "seat_house_mn_04_current", bioguideId: "M001143", officialHouseName: "Betty McCollum" },
  "05": { seatCycleId: "seat_house_mn_05_current", bioguideId: "O000173", officialHouseName: "Ilhan Omar" },
} as const;
export const MINNESOTA_PRIMARY_IDENTITY_V1 = "minnesota-current-incumbent-primary-linkage-candidate-v1" as const;
export const MINNESOTA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 = "77f4eb4b2c3ff31d9e861c25a4e9eb66560f90860246f53c48a0afda23ac747c" as const;
export const MINNESOTA_PRIMARY_IDENTITY_PACKAGE_SHA256 = "77baabd12581f1880c811dc75ab77a79481ca9a5388a920f5ca30cc85b0c3a61" as const;
export const MINNESOTA_PRIMARY_IDENTITY_OUTPUT_FILE_SHA256 = "fd010c1e43a61f6973154e0bf1ffb0e7259c089cea56700158387888a54dd234" as const;
export const MINNESOTA_PRIMARY_IDENTITY_OUTPUT_BYTE_SIZE = 15_485 as const;
export const MINNESOTA_PRIMARY_IDENTITY_OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "minnesota-house-democratic-primary-results-2022-2026-v1",
] as const;
const UNRESOLVED_DECISIONS = [
  "approve-historic-primary-candidate-identity-resolution-v1",
  "decide-nonstandard-primary-disposition-treatment-v1",
] as const;
const INHERITED_UNRESOLVED_GATES = [
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "decide_nonstandard_primary_disposition_treatment",
  "review_progressive_candidate_classification",
  "complete_human_data_review_and_publication_approval",
] as const;

const REQUIRED_LOCK_ENTRIES = [
  ["dsa-target-incumbent-roster-20260804-v1", "urn:dsa-seats:dsa-target-incumbent-roster:v1:2026-08-04", "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", 21_001, INPUTS.rosterFile, "production_projection_receipt", ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"]],
  ["house-democratic-primary-source-selection-proposal-20260804-v1", "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411_793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  ["house-xml", "https://clerk.house.gov/xml/lists/MemberData.xml", "data/source/identity/house-member-data.xml", 556_140, INPUTS.houseFile, "source", []],
  ["congress-legislators-current-20260804", "https://unitedstates.github.io/congress-legislators/legislators-current.json", "data/source/identity/congress-legislators-current-20260804.json", 1_466_894, INPUTS.congressFile, "source", []],
  ["minnesota-house-democratic-primary-results-2022-2026-v1", "urn:dsa-seats:minnesota-house-democratic-primary-results:v1:2022-2026", "data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json", 30_489, INPUTS.receiptFile, "review_evidence_receipt", [
    "house-democratic-primary-source-selection-proposal-20260804-v1", "mn-2022-primary-results-landing", "mn-2022-primary-media-files-index", "mn-2022-primary-ushouse-results", "mn-2022-primary-candidate-table", "mn-2022-state-primary-canvass-document-record", "mn-2024-primary-results-landing", "mn-2024-primary-ushouse-results", "mn-2024-primary-candidate-table", "mn-2024-primary-media-file-layout", "mn-2024-state-primary-canvass-document-record", "mn-primary-date-and-omission-statute-204d03-20260806",
  ]],
] as const;

const EXPECTED_LINK_CLOSURE = [
  ["mn:identity:2022:02", 2022, "02", "seat_house_mn_02_current", "C001119", "Angie Craig", null, null, null, null, null],
  ["mn:identity:2022:03", 2022, "03", "seat_house_mn_03_current", "M001234", "Kelly Morrison", null, null, null, null, null],
  ["mn:identity:2022:04", 2022, "04", "seat_house_mn_04_current", "M001143", "Betty McCollum", "mn:2022:regular:us-house:04:dfl", "0dd26f681e7105750a815c105dbb4a23ef18dc6e033361012fcdd3ff837775c6", 3, 69_597, ["01070403", "Betty McCollum", 58_043, 83.4]],
  ["mn:identity:2022:05", 2022, "05", "seat_house_mn_05_current", "O000173", "Ilhan Omar", "mn:2022:regular:us-house:05:dfl", "9d79a673d9dc2c2f8c9b9c5239c98a8c9d9940d846acbcfbc04341bca6027b6c", 5, 114_567, ["01080405", "Ilhan Omar", 57_683, 50.35]],
  ["mn:identity:2024:02", 2024, "02", "seat_house_mn_02_current", "C001119", "Angie Craig", "mn:2024:regular:us-house:02:dfl", "ad731c6d6a6fefc2f4c90e942e456ab7d8596e86481a2237af76ebd593f371bb", 2, 29_514, ["01050401", "Angie Craig", 26_865, 91.02]],
  ["mn:identity:2024:03", 2024, "03", "seat_house_mn_03_current", "M001234", "Kelly Morrison", null, null, null, null, null],
  ["mn:identity:2024:04", 2024, "04", "seat_house_mn_04_current", "M001143", "Betty McCollum", "mn:2024:regular:us-house:04:dfl", "b1d9dae6713e5bc76c8b7acf169f5535623020465cf845ba85b1bc30b2780539", 1, 37_530, ["01070401", "Betty McCollum", 37_530, 100]],
  ["mn:identity:2024:05", 2024, "05", "seat_house_mn_05_current", "O000173", "Ilhan Omar", "mn:2024:regular:us-house:05:dfl", "fa5f5be4f0aea0d5a8e1dcc94b03fd07705afd27468a367c3bdd2ea948e8bf0c", 4, 120_801, ["01080401", "Ilhan Omar", 67_926, 56.23]],
] as const;

type Input = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  receipt: MinnesotaPrimaryReceipt;
  receiptFileSha256: string;
  houseXml: string;
  houseFileSha256: string;
  congressJson: string;
  congressFileSha256: string;
  sourceLock: unknown;
}>;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const normalize = (value: string): string => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fail = (code: string): never => { throw new Error(`Minnesota primary identity rejected: ${code}`); };

export function buildMinnesotaPrimaryIdentityCandidate(input: Input) {
  if (input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile || input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile || sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile) fail("INPUT_HASH_MISMATCH");

  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateMinnesotaPrimaryReceipt(input.receipt);
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage || UNRESOLVED_DECISIONS.some((decisionId) =>
      proposal.decisions.find((decision) => decision.decisionId === decisionId)?.resolution !== null)) fail("PARENT_INVALID");

  const lock = input.sourceLock as { entries?: Array<{ id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: string[] }> };
  if (!Array.isArray(lock.entries) || REQUIRED_LOCK_ENTRIES.some(([id, url, path, byteSize, hash, kind, parentIds]) => {
    const matches = lock.entries!.filter((entry) => entry.id === id);
    const entry = matches[0];
    return matches.length !== 1 || entry?.retainedStatus !== "retained" || entry.url !== url || entry.retainedPath !== path ||
      entry.byteSize !== byteSize || entry.sha256 !== hash || entry.kind !== kind ||
      canonicalJson(entry.parentIds) !== canonicalJson(parentIds);
  })) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries ?? fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === MINNESOTA_PRIMARY_IDENTITY_V1);
  const output = outputMatches[0];
  if (outputMatches.length !== 1 || output?.retainedStatus !== "retained" ||
    output.url !== "urn:dsa-seats:minnesota-current-incumbent-primary-linkage-candidate:v1:2022-2024" ||
    output.retainedPath !== "data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json" ||
    output.byteSize !== MINNESOTA_PRIMARY_IDENTITY_OUTPUT_BYTE_SIZE || output.sha256 !== MINNESOTA_PRIMARY_IDENTITY_OUTPUT_FILE_SHA256 ||
    output.kind !== "review_candidate" || canonicalJson(output.parentIds) !== canonicalJson(MINNESOTA_PRIMARY_IDENTITY_OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  let people: Array<{ id?: { bioguide?: string }; name?: { official_full?: string }; terms?: Array<{ type?: string; state?: string; district?: number }> }>;
  try { people = JSON.parse(input.congressJson); } catch { return fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("CONGRESS_JSON_INVALID");

  const houseMembers = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const houseTag = (block: string, name: string): string => block.match(new RegExp(`<${name}(?: [^>]*)?>([^<]*)<\/${name}>`))?.[1] ?? "";

  for (const [districtCode, target] of Object.entries(TARGETS)) {
    const rosterMatches = roster.rows.filter((row) => row.seatCycleId === target.seatCycleId && row.bioguideId === target.bioguideId);
    const peopleMatches = people.filter((person) => person.id?.bioguide === target.bioguideId);
    const currentTerm = peopleMatches[0]?.terms?.at(-1);
    const clerkMatches = houseMembers.filter((member) => houseTag(member, "bioguideID") === target.bioguideId);
    if (rosterMatches.length !== 1 || peopleMatches.length !== 1 || peopleMatches[0]?.name?.official_full !== target.officialHouseName ||
      currentTerm?.type !== "rep" || currentTerm.state !== "MN" || String(currentTerm.district).padStart(2, "0") !== districtCode ||
      clerkMatches.length !== 1 || houseTag(clerkMatches[0]!, "statedistrict") !== `MN${districtCode}` ||
      houseTag(clerkMatches[0]!, "official-name") !== target.officialHouseName) {
      fail("CURRENT_IDENTITY_INVALID");
    }
  }

  const contestById = new Map(receipt.sourceContests.map((contest) => [contest.contestId, contest]));
  const observations = receipt.targetObservations.map((parent) => {
    const target = TARGETS[parent.districtCode as keyof typeof TARGETS] ?? fail("TARGET_DISTRICT_INVALID");
    const contest = parent.sourceContestId === null ? null : contestById.get(parent.sourceContestId) ?? fail("SOURCE_CONTEST_MISSING");
    const matches = contest?.candidates.filter((candidate) => normalize(candidate.sourceCandidateName) === normalize(target.officialHouseName)) ?? [];
    if (contest !== null && matches.length !== 1) fail("SOURCE_CANDIDATE_MATCH_INVALID");
    const sourceCandidate = matches[0] === undefined ? null : {
      sourceCandidateId: matches[0].sourceCandidateId,
      sourceCandidateName: matches[0].sourceCandidateName,
      votes: matches[0].votes,
      sourcePercentage: matches[0].sourcePercentage,
    };
    const unsigned = {
      observationId: `mn:identity:${parent.cycleYear}:${parent.districtCode}`,
      cycleYear: parent.cycleYear,
      districtCode: parent.districtCode,
      seatCycleId: target.seatCycleId,
      rosterIdentity: { bioguideId: target.bioguideId, officialHouseName: target.officialHouseName },
      sourceContestId: contest?.contestId ?? null,
      sourceContestSha256: contest?.contestSha256 ?? null,
      sourceCandidateCount: contest?.candidates.length ?? null,
      sourceContestVotes: contest?.sourceTotalVotes ?? null,
      sourceCandidate,
      identityStatus: contest === null ? "source_absent_district_cycle_unresolved" as const : "proposed_identity_link" as const,
      directIdentifierBridgeAvailable: false as const,
      matchMethod: contest === null ? null : "exact_normalized_official_house_name_same_district" as const,
      evidenceClass: contest === null ? null : "exact_name_observation" as const,
      confidence: contest === null ? null : "high" as const,
      sourceAbsenceMeaning: parent.sourceAbsenceMeaning,
      sourcePartyCode: contest?.sourcePartyCode ?? null,
      resultAuthorityStatus: contest?.resultStatus ?? null,
      sourceWinnerStatus: contest?.sourceWinnerStatus ?? null,
      certificationStatus: contest === null ? null : "event_metadata_only_exact_report_bytes_not_retained" as const,
      relationshipDisposition: contest === null
        ? "not_linked_source_absent_without_candidate_record" as const
        : "proposed_identity_link_pending_documented_review" as const,
      identityApproved: false as const,
      selectionStatus: "unselected" as const,
      scoreEligible: false as const,
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:mn-primary-identity-row:v1\0", unsigned) };
  });
  const summary = {
    targetSeats: 4 as const,
    contestObservations: observations.length,
    reportedObservations: observations.filter((row) => row.sourceContestId !== null).length,
    sourceAbsentObservations: observations.filter((row) => row.sourceContestId === null).length,
    reportedCandidateRows: observations.reduce((sum, row) => sum + (row.sourceCandidateCount ?? 0), 0),
    reportedContestVotes: observations.reduce((sum, row) => sum + (row.sourceContestVotes ?? 0), 0),
    proposedIdentityLinks: observations.filter((row) => row.identityStatus === "proposed_identity_link").length,
    exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
    directIdentifierBridges: 0 as const,
    automaticallyApprovedRows: 0 as const,
    selectedRows: 0 as const,
    scoreEligibleRows: 0 as const,
  };
  const observationSetSha256 = digest("dsa-seats:mn-primary-identity-row-set:v1\0", observations);
  const unsigned = {
    schema: MINNESOTA_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T21:00:00.000Z" as const,
    sourceCutoff: "2026-08-06" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: receipt.unresolvedGates,
    inputs: {
      roster: { sourceLockId: REQUIRED_LOCK_ENTRIES[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage },
      proposal: { sourceLockId: REQUIRED_LOCK_ENTRIES[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      houseClerk: { sourceLockId: REQUIRED_LOCK_ENTRIES[2][0], fileSha256: INPUTS.houseFile },
      congressLegislators: { sourceLockId: REQUIRED_LOCK_ENTRIES[3][0], fileSha256: INPUTS.congressFile },
      receipt: { sourceLockId: REQUIRED_LOCK_ENTRIES[4][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, sourceContestSetSha256: receipt.summary.sourceContestSetSha256, targetObservationSetSha256: receipt.summary.targetObservationSetSha256 },
    },
    methodology: {
      scope: "four_current_minnesota_democratic_target_seats_times_two_historical_cycles",
      identityMethod: "exact_normalized_official_house_name_same_district_only",
      directIdentifierBridgeAvailable: false,
      sourceAbsenceTreatment: "retain_null_without_zero_no_primary_uncontested_nomination_or_predecessor_inference",
      sourceWinnerTreatment: "not_marked_by_source_no_vote_rank_inference",
      certificationTreatment: "event_metadata_only_exact_report_bytes_not_retained_no_candidate_certification_claim",
      rawPartyCode: "DFL",
      futureCycleTreatment: "zero_2026_rows_scheduled_primary_not_yet_occurred",
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
    },
    summary,
    observations,
    observationSetSha256,
    decisionSupport: {
      decisionId: "approve-historic-primary-candidate-identity-resolution-v1" as const,
      status: "proposed" as const,
      recommendedResolution: "accept_five_exact_same_district_name_links_and_retain_three_source_absences_as_unresolved",
      defaultAssumption: "exclude_all_eight_rows_from_evaluator_until_identity_geography_disposition_and_publication_review",
      affectedObservationIds: observations.map((row) => row.observationId),
      proposedIdentityObservationIds: observations.filter((row) => row.identityStatus === "proposed_identity_link").map((row) => row.observationId),
      sourceAbsentObservationIds: observations.filter((row) => row.identityStatus !== "proposed_identity_link").map((row) => row.observationId),
      reviewerResolution: null,
      reviewer: null,
      reviewedAt: null,
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:mn-primary-identity-candidate:v1\0", unsigned) };
}

export type MinnesotaPrimaryIdentityCandidate = ReturnType<typeof buildMinnesotaPrimaryIdentityCandidate>;

export function assertMinnesotaPrimaryIdentitySemanticInvariants(value: MinnesotaPrimaryIdentityCandidate): void {
  if (value.schema !== MINNESOTA_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T21:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-06" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null ||
    value.defaultUse !== "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval") fail("LIFECYCLE_INVALID");
  const expectedInputs = {
    roster: { sourceLockId: REQUIRED_LOCK_ENTRIES[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage },
    proposal: { sourceLockId: REQUIRED_LOCK_ENTRIES[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
    houseClerk: { sourceLockId: REQUIRED_LOCK_ENTRIES[2][0], fileSha256: INPUTS.houseFile },
    congressLegislators: { sourceLockId: REQUIRED_LOCK_ENTRIES[3][0], fileSha256: INPUTS.congressFile },
    receipt: { sourceLockId: REQUIRED_LOCK_ENTRIES[4][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, sourceContestSetSha256: "7c1b8fbf54488fa9d90a6598b9fa322e097ceea40e6d4fc6ec28b41d7be86ec5", targetObservationSetSha256: "8c373fa281d18f7bc686c168fc2b3c10cf75039cc7da54138d3f0b68fa92404d" },
  };
  const expectedDecisionSupport = {
    decisionId: "approve-historic-primary-candidate-identity-resolution-v1",
    status: "proposed",
    recommendedResolution: "accept_five_exact_same_district_name_links_and_retain_three_source_absences_as_unresolved",
    defaultAssumption: "exclude_all_eight_rows_from_evaluator_until_identity_geography_disposition_and_publication_review",
    affectedObservationIds: EXPECTED_LINK_CLOSURE.map((row) => row[0]),
    proposedIdentityObservationIds: EXPECTED_LINK_CLOSURE.filter((row) => row[6] !== null).map((row) => row[0]),
    sourceAbsentObservationIds: EXPECTED_LINK_CLOSURE.filter((row) => row[6] === null).map((row) => row[0]),
    reviewerResolution: null,
    reviewer: null,
    reviewedAt: null,
  };
  if (canonicalJson(value.inputs) !== canonicalJson(expectedInputs) ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(value.decisionSupport) !== canonicalJson(expectedDecisionSupport)) fail("PARENT_METADATA_INVALID");
  if (value.observations.length !== 8 || new Set(value.observations.map((row) => row.observationId)).size !== 8 ||
    value.observations.some((row) => row.identityApproved || row.scoreEligible || row.selectionStatus !== "unselected" || row.directIdentifierBridgeAvailable)) fail("LIFECYCLE_INVALID");
  if (value.observations.some((row) => {
    const { rowSha256, ...unsigned } = row;
    if (rowSha256 !== digest("dsa-seats:mn-primary-identity-row:v1\0", unsigned)) return true;
    if (row.identityStatus === "source_absent_district_cycle_unresolved") return row.sourceContestId !== null || row.sourceContestSha256 !== null ||
      row.sourceCandidateCount !== null || row.sourceContestVotes !== null || row.sourceCandidate !== null || row.matchMethod !== null ||
      row.evidenceClass !== null || row.confidence !== null || row.sourcePartyCode !== null || row.resultAuthorityStatus !== null ||
      row.sourceWinnerStatus !== null || row.certificationStatus !== null || row.relationshipDisposition !== "not_linked_source_absent_without_candidate_record" ||
      row.sourceAbsenceMeaning !== "not_zero_not_no_primary_not_uncontested_not_nominated";
    return row.sourceContestId === null || row.sourceContestSha256 === null || row.sourceCandidateCount === null || row.sourceContestVotes === null ||
      row.sourceCandidate === null || row.matchMethod !== "exact_normalized_official_house_name_same_district" || row.evidenceClass !== "exact_name_observation" ||
      row.confidence !== "high" || row.sourceAbsenceMeaning !== null || row.sourcePartyCode !== "DFL" ||
      row.resultAuthorityStatus !== "official_portal_reported_result_not_claimed_as_certified_result_bytes" || row.sourceWinnerStatus !== "not_marked_by_source" ||
      row.certificationStatus !== "event_metadata_only_exact_report_bytes_not_retained" || row.relationshipDisposition !== "proposed_identity_link_pending_documented_review";
  })) fail("OBSERVATION_INVALID");
  const linkClosure = value.observations.map((row) => [
    row.observationId, row.cycleYear, row.districtCode, row.seatCycleId, row.rosterIdentity.bioguideId,
    row.rosterIdentity.officialHouseName, row.sourceContestId, row.sourceContestSha256, row.sourceCandidateCount,
    row.sourceContestVotes, row.sourceCandidate === null ? null : [row.sourceCandidate.sourceCandidateId,
      row.sourceCandidate.sourceCandidateName, row.sourceCandidate.votes, row.sourceCandidate.sourcePercentage],
  ]);
  if (canonicalJson(linkClosure) !== canonicalJson(EXPECTED_LINK_CLOSURE)) fail("LINK_CLOSURE_INVALID");
  const expectedSummary = { targetSeats: 4, contestObservations: 8, reportedObservations: 5, sourceAbsentObservations: 3, reportedCandidateRows: 15, reportedContestVotes: 372_009, proposedIdentityLinks: 5, exactNameObservations: 5, directIdentifierBridges: 0, automaticallyApprovedRows: 0, selectedRows: 0, scoreEligibleRows: 0 };
  if (canonicalJson(value.summary) !== canonicalJson(expectedSummary) || value.methodology.rawPartyCode !== "DFL" ||
    value.methodology.sourceWinnerTreatment !== "not_marked_by_source_no_vote_rank_inference" ||
    value.methodology.certificationTreatment !== "event_metadata_only_exact_report_bytes_not_retained_no_candidate_certification_claim" ||
    value.methodology.automaticDecisionClosure || value.methodology.evaluatorNumericValues !== 0 ||
    value.decisionSupport.reviewerResolution !== null || value.decisionSupport.reviewer !== null || value.decisionSupport.reviewedAt !== null) fail("LIFECYCLE_INVALID");
}

export function validateMinnesotaPrimaryIdentityCandidate(value: MinnesotaPrimaryIdentityCandidate): MinnesotaPrimaryIdentityCandidate {
  assertMinnesotaPrimaryIdentitySemanticInvariants(value);
  const { packageSha256, ...unsigned } = value;
  if (value.observationSetSha256 !== digest("dsa-seats:mn-primary-identity-row-set:v1\0", value.observations) ||
    value.observationSetSha256 !== MINNESOTA_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:mn-primary-identity-candidate:v1\0", unsigned) ||
    packageSha256 !== MINNESOTA_PRIMARY_IDENTITY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}
