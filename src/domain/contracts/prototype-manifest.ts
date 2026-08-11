import { z } from "zod";
import { sha256Schema, seatCycleIdSchema } from "./primitives";
import { dataReleaseSchema } from "./releases";
import { sourceSchema, sourceSnapshotSchema } from "./sources";
import { districtPlanSchema, geometryArtifactSchema } from "./geography";
import { geographyVersionSchema } from "./geography";
import { officeSchema, personSchema, officeTermSchema, membershipSchema, seatCycleSchema } from "./identity";
import { contestSchema, candidacySchema, resultOptionSchema, electionResultSchema } from "./elections";
import { acsObservationSchema } from "./acs";
import { committeeSchema, committeeRelationshipSchema, fecFilingSummarySchema, seatFinanceSummarySchema } from "./finance";

export const prototypeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  canonicalDataChecksumSha256: sha256Schema,
  profileSeatCycleIds: z.array(seatCycleIdSchema).min(10).max(12),
  release: dataReleaseSchema,
  sources: z.array(sourceSchema).min(1),
  snapshots: z.array(sourceSnapshotSchema).min(1),
  districtPlans: z.array(districtPlanSchema).min(1),
  geometryArtifacts: z.array(geometryArtifactSchema).min(1),
  geographyVersions: z.array(geographyVersionSchema).min(1),
  offices: z.array(officeSchema).min(1),
  people: z.array(personSchema),
  officeTerms: z.array(officeTermSchema).min(1),
  memberships: z.array(membershipSchema),
  seatCycles: z.array(seatCycleSchema).min(1),
  contests: z.array(contestSchema),
  candidacies: z.array(candidacySchema),
  resultOptions: z.array(resultOptionSchema),
  electionResults: z.array(electionResultSchema),
  acsObservations: z.array(acsObservationSchema),
  committees: z.array(committeeSchema),
  committeeRelationships: z.array(committeeRelationshipSchema),
  fecFilingSummaries: z.array(fecFilingSummarySchema),
  financeSummaries: z.array(seatFinanceSummarySchema),
}).strict();

export type PrototypeManifest = z.infer<typeof prototypeManifestSchema>;