import { z } from "zod";


export const correctionFieldPaths = [
  "identity.current_holder", "identity.party", "identity.occupancy", "biography.bioguide_id",
  "biography.birth_date", "biography.other", "elections", "finance", "demographics",
  "district_boundary", "sources", "other",
] as const;

export const correctionFieldPathSchema = z.enum(correctionFieldPaths);

const controlCharacter = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const normalizeText = (value: string) => value.replace(/\r\n/g, "\n").replace(/^[ \t\n]+|[ \t\n]+$/g, "");
const utf8Bytes = (value: string) => Buffer.byteLength(value, "utf8");
const codePoints = (value: string) => Array.from(value).length;
const correctionIdSchema = (prefix: "rel" | "seat") => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,128}$`));
export const correctionReleaseIdSchema = correctionIdSchema("rel");
export const correctionSeatCycleIdSchema = correctionIdSchema("seat");

/** Normalizes line endings and edge whitespace; tabs and LF are intentionally retained. */
export const normalizedTextSchema = (maxChars: number, maxBytes: number) => z.string()
  .refine((value) => !value.replace(/\r\n/g, "").includes("\r"), "Lone carriage returns are not allowed")
  .transform(normalizeText)
  .refine((value) => !controlCharacter.test(value), "Control characters are not allowed")
  .refine((value) => codePoints(value) <= maxChars, `Must be at most ${maxChars} characters`)
  .refine((value) => utf8Bytes(value) <= maxBytes, `Must be at most ${maxBytes} UTF-8 bytes`);

function canonicalHttpsUrl(value: string): string | undefined {
  try {
    // Keep this grammar in lockstep with operations.canonical_correction_source_url.
    if (!/^[\x21-\x7E]+$/.test(value) || !/^https:\/\/[A-Za-z0-9.-]+(?:[/?][A-Za-z0-9._~!$&'()*+,;=:/?%\-]*)?$/.test(value) || /%(?![0-9A-F]{2})/.test(value) || /\/(?:\.|%2E){1,2}(?:\/|\?|$)/.test(value)) return undefined;
    const url = new URL(value);
    const labels = url.hostname.toLowerCase().split(".");
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      !/^[a-z0-9.-]+$/.test(url.hostname) || labels.length < 2 ||
      labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      !/^[a-z]{2,63}$/i.test(labels.at(-1) ?? "") || ["localhost", "local", "internal", "test", "invalid"].includes(labels.at(-1) ?? "")) return undefined;
    if (!/^https:\/\/[A-Za-z0-9.-]+(?:[/?][A-Za-z0-9._~!$&'()*+,;=:/?%\-]*)?$/.test(value) || /%(?![0-9A-F]{2})/.test(value)) return undefined;
    const canonical = url.toString();
    return codePoints(canonical) <= 2000 && utf8Bytes(canonical) <= 8192 ? canonical : undefined;
  } catch { return undefined; }
}

export const correctionSourceUrlSchema = z.string()
  .refine((value) => !/[\s\u0000-\u001F\u007F-\u009F]/.test(value), "URL whitespace and control characters are not allowed")
  .pipe(normalizedTextSchema(2000, 8192))
  .pipe(z.string().url())
  .transform((value, context) => {
    const canonical = canonicalHttpsUrl(value);
    if (!canonical) {
      context.addIssue({ code: "custom", message: "Expected a credential-free, fragment-free HTTPS URL" });
      return z.NEVER;
    }
    return canonical;
  })
  .refine((value) => codePoints(value) <= 2000 && utf8Bytes(value) <= 8192, "Canonical URL is too long");

export const correctionSubmissionSchema = z.object({
  releaseId: correctionReleaseIdSchema,
  seatCycleId: correctionSeatCycleIdSchema.optional(),
  fieldPath: correctionFieldPathSchema,
  explanation: normalizedTextSchema(4000, 16 * 1024).refine((value) => codePoints(value) >= 20, "Must be at least 20 characters"),
  sourceUrl: correctionSourceUrlSchema.optional(),
}).strict();

export type NormalizedCorrectionSubmission = z.infer<typeof correctionSubmissionSchema>;
export type CorrectionSubmission = NormalizedCorrectionSubmission;

export function parseCorrectionSubmission(input: unknown): NormalizedCorrectionSubmission {
  return correctionSubmissionSchema.parse(input);
}

/** Shared with future database parity tests. */
export const correctionParityVectors = {
  ids: [{ value: "rel_a-1", valid: true }, { value: "rel_", valid: false }, { value: `rel_${"a".repeat(129)}`, valid: false }],
  sourceUrls: [
    { value: "https://EXAMPLE.com/a?key=A%2FZ&x=(one),two;three!$&'*=~", canonical: "https://example.com/a?key=A%2FZ&x=(one),two;three!$&%27*=~" },
    { value: "https://example.com?query=value", canonical: "https://example.com/?query=value" },
    { value: "https://EXAMPLE.com", canonical: "https://example.com/" },
    { value: "https://example.com/a/../evidence", canonical: undefined },
    ...["localhost", "local", "internal", "test", "invalid"].map((tld) => ({ value: `https://example.${tld}/a`, canonical: undefined })),
    ...["https://127.0.0.1/a", "https://example.com:443/a", "https://user@example.com/a", "https://example.com/a@b", "https://example.com/a%2f", "https://example.com/a%2", "https://example.com/a%", "https://example.com/a%GG", "https://example.com/a/..", "https://example.com/a/%2E%2E/evidence", "https://example.com/a\t", "https://example.com/a\u0000"].map((value) => ({ value, canonical: undefined })),
    { value: `https://example.com?${"a".repeat(1980)}`, canonical: undefined },
  ],
} as const;

const publicIdSchema = z.uuid();
export const correctionPublicOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted"), correctionId: publicIdSchema }).strict(),
  z.object({ status: z.literal("replay"), correctionId: publicIdSchema }).strict(),
  ...(["malformed", "forbidden", "conflict", "too_large", "unsupported_media_type", "rate_limited", "unavailable"] as const)
    .map((status) => z.object({ status: z.literal(status) }).strict()),
]);

export type CorrectionPublicOutcome = z.infer<typeof correctionPublicOutcomeSchema>;
export const correctionResponseSchema = correctionPublicOutcomeSchema;
export type CorrectionResponse = CorrectionPublicOutcome;
