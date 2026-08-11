import { z } from "zod";
import { releaseIdSchema, personIdSchema, committeeIdSchema, isoDateSchema } from "./primitives";
import { provenanceReferenceSchema, factValueSchema } from "./shared";

export const personBiographicalFactSchema = z.strictObject({
  releaseId: releaseIdSchema, personId: personIdSchema, fact: z.enum(["birth_date", "bioguide_id"]),
  value: factValueSchema(z.string().min(1)), effectiveAt: isoDateSchema, provenance: z.array(provenanceReferenceSchema).min(1),
});
export const committeeAssignmentSchema = z.strictObject({
  releaseId: releaseIdSchema, personId: personIdSchema, committeeId: committeeIdSchema,
  role: z.string().min(1), effectiveFrom: isoDateSchema, effectiveTo: isoDateSchema.nullable(), provenance: z.array(provenanceReferenceSchema).min(1),
});