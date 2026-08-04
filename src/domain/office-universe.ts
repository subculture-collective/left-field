import { z } from "zod";

export const governmentLevelSchema = z.enum(["federal", "state", "territorial", "tribal", "county", "county_equivalent", "municipal", "township", "school_district", "special_district"]);
export const jurisdictionKindSchema = z.enum(["nation", "state", "territory", "tribal_government", "county", "county_equivalent", "municipality", "township", "school_district", "special_district", "election_district"]);
export const officeFamilySchema = z.enum(["legislative", "chief_executive", "judicial", "prosecutorial", "law_enforcement", "education", "elections", "finance", "records", "public_works", "utilities", "land_water", "public_safety", "administrative", "other"]);
export const electionMethodSchema = z.enum(["partisan_primary_general", "nonpartisan_primary_general", "nonpartisan_plurality", "top_two", "top_four_ranked_choice", "ranked_choice", "runoff", "retention", "multi_member_at_large", "multi_member_district", "convention", "other"]);
export const selectionMethodSchema = z.enum(["elected", "appointed", "ex_officio", "mixed", "unknown"]);

const sourceReferenceSchema = z.strictObject({
  sourceId: z.string().min(1),
  snapshotId: z.string().min(1),
  authority: z.enum(["official", "derived", "editorial"]),
});

export const jurisdictionDefinitionSchema = z.strictObject({
  id: z.string().min(1),
  parentJurisdictionId: z.string().min(1).nullable(),
  kind: jurisdictionKindSchema,
  name: z.string().min(1),
  stateCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
});

export const governingBodyDefinitionSchema = z.strictObject({
  id: z.string().min(1),
  jurisdictionId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["legislature", "council", "board", "commission", "court", "executive", "other"]),
  effectiveFrom: z.iso.date().nullable(),
  effectiveTo: z.iso.date().nullable(),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
});

export const publicOfficeDefinitionSchema = z.strictObject({
  id: z.string().min(1),
  catalogScope: z.string().min(1),
  jurisdictionId: z.string().min(1),
  governingBodyId: z.string().min(1).nullable(),
  governmentLevel: governmentLevelSchema,
  officeFamily: officeFamilySchema,
  title: z.string().min(1),
  sourceTitle: z.string().min(1),
  selectionMethod: selectionMethodSchema,
  electionMethod: electionMethodSchema,
  partisan: z.boolean(),
  districtMagnitude: z.number().int().positive(),
  seatCount: z.number().int().positive(),
  termLengthMonths: z.number().int().positive().nullable(),
  geographicScopeId: z.string().min(1).nullable(),
  sourceNaturalKey: z.string().min(1),
  effectiveFrom: z.iso.date().nullable(),
  effectiveTo: z.iso.date().nullable(),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
});

export const evaluationProgramSchema = z.strictObject({
  id: z.string().min(1),
  version: z.string().min(1),
  supportedCatalogScopes: z.array(z.string().min(1)).min(1),
  supportedGovernmentLevels: z.array(governmentLevelSchema).min(1),
  supportedOfficeFamilies: z.array(officeFamilySchema).min(1),
  supportedElectionMethods: z.array(electionMethodSchema).min(1),
  supportedSelectionMethods: z.array(selectionMethodSchema).min(1),
  partisanRequirement: z.enum(["required", "prohibited", "either"]),
  districtMagnitude: z.enum(["single_member", "multi_member", "either"]),
  requiredFactKeys: z.array(z.string().min(1)),
}).superRefine((program, ctx) => {
  for (const values of [program.supportedCatalogScopes, program.supportedGovernmentLevels, program.supportedOfficeFamilies, program.supportedElectionMethods, program.supportedSelectionMethods, program.requiredFactKeys]) {
    if (new Set(values).size !== values.length) ctx.addIssue({ code: "custom", message: "Evaluation program lists must contain unique values" });
  }
});

export type PublicOfficeDefinition = Readonly<z.infer<typeof publicOfficeDefinitionSchema>>;
export type EvaluationProgram = Readonly<z.infer<typeof evaluationProgramSchema>>;
export type EvaluationEligibility = Readonly<{
  status: "eligible" | "ineligible" | "missing_facts";
  reasons: readonly string[];
  missingFactKeys: readonly string[];
}>;

/** Matches an office to a formula family before any score is calculated. */
export function assessEvaluationEligibility(rawOffice: unknown, rawProgram: unknown, availableFactKeys: readonly string[]): EvaluationEligibility {
  const office = publicOfficeDefinitionSchema.parse(rawOffice);
  const program = evaluationProgramSchema.parse(rawProgram);
  const reasons = [
    ...(!program.supportedCatalogScopes.includes(office.catalogScope) ? [`unsupported catalog scope: ${office.catalogScope}`] : []),
    ...(!program.supportedGovernmentLevels.includes(office.governmentLevel) ? [`unsupported government level: ${office.governmentLevel}`] : []),
    ...(!program.supportedOfficeFamilies.includes(office.officeFamily) ? [`unsupported office family: ${office.officeFamily}`] : []),
    ...(!program.supportedElectionMethods.includes(office.electionMethod) ? [`unsupported election method: ${office.electionMethod}`] : []),
    ...(!program.supportedSelectionMethods.includes(office.selectionMethod) ? [`unsupported selection method: ${office.selectionMethod}`] : []),
    ...(program.partisanRequirement === "required" && !office.partisan ? ["partisan election required"] : []),
    ...(program.partisanRequirement === "prohibited" && office.partisan ? ["nonpartisan election required"] : []),
    ...(program.districtMagnitude === "single_member" && office.districtMagnitude !== 1 ? ["single-member district required"] : []),
    ...(program.districtMagnitude === "multi_member" && office.districtMagnitude === 1 ? ["multi-member district required"] : []),
  ];
  if (reasons.length) return { status: "ineligible", reasons, missingFactKeys: [] };
  const facts = new Set(availableFactKeys);
  const missingFactKeys = program.requiredFactKeys.filter((key) => !facts.has(key));
  return missingFactKeys.length ? { status: "missing_facts", reasons: [], missingFactKeys } : { status: "eligible", reasons: [], missingFactKeys: [] };
}
