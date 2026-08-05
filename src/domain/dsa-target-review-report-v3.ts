import { createHash } from "node:crypto";
import { z } from "zod";
import { DSA_ROUTE_WEIGHTS, DSA_TARGET_FORMULA_VERSION, evaluateDsaTarget } from "./dsa-target-evaluator";
import { dsaTargetEvaluationSchema, validateDsaTargetFactualProjection } from "./dsa-target-review-report";
import { validateDsaTargetReviewReportV2 } from "./dsa-target-review-report-v2";
import { validateIncumbentTenureFactualCandidate } from "../ingestion/identity/incumbent-tenure-factual-candidate";
import { validateAipacNumericEvidenceCandidate } from "../ingestion/fec/aipac-numeric-evidence-candidate";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";
import { validateWashingtonHouseTopTwoResultsReceipt } from "../ingestion/elections/washington-house-top-two-results-receipt";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const REPORT_SHA256 = "a3db55181cbd0ffbe2c0b555276a5595ee37c7d233bcc30359eb2550dbcd918c";
const aipacStatus = z.enum(["numeric_candidate_complete", "blocked_mapping_review", "formula_incompatible_top_two"]);
export const dsaTargetReviewReportV3Schema = z.strictObject({
  schema: z.literal("dsa-target-evaluation-review-report-v3"), version: z.literal(3), generatedAt: z.literal("2026-08-05T06:45:00.000Z"),
  reviewerOnly: z.literal(true), publicationEligible: z.literal(false), review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  scope: z.strictObject({ releaseId: z.literal("rel_full_20260804_v2"), sourceCutoff: z.literal("2026-08-04"), formulaVersion: z.literal(DSA_TARGET_FORMULA_VERSION), expectedSeats: z.literal(212), observedSeats: z.literal(212) }),
  inputClosure: z.strictObject({
    projectionFileSha256: SHA, tenureCandidateFileSha256: SHA,
    priorReport: z.strictObject({ sourceLockId: z.literal("dsa-target-evaluation-review-report-20260804-v2"), fileSha256: SHA, reportSha256: SHA, unchanged: z.literal(true) }),
    aipacCandidate: z.strictObject({ sourceLockId: z.literal("aipac-numeric-evidence-candidate-v1"), fileSha256: SHA, packageSha256: SHA, reviewerOnly: z.literal(true), publicationEligible: z.literal(false), defaultUse: z.literal("use_in_reviewer_only_evaluation_exclude_from_publication") }),
    formulaEligibilityAuthority: z.strictObject({ sourceLockId: z.literal("washington-house-top-two-results-receipt-20220802-20240806-v1"), fileSha256: z.literal("eac5df760de11a6612c2e8a95374a8041b2debb94068e0d08afadecd775963da"), packageSha256: z.literal("a930a28888f3892f0b4459063b0d0a2c195bfada26960b705757124a403e5e13"), nominationSystem: z.literal("top_two"), formulaApplicability: z.literal("confirmed_incompatible") }),
  }),
  weights: z.strictObject({ deepBlue: z.strictObject({ blueBaseline: z.literal(70), primaryFeasibility: z.literal(30) }), aipac: z.strictObject({ aipacSupport: z.literal(60), blueBaseline: z.literal(25), primaryFeasibility: z.literal(15) }) }),
  summary: z.strictObject({
    seats: z.literal(212), aipacCandidateCompleteSeats: z.literal(204), aipacEvaluatorCompleteSeats: z.literal(196), aipacBlockedSeats: z.literal(8), aipacFormulaIncompatibleSeats: z.literal(8), aipacCandidateEvidenceRows: z.literal(272), aipacNumericEvidenceRowsUsed: z.literal(258), seatsWithAipacCandidateEvidence: z.literal(123), seatsWithAipacEvidenceUsed: z.literal(117),
    aipacRouteSelections: z.number().int().nonnegative(), routeChangesFromV2: z.number().int().nonnegative(), partialQualified: z.number().int().nonnegative(), partialNotQualified: z.number().int().nonnegative(),
  }),
  seats: z.array(z.strictObject({
    reviewRank: z.number().int().positive().nullable(), seatCycleId: z.string().min(1), stateCode: z.string().length(2), districtCode: z.string().min(1), status: z.enum(["partial_qualified", "partial_not_qualified"]),
    aipac: z.strictObject({ status: aipacStatus, numericEvidenceUsed: z.boolean(), evidenceCount: z.number().int().nonnegative(), coverageComplete: z.boolean(), componentScore: z.number().min(0).max(100).nullable(), candidateSeatSha256: SHA }),
    routeChangedFromV2: z.boolean(), priorSelectedRoute: z.enum(["deep_blue", "aipac_supported_blue"]).nullable(), evaluation: dsaTargetEvaluationSchema,
  })).length(212),
  reportSha256: SHA,
});
export type DsaTargetReviewReportV3 = z.infer<typeof dsaTargetReviewReportV3Schema>;

const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const order = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function buildDsaTargetReviewReportV3(input: Readonly<{ projection: unknown; projectionFileSha256: string; tenureCandidate: unknown; tenureFileSha256: string; priorReport: unknown; priorReportFileSha256: string; aipacCandidate: unknown; aipacCandidateFileSha256: string; formulaEligibilityAuthority: unknown; formulaEligibilityAuthorityFileSha256: string }>): DsaTargetReviewReportV3 {
  const projection = validateDsaTargetFactualProjection(input.projection), tenure = validateIncumbentTenureFactualCandidate(input.tenureCandidate), prior = validateDsaTargetReviewReportV2(input.priorReport), candidate = validateAipacNumericEvidenceCandidate(input.aipacCandidate), formulaAuthority = validateWashingtonHouseTopTwoResultsReceipt(input.formulaEligibilityAuthority as never);
  if (projection.release.sourceCutoff !== candidate.sourceCutoff || tenure.sourceCutoff !== candidate.sourceCutoff || prior.scope.releaseId !== projection.release.id || !candidate.reviewerOnly || candidate.publicationEligible || candidate.defaultUse !== "use_in_reviewer_only_evaluation_exclude_from_publication") throw new Error("DSA_TARGET_REPORT_V3_INPUT_CLOSURE_INVALID");
  for (const value of [input.projectionFileSha256, input.tenureFileSha256, input.priorReportFileSha256, input.aipacCandidateFileSha256, input.formulaEligibilityAuthorityFileSha256]) if (!SHA.safeParse(value).success) throw new Error("DSA_TARGET_REPORT_V3_INPUT_HASH_INVALID");
  if (input.formulaEligibilityAuthorityFileSha256 !== "eac5df760de11a6612c2e8a95374a8041b2debb94068e0d08afadecd775963da" || formulaAuthority.packageSha256 !== "a930a28888f3892f0b4459063b0d0a2c195bfada26960b705757124a403e5e13" || formulaAuthority.nominationSystem !== "top_two" || formulaAuthority.formulaApplicability !== "confirmed_incompatible" || formulaAuthority.summary.scoreEligibleContests !== 0) throw new Error("DSA_TARGET_REPORT_V3_FORMULA_AUTHORITY_INVALID");
  const tenureBySeat = new Map(tenure.facts.map((row) => [row.seatCycleId, row])), priorBySeat = new Map(prior.seats.map((row) => [row.seatCycleId, row])), aipacBySeat = new Map(candidate.seats.map((row) => [row.seatCycleId, row]));
  if (tenureBySeat.size !== 212 || priorBySeat.size !== 212 || aipacBySeat.size !== 212) throw new Error("DSA_TARGET_REPORT_V3_UNIVERSE_INVALID");
  const missing = { kind: "missing", reason: "not_collected" } as const;
  const rows = projection.seats.map((seat) => {
    const tenureFact = tenureBySeat.get(seat.seatCycleId), priorSeat = priorBySeat.get(seat.seatCycleId), aipacSeat = aipacBySeat.get(seat.seatCycleId);
    if (!tenureFact || !priorSeat || !aipacSeat) throw new Error("DSA_TARGET_REPORT_V3_SEAT_JOIN_MISSING");
    const candidateComplete = aipacSeat.status === "complete", formulaCompatible = seat.stateCode !== "WA", complete = candidateComplete && formulaCompatible;
    const coverage = [2022, 2024, 2026].map((cycleYear) => {
      const direct = aipacSeat.coverage.find((cell) => cell.cycleYear === cycleYear && cell.channel === "direct_aipac_pac")!, independent = aipacSeat.coverage.find((cell) => cell.cycleYear === cycleYear && cell.channel === "independent_udp")!;
      return { cycleYear, directContributionsComplete: complete, independentExpendituresComplete: complete, directContributionSnapshotIds: complete ? direct.sourceSnapshotIds : [], independentExpenditureSnapshotIds: complete ? independent.sourceSnapshotIds : [], directContributionArtifactSha256s: complete ? direct.sourceArtifactSha256s : [], independentExpenditureArtifactSha256s: complete ? independent.sourceArtifactSha256s : [] };
    });
    const closure = [...new Set([
      ...seat.presidentialMargin2024.inputSnapshotIds,
      ...(seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand.inputSnapshotIds : []),
      ...tenureFact.selectedEvaluatorValue.inputSnapshotIds,
      ...aipacSeat.evidence.flatMap((row) => [...row.inputSnapshotIds, ...(row.kind === "direct_contribution" ? [] : row.classificationSnapshotIds)]),
      ...coverage.flatMap((row) => [...row.directContributionSnapshotIds, ...row.independentExpenditureSnapshotIds]),
    ])].sort(order);
    const evaluation = evaluateDsaTarget({
      metadata: { seatCycleId: seat.seatCycleId, incumbentFecCandidateId: aipacSeat.incumbentCandidateId, sourceCutoff: projection.release.sourceCutoff, currentCycleYear: 2026, inputSnapshotIds: closure },
      seat: { chamber: "house", officeKind: "house_voting", electionType: "regular", occupancy: "occupied", incumbentParty: "democratic" },
      electoral: { presidentialDemocraticMargins: [{ year: 2024, marginPoints: seat.presidentialMargin2024.value, observedAt: seat.presidentialMargin2024.observedAt, inputSnapshotIds: seat.presidentialMargin2024.inputSnapshotIds, geographyCompatibility: seat.presidentialMargin2024.geographyCompatibility }] },
      feasibility: { priorPrimaryMarginPoints: missing, incumbentCashOnHand: seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand : { kind: "missing", reason: seat.incumbentCashOnHand.reason }, incumbentTenureYears: { kind: "value", value: tenureFact.selectedEvaluatorValue.value, observedAt: tenureFact.selectedEvaluatorValue.observedAt, inputSnapshotIds: tenureFact.selectedEvaluatorValue.inputSnapshotIds, methodologyVersion: tenureFact.selectedEvaluatorValue.methodologyVersion }, filingRunwayDays: missing, priorDemocraticPrimaryVotes: missing, priorProgressivePrimaryShare: missing },
      aipac: { evidence: complete ? aipacSeat.evidence : [], coverage },
    });
    if (complete !== (evaluation.components.aipacSupport.score !== null)) throw new Error("DSA_TARGET_REPORT_V3_ZERO_UNKNOWN_FIREWALL_FAILED");
    const routeChangedFromV2 = evaluation.selectedRoute !== priorSeat.evaluation.selectedRoute;
    return { reviewRank: null as number | null, seatCycleId: seat.seatCycleId, stateCode: seat.stateCode, districtCode: seat.districtCode, status: evaluation.status === "qualified" ? "partial_qualified" as const : "partial_not_qualified" as const, aipac: { status: !formulaCompatible ? "formula_incompatible_top_two" as const : complete ? "numeric_candidate_complete" as const : "blocked_mapping_review" as const, numericEvidenceUsed: complete, evidenceCount: aipacSeat.evidence.length, coverageComplete: complete, componentScore: evaluation.components.aipacSupport.score, candidateSeatSha256: aipacSeat.seatSha256 }, routeChangedFromV2, priorSelectedRoute: priorSeat.evaluation.selectedRoute, evaluation };
  });
  const ranked = rows.filter((row) => row.evaluation.targetScore !== null).sort((a, b) => b.evaluation.targetScore! - a.evaluation.targetScore! || order(a.seatCycleId, b.seatCycleId));
  ranked.forEach((row, index) => { row.reviewRank = index + 1; });
  const seats = rows.sort((a, b) => order(a.seatCycleId, b.seatCycleId));
  const evidenceRowsUsed = seats.filter((row) => row.aipac.numericEvidenceUsed).reduce((sum, row) => sum + row.aipac.evidenceCount, 0), seatsWithEvidenceUsed = seats.filter((row) => row.aipac.numericEvidenceUsed && row.aipac.evidenceCount > 0).length;
  const unsigned = { schema: "dsa-target-evaluation-review-report-v3" as const, version: 3 as const, generatedAt: "2026-08-05T06:45:00.000Z" as const, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null }, scope: { releaseId: projection.release.id, sourceCutoff: projection.release.sourceCutoff, formulaVersion: DSA_TARGET_FORMULA_VERSION, expectedSeats: 212 as const, observedSeats: 212 as const }, inputClosure: { projectionFileSha256: input.projectionFileSha256, tenureCandidateFileSha256: input.tenureFileSha256, priorReport: { sourceLockId: "dsa-target-evaluation-review-report-20260804-v2" as const, fileSha256: input.priorReportFileSha256, reportSha256: prior.reportSha256, unchanged: true as const }, aipacCandidate: { sourceLockId: "aipac-numeric-evidence-candidate-v1" as const, fileSha256: input.aipacCandidateFileSha256, packageSha256: candidate.packageSha256, reviewerOnly: true as const, publicationEligible: false as const, defaultUse: candidate.defaultUse }, formulaEligibilityAuthority: { sourceLockId: "washington-house-top-two-results-receipt-20220802-20240806-v1" as const, fileSha256: input.formulaEligibilityAuthorityFileSha256 as "eac5df760de11a6612c2e8a95374a8041b2debb94068e0d08afadecd775963da", packageSha256: formulaAuthority.packageSha256 as "a930a28888f3892f0b4459063b0d0a2c195bfada26960b705757124a403e5e13", nominationSystem: formulaAuthority.nominationSystem as "top_two", formulaApplicability: formulaAuthority.formulaApplicability as "confirmed_incompatible" } }, weights: DSA_ROUTE_WEIGHTS, summary: { seats: 212 as const, aipacCandidateCompleteSeats: 204 as const, aipacEvaluatorCompleteSeats: 196 as const, aipacBlockedSeats: 8 as const, aipacFormulaIncompatibleSeats: 8 as const, aipacCandidateEvidenceRows: 272 as const, aipacNumericEvidenceRowsUsed: evidenceRowsUsed as 258, seatsWithAipacCandidateEvidence: 123 as const, seatsWithAipacEvidenceUsed: seatsWithEvidenceUsed as 117, aipacRouteSelections: seats.filter((row) => row.evaluation.selectedRoute === "aipac_supported_blue").length, routeChangesFromV2: seats.filter((row) => row.routeChangedFromV2).length, partialQualified: seats.filter((row) => row.status === "partial_qualified").length, partialNotQualified: seats.filter((row) => row.status === "partial_not_qualified").length }, seats };
  return validateDsaTargetReviewReportV3({ ...unsigned, reportSha256: hash("dsa-seats:dsa-target-evaluation-review-report:v3\0", unsigned) });
}

export function validateDsaTargetReviewReportV3(value: unknown): DsaTargetReviewReportV3 {
  const parsed = dsaTargetReviewReportV3Schema.parse(value), { reportSha256, ...unsigned } = parsed;
  if (reportSha256 !== hash("dsa-seats:dsa-target-evaluation-review-report:v3\0", unsigned)) throw new Error("DSA_TARGET_REPORT_V3_HASH_MISMATCH");
  if (reportSha256 !== REPORT_SHA256) throw new Error("DSA_TARGET_REPORT_V3_RELEASE_DERIVATION_MISMATCH");
  const ranked = parsed.seats.filter((row) => row.evaluation.targetScore !== null).sort((a, b) => a.reviewRank! - b.reviewRank!);
  if (parsed.summary.partialQualified !== 140 || parsed.summary.partialNotQualified !== 72 || parsed.summary.aipacRouteSelections !== 51 || parsed.summary.routeChangesFromV2 !== 51 || parsed.summary.partialQualified + parsed.summary.partialNotQualified !== 212 || parsed.summary.aipacRouteSelections !== parsed.seats.filter((row) => row.evaluation.selectedRoute === "aipac_supported_blue").length || parsed.summary.routeChangesFromV2 !== parsed.seats.filter((row) => row.routeChangedFromV2).length || ranked.some((row, index) => row.reviewRank !== index + 1) || parsed.seats.some((row) => row.aipac.coverageComplete !== (row.evaluation.components.aipacSupport.score !== null) || row.aipac.numericEvidenceUsed !== row.aipac.coverageComplete || row.routeChangedFromV2 !== (row.priorSelectedRoute !== row.evaluation.selectedRoute) || (row.stateCode === "WA") !== (row.aipac.status === "formula_incompatible_top_two"))) throw new Error("DSA_TARGET_REPORT_V3_INVARIANT_FAILED");
  return parsed;
}
