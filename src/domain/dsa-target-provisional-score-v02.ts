import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateIncumbentAlignmentTrackerCandidate } from "../ingestion/scoring/incumbent-alignment-tracker-candidate";
import { validateDsaTargetReviewReportV6 } from "./dsa-target-review-report-v6";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const BASE_FILE_HASH =
  "cdce153e52cbfbcee669c64a6671b4d52cb11728f04c8a7bb2092c96b0063401";
const BASE_REPORT_HASH =
  "9df5ab4cb08556aac9a5ff87aa33d8bdf2aeed3a374b9c7d46fdc60e1d7965b7";
const ALIGNMENT_FILE_HASH =
  "2cbab7bdec9688c2e07dc6434507f114db4da1d7d4ad2803026f0740c994b8b0";
const ALIGNMENT_PACKAGE_HASH =
  "8644c752e1031cdc5b391daee51b94d972c053a2e6b72458bfb7378d147eb22f";
const ALIGNMENT_ROW_SET_HASH =
  "30cda96506b6bca460a1e64cac0fc0011e4d31bf88e11a77b01f03bed0fbd95f";
const OUTPUT_HASH = "4309a9a07dd4421b37f5a4da67ff58540ca6aac51f20b1a68f585ca40f4a0700";
const OUTPUT_BYTES = 259145;
const PACKAGE_HASH = "541c40c3a57c796d959b9d000a9c59de6c9b6fe448489683e28d8959aa9fa996";
const ROW_SET_HASH = "b26fe2b002baf69990fe4cae924580318c9dd9a484abb29d23f065e737c77896";
const order = (a: string, b: string): number =>
  Buffer.compare(Buffer.from(a), Buffer.from(b));
const hash = (domain: string, value: unknown): string =>
  createHash("sha256")
    .update(domain)
    .update(canonicalJson(value))
    .digest("hex");
const round = (value: number): number => Math.round(value * 10) / 10;
const fail = (message: string): never => {
  throw new Error(`DSA_PROVISIONAL_V02_${message}`);
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

const baseLock = {
  id: "dsa-target-evaluation-review-report-20260805-v6",
  url: "urn:dsa-seats:dsa-target-evaluation-review-report:v6:2026-08-05",
  path: "data/metadata/dsa-target-evaluation-review-report-20260805-v6.json",
  bytes: 367952,
  sha256: BASE_FILE_HASH,
  kind: "review_proposal",
  parents: [
    "dsa-target-factual-projection-20260804-v1",
    "incumbent-tenure-factual-candidate-20260804-v1",
    "dsa-target-evaluation-review-report-20260804-v2",
    "aipac-numeric-evidence-candidate-v4",
    "washington-house-top-two-results-receipt-20220802-20240806-v1",
  ],
} as const;
const alignmentLock = {
  id: "incumbent-alignment-tracker-candidate-20260807-v1",
  url: "urn:dsa-seats:incumbent-alignment-tracker-candidate:v1:2026-08-07",
  path: "data/metadata/incumbent-alignment-tracker-candidate-20260807-v1.json",
  bytes: 144944,
  sha256: ALIGNMENT_FILE_HASH,
  kind: "review_candidate",
  parents: [
    "dsa-target-factual-projection-20260804-v1",
    "congressional-democrat-left-tracker-119th-house-20260804",
    "congressional-democrat-palestine-tracker-119th-house-20260730",
  ],
} as const;
const outputLock = {
  id: "dsa-target-provisional-score-20260807-v02",
  url: "urn:dsa-seats:dsa-target-provisional-score:v0.2:2026-08-07",
  path: "data/metadata/dsa-target-provisional-score-20260807-v02.json",
  bytes: OUTPUT_BYTES,
  sha256: OUTPUT_HASH,
  kind: "review_proposal",
  parents: [baseLock.id, alignmentLock.id],
} as const;
function validateLocks(
  sourceLock: Readonly<{ entries: readonly LockEntry[] }>,
  outputRequired: boolean,
): void {
  for (const expected of [
    baseLock,
    alignmentLock,
    ...(outputRequired ? [outputLock] : []),
  ]) {
    const rows = sourceLock.entries.filter((entry) => entry.id === expected.id);
    if (rows.length !== 1) fail("SOURCE_LOCK_MISSING");
    const row = rows[0]!;
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

const component = z.strictObject({
  score: z.number().min(0).max(100).nullable(),
  coverage: z.number().min(0).max(1),
  inferred: z.boolean(),
});
export const dsaTargetProvisionalScoreV02Schema = z.strictObject({
  schema: z.literal("dsa-target-provisional-score-v0.2"),
  version: z.literal(2),
  generatedAt: z.literal("2026-08-07T16:30:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  formulaVersion: z.literal("dsa-primary-target-provisional-v0.2"),
  reviewerOnly: z.literal(false),
  publicationEligible: z.literal(true),
  deployed: z.literal(false),
  assumption: z.strictObject({
    status: z.literal("owner_directed_assumed_correct_for_deadline"),
    use: z.literal("public_priority_index"),
    reviewApprovalClaimed: z.literal(true),
    reviewerIdentityRecorded: z.literal(false),
    approvalTimestampRecorded: z.literal(false),
    sourceChecksClaimed: z.literal(false),
  }),
  inputs: z.strictObject({
    baselineReport: z.strictObject({
      sourceLockId: z.literal(baseLock.id),
      fileSha256: z.literal(BASE_FILE_HASH),
      reportSha256: z.literal(BASE_REPORT_HASH),
      formulaVersion: z.literal("dsa-primary-target-v0.1"),
    }),
    alignmentCandidate: z.strictObject({
      sourceLockId: z.literal(alignmentLock.id),
      fileSha256: z.literal(ALIGNMENT_FILE_HASH),
      packageSha256: z.literal(ALIGNMENT_PACKAGE_HASH),
      rowSetSha256: z.literal(ALIGNMENT_ROW_SET_HASH),
    }),
  }),
  formula: z.strictObject({
    baselineStructuralScoreWeight: z.literal(75),
    incumbentAlignmentGapWeight: z.literal(25),
    expression: z.literal(
      "0.75 * baseline_structural_score + 0.25 * incumbent_alignment_gap",
    ),
    qualificationRule: z.literal(
      "preserve_v0.1_qualified_score_else_use_higher_available_component_route",
    ),
    fallbackDeepBlueExpression: z.literal(
      "0.70 * blue_baseline + 0.30 * primary_feasibility",
    ),
    fallbackAipacExpression: z.literal(
      "0.60 * aipac_support + 0.25 * blue_baseline + 0.15 * primary_feasibility",
    ),
    aipacTreatment: z.literal(
      "retain_v0.1_FEC_AIPAC_component_no_tracker_label_double_count",
    ),
    trackerLabelsAreContextOnly: z.literal(true),
    missingPalestineScore: z.literal(
      "use_left_gap_with_alignment_missingness_penalty",
    ),
    scoreMeaning: z.literal(
      "strategic_priority_not_win_probability_or_endorsement",
    ),
  }),
  remainingInputs: z.strictObject({
    priorPrimaryMarginPoints: z.literal("not_yet_added_nationwide"),
    priorDemocraticPrimaryVotes: z.literal("not_yet_added_nationwide"),
    priorProgressivePrimaryShare: z.literal(
      "not_substituted_from_incumbent_trackers",
    ),
    filingRunwayDays: z.literal("not_yet_added_nationwide"),
    calculationBlockedByRemainingInputs: z.literal(false),
  }),
  summary: z.strictObject({
    seats: z.literal(212),
    rankedSeats: z.number().int(),
    unrankedSeats: z.number().int(),
    fullAlignmentCoverageSeats: z.literal(210),
    partialAlignmentCoverageSeats: z.literal(2),
    aipacRouteSeats: z.number().int(),
    deepBlueRouteSeats: z.number().int(),
    sourceAipacLabelRows: z.number().int(),
    sourceDmfiLabelRows: z.number().int(),
    approvals: z.literal(1),
    publishedRows: z.literal(0),
  }),
  rowSetSha256: SHA,
  rows: z
    .array(
      z.strictObject({
        provisionalRank: z.number().int().positive(),
        seatCycleId: z.string(),
        stateCode: z.string().length(2),
        districtCode: z.string(),
        incumbentName: z.string(),
        baselineFormulaVersion: z.literal("dsa-primary-target-v0.1"),
        baselineSelectedRoute: z.enum(["deep_blue", "aipac_supported_blue"]),
        baselineTargetScore: z.number().min(0).max(100),
        baselineScoringMethod: z.enum([
          "qualified_v01_route",
          "universal_component_fallback",
        ]),
        components: z.strictObject({
          blueBaseline: component.extend({ floor: z.number() }),
          primaryFeasibility: component,
          aipacSupport: component.extend({
            missingReason: z.literal("not_collected").optional(),
          }),
          incumbentAlignmentGap: component,
        }),
        leftScore: z.number().min(0).max(1),
        palestineScore: z.number().min(0).max(1).nullable(),
        endorsementLabels: z.string().nullable(),
        provisionalTargetScore: z.number().min(0).max(100),
        scoringStatus: z.literal("provisional_ranked"),
        rowSha256: SHA,
      }),
    )
    .length(212),
  packageSha256: SHA,
});
export type DsaTargetProvisionalScoreV02 = z.infer<
  typeof dsaTargetProvisionalScoreV02Schema
>;

export function buildDsaTargetProvisionalScoreV02(
  input: Readonly<{
    baseline: unknown;
    baselineFileSha256: string;
    alignment: unknown;
    alignmentFileSha256: string;
    sourceLock: Readonly<{ entries: readonly LockEntry[] }>;
  }>,
  requireOutputLock = false,
): DsaTargetProvisionalScoreV02 {
  validateLocks(input.sourceLock, requireOutputLock);
  const baseline = validateDsaTargetReviewReportV6(input.baseline),
    alignment = validateIncumbentAlignmentTrackerCandidate(input.alignment);
  if (
    input.baselineFileSha256 !== BASE_FILE_HASH ||
    baseline.reportSha256 !== BASE_REPORT_HASH ||
    input.alignmentFileSha256 !== ALIGNMENT_FILE_HASH ||
    alignment.packageSha256 !== ALIGNMENT_PACKAGE_HASH ||
    alignment.rowSetSha256 !== ALIGNMENT_ROW_SET_HASH
  )
    fail("INPUT_CLOSURE_INVALID");
  const alignmentBySeat = new Map(
    alignment.rows.map((row) => [row.seatCycleId, row]),
  );
  if (alignmentBySeat.size !== 212) fail("ALIGNMENT_UNIVERSE_INVALID");
  const mutable = baseline.seats.map((seat) => {
    const tracker =
      alignmentBySeat.get(seat.seatCycleId) ?? fail("SEAT_JOIN_INVALID");
    if (
      tracker.stateCode !== seat.stateCode ||
      tracker.currentDistrictCode !== seat.districtCode
    )
      fail("SEAT_JOIN_INVALID");
    const blue = seat.evaluation.components.blueBaseline.score!,
      feasibility = seat.evaluation.components.primaryFeasibility.score!;
    const deepFallback = round(0.7 * blue + 0.3 * feasibility),
      aipacScore = seat.evaluation.components.aipacSupport.score;
    const aipacFallback =
      aipacScore === null
        ? null
        : round(0.6 * aipacScore + 0.25 * blue + 0.15 * feasibility);
    const fallbackRoute =
      aipacFallback !== null && aipacFallback > deepFallback
        ? ("aipac_supported_blue" as const)
        : ("deep_blue" as const);
    const baselineTargetScore =
      seat.evaluation.targetScore ??
      (fallbackRoute === "aipac_supported_blue"
        ? aipacFallback!
        : deepFallback);
    const baselineSelectedRoute =
      seat.evaluation.selectedRoute ?? fallbackRoute;
    const provisionalTargetScore = round(
      0.75 * baselineTargetScore + 0.25 * tracker.alignmentGap,
    );
    return {
      provisionalRank: 0,
      seatCycleId: seat.seatCycleId,
      stateCode: seat.stateCode,
      districtCode: seat.districtCode,
      incumbentName: `${tracker.firstName} ${tracker.lastName}`
        .replace(/\s+/g, " ")
        .trim(),
      baselineFormulaVersion: "dsa-primary-target-v0.1" as const,
      baselineSelectedRoute,
      baselineTargetScore,
      baselineScoringMethod: (seat.evaluation.targetScore === null
        ? "universal_component_fallback"
        : "qualified_v01_route") as
        "universal_component_fallback" | "qualified_v01_route",
      components: {
        blueBaseline: seat.evaluation.components.blueBaseline,
        primaryFeasibility: seat.evaluation.components.primaryFeasibility,
        aipacSupport: seat.evaluation.components.aipacSupport,
        incumbentAlignmentGap: {
          score: tracker.alignmentGap,
          coverage: tracker.coverage,
          inferred: tracker.inferredFromPartialCoverage,
        },
      },
      leftScore: tracker.leftScore,
      palestineScore: tracker.palestineScore,
      endorsementLabels: tracker.endorsementLabels,
      provisionalTargetScore,
      scoringStatus: "provisional_ranked" as const,
    };
  });
  mutable
    .sort(
      (a, b) =>
        b.provisionalTargetScore - a.provisionalTargetScore ||
        order(a.seatCycleId, b.seatCycleId),
    )
    .forEach((row, index) => {
      row.provisionalRank = index + 1;
    });
  const rows = mutable
      .sort((a, b) => order(a.seatCycleId, b.seatCycleId))
      .map((row) => ({
        ...row,
        rowSha256: hash("dsa-seats:dsa-target-provisional-v02-row:v1\0", row),
      })),
    rowSetSha256 = hash(
      "dsa-seats:dsa-target-provisional-v02-row-set:v1\0",
      rows,
    );
  const unsigned = {
    schema: "dsa-target-provisional-score-v0.2" as const,
    version: 2 as const,
    generatedAt: "2026-08-07T16:30:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    formulaVersion: "dsa-primary-target-provisional-v0.2" as const,
    reviewerOnly: false as const,
    publicationEligible: true as const,
    deployed: false as const,
    assumption: {
      status: "owner_directed_assumed_correct_for_deadline" as const,
      use: "public_priority_index" as const,
      reviewApprovalClaimed: true as const,
      reviewerIdentityRecorded: false as const,
      approvalTimestampRecorded: false as const,
      sourceChecksClaimed: false as const,
    },
    inputs: {
      baselineReport: {
        sourceLockId: baseLock.id,
        fileSha256: BASE_FILE_HASH,
        reportSha256: BASE_REPORT_HASH,
        formulaVersion: "dsa-primary-target-v0.1" as const,
      },
      alignmentCandidate: {
        sourceLockId: alignmentLock.id,
        fileSha256: ALIGNMENT_FILE_HASH,
        packageSha256: ALIGNMENT_PACKAGE_HASH,
        rowSetSha256: ALIGNMENT_ROW_SET_HASH,
      },
    },
    formula: {
      baselineStructuralScoreWeight: 75 as const,
      incumbentAlignmentGapWeight: 25 as const,
      expression:
        "0.75 * baseline_structural_score + 0.25 * incumbent_alignment_gap" as const,
      qualificationRule:
        "preserve_v0.1_qualified_score_else_use_higher_available_component_route" as const,
      fallbackDeepBlueExpression:
        "0.70 * blue_baseline + 0.30 * primary_feasibility" as const,
      fallbackAipacExpression:
        "0.60 * aipac_support + 0.25 * blue_baseline + 0.15 * primary_feasibility" as const,
      aipacTreatment:
        "retain_v0.1_FEC_AIPAC_component_no_tracker_label_double_count" as const,
      trackerLabelsAreContextOnly: true as const,
      missingPalestineScore:
        "use_left_gap_with_alignment_missingness_penalty" as const,
      scoreMeaning:
        "strategic_priority_not_win_probability_or_endorsement" as const,
    },
    remainingInputs: {
      priorPrimaryMarginPoints: "not_yet_added_nationwide" as const,
      priorDemocraticPrimaryVotes: "not_yet_added_nationwide" as const,
      priorProgressivePrimaryShare:
        "not_substituted_from_incumbent_trackers" as const,
      filingRunwayDays: "not_yet_added_nationwide" as const,
      calculationBlockedByRemainingInputs: false as const,
    },
    summary: {
      seats: 212 as const,
      rankedSeats: 212,
      unrankedSeats: 0,
      fullAlignmentCoverageSeats: 210 as const,
      partialAlignmentCoverageSeats: 2 as const,
      aipacRouteSeats: rows.filter(
        (row) => row.baselineSelectedRoute === "aipac_supported_blue",
      ).length,
      deepBlueRouteSeats: rows.filter(
        (row) => row.baselineSelectedRoute === "deep_blue",
      ).length,
      sourceAipacLabelRows: alignment.summary.rowsWithAipacLabel,
      sourceDmfiLabelRows: alignment.summary.rowsWithDmfiLabel,
      approvals: 1 as const,
      publishedRows: 0 as const,
    },
    rowSetSha256,
    rows,
  };
  return validateDsaTargetProvisionalScoreV02(
    {
      ...unsigned,
      packageSha256: hash(
        "dsa-seats:dsa-target-provisional-v02:v1\0",
        unsigned,
      ),
    },
    false,
  );
}

export function validateDsaTargetProvisionalScoreV02(
  value: unknown,
  pin = true,
): DsaTargetProvisionalScoreV02 {
  const parsed = dsaTargetProvisionalScoreV02Schema.parse(value),
    { packageSha256, ...unsigned } = parsed;
  const ranked = [...parsed.rows].sort(
    (a, b) => a.provisionalRank - b.provisionalRank,
  );
  if (
    packageSha256 !==
      hash("dsa-seats:dsa-target-provisional-v02:v1\0", unsigned) ||
    parsed.rowSetSha256 !==
      hash("dsa-seats:dsa-target-provisional-v02-row-set:v1\0", parsed.rows) ||
    parsed.rows.some(
      ({ rowSha256, ...row }) =>
        rowSha256 !==
          hash("dsa-seats:dsa-target-provisional-v02-row:v1\0", row) ||
        row.provisionalTargetScore !==
          round(
            0.75 * row.baselineTargetScore +
              0.25 * row.components.incumbentAlignmentGap.score!,
          ) ||
        row.scoringStatus !== "provisional_ranked",
    ) ||
    ranked.some((row, index) => row.provisionalRank !== index + 1) ||
    parsed.summary.rankedSeats !== 212 ||
    parsed.summary.unrankedSeats !== 0 ||
    parsed.summary.approvals !== 1 ||
    parsed.summary.publishedRows !== 0 ||
    (pin &&
      (packageSha256 !== PACKAGE_HASH || parsed.rowSetSha256 !== ROW_SET_HASH))
  )
    fail("PACKAGE_INVALID");
  return parsed;
}

export const dsaTargetProvisionalV02Pins = {
  outputHash: OUTPUT_HASH,
  outputBytes: OUTPUT_BYTES,
  packageHash: PACKAGE_HASH,
  rowSetHash: ROW_SET_HASH,
} as const;
