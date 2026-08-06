import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateArizonaPrimaryIdentityCandidate,
  type ArizonaPrimaryIdentityCandidate,
} from "./arizona-current-incumbent-primary-linkage-candidate";
import {
  validateArizonaPrimaryReceipt,
  type ArizonaPrimaryReceipt,
} from "./arizona-house-democratic-primary-results-receipt";

export const ARIZONA_PRIMARY_GEOGRAPHY_V1 =
  "arizona-primary-geography-compatibility-candidate-v1" as const;
export const ARIZONA_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 =
  "e84ff45fcba79a5b8a71ee547773f4b64fc7584c3029538faa47c64270439c53" as const;
export const ARIZONA_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 =
  "dbd5787cd646ad09e7aa34f6deed614795c7972c6ef970c6ad3badcb46b46271" as const;
export const ARIZONA_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 =
  "56ca8382bb1a13591a5cf2ae8d25d0a1b069744cfdd8ccc6a643d0be9a64c2a2" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "17f6148269291c59942b43f3f012c6f0396b0fc52ef7f0384c4c53762d755e36",
  receiptPackage: "119a76ada904d3d03e121ecce285841492654b02d24572cd3f2b690d974eb752",
  receiptSet: "98e56f97d7c18b72c36f89c5132f82de426cff7292437e4fed9dad10e6417548",
  identityFile: "3ef6f3a9e8d63e74fc20086101e838fce02b177ee1b5fdf53220b26c396350fd",
  identityPackage: "ba49c03b31206990f5427df19aa60daad3bc4ee05d2fbc92695cb939c1c29ea9",
  identitySet: "e4bac18f0961d7fad61e7a90cfa9e8e2f7d7b64022a2898709b6c1a778a01913",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "26f7d5b1d693530d7562ca4aede3272fdf3ca9d127038f2be30fdbbb412aee58",
  cd118Dbf: "2998f4ac4396078c09e642070352741e7ba9a46c17bc29666d0a142c249e8a35",
  cd119File: "6eac2bd5c22110c21f0c22720f99317a72fe68cd943800ee266c970e54b2d674",
  cd119Dbf: "91f58004b83423adc4e2f42e84feb3c52cd512923bb28ff81155c08b4263b40b",
} as const;
const TARGET_DISTRICTS = ["03", "04", "07"] as const;
const CYCLES = [2022, 2024] as const;
const INHERITED_UNRESOLVED_GATES = [
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "decide_nonstandard_primary_disposition_treatment",
  "review_progressive_candidate_classification",
  "acquire_separately_versioned_2026_certified_canvass_after_source_cutoff",
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
] as const;
const IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "arizona-house-democratic-primary-results-2022-2026-v1",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "arizona-house-democratic-primary-results-2022-2026-v1",
  "arizona-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-04",
  "tiger-az",
] as const;
const OUTPUT_FILE_SHA256 = "adfa36d809512c5f3973c72992dbad39cb4b8031f7cc79d5f8fe177c8e9c02e0" as const;
const OUTPUT_BYTE_SIZE = 14_465 as const;

type IdentityStatus = "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
type Row = Readonly<{
  observationId: string;
  identityObservationId: string;
  identityRowSha256: string;
  identityStatus: IdentityStatus;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-08-02" | "2024-07-30";
  seatCycleId: string;
  districtCode: string;
  sourceWinnerStatus: "marked_by_source";
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
  resultAuthorityStatus: "certified_official_statewide_canvass" | "certified_final_recount_and_court_order";
  resultRevisionStatus: "initial_canvass_final_for_contest" | "final_recount_supersedes_initial_canvass";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type ArizonaPrimaryGeographyCandidate = Readonly<{
  schema: typeof ARIZONA_PRIMARY_GEOGRAPHY_V1;
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
    contestCycleObservations: 6;
    identityProposedLinkRows: 3;
    identityNoMatchRows: 3;
    cd118ToCd119PlanContinuityCandidates: 3;
    exactCd119SessionKeyCandidates: 3;
    numberedDistrictsPerRetainedLayer: 9;
    specialDistrictRowsPerRetainedLayer: 0;
    compatibilityCandidates: 6;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type ArizonaPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: ArizonaPrimaryReceipt;
  receiptFileSha256: string;
  identity: ArizonaPrimaryIdentityCandidate;
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
const fail = (code: string): never => { throw new Error(`Arizona primary geography rejected: ${code}`); };
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
  resultAuthorityStatus: row.resultAuthorityStatus,
  resultRevisionStatus: row.resultRevisionStatus,
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
  if (count !== 9 || headerLength + count * recordLength > bytes.length || offset !== recordLength ||
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
  if (rows.some((row, index) => row.state !== "04" || row.geoid !== `04${String(index + 1).padStart(2, "0")}` ||
    row.district !== String(index + 1).padStart(2, "0") || row.session !== session)) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildArizonaPrimaryGeographyCandidate(
  input: ArizonaPrimaryGeographyInput,
): ArizonaPrimaryGeographyCandidate {
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
  const receipt = validateArizonaPrimaryReceipt(input.receipt);
  const identity = validateArizonaPrimaryIdentityCandidate(input.identity);
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
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Arizona")) fail("AUTHORITY_INVALID");
  const cd118 = parseDbf(input.cd118Dbf, "118"), cd119 = parseDbf(input.cd119Dbf, "119");
  const inventoryKeys = new Set([...cd118, ...cd119].map((row) => `${row.session}:${row.geoid}`));
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["arizona-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/arizona-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["arizona-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/arizona-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-04", INPUTS.cd118File, "data/source/tiger2022/tl_2022_04_cd118.zip", "source", []],
    ["tiger-az", INPUTS.cd119File, "data/source/tiger2025/tl_2025_04_cd119.zip", "source", []],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === ARIZONA_PRIMARY_GEOGRAPHY_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/arizona-primary-geography-compatibility-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = identity.observations.map((observation) => {
    const targetCd119Geoid = `04${observation.districtCode}`;
    const historicalCongressSession = observation.cycleYear === 2022 ? "118" as const : "119" as const;
    if (!inventoryKeys.has(`119:${targetCd119Geoid}`) || !inventoryKeys.has(`${historicalCongressSession}:${targetCd119Geoid}`)) {
      fail("IDENTITY_OBSERVATION_OUTSIDE_TIGER_CLOSURE");
    }
    const contests = receipt.contests.filter((contest) => contest.contestId === observation.contestId);
    if (contests.length !== 1 || contests[0]!.contestSha256 !== observation.contestSha256 ||
      contests[0]!.cycleYear !== observation.cycleYear || contests[0]!.districtCode !== observation.districtCode ||
      contests[0]!.sourceWinnerStatus !== "marked_by_source" ||
      contests[0]!.resultAuthorityStatus !== observation.resultAuthorityStatus ||
      contests[0]!.resultRevisionStatus !== observation.resultRevisionStatus) fail("RECEIPT_IDENTITY_MISMATCH");
    const continuity = observation.cycleYear === 2022;
    const unsigned = {
      observationId: `az:geography:${observation.cycleYear}:${observation.districtCode}`,
      identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256,
      identityStatus: observation.identityStatus,
      contestId: observation.contestId,
      contestSha256: observation.contestSha256,
      cycleYear: observation.cycleYear,
      electionDate: observation.electionDate,
      seatCycleId: observation.seatCycleId,
      districtCode: observation.districtCode,
      sourceWinnerStatus: "marked_by_source" as const,
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
      resultAuthorityStatus: observation.resultAuthorityStatus,
      resultRevisionStatus: observation.resultRevisionStatus,
      evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
      scoreEligible: false as const,
      rationaleCodes: continuity
        ? ["official_census_cd119_redraw_list_excludes_az", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_marker_preserved_not_selection"]
        : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_marker_preserved_not_selection"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:az-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));
  if (rows.length !== 6 || rows.filter((row) => row.identityStatus === "proposed_identity_link").length !== 3 ||
    rows.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length !== 3) fail("OBSERVATION_CLOSURE_INVALID");
  const projectionSha256 = digest("dsa-seats:az-primary-geography-parent-projection:v1\0", parentProjection(rows));
  const unsigned = {
    schema: ARIZONA_PRIMARY_GEOGRAPHY_V1,
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
      arizonaReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
      arizonaIdentity: { sourceLockId: required[2][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      censusPlanChangeAuthority: { sourceLockId: required[3][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_az_absent" },
      tigerLayers: [
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", numberedDistrictCount: 9, specialDistrictCount: 0 },
        { sourceLockId: required[5][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", numberedDistrictCount: 9, specialDistrictCount: 0 },
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
      contestCycleObservations: 6 as const,
      identityProposedLinkRows: 3 as const,
      identityNoMatchRows: 3 as const,
      cd118ToCd119PlanContinuityCandidates: 3 as const,
      exactCd119SessionKeyCandidates: 3 as const,
      numberedDistrictsPerRetainedLayer: 9 as const,
      specialDistrictRowsPerRetainedLayer: 0 as const,
      compatibilityCandidates: 6 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:az-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      resolution: null,
      analysisConclusion: "official_evidence_supports_az_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_without_changing_identity_dispositions",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:az-primary-geography-candidate:v1\0", unsigned) };
}

export function validateArizonaPrimaryGeographyCandidate(
  value: ArizonaPrimaryGeographyCandidate,
): ArizonaPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (value.schema !== ARIZONA_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T07:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 6 ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) || value.decisionSupport.resolution !== null) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => TARGET_DISTRICTS.map((district) => `az:geography:${cycle}:${district}`)).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "identityObservationId", "identityRowSha256", "identityStatus", "contestId", "contestSha256", "cycleYear", "electionDate", "seatCycleId", "districtCode", "sourceWinnerStatus", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "resultDispositionPreserved", "resultAuthorityStatus", "resultRevisionStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsigned } = row;
    const continuity = row.cycleYear === 2022, geoid = `04${row.districtCode}`;
    const expectedIdentityStatus = ["az:geography:2022:03", "az:geography:2022:07", "az:geography:2024:07"].includes(row.observationId)
      ? "reported_contest_no_unique_candidate_match" : "proposed_identity_link";
    const expectedDisposition = continuity ? "official_no_plan_change_declaration_same_geoid_key_candidate" : "same_cd119_session_and_geoid_exact_key_candidate";
    const expectedEvidence = continuity ? "direct_official_plan_continuity_and_derived_key" : "derived_exact_session_and_key";
    const recount = row.observationId === "az:geography:2024:03";
    const expectedRationale = continuity
      ? ["official_census_cd119_redraw_list_excludes_az", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_marker_preserved_not_selection"]
      : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_marker_preserved_not_selection"];
    if (rowSha256 !== digest("dsa-seats:az-primary-geography-row:v1\0", unsigned) ||
      !TARGET_DISTRICTS.includes(row.districtCode as typeof TARGET_DISTRICTS[number]) || row.observationId !== `az:geography:${row.cycleYear}:${row.districtCode}` ||
      row.identityObservationId !== `az:identity:${row.cycleYear}:${row.districtCode}` || row.identityStatus !== expectedIdentityStatus ||
      row.seatCycleId !== `seat_house_az_${row.districtCode}_current` || row.targetCd119Geoid !== geoid || row.historicalGeoid !== geoid ||
      row.historicalCongressSession !== (continuity ? "118" : "119") || row.compatibilityDisposition !== expectedDisposition ||
      row.evidenceClass !== expectedEvidence || row.confidence !== "high" || !row.compatibilityCandidate || row.compatibilityApproved ||
      row.identityApproved || !row.resultDispositionPreserved ||
      row.resultAuthorityStatus !== (recount ? "certified_final_recount_and_court_order" : "certified_official_statewide_canvass") ||
      row.resultRevisionStatus !== (recount ? "final_recount_supersedes_initial_canvass" : "initial_canvass_final_for_contest") ||
      row.sourceWinnerStatus !== "marked_by_source" || row.scoreEligible || canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationale) ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)) fail("ROW_INVALID");
  }
  const expectedSummary = { contestCycleObservations: 6, identityProposedLinkRows: 3, identityNoMatchRows: 3,
    cd118ToCd119PlanContinuityCandidates: 3, exactCd119SessionKeyCandidates: 3, numberedDistrictsPerRetainedLayer: 9,
    specialDistrictRowsPerRetainedLayer: 0, compatibilityCandidates: 6, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  if (canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (digest("dsa-seats:az-primary-geography-parent-projection:v1\0", parentProjection(value.rows)) !== ARIZONA_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 ||
    value.rowSetSha256 !== digest("dsa-seats:az-primary-geography-row-set:v1\0", value.rows) || value.rowSetSha256 !== ARIZONA_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:az-primary-geography-candidate:v1\0", unsigned) || packageSha256 !== ARIZONA_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}

export const ARIZONA_PRIMARY_GEOGRAPHY_OUTPUT_PARENTS = OUTPUT_PARENTS;
