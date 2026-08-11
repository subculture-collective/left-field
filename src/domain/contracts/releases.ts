import { z } from "zod";
import { releaseIdSchema, isoDateTimeSchema } from "./primitives";

export const dataReleaseSchema = z.object({
  id: releaseIdSchema,
  label: z.string().min(1),
  status: z.enum(["candidate", "published", "retired"]),
  sourceCutoff: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  publishedAt: isoDateTimeSchema.nullable(),
  previousReleaseId: releaseIdSchema.nullable(),
}).strict();

export type DataRelease = z.infer<typeof dataReleaseSchema>;