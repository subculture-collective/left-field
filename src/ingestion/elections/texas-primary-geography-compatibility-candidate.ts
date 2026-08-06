import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateTexasCurrentIncumbentPrimaryEventIdentityCandidate,
  type TexasCurrentIncumbentPrimaryEventIdentityCandidate,
} from "./texas-current-incumbent-primary-event-identity-candidate";
import {
  validateTexasPrimaryResultsReceipt,
  type TexasPrimaryResultsReceipt,
} from "./texas-house-democratic-primary-results-receipt";

export const TEXAS_PRIMARY_GEOGRAPHY_V1 =
  "texas-primary-geography-compatibility-candidate-v1" as const;
export const TEXAS_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 =
  "68fef20bd2b16f688f1d5bc0203992ddf07ece12b7ad9a24572ca59e8863f7d3" as const;
export const TEXAS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 =
  "d8b06725f87143c95e7ce24debcca3d51353f51097c06b61283cd75a54d445c4" as const;
export const TEXAS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 =
  "cc4aad571b826b10176846e7571bf598eebc245f8f88ef02626c5d50d0fd9335" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "fa5db68682dd7f3183e834e881ddac016833065c5424dc1c95b92cddb489488e",
  receiptPackage: "f010c5c0a4915d2c73feb46e7cf6617e109e1c7bfc6e1b94449e393410e809e1",
  receiptSet: "10ac515b35866e680ca1741a30136e364fbaffff0248c87648f85204c98eb9ba",
  identityFile: "f91d18b3163a610ee60d65519b3ece2e6b627c9a71ca32abd297abb26e256a95",
  identityPackage: "3c9b24b36e1544088a9b85a2ae20d9c972f8fdacd18f15311fe13a4fbc968f2f",
  identitySet: "275727a0e383aebb71e15ee14791e331645d63ebe5d34d230a22d29fc6e51f86",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "eb07bd3e91c902b3289db239a3fee0bc1e248bfa672a0a1d347572ee79c1fa68",
  cd118Dbf: "d72e8c1bebc681f31ceeac111678ea8dae432b346200a2e46004e0c2e4dc6c8d",
  cd119File: "769b4ca318a4b06f9ced717d3a55b6dc94fd98205248c1496d3ce9f2927cda5c",
  cd119Dbf: "de1fe345380fb369b7998fa1081f723b7b118327cecc0f65001d3e087d92c3ce",
} as const;

const TARGET_DISTRICTS = ["07", "09", "16", "18", "20", "28", "29", "30", "32", "33", "34", "35", "37"] as const;
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
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;
const RECEIPT_PARENTS = [
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
] as const;
const IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "texas-house-democratic-primary-results-2022-2026-v1",
] as const;

type Row = Readonly<{
  observationId: string;
  identityObservationId: string;
  identityRowSha256: string;
  eventId: string;
  cycleYear: 2022 | 2024 | 2026;
  electionStage: "regular" | "runoff";
  electionDate: string;
  seatCycleId: string;
  districtCode: string;
  sourceObservationStatus:
    | "reported_contest"
    | "not_observed_in_retained_official_canvass_report_disposition_unresolved";
  sourceContestId: string | null;
  sourceContestSha256: string | null;
  sourceWinnerStatus: "not_marked_by_source" | "not_applicable_unobserved_contest";
  targetCd119Geoid: string;
  historicalCongressSession: "118" | "119" | "120";
  historicalGeoid: string | null;
  compatibilityDisposition:
    | "official_no_plan_change_declaration_same_geoid_key_candidate"
    | "same_cd119_session_and_geoid_exact_key_candidate"
    | "unassessed_cd120_authority_and_crosswalk_collection_pending";
  evidenceClass:
    | "direct_official_plan_continuity_and_derived_key"
    | "derived_exact_session_and_key"
    | "authority_pending";
  confidence: "high" | null;
  compatibilityCandidate: boolean;
  compatibilityApproved: false;
  identityApproved: false;
  resultDispositionPreserved: true;
  certificationStatus: "official_canvass_report_retained_certification_not_separately_bound";
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type TexasPrimaryGeographyCandidate = Readonly<{
  schema: typeof TEXAS_PRIMARY_GEOGRAPHY_V1;
  version: 1;
  generatedAt: "2026-08-06T05:30:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_disposition_classification_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    eventObservations: 78;
    regularEventObservations: 39;
    runoffEventObservations: 39;
    reportedContestObservations: 44;
    sourceUnobservedEventObservations: 34;
    cd118ToCd119PlanContinuityCandidates: 26;
    exactCd119SessionKeyCandidates: 26;
    cd120AuthorityAndCrosswalkPending: 26;
    numberedDistrictsPerRetainedLayer: 38;
    specialDistrictRowsPerRetainedLayer: 0;
    compatibilityCandidates: 52;
    authorityPendingRows: 26;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type TexasPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: TexasPrimaryResultsReceipt;
  receiptFileSha256: string;
  identity: TexasCurrentIncumbentPrimaryEventIdentityCandidate;
  identityFileSha256: string;
  authorityHtml: string;
  authorityFileSha256: string;
  cd118Zip: Buffer;
  cd118FileSha256: string;
  cd118Dbf: Buffer;
  cd119Zip: Buffer;
  cd119FileSha256: string;
  cd119Dbf: Buffer;
  sourceLock: unknown;
}>;

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => {
  throw new Error(`Texas primary geography rejected: ${code}`);
};
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (rows: readonly Row[]) => rows.map((row) => ({
  observationId: row.observationId,
  identityObservationId: row.identityObservationId,
  identityRowSha256: row.identityRowSha256,
  eventId: row.eventId,
  cycleYear: row.cycleYear,
  electionStage: row.electionStage,
  electionDate: row.electionDate,
  districtCode: row.districtCode,
  sourceObservationStatus: row.sourceObservationStatus,
  sourceContestId: row.sourceContestId,
  sourceContestSha256: row.sourceContestSha256,
  sourceWinnerStatus: row.sourceWinnerStatus,
  targetCd119Geoid: row.targetCd119Geoid,
  historicalCongressSession: row.historicalCongressSession,
  historicalGeoid: row.historicalGeoid,
  compatibilityDisposition: row.compatibilityDisposition,
  evidenceClass: row.evidenceClass,
  certificationStatus: row.certificationStatus,
  resultDispositionPreserved: row.resultDispositionPreserved,
}));

function parseDbf(bytes: Buffer, session: "118" | "119") {
  if (bytes.length < 65 || bytes[0] !== 3) fail("DBF_HEADER_INVALID");
  const count = bytes.readUInt32LE(4);
  const headerLength = bytes.readUInt16LE(8);
  const recordLength = bytes.readUInt16LE(10);
  const fields: Array<{ name: string; length: number; offset: number }> = [];
  let offset = 1;
  for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) {
    const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/g, "").trim();
    const length = bytes[cursor + 16]!;
    if (!name || length < 1) fail("DBF_FIELD_INVALID");
    fields.push({ name, length, offset });
    offset += length;
  }
  if (
    count !== 38 || headerLength < 65 || recordLength < 2 ||
    headerLength + count * recordLength > bytes.length || offset !== recordLength || bytes[headerLength - 1] !== 0x0d
  ) fail("DBF_LAYOUT_INVALID");
  const historical = session === "118";
  const stateField = historical ? "STATEFP20" : "STATEFP";
  const geoidField = historical ? "GEOID20" : "GEOID";
  const districtField = historical ? "CD118FP" : "CD119FP";
  const areaLandField = historical ? "ALAND20" : "ALAND";
  const areaWaterField = historical ? "AWATER20" : "AWATER";
  const rows = Array.from({ length: count }, (_, index) => {
    const start = headerLength + index * recordLength;
    if (bytes[start] !== 0x20) fail("DBF_DELETED_RECORD");
    const value = Object.fromEntries(fields.map((field) => [
      field.name,
      bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim(),
    ]));
    return {
      state: value[stateField],
      geoid: value[geoidField],
      district: value[districtField],
      session: value.CDSESSN,
      areaLand: Number(value[areaLandField]),
      areaWater: Number(value[areaWaterField]),
    };
  }).sort((left, right) => bytewise(left.geoid ?? "", right.geoid ?? ""));
  if (rows.some((row, index) =>
    row.state !== "48" || row.geoid !== `48${String(index + 1).padStart(2, "0")}` ||
    row.district !== String(index + 1).padStart(2, "0") || row.session !== session ||
    !Number.isSafeInteger(row.areaLand) || row.areaLand <= 0 ||
    !Number.isSafeInteger(row.areaWater) || row.areaWater < 0
  )) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildTexasPrimaryGeographyCandidate(
  input: TexasPrimaryGeographyInput,
): TexasPrimaryGeographyCandidate {
  const actualHashes = [
    input.proposalFileSha256,
    input.receiptFileSha256,
    input.identityFileSha256,
    input.authorityFileSha256,
    input.cd118FileSha256,
    input.cd119FileSha256,
    sha256(input.authorityHtml),
    sha256(input.cd118Zip),
    sha256(input.cd118Dbf),
    sha256(input.cd119Zip),
    sha256(input.cd119Dbf),
  ];
  const expectedHashes = [
    INPUTS.proposalFile,
    INPUTS.receiptFile,
    INPUTS.identityFile,
    INPUTS.authorityFile,
    INPUTS.cd118File,
    INPUTS.cd119File,
    INPUTS.authorityFile,
    INPUTS.cd118File,
    INPUTS.cd118Dbf,
    INPUTS.cd119File,
    INPUTS.cd119Dbf,
  ];
  if (actualHashes.some((value, index) => value !== expectedHashes[index])) fail("INPUT_HASH_MISMATCH");
  if (
    !input.cd118Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    !input.cd119Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  ) fail("ZIP_FORMAT_INVALID");

  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateTexasPrimaryResultsReceipt(input.receipt);
  const identity = validateTexasCurrentIncumbentPrimaryEventIdentityCandidate(input.identity);
  const decision = proposal.decisions.find(
    (candidate) => candidate.decisionId === "approve-historical-district-cd119-compatibility-v1",
  );
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || decision?.resolution !== null ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    identity.review.status !== "proposed" || identity.review.reviewer !== null || identity.review.reviewedAt !== null ||
    canonicalJson(identity.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("PARENT_INVALID");

  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Texas")) {
    fail("AUTHORITY_INVALID");
  }
  const cd118 = parseDbf(input.cd118Dbf, "118");
  const cd119 = parseDbf(input.cd119Dbf, "119");
  const inventoryKeys = new Set([...cd118, ...cd119].map((row) => `${row.session}:${row.geoid}`));

  const lock = input.sourceLock as {
    entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; sha256: string; kind: string; parentIds?: string[] }>;
  };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["texas-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/texas-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["texas-current-incumbent-primary-event-identity-candidate-v1", INPUTS.identityFile, "data/metadata/texas-current-incumbent-primary-event-identity-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-48", INPUTS.cd118File, "data/source/tiger2022/tl_2022_48_cd118.zip", "source", []],
    ["tiger-cd119-48", INPUTS.cd119File, "data/source/tiger2025/tl_2025_48_cd119.zip", "source", []],
  ] as const;
  if (
    !Array.isArray(lock.entries) || required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = lock.entries!.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== fileSha256 ||
        matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = identity.observations.map((observation) => {
    const targetCd119Geoid = `48${observation.targetDistrictCode}`;
    if (!inventoryKeys.has(`118:${targetCd119Geoid}`) || !inventoryKeys.has(`119:${targetCd119Geoid}`)) {
      fail("IDENTITY_EVENT_OUTSIDE_TIGER_CLOSURE");
    }
    const contest = receipt.contests.find((candidate) =>
      candidate.cycleYear === observation.cycleYear && candidate.electionStage === observation.electionStage &&
      candidate.districtCode === observation.targetDistrictCode
    );
    if (
      (observation.sourceObservationStatus === "reported_contest" &&
        (!contest || contest.contestId !== observation.sourceContestId || contest.contestSha256 !== observation.sourceContestSha256)) ||
      (observation.sourceObservationStatus !== "reported_contest" && contest !== undefined)
    ) fail("RECEIPT_IDENTITY_EVENT_MISMATCH");
    const isContinuity = observation.cycleYear === 2022;
    const isExact = observation.cycleYear === 2024;
    const historicalCongressSession = isContinuity ? "118" as const : isExact ? "119" as const : "120" as const;
    const unsigned = {
      observationId: `tx:geography:${observation.cycleYear}:${observation.electionStage}:${observation.targetDistrictCode}`,
      identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256,
      eventId: observation.eventId,
      cycleYear: observation.cycleYear,
      electionStage: observation.electionStage,
      electionDate: observation.electionDate,
      seatCycleId: observation.seatCycleId,
      districtCode: observation.targetDistrictCode,
      sourceObservationStatus: observation.sourceObservationStatus,
      sourceContestId: observation.sourceContestId,
      sourceContestSha256: observation.sourceContestSha256,
      sourceWinnerStatus: observation.sourceWinnerStatus,
      targetCd119Geoid,
      historicalCongressSession,
      historicalGeoid: isContinuity || isExact ? targetCd119Geoid : null,
      compatibilityDisposition: isContinuity
        ? "official_no_plan_change_declaration_same_geoid_key_candidate" as const
        : isExact
          ? "same_cd119_session_and_geoid_exact_key_candidate" as const
          : "unassessed_cd120_authority_and_crosswalk_collection_pending" as const,
      evidenceClass: isContinuity
        ? "direct_official_plan_continuity_and_derived_key" as const
        : isExact ? "derived_exact_session_and_key" as const : "authority_pending" as const,
      confidence: isContinuity || isExact ? "high" as const : null,
      compatibilityCandidate: isContinuity || isExact,
      compatibilityApproved: false as const,
      identityApproved: false as const,
      resultDispositionPreserved: true as const,
      certificationStatus: "official_canvass_report_retained_certification_not_separately_bound" as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
      scoreEligible: false as const,
      rationaleCodes: isContinuity
        ? ["official_census_cd119_redraw_list_excludes_tx", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "result_disposition_unchanged"]
        : isExact
          ? ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "result_disposition_unchanged"]
          : ["cd120_plan_authority_not_retained", "cd119_substitution_for_cd120_forbidden", "texas_2026_plan_crosswalk_collection_pending", "result_disposition_unchanged"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:tx-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));
  const count = (predicate: (row: Row) => boolean): number => rows.filter(predicate).length;
  if (
    rows.length !== 78 || count((row) => row.electionStage === "regular") !== 39 ||
    count((row) => row.electionStage === "runoff") !== 39 ||
    count((row) => row.sourceObservationStatus === "reported_contest") !== 44 ||
    count((row) => row.sourceObservationStatus !== "reported_contest") !== 34 ||
    count((row) => row.compatibilityCandidate) !== 52 ||
    count((row) => !row.compatibilityCandidate) !== 26
  ) fail("OBSERVATION_CLOSURE_INVALID");

  const unsigned = {
    schema: TEXAS_PRIMARY_GEOGRAPHY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T05:30:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      sourceSelectionProposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, decisionUnresolved: true },
      texasReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
      texasIdentityEvents: { sourceLockId: required[2][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      censusPlanChangeAuthority: { sourceLockId: required[3][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_tx_absent" },
      tigerLayers: [
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", numberedDistrictCount: 38, specialDistrictCount: 0 },
        { sourceLockId: required[5][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", numberedDistrictCount: 38, specialDistrictCount: 0 },
      ],
    },
    methodology: {
      targetSession: "119",
      cycleSessionMapping: { "2022": "118", "2024": "119", "2026": "120" },
      rowGrain: "current_target_district_election_event",
      regularRunoffCollapseAllowed: false,
      sourceUnobservedDispositionInferenceAllowed: false,
      rawTigerGeometryEqualityAssessed: false,
      overlapThresholdUsed: false,
      populationEquivalenceAssessed: false,
      cd119SubstitutedForCd120: false,
      cd120AuthorityStatus: "not_retained_collection_pending",
      texas2026PlanCrosswalkStatus: "not_retained_collection_pending",
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      parentProjectionSha256: digest("dsa-seats:tx-primary-geography-parent-projection:v1\0", parentProjection(rows)),
    },
    summary: {
      eventObservations: 78 as const,
      regularEventObservations: 39 as const,
      runoffEventObservations: 39 as const,
      reportedContestObservations: 44 as const,
      sourceUnobservedEventObservations: 34 as const,
      cd118ToCd119PlanContinuityCandidates: 26 as const,
      exactCd119SessionKeyCandidates: 26 as const,
      cd120AuthorityAndCrosswalkPending: 26 as const,
      numberedDistrictsPerRetainedLayer: 38 as const,
      specialDistrictRowsPerRetainedLayer: 0 as const,
      compatibilityCandidates: 52 as const,
      authorityPendingRows: 26 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:tx-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      resolution: null,
      analysisConclusion: "official_evidence_supports_tx_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_while_cd120_and_plan_c2333_crosswalk_remain_unassessed",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:tx-primary-geography-candidate:v1\0", unsigned) };
}

export function validateTexasPrimaryGeographyCandidate(
  value: TexasPrimaryGeographyCandidate,
): TexasPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== TEXAS_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 78 ||
    value.defaultUse !== "exclude_from_evaluator_until_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    value.decisionSupport.resolution !== null
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => STAGES.flatMap((stage) =>
    TARGET_DISTRICTS.map((district) => `tx:geography:${cycle}:${stage}:${district}`)
  )).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "identityObservationId", "identityRowSha256", "eventId", "cycleYear", "electionStage", "electionDate", "seatCycleId", "districtCode", "sourceObservationStatus", "sourceContestId", "sourceContestSha256", "sourceWinnerStatus", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "resultDispositionPreserved", "certificationStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    const isContinuity = row.cycleYear === 2022;
    const isExact = row.cycleYear === 2024;
    const expectedSession = isContinuity ? "118" : isExact ? "119" : "120";
    const expectedGeoid = `48${row.districtCode}`;
    const expectedDisposition = isContinuity
      ? "official_no_plan_change_declaration_same_geoid_key_candidate"
      : isExact ? "same_cd119_session_and_geoid_exact_key_candidate" : "unassessed_cd120_authority_and_crosswalk_collection_pending";
    const expectedEvidenceClass = isContinuity
      ? "direct_official_plan_continuity_and_derived_key"
      : isExact ? "derived_exact_session_and_key" : "authority_pending";
    const expectedRationaleCodes = isContinuity
      ? ["official_census_cd119_redraw_list_excludes_tx", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "result_disposition_unchanged"]
      : isExact
        ? ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "result_disposition_unchanged"]
        : ["cd120_plan_authority_not_retained", "cd119_substitution_for_cd120_forbidden", "texas_2026_plan_crosswalk_collection_pending", "result_disposition_unchanged"];
    const reported = row.sourceObservationStatus === "reported_contest";
    if (
      rowSha256 !== digest("dsa-seats:tx-primary-geography-row:v1\0", unsignedRow) ||
      !TARGET_DISTRICTS.includes(row.districtCode as typeof TARGET_DISTRICTS[number]) ||
      row.observationId !== `tx:geography:${row.cycleYear}:${row.electionStage}:${row.districtCode}` ||
      row.identityObservationId !== `tx:identity:${row.cycleYear}:${row.electionStage}:${row.districtCode}` ||
      row.eventId !== `tx:${row.cycleYear}:${row.electionStage}:democratic-primary` ||
      row.seatCycleId !== `seat_house_tx_${row.districtCode}_current` || row.targetCd119Geoid !== expectedGeoid ||
      row.historicalCongressSession !== expectedSession || row.historicalGeoid !== (isContinuity || isExact ? expectedGeoid : null) ||
      row.compatibilityDisposition !== expectedDisposition || row.evidenceClass !== expectedEvidenceClass ||
      row.confidence !== (isContinuity || isExact ? "high" : null) || row.compatibilityCandidate !== (isContinuity || isExact) ||
      row.compatibilityApproved || row.identityApproved || !row.resultDispositionPreserved || row.scoreEligible ||
      row.certificationStatus !== "official_canvass_report_retained_certification_not_separately_bound" ||
      row.evaluatorUse !== "excluded_pending_certification_identity_historical_geography_disposition_classification_review_and_publication_approval" ||
      canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationaleCodes) ||
      (reported && (row.sourceContestId === null || row.sourceContestSha256 === null || row.sourceWinnerStatus !== "not_marked_by_source")) ||
      (!reported && (row.sourceContestId !== null || row.sourceContestSha256 !== null || row.sourceWinnerStatus !== "not_applicable_unobserved_contest")) ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)
    ) fail("ROW_INVALID");
  }
  if (
    canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson({
      eventObservations: 78,
      regularEventObservations: 39,
      runoffEventObservations: 39,
      reportedContestObservations: 44,
      sourceUnobservedEventObservations: 34,
      cd118ToCd119PlanContinuityCandidates: 26,
      exactCd119SessionKeyCandidates: 26,
      cd120AuthorityAndCrosswalkPending: 26,
      numberedDistrictsPerRetainedLayer: 38,
      specialDistrictRowsPerRetainedLayer: 0,
      compatibilityCandidates: 52,
      authorityPendingRows: 26,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    })
  ) fail("SUMMARY_INVALID");
  const projection = digest("dsa-seats:tx-primary-geography-parent-projection:v1\0", parentProjection(value.rows));
  const { packageSha256, ...unsigned } = value;
  if (
    value.methodology.parentProjectionSha256 !== projection || projection !== TEXAS_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 ||
    value.rowSetSha256 !== digest("dsa-seats:tx-primary-geography-row-set:v1\0", value.rows) ||
    value.rowSetSha256 !== TEXAS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:tx-primary-geography-candidate:v1\0", unsigned) ||
    packageSha256 !== TEXAS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
