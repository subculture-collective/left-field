import { z } from "zod";

import {
  geographyVersionIdSchema,
  officeTermIdSchema,
  releaseIdSchema,
  seatCycleIdSchema,
} from "@/domain/contracts";

export const ADDRESS_RESOLUTION_MAX_SERIALIZED_BYTES = 16 * 1024;
const OUTPUT_IDENTIFIER_MAX_LENGTH = 128;
const OUTPUT_METADATA_MAX_LENGTH = 128;
const PRODUCT_VINTAGE_MAX_LENGTH = 64;

const boundedIdentifier = (schema: z.ZodType<string, string>) =>
  z.string().max(OUTPUT_IDENTIFIER_MAX_LENGTH).pipe(schema);

export const addressInputSchema = z.object({
  address: z.string().trim().min(8).max(300),
}).strict();

export const addressResolutionErrorCodeSchema = z.enum([
  "MULTIPLE_CANDIDATES",
  "ADDRESS_NOT_FOUND",
  "GEOGRAPHY_VINTAGE_MISMATCH",
  "GEOGRAPHY_AMBIGUOUS",
  "OUTSIDE_PROTOTYPE_COVERAGE",
  "LOOKUP_DISABLED",
  "RATE_LIMITED",
  "GEOCODER_UNAVAILABLE",
  "RELEASE_INVARIANT_FAILURE",
]);

const requestContextSchema = z.object({
  releaseId: boundedIdentifier(releaseIdSchema),
  productVintage: z.string().min(1).max(PRODUCT_VINTAGE_MAX_LENGTH),
});

const geocoderMetadataSchema = z.object({
  id: z.string().min(1).max(OUTPUT_METADATA_MAX_LENGTH),
  name: z.string().min(1).max(OUTPUT_METADATA_MAX_LENGTH),
}).strict();
const geocoderContextSchema = requestContextSchema.extend({
  geocoderBenchmark: geocoderMetadataSchema,
  geocoderVintage: geocoderMetadataSchema,
});

const senateSeatSchema = z.object({
  senateClass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  officeTermId: boundedIdentifier(officeTermIdSchema),
  seatCycleId: boundedIdentifier(seatCycleIdSchema),
}).strict();

const oneCandidateContextSchema = geocoderContextSchema.extend({
  matchQuality: z.literal("single_candidate"),
});

export const addressResolutionSchema = z.union([
  oneCandidateContextSchema.extend({
    status: z.literal("matched"),
    senateRepresentation: z.literal("two_seats"),
    houseSeat: z.object({
      officeTermId: boundedIdentifier(officeTermIdSchema),
      seatCycleId: boundedIdentifier(seatCycleIdSchema),
      geographyVersionId: boundedIdentifier(geographyVersionIdSchema),
    }).strict(),
    senateSeats: z.array(senateSeatSchema).length(2),
  }).strict().superRefine((value, context) => {
    const [first, second] = value.senateSeats;
    if (first && second && first.senateClass >= second.senateClass) context.addIssue({ code: "custom", path: ["senateSeats"], message: "Senate seats must be ordered by ascending class" });
    if (new Set(value.senateSeats.map((seat) => seat.officeTermId)).size !== 2) context.addIssue({ code: "custom", path: ["senateSeats"], message: "Senate office terms must be distinct" });
    if (new Set(value.senateSeats.map((seat) => seat.seatCycleId)).size !== 2) context.addIssue({ code: "custom", path: ["senateSeats"], message: "Senate seat cycles must be distinct" });
  }),
  oneCandidateContextSchema.extend({
    status: z.literal("matched"),
    senateRepresentation: z.literal("none"),
    houseSeat: z.object({
      officeTermId: boundedIdentifier(officeTermIdSchema),
      seatCycleId: boundedIdentifier(seatCycleIdSchema),
      geographyVersionId: boundedIdentifier(geographyVersionIdSchema),
    }).strict(),
    senateSeats: z.array(senateSeatSchema).length(0),
  }).strict(),
  geocoderContextSchema.extend({
    status: z.literal("ambiguous"),
    matchQuality: z.literal("ambiguous"),
    errorCode: z.literal("MULTIPLE_CANDIDATES"),
  }).strict(),
  geocoderContextSchema.extend({
    status: z.literal("no_match"),
    matchQuality: z.literal("none"),
    errorCode: z.literal("ADDRESS_NOT_FOUND"),
  }).strict(),
  oneCandidateContextSchema.extend({
    status: z.literal("vintage_mismatch"),
    errorCode: z.literal("GEOGRAPHY_VINTAGE_MISMATCH"),
  }).strict(),
  oneCandidateContextSchema.extend({
    status: z.literal("geography_ambiguous"),
    errorCode: z.literal("GEOGRAPHY_AMBIGUOUS"),
  }).strict(),
  oneCandidateContextSchema.extend({
    status: z.literal("unsupported_prototype_coverage"),
    errorCode: z.literal("OUTSIDE_PROTOTYPE_COVERAGE"),
  }).strict(),
  requestContextSchema.extend({
    status: z.literal("disabled"),
    errorCode: z.literal("LOOKUP_DISABLED"),
  }).strict(),
  requestContextSchema.extend({
    status: z.literal("rate_limited"),
    errorCode: z.literal("RATE_LIMITED"),
  }).strict(),
  requestContextSchema.extend({
    status: z.literal("upstream_failure"),
    errorCode: z.literal("GEOCODER_UNAVAILABLE"),
  }).strict(),
  requestContextSchema.extend({
    status: z.literal("resolver_failure"),
    errorCode: z.literal("RELEASE_INVARIANT_FAILURE"),
  }).strict(),
]);

export type AddressInput = z.infer<typeof addressInputSchema>;
export type AddressResolution = z.infer<typeof addressResolutionSchema>;

/** Parses route-independent output and rejects any unexpectedly oversized JSON payload. */
export function assertBoundedAddressResolution(value: unknown): AddressResolution {
  const resolution = addressResolutionSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(resolution)).byteLength > ADDRESS_RESOLUTION_MAX_SERIALIZED_BYTES) {
    throw new Error("Address resolution exceeds serialized size limit");
  }
  return resolution;
}

export interface AddressResolver {
  resolve(input: AddressInput, signal?: AbortSignal): Promise<AddressResolution>;
}
