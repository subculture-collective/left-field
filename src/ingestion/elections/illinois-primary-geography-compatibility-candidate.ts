import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateIllinoisHouseDemocraticPrimaryResultsReceipt,
  type IllinoisHouseDemocraticPrimaryResultsReceipt,
} from "./illinois-house-democratic-primary-results-receipt";

export const ILLINOIS_PRIMARY_GEOGRAPHY_V1 =
  "illinois-primary-geography-compatibility-candidate-v1" as const;
export const ILLINOIS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 =
  "86cc65b2f8b8158d4c15a091e14723bd6724224c34f5057b5e04ff4e2fe71421" as const;
export const ILLINOIS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 =
  "ff38dcc70c8390f9bdb0a6ec04f05b0e1d187690bcde5c6af5a5a83b3bc73819" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "3016e345d7989ff302557034fb65a63aff92a94f0fec3981b586bf7ea07f9534",
  receiptPackage: "4c0f7bc0505b9e02d03585d8acd0fe47d6599b194f6efcdbcd6e40896d6a663f",
  receiptSet: "eaff782dec77a454d943125c2256d6b6f10121522510a4ec5a43c9e1058e52af",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "084e5944f06ce1b8a59a72586eea2f19a9ef284439c2ca915e110d43d351caf5",
  cd118Dbf: "06d3456ca1522f919d56e4db8ce8c2b53317f1fb263f2475d64771e9e7e7265d",
  cd119File: "de57b7f113d93f687b5d9c488bf6751a5d1165b43e55e2d4b67e2f9ad998ca02",
  cd119Dbf: "745f483a2352cfce19a20f91727df56f7d38b77773b4dbb64a61208a568b8118",
} as const;

const RECEIPT_PARENTS = [
  "il-2022-house-primary-listing",
  ...Array.from({ length: 17 }, (_, index) => `il-2022-house-primary-district-${String(index + 1).padStart(2, "0")}`),
  "il-2024-house-primary-listing",
  ...Array.from({ length: 17 }, (_, index) => `il-2024-house-primary-district-${String(index + 1).padStart(2, "0")}`),
  "house-democratic-primary-source-selection-proposal-20260804-v1",
] as const;
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;

const EXPECTED_CONTEST_FACTS = {
  "2022:01": ["il:2022:us-house:01:democratic", "7a0cc0fb81da5213d0312ab0ee2315cc3e67a351a76ee8e13cb105e9fe93da02"],
  "2022:02": ["il:2022:us-house:02:democratic", "cd1bd467c181144416a233944a0d9a97a44d081f450381fb98ae45f7d21ba22f"],
  "2022:03": ["il:2022:us-house:03:democratic", "50a422241697c768ac1dcde42b212841859a375ab9f7b24b5d7365f693a4253d"],
  "2022:04": ["il:2022:us-house:04:democratic", "d981ceaf97978ba41137cd8a16479043deda74c18678f6b23277a308f6d43f75"],
  "2022:05": ["il:2022:us-house:05:democratic", "38a77a88eac93560c9146740cc3ad55ed2a7fa6d0cb3768633a020fa31be1a2d"],
  "2022:06": ["il:2022:us-house:06:democratic", "1d941e5746fb6d299e87f5464f8d95f9814e5af5f4e6eda6415a72947f50f222"],
  "2022:07": ["il:2022:us-house:07:democratic", "dafcd4e4efc44717e104eb3e2dd86584a46633300a5ae8fb26062df385976d78"],
  "2022:08": ["il:2022:us-house:08:democratic", "e3755293d803a5676385ac1844f3ecd2cd9fd97d01e705e8fb5a991deb9fe1b8"],
  "2022:09": ["il:2022:us-house:09:democratic", "bce387208a2996e62cda0c5be079783e90e888b3554f904363ce99fb801b5d55"],
  "2022:10": ["il:2022:us-house:10:democratic", "3374b3f55cba3e802ab4bfad37c260f5c8048209abba9fa792dce788d4f4499e"],
  "2022:11": ["il:2022:us-house:11:democratic", "d3006b2e3cb4ee651f7d17c873d0bea519197c5068b6917e43b835c563d39235"],
  "2022:12": ["il:2022:us-house:12:democratic", "6d8059a1a6365012e45ebebe93ce02127fc6fb006a3cab08048824cd1442aa81"],
  "2022:13": ["il:2022:us-house:13:democratic", "aab5aedefca18e468ed7d301b3b7cb7190a86a8b73fe1f69ffddb7a83033f7a3"],
  "2022:14": ["il:2022:us-house:14:democratic", "f6646b23a13b5d1beb6326d35ae7fee3753640b6c4963c564170bfe439f3c09e"],
  "2022:15": ["il:2022:us-house:15:democratic", "2f67ba2f2d325686b339ba942e791b78ecf7a344ff7aa90b9d7df451a3734a59"],
  "2022:16": ["il:2022:us-house:16:democratic", "25c029cd1ab0b664872dab6dccab0308e602d929b7168d74f07a2f2da681730f"],
  "2022:17": ["il:2022:us-house:17:democratic", "91001cb8e46726318934b2eeb1472aee5eee839fa9571477e04b884a5325843c"],
  "2024:01": ["il:2024:us-house:01:democratic", "964f327c20bc749962a4140f225d2b210560d0682280b978ba00e4badc4e89bf"],
  "2024:02": ["il:2024:us-house:02:democratic", "2c5cdacb139996948f530facd25d02b03063c752e7d2580bc5db8b34663eb0d8"],
  "2024:03": ["il:2024:us-house:03:democratic", "5b2a77ab9b06c236bfc8e951b0baf2e9ff701cb8cb2f141d47e4e2a8c286f44a"],
  "2024:04": ["il:2024:us-house:04:democratic", "40f449ab4987bc84ecef718d88c714bcb63a74e870994ddc84469a4f9a91f3ee"],
  "2024:05": ["il:2024:us-house:05:democratic", "ac32114cf4c7ac4f8c062808d6440c65423ff5974059ccd21979df8f17bead32"],
  "2024:06": ["il:2024:us-house:06:democratic", "04791004db8b84894095f578d14d642c9b39323efb0a20934f7c0e9a5b6ea441"],
  "2024:07": ["il:2024:us-house:07:democratic", "dc5edf48d19ba85cfc235031b767101dee1a5f368f9b01fa009a458f0c08392d"],
  "2024:08": ["il:2024:us-house:08:democratic", "f36647a90711825f137cccca4d31d1390426872e3cef130cd079f4916ca971bc"],
  "2024:09": ["il:2024:us-house:09:democratic", "67b172d8fd6f91aece09da8eaf5a4de89b449f68b0984bceaa7ab7e51c59d75d"],
  "2024:10": ["il:2024:us-house:10:democratic", "33c4832e89d2dc975cec024b38a4cd70109fc589488a4f433030348ad3da9442"],
  "2024:11": ["il:2024:us-house:11:democratic", "844b30f30dadb0487c46f02c6e8f6aecc4a9f5fab2916b3b42ddf62987d0c45d"],
  "2024:12": ["il:2024:us-house:12:democratic", "b5566c954576f75c1c79a6c88855fd8a9c90dd102e2052477c03cfd062dbb21a"],
  "2024:13": ["il:2024:us-house:13:democratic", "604f0adc1bf1802d284614401f82710c0767bd49ad49ee440e6932cefb1573c6"],
  "2024:14": ["il:2024:us-house:14:democratic", "040b13e2ad84f33b711c1582612214b1701e7d50a0a587196c9a1753671cfd4f"],
  "2024:15": ["il:2024:us-house:15:democratic", "07d69993faca58ae136058fba61f91c4f3c07f2072fead4fe08de97ee296d3e4"],
  "2024:16": ["il:2024:us-house:16:democratic", "67282ba43c2267c5b18ceac6b530801179e60adbc396e67c54279d355c09b24d"],
  "2024:17": ["il:2024:us-house:17:democratic", "306c433b77c10ed01859a550216aa97f7f71999e8d04779ceb733787817d040d"],
} as const;

const INHERITED_UNRESOLVED_GATES = [
  "retain_final_state_canvass_or_certification",
  "review_incumbent_candidate_identity",
  "review_historical_district_compatibility",
  "review_progressive_candidate_classification",
] as const;
export const ILLINOIS_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 =
  "2b7f5f221c72850492fe0892778fde2c8b740ddab5b019dae36351f4a012c4ad" as const;

type Row = Readonly<{
  observationId: string;
  contestId: string;
  contestSha256: string;
  seatCycleId: string;
  districtCode: string;
  cycleYear: 2022 | 2024;
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
  certificationStatus: "not_retained";
  evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type IllinoisPrimaryGeographyCandidate = Readonly<{
  schema: typeof ILLINOIS_PRIMARY_GEOGRAPHY_V1;
  version: 1;
  generatedAt: "2026-08-06T03:30:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inheritedUnresolvedGates: typeof INHERITED_UNRESOLVED_GATES;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    contestCycleObservations: 34;
    cd118ToCd119PlanContinuityCandidates: 17;
    exactCd119SessionKeyCandidates: 17;
    numberedDistrictsPerLayer: 17;
    sentinelRowsPerLayer: 1;
    compatibilityCandidates: 34;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type IllinoisPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: IllinoisHouseDemocraticPrimaryResultsReceipt;
  receiptFileSha256: string;
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
  throw new Error(`Illinois primary geography rejected: ${code}`);
};
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};
const parentProjection = (rows: readonly Row[]) => rows.map((row) => ({
  observationId: row.observationId,
  contestId: row.contestId,
  contestSha256: row.contestSha256,
  districtCode: row.districtCode,
  cycleYear: row.cycleYear,
  targetCd119Geoid: row.targetCd119Geoid,
  historicalCongressSession: row.historicalCongressSession,
  historicalGeoid: row.historicalGeoid,
  certificationStatus: row.certificationStatus,
  compatibilityDisposition: row.compatibilityDisposition,
  evidenceClass: row.evidenceClass,
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
    count !== 18 || headerLength < 65 || recordLength < 2 ||
    headerLength + count * recordLength > bytes.length || offset !== recordLength || bytes[headerLength - 1] !== 0x0d
  ) fail("DBF_LAYOUT_INVALID");
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
    return {
      state: value[stateField],
      geoid: value[geoidField],
      district: value[districtField],
      session: value.CDSESSN,
    };
  }).sort((left, right) => bytewise(left.geoid ?? "", right.geoid ?? ""));
  const numbered = rows.filter((row) => row.district !== "ZZ");
  const sentinels = rows.filter((row) => row.district === "ZZ");
  if (
    numbered.length !== 17 || sentinels.length !== 1 || sentinels[0]!.state !== "17" ||
    sentinels[0]!.geoid !== "17ZZ" || sentinels[0]!.session !== session ||
    numbered.some((row, index) =>
      row.state !== "17" || row.geoid !== `17${String(index + 1).padStart(2, "0")}` ||
      row.district !== String(index + 1).padStart(2, "0") || row.session !== session
    )
  ) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildIllinoisPrimaryGeographyCandidate(
  input: IllinoisPrimaryGeographyInput,
): IllinoisPrimaryGeographyCandidate {
  const actualHashes = [
    input.proposalFileSha256,
    input.receiptFileSha256,
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
  const receipt = validateIllinoisHouseDemocraticPrimaryResultsReceipt(input.receipt);
  const decision = proposal.decisions.find(
    (candidate) => candidate.decisionId === "approve-historical-district-cd119-compatibility-v1",
  );
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet || decision?.resolution !== null ||
    receipt.certificationStatus !== "not_retained" || receipt.review.status !== "proposed" ||
    receipt.review.reviewer !== null || receipt.review.reviewedAt !== null ||
    canonicalJson(receipt.unresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("PARENT_INVALID");

  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Illinois")) {
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
    ["illinois-house-democratic-primary-results-receipt-2022-2024-v1", INPUTS.receiptFile, "data/metadata/illinois-house-democratic-primary-results-receipt-2022-2024-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-17", INPUTS.cd118File, "data/source/tiger2022/tl_2022_17_cd118.zip", "source", []],
    ["tiger-cd119-17", INPUTS.cd119File, "data/source/tiger2025/tl_2025_17_cd119.zip", "source", []],
  ] as const;
  if (
    !Array.isArray(lock.entries) || required.some(([id, fileSha256, retainedPath, kind, parentIds]) => {
      const matches = lock.entries!.filter((entry) => entry.id === id);
      return matches.length !== 1 || matches[0]!.retainedStatus !== "retained" || matches[0]!.sha256 !== fileSha256 ||
        matches[0]!.retainedPath !== retainedPath || matches[0]!.kind !== kind ||
        canonicalJson(matches[0]!.parentIds) !== canonicalJson(parentIds);
    })
  ) fail("SOURCE_LOCK_MISMATCH");

  const rows: Row[] = receipt.contests.map((contest) => {
    const targetCd119Geoid = `17${contest.districtCode}`;
    const historicalCongressSession = contest.cycleYear === 2022 ? "118" as const : "119" as const;
    if (
      !inventoryKeys.has(`119:${targetCd119Geoid}`) ||
      !inventoryKeys.has(`${historicalCongressSession}:${targetCd119Geoid}`)
    ) fail("CONTEST_OUTSIDE_TIGER_CLOSURE");
    const isContinuity = contest.cycleYear === 2022;
    const unsigned = {
      observationId: `il:geography:${contest.cycleYear}:${contest.districtCode}`,
      contestId: contest.contestId,
      contestSha256: contest.contestSha256,
      seatCycleId: `seat_house_il_${contest.districtCode}_current`,
      districtCode: contest.districtCode,
      cycleYear: contest.cycleYear,
      targetCd119Geoid,
      historicalCongressSession,
      historicalGeoid: targetCd119Geoid,
      compatibilityDisposition: isContinuity
        ? "official_no_plan_change_declaration_same_geoid_key_candidate" as const
        : "same_cd119_session_and_geoid_exact_key_candidate" as const,
      evidenceClass: isContinuity
        ? "direct_official_plan_continuity_and_derived_key" as const
        : "derived_exact_session_and_key" as const,
      confidence: "high" as const,
      compatibilityCandidate: true as const,
      compatibilityApproved: false as const,
      identityApproved: false as const,
      certificationStatus: "not_retained" as const,
      evaluatorUse: "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" as const,
      scoreEligible: false as const,
      rationaleCodes: isContinuity
        ? ["official_census_cd119_redraw_list_excludes_il", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory"]
        : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:il-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));

  const unsigned = {
    schema: ILLINOIS_PRIMARY_GEOGRAPHY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T03:30:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inheritedUnresolvedGates: INHERITED_UNRESOLVED_GATES,
    inputs: {
      sourceSelectionProposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, decisionUnresolved: true },
      illinoisReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet, certificationStatus: "not_retained" },
      censusPlanChangeAuthority: { sourceLockId: required[2][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_il_absent" },
      tigerLayers: [
        { sourceLockId: required[3][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", numberedDistrictCount: 17, sentinelCount: 1 },
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", numberedDistrictCount: 17, sentinelCount: 1 },
      ],
    },
    methodology: {
      targetSession: "119",
      cycleSessionMapping: { "2022": "118", "2024": "119" },
      rawTigerGeometryEqualityAssessed: false,
      overlapThresholdUsed: false,
      populationEquivalenceAssessed: false,
      automaticDecisionClosure: false,
      evaluatorNumericValues: 0,
      future2026Rows: 0,
    },
    summary: {
      contestCycleObservations: 34 as const,
      cd118ToCd119PlanContinuityCandidates: 17 as const,
      exactCd119SessionKeyCandidates: 17 as const,
      numberedDistrictsPerLayer: 17 as const,
      sentinelRowsPerLayer: 1 as const,
      compatibilityCandidates: 34 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:il-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      analysisConclusion: "official_evidence_supports_il_cd118_to_cd119_plan_continuity_and_exact_cd119_numbered_keys",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:il-primary-geography-candidate:v1\0", unsigned) };
}

export function validateIllinoisPrimaryGeographyCandidate(
  value: IllinoisPrimaryGeographyCandidate,
): IllinoisPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inheritedUnresolvedGates", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== ILLINOIS_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 34 ||
    value.defaultUse !== "exclude_from_evaluator_until_certification_identity_historical_geography_and_progressive_classification_review" ||
    canonicalJson(value.inheritedUnresolvedGates) !== canonicalJson(INHERITED_UNRESOLVED_GATES)
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = [2022, 2024].flatMap((year) =>
    Array.from({ length: 17 }, (_, index) => `il:geography:${year}:${String(index + 1).padStart(2, "0")}`)
  ).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "certificationStatus", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    const expectedSession = row.cycleYear === 2022 ? "118" : "119";
    const expectedGeoid = `17${row.districtCode}`;
    const expectedContest = EXPECTED_CONTEST_FACTS[`${row.cycleYear}:${row.districtCode}` as keyof typeof EXPECTED_CONTEST_FACTS];
    const expectedDisposition = row.cycleYear === 2022
      ? "official_no_plan_change_declaration_same_geoid_key_candidate"
      : "same_cd119_session_and_geoid_exact_key_candidate";
    const expectedEvidenceClass = row.cycleYear === 2022
      ? "direct_official_plan_continuity_and_derived_key"
      : "derived_exact_session_and_key";
    const expectedRationaleCodes = row.cycleYear === 2022
      ? ["official_census_cd119_redraw_list_excludes_il", "same_state_district_geoid_in_cd118_and_cd119_numbered_inventory"]
      : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"];
    if (
      rowSha256 !== digest("dsa-seats:il-primary-geography-row:v1\0", unsignedRow) ||
      row.compatibilityApproved || row.identityApproved || row.scoreEligible || !row.compatibilityCandidate ||
      row.confidence !== "high" || row.certificationStatus !== "not_retained" ||
      row.evaluatorUse !== "excluded_pending_certification_identity_historical_geography_and_progressive_classification_review" ||
      row.historicalCongressSession !== expectedSession ||
      row.historicalGeoid !== expectedGeoid || row.targetCd119Geoid !== expectedGeoid ||
      row.seatCycleId !== `seat_house_il_${row.districtCode}_current` ||
      !expectedContest || canonicalJson([row.contestId, row.contestSha256]) !== canonicalJson(expectedContest) ||
      row.compatibilityDisposition !== expectedDisposition || row.evidenceClass !== expectedEvidenceClass ||
      canonicalJson(row.rationaleCodes) !== canonicalJson(expectedRationaleCodes) ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)
    ) fail(expectedContest && row.contestSha256 !== expectedContest[1] ? "RETAINED_FACT_INVALID" : "ROW_INVALID");
  }
  if (
    canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson({
      contestCycleObservations: 34,
      cd118ToCd119PlanContinuityCandidates: 17,
      exactCd119SessionKeyCandidates: 17,
      numberedDistrictsPerLayer: 17,
      sentinelRowsPerLayer: 1,
      compatibilityCandidates: 34,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    })
  ) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    digest("dsa-seats:il-primary-geography-parent-projection:v1\0", parentProjection(value.rows)) !== ILLINOIS_PRIMARY_GEOGRAPHY_PARENT_PROJECTION_SHA256 ||
    value.rowSetSha256 !== digest("dsa-seats:il-primary-geography-row-set:v1\0", value.rows) ||
    value.rowSetSha256 !== ILLINOIS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:il-primary-geography-candidate:v1\0", unsigned) ||
    packageSha256 !== ILLINOIS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
