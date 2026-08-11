import { z } from "zod";
import { sourceIdSchema, snapshotIdSchema, releaseIdSchema, isoDateTimeSchema, sha256Schema } from "./primitives";

export const sourceSchema = z.object({
  id: sourceIdSchema,
  releaseId: releaseIdSchema,
  name: z.string().min(1),
  authority: z.enum(["official", "derived", "editorial"]),
  homepageUrl: z.url(),
}).strict();

export const sourceSnapshotSchema = z.object({
  id: snapshotIdSchema,
  releaseId: releaseIdSchema,
  sourceId: sourceIdSchema,
  sourceUrl: z.url(),
  publishedAt: isoDateTimeSchema.nullable(),
  retrievedAt: isoDateTimeSchema,
  checksumSha256: sha256Schema,
  parserVersion: z.string().min(1),
  license: z.string().min(1),
  usageStatus: z.enum(["approved", "restricted", "review_required"]),
}).strict();

export type Source = z.infer<typeof sourceSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;