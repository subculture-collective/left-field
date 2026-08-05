import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateHouseFilingRunwayAuthorityProposal } from "./house-filing-runway-authority-proposal";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const BASELINE_FILE_SHA256 = "c3b4e026d934718d95357863d13bc7a1a218ea710f2ad9361769f7ff93a3f9d3" as const;
const BASELINE_PACKAGE_SHA256 = "15e5ce40af1e66792f15c83939301e79cfb82dab8b721949d2b4979a74fabc85" as const;
const CT_SOURCE_LOCK_ID = "ct-2026-election-calendar" as const;
const WA_SOURCE_LOCK_ID = "wa-top-two-candidate-faq" as const;
const authority = z.discriminatedUnion("sourceLockId", [
  z.strictObject({ sourceLockId: z.literal(CT_SOURCE_LOCK_ID), fileSha256: z.literal("c3d95d2253b1e6b9e2bbdb64b461ed19871695493eda2df2226eec5f79f1ef55"), publisher: z.literal("Connecticut Secretary of the State"), use: z.literal("deadline_and_path_authority") }),
  z.strictObject({ sourceLockId: z.literal(WA_SOURCE_LOCK_ID), fileSha256: z.literal("ef08af3d2f4bc5b8184fc7cd3ea7a2eafdbf4785158c147ccbc2f243f4f15ac0"), publisher: z.literal("Washington Secretary of State"), use: z.literal("formula_scope_authority") }),
]);
const state = z.strictObject({ stateCode: z.enum(["CT", "WA"]), targetSeats: z.number().int().positive(), deadlineAuthorityStatus: z.enum(["confirmed", "not_in_packet"]), confirmedDeadline: z.literal("2026-06-09").nullable(), confirmedDeadlineTime: z.literal("16:00 America/New_York").nullable(), electionPath: z.enum(["party_endorsement_eligibility_or_petition", "top_two_non_nominating"]), formulaApplicability: z.enum(["path_specific_review", "confirmed_incompatible"]), evaluatorValueEligible: z.literal(false), authoritySourceLockIds: z.array(z.enum(["ct-2026-election-calendar", "wa-top-two-candidate-faq"])).length(1), stateSha256: sha256 });
const seat = z.strictObject({ seatCycleId: z.string().min(1), stateCode: z.enum(["CT", "WA"]), stateSha256: sha256, deadlineAuthorityStatus: z.enum(["confirmed", "not_in_packet"]), formulaApplicability: z.enum(["path_specific_review", "confirmed_incompatible"]), evaluatorValue: z.strictObject({ kind: z.literal("missing"), reason: z.enum(["path_specific_review", "formula_not_applicable"]) }), scoreEligible: z.literal(false), seatSha256: sha256 });

export const filingRunwayExceptionAuthorityProposalSchema = z.strictObject({
  schema: z.literal("filing-runway-exception-authority-proposal-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-05T07:00:00.000Z"), sourceCutoff: z.literal("2026-08-04"), reviewerOnly: z.literal(true), publicationEligible: z.literal(false), review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  inputs: z.strictObject({ baselineSourceLockId: z.literal("house-filing-runway-authority-proposal-20260804-v1"), baselineFileSha256: z.literal(BASELINE_FILE_SHA256), baselinePackageSha256: z.literal(BASELINE_PACKAGE_SHA256), authorities: z.array(authority).length(2) }),
  summary: z.strictObject({ states: z.literal(2), seats: z.literal(13), deadlineAuthorityConfirmedSeats: z.literal(5), formulaScopeConfirmedIncompatibleSeats: z.literal(8), pathSpecificReviewSeats: z.literal(5), evaluatorNumericValues: z.literal(0), decisions: z.literal(2) }),
  states: z.array(state).length(2), seats: z.array(seat).length(13), decisions: z.array(z.strictObject({ decisionId: z.string(), question: z.string(), recommendedDecision: z.string(), defaultReversibleAssumption: z.literal("retain_authority_exclude_from_evaluator_and_publication"), blocksPublication: z.literal(true), blocksOtherWork: z.literal(false), resolution: z.null() })).length(2), packageSha256: sha256,
});
export type FilingRunwayExceptionAuthorityProposal = z.infer<typeof filingRunwayExceptionAuthorityProposalSchema>;

export function buildFilingRunwayExceptionAuthorityProposal(input: Readonly<{ baseline: unknown; baselineFileSha256: string; authorities: unknown }>): FilingRunwayExceptionAuthorityProposal {
  const baseline = validateHouseFilingRunwayAuthorityProposal(input.baseline);
  const authorities = z.array(authority).length(2).parse(input.authorities).sort((a, b) => Buffer.compare(Buffer.from(a.sourceLockId), Buffer.from(b.sourceLockId)));
  if (input.baselineFileSha256 !== BASELINE_FILE_SHA256 || baseline.packageSha256 !== BASELINE_PACKAGE_SHA256 || new Set(authorities.map((row) => row.sourceLockId)).size !== 2) throw new Error("FILING_EXCEPTION_AUTHORITY_INPUT_CLOSURE_INVALID");
  const configs = [
    { stateCode: "CT" as const, targetSeats: 5, deadlineAuthorityStatus: "confirmed" as const, confirmedDeadline: "2026-06-09" as const, confirmedDeadlineTime: "16:00 America/New_York" as const, electionPath: "party_endorsement_eligibility_or_petition" as const, formulaApplicability: "path_specific_review" as const, authoritySourceLockIds: ["ct-2026-election-calendar" as const] },
    { stateCode: "WA" as const, targetSeats: 8, deadlineAuthorityStatus: "not_in_packet" as const, confirmedDeadline: null, confirmedDeadlineTime: null, electionPath: "top_two_non_nominating" as const, formulaApplicability: "confirmed_incompatible" as const, authoritySourceLockIds: ["wa-top-two-candidate-faq" as const] },
  ];
  const states = configs.map((config) => { const unsigned = { ...config, evaluatorValueEligible: false as const }; return state.parse({ ...unsigned, stateSha256: hash("dsa-seats:filing-exception-authority-state:v1\0", unsigned) }); });
  const stateByCode = new Map(states.map((row) => [row.stateCode, row]));
  const selectedBaselineSeats = baseline.seats.filter((row) => row.stateCode === "CT" || row.stateCode === "WA");
  if (selectedBaselineSeats.length !== 13) throw new Error("FILING_EXCEPTION_AUTHORITY_UNIVERSE_INVALID");
  const seats = selectedBaselineSeats.map((row) => { const stateRow = stateByCode.get(row.stateCode as "CT" | "WA")!; const unsigned = { seatCycleId: row.seatCycleId, stateCode: stateRow.stateCode, stateSha256: stateRow.stateSha256, deadlineAuthorityStatus: stateRow.deadlineAuthorityStatus, formulaApplicability: stateRow.formulaApplicability, evaluatorValue: { kind: "missing" as const, reason: stateRow.stateCode === "CT" ? "path_specific_review" as const : "formula_not_applicable" as const }, scoreEligible: false as const }; return seat.parse({ ...unsigned, seatSha256: hash("dsa-seats:filing-exception-authority-seat:v1\0", unsigned) }); });
  const decisions = [
    { decisionId: "resolve-connecticut-standard-challenger-path-v1", question: "Which Connecticut endorsement, 15-percent, or petition path should v0.1 treat as the standard challenger deadline?", recommendedDecision: "retain party rules and district endorsement facts before selecting a numeric deadline" },
    { decisionId: "exclude-washington-top-two-from-partisan-primary-v01", question: "Should Washington remain visible but be ineligible for the v0.1 partisan-primary score?", recommendedDecision: "approve exclusion because the official source states party preference is not nomination or endorsement" },
  ].map((row) => ({ ...row, defaultReversibleAssumption: "retain_authority_exclude_from_evaluator_and_publication" as const, blocksPublication: true as const, blocksOtherWork: false as const, resolution: null }));
  const unsigned = { schema: "filing-runway-exception-authority-proposal-v1" as const, version: 1 as const, generatedAt: "2026-08-05T07:00:00.000Z" as const, sourceCutoff: "2026-08-04" as const, reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null }, inputs: { baselineSourceLockId: "house-filing-runway-authority-proposal-20260804-v1" as const, baselineFileSha256: input.baselineFileSha256, baselinePackageSha256: baseline.packageSha256, authorities }, summary: { states: 2 as const, seats: 13 as const, deadlineAuthorityConfirmedSeats: 5 as const, formulaScopeConfirmedIncompatibleSeats: 8 as const, pathSpecificReviewSeats: 5 as const, evaluatorNumericValues: 0 as const, decisions: 2 as const }, states, seats, decisions };
  return filingRunwayExceptionAuthorityProposalSchema.parse({ ...unsigned, packageSha256: hash("dsa-seats:filing-runway-exception-authority-proposal:v1\0", unsigned) });
}

export function validateFilingRunwayExceptionAuthorityProposal(value: unknown): FilingRunwayExceptionAuthorityProposal {
  const parsed = filingRunwayExceptionAuthorityProposalSchema.parse(value); const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:filing-runway-exception-authority-proposal:v1\0", unsigned)) throw new Error("FILING_EXCEPTION_AUTHORITY_PACKAGE_HASH_MISMATCH");
  const states = new Map(parsed.states.map((row) => [row.stateCode, row]));
  const authorityByState = new Map([["CT", CT_SOURCE_LOCK_ID], ["WA", WA_SOURCE_LOCK_ID]] as const);
  const invalidState = parsed.states.some((row) => { const { stateSha256, ...rest } = row; return stateSha256 !== hash("dsa-seats:filing-exception-authority-state:v1\0", rest); });
  const invalidStateAuthority = parsed.states.some((row) => row.authoritySourceLockIds[0] !== authorityByState.get(row.stateCode));
  const invalidSeat = parsed.seats.some((row) => { const { seatSha256, ...rest } = row; const stateRow = states.get(row.stateCode); return seatSha256 !== hash("dsa-seats:filing-exception-authority-seat:v1\0", rest) || !stateRow || row.stateSha256 !== stateRow.stateSha256 || row.scoreEligible; });
  if (invalidState || invalidStateAuthority || invalidSeat || new Set(parsed.seats.map((row) => row.seatCycleId)).size !== 13 || parsed.seats.filter((row) => row.stateCode === "CT").length !== 5 || parsed.seats.filter((row) => row.stateCode === "WA").length !== 8) throw new Error("FILING_EXCEPTION_AUTHORITY_INVARIANT_FAILED");
  return parsed;
}
