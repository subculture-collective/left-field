import { createHash } from "node:crypto";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  validateNewMexicoPrimaryIdentityCandidate,
  type NewMexicoPrimaryIdentityCandidate,
} from "./new-mexico-current-incumbent-primary-linkage-candidate";
import {
  validateNewMexicoPrimaryResultsReceipt,
  type NewMexicoPrimaryResultsReceipt,
} from "./new-mexico-house-democratic-primary-results-receipt";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";

export const NEW_MEXICO_PRIMARY_GEOGRAPHY_V1 = "new-mexico-primary-geography-compatibility-candidate-v1" as const;
export const NEW_MEXICO_PRIMARY_GEOGRAPHY_FILE_SHA256 = "65d3c31d5a8b1d59d045cfbee81789da56cc2d2aabea284cb1b40dafa9966e87" as const;
export const NEW_MEXICO_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 = "e69637b098ee9f709cee64be52590c11899f4a2bbd1653f2c63d2da030193f81" as const;
export const NEW_MEXICO_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 = "ac4331bd84d6a05a660cf62b2bde0c819ad404a82f33d54f8f5ac808f296e9af" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "d25538e1b9275553a36843b8eca6205427418f1efed3391f953ca5e85ada3882",
  receiptPackage: "305c2d1da85cfb8e3725ef29100c825de5d50b56e4fe9513e0f6045b132ac326",
  identityFile: "3168dd12c54063af9e6108f64933ec35fd87dbae84afdcaa8c729e4960115e36",
  identityPackage: "d80ff1b59482b020643a6215aecdfca733b4b52ddb21c3d419ff2d0ea3ab1adf",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "88d8b5566cee6778eceb0809ae84165eac6db2a50653ee36df831791d241bc1b",
  cd118Dbf: "e5210b9426fbd49dd96a1d18eb4565101e0ff674c470ee079e1da734acc4eb8b",
  cd119File: "7c02b3b426aedbce09448dce5805d930a2e2f0680f3717a3ac06936ae7da7cb2",
  cd119Dbf: "71782c87bc663b9ac6042811848e8637253c66b69032451d2fccf1b01c970358",
} as const;

const PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "new-mexico-house-democratic-primary-results-2022-2026-v1",
  "new-mexico-current-incumbent-primary-linkage-candidate-v1",
  "census-cd119-plan-change-authority-20260805",
  "tiger-cd118-35",
  "tiger-cd119-35",
] as const;

const REQUIRED_SOURCES = [
  [PARENTS[0], "urn:dsa-seats:house-democratic-primary-source-selection-proposal:v1:2026-08-04", "data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", 411_793, INPUTS.proposalFile, "review_proposal", ["dsa-target-factual-projection-20260804-v1", "dsa-target-incumbent-roster-20260804-v1", "fec-2026-congressional-primary-dates", "geo-national-cd119"]],
  [PARENTS[1], "urn:dsa-seats:new-mexico-house-democratic-primary-results:v1:2022-2026", "data/metadata/new-mexico-house-democratic-primary-results-2022-2026-v1.json", 31_797, INPUTS.receiptFile, "review_candidate", ["house-democratic-primary-source-selection-proposal-20260804-v1", "nm-2022-primary-federal-results-csv", "nm-2024-primary-federal-results-csv", "nm-2026-primary-federal-results-csv"]],
  [PARENTS[2], "urn:dsa-seats:new-mexico-current-incumbent-primary-linkage-candidate:v1:2026-08-07", "data/metadata/new-mexico-current-incumbent-primary-linkage-candidate-v1.json", 25_591, INPUTS.identityFile, "review_candidate", ["dsa-target-incumbent-roster-20260804-v1", "house-democratic-primary-source-selection-proposal-20260804-v1", "house-xml", "congress-legislators-current-20260804", "new-mexico-house-democratic-primary-results-2022-2026-v1"]],
  [PARENTS[3], "https://www.census.gov/geographies/mapping-files/2025/dec/rdo/119-congressional-district-bef.html", "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", 324_827, INPUTS.authorityFile, "source", []],
  [PARENTS[4], "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_35_cd118.zip", "data/source/tiger2022/tl_2022_35_cd118.zip", 621_463, INPUTS.cd118File, "source", []],
  [PARENTS[5], "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_35_cd119.zip", "data/source/tiger2025/tl_2025_35_cd119.zip", 354_119, INPUTS.cd119File, "source", []],
] as const;

type SourceLockEntry = Readonly<{ id?: string; url?: string; retainedPath?: string; retainedStatus?: string; byteSize?: number; sha256?: string; kind?: string; parentIds?: readonly string[] }>;
type Input = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: NewMexicoPrimaryResultsReceipt;
  receiptFileSha256: string;
  identity: NewMexicoPrimaryIdentityCandidate;
  identityFileSha256: string;
  authorityHtml: string;
  authorityFileSha256: string;
  nm118Dbf: Buffer;
  nm118FileSha256: string;
  nm119Dbf: Buffer;
  nm119FileSha256: string;
  sourceLock: unknown;
}>;

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const fail = (code: string): never => { throw new Error(`New Mexico primary geography rejected: ${code}`); };
const exactKeys = (value: unknown, keys: readonly string[]): boolean => typeof value === "object" && value !== null && canonicalJson(Object.keys(value as object).sort()) === canonicalJson([...keys].sort());
const TOP_KEYS = ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"] as const;
const ROW_KEYS = ["geographyObservationId", "identityObservationId", "identityRowSha256", "identityStatus", "contestId", "contestSha256", "resultAuthorityStatus", "certificationStatus", "sourceWinnerStatus", "cycleYear", "electionDate", "targetSeatId", "districtCode", "sourceDistrictCode", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "identityDispositionPreserved", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"] as const;

const EXPECTED_DBF_FIELDS = {
  "118": [["STATEFP20", "C", 2, 0], ["GEOID20", "C", 4, 0], ["CD118FP", "C", 2, 0], ["NAMELSAD20", "C", 41, 0], ["LSAD20", "C", 2, 0], ["CDSESSN", "C", 3, 0], ["MTFCC20", "C", 5, 0], ["FUNCSTAT20", "C", 1, 0], ["ALAND20", "N", 14, 0], ["AWATER20", "N", 14, 0], ["INTPTLAT20", "C", 11, 0], ["INTPTLON20", "C", 12, 0]],
  "119": [["STATEFP", "C", 2, 0], ["CD119FP", "C", 2, 0], ["GEOID", "C", 4, 0], ["GEOIDFQ", "C", 13, 0], ["NAMELSAD", "C", 41, 0], ["LSAD", "C", 2, 0], ["CDSESSN", "C", 3, 0], ["MTFCC", "C", 5, 0], ["FUNCSTAT", "C", 1, 0], ["ALAND", "N", 14, 0], ["AWATER", "N", 14, 0], ["INTPTLAT", "C", 11, 0], ["INTPTLON", "C", 12, 0]],
} as const;

function inventory(bytes: Buffer, session: "118" | "119"): readonly string[] {
  if (bytes.length < 65 || bytes[0] !== 0x03) fail("DBF_INVALID");
  const count = bytes.readUInt32LE(4);
  const headerLength = bytes.readUInt16LE(8);
  const recordLength = bytes.readUInt16LE(10);
  const expectedHeaderLength = session === "118" ? 417 : 449;
  const expectedRecordLength = session === "118" ? 112 : 125;
  if (count !== 3 || headerLength !== expectedHeaderLength || recordLength !== expectedRecordLength || headerLength + count * recordLength > bytes.length || bytes[headerLength - 1] !== 0x0d) fail("DBF_CLOSURE_INVALID");
  const fields: Array<{ name: string; type: string; offset: number; length: number; decimals: number }> = [];
  let offset = 1;
  for (let cursor = 32; cursor + 32 <= headerLength && bytes[cursor] !== 0x0d; cursor += 32) {
    const name = bytes.subarray(cursor, cursor + 11).toString("ascii").replace(/\0.*$/, "").trim();
    const type = String.fromCharCode(bytes[cursor + 11]!);
    const length = bytes[cursor + 16]!;
    const decimals = bytes[cursor + 17]!;
    if (!name || length < 1) fail("DBF_INVALID");
    fields.push({ name, type, offset, length, decimals });
    offset += length;
  }
  if (canonicalJson(fields.map((field) => [field.name, field.type, field.length, field.decimals])) !== canonicalJson(EXPECTED_DBF_FIELDS[session]) || offset !== recordLength) fail("DBF_LAYOUT_INVALID");
  const historical = session === "118";
  const stateKey = historical ? "STATEFP20" : "STATEFP";
  const geoidKey = historical ? "GEOID20" : "GEOID";
  const districtKey = historical ? "CD118FP" : "CD119FP";
  const rows = Array.from({ length: count }, (_, index) => {
    const start = headerLength + index * recordLength;
    if (bytes[start] !== 0x20) fail("DBF_DELETED_RECORD");
    const value = Object.fromEntries(fields.map((field) => [field.name, bytes.subarray(start + field.offset, start + field.offset + field.length).toString("ascii").trim()]));
    return { state: value[stateKey], geoid: value[geoidKey], district: value[districtKey], cdSession: value.CDSESSN };
  }).sort((left, right) => Buffer.compare(Buffer.from(left.geoid ?? ""), Buffer.from(right.geoid ?? "")));
  if (rows.some((row, index) => {
    const district = String(index + 1).padStart(2, "0");
    return row.state !== "35" || row.geoid !== `35${district}` || row.district !== district || row.cdSession !== session;
  })) fail("DBF_INVENTORY_INVALID");
  return rows.map((row) => row.geoid!);
}

function validateSourceLock(value: unknown): readonly SourceLockEntry[] {
  const entries = (value as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) fail("SOURCE_LOCK_MISMATCH");
  const sourceEntries = entries as unknown[];
  for (const [id, url, retainedPath, byteSize, hash, kind, parentIds] of REQUIRED_SOURCES) {
    const matches = sourceEntries.filter((entry): entry is SourceLockEntry => typeof entry === "object" && entry !== null && (entry as SourceLockEntry).id === id);
    const entry = matches[0];
    if (matches.length !== 1 || entry?.url !== url || entry.retainedPath !== retainedPath || entry.retainedStatus !== "retained" || entry.byteSize !== byteSize || entry.sha256 !== hash || entry.kind !== kind || canonicalJson(entry.parentIds) !== canonicalJson(parentIds)) fail("SOURCE_LOCK_MISMATCH");
  }
  return sourceEntries as SourceLockEntry[];
}

export function buildNewMexicoPrimaryGeographyCandidate(input: Input) {
  const hashes = [input.proposalFileSha256, input.receiptFileSha256, input.identityFileSha256, input.authorityFileSha256, sha256(input.authorityHtml), input.nm118FileSha256, sha256(input.nm118Dbf), input.nm119FileSha256, sha256(input.nm119Dbf)];
  const expected = [INPUTS.proposalFile, INPUTS.receiptFile, INPUTS.identityFile, INPUTS.authorityFile, INPUTS.authorityFile, INPUTS.cd118File, INPUTS.cd118Dbf, INPUTS.cd119File, INPUTS.cd119Dbf];
  if (hashes.some((value, index) => value !== expected[index])) fail("INPUT_HASH_MISMATCH");

  const proposal = validateHouseDemocraticPrimarySourceSelectionProposal(input.proposal);
  const receipt = validateNewMexicoPrimaryResultsReceipt(input.receipt);
  const identity = validateNewMexicoPrimaryIdentityCandidate(input.identity);
  const compatibilityDecision = proposal.decisions.find((decision) => decision.decisionId === "approve-historical-district-cd119-compatibility-v1");
  if (proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage || identity.packageSha256 !== INPUTS.identityPackage || !compatibilityDecision || compatibilityDecision.resolution !== null || receipt.review.resolution !== null || identity.review.resolution !== null) fail("PARENT_INVALID");

  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, New Mexico")) fail("AUTHORITY_INVALID");
  const sourceEntries = validateSourceLock(input.sourceLock);
  const outputMatches = sourceEntries.filter((entry) => entry.id === NEW_MEXICO_PRIMARY_GEOGRAPHY_V1);
  const output = outputMatches[0];
  if (outputMatches.length !== 1 || output?.url !== "urn:dsa-seats:new-mexico-primary-geography-compatibility-candidate:v1:2022-2026" || output.retainedPath !== "data/metadata/new-mexico-primary-geography-compatibility-candidate-v1.json" || output.retainedStatus !== "retained" || output.byteSize !== 18_168 || output.sha256 !== NEW_MEXICO_PRIMARY_GEOGRAPHY_FILE_SHA256 || output.kind !== "review_candidate" || canonicalJson(output.parentIds) !== canonicalJson(PARENTS)) fail("SOURCE_LOCK_MISMATCH");

  const layerKeys = new Set([
    ...inventory(input.nm118Dbf, "118").map((geoid) => `118:${geoid}`),
    ...inventory(input.nm119Dbf, "119").map((geoid) => `119:${geoid}`),
  ]);
  const expectedIdentityIds = ["nm:identity:2022:01", "nm:identity:2022:02", "nm:identity:2022:03", "nm:identity:2024:01", "nm:identity:2024:02", "nm:identity:2024:03", "nm:identity:2026:01", "nm:identity:2026:02", "nm:identity:2026:03"];
  if (canonicalJson(identity.observations.map((row) => row.observationId)) !== canonicalJson(expectedIdentityIds)) fail("IDENTITY_CLOSURE_INVALID");

  const rows = identity.observations.map((observation) => {
    const historicalCongressSession = observation.cycleYear === 2022 ? "118" as const : observation.cycleYear === 2024 ? "119" as const : "120" as const;
    const districtCode = observation.currentTargetDistrictCode;
    const targetCd119Geoid = `35${districtCode}`;
    const historicalGeoid = observation.cycleYear === 2026 ? null : targetCd119Geoid;
    const compatibilityCandidate = observation.cycleYear !== 2026;
    if (!layerKeys.has(`119:${targetCd119Geoid}`) || (historicalGeoid !== null && !layerKeys.has(`${historicalCongressSession}:${historicalGeoid}`))) fail("GEOGRAPHY_KEY_MISSING");
    const unsigned = {
      geographyObservationId: `nm:geography:${observation.cycleYear}:${districtCode}`,
      identityObservationId: observation.observationId,
      identityRowSha256: observation.rowSha256,
      identityStatus: observation.identityStatus,
      contestId: observation.sourceContestId,
      contestSha256: observation.sourceContestSha256,
      resultAuthorityStatus: observation.resultAuthorityStatus,
      certificationStatus: observation.certificationStatus,
      sourceWinnerStatus: observation.sourceWinnerStatus,
      cycleYear: observation.cycleYear,
      electionDate: observation.electionDate,
      targetSeatId: observation.targetSeatId,
      districtCode,
      sourceDistrictCode: observation.sourceDistrictCode,
      targetCd119Geoid,
      historicalCongressSession,
      historicalGeoid,
      compatibilityDisposition: observation.cycleYear === 2022 ? "official_no_plan_change_declaration_same_geoid_key_candidate" as const : observation.cycleYear === 2024 ? "same_cd119_session_and_geoid_exact_key_candidate" as const : "unassessed_cd120_authority_collection_pending" as const,
      evidenceClass: observation.cycleYear === 2022 ? "direct_official_plan_continuity_and_derived_key" as const : observation.cycleYear === 2024 ? "derived_exact_session_and_key" as const : "authority_pending" as const,
      confidence: compatibilityCandidate ? "high" as const : "none" as const,
      compatibilityCandidate,
      compatibilityApproved: false as const,
      identityApproved: false as const,
      identityDispositionPreserved: true as const,
      evaluatorUse: "excluded_pending_authorized_identity_historical_geography_review" as const,
      scoreEligible: false as const,
      rationaleCodes: observation.cycleYear === 2022 ? ["official_census_cd119_redraw_list_excludes_nm", "same_state_district_geoid_in_cd118_and_cd119_inventory"] : observation.cycleYear === 2024 ? ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"] : ["cd120_authority_not_yet_retained", "do_not_assume_cd119_continuity_for_2026"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:nm-primary-geography-row:v1\0", unsigned) };
  });

  const summary = { identityObservations: 9 as const, cd118ToCd119PlanContinuityCandidates: 3 as const, exactCd119SessionKeyCandidates: 3 as const, cd120AuthorityPending: 3 as const, compatibilityCandidates: 6 as const, numberedDistrictsPerLayer: 3 as const, automaticallyApprovedRows: 0 as const, scoreEligibleRows: 0 as const };
  const unsigned = {
    schema: NEW_MEXICO_PRIMARY_GEOGRAPHY_V1,
    version: 1 as const,
    generatedAt: "2026-08-07T09:30:00.000Z" as const,
    sourceCutoff: "2026-08-07" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_authorized_identity_and_historical_geography_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: {
      proposal: { sourceLockId: PARENTS[0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage },
      receipt: { sourceLockId: PARENTS[1], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage },
      identity: { sourceLockId: PARENTS[2], fileSha256: INPUTS.identityFile, packageSha256: INPUTS.identityPackage },
      censusPlanChangeAuthority: { sourceLockId: PARENTS[3], fileSha256: INPUTS.authorityFile },
      tigerLayers: [
        { sourceLockId: PARENTS[4], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, congressSession: "118" as const, districtCount: 3 as const },
        { sourceLockId: PARENTS[5], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, congressSession: "119" as const, districtCount: 3 as const },
      ],
    },
    methodology: { targetSession: "119" as const, cycleSessionMapping: { "2022": "118" as const, "2024": "119" as const, "2026": "120" as const }, planContinuityRule: "official_census_redraw_scope_declaration_plus_same_state_district_key" as const, exactSameSessionRule: "same_cd119_session_state_and_district_geoid" as const, cd120Rule: "remain_unassessed_until_authoritative_cd120_plan_evidence_is_retained" as const, rawTigerGeometryEqualityAssessed: false as const, overlapThresholdUsed: false as const, populationEquivalenceAssessed: false as const, evaluatorNumericValues: 0 as const },
    summary,
    rows,
    rowSetSha256: digest("dsa-seats:nm-primary-geography-row-set:v1\0", rows),
    decisionSupport: { informsDecisionId: "approve-historical-district-cd119-compatibility-v1" as const, analysisConclusion: "official_evidence_supports_nm_cd118_to_cd119_plan_continuity_and_exact_cd119_keys_while_cd120_remains_unassessed" as const, lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision" as const },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:nm-primary-geography-package:v1\0", unsigned) };
}

export type NewMexicoPrimaryGeographyCandidate = ReturnType<typeof buildNewMexicoPrimaryGeographyCandidate>;

export function validateNewMexicoPrimaryGeographyCandidate(value: NewMexicoPrimaryGeographyCandidate): NewMexicoPrimaryGeographyCandidate {
  if (!exactKeys(value, TOP_KEYS) || !exactKeys(value.review, ["status", "reviewer", "reviewedAt", "resolution"]) || !exactKeys(value.summary, ["identityObservations", "cd118ToCd119PlanContinuityCandidates", "exactCd119SessionKeyCandidates", "cd120AuthorityPending", "compatibilityCandidates", "numberedDistrictsPerLayer", "automaticallyApprovedRows", "scoreEligibleRows"]) || !exactKeys(value.methodology, ["targetSession", "cycleSessionMapping", "planContinuityRule", "exactSameSessionRule", "cd120Rule", "rawTigerGeometryEqualityAssessed", "overlapThresholdUsed", "populationEquivalenceAssessed", "evaluatorNumericValues"])) fail("PACKAGE_FIELDS_INVALID");
  const { packageSha256, ...unsigned } = value;
  const expectedSummary = { identityObservations: 9, cd118ToCd119PlanContinuityCandidates: 3, exactCd119SessionKeyCandidates: 3, cd120AuthorityPending: 3, compatibilityCandidates: 6, numberedDistrictsPerLayer: 3, automaticallyApprovedRows: 0, scoreEligibleRows: 0 };
  if (value.schema !== NEW_MEXICO_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || value.generatedAt !== "2026-08-07T09:30:00.000Z" || value.sourceCutoff !== "2026-08-07" || !value.reviewerOnly || value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null || value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 9 || canonicalJson(value.summary) !== canonicalJson(expectedSummary) || value.methodology.rawTigerGeometryEqualityAssessed || value.methodology.overlapThresholdUsed || value.methodology.populationEquivalenceAssessed || value.methodology.evaluatorNumericValues !== 0) fail("LIFECYCLE_INVALID");
  if (value.rows.some((row, index) => {
    if (!exactKeys(row, ROW_KEYS)) fail("ROW_FIELDS_INVALID");
    const rowUnsigned = structuredClone(row) as Partial<typeof row>;
    delete rowUnsigned.rowSha256;
    const year = row.cycleYear;
    const yearInvalid = year === 2022
      ? row.historicalCongressSession !== "118" || row.historicalGeoid !== row.targetCd119Geoid || !row.compatibilityCandidate || row.compatibilityDisposition !== "official_no_plan_change_declaration_same_geoid_key_candidate" || row.evidenceClass !== "direct_official_plan_continuity_and_derived_key" || row.confidence !== "high"
      : year === 2024
        ? row.historicalCongressSession !== "119" || row.historicalGeoid !== row.targetCd119Geoid || !row.compatibilityCandidate || row.compatibilityDisposition !== "same_cd119_session_and_geoid_exact_key_candidate" || row.evidenceClass !== "derived_exact_session_and_key" || row.confidence !== "high"
        : year === 2026
          ? row.historicalCongressSession !== "120" || row.historicalGeoid !== null || row.compatibilityCandidate || row.compatibilityDisposition !== "unassessed_cd120_authority_collection_pending" || row.evidenceClass !== "authority_pending" || row.confidence !== "none"
          : true;
    return row.rowSha256 !== digest("dsa-seats:nm-primary-geography-row:v1\0", rowUnsigned) || row.geographyObservationId !== `nm:geography:${year}:${row.districtCode}` || row.targetCd119Geoid !== `35${row.districtCode}` || row.sourceDistrictCode !== row.districtCode || !row.identityDispositionPreserved || row.compatibilityApproved || row.identityApproved || row.scoreEligible || yearInvalid || (index > 0 && row.geographyObservationId <= value.rows[index - 1]!.geographyObservationId);
  })) fail("ROW_INVALID");
  if (value.rowSetSha256 !== digest("dsa-seats:nm-primary-geography-row-set:v1\0", value.rows) || value.rowSetSha256 !== NEW_MEXICO_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 || packageSha256 !== digest("dsa-seats:nm-primary-geography-package:v1\0", unsigned) || packageSha256 !== NEW_MEXICO_PRIMARY_GEOGRAPHY_PACKAGE_SHA256) fail("IMMUTABLE_HASH_INVALID");
  return value;
}
