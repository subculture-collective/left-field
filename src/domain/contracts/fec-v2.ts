import { z } from "zod";
import { releaseIdSchema, seatCycleIdSchema, sha256Schema, isoDateSchema } from "./primitives";

export const fecV2AcquisitionOutcomeSchema = z.enum(["source_unavailable", "paper_filing_unreviewed", "unsupported_layout", "malformed_filing"]);
export const fecV2AcquisitionOutcomeManifestSchema = z.strictObject({ fileNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), entryIdentitySha256: sha256Schema, outcome: fecV2AcquisitionOutcomeSchema });
export type FecV2AcquisitionOutcome = z.infer<typeof fecV2AcquisitionOutcomeManifestSchema>;
/** PostgreSQL bigint's positive bound, represented without loss in manifests. */
export const MAX_POSTGRES_BIGINT_CENTS = "9223372036854775807" as const;
const unsignedCentsSchema = z.string().regex(/^(0|[1-9][0-9]*)$/).refine(
  (value) => value.length < MAX_POSTGRES_BIGINT_CENTS.length || (value.length === MAX_POSTGRES_BIGINT_CENTS.length && value <= MAX_POSTGRES_BIGINT_CENTS),
  `Cents must not exceed PostgreSQL bigint (${MAX_POSTGRES_BIGINT_CENTS})`,
);
export const fecV2ExactElectionAggregateSchema = z.strictObject({
  releaseId: releaseIdSchema, acquisitionPlanSha256: sha256Schema, seatCycleId: seatCycleIdSchema,
  candidateMappingId: z.string().min(1), electionMappingId: z.string().min(1), closureId: z.string().min(1),
  supportCents: unsignedCentsSchema, opposeCents: unsignedCentsSchema,
  methodology: z.literal("fec-receipt-cutoff-v2"), coverageThrough: isoDateSchema,
});
export type FecV2ExactElectionAggregate = z.infer<typeof fecV2ExactElectionAggregateSchema>;