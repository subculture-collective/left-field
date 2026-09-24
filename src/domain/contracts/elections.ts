import { z } from "zod";
import { releaseIdSchema, seatCycleIdSchema, contestIdSchema, candidacyIdSchema, resultOptionIdSchema, personIdSchema, geographyVersionIdSchema, isoDateSchema } from "./primitives";
import { partySchema, provenanceReferenceSchema, factValueSchema } from "./shared";
import { lineageSchema } from "./identity";

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const contestSchema = z.object({
  ...sourcedRecord,
  id: contestIdSchema,
  seatCycleId: seatCycleIdSchema,
  kind: z.enum([
    "president_general",
    "house_general",
    "senate_general",
    "democratic_presidential_primary",
  ]),
  round: z.enum(["primary", "runoff", "general"]),
  electionDate: isoDateSchema,
  geographyVersionId: geographyVersionIdSchema,
  certificationStatus: z.enum(["certified", "official_unfinalized", "unofficial", "modeled", "unavailable"]),
  reportingCompletenessPercent: z.number().min(0).max(100),
  denominatorVotes: factValueSchema(z.number().int().nonnegative()),
  reportingUnit: z.enum(["district", "precinct", "county", "state", "mixed"]),
  allocationMethod: z.enum(["none", "precinct_overlay", "population_crosswalk", "other"]),
  allocationCoveragePercent: factValueSchema(z.number().min(0).max(100)),
  lineage: lineageSchema,
}).strict();

export const candidacySchema = z.object({
  ...sourcedRecord,
  id: candidacyIdSchema,
  contestId: contestIdSchema,
  personId: personIdSchema.nullable(),
  party: partySchema,
  status: z.enum(["filed", "qualified", "withdrawn", "nominee", "write_in"]),
}).strict();

export const resultOptionSchema = z.object({
  ...sourcedRecord,
  id: resultOptionIdSchema,
  contestId: contestIdSchema,
  candidacyId: candidacyIdSchema.nullable(),
  label: z.string().min(1),
  party: partySchema.nullable(),
  optionKind: z.enum(["candidate", "write_in_total", "other"]),
}).strict();

export const electionResultSchema = z.object({
  releaseId: releaseIdSchema,
  contestId: contestIdSchema,
  resultOptionId: resultOptionIdSchema,
  votes: factValueSchema(z.number().int().nonnegative()),
  lineage: lineageSchema,
}).strict();

export type Contest = z.infer<typeof contestSchema>;
export type Candidacy = z.infer<typeof candidacySchema>;
export type ResultOption = z.infer<typeof resultOptionSchema>;
export type ElectionResult = z.infer<typeof electionResultSchema>;