import { z } from "zod";
import { evaluationProgramSchema } from "./office-universe";

export const DSA_TARGET_FORMULA_VERSION = "dsa-primary-target-v0.1" as const;
export const AIPAC_COMMITTEES = {
  C00797670: "AIPAC PAC",
  C00799031: "United Democracy Project",
} as const;

export const DSA_ROUTE_WEIGHTS = {
  deepBlue: { blueBaseline: 70, primaryFeasibility: 30 },
  aipac: { aipacSupport: 60, blueBaseline: 25, primaryFeasibility: 15 },
} as const;

export const DSA_HOUSE_EVALUATION_PROGRAM = evaluationProgramSchema.parse({
  id: "dsa_primary_target",
  version: "0.1",
  supportedCatalogScopes: ["federal_congressional"],
  supportedGovernmentLevels: ["federal"],
  supportedOfficeFamilies: ["legislative"],
  supportedElectionMethods: ["partisan_primary_general"],
  supportedSelectionMethods: ["elected"],
  partisanRequirement: "required",
  districtMagnitude: "single_member",
  requiredFactKeys: ["compatible_presidential_margin", "incumbent_finance", "primary_history", "filing_runway", "aipac_transaction_evidence"],
});

const missingReason = z.enum(["not_collected", "not_reported", "not_applicable", "unmatched", "suppressed", "source_unavailable"]);
const measured = (maximum: number) => z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("value"), value: z.number().min(0).max(maximum), observedAt: z.iso.date(), inputSnapshotIds: z.array(z.string().min(1)).min(1), methodologyVersion: z.string().min(1) }),
  z.strictObject({ kind: z.literal("missing"), reason: missingReason }),
]);

const evidenceBase = {
  netAmount: z.number().positive(),
  cycleYear: z.number().int().min(2022).max(2100),
  observedAt: z.iso.date(),
  inputSnapshotIds: z.array(z.string().min(1)).min(1),
  sourceTransactionIdSha256s: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  latestRevisionFileNumber: z.number().int().positive(),
  revisionStatus: z.literal("latest_net_positive"),
} as const;

export const aipacEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...evidenceBase, kind: z.literal("direct_contribution"), committeeId: z.literal("C00797670"), recipientCommitteeId: z.string().min(1), recipientCandidateId: z.string().min(1), recipientRelationship: z.literal("authorized") }),
  z.strictObject({ ...evidenceBase, kind: z.literal("independent_support_incumbent"), committeeId: z.literal("C00799031"), targetCandidateId: z.string().min(1), targetSeatCycleId: z.string().min(1), electionType: z.literal("primary"), supportOppose: z.literal("S"), targetRelationship: z.literal("incumbent"), networkClassificationId: z.literal("org-classification-aipac-network-v1"), classificationSnapshotIds: z.array(z.string().min(1)).min(1) }),
  z.strictObject({ ...evidenceBase, kind: z.literal("independent_oppose_challenger"), committeeId: z.literal("C00799031"), targetCandidateId: z.string().min(1), targetSeatCycleId: z.string().min(1), electionType: z.literal("primary"), supportOppose: z.literal("O"), targetRelationship: z.literal("democratic_primary_challenger"), networkClassificationId: z.literal("org-classification-aipac-network-v1"), classificationSnapshotIds: z.array(z.string().min(1)).min(1) }),
]);
export type AipacEvidence = Readonly<z.infer<typeof aipacEvidenceSchema>>;

export const dsaTargetInputSchema = z.strictObject({
  metadata: z.strictObject({
    seatCycleId: z.string().min(1),
    incumbentFecCandidateId: z.string().min(1).nullable(),
    sourceCutoff: z.iso.date(),
    currentCycleYear: z.number().int().min(2022).max(2100),
    inputSnapshotIds: z.array(z.string().min(1)).min(1),
  }),
  seat: z.strictObject({
    chamber: z.literal("house"),
    officeKind: z.literal("house_voting"),
    electionType: z.literal("regular"),
    occupancy: z.literal("occupied"),
    incumbentParty: z.literal("democratic"),
  }),
  electoral: z.strictObject({
    presidentialDemocraticMargins: z.array(z.strictObject({
      year: z.number().int().min(2000).max(2100),
      marginPoints: z.number().min(-100).max(100),
      observedAt: z.iso.date(),
      inputSnapshotIds: z.array(z.string().min(1)).min(1),
      geographyCompatibility: z.literal("current_boundary_compatible"),
    })).min(1),
  }),
  feasibility: z.strictObject({
    priorPrimaryMarginPoints: measured(100),
    incumbentCashOnHand: measured(Number.MAX_SAFE_INTEGER),
    incumbentTenureYears: measured(100),
    filingRunwayDays: measured(1460),
    priorDemocraticPrimaryVotes: measured(Number.MAX_SAFE_INTEGER),
    priorProgressivePrimaryShare: measured(100),
  }),
  aipac: z.strictObject({
    evidence: z.array(aipacEvidenceSchema),
    coverage: z.array(z.strictObject({
      cycleYear: z.number().int().min(2022).max(2100),
      directContributionsComplete: z.boolean(),
      independentExpendituresComplete: z.boolean(),
      directContributionSnapshotIds: z.array(z.string().min(1)),
      independentExpenditureSnapshotIds: z.array(z.string().min(1)),
      directContributionArtifactSha256s: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
      independentExpenditureArtifactSha256s: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
    }).superRefine((row, ctx) => {
      if (row.directContributionsComplete && (row.directContributionSnapshotIds.length === 0 || row.directContributionArtifactSha256s.length === 0)) ctx.addIssue({ code: "custom", message: "Complete direct-contribution coverage requires a source snapshot and artifact hash" });
      if (row.independentExpendituresComplete && (row.independentExpenditureSnapshotIds.length === 0 || row.independentExpenditureArtifactSha256s.length === 0)) ctx.addIssue({ code: "custom", message: "Complete independent-expenditure coverage requires a source snapshot and artifact hash" });
    })),
  }),
}).superRefine((input, ctx) => {
  const observed = [
    ...input.electoral.presidentialDemocraticMargins.map((row) => row.observedAt),
    ...input.aipac.evidence.map((row) => row.observedAt),
    ...Object.values(input.feasibility).flatMap((row) => row.kind === "value" ? [row.observedAt] : []),
  ];
  if (observed.some((date) => date > input.metadata.sourceCutoff)) ctx.addIssue({ code: "custom", message: "Evidence observed after the source cutoff is not eligible" });
  const years = input.electoral.presidentialDemocraticMargins.map((row) => row.year);
  if (new Set(years).size !== years.length) ctx.addIssue({ code: "custom", message: "Presidential margin years must be unique" });
  if (years.some((year) => year !== 2020 && year !== 2024)) ctx.addIssue({ code: "custom", message: "Only compatible 2020 and 2024 presidential margins are eligible" });
  const coverageYears = input.aipac.coverage.map((row) => row.cycleYear);
  if (new Set(coverageYears).size !== coverageYears.length) ctx.addIssue({ code: "custom", message: "AIPAC coverage years must be unique" });
  const requiredCoverageYears = new Set([input.metadata.currentCycleYear, input.metadata.currentCycleYear - 2, input.metadata.currentCycleYear - 4]);
  if (coverageYears.some((year) => !requiredCoverageYears.has(year))) ctx.addIssue({ code: "custom", message: "AIPAC coverage may contain only the current and two prior cycles" });
  if (input.aipac.evidence.some((row) => !requiredCoverageYears.has(row.cycleYear))) ctx.addIssue({ code: "custom", message: "AIPAC evidence must be from the current or two prior cycles" });
  if (input.metadata.incumbentFecCandidateId === null && input.aipac.evidence.length > 0) ctx.addIssue({ code: "custom", message: "AIPAC evidence requires an approved incumbent candidate mapping" });
  for (const evidence of input.aipac.evidence) {
    if (evidence.kind === "direct_contribution" && evidence.recipientCandidateId !== input.metadata.incumbentFecCandidateId) ctx.addIssue({ code: "custom", message: "Direct contribution recipient must map to the incumbent candidate" });
    if (evidence.kind === "independent_support_incumbent" && (evidence.targetCandidateId !== input.metadata.incumbentFecCandidateId || evidence.targetSeatCycleId !== input.metadata.seatCycleId)) ctx.addIssue({ code: "custom", message: "Independent support must target this seat's incumbent" });
    if (evidence.kind === "independent_oppose_challenger" && (evidence.targetCandidateId === input.metadata.incumbentFecCandidateId || evidence.targetSeatCycleId !== input.metadata.seatCycleId)) ctx.addIssue({ code: "custom", message: "Independent opposition must target a same-seat Democratic primary challenger" });
  }
  const closure = new Set(input.metadata.inputSnapshotIds);
  const referencedSnapshots = [
    ...input.electoral.presidentialDemocraticMargins.flatMap((row) => row.inputSnapshotIds),
    ...Object.values(input.feasibility).flatMap((row) => row.kind === "value" ? row.inputSnapshotIds : []),
    ...input.aipac.evidence.flatMap((row) => [...row.inputSnapshotIds, ...(row.kind === "direct_contribution" ? [] : row.classificationSnapshotIds)]),
    ...input.aipac.coverage.flatMap((row) => [...row.directContributionSnapshotIds, ...row.independentExpenditureSnapshotIds]),
  ];
  if (referencedSnapshots.some((snapshot) => !closure.has(snapshot))) ctx.addIssue({ code: "custom", message: "Every component snapshot must belong to the evaluation input closure" });
});

export type DsaTargetInput = Readonly<z.infer<typeof dsaTargetInputSchema>>;
type Component = Readonly<{ score: number | null; coverage: number; inferred: boolean; missingReason?: "not_collected" }>;
export type DsaTargetEvaluation = Readonly<{
  formulaVersion: typeof DSA_TARGET_FORMULA_VERSION;
  seatCycleId: string;
  status: "qualified" | "not_qualified";
  selectedRoute: "deep_blue" | "aipac_supported_blue" | null;
  targetScore: number | null;
  routeScores: Readonly<{ deepBlue: number | null; aipacSupportedBlue: number | null }>;
  components: Readonly<{ blueBaseline: Component; primaryFeasibility: Component; aipacSupport: Component }>;
  dataCoverage: number;
  inferredFromPartialCoverage: boolean;
  qualificationReasons: readonly string[];
}>;

const clamp = (value: number, minimum = 0, maximum = 100): number => Math.min(maximum, Math.max(minimum, value));
const rounded = (value: number): number => Math.round(value * 10) / 10;

function blueBaseline(input: DsaTargetInput): Component & { floor: number } {
  const rows = input.electoral.presidentialDemocraticMargins;
  const floor = Math.min(...rows.map((row) => row.marginPoints));
  const requiredYears = new Set([2020, 2024]);
  const observedRequired = new Set(rows.filter((row) => requiredYears.has(row.year)).map((row) => row.year));
  const coverage = observedRequired.size / requiredYears.size;
  return { score: rounded(clamp((floor - 5) * 4)), floor, coverage, inferred: coverage < 1 };
}

function cashWeakness(cash: number): number {
  const lower = 50_000;
  const upper = 5_000_000;
  if (cash <= lower) return 100;
  if (cash >= upper) return 0;
  return 100 * (1 - (Math.log(cash) - Math.log(lower)) / (Math.log(upper) - Math.log(lower)));
}

function electorateScale(votes: number): number {
  const lower = 20_000;
  const upper = 250_000;
  if (votes <= lower) return 100;
  if (votes >= upper) return 0;
  return 100 * (1 - (Math.log(votes) - Math.log(lower)) / (Math.log(upper) - Math.log(lower)));
}

function primaryFeasibility(input: DsaTargetInput): Component {
  const definitions = [
    [25, input.feasibility.priorPrimaryMarginPoints, (value: number) => clamp(100 - 2 * value)],
    [20, input.feasibility.incumbentCashOnHand, cashWeakness],
    [15, input.feasibility.incumbentTenureYears, (value: number) => clamp(100 - 4 * value)],
    [10, input.feasibility.filingRunwayDays, (value: number) => clamp(value / 365 * 100)],
    [15, input.feasibility.priorDemocraticPrimaryVotes, electorateScale],
    [15, input.feasibility.priorProgressivePrimaryShare, (value: number) => clamp(value * 2)],
  ] as const;
  const available = definitions.filter(([, value]) => value.kind === "value");
  const availableWeight = available.reduce((sum, [weight]) => sum + weight, 0);
  if (availableWeight === 0) return { score: 30, coverage: 0, inferred: true };
  const normalized = available.reduce((sum, [weight, value, transform]) => sum + (value.kind === "value" ? transform(value.value) * weight : 0), 0) / availableWeight;
  const coverage = availableWeight / 100;
  const missingnessPenalty = 0.6 + 0.4 * coverage;
  return { score: rounded(normalized * missingnessPenalty), coverage: rounded(coverage), inferred: coverage < 1 };
}

function evidenceRecency(currentCycle: number, evidenceCycle: number): number {
  const cyclesOld = Math.max(0, Math.floor((currentCycle - evidenceCycle) / 2));
  return [1, 0.7, 0.45][cyclesOld] ?? 0;
}

function aipacSignal(kind: AipacEvidence["kind"], amount: number): number {
  if (kind === "direct_contribution") return 0.5 + 0.5 * clamp(amount / 10_000, 0, 1);
  return 0.6 + 0.4 * (1 - Math.exp(-amount / 500_000));
}

function aipacSupport(input: DsaTargetInput): Component {
  const signals = input.aipac.evidence.map((row) => clamp(aipacSignal(row.kind, row.netAmount) * evidenceRecency(input.metadata.currentCycleYear, row.cycleYear), 0, 1));
  const combined = signals.length === 0 ? 0 : 1 - signals.reduce((remaining, signal) => remaining * (1 - signal), 1);
  const byYear = new Map(input.aipac.coverage.map((row) => [row.cycleYear, row]));
  const requiredYears = [input.metadata.currentCycleYear, input.metadata.currentCycleYear - 2, input.metadata.currentCycleYear - 4];
  const coverage = requiredYears.reduce((sum, year) => { const row = byYear.get(year); return sum + Number(row?.directContributionsComplete ?? false) + Number(row?.independentExpendituresComplete ?? false); }, 0) / (requiredYears.length * 2);
  if (coverage < 1) return { score: null, coverage: rounded(coverage), inferred: true, missingReason: "not_collected" };
  return { score: rounded(combined * 100), coverage: rounded(coverage), inferred: coverage < 1 };
}

/** Deterministic seat-level targeting evaluation. It never consumes voter, donor-person, or demographic records. */
export function evaluateDsaTarget(rawInput: unknown): DsaTargetEvaluation {
  const input = dsaTargetInputSchema.parse(rawInput);
  const blue = blueBaseline(input);
  const feasibility = primaryFeasibility(input);
  const aipac = aipacSupport(input);
  const deepQualified = blue.floor >= 20;
  const aipacQualified = blue.floor >= 8 && aipac.score !== null && aipac.score > 0;
  const deepBlue = deepQualified ? rounded(blue.score! * 0.7 + feasibility.score! * 0.3) : null;
  const aipacSupportedBlue = aipacQualified ? rounded(aipac.score! * 0.6 + blue.score! * 0.25 + feasibility.score! * 0.15) : null;
  const selectedRoute = deepBlue === null && aipacSupportedBlue === null ? null : aipacSupportedBlue !== null && (deepBlue === null || aipacSupportedBlue > deepBlue) ? "aipac_supported_blue" : "deep_blue";
  const targetScore = selectedRoute === "aipac_supported_blue" ? aipacSupportedBlue : selectedRoute === "deep_blue" ? deepBlue : null;
  const dataCoverage = selectedRoute === "aipac_supported_blue"
    ? aipac.coverage * 0.6 + blue.coverage * 0.25 + feasibility.coverage * 0.15
    : selectedRoute === "deep_blue" ? blue.coverage * 0.7 + feasibility.coverage * 0.3 : 0;
  const qualificationReasons = [
    ...(deepQualified ? ["presidential Democratic margin floor is at least 20 points"] : []),
    ...(aipacQualified ? ["presidential Democratic margin floor is at least 8 points and AIPAC-network support evidence is present"] : []),
    ...(!deepQualified && !aipacQualified ? ["neither the deep-blue nor AIPAC-supported-blue route qualified"] : []),
  ];
  return {
    formulaVersion: DSA_TARGET_FORMULA_VERSION,
    seatCycleId: input.metadata.seatCycleId,
    status: selectedRoute === null ? "not_qualified" : "qualified",
    selectedRoute,
    targetScore,
    routeScores: { deepBlue, aipacSupportedBlue },
    components: { blueBaseline: blue, primaryFeasibility: feasibility, aipacSupport: aipac },
    dataCoverage: rounded(dataCoverage),
    inferredFromPartialCoverage: selectedRoute !== null && dataCoverage < 1,
    qualificationReasons,
  };
}
