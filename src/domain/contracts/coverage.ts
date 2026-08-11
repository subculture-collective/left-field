import { z } from "zod";
import { releaseIdSchema, seatCycleIdSchema, snapshotIdSchema, usStateCodeSchema } from "./primitives";

export const coverageDomainSchema = z.enum(["identity", "geography", "member", "acs", "finance", "election_2020", "election_2022", "election_2024", "maps"]);
export const coverageScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("release") }),
  z.strictObject({ kind: z.literal("jurisdiction"), jurisdictionCode: usStateCodeSchema }),
  z.strictObject({ kind: z.literal("seat_cycle"), seatCycleId: seatCycleIdSchema }),
  z.strictObject({ kind: z.literal("acs_indicator"), variable: z.string().min(1), surveyPeriod: z.string().min(1) }),
  z.strictObject({ kind: z.literal("election"), jurisdictionCode: usStateCodeSchema, electionYear: z.number().int() }),
  z.strictObject({ kind: z.literal("funding"), seatCycleId: seatCycleIdSchema, fundingKind: z.enum(["summary", "category", "organization", "outside_spending"]) }),
]);
const coverageMissingReasonSchema = z.enum(["not_collected", "not_reported", "not_yet_reported", "suppressed", "unmatched", "source_unavailable", "license_unavailable", "not_defensibly_modeled"]);
export const coverageRecordSchema = z.strictObject({
  releaseId: releaseIdSchema, domain: coverageDomainSchema, scope: coverageScopeSchema,
  status: z.enum(["complete", "partial", "not_collected", "unavailable"]),
  expectedCount: z.number().int().nonnegative(), observedCount: z.number().int().nonnegative(),
  missingByReason: z.array(z.strictObject({ reason: coverageMissingReasonSchema, count: z.number().int().positive() })).default([]),
  quarantinedCount: z.number().int().nonnegative().default(0), incompatibleCount: z.number().int().nonnegative().default(0),
  inputSnapshotIds: z.array(snapshotIdSchema),
});
export type CoverageRecord = z.infer<typeof coverageRecordSchema>;