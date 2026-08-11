import { z } from "zod";
import { snapshotIdSchema } from "./primitives";

export const chamberSchema = z.enum(["house", "senate"]);
export const officeKindSchema = z.enum([
  "house_voting",
  "house_delegate",
  "resident_commissioner",
  "senate",
]);
export const partySchema = z.enum([
  "democratic",
  "republican",
  "independent",
  "other",
]);
export const incumbencyStatusSchema = z.enum([
  "incumbent_running",
  "incumbent_not_running",
  "open",
  "unknown",
]);
export const missingReasonSchema = z.enum([
  "not_applicable",
  "not_collected",
  "not_reported",
  "not_yet_reported",
  "suppressed",
  "unmatched",
  "source_unavailable",
  "license_unavailable",
  "not_defensibly_modeled",
]);
export const factStatusSchema = z.enum([
  "certified",
  "official",
  "reported",
  "modeled",
  "estimated",
  "superseded",
]);
export const provenanceRoleSchema = z.enum([
  "original_publisher",
  "intermediary",
  "geometry_source",
  "derived_input",
]);

export type Chamber = z.infer<typeof chamberSchema>;
export type Party = z.infer<typeof partySchema>;
export type MissingReason = z.infer<typeof missingReasonSchema>;

export const provenanceReferenceSchema = z.object({
  snapshotId: snapshotIdSchema,
  role: provenanceRoleSchema,
}).strict();

export const missingValueSchema = z.object({
  kind: z.literal("missing"),
  reason: missingReasonSchema,
}).strict();

export function factValueSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("value"), value: valueSchema }).strict(),
    missingValueSchema,
  ]);
}

export type FactValue<T> =
  | Readonly<{ kind: "value"; value: T }>
  | Readonly<{ kind: "missing"; reason: MissingReason }>;

export function deriveVoteShare(votes: number, denominatorVotes: number): number | null {
  return denominatorVotes === 0 ? null : (votes / denominatorVotes) * 100;
}