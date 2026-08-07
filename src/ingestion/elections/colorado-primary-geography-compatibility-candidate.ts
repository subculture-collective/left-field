import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateColoradoPrimaryIdentityCandidate, type ColoradoPrimaryIdentityCandidate } from "./colorado-current-incumbent-primary-linkage-candidate";
import { validateColoradoPrimaryResultsReceipt, type ColoradoPrimaryResultsReceipt } from "./colorado-house-democratic-primary-results-receipt";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";

export const COLORADO_PRIMARY_GEOGRAPHY_V1 = "colorado-primary-geography-compatibility-candidate-v1" as const;
export const COLORADO_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 = "62e51d28abedaee49b3b9d1dfd10dff4406bd56916e223532b4b67c380a59200" as const;
export const COLORADO_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 = "22c04b207893b8715299ee9893167bb61ff413abf3b8712edbaa790d963d1af3" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "9f06ea32b7ff7564829d163dbecbf6e78a61c2ebb95e3d31d3875d7a64027569",
  receiptPackage: "c5f2e3c5bda8b027b9879911e07a99d3623a656a5aa717a5408079dc15bf4b55",
  identityFile: "ece5bc2b4938fb8ef2c1d9716e7b0ce19057e7f9671fb4eaa4ec6304f4b5d04a",
  identityPackage: "6d89eb3cfeba6da05abafd4daf710fea55d282291c19ea10b83abc2a1b4e6649",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "af2ead367f9a4e11b0d2cd8a8a3035c3a3437e6d3b178470f5f013020438494b",
  cd118Dbf: "0f796544799d90ca1f89a7f1c04558572399dbd107395e33d1b49b4b674d0d19",
  cd119File: "cfe56e4190ab954484117e3a65bce57a53667e1442a438de8cf7c109c033071b",
  cd119Dbf: "8c2697318cbda6dcd258efd4f8a7976ab320f7f7f7c3c0717e78520141a40a9f",
} as const;

const PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "colorado-house-democratic-primary-results-2022-2026-v1",
  "colorado-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-08",
  "tiger-cd119-08",
] as const;

const REQUIRED_SOURCES = [
  [PARENTS[0], "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411_793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  [PARENTS[1], "urn:dsa-seats:colorado-house-democratic-primary-results:v1:2022-2026", "data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json", 83_500, INPUTS.receiptFile, "review_evidence_receipt", ["co-2022-primary-certification-announcement", "co-2022-primary-signed-statewide-abstract", "co-2022-democratic-us-house-official-abstract", "co-2024-biennial-certified-abstract", "co-2024-democratic-us-house-normalized-transcription", "co-2026-primary-signed-statewide-abstract", "co-2026-democratic-us-house-normalized-transcription"]],
  [PARENTS[2], "urn:dsa-seats:colorado-current-incumbent-primary-linkage-candidate:v1:2022-2026", "data/metadata/colorado-current-incumbent-primary-linkage-candidate-v1.json", 21_291, INPUTS.identityFile, "review_candidate", ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "colorado-house-democratic-primary-results-2022-2026-v1"]],
  [PARENTS[3], "https://www.census.gov/geographies/mapping-files/2025/dec/rdo/119-congressional-district-bef.html", "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", 324_827, INPUTS.authorityFile, "source", []],
  [PARENTS[4], "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_08_cd118.zip", "data/source/tiger2022/tl_2022_08_cd118.zip", 1_092_324, INPUTS.cd118File, "source", []],
  [PARENTS[5], "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_08_cd119.zip", "data/source/tiger2025/tl_2025_08_cd119.zip", 640_369, INPUTS.cd119File, "source", []],
] as const;

type SourceLockEntry = Readonly<{ id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: readonly string[] }>;
type Input = Readonly<{
  proposal: unknown; proposalFileSha256: string;
  receipt: ColoradoPrimaryResultsReceipt; receiptFileSha256: string;
  identity: ColoradoPrimaryIdentityCandidate; identityFileSha256: string;
  authorityHtml: string; authorityFileSha256: string;
  co118Dbf: Buffer; co118FileSha256: string;
  co119Dbf: Buffer; co119FileSha256: string;
  sourceLock: unknown;
}>;

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const fail = (code: string): never => { throw new Error(`Colorado primary geography rejected: ${code}`); };

function inventory(bytes: Buffer, session: "118" | "119"): readonly string[] {
  if (bytes.length < 65 || bytes[0] !== 0x03) fail("DBF_INVALID");
  const count = bytes.readUInt32LE(4), headerLength = bytes.readUInt16LE(8), recordLength = bytes.readUInt16LE(10);
  if (count !== 8 || headerLength < 65 || recordLength < 2 || headerLength + count * recordLength > bytes.length || bytes[headerLength - 1] !== 0x0d) fail("DBF_CLOSURE_INVALID");
  const fields: Array<{ name: string; offset: number; length: number }> = [];
  let offset = 1;
  for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) {
    const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim(), length = bytes[cursor + 16]!;
    if (!name || length < 1) fail("DBF_INVALID");
    fields.push({ name, offset, length });
    offset += length;
  }
  if (!fields.length || offset !== recordLength) fail("DBF_LAYOUT_INVALID");
  const historical = session === "118", stateKey = historical ? "STATEFP20" : "STATEFP", geoidKey = historical ? "GEOID20" : "GEOID", districtKey = historical ? "CD118FP" : "CD119FP";
  const rows = Array.from({ length: count }, (_, index) => {
    const start = headerLength + index * recordLength;
    if (bytes[start] !== 0x20) fail("DBF_DELETED_RECORD");
    const value = Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()]));
    return { state: value[stateKey], geoid: value[geoidKey], district: value[districtKey], cdSession: value.CDSESSN };
  }).sort((left, right) => Buffer.compare(Buffer.from(left.geoid ?? ""), Buffer.from(right.geoid ?? "")));
  if (rows.some((row, index) => {
    const district = String(index + 1).padStart(2, "0");
    return row.state !== "08" || row.geoid !== `08${district}` || row.district !== district || row.cdSession !== session;
  })) fail("DBF_INVENTORY_INVALID");
  return rows.map((row) => row.geoid!);
}

function validateSourceLock(value: unknown): readonly SourceLockEntry[] {
  const entries = (value as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) fail("SOURCE_LOCK_MISMATCH");
  const sourceEntries = entries as unknown[];
  for (const [id, url, retainedPath, byteSize, sha256Value, kind, parentIds] of REQUIRED_SOURCES) {
    const matches = sourceEntries.filter((entry): entry is SourceLockEntry => typeof entry === "object" && entry !== null && (entry as SourceLockEntry).id === id);
    const entry = matches[0];
    if (matches.length !== 1 || entry?.url !== url || entry.retainedPath !== retainedPath || entry.retainedStatus !== "retained" || entry.byteSize !== byteSize || entry.sha256 !== sha256Value || entry.kind !== kind || canonicalJson(entry.parentIds) !== canonicalJson(parentIds)) fail("SOURCE_LOCK_MISMATCH");
  }
  return sourceEntries as SourceLockEntry[];
}

export function buildColoradoPrimaryGeographyCandidate(input: Input) {
  const hashes = [input.proposalFileSha256, input.receiptFileSha256, input.identityFileSha256, input.authorityFileSha256, sha256(input.authorityHtml), input.co118FileSha256, sha256(input.co118Dbf), input.co119FileSha256, sha256(input.co119Dbf)];
  const expected = [INPUTS.proposalFile, INPUTS.receiptFile, INPUTS.identityFile, INPUTS.authorityFile, INPUTS.authorityFile, INPUTS.cd118File, INPUTS.cd118Dbf, INPUTS.cd119File, INPUTS.cd119Dbf];
  if (hashes.some((value, index) => value !== expected[index])) fail("INPUT_HASH_MISMATCH");
  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateColoradoPrimaryResultsReceipt(input.receipt);
  const identity = validateColoradoPrimaryIdentityCandidate(input.identity);
  const compatibilityDecision = proposal.decisions.find((decision) => decision.decisionId === "approve-historical-district-cd119-compatibility-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || identity.packageSha256 !== INPUTS.identityPackage || !compatibilityDecision || compatibilityDecision.resolution !== null || receipt.review.resolution !== null || identity.review.resolution !== null) fail("PARENT_INVALID");
  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Colorado")) fail("AUTHORITY_INVALID");
  const sourceEntries = validateSourceLock(input.sourceLock);
  const outputMatches = sourceEntries.filter((entry) => entry.id === COLORADO_PRIMARY_GEOGRAPHY_V1), output = outputMatches[0];
  if (outputMatches.length !== 1 || output?.url !== "urn:dsa-seats:colorado-primary-geography-compatibility-candidate:v1:2022-2026" || output.retainedPath !== "data/metadata/colorado-primary-geography-compatibility-candidate-v1.json" || output.retainedStatus !== "retained" || output.byteSize !== 22_020 || output.sha256 !== "1e9e6aa7a56ffe7c5004774c93986d4f8bacc27ecd26a266813221995624105f" || output.kind !== "review_candidate" || canonicalJson(output.parentIds) !== canonicalJson(PARENTS)) fail("SOURCE_LOCK_MISMATCH");
  const layerKeys = new Set([...["118", "119"].flatMap((session) => inventory(session === "118" ? input.co118Dbf : input.co119Dbf, session as "118" | "119").map((geoid) => `${session}:${geoid}`))]);
  const expectedIdentityIds = ["co:identity:2022:01", "co:identity:2022:02", "co:identity:2022:06", "co:identity:2022:07", "co:identity:2024:01", "co:identity:2024:02", "co:identity:2024:06", "co:identity:2024:07", "co:identity:2026:01", "co:identity:2026:02", "co:identity:2026:06", "co:identity:2026:07"];
  if (canonicalJson(identity.observations.map((row) => row.observationId)) !== canonicalJson(expectedIdentityIds)) fail("IDENTITY_CLOSURE_INVALID");
  const rows = identity.observations.map((observation) => {
    const historicalCongressSession = observation.cycleYear === 2022 ? "118" as const : observation.cycleYear === 2024 ? "119" as const : "120" as const;
    const targetCd119Geoid = `08${observation.districtCode}`;
    const historicalGeoid = observation.cycleYear === 2026 ? null : targetCd119Geoid;
    const compatibilityCandidate = observation.cycleYear !== 2026;
    if (!layerKeys.has(`119:${targetCd119Geoid}`) || (historicalGeoid !== null && !layerKeys.has(`${historicalCongressSession}:${historicalGeoid}`))) fail("GEOGRAPHY_KEY_MISSING");
    const unsigned = {
      geographyObservationId: `co:geography:${observation.cycleYear}:${observation.districtCode}`,
      identityObservationId: observation.observationId, identityRowSha256: observation.rowSha256, identityStatus: observation.identityStatus,
      contestId: observation.contestId, contestSha256: observation.contestSha256, resultAuthorityStatus: observation.resultAuthorityStatus, certificationStatus: observation.certificationStatus, sourceWinnerStatus: observation.sourceWinnerStatus,
      cycleYear: observation.cycleYear, electionDate: observation.electionDate, seatCycleId: observation.seatCycleId, districtCode: observation.districtCode,
      targetCd119Geoid, historicalCongressSession, historicalGeoid,
      compatibilityDisposition: observation.cycleYear === 2022 ? "official_no_plan_change_declaration_same_geoid_key_candidate" as const : observation.cycleYear === 2024 ? "same_cd119_session_and_geoid_exact_key_candidate" as const : "unassessed_cd120_authority_collection_pending" as const,
      evidenceClass: observation.cycleYear === 2022 ? "direct_official_plan_continuity_and_derived_key" as const : observation.cycleYear === 2024 ? "derived_exact_session_and_key" as const : "authority_pending" as const,
      confidence: compatibilityCandidate ? "high" as const : "none" as const, compatibilityCandidate, compatibilityApproved: false as const, identityApproved: false as const,
      identityDispositionPreserved: true as const, evaluatorUse: "excluded_pending_authorized_identity_historical_geography_review" as const, scoreEligible: false as const,
      rationaleCodes: observation.cycleYear === 2022 ? ["official_census_cd119_redraw_list_excludes_co", "same_state_district_geoid_in_cd118_and_cd119_inventory"] : observation.cycleYear === 2024 ? ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"] : ["cd120_authority_not_yet_retained", "do_not_assume_cd119_continuity_for_2026"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:co-primary-geography-row:v1\0", unsigned) };
  });
  const summary = { identityObservations: 12 as const, cd118ToCd119PlanContinuityCandidates: 4 as const, exactCd119SessionKeyCandidates: 4 as const, cd120AuthorityPending: 4 as const, compatibilityCandidates: 8 as const, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const };
  const unsigned = {
    schema: COLORADO_PRIMARY_GEOGRAPHY_V1, version: 1 as const, generatedAt: "2026-08-06T23:50:00.000Z" as const, sourceCutoff: "2026-08-06" as const,
    reviewerOnly: true as const, publicationEligible: false as const, defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: { proposal: { sourceLockId: PARENTS[0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage }, receipt: { sourceLockId: PARENTS[1], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage }, identity: { sourceLockId: PARENTS[2], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage }, censusPlanChangeAuthority: { sourceLockId: PARENTS[3], fileSha256: INPUTS.authorityFile }, tigerLayers: [{ sourceLockId: PARENTS[4], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, congressSession: "118" as const, districtCount: 8 as const }, { sourceLockId: PARENTS[5], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, congressSession: "119" as const, districtCount: 8 as const }] },
    methodology: { targetSession: "119" as const, cycleSessionMapping: { "2022": "118" as const, "2024": "119" as const, "2026": "120" as const }, planContinuityRule: "official_census_redraw_scope_declaration_plus_same_state_district_key" as const, exactSameSessionRule: "same_cd119_session_state_and_district_geoid" as const, cd120Rule: "remain_unassessed_until_authoritative_cd120_plan_evidence_is_retained" as const, rawTigerGeometryEqualityAssessed: false as const, overlapThresholdUsed: false as const, populationEquivalenceAssessed: false as const, evaluatorNumericValues: 0 as const },
    summary, rows, rowSetSha256: digest("dsa-seats:co-primary-geography-row-set:v1\0", rows),
    decisionSupport: { informsDecisionId: "approve-historical-district-cd119-compatibility-v1" as const, analysisConclusion: "official_evidence_supports_co_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_while_cd120_remains_unassessed" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:co-primary-geography-package:v1\0", unsigned) };
}

export type ColoradoPrimaryGeographyCandidate = ReturnType<typeof buildColoradoPrimaryGeographyCandidate>;

export function validateColoradoPrimaryGeographyCandidate(value: ColoradoPrimaryGeographyCandidate): ColoradoPrimaryGeographyCandidate {
  const { packageSha256, ...unsigned } = value;
  if (value.schema !== COLORADO_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-06T23:50:00.000Z" || value.sourceCutoff !== "2026-08-06" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 12 || canonicalJson(value.summary) !== canonicalJson({ identityObservations: 12, cd118ToCd119PlanContinuityCandidates: 4, exactCd119SessionKeyCandidates: 4, cd120AuthorityPending: 4, compatibilityCandidates: 8, automaticallyApprovedRows: 0, scoreEligibleRows: 0 }) || value.rowSetSha256 !== digest("dsa-seats:co-primary-geography-row-set:v1\0", value.rows) || value.rowSetSha256 !== COLORADO_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 || packageSha256 !== digest("dsa-seats:co-primary-geography-package:v1\0", unsigned) || packageSha256 !== COLORADO_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("LIFECYCLE_INVALID");
  if (value.rows.some((row, index) => { const rowUnsigned = structuredClone(row) as Partial<typeof row>; delete rowUnsigned.rowSha256; const year = row.cycleYear; return row.rowSha256 !== digest("dsa-seats:co-primary-geography-row:v1\0", rowUnsigned) || row.geographyObservationId !== `co:geography:${year}:${row.districtCode}` || !row.identityDispositionPreserved || row.compatibilityApproved || row.identityApproved || row.scoreEligible || (year === 2026 ? row.historicalGeoid !== null || row.compatibilityCandidate || row.evidenceClass !== "authority_pending" || row.confidence !== "none" : row.historicalGeoid !== row.targetCd119Geoid || !row.compatibilityCandidate || row.confidence !== "high") || (index > 0 && row.geographyObservationId <= value.rows[index - 1]!.geographyObservationId); })) fail("ROW_INVALID");
  return value;
}
