import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import { validateNewYorkPrimaryIdentityCandidate } from "./new-york-current-incumbent-primary-linkage-candidate";
import { validateNewYorkPrimaryDispositionsV2Receipt } from "./new-york-house-democratic-primary-dispositions-v2-receipt";

export const NEW_YORK_PRIMARY_GEOGRAPHY_V1 = "new-york-primary-geography-compatibility-candidate-v1" as const;
export const NEW_YORK_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 = "81d251dbbc6bbd9c1e3185abb7e161ab01b0332ec8439df69edb02a739aa85fb";
export const NEW_YORK_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 = "c5839d2fb9dd4cc6f463a3adf2520a43b1c6484e2f7d95c6b2e1eb0470611b5d";

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  dispositionsFile: "33520e143126e6e706222e00db9818ef43349ce2d2ce5e6c3424a3fead45dacf",
  dispositionsPackage: "708fb98844ecbb3664a10be938459d93e487cf2a7c16cc4e0ae573f4361de645",
  dispositionsSet: "e1bbe206bf5d2e10d16e1e6fdfafbf296eb4d50221b51904e5f4ec3007b9f6fb",
  identityFile: "094eccb9a8c9e14a22cc3133d92775fa58c6fd60bebf8aa9df2a870f53061edc",
  identityPackage: "193cf7041b027d542f6a72a9a40bc356f8ba3e502d1b61db7e85440df51418fe",
  identitySet: "b62cb6048e08fc09a0e983b50d2ac36d7b0ad5e1efb3ca3bc43f00e5f0220768",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "038a6cc7a89bd9833d9698993683628c82598a085e87093bbd978af7454dd7fa",
  cd118Dbf: "f53ed96ec308887bf14b6b829deefbae6ecaa23027da40a6ae3bb6fdabbaf91f",
  cd119File: "0955e0f7060dd43af98d939cbabb10df578901184472cbba57c91518c52991c7",
  cd119Dbf: "2d603cef159f14ef771f453f5acbe5155816dd41649acbc1a6c130f0f11f5586",
} as const;
const TARGETS = ["03", "04", "05", "06", "07", "08", "09", "10", "12", "13", "14", "15", "16", "18", "19", "20", "22", "25", "26"] as const;
const PROPOSAL_PARENTS = ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"] as const;
const DISPOSITION_PARENTS = ["new-york-house-democratic-primary-dispositions-2022-2024-v1", "new-york-city-house-democratic-primary-certified-results-2022-2024-v1"] as const;
const IDENTITY_PARENTS = ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "new-york-house-democratic-primary-dispositions-2022-2024-v2", "new-york-house-democratic-primary-reported-results-2022-2024-v1", "new-york-city-house-democratic-primary-certified-results-2022-2024-v1"] as const;
const OUTPUT_PARENTS = ["house-democratic-primary-source-selection-proposal-20260804-v1", "new-york-house-democratic-primary-dispositions-2022-2024-v2", "new-york-current-incumbent-primary-linkage-candidate-v1", "census-cd119-plan-change-authority-20260805", "tiger-cd118-36", "tiger-cd119-36"] as const;
const OUTPUT_FILE_SHA256 = "8f0410959243684b03a2575eb989d23839854c17d3b4b4fe4e6416be932f5096";
const OUTPUT_BYTE_SIZE = 67_071;

type Row = Readonly<{
  observationId: string; identityObservationId: string; identityRowSha256: string;
  identityStatus: "proposed_identity_link" | "reported_contest_no_unique_candidate_match" | "not_applicable_no_reported_contest";
  contestId: string | null; contestSha256: string | null; cycleYear: 2022 | 2024; electionDate: "2022-08-23" | "2024-06-25";
  seatCycleId: string; districtCode: string; resultDisposition: "reported_contest" | "certified_uncontested" | "unresolved_outside_retained_authority_scope";
  resultAuthorityStatus: "official_reported_contest_candidate" | "local_canvassing_board_certified_candidate" | null;
  certificationStatus: "not_independently_retained" | "local_canvassing_board_certified" | null;
  sourceWinnerStatus: "not_established_by_composition"; targetCd119Geoid: string; historicalCongressSession: "118" | "119"; historicalGeoid: string;
  compatibilityDisposition: "redraw_crosswalk_required" | "same_cd119_session_and_geoid_exact_key_candidate";
  evidenceClass: "authoritative_redraw_declared_crosswalk_not_retained" | "derived_exact_session_and_key";
  confidence: "none" | "high"; compatibilityCandidate: boolean; compatibilityApproved: false; identityApproved: false;
  identityDispositionPreserved: true; resultDispositionPreserved: true;
  evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval"; scoreEligible: false;
  rationaleCodes: readonly string[]; rowSha256: string;
}>;
export type NewYorkPrimaryGeographyCandidate = Readonly<{
  schema: typeof NEW_YORK_PRIMARY_GEOGRAPHY_V1; version: 1; generatedAt: "2026-08-06T13:00:00.000Z"; sourceCutoff: "2026-08-05";
  reviewerOnly: true; publicationEligible: false; defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: Readonly<Record<string, unknown>>; methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{ identityObservations: 38; identityProposedLinkRows: number; identityReportedNoMatchRows: number; identityNonreportedRows: number; redrawCrosswalkRequiredRows: number; exactCd119SessionKeyCandidates: number; numberedDistrictsPerRetainedLayer: 26; specialDistrictRowsPerRetainedLayer: 0; compatibilityCandidates: number; automaticallyApprovedRows: 0; scoreEligibleRows: 0 }>;
  rows: readonly Row[]; rowSetSha256: string; decisionSupport: Readonly<Record<string, unknown>>; packageSha256: string;
}>;
export type NewYorkPrimaryGeographyInput = Readonly<{ proposalJson: string; dispositionsJson: string; identityJson: string; authorityHtml: string; cd118Zip: Buffer; cd118Dbf: Buffer; cd119Zip: Buffer; cd119Dbf: Buffer; sourceLockJson: string }>;

const sha = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const order = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`New York primary geography rejected: ${code}`); };
const parse = (value: string, code: string): unknown => { try { return JSON.parse(value); } catch { return fail(code); } };

function inventory(bytes: Buffer, session: "118" | "119"): Set<string> {
  if (sha(bytes) !== (session === "118" ? INPUTS.cd118Dbf : INPUTS.cd119Dbf) || bytes.length < 65 || bytes[0] !== 3) fail("DBF_HASH_OR_HEADER_INVALID");
  const count = bytes.readUInt32LE(4), header = bytes.readUInt16LE(8), record = bytes.readUInt16LE(10);
  const fields: Array<{ name: string; offset: number; length: number }> = [];
  let fieldOffset = 1;
  for (let cursor = 32; cursor + 32 <= header && bytes[cursor] !== 0x0d; cursor += 32) {
    const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim(), length = bytes[cursor + 16]!;
    if (!name || !length) fail("DBF_FIELD_INVALID"); fields.push({ name, offset: fieldOffset, length }); fieldOffset += length;
  }
  if (count !== 26 || fieldOffset !== record || header + count * record > bytes.length || bytes[header - 1] !== 0x0d) fail("DBF_LAYOUT_INVALID");
  const old = session === "118", stateField = old ? "STATEFP20" : "STATEFP", geoidField = old ? "GEOID20" : "GEOID", districtField = old ? "CD118FP" : "CD119FP";
  const keys = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const start = header + index * record;
    const row = Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()]));
    if (bytes[start] !== 0x20 || row[stateField] !== "36" || row.CDSESSN !== session || row[geoidField] !== `36${row[districtField]}` || !/^\d{2}$/.test(row[districtField] ?? "")) fail("DBF_INVENTORY_INVALID");
    keys.add(row[geoidField]!);
  }
  if (keys.size !== 26 || Array.from({ length: 26 }, (_, index) => `36${String(index + 1).padStart(2, "0")}`).some((key) => !keys.has(key))) fail("DBF_INVENTORY_INVALID");
  return keys;
}

export function buildNewYorkPrimaryGeographyCandidate(input: NewYorkPrimaryGeographyInput): NewYorkPrimaryGeographyCandidate {
  if (sha(input.proposalJson) !== INPUTS.proposalFile || sha(input.dispositionsJson) !== INPUTS.dispositionsFile || sha(input.identityJson) !== INPUTS.identityFile || sha(input.authorityHtml) !== INPUTS.authorityFile || sha(input.cd118Zip) !== INPUTS.cd118File || sha(input.cd119Zip) !== INPUTS.cd119File || !input.cd118Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || !input.cd119Zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(parse(input.proposalJson, "PROPOSAL_JSON_INVALID"));
  const dispositions = validateNewYorkPrimaryDispositionsV2Receipt(parse(input.dispositionsJson, "DISPOSITIONS_JSON_INVALID") as Parameters<typeof validateNewYorkPrimaryDispositionsV2Receipt>[0]);
  const identity = validateNewYorkPrimaryIdentityCandidate(parse(input.identityJson, "IDENTITY_JSON_INVALID"));
  if (proposal.packageSha256 !== INPUTS.proposalPackage || dispositions.packageSha256 !== INPUTS.dispositionsPackage || dispositions.summary.dispositionSetSha256 !== INPUTS.dispositionsSet || identity.packageSha256 !== INPUTS.identityPackage || identity.observationSetSha256 !== INPUTS.identitySet || proposal.decisions.find((row) => row.decisionId === "approve-historical-district-cd119-compatibility-v1")?.resolution !== null || identity.review.resolution !== null) fail("PARENT_INVALID");
  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase)) fail("REDRAW_AUTHORITY_INVALID");
  const cd118 = inventory(input.cd118Dbf, "118"), cd119 = inventory(input.cd119Dbf, "119");
  const lock = parse(input.sourceLockJson, "SOURCE_LOCK_JSON_INVALID") as { entries?: Array<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256: string; kind: string; parentIds?: string[] }> };
  const required = [
    ["house-democratic-primary-source-selection-proposal-20260804-v1", INPUTS.proposalFile, "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "review_proposal", PROPOSAL_PARENTS],
    ["new-york-house-democratic-primary-dispositions-2022-2024-v2", INPUTS.dispositionsFile, "data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json", "review_candidate", DISPOSITION_PARENTS],
    ["new-york-current-incumbent-primary-linkage-candidate-v1", INPUTS.identityFile, "data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json", "review_candidate", IDENTITY_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-36", INPUTS.cd118File, "data/source/tiger2022/tl_2022_36_cd118.zip", "source", []],
    ["tiger-cd119-36", INPUTS.cd119File, "data/source/tiger2025/tl_2025_36_cd119.zip", "source", []],
  ] as const;
  const lockEntries: NonNullable<typeof lock.entries> = lock.entries ?? fail("SOURCE_LOCK_MISMATCH");
  if (required.some(([id, hash, path, kind, parents]) => { const rows = lockEntries.filter((entry) => entry.id === id); return rows.length !== 1 || rows[0]!.sha256 !== hash || rows[0]!.retainedPath !== path || rows[0]!.retainedStatus !== "retained" || rows[0]!.kind !== kind || canonicalJson(rows[0]!.parentIds) !== canonicalJson(parents); })) fail("SOURCE_LOCK_MISMATCH");
  const output = lockEntries.filter((entry) => entry.id === NEW_YORK_PRIMARY_GEOGRAPHY_V1);
  if (!OUTPUT_FILE_SHA256) { if (output.length) fail("SOURCE_LOCK_MISMATCH"); }
  else if (output.length !== 1 || output[0]!.retainedPath !== "data/metadata/new-york-primary-geography-compatibility-candidate-v1.json" || output[0]!.retainedStatus !== "retained" || output[0]!.byteSize !== OUTPUT_BYTE_SIZE || output[0]!.sha256 !== OUTPUT_FILE_SHA256 || output[0]!.kind !== "review_candidate" || canonicalJson(output[0]!.parentIds) !== canonicalJson(OUTPUT_PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = identity.observations.map((observation) => {
    const disposition = dispositions.rows.filter((row) => row.seatCycleId === observation.seatCycleId);
    if (disposition.length !== 1 || disposition[0]!.disposition !== observation.disposition) fail("IDENTITY_DISPOSITION_MISMATCH");
    const geoid = `36${observation.districtCode}`, pending = observation.cycleYear === 2022;
    if (!cd119.has(geoid) || !cd118.has(geoid)) fail("IDENTITY_OUTSIDE_TIGER_CLOSURE");
    const unsigned = {
      observationId: `ny:geography:${observation.cycleYear}:${observation.districtCode}`, identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256, identityStatus: observation.identityStatus, contestId: observation.contestId,
      contestSha256: observation.contestSha256, cycleYear: observation.cycleYear, electionDate: observation.electionDate,
      seatCycleId: observation.seatCycleId, districtCode: observation.districtCode, resultDisposition: observation.disposition,
      resultAuthorityStatus: observation.resultAuthorityStatus, certificationStatus: observation.certificationStatus,
      sourceWinnerStatus: observation.sourceWinnerStatus, targetCd119Geoid: geoid, historicalCongressSession: pending ? "118" as const : "119" as const,
      historicalGeoid: geoid,
      compatibilityDisposition: pending ? "redraw_crosswalk_required" as const : "same_cd119_session_and_geoid_exact_key_candidate" as const,
      evidenceClass: pending ? "authoritative_redraw_declared_crosswalk_not_retained" as const : "derived_exact_session_and_key" as const,
      confidence: pending ? "none" as const : "high" as const, compatibilityCandidate: !pending,
      compatibilityApproved: false as const, identityApproved: false as const, identityDispositionPreserved: true as const,
      resultDispositionPreserved: true as const, evaluatorUse: "excluded_pending_identity_historical_geography_disposition_review_and_publication_approval" as const,
      scoreEligible: false as const,
      rationaleCodes: pending ? ["official_census_cd119_redraw_list_includes_ny", "same_numbered_district_not_continuity_evidence", "authoritative_same_block_grain_crosswalk_not_retained", "identity_and_result_dispositions_unchanged"] : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory", "identity_and_result_dispositions_unchanged"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:ny-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => order(left.observationId, right.observationId));
  const rowSetSha256 = digest("dsa-seats:ny-primary-geography-row-set:v1\0", rows);
  const unsigned = {
    schema: NEW_YORK_PRIMARY_GEOGRAPHY_V1, version: 1 as const, generatedAt: "2026-08-06T13:00:00.000Z" as const, sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_identity_historical_geography_disposition_review_and_publication_approval" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: { sourceSelectionProposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, decisionUnresolved: true }, dispositions: { sourceLockId: required[1][0], fileSha256: INPUTS.dispositionsFile, packageSha256: INPUTS.dispositionsPackage, dispositionSetSha256: INPUTS.dispositionsSet }, identity: { sourceLockId: required[2][0], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet }, censusPlanChangeAuthority: { sourceLockId: required[3][0], fileSha256: INPUTS.authorityFile, authorityClaim: "new_york_redrew_for_cd119" }, tigerLayers: [{ sourceLockId: required[4][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, session: "118", numberedDistricts: 26 }, { sourceLockId: required[5][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, session: "119", numberedDistricts: 26 }] },
    methodology: { targetSession: "119", cycleSessionMapping: { "2022": "118", "2024": "119" }, redrawTreatment: "no_cd118_to_cd119_candidate_without_authoritative_same_block_grain_crosswalk", exactSessionTreatment: "same_cd119_session_state_and_district_key_candidate", rawTigerGeometryEqualityAssessed: false, districtNumberContinuityAssumed: false, overlapThresholdUsed: false, populationEquivalenceAssessed: false, automaticDecisionClosure: false, evaluatorNumericValues: 0 },
    summary: { identityObservations: 38 as const, identityProposedLinkRows: rows.filter((row) => row.identityStatus === "proposed_identity_link").length, identityReportedNoMatchRows: rows.filter((row) => row.identityStatus === "reported_contest_no_unique_candidate_match").length, identityNonreportedRows: rows.filter((row) => row.identityStatus === "not_applicable_no_reported_contest").length, redrawCrosswalkRequiredRows: rows.filter((row) => row.compatibilityDisposition === "redraw_crosswalk_required").length, exactCd119SessionKeyCandidates: rows.filter((row) => row.compatibilityCandidate).length, numberedDistrictsPerRetainedLayer: 26 as const, specialDistrictRowsPerRetainedLayer: 0 as const, compatibilityCandidates: rows.filter((row) => row.compatibilityCandidate).length, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const },
    rows, rowSetSha256,
    decisionSupport: { informsDecisionId: "approve-historical-district-cd119-compatibility-v1", status: "proposed", recommendedResolution: "accept_nineteen_2024_exact_session_keys_and_retain_all_nineteen_2022_rows_as_redraw_crosswalk_required", defaultAssumption: "exclude_all_rows_until_identity_geography_disposition_review", reviewerResolution: null, reviewer: null, reviewedAt: null },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:ny-primary-geography-candidate:v1\0", unsigned) };
}

export function validateNewYorkPrimaryGeographyCandidate(value: unknown): NewYorkPrimaryGeographyCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("PACKAGE_SHAPE_INVALID");
  const candidate = value as NewYorkPrimaryGeographyCandidate;
  if (candidate.schema !== NEW_YORK_PRIMARY_GEOGRAPHY_V1 || candidate.version !== 1 || !candidate.reviewerOnly || candidate.publicationEligible || candidate.review.status !== "proposed" || candidate.review.reviewer !== null || candidate.review.reviewedAt !== null || candidate.review.resolution !== null || candidate.rows.length !== 38 || candidate.rows.some((row) => row.compatibilityApproved || row.identityApproved || row.scoreEligible || (row.cycleYear === 2022 && (row.compatibilityCandidate || row.compatibilityDisposition !== "redraw_crosswalk_required" || row.confidence !== "none")) || (row.cycleYear === 2024 && (!row.compatibilityCandidate || row.compatibilityDisposition !== "same_cd119_session_and_geoid_exact_key_candidate" || row.confidence !== "high")))) fail("LIFECYCLE_INVALID");
  const expectedSummary = { identityObservations: 38, identityProposedLinkRows: 12, identityReportedNoMatchRows: 4, identityNonreportedRows: 22, redrawCrosswalkRequiredRows: 19, exactCd119SessionKeyCandidates: 19, numberedDistrictsPerRetainedLayer: 26, specialDistrictRowsPerRetainedLayer: 0, compatibilityCandidates: 19, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  if (canonicalJson(candidate.summary) !== canonicalJson(expectedSummary) || candidate.rows.some((row, index) => { const { rowSha256, ...unsigned } = row; return rowSha256 !== digest("dsa-seats:ny-primary-geography-row:v1\0", unsigned) || !TARGETS.includes(row.districtCode as typeof TARGETS[number]) || row.observationId !== `ny:geography:${row.cycleYear}:${row.districtCode}` || row.identityObservationId !== `ny:identity:${row.cycleYear}:${row.districtCode}` || row.targetCd119Geoid !== `36${row.districtCode}` || row.historicalGeoid !== `36${row.districtCode}` || row.historicalCongressSession !== (row.cycleYear === 2022 ? "118" : "119") || (index > 0 && order(candidate.rows[index - 1]!.observationId, row.observationId) >= 0); })) fail("ROW_INVALID");
  if (candidate.rowSetSha256 !== digest("dsa-seats:ny-primary-geography-row-set:v1\0", candidate.rows)) fail("ROW_SET_INVALID");
  const { packageSha256, ...unsigned } = candidate;
  if (packageSha256 !== digest("dsa-seats:ny-primary-geography-candidate:v1\0", unsigned)) fail("PACKAGE_HASH_INVALID");
  if (NEW_YORK_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 && candidate.rowSetSha256 !== NEW_YORK_PRIMARY_GEOGRAPHY_ROW_SET_SHA256) fail("ROW_SET_IDENTITY_INVALID");
  if (NEW_YORK_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 && candidate.packageSha256 !== NEW_YORK_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("PACKAGE_IDENTITY_INVALID");
  return candidate;
}
