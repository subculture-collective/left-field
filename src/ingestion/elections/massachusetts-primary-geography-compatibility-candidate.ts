import { createHash } from "node:crypto";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseDemocraticPrimarySourceSelectionProposal } from "./house-democratic-primary-source-selection-proposal";
import {
  validateMassachusettsPrimaryReceipt,
  type MassachusettsPrimaryReceipt,
} from "./massachusetts-house-democratic-primary-results-receipt";

export const MASSACHUSETTS_PRIMARY_GEOGRAPHY_V1 =
  "massachusetts-primary-geography-compatibility-candidate-v1" as const;
export const MASSACHUSETTS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 =
  "9dc75c5963c0467adaa684723a82792a50eb9435e4a1d3abf32d2c7dd6c7c2e1" as const;
export const MASSACHUSETTS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256 =
  "7b73e142ec8a6d8024b5845bd0d19eda4569b69a72a03dc83edcb7d231bd11c1" as const;

const INPUTS = {
  proposalFile: "85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1",
  proposalPackage: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb",
  receiptFile: "8dbcf792852355bcb88618a9982d22d422e5dab222330d9110f4644e10ac47cb",
  receiptPackage: "eb2c8172b785bea76e9632cb6813bd53a2b2ec2ad1ebbd232482bda45df63931",
  receiptSet: "2bcd6a4082753ff34868b3523ac9ef1c5981a8de48e0f03bcb453f58277ba8f9",
  authorityFile: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
  cd118File: "ca6e9e2c25b06d4ee25fc8894f16c74226fd54a94dee2e70952e0f984a09629e",
  cd118Dbf: "14ae8af019661e6e57ab3ee962257c97b873aa4d64757709caa5ab6ae0c947ce",
  cd119File: "d7d129c0b38114b3f555d84c1ae74cc7bc405562964e0a649e7b45d9c4325e9b",
  cd119Dbf: "7d174765fdc0b6b9ace930aea68ce24e02f8682b03a0edbbd64fd94c6d32d5ba",
} as const;

const RECEIPT_PARENTS = [
  "house-democratic-primary-source-selection-proposal-20260804-v1",
  "ma-2022-house-democratic-primary-search",
  "ma-2024-house-democratic-primary-search",
  ...Array.from({ length: 9 }, (_, index) => `ma-2022-house-democratic-primary-district-${index + 1}-municipality-csv`),
  ...Array.from({ length: 9 }, (_, index) => `ma-2024-house-democratic-primary-district-${index + 1}-municipality-csv`),
  "ma-primary-certification-policy-rendered-20260805",
  "ma-2026-state-primary-schedule-rendered-20260805",
] as const;
const PROPOSAL_PARENTS = [
  "dsa-target-factual-projection-20260804-v1",
  "dsa-target-incumbent-roster-20260804-v1",
  "fec-2026-congressional-primary-dates",
  "geo-national-cd119",
] as const;

const EXPECTED_CONTEST_FACTS = {
  "2022:01": ["ma:2022:regular:us-house:01:democratic", "44c6b224cc727b24ba55078ef563351ea907d0f11499ba5c1c5d15e8474a4aba"],
  "2022:02": ["ma:2022:regular:us-house:02:democratic", "577d8fb199060f25687037ec0429f604e0ece418ccb3ec3356b8163df58866a9"],
  "2022:03": ["ma:2022:regular:us-house:03:democratic", "587ed36be08a71fabda7db1fd5c58606ad564ecf4a4d70b55ff96d08701b8d98"],
  "2022:04": ["ma:2022:regular:us-house:04:democratic", "f269b07037c39f8d716e086efe1bc86b7a9e38f4c4afa9d8ed2a3b9ced9c0e65"],
  "2022:05": ["ma:2022:regular:us-house:05:democratic", "7e0f3fc31909f8502a1680332a048bac5fe67ffc0035ea608bd5b8d36a766e1f"],
  "2022:06": ["ma:2022:regular:us-house:06:democratic", "3ec7c1dc0e9122a11142a32e32904a6dd85c7ad51c68ce17b364ee7a74071888"],
  "2022:07": ["ma:2022:regular:us-house:07:democratic", "3c4c769d57a3948bd2388fff046b92e343fd5c083015f51a670f99d070d6a5eb"],
  "2022:08": ["ma:2022:regular:us-house:08:democratic", "777584b87c90ca9f8235bf70791a67f9c7e49629033c00ee93d46c3745d79014"],
  "2022:09": ["ma:2022:regular:us-house:09:democratic", "735f6c0efcdce1eda05ec9ceb3e8062ef980d0d577b685b790378b24e3d65481"],
  "2024:01": ["ma:2024:regular:us-house:01:democratic", "cc347575c5caba3e8790bc9faf3c667a7f04967789fec83c366a212f7f9d8de2"],
  "2024:02": ["ma:2024:regular:us-house:02:democratic", "a6fe870d05048fad7a8b71e55aef82783116b92218e3685aad72f7f16b5496ee"],
  "2024:03": ["ma:2024:regular:us-house:03:democratic", "124478b22f0b7857b059bde73b5c24c75df6e6cdecddf7fb20f73147ef4de721"],
  "2024:04": ["ma:2024:regular:us-house:04:democratic", "2d8a8d388a79121ab2a134cb5b00b1108c1e6bf2a4c4ce0bd997bdc83fd5aace"],
  "2024:05": ["ma:2024:regular:us-house:05:democratic", "cea568f37c3fe3dc68fc2681d78080d3a98769c871b73ac1c1a20aab0bf5865d"],
  "2024:06": ["ma:2024:regular:us-house:06:democratic", "63c03538ea266d41f56294bf637cba15a990d3f1586421077b7863ca241046f0"],
  "2024:07": ["ma:2024:regular:us-house:07:democratic", "94a194554c2d1e51b99e77483af595a2bff0485dc725acbe1f94f52f22927f75"],
  "2024:08": ["ma:2024:regular:us-house:08:democratic", "ea5183518bc534bb7a2f9743bcbbbff4b70a30debfe1e2c133fc6ee01a8957a2"],
  "2024:09": ["ma:2024:regular:us-house:09:democratic", "2ae05eaf0d9a7ed05924a8d073b9b15ef60c8eced56392b0b4e7b55f6fcfface"],
} as const;

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
  evaluatorUse: "excluded_pending_authorized_identity_historical_geography_and_review";
  scoreEligible: false;
  rationaleCodes: readonly string[];
  rowSha256: string;
}>;

export type MassachusettsPrimaryGeographyCandidate = Readonly<{
  schema: typeof MASSACHUSETTS_PRIMARY_GEOGRAPHY_V1;
  version: 1;
  generatedAt: "2026-08-06T03:30:00.000Z";
  sourceCutoff: "2026-08-05";
  reviewerOnly: true;
  publicationEligible: false;
  defaultUse: "exclude_from_evaluator_until_authorized_identity_historical_geography_and_review";
  review: Readonly<{ status: "proposed"; reviewer: null; reviewedAt: null; resolution: null }>;
  inputs: Readonly<Record<string, unknown>>;
  methodology: Readonly<Record<string, unknown>>;
  summary: Readonly<{
    contestCycleObservations: 18;
    cd118ToCd119PlanContinuityCandidates: 9;
    exactCd119SessionKeyCandidates: 9;
    compatibilityCandidates: 18;
    automaticallyApprovedRows: 0;
    scoreEligibleRows: 0;
  }>;
  rows: readonly Row[];
  rowSetSha256: string;
  decisionSupport: Readonly<Record<string, unknown>>;
  packageSha256: string;
}>;

export type MassachusettsPrimaryGeographyInput = Readonly<{
  proposal: unknown;
  proposalFileSha256: string;
  receipt: MassachusettsPrimaryReceipt;
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
  throw new Error(`Massachusetts primary geography rejected: ${code}`);
};
const exactKeys = (value: object, keys: readonly string[], code: string): void => {
  if (canonicalJson(Object.keys(value).sort(bytewise)) !== canonicalJson([...keys].sort(bytewise))) fail(code);
};

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
    count !== 9 || headerLength < 65 || recordLength < 2 ||
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
  if (rows.some((row, index) =>
    row.state !== "25" || row.geoid !== `25${String(index + 1).padStart(2, "0")}` ||
    row.district !== String(index + 1).padStart(2, "0") || row.session !== session
  )) fail("DBF_INVENTORY_INVALID");
  return rows;
}

export function buildMassachusettsPrimaryGeographyCandidate(
  input: MassachusettsPrimaryGeographyInput,
): MassachusettsPrimaryGeographyCandidate {
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
  const receipt = validateMassachusettsPrimaryReceipt(input.receipt);
  const decision = proposal.decisions.find(
    (candidate) => candidate.decisionId === "approve-historical-district-cd119-compatibility-v1",
  );
  if (
    proposal.packageSha256 !== INPUTS.proposalPackage || receipt.packageSha256 !== INPUTS.receiptPackage ||
    receipt.summary.contestSetSha256 !== INPUTS.receiptSet || decision?.resolution !== null || receipt.review.resolution !== null
  ) fail("PARENT_INVALID");

  const phrase = "five states (Alabama, Georgia, Louisiana, New York, and North Carolina) that redrew their congressional district plans for the 119th Congress";
  if (!input.authorityHtml.includes(phrase) || input.authorityHtml.includes("five states (Alabama, Massachusetts")) {
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
    ["massachusetts-house-democratic-primary-results-2022-2026-v1", INPUTS.receiptFile, "data/metadata/massachusetts-house-democratic-primary-results-2022-2026-v1.json", "review_candidate", RECEIPT_PARENTS],
    ["census-cd119-plan-change-authority-20260805", INPUTS.authorityFile, "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html", "source", []],
    ["tiger-cd118-25", INPUTS.cd118File, "data/source/tiger2022/tl_2022_25_cd118.zip", "source", []],
    ["tiger-cd119-25", INPUTS.cd119File, "data/source/tiger2025/tl_2025_25_cd119.zip", "source", []],
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
    const targetCd119Geoid = `25${contest.districtCode}`;
    const historicalCongressSession = contest.cycleYear === 2022 ? "118" as const : "119" as const;
    if (
      !inventoryKeys.has(`119:${targetCd119Geoid}`) ||
      !inventoryKeys.has(`${historicalCongressSession}:${targetCd119Geoid}`)
    ) fail("CONTEST_OUTSIDE_TIGER_CLOSURE");
    const isContinuity = contest.cycleYear === 2022;
    const unsigned = {
      observationId: `ma:geography:${contest.cycleYear}:${contest.districtCode}`,
      contestId: contest.contestId,
      contestSha256: contest.contestSha256,
      seatCycleId: `seat_house_ma_${contest.districtCode}_current`,
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
      evaluatorUse: "excluded_pending_authorized_identity_historical_geography_and_review" as const,
      scoreEligible: false as const,
      rationaleCodes: isContinuity
        ? ["official_census_cd119_redraw_list_excludes_ma", "same_state_district_geoid_in_cd118_and_cd119_inventory"]
        : ["same_cd119_congressional_session", "same_state_district_geoid_in_cd119_inventory"],
    };
    return { ...unsigned, rowSha256: digest("dsa-seats:ma-primary-geography-row:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.observationId, right.observationId));

  const unsigned = {
    schema: MASSACHUSETTS_PRIMARY_GEOGRAPHY_V1,
    version: 1 as const,
    generatedAt: "2026-08-06T03:30:00.000Z" as const,
    sourceCutoff: "2026-08-05" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "exclude_from_evaluator_until_authorized_identity_historical_geography_and_review" as const,
    review: { status: "proposed" as const, reviewer: null, reviewedAt: null, resolution: null },
    inputs: {
      sourceSelectionProposal: { sourceLockId: required[0][0], fileSha256: INPUTS.proposalFile, packageSha256: INPUTS.proposalPackage, decisionUnresolved: true },
      massachusettsReceipt: { sourceLockId: required[1][0], fileSha256: INPUTS.receiptFile, packageSha256: INPUTS.receiptPackage, contestSetSha256: INPUTS.receiptSet },
      censusPlanChangeAuthority: { sourceLockId: required[2][0], fileSha256: INPUTS.authorityFile, authorityClaim: "five_states_redrew_for_cd119_al_ga_la_ny_nc_ma_absent" },
      tigerLayers: [
        { sourceLockId: required[3][0], fileSha256: INPUTS.cd118File, dbfMemberSha256: INPUTS.cd118Dbf, cdSession: "118", districtCount: 9 },
        { sourceLockId: required[4][0], fileSha256: INPUTS.cd119File, dbfMemberSha256: INPUTS.cd119Dbf, cdSession: "119", districtCount: 9 },
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
      contestCycleObservations: 18 as const,
      cd118ToCd119PlanContinuityCandidates: 9 as const,
      exactCd119SessionKeyCandidates: 9 as const,
      compatibilityCandidates: 18 as const,
      automaticallyApprovedRows: 0 as const,
      scoreEligibleRows: 0 as const,
    },
    rows,
    rowSetSha256: digest("dsa-seats:ma-primary-geography-row-set:v1\0", rows),
    decisionSupport: {
      informsDecisionId: "approve-historical-district-cd119-compatibility-v1",
      analysisConclusion: "official_evidence_supports_ma_cd118_to_cd119_plan_continuity_and_exact_cd119_keys",
      lifecycle: "evidence_for_bound_existing_decision_not_an_independent_decision",
    },
  };
  return { ...unsigned, packageSha256: digest("dsa-seats:ma-primary-geography-candidate:v1\0", unsigned) };
}

export function validateMassachusettsPrimaryGeographyCandidate(
  value: MassachusettsPrimaryGeographyCandidate,
): MassachusettsPrimaryGeographyCandidate {
  exactKeys(value, ["schema", "version", "generatedAt", "sourceCutoff", "reviewerOnly", "publicationEligible", "defaultUse", "review", "inputs", "methodology", "summary", "rows", "rowSetSha256", "decisionSupport", "packageSha256"], "TOP_LEVEL_FIELDS_INVALID");
  if (
    value.schema !== MASSACHUSETTS_PRIMARY_GEOGRAPHY_V1 || value.version !== 1 || !value.reviewerOnly ||
    value.publicationEligible || value.review.status !== "proposed" || value.review.reviewer !== null ||
    value.review.reviewedAt !== null || value.review.resolution !== null || value.rows.length !== 18
  ) fail("LIFECYCLE_INVALID");
  const expectedIds = [2022, 2024].flatMap((year) =>
    Array.from({ length: 9 }, (_, index) => `ma:geography:${year}:${String(index + 1).padStart(2, "0")}`)
  ).sort(bytewise);
  for (const [index, row] of value.rows.entries()) {
    exactKeys(row, ["observationId", "contestId", "contestSha256", "seatCycleId", "districtCode", "cycleYear", "targetCd119Geoid", "historicalCongressSession", "historicalGeoid", "compatibilityDisposition", "evidenceClass", "confidence", "compatibilityCandidate", "compatibilityApproved", "identityApproved", "evaluatorUse", "scoreEligible", "rationaleCodes", "rowSha256"], "ROW_FIELDS_INVALID");
    const { rowSha256, ...unsignedRow } = row;
    const expectedSession = row.cycleYear === 2022 ? "118" : "119";
    const expectedGeoid = `25${row.districtCode}`;
    const expectedContest = EXPECTED_CONTEST_FACTS[`${row.cycleYear}:${row.districtCode}` as keyof typeof EXPECTED_CONTEST_FACTS];
    const expectedDisposition = row.cycleYear === 2022
      ? "official_no_plan_change_declaration_same_geoid_key_candidate"
      : "same_cd119_session_and_geoid_exact_key_candidate";
    const expectedEvidenceClass = row.cycleYear === 2022
      ? "direct_official_plan_continuity_and_derived_key"
      : "derived_exact_session_and_key";
    if (
      rowSha256 !== digest("dsa-seats:ma-primary-geography-row:v1\0", unsignedRow) ||
      row.compatibilityApproved || row.identityApproved || row.scoreEligible || !row.compatibilityCandidate ||
      row.confidence !== "high" || row.historicalCongressSession !== expectedSession ||
      row.historicalGeoid !== expectedGeoid || row.targetCd119Geoid !== expectedGeoid ||
      row.seatCycleId !== `seat_house_ma_${row.districtCode}_current` ||
      !expectedContest || canonicalJson([row.contestId, row.contestSha256]) !== canonicalJson(expectedContest) ||
      row.compatibilityDisposition !== expectedDisposition || row.evidenceClass !== expectedEvidenceClass ||
      (index > 0 && bytewise(value.rows[index - 1]!.observationId, row.observationId) >= 0)
    ) fail(expectedContest && row.contestSha256 !== expectedContest[1] ? "RETAINED_FACT_INVALID" : "ROW_INVALID");
  }
  if (
    canonicalJson(value.rows.map((row) => row.observationId)) !== canonicalJson(expectedIds) ||
    canonicalJson(value.summary) !== canonicalJson({
      contestCycleObservations: 18,
      cd118ToCd119PlanContinuityCandidates: 9,
      exactCd119SessionKeyCandidates: 9,
      compatibilityCandidates: 18,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    })
  ) fail("SUMMARY_INVALID");
  const { packageSha256, ...unsigned } = value;
  if (
    value.rowSetSha256 !== digest("dsa-seats:ma-primary-geography-row-set:v1\0", value.rows) ||
    value.rowSetSha256 !== MASSACHUSETTS_PRIMARY_GEOGRAPHY_ROW_SET_SHA256 ||
    packageSha256 !== digest("dsa-seats:ma-primary-geography-candidate:v1\0", unsigned) ||
    packageSha256 !== MASSACHUSETTS_PRIMARY_GEOGRAPHY_PACKAGE_SHA256
  ) fail("PACKAGE_INVALID");
  return value;
}
