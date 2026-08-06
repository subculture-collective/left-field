import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMassachusettsPrimaryReceipt,
  type MassachusettsPrimaryReceipt,
} from "./massachusetts-house-democratic-primary-results-receipt";

export const MASSACHUSETTS_PRIMARY_IDENTITY_V1 =
  "massachusetts-current-incumbent-primary-linkage-candidate-v1" as const;
export const MASSACHUSETTS_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 =
  "6d2989f28b08974243a984bac3e3c71a23f597825e6c30f6c6a73dbbcb5c076b" as const;
export const MASSACHUSETTS_PRIMARY_IDENTITY_PACKAGE_SHA256 =
  "364d4e42d293c5b81408f9b71daa90d2d7ed21c96119e92a82dcd631f1590e3d" as const;

const INPUTS = {
  rosterFile: "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1",
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  houseFile: "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b",
  congressFile: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf",
  receiptFile: "8dbcf792852355bcb88618a9982d22d422e5dab222330d9110f4644e10ac47cb",
  receiptPackage: "eb2c8172b785bea76e9632cb6813bd53a2b2ec2ad1ebbd232482bda45df63931",
  receiptSet: "2bcd6a4082753ff34868b3523ac9ef1c5981a8de48e0f03bcb453f58277ba8f9",
} as const;

const SOURCE_LOCK_PARENTS = {
  roster: ["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"],
  proposal: ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"],
  house: [],
  congress: [],
  receipt: [
    "house-democratic-primary-source-selection-proposal-20260804-v1",
    "ma-2022-house-democratic-primary-search",
    "ma-2024-house-democratic-primary-search",
    ...Array.from({ length: 9 }, (_, index) => `ma-2022-house-democratic-primary-district-${index + 1}-municipality-csv`),
    ...Array.from({ length: 9 }, (_, index) => `ma-2024-house-democratic-primary-district-${index + 1}-municipality-csv`),
    "ma-primary-certification-policy-rendered-20260805",
    "ma-2026-state-primary-schedule-rendered-20260805",
  ],
} as const;

const TARGETS = [
  { districtCode: "01", bioguideId: "N000015", officialHouseName: "Richard E. Neal", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "02", bioguideId: "M000312", officialHouseName: "James P. McGovern", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "03", bioguideId: "T000482", officialHouseName: "Lori Trahan", matchMethod: "derived_middle_name_expansion_same_district" },
  { districtCode: "04", bioguideId: "A000148", officialHouseName: "Jake Auchincloss", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "05", bioguideId: "C001101", officialHouseName: "Katherine M. Clark", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "06", bioguideId: "M001196", officialHouseName: "Seth Moulton", matchMethod: "derived_middle_name_expansion_same_district" },
  { districtCode: "07", bioguideId: "P000617", officialHouseName: "Ayanna Pressley", matchMethod: "derived_middle_name_expansion_same_district" },
  { districtCode: "08", bioguideId: "L000562", officialHouseName: "Stephen F. Lynch", matchMethod: "exact_normalized_official_house_name_same_district" },
  { districtCode: "09", bioguideId: "K000375", officialHouseName: "William R. Keating", matchMethod: "derived_retained_public_alias_same_district" },
] as const;

const EXPECTED_CONTEST_FACTS = {
  "2022:01": ["ma:2022:regular:us-house:01:democratic", "44c6b224cc727b24ba55078ef563351ea907d0f11499ba5c1c5d15e8474a4aba", "Richard E. Neal", 143856],
  "2022:02": ["ma:2022:regular:us-house:02:democratic", "577d8fb199060f25687037ec0429f604e0ece418ccb3ec3356b8163df58866a9", "James P. McGovern", 139678],
  "2022:03": ["ma:2022:regular:us-house:03:democratic", "587ed36be08a71fabda7db1fd5c58606ad564ecf4a4d70b55ff96d08701b8d98", "Lori Loureiro Trahan", 128380],
  "2022:04": ["ma:2022:regular:us-house:04:democratic", "f269b07037c39f8d716e086efe1bc86b7a9e38f4c4afa9d8ed2a3b9ced9c0e65", "Jake Auchincloss", 135476],
  "2022:05": ["ma:2022:regular:us-house:05:democratic", "7e0f3fc31909f8502a1680332a048bac5fe67ffc0035ea608bd5b8d36a766e1f", "Katherine M. Clark", 169690],
  "2022:06": ["ma:2022:regular:us-house:06:democratic", "3ec7c1dc0e9122a11142a32e32904a6dd85c7ad51c68ce17b364ee7a74071888", "Seth W. Moulton", 169720],
  "2022:07": ["ma:2022:regular:us-house:07:democratic", "3c4c769d57a3948bd2388fff046b92e343fd5c083015f51a670f99d070d6a5eb", "Ayanna S. Pressley", 138454],
  "2022:08": ["ma:2022:regular:us-house:08:democratic", "777584b87c90ca9f8235bf70791a67f9c7e49629033c00ee93d46c3745d79014", "Stephen F. Lynch", 146382],
  "2022:09": ["ma:2022:regular:us-house:09:democratic", "735f6c0efcdce1eda05ec9ceb3e8062ef980d0d577b685b790378b24e3d65481", "Bill Keating", 163060],
  "2024:01": ["ma:2024:regular:us-house:01:democratic", "cc347575c5caba3e8790bc9faf3c667a7f04967789fec83c366a212f7f9d8de2", "Richard E. Neal", 112728],
  "2024:02": ["ma:2024:regular:us-house:02:democratic", "a6fe870d05048fad7a8b71e55aef82783116b92218e3685aad72f7f16b5496ee", "James P. McGovern", 112686],
  "2024:03": ["ma:2024:regular:us-house:03:democratic", "124478b22f0b7857b059bde73b5c24c75df6e6cdecddf7fb20f73147ef4de721", "Lori Loureiro Trahan", 109224],
  "2024:04": ["ma:2024:regular:us-house:04:democratic", "2d8a8d388a79121ab2a134cb5b00b1108c1e6bf2a4c4ce0bd997bdc83fd5aace", "Jake Auchincloss", 128476],
  "2024:05": ["ma:2024:regular:us-house:05:democratic", "cea568f37c3fe3dc68fc2681d78080d3a98769c871b73ac1c1a20aab0bf5865d", "Katherine M. Clark", 153612],
  "2024:06": ["ma:2024:regular:us-house:06:democratic", "63c03538ea266d41f56294bf637cba15a990d3f1586421077b7863ca241046f0", "Seth W. Moulton", 125972],
  "2024:07": ["ma:2024:regular:us-house:07:democratic", "94a194554c2d1e51b99e77483af595a2bff0485dc725acbe1f94f52f22927f75", "Ayanna S. Pressley", 114344],
  "2024:08": ["ma:2024:regular:us-house:08:democratic", "ea5183518bc534bb7a2f9743bcbbbff4b70a30debfe1e2c133fc6ee01a8957a2", "Stephen F. Lynch", 129522],
  "2024:09": ["ma:2024:regular:us-house:09:democratic", "2ae05eaf0d9a7ed05924a8d073b9b15ef60c8eced56392b0b4e7b55f6fcfface", "Bill Keating", 143628],
} as const;

type MatchMethod =
  | "exact_normalized_official_house_name_same_district"
  | "derived_middle_name_expansion_same_district"
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
    sourceCandidateName: string;
    namedCandidateVotes: number;
    sourceWinnerStatus: "portal_marks_named_candidate_winner_not_current_identity";
  }>;
  directIdentifierBridgeAvailable: false;
  matchMethod: MatchMethod;
  evidenceClass: "exact_name_observation" | "derived_name_relationship";
  confidence: "high";
  relationshipDisposition: "proposed_identity_link_pending_documented_review";
  identityApproved: false;
  historicalGeographyStatus: "separate_candidate_not_approved";
  evaluatorUse: "excluded_pending_authorized_identity_and_historical_geography_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type MassachusettsPrimaryIdentityCandidate = Readonly<{
  schema: typeof MASSACHUSETTS_PRIMARY_IDENTITY_V1;
  version: 1;
  generatedAt: "2026-08-06T03:00:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    targetSeats: 9;
    contestObservations: 18;
    exactNameObservations: number;
    derivedNameRelationships: number;
    proposedIdentityLinks: 18;
    directIdentifierBridges: 0;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  observations: readonly Observation[];
  observationSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type MassachusettsPrimaryIdentityInput = Readonly<{
  roster: unknown;
  rosterFileSha256: string;
  proposal: unknown;
  proposalFileSha256: string;
  houseXml: string;
  houseFileSha256: string;
  congressJson: string;
  congressFileSha256: string;
  receipt: MassachusettsPrimaryReceipt;
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
  throw new Error(`Massachusetts primary identity rejected: ${code}`);
};
const tag = (block: string, name: string): string => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};

export function buildMassachusettsPrimaryIdentityCandidate(
  input: MassachusettsPrimaryIdentityInput,
): MassachusettsPrimaryIdentityCandidate {
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
  const receipt = validateMassachusettsPrimaryReceipt(input.receipt);
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
    identityDecision?.resolution !== null ||
    dispositionDecision?.resolution !== null ||
    receipt.review.resolution !== null
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
    entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; sha256: string; kind: string; parentIds?: string[] }>;
  };
  const required = [
    ["dsa-target-incumbent-roster-20260804-v1", INPUTS.rosterFile, "data/metadata/dsa-target-incumbent-roster-20260804-v1.json", "production_projection_receipt", SOURCE_LOCK_PARENTS.roster],
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", SOURCE_LOCK_PARENTS.proposal],
    ["house-xml", INPUTS.houseFile, "data/source/identity/house-member-data.xml", "source", SOURCE_LOCK_PARENTS.house],
    ["congress-legislators-current-20260804", INPUTS.congressFile, "data/source/identity/congress-legislators-current-20260804.json", "source", SOURCE_LOCK_PARENTS.congress],
    ["massachusetts-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/massachusetts-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", SOURCE_LOCK_PARENTS.receipt],
  ] as const;
  if (
    !Array.isArray(lock.entries) ||
    required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = lock.entries!.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" ||
        matches[0]!.sha256 !== fileSha256 || matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");

  const observations: Observation[] = [];
  for (const target of TARGETS) {
    const seatCycleId = `seat_house_ma_${target.districtCode}_current`;
    const rosterRows = roster.rows.filter((row) => row.seatCycleId === seatCycleId);
    const blocks = memberBlocks.filter((block) => tag(block, "bioguideID") === target.bioguideId);
    const matchingPeople = people.filter((person) => person.id?.bioguide === target.bioguideId);
    if (
      rosterRows.length !== 1 || rosterRows[0]!.bioguideId !== target.bioguideId ||
      blocks.length !== 1 || matchingPeople.length !== 1 || tag(blocks[0]!, "statedistrict") !== `MA${target.districtCode}`
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
      const sourceName = normalize(contest.sourceCandidateName);
      const matchMethod: MatchMethod = sourceName === normalize(officialHouseName)
        ? "exact_normalized_official_house_name_same_district"
        : sourceName.startsWith(`${normalize(first)} `) && sourceName.endsWith(` ${normalize(last)}`)
          ? "derived_middle_name_expansion_same_district"
          : publicAliases.has(sourceName)
            ? "derived_retained_public_alias_same_district"
            : fail("SOURCE_CANDIDATE_IDENTITY_UNRESOLVED");
      const exact = matchMethod === "exact_normalized_official_house_name_same_district";
      const unsigned = {
        observationId: `ma:identity:${contest.cycleYear}:${target.districtCode}`,
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
          sourceCandidateName: contest.sourceCandidateName,
          namedCandidateVotes: contest.namedCandidateVotes,
          sourceWinnerStatus: contest.sourceWinnerStatus,
        },
        directIdentifierBridgeAvailable: false as const,
        matchMethod,
        evidenceClass: exact ? "exact_name_observation" as const : "derived_name_relationship" as const,
        confidence: "high" as const,
        relationshipDisposition: "proposed_identity_link_pending_documented_review" as const,
        identityApproved: false as const,
        historicalGeographyStatus: "separate_candidate_not_approved" as const,
        evaluatorUse: "excluded_pending_authorized_identity_and_historical_geography_review" as const,
        scoreEligible: false as const,
        rationaleCodes: [
          matchMethod,
          "same_district_and_cycle",
          "source_candidate_has_no_direct_person_identifier",
          "single_named_candidate_not_uncontested_inference",
        ],
      };
      observations.push({ ...unsigned, rowSha256: digest("dsa-seats:ma-primary-identity-row:v1\0", unsigned) });
    }
  }
  observations.sort((left, right) => bytewise(left.observationId, right.observationId));

  const unsigned = {
    schema: MASSACHUSETTS_PRIMARY_IDENTITY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T03:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: {
      roster: { sourceLockId: required[0][0], fileSha256: INPUTS.rosterFile, rosterSha256: roster.rosterSha256 },
      proposal: { sourceLockId: required[1][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      houseClerk: { sourceLockId: required[2][0], fileSha256: INPUTS.houseFile },
      congressLegislators: { sourceLockId: required[3][0], fileSha256: INPUTS.congressFile },
      receipt: { sourceLockId: required[4][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
    },
    methodology: {
      scope: "nine_current_massachusetts_democratic_target_seats_times_two_completed_cycles",
      directIdentifierBridgeAvailable: false,
      automaticDecisionClosure: false,
      singleNamedCandidateDisposition: "reported_contest_not_uncontested_inference",
      evaluatorNumericValues: 0,
    },
    summary: {
      targetSeats: 9 as const,
      contestObservations: 18 as const,
      exactNameObservations: observations.filter((row) => row.evidenceClass === "exact_name_observation").length,
      derivedNameRelationships: observations.filter((row) => row.evidenceClass === "derived_name_relationship").length,
      proposedIdentityLinks: 18 as const,
      directIdentifierBridges: 0 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    observations,
    observationSetSha256: digest("dsa-seats:ma-primary-identity-row-set:v1\0", observations),
    decisionSupport: {
      informsDecisionId: "approve-historic-primary-candidate-identity-resolution-v1",
      analysisConclusion: "ten_exact_and_eight_derived_identity_links_proposed",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:ma-primary-identity-candidate:v1\0", unsigned) };
}

export function validateMassachusettsPrimaryIdentityCandidate(
  value: MassachusettsPrimaryIdentityCandidate,
): MassachusettsPrimaryIdentityCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "observations", "observationSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== MASSACHUSETTS_PRIMARY_IDENTITY_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.observations.length !== 18
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = TARGETS.flatMap((target) => [2022, 2024].map((year) => `ma:identity:${year}:${target.districtCode}`)).sort(bytewise);
  for (const [index, row] of value.observations.entries()) {
    exactKeys(row, ["observationId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "rosterIdentity", "sourceCandidate", "directIdentifierBridgeAvailable", "matchMethod", "evidenceClass", "confidence", "relationshipDisposition", "identityApproved", "historicalGeographyStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    exactKeys(row.rosterIdentity, ["bioguideId", "officialHouseName", "officialHouseMemberDataSha256"], "ROSTER_IDENTITY_FIELDS_INVALID");
    exactKeys(row.sourceCandidate, ["sourceCandidateName", "namedCandidateVotes", "sourceWinnerStatus"], "SOURCE_CANDIDATE_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    if (
      rowSha256 !== digest("dsa-seats:ma-primary-identity-row:v1\0", unsignedRow) || row.identityApproved ||
      row.scoreEligible || row.directIdentifierBridgeAvailable || row.confidence !== "high" ||
      row.relationshipDisposition !== "proposed_identity_link_pending_documented_review" ||
      row.historicalGeographyStatus !== "separate_candidate_not_approved" ||
      (index > 0 && bytewise(value.observations[index - 1]!.observationId, row.observationId) >= 0)
    ) fail("ROW_INVALID");
    const target = TARGETS.find((candidate) => candidate.districtCode === row.districtCode);
    const expectedContest = EXPECTED_CONTEST_FACTS[`${row.cycleYear}:${row.districtCode}` as keyof typeof EXPECTED_CONTEST_FACTS];
    if (
      !target || !expectedContest || row.observationId !== `ma:identity:${row.cycleYear}:${row.districtCode}` ||
      row.seatCycleId !== `seat_house_ma_${row.districtCode}_current` ||
      canonicalJson([
        row.contestId,
        row.contestSha256,
        row.sourceCandidate.sourceCandidateName,
        row.sourceCandidate.namedCandidateVotes,
      ]) !== canonicalJson(expectedContest) ||
      canonicalJson([
        row.rosterIdentity.bioguideId,
        row.rosterIdentity.officialHouseName,
        row.matchMethod,
      ]) !== canonicalJson([target.bioguideId, target.officialHouseName, target.matchMethod])
    ) fail("RETAINED_FACT_INVALID");
  }
  if (
    canonicalJson(value.observations.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson({
      targetSeats: 9,
      contestObservations: 18,
      exactNameObservations: 10,
      derivedNameRelationships: 8,
      proposedIdentityLinks: 18,
      directIdentifierBridges: 0,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    })
  ) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.observationSetSha256 !== digest("dsa-seats:ma-primary-identity-row-set:v1\0", value.observations) ||
    value.observationSetSha256 !== MASSACHUSETTS_PRIMARY_IDENTITY_OBSERVATION_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:ma-primary-identity-candidate:v1\0", unsigned) ||
    packageSha256 !== MASSACHUSETTS_PRIMARY_IDENTITY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
