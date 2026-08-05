import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./aipac-proposed-packages";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const CLOSURE_FILE_SHA256 = "7b9fd96d102a2367b67e21c969542a9bb2ae5a94a82997ea5baaabdb64d5a15b";
const FOUNDATION_FILE_SHA256 = "a0fe151080a0958c6cdddc447d50db4044700e31960d37dd2326ea86d6f7a7b7";
const CANDIDATE_ID = "H0IL07167";

const disposition = z.strictObject({
  sourceDecisionId: z.string().min(1),
  seatCycleId: z.enum(["seat_house_ca_47_current", "seat_house_il_07_current"]),
  candidateId: z.literal(CANDIDATE_ID),
  cycleYear: z.literal(2024),
  disposition: z.enum(["auto_accept_unique_positive_target", "auto_reject_negative_adjustment_only_target"]),
  evaluatorUse: z.enum(["reviewer_only_candidate", "excluded_invalid_origin"]),
  positiveRecordCount: z.number().int().nonnegative(),
  negativeRecordCount: z.number().int().nonnegative(),
  zeroRecordCount: z.number().int().nonnegative(),
  evidenceRecordSha256s: z.array(SHA).min(1),
  rationaleCodes: z.array(z.string().min(1)).min(1),
  dispositionSha256: SHA,
});

export const aipacChallengerAmbiguityResolutionCandidateSchema = z.strictObject({
  schema: z.literal("aipac-challenger-ambiguity-resolution-candidate-v1"),
  version: z.literal(1),
  generatedAt: z.literal("2026-08-05T10:30:00.000Z"),
  sourceCutoff: z.literal("2026-08-04"),
  reviewerOnly: z.literal(true),
  publicationEligible: z.literal(false),
  defaultUse: z.literal("apply_to_next_reviewer_only_foundation_exclude_from_publication"),
  rule: z.literal("a_negative_or_zero_schedule_e_adjustment_cannot_originate_a_candidate_seat_relationship_when_the_same_candidate_has_a_unique_positive_primary_opposition_jurisdiction"),
  inputs: z.strictObject({
    closureFileSha256: z.literal(CLOSURE_FILE_SHA256),
    foundationFileSha256: z.literal(FOUNDATION_FILE_SHA256),
  }),
  summary: z.strictObject({
    inputConflictRelationships: z.literal(2),
    mechanicallyResolvedRelationships: z.literal(2),
    acceptedRelationships: z.literal(1),
    rejectedRelationships: z.literal(1),
    remainingFoundationConflictRelationships: z.literal(6),
    remainingMethodologyAndPromotionDecisions: z.literal(4),
  }),
  dispositions: z.array(disposition).length(2),
  dispositionSetSha256: SHA,
  review: z.strictObject({ status: z.literal("automatic_candidate"), reviewer: z.null(), reviewedAt: z.null() }),
  packageSha256: SHA,
});

export type AipacChallengerAmbiguityResolutionCandidate = z.infer<typeof aipacChallengerAmbiguityResolutionCandidateSchema>;
type ClosureRecord = Readonly<{ candidateId: string | null; cycleYear: number; candidateOffice: string | null; candidateOfficeState: string | null; candidateOfficeDistrict: string | null; candidateParty: string | null; electionType: string | null; supportOppose: string; amount: number; recordIdentitySha256: string }>;

const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

export function buildAipacChallengerAmbiguityResolutionCandidate(input: Readonly<{
  closure: unknown;
  closureFileSha256: string;
  foundation: unknown;
  foundationFileSha256: string;
}>): AipacChallengerAmbiguityResolutionCandidate {
  if (input.closureFileSha256 !== CLOSURE_FILE_SHA256 || input.foundationFileSha256 !== FOUNDATION_FILE_SHA256) throw new Error("AIPAC_AMBIGUITY_INPUT_HASH_MISMATCH");
  const closure = input.closure as { sourceCutoff?: unknown; scheduleE?: { records?: ClosureRecord[] } };
  const foundation = input.foundation as { sourceCutoff?: unknown; relationships?: Array<{ sourceDecisionId: string; candidateId: string; seatCycleId: string; disposition: string; evidenceRecordSha256s: string[] }> };
  if (closure.sourceCutoff !== "2026-08-04" || foundation.sourceCutoff !== "2026-08-04" || !Array.isArray(closure.scheduleE?.records) || !Array.isArray(foundation.relationships)) throw new Error("AIPAC_AMBIGUITY_INPUT_INVALID");
  const conflicts = foundation.relationships.filter((row) => row.candidateId === CANDIDATE_ID && row.disposition === "needs_review_conflict");
  if (conflicts.length !== 2 || new Set(conflicts.map((row) => row.seatCycleId)).size !== 2) throw new Error("AIPAC_AMBIGUITY_CONFLICT_UNIVERSE_INVALID");
  const relevant = closure.scheduleE.records.filter((row) => row.candidateId === CANDIDATE_ID && row.cycleYear === 2024 && row.candidateOffice === "H" && row.candidateParty === "DEM" && row.electionType === "P2024" && row.supportOppose === "O");
  const bySeat = new Map<string, ClosureRecord[]>();
  for (const row of relevant) {
    const seat = row.candidateOfficeState === "IL" && row.candidateOfficeDistrict === "07" ? "seat_house_il_07_current" : row.candidateOfficeState === "CA" && row.candidateOfficeDistrict === "47" ? "seat_house_ca_47_current" : null;
    if (!seat) throw new Error("AIPAC_AMBIGUITY_UNACCOUNTED_JURISDICTION");
    bySeat.set(seat, [...(bySeat.get(seat) ?? []), row]);
  }
  const positiveSeats = [...bySeat].filter(([, rows]) => rows.some((row) => row.amount > 0)).map(([seat]) => seat);
  if (positiveSeats.length !== 1 || positiveSeats[0] !== "seat_house_il_07_current") throw new Error("AIPAC_AMBIGUITY_UNIQUE_POSITIVE_TARGET_NOT_PROVEN");
  const dispositions = conflicts.map((conflict) => {
    const rows = bySeat.get(conflict.seatCycleId) ?? [];
    if (rows.length === 0) throw new Error("AIPAC_AMBIGUITY_SOURCE_ROWS_MISSING");
    const positiveRecordCount = rows.filter((row) => row.amount > 0).length;
    const negativeRecordCount = rows.filter((row) => row.amount < 0).length;
    const zeroRecordCount = rows.filter((row) => row.amount === 0).length;
    const accepted = conflict.seatCycleId === "seat_house_il_07_current";
    if (!accepted && (positiveRecordCount !== 0 || negativeRecordCount === 0)) throw new Error("AIPAC_AMBIGUITY_REJECTION_NOT_NEGATIVE_ONLY");
    const unsigned = {
      sourceDecisionId: conflict.sourceDecisionId,
      seatCycleId: conflict.seatCycleId as "seat_house_ca_47_current" | "seat_house_il_07_current",
      candidateId: CANDIDATE_ID as typeof CANDIDATE_ID,
      cycleYear: 2024 as const,
      disposition: accepted ? "auto_accept_unique_positive_target" as const : "auto_reject_negative_adjustment_only_target" as const,
      evaluatorUse: accepted ? "reviewer_only_candidate" as const : "excluded_invalid_origin" as const,
      positiveRecordCount,
      negativeRecordCount,
      zeroRecordCount,
      evidenceRecordSha256s: rows.map((row) => row.recordIdentitySha256).sort(bytewise),
      rationaleCodes: accepted ? ["UDP_PRIMARY_OPPOSITION_POSITIVE_SOURCE_ROWS", "UNIQUE_POSITIVE_JURISDICTION"] : ["UDP_NEGATIVE_ADJUSTMENT_ONLY", "NEGATIVE_ADJUSTMENT_CANNOT_ORIGINATE_RELATIONSHIP"],
    };
    return disposition.parse({ ...unsigned, dispositionSha256: digest("dsa-seats:aipac-challenger-ambiguity-disposition:v1\0", unsigned) });
  }).sort((a, b) => bytewise(a.seatCycleId, b.seatCycleId));
  const unsigned = {
    schema: "aipac-challenger-ambiguity-resolution-candidate-v1" as const,
    version: 1 as const,
    generatedAt: "2026-08-05T10:30:00.000Z" as const,
    sourceCutoff: "2026-08-04" as const,
    reviewerOnly: true as const,
    publicationEligible: false as const,
    defaultUse: "apply_to_next_reviewer_only_foundation_exclude_from_publication" as const,
    rule: "a_negative_or_zero_schedule_e_adjustment_cannot_originate_a_candidate_seat_relationship_when_the_same_candidate_has_a_unique_positive_primary_opposition_jurisdiction" as const,
    inputs: { closureFileSha256: CLOSURE_FILE_SHA256, foundationFileSha256: FOUNDATION_FILE_SHA256 },
    summary: { inputConflictRelationships: 2 as const, mechanicallyResolvedRelationships: 2 as const, acceptedRelationships: 1 as const, rejectedRelationships: 1 as const, remainingFoundationConflictRelationships: 6 as const, remainingMethodologyAndPromotionDecisions: 4 as const },
    dispositions,
    dispositionSetSha256: digest("dsa-seats:aipac-challenger-ambiguity-disposition-set:v1\0", dispositions),
    review: { status: "automatic_candidate" as const, reviewer: null, reviewedAt: null },
  };
  return validateAipacChallengerAmbiguityResolutionCandidate({ ...unsigned, packageSha256: digest("dsa-seats:aipac-challenger-ambiguity-resolution-candidate:v1\0", unsigned) });
}

export function validateAipacChallengerAmbiguityResolutionCandidate(value: unknown): AipacChallengerAmbiguityResolutionCandidate {
  const parsed = aipacChallengerAmbiguityResolutionCandidateSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== digest("dsa-seats:aipac-challenger-ambiguity-resolution-candidate:v1\0", unsigned)) throw new Error("AIPAC_AMBIGUITY_PACKAGE_HASH_MISMATCH");
  if (parsed.dispositionSetSha256 !== digest("dsa-seats:aipac-challenger-ambiguity-disposition-set:v1\0", parsed.dispositions)) throw new Error("AIPAC_AMBIGUITY_DISPOSITION_SET_MISMATCH");
  for (const row of parsed.dispositions) {
    const { dispositionSha256, ...rowUnsigned } = row;
    if (dispositionSha256 !== digest("dsa-seats:aipac-challenger-ambiguity-disposition:v1\0", rowUnsigned)) throw new Error("AIPAC_AMBIGUITY_DISPOSITION_HASH_MISMATCH");
  }
  return parsed;
}
