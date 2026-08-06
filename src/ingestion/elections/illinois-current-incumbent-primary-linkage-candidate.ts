import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateIllinoisHouseDemocraticPrimaryResultsReceipt,
  type IllinoisHouseDemocraticPrimaryResultsReceipt,
} from "./illinois-house-democratic-primary-results-receipt";

export const ILLINOIS_PRIMARY_IDENTITY_V1 =
  "illinois-current-incumbent-primary-linkage-candidate-v1" as const;
export const ILLINOIS_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 =
  "5d72e4bda79491d4e1a430148fa2ecd5cfd22f83cd5de80e6b7f75439f7fed34" as const;
export const ILLINOIS_PRIMARY_IDENTITY_PACKAGE_SHA256 =
  "f678f9bd0b65f20bba40c4e9c0620fbcfdcd159fc989597a7dd1cc0e6288980e" as const;
export const ILLINOIS_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256 =
  "b440700524ebc445ef04c5884278ef9a615c3cf31b1229dc52a10b6a863da436" as const;

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "3016e345d7989ff302557034fb65a63aff92a94f0fec3981b586bf7ea07f9534",
  receiptPackage: "4c0f7bc0505b9e02d03585d8acd0fe47d6599b194f6efcdbcd6e40896d6a663f",
  receiptSet: "eaff782dec77a454d943125c2256d6b6f10121522510a4ec5a43c9e1058e52af",
} as const;

const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: [
    "il-2022-house-primary-listing",
    ...Array.from({ length: 17 }, (_, index) => `il-2022-house-primary-district-${String(index + 1).padStart(2, "0")}`),
    "il-2024-house-primary-listing",
    ...Array.from({ length: 17 }, (_, index) => `il-2024-house-primary-district-${String(index + 1).padStart(2, "0")}`),
    "house-democratic-primary-source-selection-proposal-20260804-v1",
  ],
} as const;
const OUTPUT_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "illinois-house-democratic-primary-results-receipt-2022-2024-v1",
] as const;
const OUTPUT_FILE_SHA256 = "d9f46120064cd293cb63876866c5fa261c142f621d3e1c0662d7dd8dfcd27e25" as const;
const OUTPUT_BYTE_SIZE = 52_649 as const;
const INHERITED_UNRESOLVED_GATES = [
  "retain_final_state_canvass_or_certification",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "review_progressive_candidate_classification",
] as const;

const TARGETS = [
  { districtCode: "01", bioguideId: "J000309", officialHouseName: "Jonathan L. Jackson", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "02", bioguideId: "K000385", officialHouseName: "Robin L. Kelly", matchMethod: "derived_middle_name_omission_same_district" },
  { districtCode: "03", bioguideId: "R000617", officialHouseName: "Delia C. Ramirez", matchMethod: "derived_middle_name_omission_same_district" },
  { districtCode: "04", bioguideId: "G000586", officialHouseName: "Jesús G. \"Chuy\" García", matchMethod: "derived_middle_name_omission_same_district" },
  { districtCode: "05", bioguideId: "Q000023", officialHouseName: "Mike Quigley", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "06", bioguideId: "C001117", officialHouseName: "Sean Casten", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "07", bioguideId: "D000096", officialHouseName: "Danny K. Davis", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "08", bioguideId: "K000391", officialHouseName: "Raja Krishnamoorthi", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "09", bioguideId: "S001145", officialHouseName: "Janice D. Schakowsky", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "10", bioguideId: "S001190", officialHouseName: "Bradley Scott Schneider", matchMethod: "derived_retained_public_alias_same_district" },
  { districtCode: "11", bioguideId: "F000454", officialHouseName: "Bill Foster", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "13", bioguideId: "B001315", officialHouseName: "Nikki Budzinski", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "14", bioguideId: "U000040", officialHouseName: "Lauren Underwood", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "17", bioguideId: "S001225", officialHouseName: "Eric Sorensen", matchMethod: "exact_normalized_official_house_name_same_district" },
] as const;

type MatchMethod =
  | "exact_normalized_official_house_name_same_district"
  | "derived_middle_name_omission_same_district"
  | "derived_retained_public_alias_same_district";

type Observation = Readonly<{
  observationId: string;
  contestId: string;
  contestSha256: string;
  seatCycleId: string;
  districtCode: string;
  cycleYear: 2022 | 2024;
  rosterIdentity: Readonly<{
    bioguideId: string;
    officialHouseName: string;
    officialHouseMemberDataSha256: typeof INPUTS.houseFile;
  }>;
  sourceCandidate: Readonly<{
    sourceAuthorityCandidateId: string;
    sourceCandidateName: string;
    namedCandidateVotes: number;
    sourceWinnerStatus: "official_export_candidate_observation_not_certification_or_identity";
  }>;
  certificationStatus: "not_retained";
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod;
  evidenceClass: "exact_name_observation" | "derived_name_relationship";
  confidence: "high";
  relationshipDisposition: "proposed_identity_link_pending_documented_review";
  identityApproved: false;
  historicalGeographyStatus: "separate_candidate_not_approved";
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type IllinoisPrimaryIdentityCandidate = Readonly<{
  schema: typeof ILLINOIS_PRIMARY_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T03:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    targetSeats: 14;
    contestObservations: 28;
    exactNameObservations: number;
    derivedNameRelationships: number;
    proposedIdentityLinks: 28;
    directIdentifierBridges: 0;
    certificationReceipts: 0;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  observations: readonly Observation[];
  observationSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type IllinoisPrimaryIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  houseXml: string;
  houseFileSha256: string;
  congressJson: string;
  congressFileSha256: string;
  receipt: IllinoisHouseDemocraticPrimaryResultsReceipt;
  receiptFileSha256: string;
  sourceLock: unknown;
}>;

const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const normalize = (value: string): string =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fail = (code: string): never => {
  throw new Error(`Illinois primary identity rejected: ${code}`);
};
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (rows: readonly Observation[]) => rows.map((row) => ({
  observationId: row.observationId,
  contestId: row.contestId,
  contestSha256: row.contestSha256,
  seatCycleId: row.seatCycleId,
  districtCode: row.districtCode,
  cycleYear: row.cycleYear,
  rosterIdentity: row.rosterIdentity,
  sourceCandidate: row.sourceCandidate,
  certificationStatus: row.certificationStatus,
  matchMethod: row.matchMethod,
}));

export function buildIllinoisPrimaryIdentityCandidate(
  input: IllinoisPrimaryIdentityInput,
): IllinoisPrimaryIdentityCandidate {
  if (
    input.rosterFileSha256 !== INPUTS.rosterFile ||
    input.proposalFileSha256 !== INPUTS.proposalFile ||
    input.houseFileSha256 !== INPUTS.houseFile ||
    input.congressFileSha256 !== INPUTS.congressFile ||
    input.receiptFileSha256 !== INPUTS.receiptFile ||
    sha256(input.houseXml) !== INPUTS.houseFile ||
    sha256(input.congressJson) !== INPUTS.congressFile
  ) fail("INPUT_HASH_MISMATCH");

  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateIllinoisHouseDemocraticPrimaryResultsReceipt(input.receipt);
  const identityDecision = proposal.decisions.find(
    (decision) => decision.decisionId === "approve-historic-primary-candidate-identity-resolution-v1",
  );
  const dispositionDecision = proposal.decisions.find(
    (decision) => decision.decisionId === "decide-nonstandard-primary-disposition-treatment-v1",
  );
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage ||
    receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    identityDecision?.resolution !== null ||
    dispositionDecision?.resolution !== null || receipt.certificationStatus !== "not_retained" ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null
  ) fail("PARENT_INVALID");

  let people: Array<{
    id?: { bioguide?: string; wikipedia?: string; ballotpedia?: string };
    name?: { first?: string; middle?: string; last?: string; official_full?: string };
  }> = [];
  try {
    people = JSON.parse(input.congressJson);
  } catch {
    fail("CONGRESS_JSON_INVALID");
  }
  if (!Array.isArray(people)) fail("IDENTITY_SOURCE_INVALID");
  const memberBlocks = [...input.houseXml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map((match) => match[1]!);
  const lock = input.sourceLock as {
    entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }>;
  };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", SOURCE_LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", SOURCE_LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", SOURCE_LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", SOURCE_LOCK_PARENTS.congress],
    ["illinois-house-democratic-primary-results-receipt-2022-2024-v1", INPUTS.receiptFile, "data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (
    required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = lockEntries.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" ||
        matches[0]!.sha256 !== fileSha256 || matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === ILLINOIS_PRIMARY_IDENTITY_V1);
  if (
    outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
      "data/metadata/illinois-current-incumbent-primary-linkage-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)
  ) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const target of TARGETS) {
    const seatCycleId = `seat_house_il_${target.districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === target.bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === target.bioguideId);
    if (
      rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== target.bioguideId ||
      blocks.length !== 1 || matchingPeople.length !== 1 || tag(blocks[0]!, "statedistrict") !== `IL${target.districtCode}`
    ) fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");

    const block = blocks[0]!;
    const person = matchingPeople[0]!;
    const officialHouseName = tag(block, "official-name");
    if (officialHouseName !== target.officialHouseName) fail("OFFICIAL_IDENTITY_CLOSURE_INVALID");
    const first = tag(block, "firstname");
    const last = tag(block, "lastname");
    const publicAliases = new Set(
      [person.id?.wikipedia ?? "", person.id?.ballotpedia ?? ""].map((alias) => normalize(alias.replace(/\s+\([^()]+\)$/, ""))).filter(Boolean),
    );
    const contests = receipt.contests.filter((contest) => contest.districtCode === target.districtCode);
    if (contests.length !== 2) fail("CONTEST_PARTITION_INVALID");

    for (const contest of contests) {
      if (contest.certificationStatus !== "not_retained" || contest.contestDisposition !== "candidate_rows_retained") {
        fail("CONTEST_STATUS_INVALID");
      }
      const officialWithoutMiddleInitials = normalize(officialHouseName).split(" ").filter((token) => token.length !== 1).join(" ");
      const candidates = contest.candidates.filter((candidate) => !candidate.isWriteIn);
      const matches = candidates.flatMap((candidate) => {
        const sourceName = normalize(candidate.candidateName);
        const matchMethod: MatchMethod | null = sourceName === normalize(officialHouseName)
          ? "exact_normalized_official_house_name_same_district"
          : sourceName === officialWithoutMiddleInitials &&
              sourceName.startsWith(`${normalize(first)} `) && sourceName.endsWith(` ${normalize(last)}`)
            ? "derived_middle_name_omission_same_district"
            : publicAliases.has(sourceName)
              ? "derived_retained_public_alias_same_district"
              : null;
        return matchMethod === null ? [] : [{ candidate, matchMethod }];
      });
      if (matches.length !== 1 || matches[0]!.matchMethod !== target.matchMethod) {
        fail("SOURCE_CANDIDATE_IDENTITY_UNRESOLVED");
      }
      const { candidate, matchMethod } = matches[0]!;
      const exact = matchMethod === "exact_normalized_official_house_name_same_district";
      const unsigned = {
        observationId: `il:identity:${contest.cycleYear}:${target.districtCode}`,
        contestId: contest.contestId,
        contestSha256: contest.contestSha256,
        seatCycleId,
        districtCode: target.districtCode,
        cycleYear: contest.cycleYear,
        rosterIdentity: {
          bioguideId: target.bioguideId,
          officialHouseName,
          officialHouseMemberDataSha256: INPUTS.houseFile,
        },
        sourceCandidate: {
          sourceAuthorityCandidateId: candidate.candidateAuthorityId,
          sourceCandidateName: candidate.candidateName,
          namedCandidateVotes: candidate.votes,
          sourceWinnerStatus: "official_export_candidate_observation_not_certification_or_identity" as const,
        },
        certificationStatus: "not_retained" as const,
        directIdentifierBridgeAvailable: false as const,
        matchMethod,
        evidenceClass: exact ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: "high" as const,
        relationshipDisposition: "proposed_identity_link_pending_documented_review" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" as const,
        scoreEligible: false as const,
        rationaleCodes: [
          matchMethod,
          "same_district_and_cycle",
          "source_candidate_has_no_direct_person_identifier",
          "official_export_not_final_certification",
          "write_in_rows_excluded_from_identity_matching",
        ],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:il-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));

  const unsigned = {
    schema: ILLINOIS_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T03:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review" as const,
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
      scope: "fourteen_current_illinois_democratic_target_seats_times_two_retained_cycles",
      directIdentifierBridgeAvailable: false,
      automaticDecisionClosure: false,
      certificationStatus: "not_retained",
      writeInIdentityTreatment: "excluded_from_identity_matching",
      evaluatorNumericValues: 0,
    },
    summary: {
      targetSeats: 14 as const,
      contestObservations: 28 as const,
      exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
      derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length,
      proposedIdentityLinks: 28 as const,
      directIdentifierBridges: 0 as const,
      certificationReceipts: 0 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    observations,
    observationSetSha256: digest("dsa-seats:il-primary-identity-row-set:v1\0", observations),
    decisionSupport: {
      informsDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      analysisConclusion: "twenty_exact_and_eight_derived_identity_links_proposed_with_certification_unretained",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:il-primary-identity-candidate:v1\0", unsigned) };
}

export function validateIllinoisPrimaryIdentityCandidate(
  value: IllinoisPrimaryIdentityCandidate,
): IllinoisPrimaryIdentityCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "observations", "observationSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== ILLINOIS_PRIMARY_IDENTITY_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.observations.length !== 28 ||
    value.defaultUse !== "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review" ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = TARGETS.flatMap((target) => [2022, 2024].map((year) => `il:identity:${year}:${target.districtCode}`)).sort(bytewise);
  for (const [index, row] of value.observations.entries()) {
    exactKeys(row, ["observationId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "rosterIdentity", "sourceCandidate", "certificationStatus", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "relationshipDisposition", "identityApproved", "historicalGeographyStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    exactKeys(row.rosterIdentity, ["bioguideId", "officialHouseName", "officialHouseMemberDataSha256"], "ROSTER_IDENTITY_FIELDS_INVALID");
    exactKeys(row.sourceCandidate, ["sourceAuthorityCandidateId", "sourceCandidateName", "namedCandidateVotes", "sourceWinnerStatus"], "SOURCE_CANDIDATE_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    if (
      rowSha256 !== digest("dsa-seats:il-primary-identity-row:v1\0", unsignedRow) || row.identityApproved ||
      row.scoreEligible || row.directIdentifierBridgeAvailable || row.confidence !== "high" ||
      !/^\d+$/.test(row.sourceCandidate.sourceAuthorityCandidateId) ||
      row.certificationStatus !== "not_retained" ||
      row.relationshipDisposition !== "proposed_identity_link_pending_documented_review" ||
      row.historicalGeographyStatus !== "separate_candidate_not_approved" ||
      row.evaluatorUse !== "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" ||
      (index > 0 && bytewise(value.observations[index - 1]!.observationId, row.observationId) >= 0)
    ) fail("ROW_INVALID");
    const target = TARGETS.find((candidate) => candidate.districtCode === row.districtCode);
    if (
      !target || row.observationId !== `il:identity:${row.cycleYear}:${row.districtCode}` ||
      row.seatCycleId !== `seat_house_il_${row.districtCode}_current` ||
      canonicalJson([
        row.rosterIdentity.bioguideId,
        row.rosterIdentity.officialHouseName,
        row.matchMethod,
      ]) !== canonicalJson([target.bioguideId, target.officialHouseName, target.matchMethod])
    ) fail("RETAINED_FACT_INVALID");
  }
  if (
    digest("dsa-seats:il-primary-identity-parent-projection:v1\0", parentProjection(value.observations)) !==
    ILLINOIS_PRIMARY_IDENTITY_PARENT_PROJECTION_SHA256
  ) fail("PARENT_FACT_INVALID");
  if (
    canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson({
      targetSeats: 14,
      contestObservations: 28,
      exactNameObservations: 20,
      derivedNameRelationships: 8,
      proposedIdentityLinks: 28,
      directIdentifierBridges: 0,
      certificationReceipts: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    })
  ) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.observationSetSha256 !== digest("dsa-seats:il-primary-identity-row-set:v1\0", value.observations) ||
    value.observationSetSha256 !== ILLINOIS_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:il-primary-identity-candidate:v1\0", unsigned) ||
    packageSha256 !== ILLINOIS_PRIMARY_IDENTITY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
