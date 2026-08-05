import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetFactualProjection } from "../../domain/dsa-target-review-report";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const CUTOFF = "2026-08-04" as const;
const DAY = 86_400_000;
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const daysBetween = (start: string, end: string): number => Math.max(0, (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY);

type Rule = Readonly<{ stateCode: string; expectedSeats: number; deadline: string; selection: "standard" | "all_others" | "house" | "district_specific_conflict"; applicability: "unassessed" | "proposed_incompatible" | "path_specific_review"; note: string }>;
export const FEC_DISCOVERY_RULES: readonly Rule[] = [
  { stateCode: "AL", expectedSeats: 2, deadline: "2026-01-23", selection: "district_specific_conflict", applicability: "path_specific_review", note: "FEC statewide discovery date does not encode the later target-district special-primary qualifying calendar." },
  { stateCode: "AZ", expectedSeats: 3, deadline: "2026-03-23", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "CA", expectedSeats: 42, deadline: "2026-03-06", selection: "standard", applicability: "proposed_incompatible", note: "Live official discovery identifies a voter-nominated top-two system and district-specific extension possibility." },
  { stateCode: "CO", expectedSeats: 4, deadline: "2026-03-18", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "CT", expectedSeats: 5, deadline: "2026-06-09", selection: "standard", applicability: "path_specific_review", note: "Party endorsement, eligibility, and petition paths require structured state-authority review." },
  { stateCode: "DE", expectedSeats: 1, deadline: "2026-07-14", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "FL", expectedSeats: 7, deadline: "2026-04-24", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "GA", expectedSeats: 4, deadline: "2026-03-06", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "HI", expectedSeats: 2, deadline: "2026-06-02", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "IL", expectedSeats: 14, deadline: "2025-11-03", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "IN", expectedSeats: 2, deadline: "2026-02-06", selection: "standard", applicability: "unassessed", note: "FEC specifies noon; time-zone and office-hours metadata require state authority." },
  { stateCode: "KS", expectedSeats: 1, deadline: "2026-06-01", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "KY", expectedSeats: 1, deadline: "2026-01-09", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "LA", expectedSeats: 2, deadline: "2026-08-07", selection: "house", applicability: "proposed_incompatible", note: "Live official discovery identifies a November open primary rather than a Democratic partisan primary." },
  { stateCode: "MA", expectedSeats: 9, deadline: "2026-06-02", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "MD", expectedSeats: 7, deadline: "2026-02-24", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "ME", expectedSeats: 2, deadline: "2026-03-16", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "MI", expectedSeats: 6, deadline: "2026-04-21", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "MN", expectedSeats: 4, deadline: "2026-06-02", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "MO", expectedSeats: 2, deadline: "2026-03-31", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "MS", expectedSeats: 1, deadline: "2025-12-26", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NC", expectedSeats: 4, deadline: "2025-12-19", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NH", expectedSeats: 2, deadline: "2026-06-12", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NJ", expectedSeats: 9, deadline: "2026-03-23", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NM", expectedSeats: 3, deadline: "2026-02-03", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NV", expectedSeats: 3, deadline: "2026-03-13", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "NY", expectedSeats: 19, deadline: "2026-04-06", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "OH", expectedSeats: 5, deadline: "2026-02-04", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "OR", expectedSeats: 5, deadline: "2026-03-10", selection: "all_others", applicability: "unassessed", note: "Uses the FEC non-incumbent deadline, not the incumbent deadline." },
  { stateCode: "PA", expectedSeats: 7, deadline: "2026-03-10", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "RI", expectedSeats: 2, deadline: "2026-06-24", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "SC", expectedSeats: 1, deadline: "2026-03-30", selection: "standard", applicability: "unassessed", note: "FEC specifies noon; time-zone and office-hours metadata require state authority." },
  { stateCode: "TN", expectedSeats: 1, deadline: "2026-03-10", selection: "standard", applicability: "unassessed", note: "FEC specifies noon; time-zone and office-hours metadata require state authority." },
  { stateCode: "TX", expectedSeats: 13, deadline: "2025-12-08", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "VA", expectedSeats: 6, deadline: "2026-05-26", selection: "standard", applicability: "path_specific_review", note: "Party nomination method and district applicability require state-authority review." },
  { stateCode: "VT", expectedSeats: 1, deadline: "2026-05-28", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
  { stateCode: "WA", expectedSeats: 8, deadline: "2026-05-08", selection: "standard", applicability: "proposed_incompatible", note: "Live official discovery identifies a top-two system rather than a Democratic partisan primary." },
  { stateCode: "WI", expectedSeats: 2, deadline: "2026-06-01", selection: "standard", applicability: "unassessed", note: "State authority not retained." },
] as const;

const stateRow = z.strictObject({ stateCode: z.string().length(2), targetSeats: z.number().int().positive(), fecPrimaryBallotAccessDeadline: z.iso.date(), fecDeadlineSelection: z.enum(["standard", "all_others", "house", "district_specific_conflict"]), fecDiscoveryRunwayDays: z.number().int().nonnegative(), stateAuthorityStatus: z.literal("not_retained"), formulaApplicability: z.enum(["unassessed", "proposed_incompatible", "path_specific_review"]), scoreEligible: z.literal(false), note: z.string().min(1), stateRowSha256: sha256 });
const seatRow = z.strictObject({ seatCycleId: z.string().min(1), stateCode: z.string().length(2), stateRowSha256: sha256, fecDiscoveryRunwayDays: z.number().int().nonnegative(), evaluatorValue: z.strictObject({ kind: z.literal("missing"), reason: z.literal("state_authority_not_retained") }), formulaApplicability: z.enum(["unassessed", "proposed_incompatible", "path_specific_review"]), scoreEligible: z.literal(false), seatRowSha256: sha256 });
const decision = z.strictObject({ decisionId: z.string().min(1), question: z.string().min(1), recommendedDecision: z.string().min(1), defaultReversibleAssumption: z.literal("retain_discovery_exclude_from_evaluator_and_publication"), blocksPublication: z.literal(true), blocksOtherWork: z.literal(false), resolution: z.null() });

export const houseFilingRunwayAuthorityProposalSchema = z.strictObject({
  schema: z.literal("house-filing-runway-authority-proposal-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-05T06:30:00.000Z"), sourceCutoff: z.literal(CUTOFF), reviewerOnly: z.literal(true), publicationEligible: z.literal(false), review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  scope: z.strictObject({ releaseId: z.literal("rel_full_20260804_v2"), universeDefinition: z.literal("occupied regular Democratic voting U.S. House seats"), targetStates: z.literal(38), targetSeats: z.literal(212) }),
  inputs: z.strictObject({ projectionSourceLockId: z.literal("dsa-target-factual-projection-20260804-v1"), projectionFileSha256: sha256, projectionSha256: sha256, fecDiscoverySourceLockId: z.literal("fec-2026-congressional-primary-dates"), fecDiscoveryFileSha256: z.literal("9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251"), fecDiscoveryByteSize: z.literal(226820), fecChartDataAsOf: z.literal("2026-05-18"), fecAuthorityRole: z.literal("nationwide_discovery_and_drift_detection_not_state_election_authority") }),
  methodology: z.strictObject({ proposedMetric: z.literal("nonnegative_calendar_days_to_final_standard_ballot_access_deadline"), calendarArithmetic: z.literal("max_zero_utc_date_difference"), prospectiveCandidatePath: z.literal("non_incumbent_standard_path_for_exact_seat"), passedConfirmedDeadlineMeansZero: z.literal(true), unknownDeadlineNeverMeansZero: z.literal(true), independentMinorWriteInDeadlinesExcluded: z.literal(true), stateElectionAuthorityRequiredForNumericUse: z.literal(true), formulaCompatibilityRequiredForNumericUse: z.literal(true) }),
  summary: z.strictObject({ states: z.literal(38), seats: z.literal(212), fecDiscoveryDeadlines: z.literal(38), fecDiscoveryZeroDaySeats: z.literal(210), fecDiscoveryPositiveDaySeats: z.literal(2), stateAuthorityConfirmedSeats: z.literal(0), evaluatorNumericValues: z.literal(0), missingStateAuthoritySeats: z.literal(212), proposedFormulaIncompatibleSeats: z.literal(52), pathSpecificReviewSeats: z.literal(13), unassessedFormulaSeats: z.literal(147), decisions: z.literal(4) }),
  states: z.array(stateRow).length(38), seats: z.array(seatRow).length(212), decisions: z.array(decision).length(4), packageSha256: sha256,
});
export type HouseFilingRunwayAuthorityProposal = z.infer<typeof houseFilingRunwayAuthorityProposalSchema>;

export function buildHouseFilingRunwayAuthorityProposal(input: Readonly<{ projection: unknown; projectionFileSha256: string; fecDiscoveryFileSha256: string; fecDiscoveryByteSize: number }>): HouseFilingRunwayAuthorityProposal {
  const projection = validateDsaTargetFactualProjection(input.projection);
  if (!sha256.safeParse(input.projectionFileSha256).success || input.fecDiscoveryFileSha256 !== "9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251" || input.fecDiscoveryByteSize !== 226820) throw new Error("FILING_RUNWAY_AUTHORITY_INPUT_CLOSURE_INVALID");
  const ruleByState = new Map(FEC_DISCOVERY_RULES.map((rule) => [rule.stateCode, rule]));
  const actualCounts = new Map<string, number>();
  for (const seat of projection.seats) actualCounts.set(seat.stateCode, (actualCounts.get(seat.stateCode) ?? 0) + 1);
  if (actualCounts.size !== 38 || FEC_DISCOVERY_RULES.length !== 38 || FEC_DISCOVERY_RULES.some((rule) => actualCounts.get(rule.stateCode) !== rule.expectedSeats)) throw new Error("FILING_RUNWAY_AUTHORITY_UNIVERSE_INVALID");
  const states = FEC_DISCOVERY_RULES.map((rule) => {
    const unsigned = { stateCode: rule.stateCode, targetSeats: rule.expectedSeats, fecPrimaryBallotAccessDeadline: rule.deadline, fecDeadlineSelection: rule.selection, fecDiscoveryRunwayDays: daysBetween(CUTOFF, rule.deadline), stateAuthorityStatus: "not_retained" as const, formulaApplicability: rule.applicability, scoreEligible: false as const, note: rule.note };
    return stateRow.parse({ ...unsigned, stateRowSha256: hash("dsa-seats:filing-runway-authority-state:v1\0", unsigned) });
  });
  const stateByCode = new Map(states.map((state) => [state.stateCode, state]));
  const seats = projection.seats.map((seat) => {
    const state = stateByCode.get(seat.stateCode); if (!state || !ruleByState.has(seat.stateCode)) throw new Error(`FILING_RUNWAY_AUTHORITY_STATE_MISSING:${seat.stateCode}`);
    const unsigned = { seatCycleId: seat.seatCycleId, stateCode: seat.stateCode, stateRowSha256: state.stateRowSha256, fecDiscoveryRunwayDays: state.fecDiscoveryRunwayDays, evaluatorValue: { kind: "missing" as const, reason: "state_authority_not_retained" as const }, formulaApplicability: state.formulaApplicability, scoreEligible: false as const };
    return seatRow.parse({ ...unsigned, seatRowSha256: hash("dsa-seats:filing-runway-authority-seat:v1\0", unsigned) });
  });
  const decisions = [
    { decisionId: "approve-fec-calendar-discovery-role-v1", question: "Should the FEC national chart be retained only as a discovery enumerator and drift detector?", recommendedDecision: "approve discovery-only use because the chart disclaims state election authority and says dates may change" },
    { decisionId: "approve-filing-runway-calendar-method-v1", question: "Should filing runway use nonnegative UTC calendar days to the final standard non-incumbent ballot-access deadline?", recommendedDecision: "approve with zero only for a confirmed passed deadline and missing for unknown authority" },
    { decisionId: "classify-nonpartisan-open-primary-formula-scope-v1", question: "Should CA, LA, and WA remain in the all-seat report but be ineligible for the partisan-primary v0.1 formula?", recommendedDecision: "approve after retaining current state authority; do not force top-two or open-primary seats through a Democratic-primary formula" },
    { decisionId: "collect-target-state-filing-authority-v1", question: "Should state authority be retained for all 38 target states before any filing-runway value enters evaluation?", recommendedDecision: "approve full authority closure, with path-specific records for AL, CT, and VA and district-specific extension review where applicable" },
  ].map((row) => decision.parse({ ...row, defaultReversibleAssumption: "retain_discovery_exclude_from_evaluator_and_publication", blocksPublication: true, blocksOtherWork: false, resolution: null }));
  const unsigned = { schema: "house-filing-runway-authority-proposal-v1" as const, version: 1 as const, generatedAt: "2026-08-05T06:30:00.000Z" as const, sourceCutoff: CUTOFF, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null }, scope: { releaseId: projection.release.id, universeDefinition: projection.universe.definition, targetStates: 38 as const, targetSeats: 212 as const }, inputs: { projectionSourceLockId: "dsa-target-factual-projection-20260804-v1" as const, projectionFileSha256: input.projectionFileSha256, projectionSha256: projection.projectionSha256, fecDiscoverySourceLockId: "fec-2026-congressional-primary-dates" as const, fecDiscoveryFileSha256: input.fecDiscoveryFileSha256 as "9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251", fecDiscoveryByteSize: 226820 as const, fecChartDataAsOf: "2026-05-18" as const, fecAuthorityRole: "nationwide_discovery_and_drift_detection_not_state_election_authority" as const }, methodology: { proposedMetric: "nonnegative_calendar_days_to_final_standard_ballot_access_deadline" as const, calendarArithmetic: "max_zero_utc_date_difference" as const, prospectiveCandidatePath: "non_incumbent_standard_path_for_exact_seat" as const, passedConfirmedDeadlineMeansZero: true as const, unknownDeadlineNeverMeansZero: true as const, independentMinorWriteInDeadlinesExcluded: true as const, stateElectionAuthorityRequiredForNumericUse: true as const, formulaCompatibilityRequiredForNumericUse: true as const }, summary: { states: 38 as const, seats: 212 as const, fecDiscoveryDeadlines: 38 as const, fecDiscoveryZeroDaySeats: 210 as const, fecDiscoveryPositiveDaySeats: 2 as const, stateAuthorityConfirmedSeats: 0 as const, evaluatorNumericValues: 0 as const, missingStateAuthoritySeats: 212 as const, proposedFormulaIncompatibleSeats: 52 as const, pathSpecificReviewSeats: 13 as const, unassessedFormulaSeats: 147 as const, decisions: 4 as const }, states, seats, decisions };
  return houseFilingRunwayAuthorityProposalSchema.parse({ ...unsigned, packageSha256: hash("dsa-seats:house-filing-runway-authority-proposal:v1\0", unsigned) });
}

export function validateHouseFilingRunwayAuthorityProposal(value: unknown): HouseFilingRunwayAuthorityProposal {
  const parsed = houseFilingRunwayAuthorityProposalSchema.parse(value); const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:house-filing-runway-authority-proposal:v1\0", unsigned)) throw new Error("FILING_RUNWAY_AUTHORITY_PACKAGE_HASH_MISMATCH");
  const invalidState = parsed.states.some((state) => { const { stateRowSha256, ...row } = state; return stateRowSha256 !== hash("dsa-seats:filing-runway-authority-state:v1\0", row) || state.fecDiscoveryRunwayDays !== daysBetween(CUTOFF, state.fecPrimaryBallotAccessDeadline); });
  const byState = new Map(parsed.states.map((state) => [state.stateCode, state]));
  const invalidSeat = parsed.seats.some((seat) => { const { seatRowSha256, ...row } = seat; const state = byState.get(seat.stateCode); return seatRowSha256 !== hash("dsa-seats:filing-runway-authority-seat:v1\0", row) || !state || seat.stateRowSha256 !== state.stateRowSha256 || seat.fecDiscoveryRunwayDays !== state.fecDiscoveryRunwayDays || seat.formulaApplicability !== state.formulaApplicability || seat.scoreEligible; });
  const counts = { states: parsed.states.length, seats: parsed.seats.length, zero: parsed.seats.filter((seat) => seat.fecDiscoveryRunwayDays === 0).length, positive: parsed.seats.filter((seat) => seat.fecDiscoveryRunwayDays > 0).length, incompatible: parsed.seats.filter((seat) => seat.formulaApplicability === "proposed_incompatible").length, pathReview: parsed.seats.filter((seat) => seat.formulaApplicability === "path_specific_review").length };
  if (invalidState || invalidSeat || new Set(parsed.states.map((state) => state.stateCode)).size !== 38 || new Set(parsed.seats.map((seat) => seat.seatCycleId)).size !== 212 || canonicalJson(counts) !== canonicalJson({ states: 38, seats: 212, zero: 210, positive: 2, incompatible: 52, pathReview: 13 })) throw new Error("FILING_RUNWAY_AUTHORITY_INVARIANT_FAILED");
  return parsed;
}
