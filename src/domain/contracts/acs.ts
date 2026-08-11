import { z } from "zod";
import { releaseIdSchema, geographyVersionIdSchema, snapshotIdSchema } from "./primitives";
import { provenanceReferenceSchema, factValueSchema } from "./shared";
import { lineageSchema } from "./identity";

export const acsObservationSchema = z.object({
  releaseId: releaseIdSchema,
  geographyVersionId: geographyVersionIdSchema,
  variable: z.string().min(1),
  label: z.string().min(1),
  estimate: factValueSchema(z.number()),
  marginOfError: factValueSchema(z.number().nonnegative()),
  unit: z.enum(["count", "percent", "usd", "years"]),
  surveyPeriod: z.string().min(1),
  universe: z.string().min(1),
  lineage: lineageSchema,
}).strict();

const acsVariableCommon = {
  id: z.string().min(1), releaseId: releaseIdSchema, variable: z.string().min(1), label: z.string().min(1),
  unit: z.enum(["count", "percent", "usd", "years"]), surveyPeriod: z.string().min(1), universe: z.string().min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
};
const strictAcsVariableSchema = z.discriminatedUnion("definitionKind", [
  z.strictObject({ ...acsVariableCommon, definitionKind: z.literal("source"), censusVariable: z.string().min(1), publishedMoeMethod: z.enum(["published", "not_published"]) }),
  z.strictObject({ ...acsVariableCommon, unit: z.literal("percent"), definitionKind: z.literal("derived_ratio"), numeratorDefinitionId: z.string().min(1), denominatorDefinitionId: z.string().min(1), derivationFormulaVersion: z.string().min(1), moePropagationMethod: z.literal("delta_method") }),
]);
export const acsVariableSchema = strictAcsVariableSchema;

export type AcsObservation = z.infer<typeof acsObservationSchema>;