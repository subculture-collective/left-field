import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const url = z.url();

const citationSchema = z.strictObject({
  url,
  publisherName: z.string().min(1),
  role: z.enum([
    "statewide_original_publisher_landing",
    "partial_jurisdiction_original_publisher_landing",
    "vendor_hosted_official_portal",
    "intermediary_source_discovery",
    "target_boundary_reference_only",
    "historical_boundary_reference_only",
    "precinct_reference_only",
  ]),
  geographicScope: z.enum(["statewide", "partial_jurisdiction", "not_assessed"]),
  assessment: z.enum(["landing_identified_not_certified_or_download_verified", "reference_only_not_assessed", "certified_file_download_verified"]),
});

export const feasibilityRowSchema = z.strictObject({
  jurisdictionCode: z.string().regex(/^[A-Z]{2}$/),
  jurisdictionName: z.string().min(1),
  electionCycle: z.union([z.literal(2020), z.literal(2024)]),
  originalPublisherAssessment: z.enum(["statewide_landing_identified", "partial_only", "not_assessed"]),
  resultCitations: z.array(citationSchema),
  reportingUnit: z.string().min(1),
  geometryStatus: z.literal("not_assessed"),
  geometryCitations: z.array(citationSchema),
  nonGeographicOrAbsenteeTreatment: z.string().min(1),
  nonGeographicOrAbsenteeStatus: z.literal("not_assessed"),
  licenseAssessment: z.literal("not_assessed"),
  targetBoundaryVintage: z.literal("TIGER2025/CD119"),
  allocationMethod: z.literal("not_assessed"),
  reconciliationStatus: z.literal("not_assessed"),
  roundingPolicy: z.literal("not_assessed"),
  conservativeFeasibilityClass: z.enum(["direct_at_large", "feasible_after_audited_overlay", "state_specific_research_required", "not_defensibly_modeled"]),
  expectedModeledCoverage: z.literal("not_assessed"),
  notes: z.string().min(1),
});

export const feasibilityMatrixSchema = z.strictObject({
  status: z.literal("planning_only"),
  contest: z.literal("U.S. President general election"),
  derivationGoal: z.literal("Map 2020 and 2024 presidential general-election returns to current TIGER2025/CD119 House-district boundaries"),
  scopeStatement: z.literal("Planning only; this artifact is not modeled results or certification."),
  targetBoundaryVintage: z.literal("TIGER2025/CD119"),
  generatedDate: date,
  reviewDate: date,
  nationwideCitations: z.array(citationSchema).length(5),
  rows: z.array(feasibilityRowSchema).length(102),
});

export type FeasibilityMatrix = Readonly<z.infer<typeof feasibilityMatrixSchema>>;

const jurisdictions = new Set(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]);
const originalPublisherRoles = new Set(["statewide_original_publisher_landing", "partial_jurisdiction_original_publisher_landing"]);

/** Parses the artifact and enforces Phase 0 planning constraints beyond its JSON shape. */
export function parseFeasibilityMatrix(input: unknown): FeasibilityMatrix {
  const matrix = feasibilityMatrixSchema.parse(input);
  const keys = new Set<string>();
  for (const row of matrix.rows) {
    const key = `${row.jurisdictionCode}-${row.electionCycle}`;
    if (!jurisdictions.has(row.jurisdictionCode) || keys.has(key)) throw new Error(`Invalid or duplicate jurisdiction-cycle: ${key}`);
    keys.add(key);
    const originalCitations = row.resultCitations.filter((citation) => originalPublisherRoles.has(citation.role));
    const derivedAssessment = originalCitations.some((citation) => citation.role === "statewide_original_publisher_landing")
      ? "statewide_landing_identified"
      : originalCitations.some((citation) => citation.role === "partial_jurisdiction_original_publisher_landing")
        ? "partial_only"
        : "not_assessed";
    if (row.originalPublisherAssessment !== derivedAssessment) throw new Error(`Original-publisher assessment must derive from citations: ${key}`);
    if (row.electionCycle === 2020 && (row.originalPublisherAssessment !== "not_assessed" || row.resultCitations.length > 0)) throw new Error(`2020 source assessment must remain unassessed: ${key}`);
    for (const citation of [...row.resultCitations, ...row.geometryCitations]) {
      if (citation.role === "intermediary_source_discovery" && citation.geographicScope !== "not_assessed") throw new Error(`Intermediary cannot establish geographic coverage: ${key}`);
      if (citation.role === "statewide_original_publisher_landing" && citation.geographicScope !== "statewide") throw new Error(`Statewide publisher scope mismatch: ${key}`);
      if (citation.role === "partial_jurisdiction_original_publisher_landing" && citation.geographicScope !== "partial_jurisdiction") throw new Error(`Partial publisher scope mismatch: ${key}`);
      if (!["landing_identified_not_certified_or_download_verified", "reference_only_not_assessed", "certified_file_download_verified"].includes(citation.assessment)) throw new Error(`Citation assessment is required: ${key}`);
    }
    const hasUnassessedGate = [row.geometryStatus, row.nonGeographicOrAbsenteeStatus, row.licenseAssessment, row.allocationMethod, row.reconciliationStatus, row.roundingPolicy, row.expectedModeledCoverage].some((value) => value === "not_assessed");
    if (hasUnassessedGate && row.conservativeFeasibilityClass !== "state_specific_research_required") throw new Error(`Unassessed feasibility gate requires state-specific research: ${key}`);
    if (/census vtd.*(?:equals|is|substitut)/i.test(row.notes)) throw new Error(`Census VTD substitution claim: ${key}`);
  }
  if (keys.size !== 102 || [...jurisdictions].some((code) => !keys.has(`${code}-2020`) || !keys.has(`${code}-2024`))) throw new Error("Matrix must cover every jurisdiction in both cycles");
  return matrix;
}
