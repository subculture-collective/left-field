import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateColoradoPrimaryResultsReceipt, type ColoradoPrimaryResultsReceipt } from "./colorado-house-democratic-primary-results-receipt";

export const COLORADO_PRIMARY_IDENTITY_V1 = "colorado-current-incumbent-primary-linkage-candidate-v1" as const;
export const COLORADO_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 = "2fe869fd9b90f549e47c0916eb02c4b9644584ecf4d95a4711015d570e056e9e" as const;
export const COLORADO_PRIMARY_IDENTITY_PACKAGE_SHA256 = "6d89eb3cfeba6da05abafd4daf710fea55d282291c19ea10b83abc2a1b4e6649" as const;
export const COLORADO_PRIMARY_IDENTITY_OUTPUT_FILE_SHA256 = "ece5bc2b4938fb8ef2c1d9716e7b0ce19057e7f9671fb4eaa4ec6304f4b5d04a" as const;
export const COLORADO_PRIMARY_IDENTITY_OUTPUT_BYTE_SIZE = 21_291 as const;
const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1", rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1", proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b", congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "9f06ea32b7ff7564829d163dbecbf6e78a61c2ebb95e3d31d3875d7a64027569", receiptPackage: "c5f2e3c5bda8b027b9879911e07a99d3623a656a5aa717a5408079dc15bf4b55", receiptSet: "b1619063732c5ea17bc37e473239abb18faa3dc948671420b98357e58fd26116",
} as const;
const TARGETS = [
  { districtCode: "01", seatCycleId: "seat_house_co_01_current", bioguideId: "D000197", officialHouseName: "Diana DeGette" },
  { districtCode: "02", seatCycleId: "seat_house_co_02_current", bioguideId: "N000191", officialHouseName: "Joe Neguse" },
  { districtCode: "06", seatCycleId: "seat_house_co_06_current", bioguideId: "C001121", officialHouseName: "Jason Crow" },
  { districtCode: "07", seatCycleId: "seat_house_co_07_current", bioguideId: "P000620", officialHouseName: "Brittany Pettersen" },
] as const;
const PARENTS = ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "colorado-house-democratic-primary-results-2022-2026-v1"] as const;
const REQUIRED = [
  [PARENTS[0], "urn:dsa-seats:dsa-target-incumbent-roster:v1:2026-08-04", "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", 21_001, INPUTS.rosterFile, "production_projection_receipt", ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"]],
  [PARENTS[1], "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411_793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  [PARENTS[2], "https://clerk.house.gov/xml/lists/MemberData.xml", "data/source/identity/house-member-data.xml", 556_140, INPUTS.houseFile, "source", []],
  [PARENTS[3], "https://unitedstates.github.io/congress-legislators/legislators-current.json", "data/source/identity/congress-legislators-current-20260804.json", 1_466_894, INPUTS.congressFile, "source", []],
  [PARENTS[4], "urn:dsa-seats:colorado-house-democratic-primary-results:v1:2022-2026", "data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json", 83_500, INPUTS.receiptFile, "review_evidence_receipt", ["co-2022-primary-certification-announcement", "co-2022-primary-signed-statewide-abstract", "co-2022-democratic-us-house-official-abstract", "co-2024-biennial-certified-abstract", "co-2024-democratic-us-house-normalized-transcription", "co-2026-primary-signed-statewide-abstract", "co-2026-democratic-us-house-normalized-transcription"]],
] as const;
type Input = Readonly<{ roster: unknown; rosterFileSha256: string; proposal: unknown; proposalFileSha256: string; houseXml: string; houseFileSha256: string; congressJson: string; congressFileSha256: string; receipt: ColoradoPrimaryResultsReceipt; receiptFileSha256: string; sourceLock: unknown }>;
const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const normalize = (value: string): string => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fail = (code: string): never => { throw new Error(`Colorado primary identity rejected: ${code}`); };
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`))?.[1] ?? "";

export function buildColoradoPrimaryIdentityCandidate(input: Input) {
  if (input.rosterFileSha256 !== INPUTS.rosterFile || input.proposalFileSha256 !== INPUTS.proposalFile || input.houseFileSha256 !== INPUTS.houseFile || input.congressFileSha256 !== INPUTS.congressFile || input.receiptFileSha256 !== INPUTS.receiptFile || sha(input.houseXml) !== INPUTS.houseFile || sha(input.congressJson) !== INPUTS.congressFile) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster), proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal), receipt = validateColoradoPrimaryResultsReceipt(input.receipt);
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet || ["approve-historic-primary-candidate-identity-resolution-v1", "decide-nonstandard-primary-disposition-treatment-v1"].some((id) => proposal.decisions.find((decision) => decision.decisionId === id)?.resolution !== null) || receipt.review.resolution !== null) fail("PARENT_INVALID");
  let people: Array<{ id?: { bioguide?: string }; name?: { official_full?: string }; terms?: Array<{ type?: string; state?: string; district?: number }> }>;
  try { people = JSON.parse(input.congressJson); } catch { return fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("CONGRESS_JSON_INVALID");
  const members = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = input.sourceLock as { entries?: Array<{ id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: string[] }> };
  if (!Array.isArray(lock.entries) || REQUIRED.some(([id, url, path, bytes, hash, kind, parents]) => { const matches = lock.entries!.filter((entry) => entry.id === id), entry = matches[0]; return matches.length !== 1 || entry?.url !== url || entry.retainedPath !== path || entry.retainedStatus !== "retained" || entry.byteSize !== bytes || entry.sha256 !== hash || entry.kind !== kind || canonicalJson(entry.parentIds) !== canonicalJson(parents); })) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries ?? fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === COLORADO_PRIMARY_IDENTITY_V1), output = outputMatches[0];
  if (outputMatches.length !== 1 || output?.url !== "urn:dsa-seats:colorado-current-incumbent-primary-linkage-candidate:v1:2022-2026" || output.retainedPath !== "data/metadata/colorado-current-incumbent-primary-linkage-candidate-v1.json" || output.retainedStatus !== "retained" || output.byteSize !== COLORADO_PRIMARY_IDENTITY_OUTPUT_BYTE_SIZE || output.sha256 !== COLORADO_PRIMARY_IDENTITY_OUTPUT_FILE_SHA256 || output.kind !== "review_candidate" || canonicalJson(output.parentIds) !== canonicalJson(PARENTS)) fail("SOURCE_LOCK_MISMATCH");
  for (const target of TARGETS) {
    const rosterMatches = roster.rows.filter((row) => row.seatCycleId === target.seatCycleId && row.bioguideId === target.bioguideId), personMatches = people.filter((person) => person.id?.bioguide === target.bioguideId), memberMatches = members.filter((member) => tag(member, "bioguideID") === target.bioguideId), currentTerm = personMatches[0]?.terms?.at(-1);
    if (rosterMatches.length !== 1 || personMatches.length !== 1 || personMatches[0]?.name?.official_full !== target.officialHouseName || currentTerm?.type !== "rep" || currentTerm.state !== "CO" || String(currentTerm.district).padStart(2, "0") !== target.districtCode || memberMatches.length !== 1 || tag(memberMatches[0]!, "statedistrict") !== `CO${target.districtCode}` || tag(memberMatches[0]!, "official-name") !== target.officialHouseName) fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
  }
  const observations = receipt.contests.filter((contest) => TARGETS.some((target) => target.districtCode === contest.districtCode)).map((contest) => {
    const target = TARGETS.find((candidate) => candidate.districtCode === contest.districtCode) ?? fail("TARGET_INVALID"), matches = contest.candidates.filter((candidate) => normalize(candidate.sourceCandidateName) === normalize(target.officialHouseName)), sourceCandidate = matches[0];
    if (matches.length !== 1 || sourceCandidate === undefined) fail("SOURCE_CANDIDATE_MATCH_INVALID");
    const unsigned = {
      observationId: `co:identity:${contest.cycleYear}:${contest.districtCode}`, contestId: contest.contestId, contestSha256: contest.contestSha256, cycleYear: contest.cycleYear, electionDate: contest.electionDate, districtCode: contest.districtCode, seatCycleId: target.seatCycleId,
      rosterIdentity: { bioguideId: target.bioguideId, officialHouseName: target.officialHouseName },
      sourceCandidate: { sourceCandidateName: sourceCandidate.sourceCandidateName, candidacyKind: sourceCandidate.candidacyKind, votes: sourceCandidate.votes },
      sourceCandidateCount: contest.candidates.length, sourceContestVotes: contest.sourceTotalVotes, resultAuthorityStatus: contest.resultAuthorityStatus, certificationStatus: contest.certificationStatus, sourceWinnerStatus: contest.sourceWinnerStatus,
      identityStatus: "proposed_identity_link" as const, directIdentifierBridgeAvailable: false as const, matchMethod: "exact_normalized_official_house_name_same_district" as const, evidenceClass: "exact_name_observation" as const, confidence: "high" as const, relationshipDisposition: "proposed_identity_link_pending_documented_review" as const,
      identityApproved: false as const, historicalGeographyStatus: "separate_candidate_not_approved" as const, evaluatorUse: "excluded_pending_authorized_identity_and_historical_geography_review" as const, scoreEligible: false as const,
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:co-primary-identity-row:v1\0", unsigned) };
  });
  if (observations.length !== 12) fail("OBSERVATION_CLOSURE_INVALID");
  const summary = { targetSeats: 4 as const, contestObservations: 12 as const, exactNameObservations: 12 as const, derivedNameRelationships: 0 as const, proposedIdentityLinks: 12 as const, directIdentifierBridges: 0 as const, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const };
  const unsigned = { schema: COLORADO_PRIMARY_IDENTITY_V1, version: 1 as const, generatedAt: "2026-08-06T23:30:00.000Z" as const, sourceCutoff: "2026-08-06" as const, reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null }, inputs: { roster: { sourceLockId: PARENTS[0], fileSha256: INPUTS.rosterFile, packageSha256: INPUTS.rosterPackage }, proposal: { sourceLockId: PARENTS[1], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, houseClerk: { sourceLockId: PARENTS[2], fileSha256: INPUTS.houseFile }, congressLegislators: { sourceLockId: PARENTS[3], fileSha256: INPUTS.congressFile }, receipt: { sourceLockId: PARENTS[4], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet } }, methodology: { scope: "four_current_colorado_target_seats_times_three_completed_primary_cycles" as const, currentIdentityCorroboratedByRosterHouseClerkAndCongressLegislators: true as const, identityMethod: "exact_normalized_official_house_name_same_district_only" as const, directIdentifierBridgeAvailable: false as const, sourceWinnerInferenceUsed: false as const, evaluatorNumericValues: 0 as const }, summary, observations, observationSetSha256: digest("dsa-seats:co-primary-identity-row-set:v1\0", observations), decisionSupport: { decisionId: "approve-historic-primary-candidate-identity-resolution-v1" as const, recommendedDecision: "accept_twelve_exact_same_district_name_observations_as_identity_candidates" as const, defaultReversibleAssumption: "exclude_all_observations_from_evaluator_and_publication" as const, resolution: null } };
  return { ...unsigned, packageSha256: digest("dsa-seats:co-primary-identity-package:v1\0", unsigned) };
}

export type ColoradoPrimaryIdentityCandidate = ReturnType<typeof buildColoradoPrimaryIdentityCandidate>;

const EXPECTED_IDS = ["co:identity:2022:01", "co:identity:2022:02", "co:identity:2022:06", "co:identity:2022:07", "co:identity:2024:01", "co:identity:2024:02", "co:identity:2024:06", "co:identity:2024:07", "co:identity:2026:01", "co:identity:2026:02", "co:identity:2026:06", "co:identity:2026:07"] as const;
const ROW_KEYS = ["observationId", "contestId", "contestSha256", "cycleYear", "electionDate", "districtCode", "seatCycleId", "rosterIdentity", "sourceCandidate", "sourceCandidateCount", "sourceContestVotes", "resultAuthorityStatus", "certificationStatus", "sourceWinnerStatus", "identityStatus", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "relationshipDisposition", "identityApproved", "historicalGeographyStatus", "evaluatorUse", "scoreEligible", "rowSha256"] as const;
const ROSTER_IDENTITY_KEYS = ["bioguideId", "officialHouseName"] as const;
const SOURCE_CANDIDATE_KEYS = ["sourceCandidateName", "candidacyKind", "votes"] as const;
const exactKeys = (value: object, expected: readonly string[]): boolean => canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
export function validateColoradoPrimaryIdentityCandidate(value: ColoradoPrimaryIdentityCandidate): ColoradoPrimaryIdentityCandidate {
  if (value.schema !== COLORADO_PRIMARY_IDENTITY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T23:30:00.000Z" || value.sourceCutoff !== "2026-08-06" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.decisionSupport.resolution !== null || value.observations.length !== 12) fail("LIFECYCLE_INVALID");
  for (const [index, row] of value.observations.entries()) {
    const unsigned = structuredClone(row) as Partial<typeof row>; delete unsigned.rowSha256;
    const authority = row.cycleYear === 2022 ? ["official_secretary_abstract", "certification_announcement_and_signed_statewide_abstract_retained"] : row.cycleYear === 2024 ? ["official_certified_biennial_abstract", "certified_publication_no_separate_signed_certificate_retained"] : ["signed_secretary_statewide_abstract", "signed_secretary_certificate_bound_to_abstract"];
    if (!exactKeys(row, ROW_KEYS)) fail("ROW_FIELDS_INVALID");
    if (!exactKeys(row.rosterIdentity, ROSTER_IDENTITY_KEYS) || !exactKeys(row.sourceCandidate, SOURCE_CANDIDATE_KEYS)) fail("NESTED_FIELDS_INVALID");
    if (row.observationId !== EXPECTED_IDS[index] || row.rowSha256 !== digest("dsa-seats:co-primary-identity-row:v1\0", unsigned) || row.identityStatus !== "proposed_identity_link" || row.directIdentifierBridgeAvailable || row.matchMethod !== "exact_normalized_official_house_name_same_district" || row.evidenceClass !== "exact_name_observation" || row.confidence !== "high" || row.relationshipDisposition !== "proposed_identity_link_pending_documented_review" || row.identityApproved || row.historicalGeographyStatus !== "separate_candidate_not_approved" || row.evaluatorUse !== "excluded_pending_authorized_identity_and_historical_geography_review" || row.scoreEligible || row.sourceWinnerStatus !== "not_marked_by_source" || row.resultAuthorityStatus !== authority[0] || row.certificationStatus !== authority[1]) fail("ROW_INVALID");
  }
  const expectedSummary = { targetSeats: 4, contestObservations: 12, exactNameObservations: 12, derivedNameRelationships: 0, proposedIdentityLinks: 12, directIdentifierBridges: 0, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  const unsigned = structuredClone(value) as Partial<ColoradoPrimaryIdentityCandidate>; delete unsigned.packageSha256;
  if (canonicalJson(value.summary) !== canonicalJson(expectedSummary) || value.observationSetSha256 !== digest("dsa-seats:co-primary-identity-row-set:v1\0", value.observations) || value.observationSetSha256 !== COLORADO_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 || value.packageSha256 !== digest("dsa-seats:co-primary-identity-package:v1\0", unsigned) || value.packageSha256 !== COLORADO_PRIMARY_IDENTITY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}
