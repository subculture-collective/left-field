import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateIncumbentTenureFactualCandidate } from "../ingestion/identity/incumbent-tenure-factual-candidate";
import { validateDsaTargetFactualProjection } from "./dsa-target-review-report";
import { validateDsaTargetProvisionalScoreV02 } from "./dsa-target-provisional-score-v02";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const SCORE_FILE_HASH =
  "4309a9a07dd4421b37f5a4da67ff58540ca6aac51f20b1a68f585ca40f4a0700";
const TENURE_FILE_HASH =
  "18e8fc5a7496362efdb33d07a2012063c2a2062ddb14c5b8605dbbebb28db867";
const CONGRESS_FILE_HASH =
  "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf";
const PROJECTION_FILE_HASH =
  "e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec";
const OUTPUT_HASH = "fe0502903e82639f13afa9557354da6066e57e4aad61e2056afdc2560bc32bc4";
const OUTPUT_BYTES = 932792;
const PACKAGE_HASH = "ce6ca1c48f3f3b907f1c89fa566b2482903fc5cf432306a97edb0b9293327292";
const BRIEF_SET_HASH = "6d88dbd6e8e0db95169a936fe98100155215af52c69070e43f70f1399c5b1486";
const hash = (domain: string, value: unknown): string =>
  createHash("sha256")
    .update(domain)
    .update(canonicalJson(value))
    .digest("hex");
const fail = (message: string): never => {
  throw new Error(`DSA_PRIORITY_BRIEFS_${message}`);
};
type LockEntry = Readonly<{
  id: string;
  url: string;
  retainedPath: string | null;
  retainedStatus: string;
  byteSize: number;
  sha256: string;
  kind: string;
  parentIds: readonly string[];
}>;

const locks = [
  {
    id: "dsa-target-provisional-score-20260807-v02",
    url: "urn:dsa-seats:dsa-target-provisional-score:v0.2:2026-08-07",
    path: "data/metadata/dsa-target-provisional-score-20260807-v02.json",
    bytes: 259145,
    sha256: SCORE_FILE_HASH,
    kind: "review_proposal",
    parents: [
      "dsa-target-evaluation-review-report-20260805-v6",
      "incumbent-alignment-tracker-candidate-20260807-v1",
    ],
  },
  {
    id: "incumbent-tenure-factual-candidate-20260804-v1",
    url: "urn:dsa-seats:incumbent-tenure-factual-candidate:v1:2026-08-04",
    path: "data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json",
    bytes: 401855,
    sha256: TENURE_FILE_HASH,
    kind: "review_proposal",
    parents: [
      "congress-legislators-current-20260804",
      "dsa-target-incumbent-roster-20260804-v1",
    ],
  },
  {
    id: "congress-legislators-current-20260804",
    url: "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    path: "data/source/identity/congress-legislators-current-20260804.json",
    bytes: 1466894,
    sha256: CONGRESS_FILE_HASH,
    kind: "source",
    parents: [],
  },
  {
    id: "dsa-target-factual-projection-20260804-v1",
    url: "urn:dsa-seats:dsa-target-factual-projection:v1:2026-08-04",
    path: "data/metadata/dsa-target-factual-projection-20260804-v1.json",
    bytes: 161915,
    sha256: PROJECTION_FILE_HASH,
    kind: "production_projection_receipt",
    parents: [],
  },
] as const;
const outputLock = {
  id: "dsa-target-priority-briefs-20260807-v1",
  url: "urn:dsa-seats:dsa-target-priority-briefs:v1:2026-08-07",
  path: "data/metadata/dsa-target-priority-briefs-20260807-v1.json",
  bytes: OUTPUT_BYTES,
  sha256: OUTPUT_HASH,
  kind: "review_proposal",
  parents: locks.map((row) => row.id),
} as const;

function validateLocks(
  sourceLock: Readonly<{ entries: readonly LockEntry[] }>,
  requireOutput: boolean,
): void {
  for (const expected of [...locks, ...(requireOutput ? [outputLock] : [])]) {
    const matches = sourceLock.entries.filter(
      (entry) => entry.id === expected.id,
    );
    if (matches.length !== 1) fail("SOURCE_LOCK_MISSING");
    const row = matches[0]!;
    if (
      row.url !== expected.url ||
      row.retainedPath !== expected.path ||
      row.retainedStatus !== "retained" ||
      row.byteSize !== expected.bytes ||
      row.sha256 !== expected.sha256 ||
      row.kind !== expected.kind ||
      canonicalJson(row.parentIds) !== canonicalJson(expected.parents)
    )
      fail("SOURCE_LOCK_MISMATCH");
  }
}

const driver = z.strictObject({
  key: z.enum([
    "blue_baseline",
    "primary_feasibility",
    "aipac_support",
    "incumbent_alignment_gap",
  ]),
  label: z.string(),
  score: z.number().min(0).max(100).nullable(),
  coverage: z.number().min(0).max(1),
  inferred: z.boolean(),
  explanation: z.string(),
});
const servicePeriod = z.strictObject({
  stateCode: z.string().length(2),
  district: z.union([z.number().int(), z.string()]),
  start: z.iso.date(),
  end: z.iso.date(),
  currentAtCutoff: z.boolean(),
});
const brief = z.strictObject({
  rank: z.number().int().min(1).max(212),
  seatCycleId: z.string(),
  districtLabel: z.string(),
  stateCode: z.string().length(2),
  districtCode: z.string(),
  incumbentName: z.string(),
  officialHouseName: z.string(),
  bioguideId: z.string(),
  birthYear: z.number().int().min(1900).max(2010),
  provisionalTargetScore: z.number(),
  baselineTargetScore: z.number(),
  formula: z.literal(
    "0.75 * baseline_target_score + 0.25 * incumbent_alignment_gap",
  ),
  qualifyingRoute: z.enum(["deep_blue", "aipac_supported_blue"]),
  scoreDrivers: z.array(driver).length(4),
  leftScore: z.number(),
  palestineScore: z.number().nullable(),
  endorsementLabels: z.string().nullable(),
  presidentialDemocraticMargin2024: z.number(),
  incumbentCashOnHand: z.number().nullable(),
  incumbentCashOnHandStatus: z.enum([
    "reported_value",
    "not_collected",
    "not_reported",
    "source_unavailable",
  ]),
  firstHouseServiceDate: z.iso.date(),
  cumulativeHouseServiceYears: z.number(),
  currentUninterruptedHouseServiceYears: z.number(),
  districtChangeCount: z.number().int(),
  materialServiceBreakCount: z.number().int(),
  serviceHistory: z.array(servicePeriod).min(1),
  scoreSummary: z.string(),
  personSummary: z.string(),
  districtSummary: z.string(),
  limitations: z.string(),
  sourceRowHashes: z.strictObject({ score: SHA, tenure: SHA }),
  briefSha256: SHA,
});

export const dsaTargetPriorityBriefsV1Schema = z.strictObject({
  schema: z.literal("dsa-target-priority-briefs-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-07T21:00:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(false),
  publicationEligible: z.literal(true),
  deployed: z.literal(false),
  publicationAuthorization: z.strictObject({ status: z.literal("owner_directed"), instructionRecordedInTask: z.literal(true), independentReviewerClaimed: z.literal(false), reviewerIdentityRecorded: z.literal(false), approvalTimestampRecorded: z.literal(false) }),
  selection: z.strictObject({
    mode: z.literal("all_scored_seats_from_provisional_v02"),
    requestedCount: z.literal(212),
    emittedCount: z.literal(212),
    defaultPublicViewCount: z.literal(50),
    rank50Score: z.literal(71.4),
    seatsAtOrAbove60: z.literal(129),
    boundaryRule: z.literal(
      "provisional_score_desc_then_seat_cycle_id_bytewise",
    ),
  }),
  inputs: z
    .array(z.strictObject({ sourceLockId: z.string(), fileSha256: SHA }))
    .length(4),
  methodology: z.strictObject({
    narrativeMethod: z.literal("deterministic_templates_from_retained_fields"),
    aiGeneratedBiographyClaims: z.literal(false),
    scoreMeaning: z.literal(
      "strategic_priority_not_win_probability_or_endorsement",
    ),
    cashFormatting: z.literal("usd_compact_one_decimal"),
    tenureRounding: z.literal(
      "one_decimal_years_in_narrative_raw_value_retained",
    ),
    missingValues: z.literal("stated_not_zero_filled"),
  }),
  summary: z.strictObject({
    briefs: z.literal(212),
    rankedUniverse: z.literal(212),
    aipacSupportedBlueRoute: z.number().int(),
    deepBlueRoute: z.number().int(),
    withReportedCash: z.number().int(),
    withDistrictChanges: z.number().int(),
    approvals: z.literal(1),
    publishedRows: z.literal(0),
  }),
  briefSetSha256: SHA,
  briefs: z.array(brief).length(212),
  packageSha256: SHA,
});
export type DsaTargetPriorityBriefsV1 = z.infer<
  typeof dsaTargetPriorityBriefsV1Schema
>;

type Legislator = {
  id?: { bioguide?: unknown };
  name?: { official_full?: unknown };
  bio?: { birthday?: unknown };
};
const money = (value: number): string =>
  value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `$${(value / 1_000).toFixed(1)}K`
      : `$${value.toFixed(0)}`;
const one = (value: number): string => value.toFixed(1);
const routeLabel = (route: "deep_blue" | "aipac_supported_blue"): string =>
  route === "deep_blue"
    ? "deep-blue district"
    : "AIPAC-supported blue district";

export function buildDsaTargetPriorityBriefsV1(
  input: Readonly<{
    score: unknown;
    scoreFileSha256: string;
    tenure: unknown;
    tenureFileSha256: string;
    legislators: unknown;
    legislatorsFileSha256: string;
    projection: unknown;
    projectionFileSha256: string;
    sourceLock: Readonly<{ entries: readonly LockEntry[] }>;
  }>,
  requireOutputLock = false,
): DsaTargetPriorityBriefsV1 {
  validateLocks(input.sourceLock, requireOutputLock);
  if (
    input.scoreFileSha256 !== SCORE_FILE_HASH ||
    input.tenureFileSha256 !== TENURE_FILE_HASH ||
    input.legislatorsFileSha256 !== CONGRESS_FILE_HASH ||
    input.projectionFileSha256 !== PROJECTION_FILE_HASH
  )
    fail("INPUT_FILE_HASH_INVALID");
  const score = validateDsaTargetProvisionalScoreV02(input.score),
    tenure = validateIncumbentTenureFactualCandidate(input.tenure),
    projection = validateDsaTargetFactualProjection(input.projection);
  if (!Array.isArray(input.legislators) || input.legislators.length !== 537)
    fail("CONGRESS_SOURCE_INVALID");
  const congressById = new Map<string, Legislator>();
  for (const person of input.legislators as Legislator[]) {
    const candidateId = z.string().parse(person.id?.bioguide);
    if (congressById.has(candidateId)) fail("CONGRESS_SOURCE_INVALID");
    congressById.set(candidateId, person);
  }
  const tenureBySeat = new Map(
    tenure.facts.map((row) => [row.seatCycleId, row]),
  );
  const projectionBySeat = new Map(
    projection.seats.map((row) => [row.seatCycleId, row]),
  );
  const selected = [...score.rows].sort(
    (a, b) => a.provisionalRank - b.provisionalRank,
  );
  if (
    selected.length !== 212 ||
    selected[49]?.provisionalTargetScore !== 71.4 ||
    score.rows.filter((row) => row.provisionalTargetScore >= 60).length !== 129
  )
    fail("SELECTION_INVALID");
  const briefs = selected.map((row) => {
    const fact =
        tenureBySeat.get(row.seatCycleId) ?? fail("TENURE_JOIN_INVALID"),
      district =
        projectionBySeat.get(row.seatCycleId) ??
        fail("PROJECTION_JOIN_INVALID"),
      person =
        congressById.get(fact.bioguideId) ?? fail("CONGRESS_JOIN_INVALID");
    if (
      district.stateCode !== row.stateCode ||
      district.districtCode !== row.districtCode ||
      typeof person.name?.official_full !== "string" ||
      typeof person.bio?.birthday !== "string"
    )
      fail("JOIN_INVALID");
    const officialHouseName = person.name!.official_full as string,
      birthday = person.bio!.birthday as string;
    const birthYear = Number(birthday.slice(0, 4));
    const cash =
      district.incumbentCashOnHand.kind === "value"
        ? district.incumbentCashOnHand.value
        : null;
    const cashStatus =
      district.incumbentCashOnHand.kind === "value"
        ? ("reported_value" as const)
        : district.incumbentCashOnHand.reason;
    const scoreDrivers = [
      {
        key: "blue_baseline" as const,
        label: "Blue baseline",
        score: row.components.blueBaseline.score!,
        coverage: row.components.blueBaseline.coverage,
        inferred: row.components.blueBaseline.inferred,
        explanation: `District Democratic baseline contributes ${one(row.components.blueBaseline.score!)} points; the retained 2024 presidential margin is D+${one(district.presidentialMargin2024.value)}.`,
      },
      {
        key: "primary_feasibility" as const,
        label: "Primary feasibility",
        ...row.components.primaryFeasibility,
        explanation: `Current partial feasibility evidence contributes ${one(row.components.primaryFeasibility.score!)} points and remains incomplete.`,
      },
      {
        key: "aipac_support" as const,
        label: "AIPAC support",
        score: row.components.aipacSupport.score,
        coverage: row.components.aipacSupport.coverage,
        inferred: row.components.aipacSupport.inferred,
        explanation:
          row.components.aipacSupport.score === null
            ? "AIPAC component is unavailable for this seat; the fallback route does not replace it with zero."
            : `Retained FEC AIPAC evidence contributes ${one(row.components.aipacSupport.score)} points; tracker labels are context only and are not double counted.`,
      },
      {
        key: "incumbent_alignment_gap" as const,
        label: "Incumbent alignment gap",
        ...row.components.incumbentAlignmentGap,
        explanation: `The retained voting trackers produce a ${one(row.components.incumbentAlignmentGap.score!)}-point alignment gap.`,
      },
    ];
    const serviceHistory = fact.sourceTerms.map((term) => ({
      stateCode: term.stateCode,
      district: term.district,
      start: term.start,
      end: term.end,
      currentAtCutoff: term.start <= "2026-08-04" && term.end > "2026-08-04",
    }));
    const scoreSummary = `Ranks #${row.provisionalRank} of ${score.summary.rankedSeats} scored seats at ${one(row.provisionalTargetScore!)}. The score combines 75% of the ${one(row.baselineTargetScore!)} baseline target score with 25% of the ${one(row.components.incumbentAlignmentGap.score!)} incumbent alignment gap. It qualifies through the ${routeLabel(row.baselineSelectedRoute!)} route.`;
    const personSummary = `${officialHouseName} (born ${birthYear}) has served in the U.S. House since ${fact.firstHouseServiceDate}. The retained record shows ${one(fact.cumulativeHouseServiceYears)} cumulative years of House service, ${one(fact.currentUninterruptedHouseServiceYears)} in the current uninterrupted stretch, ${fact.districtChangeCount} district change${fact.districtChangeCount === 1 ? "" : "s"}, and ${fact.materialServiceBreaks.length} material service break${fact.materialServiceBreaks.length === 1 ? "" : "s"}.`;
    const districtSummary = `${row.stateCode}-${row.districtCode} had a retained 2024 presidential Democratic margin of D+${one(district.presidentialMargin2024.value)}. Incumbent cash on hand is ${cash === null ? `not available (${cashStatus})` : `${money(cash)} as of ${district.incumbentCashOnHand.observedAt}`}.`;
    const unsigned = {
      rank: row.provisionalRank!,
      seatCycleId: row.seatCycleId,
      districtLabel: `${row.stateCode}-${row.districtCode}`,
      stateCode: row.stateCode,
      districtCode: row.districtCode,
      incumbentName: row.incumbentName,
      officialHouseName,
      bioguideId: fact.bioguideId,
      birthYear,
      provisionalTargetScore: row.provisionalTargetScore!,
      baselineTargetScore: row.baselineTargetScore!,
      formula:
        "0.75 * baseline_target_score + 0.25 * incumbent_alignment_gap" as const,
      qualifyingRoute: row.baselineSelectedRoute!,
      scoreDrivers,
      leftScore: row.leftScore,
      palestineScore: row.palestineScore,
      endorsementLabels: row.endorsementLabels,
      presidentialDemocraticMargin2024: district.presidentialMargin2024.value,
      incumbentCashOnHand: cash,
      incumbentCashOnHandStatus: cashStatus,
      firstHouseServiceDate: fact.firstHouseServiceDate,
      cumulativeHouseServiceYears: fact.cumulativeHouseServiceYears,
      currentUninterruptedHouseServiceYears:
        fact.currentUninterruptedHouseServiceYears,
      districtChangeCount: fact.districtChangeCount,
      materialServiceBreakCount: fact.materialServiceBreaks.length,
      serviceHistory,
      scoreSummary,
      personSummary,
      districtSummary,
      limitations:
        "The score is strategic priority, not win probability or endorsement; primary-history and filing-runway inputs remain incomplete, and inferred component coverage is preserved.",
      sourceRowHashes: { score: row.rowSha256, tenure: fact.factSha256 },
    };
    return {
      ...unsigned,
      briefSha256: hash("dsa-seats:dsa-target-priority-brief:v1\0", unsigned),
    };
  });
  const briefSetSha256 = hash(
    "dsa-seats:dsa-target-priority-brief-set:v1\0",
    briefs,
  );
  const unsigned = {
    schema: "dsa-target-priority-briefs-v1" as const,
    version: 1 as const,
    generatedAt: "2026-08-07T21:00:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    reviewerOnly: false as const,
    publicationEligible: true as const,
    deployed: false as const,
    publicationAuthorization: { status: "owner_directed" as const, instructionRecordedInTask: true as const, independentReviewerClaimed: false as const, reviewerIdentityRecorded: false as const, approvalTimestampRecorded: false as const },
    selection: {
      mode: "all_scored_seats_from_provisional_v02" as const,
      requestedCount: 212 as const,
      emittedCount: 212 as const,
      defaultPublicViewCount: 50 as const,
      rank50Score: 71.4 as const,
      seatsAtOrAbove60: 129 as const,
      boundaryRule:
        "provisional_score_desc_then_seat_cycle_id_bytewise" as const,
    },
    inputs: locks.map((row) => ({
      sourceLockId: row.id,
      fileSha256: row.sha256,
    })),
    methodology: {
      narrativeMethod: "deterministic_templates_from_retained_fields" as const,
      aiGeneratedBiographyClaims: false as const,
      scoreMeaning:
        "strategic_priority_not_win_probability_or_endorsement" as const,
      cashFormatting: "usd_compact_one_decimal" as const,
      tenureRounding:
        "one_decimal_years_in_narrative_raw_value_retained" as const,
      missingValues: "stated_not_zero_filled" as const,
    },
    summary: {
      briefs: 212 as const,
      rankedUniverse: 212 as const,
      aipacSupportedBlueRoute: briefs.filter(
        (row) => row.qualifyingRoute === "aipac_supported_blue",
      ).length,
      deepBlueRoute: briefs.filter((row) => row.qualifyingRoute === "deep_blue")
        .length,
      withReportedCash: briefs.filter((row) => row.incumbentCashOnHand !== null)
        .length,
      withDistrictChanges: briefs.filter((row) => row.districtChangeCount > 0)
        .length,
      approvals: 1 as const,
      publishedRows: 0 as const,
    },
    briefSetSha256,
    briefs,
  };
  return validateDsaTargetPriorityBriefsV1(
    {
      ...unsigned,
      packageSha256: hash(
        "dsa-seats:dsa-target-priority-briefs:v1\0",
        unsigned,
      ),
    },
    false,
  );
}

export function validateDsaTargetPriorityBriefsV1(
  value: unknown,
  pin = true,
): DsaTargetPriorityBriefsV1 {
  const parsed = dsaTargetPriorityBriefsV1Schema.parse(value),
    { packageSha256, ...unsigned } = parsed;
  if (
    parsed.briefs.some(
      ({ briefSha256, ...row }, index) =>
        briefSha256 !== hash("dsa-seats:dsa-target-priority-brief:v1\0", row) ||
        row.rank !== index + 1,
    ) ||
    parsed.briefSetSha256 !==
      hash("dsa-seats:dsa-target-priority-brief-set:v1\0", parsed.briefs) ||
    packageSha256 !==
      hash("dsa-seats:dsa-target-priority-briefs:v1\0", unsigned) ||
    new Set(parsed.briefs.map((row) => row.seatCycleId)).size !== 212 ||
    parsed.summary.aipacSupportedBlueRoute + parsed.summary.deepBlueRoute !==
      212 ||
    parsed.summary.approvals !== 1 ||
    parsed.summary.publishedRows !== 0 ||
    (pin &&
      (packageSha256 !== PACKAGE_HASH ||
        parsed.briefSetSha256 !== BRIEF_SET_HASH))
  )
    fail("PACKAGE_INVALID");
  return parsed;
}

export const dsaTargetPriorityBriefPins = {
  outputHash: OUTPUT_HASH,
  outputBytes: OUTPUT_BYTES,
  packageHash: PACKAGE_HASH,
  briefSetHash: BRIEF_SET_HASH,
} as const;
