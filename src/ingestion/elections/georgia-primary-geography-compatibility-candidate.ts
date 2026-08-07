import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateGeorgiaCd118Cd119BlockCrosswalkCandidate, type GeorgiaCd118Cd119BlockCrosswalkCandidate } from "./georgia-cd118-cd119-block-crosswalk-candidate";
import { validateGeorgiaPrimaryIdentityCandidate, type GeorgiaPrimaryIdentityCandidate } from "./georgia-current-incumbent-primary-linkage-candidate";
import { validateGeorgiaPrimaryResultsReceipt, type GeorgiaPrimaryResultsReceipt } from "./georgia-house-democratic-primary-results-receipt";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";

export const GEORGIA_PRIMARY_GEOGRAPHY_V1 = "georgia-primary-geography-compatibility-candidate-v1" as const;
export const GEORGIA_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 = "1aa4005af1d92db89fc31ee16376ed188674c29a088017ecabd9c2e9c790cbcb";
export const GEORGIA_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 = "ec9ec6661e280c370705835c1b4aeb552ed3710a7ee373abbb5105389fb7b206";
export const GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_FILE_SHA256 = "dda2fc91a18de2ccfac09e5604089d9ec72338be4699b50988f325d7f80c8d8e";
export const GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_BYTE_SIZE = 26094;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1", proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "cbf01649db31686e053544e2d616a1a52055117ee3f2747e8fed530266eb9308", receiptPackage: "0048130e863daae9d527528a1a004b73e811ff27ad1fac1d4d98ca13937944ee", receiptContestSet: "63233fddde9cf2a21543e7eb40ff182ed66d5a6b138108dcc43ad4577a74e82e", receiptTargetSet: "37413c20ce73f52e08990c321f397b15a788211aca8d6a18f5a2ec5c82881d06",
  identityFile: "1ded7ac81f648fc95259d1d07e967d9aaa59f533f1809e4e0be93a8fcd8a83ff", identityPackage: "00c7c11bd1e75cb5963eea3933d4b652e8ea2e3f4e3793056604e7634cdd25d5", identitySet: "b561d0f9d9c1f14f8cafb690bc40e2bc7742f9715fc419dcb6c75e286101741b",
  crosswalkFile: "b485a7dc92a37d00fc84c88dd583cada37edb21a501bfb69d69959e2c6270741", crosswalkPackage: "f79e588ca24be585665d345400456dfa604dc806e7ca465fd7dece874d5310a8", crosswalkSet: "9921959d244b269279e666c296c3024da7789a7510ab0775d1421e43bbbd3ebe",
  tigerFile: "faedb31a05744ce4c56e71d062af47a87a2b8906cf486361100aa478043b6f45", tigerDbf: "ec341a3b47b5db3e13f164d1d3810679a6c6058b5038992e07937fe04dea2bce",
} as const;
const PARENTS = ["house-democratic-primary-source-selection-proposal-20260804-v1", "georgia-house-democratic-primary-results-2022-2026-v1", "georgia-current-incumbent-primary-linkage-candidate-v1", "tiger-cd119-13", "georgia-cd118-cd119-block-crosswalk-candidate-v1"] as const;
const REQUIRED = [
  [PARENTS[0], "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  [PARENTS[1], "urn:dsa-seats:georgia-house-democratic-primary-results:v1:2022-2026", "data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json", 101663, INPUTS.receiptFile, "review_candidate", ["house-democratic-primary-source-selection-proposal-20260804-v1", "ga-2022-general-primary-total-votes-workbook", "ga-2024-general-primary-total-votes-workbook", "ga-2026-general-primary-total-votes-workbook"]],
  [PARENTS[2], "urn:dsa-seats:georgia-current-incumbent-primary-linkage-candidate:v1:2022-2026", "data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json", 30782, INPUTS.identityFile, "review_candidate", ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "georgia-house-democratic-primary-results-2022-2026-v1"]],
  [PARENTS[3], "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_13_cd119.zip", "data/source/tiger2025/tl_2025_13_cd119.zip", 1730811, INPUTS.tigerFile, "source", []],
  [PARENTS[4], "urn:dsa-seats:georgia-cd118-cd119-block-crosswalk-candidate:v1:2026-08-07", "data/metadata/georgia-cd118-cd119-block-crosswalk-candidate-v1.json", 43102, INPUTS.crosswalkFile, "review_candidate", ["census-cd119-plan-change-authority-20260805", "census-cd118-georgia-block-equivalency-extract-20260807", "census-cd119-georgia-block-equivalency-extract-20260807"]],
] as const;
type LockEntry = { id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: readonly string[] };
type Input = Readonly<{ proposal: unknown; proposalFileSha256: string; receipt: GeorgiaPrimaryResultsReceipt; receiptFileSha256: string; identity: GeorgiaPrimaryIdentityCandidate; identityFileSha256: string; crosswalk: GeorgiaCd118Cd119BlockCrosswalkCandidate; crosswalkFileSha256: string; authorityBytes: Buffer; cd118Bytes: Buffer; cd119Bytes: Buffer; ga119Dbf: Buffer; ga119FileSha256: string; sourceLock: { version: 1; entries: LockEntry[] } }>;
const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const order = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const fail = (code: string): never => { throw new Error(`Georgia primary geography rejected: ${code}`); };
const exactKeys = (value: unknown, keys: readonly string[]): boolean => typeof value === "object" && value !== null && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const TOP_KEYS = ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"] as const;
const ROW_KEYS = ["geographyObservationId", "identityObservationId", "identityRowSha256", "identityStatus", "targetSeatId", "bioguideId", "sourceContestId", "sourceContestSha256", "resultAuthorityStatus", "certificationStatus", "sourceWinnerStatus", "cycleYear", "electionDate", "currentTargetDistrictCode", "sourceDistrictCode", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "parentCrosswalkId", "parentCrosswalkRowSha256", "sameBlockCountForTarget", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "identityDispositionPreserved", "sourceWinnerDispositionPreserved", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"] as const;

function inventory(bytes: Buffer): Set<string> {
  if (sha(bytes) !== INPUTS.tigerDbf || bytes.length < 65 || bytes[0] !== 0x03) fail("DBF_INVALID");
  const count = bytes.readUInt32LE(4), headerLength = bytes.readUInt16LE(8), recordLength = bytes.readUInt16LE(10);
  if (count !== 14 || headerLength + count * recordLength > bytes.length || bytes[headerLength - 1] !== 0x0d) fail("DBF_CLOSURE_INVALID");
  const fields: Array<{ name: string; offset: number; length: number }> = []; let offset = 1;
  for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) { const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim(), length = bytes[cursor + 16]!; fields.push({ name, offset, length }); offset += length; }
  if (!fields.length || offset !== recordLength) fail("DBF_LAYOUT_INVALID");
  const rows = Array.from({ length: count }, (_, index) => { const start = headerLength + index * recordLength; if (bytes[start] !== 0x20) fail("DBF_DELETED"); const value = Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()])); return { state: value.STATEFP, geoid: value.GEOID, district: value.CD119FP, session: value.CDSESSN }; }).sort((a, b) => order(a.geoid ?? "", b.geoid ?? ""));
  if (rows.some((row, index) => { const district = String(index + 1).padStart(2, "0"); return row.state !== "13" || row.geoid !== `13${district}` || row.district !== district || row.session !== "119"; })) fail("DBF_INVENTORY_INVALID");
  return new Set(rows.map((row) => row.geoid!));
}

export function buildGeorgiaPrimaryGeographyCandidate(input: Input) {
  if (input.proposalFileSha256 !== INPUTS.proposalFile || input.receiptFileSha256 !== INPUTS.receiptFile || input.identityFileSha256 !== INPUTS.identityFile || input.crosswalkFileSha256 !== INPUTS.crosswalkFile || input.ga119FileSha256 !== INPUTS.tigerFile) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal), receipt = validateGeorgiaPrimaryResultsReceipt(input.receipt), identity = validateGeorgiaPrimaryIdentityCandidate(input.identity);
  const crosswalk = validateGeorgiaCd118Cd119BlockCrosswalkCandidate(input.crosswalk, { authorityBytes: input.authorityBytes, cd118Bytes: input.cd118Bytes, cd119Bytes: input.cd119Bytes, sourceLock: input.sourceLock as never });
  const geographyDecision = proposal.decisions.find((row) => row.decisionId === "approve-historical-district-cd119-compatibility-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || receipt.summary.contestSetSha256 !== INPUTS.receiptContestSet || receipt.summary.targetObservationSetSha256 !== INPUTS.receiptTargetSet || identity.packageSha256 !== INPUTS.identityPackage || identity.observationSetSha256 !== INPUTS.identitySet || crosswalk.packageSha256 !== INPUTS.crosswalkPackage || crosswalk.rowSetSha256 !== INPUTS.crosswalkSet || receipt.review.resolution !== null || identity.review.resolution !== null || crosswalk.review.resolution !== null || geographyDecision?.resolution !== null) fail("PARENT_INVALID");
  for (const [id, url, path, bytes, hash, kind, parents] of REQUIRED) { const matches = input.sourceLock.entries.filter((entry) => entry.id === id), entry = matches[0]; if (matches.length !== 1 || entry?.url !== url || entry.retainedPath !== path || entry.retainedStatus !== "retained" || entry.byteSize !== bytes || entry.sha256 !== hash || entry.kind !== kind || canonicalJson(entry.parentIds) !== canonicalJson(parents)) fail("SOURCE_LOCK_MISMATCH"); }
  const outputs = input.sourceLock.entries.filter((entry) => entry.id === GEORGIA_PRIMARY_GEOGRAPHY_V1);
  if (GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_FILE_SHA256) { const entry = outputs[0]; if (outputs.length !== 1 || entry?.url !== "urn:dsa-seats:georgia-primary-geography-compatibility-candidate:v1:2022-2026" || entry.retainedPath !== "data/metadata/georgia-primary-geography-compatibility-candidate-v1.json" || entry.retainedStatus !== "retained" || entry.byteSize !== GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_BYTE_SIZE || entry.sha256 !== GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_FILE_SHA256 || entry.kind !== "review_candidate" || canonicalJson(entry.parentIds) !== canonicalJson(PARENTS)) fail("SOURCE_LOCK_MISMATCH"); } else if (outputs.length) fail("SOURCE_LOCK_MISMATCH");
  const keys = inventory(input.ga119Dbf);

  const rows = identity.observations.map((observation) => {
    const targetCd119Geoid = `13${observation.currentTargetDistrictCode}`;
    if (!keys.has(targetCd119Geoid)) fail("TARGET_KEY_MISSING");
    const crosswalkRow = observation.cycleYear === 2022 ? crosswalk.rows.find((row) => row.sourceDistrictCode === observation.sourceDistrictCode) : null;
    if (observation.cycleYear === 2022 && !crosswalkRow) fail("CROSSWALK_ROW_MISSING");
    const sameBlockCountForTarget = crosswalkRow?.sourceToTargetSplits.find((split) => split.targetDistrictCode === observation.currentTargetDistrictCode)?.blockCount ?? null;
    const current = observation.cycleYear === 2024, pending = observation.cycleYear === 2026;
    const exactHistorical = observation.cycleYear === 2022 && crosswalkRow?.compatibilityCandidate === true && observation.sourceDistrictCode === observation.currentTargetDistrictCode;
    const zeroHistorical = observation.cycleYear === 2022 && sameBlockCountForTarget === 0;
    const compatibilityDisposition = pending ? "unassessed_cd120_authority_collection_pending" as const : current ? "same_cd119_session_and_geoid_exact_key_candidate" as const : exactHistorical ? "exact_block_membership_candidate" as const : zeroHistorical ? "no_same_block_membership_no_geography_candidate" as const : "crosswalk_review_required" as const;
    const evidenceClass = pending ? "authority_pending" as const : current ? "derived_exact_session_and_key" as const : exactHistorical ? "direct_official_exact_block_membership" as const : zeroHistorical ? "direct_official_zero_target_block_membership" as const : "direct_official_crosswalk_review" as const;
    const compatibilityCandidate = current || exactHistorical;
    const unsigned = {
      geographyObservationId: `ga:geography:${observation.cycleYear}:${observation.currentTargetDistrictCode}`,
      identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256,
      identityStatus: observation.identityStatus,
      targetSeatId: observation.targetSeatId,
      bioguideId: observation.bioguideId,
      sourceContestId: observation.sourceContestId,
      sourceContestSha256: observation.sourceContestSha256,
      resultAuthorityStatus: observation.resultAuthorityStatus,
      certificationStatus: observation.certificationStatus,
      sourceWinnerStatus: observation.sourceWinnerStatus,
      cycleYear: observation.cycleYear,
      electionDate: observation.electionDate,
      currentTargetDistrictCode: observation.currentTargetDistrictCode,
      sourceDistrictCode: observation.sourceDistrictCode,
      targetCd119Geoid,
      historicalCongressSession: pending ? "120" as const : current ? "119" as const : "118" as const,
      historicalGeoid: pending ? null : `13${observation.sourceDistrictCode}`,
      parentCrosswalkId: crosswalkRow?.crosswalkId ?? null,
      parentCrosswalkRowSha256: crosswalkRow?.rowSha256 ?? null,
      sameBlockCountForTarget,
      compatibilityDisposition,
      evidenceClass,
      confidence: compatibilityCandidate ? "high" as const : "none" as const,
      compatibilityCandidate,
      compatibilityApproved: false as const,
      identityApproved: false as const,
      identityDispositionPreserved: true as const,
      sourceWinnerDispositionPreserved: true as const,
      evaluatorUse: "excluded_pending_authorized_identity_historical_geography_review" as const,
      scoreEligible: false as const,
      rationaleCodes: pending ? ["cd120_authority_not_yet_retained", "do_not_assume_cd119_continuity_for_2026"] : current ? ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"] : exactHistorical ? ["identical_cd118_cd119_2020_tabulation_block_membership", "source_and_target_district_keys_match"] : zeroHistorical ? ["source_cd118_district_has_zero_blocks_in_current_target_cd119_district", "person_identity_link_does_not_create_geography_link", "do_not_select_alternate_target_by_block_count"] : ["source_cd118_district_splits_across_cd119_districts", "overlap_threshold_not_authorized", "block_counts_are_not_population_voter_or_electoral_weights"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:ga-primary-geography-row:v1\0", unsigned) };
  }).sort((a, b) => order(a.geographyObservationId, b.geographyObservationId));
  const summary = { identityObservations: 12 as const, exactCd118ToCd119BlockMembershipCandidates: 1 as const, cd118ToCd119CrosswalkReviewRequired: 2 as const, noSameBlockMembershipNoCandidate: 1 as const, exactCd119SessionKeyCandidates: 4 as const, cd120AuthorityPending: 4 as const, compatibilityCandidates: 5 as const, numberedDistrictsInCd119Inventory: 14 as const, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const };
  const unsigned = { schema: GEORGIA_PRIMARY_GEOGRAPHY_V1, version: 1 as const, generatedAt: "2026-08-07T08:00:00.000Z" as const, sourceCutoff: "2026-08-07" as const, reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null }, inputs: { proposal: { sourceLockId: PARENTS[0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, receipt: { sourceLockId: PARENTS[1], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptContestSet, targetObservationSetSha256: INPUTS.receiptTargetSet }, identity: { sourceLockId: PARENTS[2], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage, observationSetSha256: INPUTS.identitySet }, tigerCd119: { sourceLockId: PARENTS[3], fileSha256: INPUTS.tigerFile, dbfMemberSha256: INPUTS.tigerDbf, districtCount: 14 as const }, crosswalk: { sourceLockId: PARENTS[4], fileSha256: INPUTS.crosswalkFile, packageSha256: INPUTS.crosswalkPackage, rowSetSha256: INPUTS.crosswalkSet } }, methodology: { identityJoinKey: "identity_observation_id_and_parent_row_hash" as const, targetSession: "119" as const, cycleSessionMapping: { "2022": "118" as const, "2024": "119" as const, "2026": "120" as const }, exactHistoricalRule: "identical_cd118_source_and_same_number_cd119_target_block_sets" as const, splitHistoricalRule: "crosswalk_review_required_without_overlap_threshold" as const, zeroHistoricalRule: "zero_source_blocks_in_current_target_means_no_geography_candidate_and_no_alternate_target_selection" as const, cd120Rule: "remain_unassessed_until_authoritative_cd120_plan_evidence_is_retained" as const, rawTigerGeometryEqualityAssessed: false as const, overlapThresholdUsed: false as const, populationEquivalenceAssessed: false as const, evaluatorNumericValues: 0 as const }, summary, rows, rowSetSha256: digest("dsa-seats:ga-primary-geography-row-set:v1\0", rows), decisionSupport: { informsDecisionId: "approve-historical-district-cd119-compatibility-v1" as const, analysisConclusion: "one_exact_2022_block_candidate_two_split_reviews_one_zero_membership_rejection_four_exact_cd119_keys_and_four_cd120_pending" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const } };
  return { ...unsigned, packageSha256: digest("dsa-seats:ga-primary-geography-package:v1\0", unsigned) };
}

export type GeorgiaPrimaryGeographyCandidate = ReturnType<typeof buildGeorgiaPrimaryGeographyCandidate>;
export function validateGeorgiaPrimaryGeographyCandidate(value: GeorgiaPrimaryGeographyCandidate): GeorgiaPrimaryGeographyCandidate {
  const { packageSha256, ...unsigned } = value;
  if (!exactKeys(value, TOP_KEYS) || value.schema !== GEORGIA_PRIMARY_GEOGRAPHY_V1 || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 12 || canonicalJson(value.summary) !== canonicalJson({ identityObservations: 12, exactCd118ToCd119BlockMembershipCandidates: 1, cd118ToCd119CrosswalkReviewRequired: 2, noSameBlockMembershipNoCandidate: 1, exactCd119SessionKeyCandidates: 4, cd120AuthorityPending: 4, compatibilityCandidates: 5, numberedDistrictsInCd119Inventory: 14, automaticallyApprovedRows: 0, scoreEligibleRows: 0 })) fail("LIFECYCLE_INVALID");
  if (value.rows.some((row) => { if (!exactKeys(row, ROW_KEYS)) return true; const { rowSha256, ...rowUnsigned } = row; const expectedId = `ga:geography:${row.cycleYear}:${row.currentTargetDistrictCode}`; return row.geographyObservationId !== expectedId || rowSha256 !== digest("dsa-seats:ga-primary-geography-row:v1\0", rowUnsigned) || row.compatibilityApproved || row.identityApproved || row.scoreEligible || !row.identityDispositionPreserved || !row.sourceWinnerDispositionPreserved || row.sourceWinnerStatus !== "not_marked_by_source" || (row.cycleYear === 2026 ? row.historicalCongressSession !== "120" || row.historicalGeoid !== null || row.compatibilityCandidate || row.evidenceClass !== "authority_pending" || row.parentCrosswalkId !== null || row.sameBlockCountForTarget !== null : row.cycleYear === 2024 ? row.historicalCongressSession !== "119" || row.historicalGeoid !== row.targetCd119Geoid || !row.compatibilityCandidate || row.evidenceClass !== "derived_exact_session_and_key" || row.parentCrosswalkId !== null : row.historicalCongressSession !== "118" || row.historicalGeoid !== `13${row.sourceDistrictCode}` || row.parentCrosswalkId !== `ga:cd118-cd119:${row.sourceDistrictCode}` || (row.currentTargetDistrictCode === "02" ? !row.compatibilityCandidate || row.compatibilityDisposition !== "exact_block_membership_candidate" : row.currentTargetDistrictCode === "06" ? row.sourceDistrictCode !== "07" || row.sameBlockCountForTarget !== 0 || row.compatibilityCandidate || row.compatibilityDisposition !== "no_same_block_membership_no_geography_candidate" : row.compatibilityCandidate || row.compatibilityDisposition !== "crosswalk_review_required")); })) fail("ROW_INVALID");
  if (new Set(value.rows.map((row) => row.geographyObservationId)).size !== 12 || value.rows.filter((row) => row.compatibilityCandidate).length !== 5 || value.rowSetSha256 !== digest("dsa-seats:ga-primary-geography-row-set:v1\0", value.rows) || (GEORGIA_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 && value.rowSetSha256 !== GEORGIA_PRIMARY_GEOGRAPHY_ROW_SET_SHA256) || packageSha256 !== digest("dsa-seats:ga-primary-geography-package:v1\0", unsigned) || (GEORGIA_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 && packageSha256 !== GEORGIA_PRIMARY_GEOGRAPHY_PACKAGE_SHA256)) fail("PACKAGE_INVALID");
  return value;
}
