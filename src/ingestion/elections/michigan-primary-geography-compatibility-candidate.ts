import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMichiganPrimaryIdentityCandidate,
  type MichiganPrimaryIdentityCandidate,
} from "./michigan-current-incumbent-primary-linkage-candidate";
import {
  validateMichiganPrimaryReceipt,
  type MichiganPrimaryReceipt,
} from "./michigan-house-democratic-primary-results-receipt";

export const MICHIGAN_PRIMARY_GEOGRAPHY_V1 =
  "michigan-primary-geography-compatibility-candidate-v1" as const;
export const MICHIGAN_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 =
  "c8da3c7b28eec356a4decf91327d4ed123f3da6ba40def64c49f35daf9d77b03" as const;
export const MICHIGAN_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 =
  "2a13fcc368fe0a87d13ef69a4d83895d05c23d0d5c26b02cc9e224d027915286" as const;
export const MICHIGAN_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 =
  "03df08a285b893bc8e6f616f05cb446d02739485e671cf05dfe8873495f9d495" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "0f7978079ed146e5c5fe316e558380bdfc4e025c00c02e245e7d014e56b13a86",
  receiptPackage: "6572ccc3e4a9e40e36efaa33e02347330687fd8886b62887b9d095723b1492c3",
  receiptSet: "7ea71a3fa253949ad111d8eea53d9c4986cc5a5ead2d42222243b27e98240f25",
  identityFile: "f8b790c4e37bf108e55d6c2970197801b17e6edf0b6a5656e5d1ed2ff98bd3b5",
  identityPackage: "caac838d7b33050ff2924d0aed3a9624aea0c429671536bbb40fd6b0a8463e58",
  identitySet: "67128677a206a56479be0e3d58f1863ac9b9e9c99442fe0605ac6cd3394b9dcc",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "b9bd038619c00e3142f9ac14dd4c2bda8715c224f39b47c8086f18c3400842fd",
  cd118Dbf: "577a26e1d57e171e105ab3efc241d4a72a3b39df3f7519e5e78c00528caf8544",
  cd119File: "2d5e68577dcc7638acfcad8727705a3e97ebca92f59cd16876b2e0efc8183066",
  cd119Dbf: "a5498324e387acad832288c1fee6da7daa706f81fd906734e70542e7f7edeb68",
} as const;
const TARGET_DISTRICTS = ["03", "06", "08", "11", "12", "13"] as const;
const CYCLES = [2022, 2024] as const;
const INHERITED_UNRESOLVED_GATES = [
  "Independent reviewer approval is required before factual promotion.",
  "Current identity and historical-to-current district geography must be resolved before evaluator use.",
  "A separately versioned 2026 package may be acquired only after county and state canvassing and certification.",
] as const;
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;
const RECEIPT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "mi-2022-house-democratic-primary-results-browser",
  "mi-2022-primary-board-certification-html",
  "mi-2024-house-democratic-primary-results-browser",
  "mi-2024-primary-board-signed-minutes-pdf",
  "mi-2024-primary-board-signed-minutes-text",
  "mi-2026-primary-unofficial-boundary-browser-20260805",
  "mi-2026-election-dates-pdf",
  "mi-2026-election-dates-text",
  "mi-primary-results-catalog-snapshot-20260805",
  "mi-canvass-certification-authority-snapshot-20260805",
] as const;
const IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "michigan-house-democratic-primary-results-2022-2026-v1",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "michigan-house-democratic-primary-results-2022-2026-v1",
  "michigan-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-26",
  "tiger-cd119-26",
] as const;
const OUTPUT_FILE_SHA256 = "fc446b4ae756064ec52b2541ea9fd2b6338b975dcc116c47c62a11a657fc6889" as const;
const OUTPUT_BYTE_SIZE = 23_360 as const;

type IdentityStatus = "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
type Row = Readonly<{
  observationId: string;
  identityObservationId: string;
  identityRowSha256: string;
  identityStatus: IdentityStatus;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-08-02" | "2024-08-06";
  seatCycleId: string;
  districtCode: string;
  sourceWinnerStatus: "not_marked_by_source";
  targetCd119Geoid: string;
  historicalCongressSession: "118" | "119";
  historicalGeoid: string;
  compatibilityDisposition:
    | "official_no_plan_change_declaration_same_geoid_key_candidate"
    | "same_cd119_session_and_geoid_exact_key_candidate";
  evidenceClass: "direct_official_plan_continuity_and_derived_key" | "derived_exact_session_and_key";
  confidence: "high";
  compatibilityCandidate: true;
  compatibilityApproved: false;
  identityApproved: false;
  resultDispositionPreserved: true;
  certificationStatus: "state_board_event_certification_retained";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type MichiganPrimaryGeographyCandidate = Readonly<{
  schema: typeof MICHIGAN_PRIMARY_GEOGRAPHY_V1;
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
    contestCycleObservations: 12;
    identityProposedLinkRows: 11;
    identityNoMatchRows: 1;
    cd118ToCd119PlanContinuityCandidates: 6;
    exactCd119SessionKeyCandidates: 6;
    numberedDistrictsPerRetainedLayer: 13;
    specialDistrictRowsPerRetainedLayer: 0;
    compatibilityCandidates: 12;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type MichiganPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: MichiganPrimaryReceipt;
  receiptFileSha256: string;
  identity: MichiganPrimaryIdentityCandidate;
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
const fail = (code: string): never => { throw new Error(`Michigan primary geography rejected: ${code}`); };
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (rows: readonly Row[]) => rows.map((row) => ({
  observationId: row.observationId,
  identityObservationId: row.identityObservationId,
  identityRowSha256: row.identityRowSha256,
  identityStatus: row.identityStatus,
  contestId: row.contestId,
  contestSha256: row.contestSha256,
  cycleYear: row.cycleYear,
  seatCycleId: row.seatCycleId,
  districtCode: row.districtCode,
  sourceWinnerStatus: row.sourceWinnerStatus,
  targetCd119Geoid: row.targetCd119Geoid,
  historicalCongressSession: row.historicalCongressSession,
  historicalGeoid: row.historicalGeoid,
  compatibilityDisposition: row.compatibilityDisposition,
}));

function parseDbf(bytes: Buffer, session: "118" | "119") {
  if (bytes.length < 65 || bytes[0] !== 3) fail("DBF_HEADER_INVALID");
  const count = bytes.readUInt32LE(4), headerLength = bytes.readUInt16LE(8), recordLength = bytes.readUInt16LE(10);
  const fields: Array<{ name: string; length: number; offset: number }> = [];
  let offset = 1;
  for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) {
    const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/g, "").trim();
    const length = bytes[cursor + 16]!;
    if (!name || length < 1) fail("DBF_FIELD_INVALID");
    fields.push({ name, length, offset });
    offset += length;
  }
  if (count !== 13 || headerLength + count * recordLength > bytes.length || offset !== recordLength ||
    bytes[headerLength - 1] !== 0x0d) fail("DBF_LAYOUT_INVALID");
  const historical = session === "118";
  const stateField = historical ? "STATEFP20" : "STATEFP";
  const geoidField = historical ? "GEOID20" : "GEOID";
  const districtField = historical ? "CD118FP" : "CD119FP";
  const rows = Array.from({ length: count }, (_, index) => {
    const start = headerLength + index * recordLength;
    if (bytes[start] !== 0x20) fail("DBF_DELETED_RECORD");
    const value = Object.fromEntries(fields.map((field) => [
      field.name,
      bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim(),
    ]));
    return { state: value[stateField], geoid: value[geoidField], district: value[districtField], session: value.CDSESSN };
  }).sort((left, right) => bytewise(left.geoid ?? "", right.geoid ?? ""));
  if (rows.some((row, index) => row.state !== "26" || row.geoid !== `26${String(index + 1).padStart(2, "0")}` ||
    row.district !== String(index + 1).padStart(2, "0") || row.session !== session)) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildMichiganPrimaryGeographyCandidate(
  input: MichiganPrimaryGeographyInput,
): MichiganPrimaryGeographyCandidate {
  const actualHashes = [input.proposalFileSha256, input.receiptFileSha256, input.identityFileSha256,
    input.authorityFileSha256, input.cd118FileSha256, input.cd119FileSha256, sha256(input.authorityHtml),
    sha256(input.cd118Zip), sha256(input.cd118Dbf), sha256(input.cd119Zip), sha256(input.cd119Dbf)];
  const expectedHashes = [INPUTS.proposalFile, INPUTS.receiptFile, INPUTS.identityFile, INPUTS.authorityFile,
    INPUTS.cd118File, INPUTS.cd119File, INPUTS.authorityFile, INPUTS.cd118File, INPUTS.cd118Dbf,
    INPUTS.cd119File, INPUTS.cd119Dbf];
  if (actualHashes.some((value, index) => value !== expectedHashes[index])) fail("INPUT_HASH_MISMATCH");
  if (!input.cd118Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    !input.cd119Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) fail("ZIP_FORMAT_INVALID");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateMichiganPrimaryReceipt(input.receipt);
  const identity = validateMichiganPrimaryIdentityCandidate(input.identity);
  const decision = proposal.decisions.find((candidate) =>
    candidate.decisionId === "approve-historical-district-cd119-compatibility-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || decision?.resolution !== null ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    receipt.review.resolution !== null || identity.review.status !== "proposed" || identity.review.reviewer !== null ||
    identity.review.reviewedAt !== null || identity.review.resolution !== null ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(identity.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)) fail("PARENT_INVALID");
  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Michigan")) fail("AUTHORITY_INVALID");
  const cd118 = parseDbf(input.cd118Dbf, "118"), cd119 = parseDbf(input.cd119Dbf, "119");
  const inventoryKeys = new Set([...cd118, ...cd119].map((row) => `${row.session}:${row.geoid}`));
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["michigan-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/michigan-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["michigan-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/michigan-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-26", INPUTS.cd118File, "data/source/tiger2022/tl_2022_26_cd118.zip", "source", []],
    ["tiger-cd119-26", INPUTS.cd119File, "data/source/tiger2025/tl_2025_26_cd119.zip", "source", []],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === MICHIGAN_PRIMARY_GEOGRAPHY_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/michigan-primary-geography-compatibility-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = identity.observations.map((observation) => {
    const targetCd119Geoid = `26${observation.districtCode}`;
    const historicalCongressSession = observation.cycleYear === 2022 ? "118" as const : "119" as const;
    if (!inventoryKeys.has(`119:${targetCd119Geoid}`) || !inventoryKeys.has(`${historicalCongressSession}:${targetCd119Geoid}`)) {
      fail("IDENTITY_OBSERVATION_OUTSIDE_TIGER_CLOSURE");
    }
    const contests = receipt.contests.filter((contest) => contest.contestId === observation.contestId);
    if (contests.length !== 1 || contests[0]!.contestSha256 !== observation.contestSha256 ||
      contests[0]!.cycleYear !== observation.cycleYear || contests[0]!.districtCode !== observation.districtCode ||
      contests[0]!.sourceWinnerStatus !== "not_marked_by_source") fail("RECEIPT_IDENTITY_MISMATCH");
    const continuity = observation.cycleYear === 2022;
    const unsigned = {
      observationId: `mi:geography:${observation.cycleYear}:${observation.districtCode}`,
      identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256,
      identityStatus: observation.identityStatus,
      contestId: observation.contestId,
      contestSha256: observation.contestSha256,
      cycleYear: observation.cycleYear,
      electionDate: observation.electionDate,
      seatCycleId: observation.seatCycleId,
      districtCode: observation.districtCode,
      sourceWinnerStatus: "not_marked_by_source" as const,
      targetCd119Geoid,
      historicalCongressSession,
      historicalGeoid: targetCd119Geoid,
      compatibilityDisposition: continuity
        ? "official_no_plan_change_declaration_same_geoid_key_candidate" as const
        : "same_cd119_session_and_geoid_exact_key_candidate" as const,
      evidenceClass: continuity
        ? "direct_official_plan_continuity_and_derived_key" as const
        : "derived_exact_session_and_key" as const,
      confidence: "high" as const,
      compatibilityCandidate: true as const,
      compatibilityApproved: false as const,
      identityApproved: false as const,
      resultDispositionPreserved: true as const,
      certificationStatus: "state_board_event_certification_retained" as const,
      evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
      scoreEligible: false as const,
      rationaleCodes: continuity
        ? ["official_census_cd119_redraw_list_excludes_mi", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_unmarked"]
        : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_unmarked"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:mi-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));
  if (rows.length !== 12 || rows.filter((row) => row.identityStatus === "proposed_identity_link").length !== 11 ||
    rows.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length !== 1) fail("OBSERVATION_CLOSURE_INVALID");
  const projectionSha256 = digest("dsa-seats:mi-primary-geography-parent-projection:v1\0", parentProjection(rows));
  const unsigned = {
    schema: MICHIGAN_PRIMARY_GEOGRAPHY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T07:00:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      sourceSelectionProposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, decisionUnresolved: true },
      michiganReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
      michiganIdentity: { sourceLockId: required[2][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      censusPlanChangeAuthority: { sourceLockId: required[3][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_mi_absent" },
      tigerLayers: [
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", numberedDistrictCount: 13, specialDistrictCount: 0 },
        { sourceLockId: required[5][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", numberedDistrictCount: 13, specialDistrictCount: 0 },
      ],
    },
    methodology: {
      targetSession: "119",
      cycleSessionMapping: { "2022": "118", "2024": "119" },
      rowGrain: "current_target_identity_observation",
      identityDispositionPreserved: true,
      rawTigerGeometryEqualityAssessed: false,
      overlapThresholdUsed: false,
      populationEquivalenceAssessed: false,
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      future2026Rows: 0,
      parentProjectionSha256: projectionSha256,
    },
    summary: {
      contestCycleObservations: 12 as const,
      identityProposedLinkRows: 11 as const,
      identityNoMatchRows: 1 as const,
      cd118ToCd119PlanContinuityCandidates: 6 as const,
      exactCd119SessionKeyCandidates: 6 as const,
      numberedDistrictsPerRetainedLayer: 13 as const,
      specialDistrictRowsPerRetainedLayer: 0 as const,
      compatibilityCandidates: 12 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:mi-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      resolution: null,
      analysisConclusion: "official_evidence_supports_mi_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_without_changing_identity_dispositions",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:mi-primary-geography-candidate:v1\0", unsigned) };
}

export function validateMichiganPrimaryGeographyCandidate(
  value: MichiganPrimaryGeographyCandidate,
): MichiganPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (value.schema !== MICHIGAN_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T07:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 12 ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) || value.decisionSupport.resolution !== null) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => TARGET_DISTRICTS.map((district) => `mi:geography:${cycle}:${district}`)).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "identityObservationId", "identityRowSha256", "identityStatus", "contestId", "contestSha256", "cycleYear", "electionDate", "seatCycleId", "districtCode", "sourceWinnerStatus", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "resultDispositionPreserved", "certificationStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsigned } = row;
    const continuity = row.cycleYear === 2022, geoid = `26${row.districtCode}`;
    const expectedIdentityStatus = row.observationId === "mi:geography:2022:08"
      ? "reported_contest_no_unique_candidate_match" : "proposed_identity_link";
    const expectedDisposition = continuity ? "official_no_plan_change_declaration_same_geoid_key_candidate" : "same_cd119_session_and_geoid_exact_key_candidate";
    const expectedEvidence = continuity ? "direct_official_plan_continuity_and_derived_key" : "derived_exact_session_and_key";
    const expectedRationale = continuity
      ? ["official_census_cd119_redraw_list_excludes_mi", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_unmarked"]
      : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_unmarked"];
    if (rowSha256 !== digest("dsa-seats:mi-primary-geography-row:v1\0", unsigned) ||
      !TARGET_DISTRICTS.includes(row.districtCode as typeof TARGET_DISTRICTS[number]) || row.observationId !== `mi:geography:${row.cycleYear}:${row.districtCode}` ||
      row.identityObservationId !== `mi:identity:${row.cycleYear}:${row.districtCode}` || row.identityStatus !== expectedIdentityStatus ||
      row.seatCycleId !== `seat_house_mi_${row.districtCode}_current` || row.targetCd119Geoid !== geoid || row.historicalGeoid !== geoid ||
      row.historicalCongressSession !== (continuity ? "118" : "119") || row.compatibilityDisposition !== expectedDisposition ||
      row.evidenceClass !== expectedEvidence || row.confidence !== "high" || !row.compatibilityCandidate || row.compatibilityApproved ||
      row.identityApproved || !row.resultDispositionPreserved || row.certificationStatus !== "state_board_event_certification_retained" ||
      row.sourceWinnerStatus !== "not_marked_by_source" || row.scoreEligible || canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationale) ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)) fail("ROW_INVALID");
  }
  const expectedSummary = { contestCycleObservations: 12, identityProposedLinkRows: 11, identityNoMatchRows: 1,
    cd118ToCd119PlanContinuityCandidates: 6, exactCd119SessionKeyCandidates: 6, numberedDistrictsPerRetainedLayer: 13,
    specialDistrictRowsPerRetainedLayer: 0, compatibilityCandidates: 12, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  if (canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (digest("dsa-seats:mi-primary-geography-parent-projection:v1\0", parentProjection(value.rows)) !== MICHIGAN_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 ||
    value.rowSetSha256 !== digest("dsa-seats:mi-primary-geography-row-set:v1\0", value.rows) || value.rowSetSha256 !== MICHIGAN_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:mi-primary-geography-candidate:v1\0", unsigned) || packageSha256 !== MICHIGAN_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}

export const MICHIGAN_PRIMARY_GEOGRAPHY_OUTPUT_PARENTS = OUTPUT_PARENTS;
