import { z } from "zod";

export const GOLDEN_CASE_KEYS = ["at_large", "non_voting_delegate", "boundary_change", "vacancy_special_election", "uncontested_race", "incomplete_precinct_allocation", "modeled_result", "missing_sanders_2020", "amended_fec_summary", "acs_estimate_moe", "future_evidence_review_states"] as const;
export type GoldenCaseKey = typeof GOLDEN_CASE_KEYS[number];

const referenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("canonical_record"), collection: z.enum(["geographyVersions", "districtPlans", "seatCycles", "contests", "fecFilingSummaries", "acsObservations"]), id: z.string().min(1) }),
  z.strictObject({ kind: z.literal("source_record"), path: z.string().startsWith("data/"), pointer: z.string().startsWith("/") }),
  z.strictObject({ kind: z.literal("offline_fixture"), module: z.string().startsWith("src/offline/"), exportName: z.string().min(1) }),
  z.strictObject({ kind: z.literal("documentation"), path: z.string().startsWith("data/metadata/"), pointer: z.string().startsWith("/") }),
]);
const entrySchema = z.strictObject({
  status: z.enum(["canonical_real_data", "synthetic_contract_fixture", "documented_gap"]),
  satisfied: z.boolean(),
  references: z.array(referenceSchema).min(1),
  limitation: z.string().min(1),
}).superRefine((entry, ctx) => {
  const allowed = entry.status === "canonical_real_data" ? ["canonical_record", "source_record"] : entry.status === "synthetic_contract_fixture" ? ["offline_fixture"] : ["documentation"];
  if (entry.references.some((reference) => !allowed.includes(reference.kind))) ctx.addIssue({ code: "custom", message: "References are not allowed for this status" });
  if (entry.status === "documented_gap" && entry.satisfied) ctx.addIssue({ code: "custom", message: "Documented gaps cannot claim satisfaction" });
  if (entry.status !== "documented_gap" && !entry.satisfied) ctx.addIssue({ code: "custom", message: "Covered cases must claim satisfaction" });
});

const casesSchema = z.strictObject({
  at_large: entrySchema, non_voting_delegate: entrySchema, boundary_change: entrySchema,
  vacancy_special_election: entrySchema, uncontested_race: entrySchema, incomplete_precinct_allocation: entrySchema,
  modeled_result: entrySchema, missing_sanders_2020: entrySchema, amended_fec_summary: entrySchema,
  acs_estimate_moe: entrySchema, future_evidence_review_states: entrySchema,
});
export const goldenCaseCoverageSchema = z.strictObject({ version: z.literal(1), cases: casesSchema });
export type GoldenCaseCoverage = Readonly<z.infer<typeof goldenCaseCoverageSchema>>;

export function parseGoldenCaseCoverage(input: unknown): GoldenCaseCoverage {
  return goldenCaseCoverageSchema.parse(input);
}
