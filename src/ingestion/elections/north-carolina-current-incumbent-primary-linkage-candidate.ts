/* eslint-disable @typescript-eslint/no-explicit-any -- persisted reviewer inputs are validated against exact source closures */
import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNcPrimaryReceipt } from "./north-carolina-house-democratic-primary-results-receipt";
import { validateNcPrimarySourcePrecedenceDecision } from "./north-carolina-primary-source-precedence-decision";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";

export const NC_PRIMARY_IDENTITY_V1 = "north-carolina-current-incumbent-primary-linkage-candidate-v1" as const;
export const NC_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 = "b587a7f2b181d11d24be10404ecd7f79879522b434a521ebf08065c6b88d4ba0";
export const NC_PRIMARY_IDENTITY_PACKAGE_SHA256 = "12fbecfa848ba85aa39d426d94a8be4ab3f77fc1356f6c0a288514037f9c4d76";
const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  rosterPackage: "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "a171f1940bf9445413a9b0ff88889408271779c954e00dbd0b4b52013e1f5d7b",
  receiptPackage: "8bf12709c58542550b29f94c36ae9337100755bb0d04a4459eef77a845908480",
  receiptSet: "a806b720b724df1b40a6570e4316c5f5c479a0f0e9fdeae31dd6342355e816dc",
  precedenceFile: "8e319f999027bc30cb0c6a22f01700e2c4982459709e3122e34c80a051ab99d6",
  precedencePackage: "ac12f3e95d0e3dab4a7e94c0b2b2b552e62790abac59d32b10ac16e89f9b01eb",
} as const;
const TARGETS = [
  { district: "01", bioguide: "D000230" },
  { district: "02", bioguide: "R000305" },
  { district: "04", bioguide: "F000477" },
  { district: "12", bioguide: "A000370" },
] as const;
const CYCLES = [2022, 2024, 2026] as const;
const EXPECTED_REPORTED = {
  "2022:01": ["nc:2022:regular:us-house:01:democratic", "6121b37104df57ef69ce99bf3cb9d26153ca8124060e2d1773c86a24763d9e9c", "Don Davis", 42693, "derived_common_short_form_same_district"],
  "2022:04": ["nc:2022:regular:us-house:04:democratic", "4461cfd2e96abcfc049d9f4c0fdf6e8e1980a65ddd1087535248546b80bdaca8", "Valerie P. Foushee", 40806, "exact_normalized_official_house_name_same_district"],
  "2022:12": ["nc:2022:regular:us-house:12:democratic", "0bc99e13ca76dddab42fb3be10ba76b46d0739e4fbc9acccba7c8146b46c13ce", "Alma S. Adams", 37984, "exact_normalized_official_house_name_same_district"],
  "2024:02": ["nc:2024:regular:us-house:02:democratic", "16eb9fa9e1c11c91b2d3ed0e76692d754393287b0988711a2ab3fda6d25f90e6", "Deborah K. Ross", 69564, "exact_normalized_official_house_name_same_district"],
  "2026:04": ["nc:2026:regular:us-house:04:democratic", "6d96517857fefb804754a16a2e477986800a840609b21d518b68902de1446f21", "Valerie P. Foushee", 61776, "exact_normalized_official_house_name_same_district"],
  "2026:12": ["nc:2026:regular:us-house:12:democratic", "1b8dd2ad697e25443c3e746bcd0e8918cc8892996ba6f331490782143acf095e", "Alma Shealey Adams", 54630, "derived_middle_name_expansion_same_district"],
} as const;

type MatchMethod = "exact_normalized_official_house_name_same_district" | "derived_common_short_form_same_district" | "derived_middle_name_expansion_same_district" | "not_applicable_unreported_district_cycle";
type Observation = Readonly<{
  observationId: string;
  seatCycleId: string;
  districtCode: string;
  cycleYear: 2022 | 2024 | 2026;
  rosterIdentity: Readonly<{ bioguideId: string; officialHouseName: string; officialHouseMemberDataSha256: string }>;
  sourceObservation: Readonly<{ kind: "reported_contest"; contestId: string; contestSha256: string; contestSourceLockIds: readonly string[]; resultAuthorityStatus: string; candidateCount: number; sourceCandidateName: string; sourceCandidateId: null; votes: number; sourceWinnerStatus: "not_marked_by_source" }> | Readonly<{ kind: "unreported_district_cycle_block"; districtCycleId: string; status: "unresolved_no_reported_contest_in_complete_archive" }>;
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod;
  evidenceClass: "exact_name_observation" | "derived_name_relationship" | "unresolved";
  confidence: "high" | "none";
  relationshipDisposition: "proposed_identity_link_pending_documented_review" | "not_linked_no_reported_contest";
  identityApproved: false;
  sourcePrecedenceStatus: "unresolved_conflict_outside_this_observation" | "not_applicable_other_cycle";
  historicalGeographyStatus: "separate_redraw_review_required";
  evaluatorUse: "excluded_pending_authorized_identity_and_historical_geography_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;
export type NcPrimaryIdentityCandidate = Readonly<{
  schema: typeof NC_PRIMARY_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T02:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: any;
  methodology: any;
  summary: Readonly<{ targetSeats: 4; districtCycleObservations: 12; reportedContestObservations: 6; unreportedDistrictCycleObservations: 6; exactNameObservations: 4; derivedNameRelationships: 2; proposedIdentityLinks: 6; directIdentifierBridges: 0; automaticallyApprovedRows: 0; scoreEligibleRows: 0 }>;
  observations: readonly Observation[];
  observationSetSha256: string;
  decisionSupport: any;
  packageSha256: string;
}>;
type Input = Readonly<{ roster: unknown; rosterFileSha256: string; proposal: unknown; proposalFileSha256: string; houseXml: string; houseFileSha256: string; congressJson: string; congressFileSha256: string; receipt: unknown; receiptFileSha256: string; precedence: unknown; precedenceFileSha256: string; sourceLock: unknown }>;
const sha = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const norm = (value: string): string => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fail = (code: string): never => { throw new Error(`North Carolina primary identity rejected: ${code}`); };
const exactKeys = (value: object, keys: readonly string[], code: string): void => { const actual = Object.keys(value).sort(bytewise); if (canonicalJson(actual) !== canonicalJson([...keys].sort(bytewise))) fail(code); };
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
const cycleStatus = (cycleYear: number): Observation["sourcePrecedenceStatus"] => cycleYear === 2022 ? "unresolved_conflict_outside_this_observation" : "not_applicable_other_cycle";

export function buildNcPrimaryIdentityCandidate(input: Input): NcPrimaryIdentityCandidate {
  const hashes = [input.rosterFileSha256, input.proposalFileSha256, input.houseFileSha256, input.congressFileSha256, input.receiptFileSha256, input.precedenceFileSha256, sha(input.houseXml), sha(input.congressJson)];
  const expectedHashes = [INPUTS.rosterFile, INPUTS.proposalFile, INPUTS.houseFile, INPUTS.congressFile, INPUTS.receiptFile, INPUTS.precedenceFile, INPUTS.houseFile, INPUTS.congressFile];
  if (hashes.some((value, index) => value !== expectedHashes[index])) fail("INPUT_HASH_MISMATCH");
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateNcPrimaryReceipt(input.receipt);
  const precedence = validateNcPrimarySourcePrecedenceDecision(input.precedence);
  const decision = proposal.decisions.find((value) => value.decisionId === "approve-historic-primary-candidate-identity-resolution-v1");
  const dispositionDecision = proposal.decisions.find((value) => value.decisionId === "decide-nonstandard-primary-disposition-treatment-v1");
  if (roster.rosterSha256 !== INPUTS.rosterPackage || proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptSet || precedence.packageSha256 !== INPUTS.precedencePackage || !decision || decision.resolution !== null || !dispositionDecision || dispositionDecision.resolution !== null || receipt.review.resolution !== null || precedence.resolution.status !== "proposed" || precedence.resolution.decision !== null || precedence.resolution.reviewer !== null || precedence.resolution.reviewedAt !== null) fail("PARENT_INVALID");

  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt"],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal"],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source"],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source"],
    ["north-carolina-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/north-carolina-house-democratic-primary-results-2022-2026-v1.json", "review_candidate"],
    ["north-carolina-primary-source-precedence-decision-v1", INPUTS.precedenceFile, "data/metadata/north-carolina-primary-source-precedence-decision-v1.json", "review_proposal"],
  ] as const;
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; sha256: string; kind: string }> };
  if (!Array.isArray(lock.entries) || required.some(([id, file, path, kind]) => { const matches = lock.entries!.filter((entry) => entry.id === id); return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file || matches[0]!.retainedPath !== path || matches[0]!.kind !== kind; })) fail("SOURCE_LOCK_MISMATCH");

  const rosterRows = roster.rows;
  let people: Array<{ id?: { bioguide?: string; wikipedia?: string }; name?: { first?: string; middle?: string; last?: string; official_full?: string } }> = [];
  try { people = JSON.parse(input.congressJson); } catch { fail("CONGRESS_JSON_INVALID"); }
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const blocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const observations: Observation[] = [];
  for (const target of TARGETS) {
    const seatCycleId = `seat_house_nc_${target.district}_current`;
    const matchingRoster = rosterRows.filter((row) => row.seatCycleId === seatCycleId);
    const matchingBlocks = blocks.filter((block) => tag(block, "bioguideID") === target.bioguide);
    const matchingPeople = people.filter((person) => person.id?.bioguide === target.bioguide);
    if (matchingRoster.length !== 1 || matchingRoster[0]!.bioguideId !== target.bioguide || matchingBlocks.length !== 1 || matchingPeople.length !== 1 || tag(matchingBlocks[0]!, "statedistrict") !== `NC${target.district}`) fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    const block = matchingBlocks[0]!, person = matchingPeople[0]!, official = tag(block, "official-name"), first = tag(block, "firstname"), middle = tag(block, "middlename"), last = tag(block, "lastname");
    const aliases = new Set([official, `${first} ${last}`, person.name?.official_full ?? "", `${first} ${middle.slice(0, 1)} ${last}`].map(norm).filter(Boolean));
    const retainedWikipediaAlias = (person.id?.wikipedia ?? "").replace(/\s+\([^()]+\)$/, "");
    for (const cycleYear of CYCLES) {
      const contests = receipt.contests.filter((row: any) => row.cycleYear === cycleYear && row.districtCode === target.district);
      const unresolved = receipt.unresolvedBlocks.filter((row: any) => row.cycleYear === cycleYear && row.districtCode === target.district);
      if (contests.length + unresolved.length !== 1) fail("OBSERVATION_PARTITION_INVALID");
      const base = { observationId: `nc:identity:${cycleYear}:${target.district}`, seatCycleId, districtCode: target.district, cycleYear, rosterIdentity: { bioguideId: target.bioguide, officialHouseName: official, officialHouseMemberDataSha256: INPUTS.houseFile }, directIdentifierBridgeAvailable: false as const, identityApproved: false as const, sourcePrecedenceStatus: cycleStatus(cycleYear), historicalGeographyStatus: "separate_redraw_review_required" as const, evaluatorUse: "excluded_pending_authorized_identity_and_historical_geography_review" as const, scoreEligible: false as const };
      if (contests.length === 1) {
        const contest = contests[0]!, candidates = contest.candidates as Array<{ sourceCandidateName: string; votes: number }>;
        const matched = candidates.filter((candidate) => aliases.has(norm(candidate.sourceCandidateName)) || (target.bioguide === "D000230" && norm(candidate.sourceCandidateName) === norm(retainedWikipediaAlias) && retainedWikipediaAlias === "Don Davis") || (target.bioguide === "A000370" && norm(candidate.sourceCandidateName) === "alma shealey adams" && middle.startsWith("S")));
        if (matched.length !== 1) fail("CANDIDATE_MATCH_INVALID");
        const candidate = matched[0]!;
        const matchMethod: MatchMethod = norm(candidate.sourceCandidateName) === norm(official) ? "exact_normalized_official_house_name_same_district" : target.bioguide === "D000230" ? "derived_common_short_form_same_district" : "derived_middle_name_expansion_same_district";
        const unsigned = { ...base, sourceObservation: { kind: "reported_contest" as const, contestId: contest.contestId, contestSha256: contest.contestSha256, contestSourceLockIds: contest.sourceLockIds, resultAuthorityStatus: contest.resultAuthorityStatus, candidateCount: candidates.length, sourceCandidateName: candidate.sourceCandidateName, sourceCandidateId: null, votes: candidate.votes, sourceWinnerStatus: "not_marked_by_source" as const }, matchMethod, evidenceClass: matchMethod.startsWith("exact_") ? "exact_name_observation" as const : "derived_name_relationship" as const, confidence: "high" as const, relationshipDisposition: "proposed_identity_link_pending_documented_review" as const, rationaleCodes: [matchMethod, "same_district_and_cycle", "source_candidate_has_no_direct_person_identifier", "source_winner_status_not_marked", cycleYear === 2022 ? "parent_source_conflict_affects_other_contests_only" : "parent_cycle_has_no_source_precedence_conflict"] };
        observations.push({ ...unsigned, rowSha256: digest("dsa-seats:nc-primary-identity-row:v1\0", unsigned) });
      } else {
        const blockRow = unresolved[0]!;
        const unsigned = { ...base, sourceObservation: { kind: "unreported_district_cycle_block" as const, districtCycleId: blockRow.districtCycleId, status: "unresolved_no_reported_contest_in_complete_archive" as const }, matchMethod: "not_applicable_unreported_district_cycle" as const, evidenceClass: "unresolved" as const, confidence: "none" as const, relationshipDisposition: "not_linked_no_reported_contest" as const, rationaleCodes: ["complete_archive_contains_no_reported_contest_for_district_cycle", "do_not_infer_uncontested_or_no_primary", "no_source_candidate_to_link"] };
        observations.push({ ...unsigned, rowSha256: digest("dsa-seats:nc-primary-identity-row:v1\0", unsigned) });
      }
    }
  }
  observations.sort((a, b) => bytewise(a.observationId, b.observationId));
  const unsigned = {
    schema: NC_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T02:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: { roster: { sourceLockId: required[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: INPUTS.rosterPackage }, proposal: { sourceLockId: required[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, identityDecisionUnresolved: true as const, dispositionDecisionUnresolved: true as const }, houseClerk: { sourceLockId: required[2][0], fileSha256: INPUTS.houseFile }, congressLegislators: { sourceLockId: required[3][0], fileSha256: INPUTS.congressFile }, receipt: { sourceLockId: required[4][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet }, sourcePrecedenceDecision: { sourceLockId: required[5][0], fileSha256: INPUTS.precedenceFile, packageSha256: INPUTS.precedencePackage, status: "proposed_unresolved" as const, affectedContestIds: ["nc:2022:regular:us-house:03:democratic", "nc:2022:regular:us-house:11:democratic"] as const, affectsTargetIdentityRows: false as const } },
    methodology: { scope: "four_current_north_carolina_democratic_target_seats_times_three_cycles" as const, observationPartition: "one_reported_contest_or_explicit_unreported_block_per_seat_cycle" as const, directIdentifierBridgeAvailable: false as const, automaticDecisionClosure: false as const, evaluatorNumericValues: 0 as const },
    summary: { targetSeats: 4 as const, districtCycleObservations: 12 as const, reportedContestObservations: observations.filter((row) => row.sourceObservation.kind === "reported_contest").length as 6, unreportedDistrictCycleObservations: observations.filter((row) => row.sourceObservation.kind === "unreported_district_cycle_block").length as 6, exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length as 4, derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length as 2, proposedIdentityLinks: observations.filter((row) => row.relationshipDisposition === "proposed_identity_link_pending_documented_review").length as 6, directIdentifierBridges: 0 as const, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const },
    observations,
    observationSetSha256: digest("dsa-seats:nc-primary-identity-row-set:v1\0", observations),
    decisionSupport: { informsDecisionId: "approve-historic-primary-candidate-identity-resolution-v1" as const, analysisConclusion: "four_exact_and_two_derived_identity_links_proposed_six_unreported_cycles_preserved_unresolved" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const },
  };
  return validateNcPrimaryIdentityCandidate({ ...unsigned, packageSha256: digest("dsa-seats:nc-primary-identity-candidate:v1\0", unsigned) });
}

export function validateNcPrimaryIdentityCandidate(value: NcPrimaryIdentityCandidate): NcPrimaryIdentityCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "observations", "observationSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (value.schema !== NC_PRIMARY_IDENTITY_V1 || value.version !== 1 || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.observations.length !== 12) fail("LIFECYCLE_INVALID");
  const expectedKeys = TARGETS.flatMap((target) => CYCLES.map((cycleYear) => `${cycleYear}:${target.district}`)).sort(bytewise);
  const actualKeys: string[] = [];
  for (const [index, row] of value.observations.entries()) {
    exactKeys(row, ["observationId", "seatCycleId", "districtCode", "cycleYear", "rosterIdentity", "sourceObservation", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "relationshipDisposition", "identityApproved", "sourcePrecedenceStatus", "historicalGeographyStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    exactKeys(row.rosterIdentity, ["bioguideId", "officialHouseName", "officialHouseMemberDataSha256"], "ROSTER_IDENTITY_FIELDS_INVALID");
    const unsignedRow = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "rowSha256"));
    if (row.rowSha256 !== digest("dsa-seats:nc-primary-identity-row:v1\0", unsignedRow) || row.identityApproved || row.scoreEligible || row.directIdentifierBridgeAvailable || row.historicalGeographyStatus !== "separate_redraw_review_required" || (index > 0 && bytewise(value.observations[index - 1]!.observationId, row.observationId) >= 0)) fail("ROW_INVALID");
    const key = `${row.cycleYear}:${row.districtCode}`; actualKeys.push(key);
    const expected = EXPECTED_REPORTED[key as keyof typeof EXPECTED_REPORTED];
    if (expected) {
      const source = row.sourceObservation;
      if (source.kind !== "reported_contest") throw new Error("North Carolina primary identity rejected: REPORTED_FACT_INVALID");
      exactKeys(source, ["kind", "contestId", "contestSha256", "contestSourceLockIds", "resultAuthorityStatus", "candidateCount", "sourceCandidateName", "sourceCandidateId", "votes", "sourceWinnerStatus"], "REPORTED_FIELDS_INVALID");
      if (canonicalJson([source.contestId, source.contestSha256, source.sourceCandidateName, source.votes, row.matchMethod]) !== canonicalJson(expected) || source.sourceCandidateId !== null || source.sourceWinnerStatus !== "not_marked_by_source" || source.candidateCount < 1 || row.relationshipDisposition !== "proposed_identity_link_pending_documented_review") fail("REPORTED_FACT_INVALID");
    } else {
      const source = row.sourceObservation;
      if (source.kind !== "unreported_district_cycle_block") throw new Error("North Carolina primary identity rejected: UNREPORTED_FACT_INVALID");
      exactKeys(source, ["kind", "districtCycleId", "status"], "UNREPORTED_FIELDS_INVALID");
      if (source.districtCycleId !== `nc:${row.cycleYear}:us-house:${row.districtCode}:democratic` || source.status !== "unresolved_no_reported_contest_in_complete_archive" || row.relationshipDisposition !== "not_linked_no_reported_contest") fail("UNREPORTED_FACT_INVALID");
    }
  }
  if (canonicalJson(actualKeys.sort(bytewise)) !== canonicalJson(expectedKeys) || canonicalJson(value.summary) !== canonicalJson({ targetSeats: 4, districtCycleObservations: 12, reportedContestObservations: 6, unreportedDistrictCycleObservations: 6, exactNameObservations: 4, derivedNameRelationships: 2, proposedIdentityLinks: 6, directIdentifierBridges: 0, automaticallyApprovedRows: 0, scoreEligibleRows: 0 })) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value, set = digest("dsa-seats:nc-primary-identity-row-set:v1\0", value.observations);
  if (value.observationSetSha256 !== set || value.observationSetSha256 !== NC_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 || packageSha256 !== digest("dsa-seats:nc-primary-identity-candidate:v1\0", unsigned) || packageSha256 !== NC_PRIMARY_IDENTITY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}
