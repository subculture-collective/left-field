import { z } from "zod";
import { releaseIdSchema, geographyVersionIdSchema, geometryArtifactIdSchema, snapshotIdSchema } from "./primitives";

export const mapArtifactSchema = z.strictObject({
  id: z.string().min(1), releaseId: releaseIdSchema, geographyVersionId: geographyVersionIdSchema,
  artifactId: geometryArtifactIdSchema, inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});
export const snapshotDerivationSchema = z.strictObject({
  releaseId: releaseIdSchema, outputSnapshotId: snapshotIdSchema, inputSnapshotIds: z.array(snapshotIdSchema).min(1), methodologyVersion: z.string().min(1),
});