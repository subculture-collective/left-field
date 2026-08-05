import { createHash } from "node:crypto";
import { z } from "zod";
import { DSA_ROUTE_WEIGHTS, DSA_TARGET_FORMULA_VERSION, evaluateDsaTarget } from "./dsa-target-evaluator";
import { dsaTargetEvaluationSchema, syntheticSensitivity, validateDsaTargetFactualProjection } from "./dsa-target-review-report";
import { validateDsaTargetIncumbentRoster, validateIncumbentTenureFactualCandidate } from "../ingestion/identity/incumbent-tenure-factual-candidate";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const excludedProposal = z.strictObject({ sourceLockId: z.enum(["aipac-candidate-seat-mappings-proposal-v1", "aipac-evidence-closure-proposal-v1", "org-classification-aipac-network-proposal-v1", "aipac-review-decision-queue-v1"]), fileSha256: sha256, packageSha256: sha256, reviewStatus: z.literal("proposed"), reason: z.literal("unreviewed_proposal_excluded_from_numeric_evaluation") });
const missingFactKey = z.enum(["compatible_presidential_margin_2020", "prior_primary_margin", "incumbent_cash_on_hand", "filing_runway", "prior_democratic_primary_votes", "prior_progressive_primary_share", "aipac_transaction_evidence"]);

export const dsaTargetReviewReportV2Schema = z.strictObject({
  schema: z.literal("dsa-target-evaluation-review-report-v2"), version: z.literal(2), generatedAt: z.literal("2026-08-04T18:20:00.000Z"),
  reviewerOnly: z.literal(true), publicationEligible: z.literal(false), review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  scope: z.strictObject({ releaseId: z.literal("rel_full_20260804_v2"), sourceCutoff: z.literal("2026-08-04"), formulaVersion: z.literal(DSA_TARGET_FORMULA_VERSION), universeDefinition: z.literal("occupied regular Democratic voting U.S. House seats"), expectedSeats: z.literal(212), observedSeats: z.literal(212) }),
  inputClosure: z.strictObject({
    projectionSourceLockId: z.literal("dsa-target-factual-projection-20260804-v1"), projectionFileSha256: sha256, projectionSha256: sha256,
    approvedProjectionSnapshotSha256s: z.array(sha256).min(2),
    tenureCandidate: z.strictObject({ sourceLockId: z.literal("incumbent-tenure-factual-candidate-20260804-v1"), fileSha256: sha256, packageSha256: sha256, reviewStatus: z.literal("proposed"), decisionId: z.literal("approve-cumulative-recorded-house-service-methodology-v1"), defaultReversibleAssumption: z.literal("use_in_reviewer_only_evaluation_exclude_from_publication"), resolution: z.null(), use: z.literal("numeric_reviewer_only_default") }),
    excludedProposalPackages: z.array(excludedProposal).length(4),
  }),
  weights: z.strictObject({ deepBlue: z.strictObject({ blueBaseline: z.literal(70), primaryFeasibility: z.literal(30) }), aipac: z.strictObject({ aipacSupport: z.literal(60), blueBaseline: z.literal(25), primaryFeasibility: z.literal(15) }) }),
  sensitivity: z.strictObject({ kind: z.literal("formula_only_synthetic"), cases: z.array(z.strictObject({ id: z.string(), aipacSupportScore: z.number(), targetScore: z.number(), selectedRoute: z.literal("aipac_supported_blue") })).length(2) }),
  summary: z.strictObject({ seats: z.literal(212), cashValues: z.literal(210), cashMissing: z.literal(2), tenureCandidateValues: z.literal(212), tenureMissing: z.literal(0), tenureReviewerDefaultRows: z.literal(212), partialQualified: z.number().int().nonnegative(), partialNotQualified: z.number().int().nonnegative(), aipacNumericEvidenceRows: z.literal(0), aipacRouteSelections: z.literal(0) }),
  seats: z.array(z.strictObject({
    reviewRank: z.number().int().positive().nullable(), seatCycleId: z.string(), stateCode: z.string().length(2), districtCode: z.string(), status: z.enum(["partial_qualified", "partial_not_qualified"]), missingFactKeys: z.array(missingFactKey), approvedProjectionSnapshotIds: z.array(z.string()), reviewerOnlyCandidateSnapshotIds: z.tuple([z.literal("snap_full_legislators")]),
    incumbentTenure: z.strictObject({ status: z.literal("reviewer_only_default_candidate"), numericEvidenceUsed: z.literal(true), valueYears: z.number().min(0).max(100), factSha256: sha256, observedAt: z.literal("2026-08-04"), methodologyVersion: z.literal("cumulative-recorded-house-service-days-v1"), inputSnapshotIds: z.tuple([z.literal("snap_full_legislators")]) }),
    aipac: z.strictObject({ status: z.literal("excluded_unreviewed"), numericEvidenceUsed: z.literal(false), componentScore: z.null() }), evaluation: dsaTargetEvaluationSchema,
  })).length(212),
  reportSha256: sha256,
});
export type DsaTargetReviewReportV2 = z.infer<typeof dsaTargetReviewReportV2Schema>;

const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

export function buildDsaTargetReviewReportV2(input: Readonly<{ projection: unknown; projectionFileSha256: string; tenureCandidate: unknown; tenureFileSha256: string; roster: unknown; rosterFileSha256: string; excludedProposalPackages: unknown }>): DsaTargetReviewReportV2 {
  const projection = validateDsaTargetFactualProjection(input.projection);
  const tenure = validateIncumbentTenureFactualCandidate(input.tenureCandidate);
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  const exclusions = z.array(excludedProposal).length(4).parse(input.excludedProposalPackages);
  const candidateGate = tenure.reviewerOnly && !tenure.publicationEligible && tenure.review.status === "proposed" && tenure.review.reviewer === null && tenure.review.reviewedAt === null && tenure.decision.blocksPublication && !tenure.decision.blocksOtherWork && tenure.decision.resolution === null && tenure.decision.defaultReversibleAssumption === "use_in_reviewer_only_evaluation_exclude_from_publication";
  const manifestsMatch = canonicalJson(roster.release) === canonicalJson(projection.release) && canonicalJson(roster.productionReleaseClosure.manifest) === canonicalJson(projection.productionReleaseClosure.manifest);
  const tenureIdentityBySeat = new Map(tenure.facts.map((fact) => [fact.seatCycleId, fact.bioguideId]));
  const rosterJoinValid = roster.rows.every((row) => tenureIdentityBySeat.get(row.seatCycleId) === row.bioguideId);
  if (!sha256.safeParse(input.projectionFileSha256).success || !sha256.safeParse(input.tenureFileSha256).success || !sha256.safeParse(input.rosterFileSha256).success || input.rosterFileSha256 !== tenure.inputs.rosterFileSha256 || roster.rosterSha256 !== tenure.inputs.rosterSha256 || !candidateGate || !manifestsMatch || !rosterJoinValid || tenure.sourceCutoff !== projection.release.sourceCutoff || new Set(exclusions.map((row) => row.sourceLockId)).size !== 4) throw new Error("DSA_TARGET_REPORT_V2_INPUT_CLOSURE_INVALID");
  const tenureBySeat = new Map(tenure.facts.map((fact) => [fact.seatCycleId, fact]));
  if (tenureBySeat.size !== 212 || projection.seats.some((seat) => !tenureBySeat.has(seat.seatCycleId))) throw new Error("DSA_TARGET_REPORT_V2_TENURE_UNIVERSE_INVALID");
  const commonMissing = ["compatible_presidential_margin_2020", "prior_primary_margin", "filing_runway", "prior_democratic_primary_votes", "prior_progressive_primary_share", "aipac_transaction_evidence"] as const;
  const rows = projection.seats.map((seat) => {
    const tenureFact = tenureBySeat.get(seat.seatCycleId)!;
    const approvedProjectionSnapshotIds = [...new Set([...seat.presidentialMargin2024.inputSnapshotIds, ...(seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand.inputSnapshotIds : [])])].sort();
    const closure = [...new Set([...approvedProjectionSnapshotIds, ...tenureFact.selectedEvaluatorValue.inputSnapshotIds])].sort();
    const missing = { kind: "missing", reason: "not_collected" } as const;
    const evaluation = evaluateDsaTarget({ metadata: { seatCycleId: seat.seatCycleId, incumbentFecCandidateId: null, sourceCutoff: projection.release.sourceCutoff, currentCycleYear: 2026, inputSnapshotIds: closure }, seat: { chamber: "house", officeKind: "house_voting", electionType: "regular", occupancy: "occupied", incumbentParty: "democratic" }, electoral: { presidentialDemocraticMargins: [{ year: 2024, marginPoints: seat.presidentialMargin2024.value, observedAt: seat.presidentialMargin2024.observedAt, inputSnapshotIds: seat.presidentialMargin2024.inputSnapshotIds, geographyCompatibility: seat.presidentialMargin2024.geographyCompatibility }] }, feasibility: { priorPrimaryMarginPoints: missing, incumbentCashOnHand: seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand : { kind: "missing", reason: seat.incumbentCashOnHand.reason }, incumbentTenureYears: { kind: "value", value: tenureFact.selectedEvaluatorValue.value, observedAt: tenureFact.selectedEvaluatorValue.observedAt, inputSnapshotIds: tenureFact.selectedEvaluatorValue.inputSnapshotIds, methodologyVersion: tenureFact.selectedEvaluatorValue.methodologyVersion }, filingRunwayDays: missing, priorDemocraticPrimaryVotes: missing, priorProgressivePrimaryShare: missing }, aipac: { evidence: [], coverage: [2022, 2024, 2026].map((cycleYear) => ({ cycleYear, directContributionsComplete: false, independentExpendituresComplete: false, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: [], directContributionArtifactSha256s: [], independentExpenditureArtifactSha256s: [] })) } });
    if (evaluation.selectedRoute === "aipac_supported_blue" || evaluation.components.aipacSupport.score !== null || evaluation.components.primaryFeasibility.coverage < 0.15) throw new Error("DSA_TARGET_REPORT_V2_FIREWALL_FAILED");
    return { reviewRank: null as number | null, seatCycleId: seat.seatCycleId, stateCode: seat.stateCode, districtCode: seat.districtCode, status: evaluation.status === "qualified" ? "partial_qualified" as const : "partial_not_qualified" as const, missingFactKeys: [...commonMissing, ...(seat.incumbentCashOnHand.kind === "missing" ? ["incumbent_cash_on_hand" as const] : [])], approvedProjectionSnapshotIds, reviewerOnlyCandidateSnapshotIds: tenureFact.selectedEvaluatorValue.inputSnapshotIds, incumbentTenure: { status: "reviewer_only_default_candidate" as const, numericEvidenceUsed: true as const, valueYears: tenureFact.selectedEvaluatorValue.value, factSha256: tenureFact.factSha256, observedAt: tenureFact.selectedEvaluatorValue.observedAt, methodologyVersion: tenureFact.selectedEvaluatorValue.methodologyVersion, inputSnapshotIds: tenureFact.selectedEvaluatorValue.inputSnapshotIds }, aipac: { status: "excluded_unreviewed" as const, numericEvidenceUsed: false as const, componentScore: null }, evaluation };
  });
  const ranked = rows.filter((row) => row.evaluation.targetScore !== null).sort((a, b) => b.evaluation.targetScore! - a.evaluation.targetScore! || Buffer.compare(Buffer.from(a.seatCycleId), Buffer.from(b.seatCycleId)));
  ranked.forEach((row, index) => { row.reviewRank = index + 1; });
  const seats = rows.sort((a, b) => Buffer.compare(Buffer.from(a.seatCycleId), Buffer.from(b.seatCycleId)));
  const unsigned = { schema: "dsa-target-evaluation-review-report-v2" as const, version: 2 as const, generatedAt: tenure.generatedAt, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null }, scope: { releaseId: projection.release.id, sourceCutoff: projection.release.sourceCutoff, formulaVersion: DSA_TARGET_FORMULA_VERSION, universeDefinition: projection.universe.definition, expectedSeats: 212 as const, observedSeats: 212 as const }, inputClosure: { projectionSourceLockId: "dsa-target-factual-projection-20260804-v1" as const, projectionFileSha256: input.projectionFileSha256, projectionSha256: projection.projectionSha256, approvedProjectionSnapshotSha256s: projection.snapshots.map((snapshot) => snapshot.checksumSha256).sort(), tenureCandidate: { sourceLockId: "incumbent-tenure-factual-candidate-20260804-v1" as const, fileSha256: input.tenureFileSha256, packageSha256: tenure.packageSha256, reviewStatus: tenure.review.status, decisionId: tenure.decision.decisionId, defaultReversibleAssumption: tenure.decision.defaultReversibleAssumption, resolution: tenure.decision.resolution, use: "numeric_reviewer_only_default" as const }, excludedProposalPackages: exclusions.sort((a, b) => Buffer.compare(Buffer.from(a.sourceLockId), Buffer.from(b.sourceLockId))) }, weights: DSA_ROUTE_WEIGHTS, sensitivity: syntheticSensitivity(), summary: { seats: 212 as const, cashValues: 210 as const, cashMissing: 2 as const, tenureCandidateValues: 212 as const, tenureMissing: 0 as const, tenureReviewerDefaultRows: 212 as const, partialQualified: seats.filter((seat) => seat.status === "partial_qualified").length, partialNotQualified: seats.filter((seat) => seat.status === "partial_not_qualified").length, aipacNumericEvidenceRows: 0 as const, aipacRouteSelections: 0 as const }, seats };
  return dsaTargetReviewReportV2Schema.parse({ ...unsigned, reportSha256: hash("dsa-seats:dsa-target-evaluation-review-report:v2\0", unsigned) });
}

export function validateDsaTargetReviewReportV2(value: unknown): DsaTargetReviewReportV2 {
  const parsed = dsaTargetReviewReportV2Schema.parse(value); const { reportSha256, ...unsigned } = parsed;
  if (reportSha256 !== hash("dsa-seats:dsa-target-evaluation-review-report:v2\0", unsigned)) throw new Error("DSA_TARGET_REPORT_V2_HASH_MISMATCH");
  const qualified = parsed.seats.filter((seat) => seat.status === "partial_qualified");
  const ranks = qualified.map((seat) => seat.reviewRank).sort((a, b) => (a ?? 0) - (b ?? 0));
  const invalidSeat = parsed.seats.some((seat) => seat.aipac.numericEvidenceUsed || !seat.incumbentTenure.numericEvidenceUsed || seat.evaluation.components.aipacSupport.score !== null || seat.evaluation.selectedRoute === "aipac_supported_blue" || seat.evaluation.seatCycleId !== seat.seatCycleId || seat.missingFactKeys.includes("incumbent_cash_on_hand") !== (seat.evaluation.components.primaryFeasibility.coverage === 0.2) || (seat.status === "partial_qualified") !== (seat.evaluation.targetScore !== null) || (seat.status === "partial_not_qualified" && seat.reviewRank !== null));
  if (parsed.summary.partialQualified + parsed.summary.partialNotQualified !== 212 || parsed.summary.partialQualified !== qualified.length || new Set(parsed.seats.map((seat) => seat.seatCycleId)).size !== 212 || new Set(parsed.seats.map((seat) => seat.incumbentTenure.factSha256)).size !== 212 || ranks.some((rank, index) => rank !== index + 1) || invalidSeat) throw new Error("DSA_TARGET_REPORT_V2_INVARIANT_FAILED");
  return parsed;
}
