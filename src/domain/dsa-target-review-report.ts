import { createHash } from "node:crypto";
import { z } from "zod";
import { DSA_ROUTE_WEIGHTS, DSA_TARGET_FORMULA_VERSION, evaluateDsaTarget } from "./dsa-target-evaluator";
import { canonicalJson } from "../ingestion/fec/aipac-proposed-packages";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.date();
const dateTime = z.iso.datetime({ offset: true });
const snapshotIds = z.array(z.string().min(1)).min(1);
const releaseManifest = z.strictObject({ schemaVersion: z.number().int().positive(), canonicalDataChecksumSha256: sha256, geometryChecksumSha256: sha256, contentChecksumSha256: sha256 });
const cash = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("value"), value: z.number().nonnegative(), observedAt: date, inputSnapshotIds: snapshotIds, methodologyVersion: z.string().min(1) }),
  z.strictObject({ kind: z.literal("missing"), reason: z.enum(["not_collected", "not_reported", "source_unavailable"]), observedAt: date, inputSnapshotIds: snapshotIds }),
]);

export const dsaTargetFactualProjectionSchema = z.strictObject({
  schema: z.literal("dsa-target-factual-projection-v1"), version: z.literal(1), generatedAt: dateTime,
  release: z.strictObject({ id: z.literal("rel_full_20260804_v2"), label: z.string().min(1), status: z.literal("published"), sourceCutoff: z.literal("2026-08-04"), publishedAt: dateTime }),
  universe: z.strictObject({ definition: z.literal("occupied regular Democratic voting U.S. House seats"), expected: z.literal(212), observed: z.literal(212) }),
  productionReleaseClosure: z.strictObject({ manifest: releaseManifest, closureSha256: sha256 }),
  snapshots: z.array(z.strictObject({ id: z.string().min(1), sourceId: z.string().min(1), checksumSha256: sha256, parserVersion: z.string().min(1), usageStatus: z.literal("approved"), retrievedAt: dateTime })).min(2),
  seats: z.array(z.strictObject({
    seatCycleId: z.string().min(1), stateCode: z.string().length(2), districtCode: z.string().min(1), incumbentFecCandidateId: z.null(),
    presidentialMargin2024: z.strictObject({ kind: z.literal("value"), value: z.number().min(-100).max(100), observedAt: date, inputSnapshotIds: snapshotIds, methodologyVersion: z.literal("downballot-cd-2024-exact-v1"), geographyCompatibility: z.literal("current_boundary_compatible") }),
    incumbentCashOnHand: cash,
  })).length(212),
  projectionSha256: sha256,
});
export type DsaTargetFactualProjection = z.infer<typeof dsaTargetFactualProjectionSchema>;

const excludedProposal = z.strictObject({ sourceLockId: z.enum(["aipac-candidate-seat-mappings-proposal-v1", "aipac-evidence-closure-proposal-v1", "org-classification-aipac-network-proposal-v1", "aipac-review-decision-queue-v1"]), fileSha256: sha256, packageSha256: sha256, reviewStatus: z.literal("proposed"), reason: z.literal("unreviewed_proposal_excluded_from_numeric_evaluation") });
const component = z.strictObject({ score: z.number().nullable(), coverage: z.number(), inferred: z.boolean(), missingReason: z.literal("not_collected").optional() });
export const dsaTargetEvaluationSchema = z.strictObject({
  formulaVersion: z.literal(DSA_TARGET_FORMULA_VERSION), seatCycleId: z.string(), status: z.enum(["qualified", "not_qualified"]), selectedRoute: z.enum(["deep_blue", "aipac_supported_blue"]).nullable(), targetScore: z.number().nullable(),
  routeScores: z.strictObject({ deepBlue: z.number().nullable(), aipacSupportedBlue: z.number().nullable() }),
  components: z.strictObject({ blueBaseline: component.extend({ floor: z.number() }), primaryFeasibility: component, aipacSupport: component }), dataCoverage: z.number(), inferredFromPartialCoverage: z.boolean(), qualificationReasons: z.array(z.string()),
});

export const dsaTargetReviewReportSchema = z.strictObject({
  schema: z.literal("dsa-target-evaluation-review-report-v1"), version: z.literal(1), generatedAt: dateTime,
  reviewerOnly: z.literal(true), publicationEligible: z.literal(false), review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  scope: z.strictObject({ releaseId: z.literal("rel_full_20260804_v2"), sourceCutoff: z.literal("2026-08-04"), formulaVersion: z.literal(DSA_TARGET_FORMULA_VERSION), universeDefinition: z.literal("occupied regular Democratic voting U.S. House seats"), expectedSeats: z.literal(212), observedSeats: z.literal(212) }),
  inputClosure: z.strictObject({ projectionFileSha256: sha256, projectionSha256: sha256, factualSnapshotSha256s: z.array(sha256).min(2), excludedProposalPackages: z.array(excludedProposal).length(4) }),
  weights: z.strictObject({ deepBlue: z.strictObject({ blueBaseline: z.literal(70), primaryFeasibility: z.literal(30) }), aipac: z.strictObject({ aipacSupport: z.literal(60), blueBaseline: z.literal(25), primaryFeasibility: z.literal(15) }) }),
  sensitivity: z.strictObject({ kind: z.literal("formula_only_synthetic"), cases: z.array(z.strictObject({ id: z.string(), aipacSupportScore: z.number(), targetScore: z.number(), selectedRoute: z.literal("aipac_supported_blue") })).length(2) }),
  summary: z.strictObject({ seats: z.literal(212), cashValues: z.literal(210), cashMissing: z.literal(2), partialQualified: z.number().int().nonnegative(), partialNotQualified: z.number().int().nonnegative(), aipacNumericEvidenceRows: z.literal(0), aipacRouteSelections: z.literal(0) }),
  seats: z.array(z.strictObject({
    reviewRank: z.number().int().positive().nullable(), seatCycleId: z.string(), stateCode: z.string().length(2), districtCode: z.string(), status: z.enum(["partial_qualified", "partial_not_qualified"]),
    missingFactKeys: z.array(z.enum(["compatible_presidential_margin_2020", "prior_primary_margin", "incumbent_cash_on_hand", "incumbent_tenure", "filing_runway", "prior_democratic_primary_votes", "prior_progressive_primary_share", "aipac_transaction_evidence"])),
    factualSnapshotIds: z.array(z.string()), aipac: z.strictObject({ status: z.literal("excluded_unreviewed"), numericEvidenceUsed: z.literal(false), componentScore: z.null() }), evaluation: dsaTargetEvaluationSchema,
  })).length(212),
  reportSha256: sha256,
});
export type DsaTargetReviewReport = z.infer<typeof dsaTargetReviewReportSchema>;

const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

export function validateDsaTargetFactualProjection(value: unknown): DsaTargetFactualProjection {
  const parsed = dsaTargetFactualProjectionSchema.parse(value); const { projectionSha256, ...unsigned } = parsed;
  if (projectionSha256 !== hash("dsa-seats:dsa-target-factual-projection:v1\0", unsigned)) throw new Error("DSA_TARGET_PROJECTION_HASH_MISMATCH");
  const expectedClosure = hash("dsa-seats:production-release-projection-closure:v1\0", { release: parsed.release, manifest: parsed.productionReleaseClosure.manifest, snapshots: parsed.snapshots });
  if (parsed.productionReleaseClosure.closureSha256 !== expectedClosure) throw new Error("DSA_TARGET_PROJECTION_RELEASE_CLOSURE_INVALID");
  const ids = parsed.seats.map((seat) => seat.seatCycleId);
  if (new Set(ids).size !== 212 || ids.some((id, index) => index > 0 && Buffer.compare(Buffer.from(ids[index - 1]!), Buffer.from(id)) >= 0)) throw new Error("DSA_TARGET_PROJECTION_UNIVERSE_INVALID");
  if (new Set(parsed.snapshots.map((snapshot) => snapshot.id)).size !== parsed.snapshots.length) throw new Error("DSA_TARGET_PROJECTION_SNAPSHOT_DUPLICATE");
  if (parsed.seats.filter((seat) => seat.incumbentCashOnHand.kind === "value").length !== 210) throw new Error("DSA_TARGET_PROJECTION_CASH_COVERAGE_INVALID");
  const closure = new Set(parsed.snapshots.map((snapshot) => snapshot.id));
  if (parsed.seats.some((seat) => [...seat.presidentialMargin2024.inputSnapshotIds, ...seat.incumbentCashOnHand.inputSnapshotIds].some((id) => !closure.has(id)))) throw new Error("DSA_TARGET_PROJECTION_SNAPSHOT_CLOSURE_INVALID");
  return parsed;
}

export function syntheticSensitivity(): DsaTargetReviewReport["sensitivity"] {
  const snapshot = "synthetic_formula_snapshot"; const artifact = "a".repeat(64); const transaction = "b".repeat(64);
  const base = { metadata: { seatCycleId: "synthetic_house", incumbentFecCandidateId: "SYNTHETIC_FEC_ID", sourceCutoff: "2026-08-04", currentCycleYear: 2026, inputSnapshotIds: [snapshot] }, seat: { chamber: "house", officeKind: "house_voting", electionType: "regular", occupancy: "occupied", incumbentParty: "democratic" }, electoral: { presidentialDemocraticMargins: [{ year: 2020, marginPoints: 12, observedAt: "2026-08-01", inputSnapshotIds: [snapshot], geographyCompatibility: "current_boundary_compatible" }, { year: 2024, marginPoints: 12, observedAt: "2026-08-01", inputSnapshotIds: [snapshot], geographyCompatibility: "current_boundary_compatible" }] }, feasibility: { priorPrimaryMarginPoints: { kind: "missing", reason: "not_collected" }, incumbentCashOnHand: { kind: "missing", reason: "not_collected" }, incumbentTenureYears: { kind: "missing", reason: "not_collected" }, filingRunwayDays: { kind: "missing", reason: "not_collected" }, priorDemocraticPrimaryVotes: { kind: "missing", reason: "not_collected" }, priorProgressivePrimaryShare: { kind: "missing", reason: "not_collected" } }, aipac: { evidence: [], coverage: [2022, 2024, 2026].map((cycleYear) => ({ cycleYear, directContributionsComplete: true, independentExpendituresComplete: true, directContributionSnapshotIds: [snapshot], independentExpenditureSnapshotIds: [snapshot], directContributionArtifactSha256s: [artifact], independentExpenditureArtifactSha256s: [artifact] })) } } as const;
  const cases = [1_000, 10_000].map((amount) => {
    const result = evaluateDsaTarget({ ...base, aipac: { ...base.aipac, evidence: [{ committeeId: "C00797670", kind: "direct_contribution", netAmount: amount, cycleYear: 2026, observedAt: "2026-08-01", inputSnapshotIds: [snapshot], sourceTransactionIdSha256s: [transaction], latestRevisionFileNumber: 1, revisionStatus: "latest_net_positive", recipientCommitteeId: "SYNTHETIC_COMMITTEE", recipientCandidateId: "SYNTHETIC_FEC_ID", recipientRelationship: "authorized" }] } });
    if (result.selectedRoute !== "aipac_supported_blue" || result.targetScore === null || result.components.aipacSupport.score === null) throw new Error("DSA_TARGET_SENSITIVITY_INVALID");
    return { id: amount === 1_000 ? "synthetic_direct_1000" : "synthetic_direct_10000", aipacSupportScore: result.components.aipacSupport.score, targetScore: result.targetScore, selectedRoute: result.selectedRoute };
  });
  return { kind: "formula_only_synthetic", cases };
}

export function buildDsaTargetReviewReport(input: Readonly<{ projection: unknown; projectionFileSha256: string; excludedProposalPackages: unknown }>): DsaTargetReviewReport {
  const projection = validateDsaTargetFactualProjection(input.projection); const exclusions = z.array(excludedProposal).length(4).parse(input.excludedProposalPackages);
  if (!sha256.safeParse(input.projectionFileSha256).success || new Set(exclusions.map((row) => row.sourceLockId)).size !== 4) throw new Error("DSA_TARGET_REPORT_INPUT_CLOSURE_INVALID");
  const commonMissing = ["compatible_presidential_margin_2020", "prior_primary_margin", "incumbent_tenure", "filing_runway", "prior_democratic_primary_votes", "prior_progressive_primary_share", "aipac_transaction_evidence"] as const;
  const rows = projection.seats.map((seat) => {
    const closure = [...new Set([...seat.presidentialMargin2024.inputSnapshotIds, ...(seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand.inputSnapshotIds : [])])].sort();
    const missing = { kind: "missing", reason: "not_collected" } as const;
    const evaluation = evaluateDsaTarget({ metadata: { seatCycleId: seat.seatCycleId, incumbentFecCandidateId: null, sourceCutoff: projection.release.sourceCutoff, currentCycleYear: 2026, inputSnapshotIds: closure }, seat: { chamber: "house", officeKind: "house_voting", electionType: "regular", occupancy: "occupied", incumbentParty: "democratic" }, electoral: { presidentialDemocraticMargins: [{ year: 2024, marginPoints: seat.presidentialMargin2024.value, observedAt: seat.presidentialMargin2024.observedAt, inputSnapshotIds: seat.presidentialMargin2024.inputSnapshotIds, geographyCompatibility: seat.presidentialMargin2024.geographyCompatibility }] }, feasibility: { priorPrimaryMarginPoints: missing, incumbentCashOnHand: seat.incumbentCashOnHand.kind === "value" ? seat.incumbentCashOnHand : { kind: "missing", reason: seat.incumbentCashOnHand.reason }, incumbentTenureYears: missing, filingRunwayDays: missing, priorDemocraticPrimaryVotes: missing, priorProgressivePrimaryShare: missing }, aipac: { evidence: [], coverage: [2022, 2024, 2026].map((cycleYear) => ({ cycleYear, directContributionsComplete: false, independentExpendituresComplete: false, directContributionSnapshotIds: [], independentExpenditureSnapshotIds: [], directContributionArtifactSha256s: [], independentExpenditureArtifactSha256s: [] })) } });
    if (evaluation.selectedRoute === "aipac_supported_blue" || evaluation.components.aipacSupport.score !== null) throw new Error("DSA_TARGET_REPORT_PROPOSAL_FIREWALL_FAILED");
    return { reviewRank: null as number | null, seatCycleId: seat.seatCycleId, stateCode: seat.stateCode, districtCode: seat.districtCode, status: evaluation.status === "qualified" ? "partial_qualified" as const : "partial_not_qualified" as const, missingFactKeys: [...commonMissing, ...(seat.incumbentCashOnHand.kind === "missing" ? ["incumbent_cash_on_hand" as const] : [])], factualSnapshotIds: closure, aipac: { status: "excluded_unreviewed" as const, numericEvidenceUsed: false as const, componentScore: null }, evaluation };
  });
  const ranked = rows.filter((row) => row.evaluation.targetScore !== null).sort((a, b) => b.evaluation.targetScore! - a.evaluation.targetScore! || Buffer.compare(Buffer.from(a.seatCycleId), Buffer.from(b.seatCycleId)));
  ranked.forEach((row, index) => { row.reviewRank = index + 1; });
  const seats = rows.sort((a, b) => Buffer.compare(Buffer.from(a.seatCycleId), Buffer.from(b.seatCycleId)));
  const unsigned = { schema: "dsa-target-evaluation-review-report-v1" as const, version: 1 as const, generatedAt: projection.generatedAt, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null }, scope: { releaseId: projection.release.id, sourceCutoff: projection.release.sourceCutoff, formulaVersion: DSA_TARGET_FORMULA_VERSION, universeDefinition: projection.universe.definition, expectedSeats: 212 as const, observedSeats: 212 as const }, inputClosure: { projectionFileSha256: input.projectionFileSha256, projectionSha256: projection.projectionSha256, factualSnapshotSha256s: projection.snapshots.map((snapshot) => snapshot.checksumSha256).sort(), excludedProposalPackages: exclusions.sort((a, b) => Buffer.compare(Buffer.from(a.sourceLockId), Buffer.from(b.sourceLockId))) }, weights: DSA_ROUTE_WEIGHTS, sensitivity: syntheticSensitivity(), summary: { seats: 212 as const, cashValues: 210 as const, cashMissing: 2 as const, partialQualified: seats.filter((seat) => seat.status === "partial_qualified").length, partialNotQualified: seats.filter((seat) => seat.status === "partial_not_qualified").length, aipacNumericEvidenceRows: 0 as const, aipacRouteSelections: 0 as const }, seats };
  return dsaTargetReviewReportSchema.parse({ ...unsigned, reportSha256: hash("dsa-seats:dsa-target-evaluation-review-report:v1\0", unsigned) });
}

export function validateDsaTargetReviewReport(value: unknown): DsaTargetReviewReport {
  const parsed = dsaTargetReviewReportSchema.parse(value); const { reportSha256, ...unsigned } = parsed;
  if (reportSha256 !== hash("dsa-seats:dsa-target-evaluation-review-report:v1\0", unsigned)) throw new Error("DSA_TARGET_REPORT_HASH_MISMATCH");
  const qualified = parsed.seats.filter((seat) => seat.status === "partial_qualified");
  const ranks = qualified.map((seat) => seat.reviewRank).sort((a, b) => (a ?? 0) - (b ?? 0));
  const seatIds = parsed.seats.map((seat) => seat.seatCycleId);
  const invalidSeat = parsed.seats.some((seat) => seat.aipac.numericEvidenceUsed
    || seat.evaluation.components.aipacSupport.score !== null
    || seat.evaluation.selectedRoute === "aipac_supported_blue"
    || seat.evaluation.seatCycleId !== seat.seatCycleId
    || (seat.status === "partial_qualified") !== (seat.evaluation.status === "qualified")
    || (seat.status === "partial_qualified") !== (seat.evaluation.targetScore !== null)
    || (seat.status === "partial_not_qualified" && seat.reviewRank !== null));
  if (parsed.summary.partialQualified + parsed.summary.partialNotQualified !== 212
    || parsed.summary.partialQualified !== qualified.length
    || parsed.summary.partialNotQualified !== 212 - qualified.length
    || new Set(seatIds).size !== 212
    || new Set(parsed.inputClosure.excludedProposalPackages.map((proposal) => proposal.sourceLockId)).size !== 4
    || ranks.some((rank, index) => rank !== index + 1)
    || invalidSeat) throw new Error("DSA_TARGET_REPORT_INVARIANT_FAILED");
  return parsed;
}
