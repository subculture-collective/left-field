import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMarylandPrimaryIdentityCandidate,
  type MarylandPrimaryIdentityCandidate,
} from "./maryland-current-incumbent-primary-linkage-candidate";
import {
  validateMarylandPrimaryResultsReceipt,
  type MarylandPrimaryResultsReceipt,
} from "./maryland-house-democratic-primary-results-receipt";

export const MARYLAND_PRIMARY_GEOGRAPHY_V1 =
  "maryland-primary-geography-compatibility-candidate-v1" as const;
export const MARYLAND_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 = "05ef50a743f2f265faf83a4694dbc5331258baa0a70126cf7889585e4d9774dd";
export const MARYLAND_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 = "fec32c7a0508946cf9f33b2ad301e94062fec5aa6c56a868e96ae47737aa9d4b";
export const MARYLAND_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 = "64d0751b3dedd67871b459660ae459a4402443500b9af2a0b5bc6f458a392ea0";

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "0eb964436022b54e3e797bd8578687b2f0a506d8832200cdf33853fb2de2d59a",
  receiptPackage: "03876280eeb67b63462e568c243e7f015954ec48584f0c86aa0e03bc78025fae",
  receiptSet: "320cb49e83fb3df8266ffe0ef3600264a3a934bce4f926aea4d44693ec36d6f9",
  identityFile: "632a49ca04113a66b075ac2fe5e9ac37c0af03d52d908297ac77316411f71324",
  identityPackage: "c79fd8233aecd8ff2f2c0cb5cde0a7834df27bf818de1c346848d57727b4f16f",
  identitySet: "cb22b245da751503939a3b778cb9941696b815b6930da24359c85f2e94938269",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "142317ecc6eff27a9cc490663886b4d48ca2c6f4494aa68fb6d991ece8f88016",
  cd118Dbf: "2d3bff5178049477f2de933adb0d6081207c7e29c077f702007f8714072fa11a",
  cd119File: "f6cdfd5687a8b2edb86382177bea8901b731cbe6c4ded11d77aec7b67adce103",
  cd119Dbf: "9128bb236a6c60871d3f552ca066694a6963f153553483a1b44583bb5839fbc2",
} as const;
const TARGET_DISTRICTS = ["02", "03", "04", "05", "06", "07", "08"] as const;
const CYCLES = [2022, 2024] as const;
const INHERITED_UNRESOLVED_GATES = ["retain_independent_final_result_certification", "review_incumbent_candidate_identity", "review_historical_district_compatibility", "review_progressive_candidate_classification", "complete_human_data_review_and_publication_approval"] as const;
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;
const RECEIPT_PARENTS = ["md-2022-democratic-primary-congressional-breakdown", "md-2024-democratic-primary-congressional-breakdown"] as const;
const IDENTITY_PARENTS = [
  "dsa-target-incumbent-roster-20260804-v1",
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "house-xml",
  "congress-legislators-current-20260804",
  "maryland-house-democratic-primary-results-2022-2024-v1",
] as const;
const OUTPUT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "maryland-house-democratic-primary-results-2022-2024-v1",
  "maryland-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-24",
  "tiger-cd119-24",
] as const;
const OUTPUT_FILE_SHA256 = "9b4dd1d3d9a39ec8cb12d3817953a7dedaf146a73fac74541d489544338ecf1e";
const OUTPUT_BYTE_SIZE = 26_295;

type IdentityStatus = "proposed_identity_link" | "reported_contest_no_unique_candidate_match";
type Row = Readonly<{
  observationId: string;
  identityObservationId: string;
  identityRowSha256: string;
  identityStatus: IdentityStatus;
  contestId: string;
  contestSha256: string;
  cycleYear: 2022 | 2024;
  electionDate: "2022-07-19" | "2024-05-14";
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
  certificationStatus: "not_independently_retained";
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type MarylandPrimaryGeographyCandidate = Readonly<{
  schema: typeof MARYLAND_PRIMARY_GEOGRAPHY_V1;
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
    contestCycleObservations: 14;
    identityProposedLinkRows: 11;
    identityNoMatchRows: 3;
    cd118ToCd119PlanContinuityCandidates: 7;
    exactCd119SessionKeyCandidates: 7;
    numberedDistrictsPerRetainedLayer: 8;
    specialDistrictRowsPerRetainedLayer: 0;
    compatibilityCandidates: 14;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type MarylandPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: MarylandPrimaryResultsReceipt;
  receiptFileSha256: string;
  identity: MarylandPrimaryIdentityCandidate;
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
const fail = (code: string): never => { throw new Error(`Maryland primary geography rejected: ${code}`); };
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
  if (count !== 8 || headerLength + count * recordLength > bytes.length || offset !== recordLength ||
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
  if (rows.some((row, index) => row.state !== "24" || row.geoid !== `24${String(index + 1).padStart(2, "0")}` ||
    row.district !== String(index + 1).padStart(2, "0") || row.session !== session)) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildMarylandPrimaryGeographyCandidate(
  input: MarylandPrimaryGeographyInput,
): MarylandPrimaryGeographyCandidate {
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
  const receipt = validateMarylandPrimaryResultsReceipt(input.receipt);
  const identity = validateMarylandPrimaryIdentityCandidate(input.identity);
  const decision = proposal.decisions.find((candidate) =>
    candidate.decisionId === "approve-historical-district-cd119-compatibility-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet || identity.packageSha256 !== INPUTS.identityPackage ||
    identity.observationSetSha256 !== INPUTS.identitySet || decision?.resolution !== null ||
    receipt.review.status !== "proposed" || receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    identity.review.status !== "proposed" || identity.review.reviewer !== null ||
    identity.review.reviewedAt !== null || identity.review.resolution !== null ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) ||
    canonicalJson(identity.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)) fail("PARENT_INVALID");
  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Maryland")) fail("AUTHORITY_INVALID");
  const cd118 = parseDbf(input.cd118Dbf, "118"), cd119 = parseDbf(input.cd119Dbf, "119");
  const inventoryKeys = new Set([...cd118, ...cd119].map((row) => `${row.session}:${row.geoid}`));
  const lock = input.sourceLock as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["maryland-house-democratic-primary-results-2022-2024-v1", INPUTS.receiptFile, "data/metadata/maryland-house-democratic-primary-results-2022-2024-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["maryland-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/maryland-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-24", INPUTS.cd118File, "data/source/tiger2022/tl_2022_24_cd118.zip", "source", []],
    ["tiger-cd119-24", INPUTS.cd119File, "data/source/tiger2025/tl_2025_24_cd119.zip", "source", []],
  ] as const;
  if (!Array.isArray(lock.entries)) fail("SOURCE_LOCK_MISMATCH");
  const lockEntries = lock.entries as NonNullable<typeof lock.entries>;
  if (required.some(([id, file, path, kind, parents]) => {
    const matches = lockEntries.filter((entry) => entry.id === id);
    return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== file ||
      matches[0]!.retainedPath !== path || matches[0]!.kind !== kind || canonicalJson(matches[0]!.parentIds) !== canonicalJson(parents);
  })) fail("SOURCE_LOCK_MISMATCH");
  const outputMatches = lockEntries.filter((entry) => entry.id === MARYLAND_PRIMARY_GEOGRAPHY_V1);
  if (outputMatches.length !== 1 || outputMatches[0]!.retainedPath !==
    "data/metadata/maryland-primary-geography-compatibility-candidate-v1.json" ||
    outputMatches[0]!.retainedStatus !== "retained" || outputMatches[0]!.byteSize !== OUTPUT_BYTE_SIZE ||
    outputMatches[0]!.sha256 !== OUTPUT_FILE_SHA256 || outputMatches[0]!.kind !== "review_candidate" ||
    canonicalJson(outputMatches[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = identity.observations.map((observation) => {
    const targetCd119Geoid = `24${observation.districtCode}`;
    const historicalCongressSession = observation.cycleYear === 2022 ? "118" as const : "119" as const;
    if (!inventoryKeys.has(`119:${targetCd119Geoid}`) || !inventoryKeys.has(`${historicalCongressSession}:${targetCd119Geoid}`)) {
      fail("IDENTITY_OBSERVATION_OUTSIDE_TIGER_CLOSURE");
    }
    const contests = receipt.contests.filter((contest) => contest.contestId === observation.contestId);
    if (contests.length !== 1 || contests[0]!.contestSha256 !== observation.contestSha256 ||
      contests[0]!.cycleYear !== observation.cycleYear || contests[0]!.districtCode !== observation.districtCode ||
      contests[0]!.winnerSourceCandidateName === null) fail("RECEIPT_IDENTITY_MISMATCH");
    const continuity = observation.cycleYear === 2022;
    const unsigned = {
      observationId: `md:geography:${observation.cycleYear}:${observation.districtCode}`,
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
      certificationStatus: "not_independently_retained" as const,
      evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
      scoreEligible: false as const,
      rationaleCodes: continuity
        ? ["official_census_cd119_redraw_list_excludes_md", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_marker_not_approval"]
        : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_marker_not_approval"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:md-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));
  if (rows.length !== 14 || rows.filter((row) => row.identityStatus === "proposed_identity_link").length !== 11 ||
    rows.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length !== 3) fail("OBSERVATION_CLOSURE_INVALID");
  const projectionSha256 = digest("dsa-seats:md-primary-geography-parent-projection:v1\0", parentProjection(rows));
  const unsigned = {
    schema: MARYLAND_PRIMARY_GEOGRAPHY_V1,
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
      marylandReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
      marylandIdentity: { sourceLockId: required[2][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet },
      censusPlanChangeAuthority: { sourceLockId: required[3][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_md_absent" },
      tigerLayers: [
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", numberedDistrictCount: 8, specialDistrictCount: 0 },
        { sourceLockId: required[5][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", numberedDistrictCount: 8, specialDistrictCount: 0 },
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
      contestCycleObservations: 14 as const,
      identityProposedLinkRows: 11 as const,
      identityNoMatchRows: 3 as const,
      cd118ToCd119PlanContinuityCandidates: 7 as const,
      exactCd119SessionKeyCandidates: 7 as const,
      numberedDistrictsPerRetainedLayer: 8 as const,
      specialDistrictRowsPerRetainedLayer: 0 as const,
      compatibilityCandidates: 14 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:md-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      resolution: null,
      analysisConclusion: "official_evidence_supports_md_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_without_changing_identity_dispositions",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:md-primary-geography-candidate:v1\0", unsigned) };
}

export function validateMarylandPrimaryGeographyCandidate(
  value: MarylandPrimaryGeographyCandidate,
): MarylandPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (value.schema !== MARYLAND_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T07:00:00.000Z" ||
    value.sourceCutoff !== "2026-08-05" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" ||
    value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 14 ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES) || value.decisionSupport.resolution !== null) fail("LIFECYCLE_INVALID");
  const expectedIds = CYCLES.flatMap((cycle) => TARGET_DISTRICTS.map((district) => `md:geography:${cycle}:${district}`)).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "identityObservationId", "identityRowSha256", "identityStatus", "contestId", "contestSha256", "cycleYear", "electionDate", "seatCycleId", "districtCode", "sourceWinnerStatus", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "resultDispositionPreserved", "certificationStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsigned } = row;
    const continuity = row.cycleYear === 2022, geoid = `24${row.districtCode}`;
    const expectedIdentityStatus = ["md:geography:2022:02", "md:geography:2022:03", "md:geography:2022:06"].includes(row.observationId)
      ? "reported_contest_no_unique_candidate_match" : "proposed_identity_link";
    const expectedDisposition = continuity ? "official_no_plan_change_declaration_same_geoid_key_candidate" : "same_cd119_session_and_geoid_exact_key_candidate";
    const expectedEvidence = continuity ? "direct_official_plan_continuity_and_derived_key" : "derived_exact_session_and_key";
    const expectedRationale = continuity
      ? ["official_census_cd119_redraw_list_excludes_md", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory", "identity_disposition_unchanged", "source_winner_marker_not_approval"]
      : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_disposition_unchanged", "source_winner_marker_not_approval"];
    if (rowSha256 !== digest("dsa-seats:md-primary-geography-row:v1\0", unsigned) ||
      !TARGET_DISTRICTS.includes(row.districtCode as typeof TARGET_DISTRICTS[number]) || row.observationId !== `md:geography:${row.cycleYear}:${row.districtCode}` ||
      row.identityObservationId !== `md:identity:${row.cycleYear}:${row.districtCode}` || row.identityStatus !== expectedIdentityStatus ||
      row.seatCycleId !== `seat_house_md_${row.districtCode}_current` || row.targetCd119Geoid !== geoid || row.historicalGeoid !== geoid ||
      row.historicalCongressSession !== (continuity ? "118" : "119") || row.compatibilityDisposition !== expectedDisposition ||
      row.evidenceClass !== expectedEvidence || row.confidence !== "high" || !row.compatibilityCandidate || row.compatibilityApproved ||
      row.identityApproved || !row.resultDispositionPreserved || row.certificationStatus !== "not_independently_retained" ||
      row.sourceWinnerStatus !== "marked_by_source" || row.scoreEligible || canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationale) ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)) fail("ROW_INVALID");
  }
  const expectedSummary = { contestCycleObservations: 14, identityProposedLinkRows: 11, identityNoMatchRows: 3,
    cd118ToCd119PlanContinuityCandidates: 7, exactCd119SessionKeyCandidates: 7, numberedDistrictsPerRetainedLayer: 8,
    specialDistrictRowsPerRetainedLayer: 0, compatibilityCandidates: 14, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  if (canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson(expectedSummary)) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (digest("dsa-seats:md-primary-geography-parent-projection:v1\0", parentProjection(value.rows)) !== MARYLAND_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 ||
    value.rowSetSha256 !== digest("dsa-seats:md-primary-geography-row-set:v1\0", value.rows) ||
    value.rowSetSha256 !== MARYLAND_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:md-primary-geography-candidate:v1\0", unsigned) ||
    packageSha256 !== MARYLAND_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("PACKAGE_INVALID");
  return value;
}

export const MARYLAND_PRIMARY_GEOGRAPHY_OUTPUT_PARENTS = OUTPUT_PARENTS;
