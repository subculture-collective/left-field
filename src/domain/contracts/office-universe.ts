import { z } from "zod";

import { isoDateSchema, releaseIdSchema } from "./primitives";
import { missingReasonSchema, provenanceReferenceSchema } from "./shared";

/**
 * Additive contract for the all-elected-offices catalog.
 *
 * It deliberately has no foreign keys to the federal `offices`/`seat_cycles`
 * contract.  A federal projection can be introduced later only after a parity
 * adapter exists; this prevents local-source terminology or selection systems
 * from broadening the 541-seat federal release by accident.
 */
const opaqueId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,128}$`));

export const jurisdictionIdSchema = opaqueId("jurisdiction");
export const governingBodyIdSchema = opaqueId("body");
export const officeUniverseOfficeIdSchema = opaqueId("universe_office");
export const officeUniverseTermIdSchema = opaqueId("universe_term");
export const formulaProgramIdSchema = opaqueId("formula");

export const governmentLevelSchema = z.enum([
  "federal",
  "state",
  "territorial",
  "tribal",
  "county",
  "municipal",
  "township",
  "school_district",
  "special_district",
  "other_local",
]);
export const jurisdictionKindSchema = z.enum([
  "nation",
  "state_or_territory",
  "tribal_nation",
  "county_equivalent",
  "municipality",
  "township",
  "school_district",
  "special_district",
  "other",
]);
export const selectionMethodSchema = z.enum([
  "elected",
  "appointed",
  "ex_officio",
  "mixed",
  "unknown",
]);
export const partisanStatusSchema = z.enum([
  "partisan",
  "nonpartisan",
  "mixed",
  "unknown",
]);
export const electionMethodSchema = z.enum([
  "partisan_primary_general",
  "top_two",
  "top_four",
  "ranked_choice",
  "plurality",
  "majority_runoff",
  "retention",
  "convention",
  "other",
  "unknown",
]);
export const officeCatalogScopeSchema = z.enum([
  "federal_congressional",
  "state_legislative",
  "source_defined_local",
]);
export const formulaEligibilityStatusSchema = z.enum([
  "ineligible",
  "eligible",
  "not_assessed",
]);

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const jurisdictionSchema = z
  .object({
    ...sourcedRecord,
    id: jurisdictionIdSchema,
    parentJurisdictionId: jurisdictionIdSchema.nullable(),
    level: governmentLevelSchema,
    kind: jurisdictionKindSchema,
    sourceNaturalKey: z.string().min(1),
    sourceName: z.string().min(1),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.parentJurisdictionId === value.id)
      context.addIssue({ code: "custom", message: "jurisdiction cannot parent itself" });
    if (
      value.effectiveFrom &&
      value.effectiveTo &&
      value.effectiveTo < value.effectiveFrom
    )
      context.addIssue({ code: "custom", message: "jurisdiction effective range is inverted" });
  });

export const governingBodySchema = z
  .object({
    ...sourcedRecord,
    id: governingBodyIdSchema,
    jurisdictionId: jurisdictionIdSchema,
    sourceNaturalKey: z.string().min(1),
    sourceName: z.string().min(1),
    normalizedName: z.string().min(1),
    selectionMethod: selectionMethodSchema,
  })
  .strict();

export const officeUniverseOfficeSchema = z
  .object({
    ...sourcedRecord,
    id: officeUniverseOfficeIdSchema,
    jurisdictionId: jurisdictionIdSchema,
    governingBodyId: governingBodyIdSchema.nullable(),
    catalogScope: officeCatalogScopeSchema,
    level: governmentLevelSchema,
    officeFamily: z.string().min(1),
    sourceNaturalKey: z.string().min(1),
    sourceNativeTitle: z.string().min(1),
    normalizedTitle: z.string().min(1),
    selectionMethod: selectionMethodSchema,
    partisanStatus: partisanStatusSchema,
    electionMethod: electionMethodSchema,
    districtMagnitude: z.number().int().positive().nullable(),
  })
  .strict();

export const officeUniverseTermSchema = z
  .object({
    ...sourcedRecord,
    id: officeUniverseTermIdSchema,
    officeId: officeUniverseOfficeIdSchema,
    startsAt: isoDateSchema.nullable(),
    endsAt: isoDateSchema.nullable(),
    selectionMethod: selectionMethodSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startsAt && value.endsAt && value.endsAt < value.startsAt)
      context.addIssue({ code: "custom", message: "office term range is inverted" });
  });

export const formulaEligibilitySchema = z
  .object({
    ...sourcedRecord,
    officeId: officeUniverseOfficeIdSchema,
    formulaProgramId: formulaProgramIdSchema.nullable(),
    status: formulaEligibilityStatusSchema,
    missingInputs: z
      .array(
        z
          .object({
            input: z.string().min(1),
            reason: missingReasonSchema,
          })
          .strict(),
      )
      .default([]),
    reasons: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "eligible" && (!value.formulaProgramId || value.missingInputs.length))
      context.addIssue({ code: "custom", message: "eligible offices need a formula program and no missing inputs" });
    if (value.status !== "eligible" && value.formulaProgramId !== null)
      context.addIssue({ code: "custom", message: "ineligible offices cannot be attached to a formula program" });
  });

export type Jurisdiction = z.infer<typeof jurisdictionSchema>;
export type GoverningBody = z.infer<typeof governingBodySchema>;
export type OfficeUniverseOffice = z.infer<typeof officeUniverseOfficeSchema>;
export type OfficeUniverseTerm = z.infer<typeof officeUniverseTermSchema>;
export type FormulaEligibility = z.infer<typeof formulaEligibilitySchema>;
