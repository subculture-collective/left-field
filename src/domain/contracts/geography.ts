import { z } from "zod";
import { releaseIdSchema, districtPlanIdSchema, geometryArtifactIdSchema, geographyVersionIdSchema, snapshotIdSchema, isoDateSchema, usStateCodeSchema, sha256Schema } from "./primitives";
import { provenanceReferenceSchema } from "./shared";

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const districtPlanSchema = z.object({
  ...sourcedRecord,
  id: districtPlanIdSchema,
  name: z.string().min(1),
  congress: z.number().int().positive(),
  enactedAt: isoDateSchema.nullable(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  jurisdictionStateCode: usStateCodeSchema,
}).strict();

export const geometryArtifactSchema = z.object({
  releaseId: releaseIdSchema,
  id: geometryArtifactIdSchema,
  snapshotId: snapshotIdSchema,
  objectKey: z.string().min(1),
  format: z.enum(["geojson", "shapefile", "geopackage"]),
  srid: z.literal(4326),
  checksumSha256: sha256Schema,
}).strict();

export const geographyVersionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...sourcedRecord,
    id: geographyVersionIdSchema,
    kind: z.literal("house_district"),
    districtPlanId: districtPlanIdSchema,
    geometryArtifactId: geometryArtifactIdSchema,
    sourceGeoid: z.string().min(1),
    label: z.string().min(1),
    vintage: z.string().min(1),
    stateCode: usStateCodeSchema,
    districtCode: z.string().regex(/^(AL|[0-9]{2})$/),
  }).strict(),
  z.object({
    ...sourcedRecord,
    id: geographyVersionIdSchema,
    kind: z.literal("state"),
    geometryArtifactId: geometryArtifactIdSchema,
    sourceGeoid: z.string().min(1),
    label: z.string().min(1),
    vintage: z.string().min(1),
    stateCode: usStateCodeSchema,
  }).strict(),
]);

export type DistrictPlan = z.infer<typeof districtPlanSchema>;
export type GeometryArtifact = z.infer<typeof geometryArtifactSchema>;
export type GeographyVersion = z.infer<typeof geographyVersionSchema>;