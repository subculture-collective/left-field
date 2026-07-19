import artifact from "../../data/metadata/election-result-feasibility-2020-2024.json";
import { describe, expect, it } from "vitest";
import { feasibilityMatrixSchema, parseFeasibilityMatrix } from "./feasibility-matrix";

const jurisdictions = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

describe("Phase 3 election-result feasibility matrix", () => {
  const matrix = parseFeasibilityMatrix(artifact);

  it("strictly parses the complete 51-jurisdiction, two-cycle artifact", () => {
    expect(feasibilityMatrixSchema.safeParse(artifact).success).toBe(true);
    expect(matrix.rows).toHaveLength(102);
    expect(new Set(matrix.rows.map((row) => `${row.jurisdictionCode}-${row.electionCycle}`)).size).toBe(102);
    expect(new Set(matrix.rows.map((row) => row.jurisdictionCode))).toEqual(new Set(jurisdictions));
    expect(matrix.rows.filter((row) => row.electionCycle === 2020)).toHaveLength(51);
    expect(matrix.rows.filter((row) => row.electionCycle === 2024)).toHaveLength(51);
  });

  it("defines its presidential-general-election planning scope and fixed unknowns", () => {
    expect(matrix.status).toBe("planning_only");
    expect(matrix.contest).toBe("U.S. President general election");
    expect(matrix.derivationGoal).toBe("Map 2020 and 2024 presidential general-election returns to current TIGER2025/CD119 House-district boundaries");
    expect(matrix.scopeStatement).toBe("Planning only; this artifact is not modeled results or certification.");
    expect(matrix.targetBoundaryVintage).toBe("TIGER2025/CD119");
    expect([matrix.generatedDate, matrix.reviewDate]).toEqual(["2026-07-18", "2026-07-18"]);
    for (const row of matrix.rows) {
      expect(row.targetBoundaryVintage).toBe("TIGER2025/CD119");
      expect([row.geometryStatus, row.nonGeographicOrAbsenteeStatus, row.licenseAssessment, row.allocationMethod, row.reconciliationStatus, row.roundingPolicy, row.expectedModeledCoverage]).toEqual(Array(7).fill("not_assessed"));
      expect(row.notes.toLowerCase()).not.toMatch(/census vtd.*(?:equals|is|substitut)/);
      if (row.electionCycle === 2020) expect([row.originalPublisherAssessment, row.resultCitations]).toEqual(["not_assessed", []]);
    }
  });

  it("uses strict, truth-preserving citation objects without bare URL attribution", () => {
    for (const citation of [...matrix.nationwideCitations, ...matrix.rows.flatMap((row) => [...row.resultCitations, ...row.geometryCitations])]) {
      expect(citation).toEqual(expect.objectContaining({
        url: expect.any(String), publisherName: expect.any(String), role: expect.any(String), geographicScope: expect.any(String), assessment: expect.any(String),
      }));
      expect(citation.assessment).toMatch(/not_certified_or_download_verified|reference_only_not_assessed/);
      if (citation.role === "intermediary_source_discovery") expect(citation.geographicScope).toBe("not_assessed");
      if (citation.role === "statewide_original_publisher_landing") expect(citation.geographicScope).toBe("statewide");
      if (citation.role === "partial_jurisdiction_original_publisher_landing") expect(citation.geographicScope).toBe("partial_jurisdiction");
    }
    expect("officialResultLandingUrls" in matrix.rows[0]).toBe(false);
    expect("intermediaryUrls" in matrix.rows[0]).toBe(false);
  });

  it("preserves CA, NY, AZ, OR, HI, and TX attribution limits", () => {
    const row = (code: string) => matrix.rows.find((candidate) => candidate.jurisdictionCode === code && candidate.electionCycle === 2024)!;
    for (const code of ["CA", "AZ", "OR"]) {
      expect(row(code).originalPublisherAssessment).toBe("not_assessed");
      expect(row(code).resultCitations.every((citation) => citation.role === "intermediary_source_discovery")).toBe(true);
    }
    expect(row("NY").originalPublisherAssessment).toBe("partial_only");
    expect(row("NY").resultCitations.map((citation) => citation.role)).toEqual(["partial_jurisdiction_original_publisher_landing", "intermediary_source_discovery"]);
    expect(row("HI").resultCitations).toHaveLength(1);
    expect(row("HI").geometryCitations).toEqual([expect.objectContaining({
      url: "https://elections.hawaii.gov/resources/districts-and-precincts/",
      role: "precinct_reference_only",
      geographicScope: "not_assessed",
      assessment: "reference_only_not_assessed",
    })]);
    expect(row("TX").originalPublisherAssessment).toBe("not_assessed");
    expect(row("TX").resultCitations).toEqual([expect.objectContaining({
      publisherName: "Texas Legislative Council",
      role: "intermediary_source_discovery",
      geographicScope: "not_assessed",
    })]);
  });

  it("attributes Idaho's landing to the Idaho Secretary of State", () => {
    const idaho = matrix.rows.find((row) => row.jurisdictionCode === "ID" && row.electionCycle === 2024)!;
    expect(idaho.originalPublisherAssessment).toBe("statewide_landing_identified");
    expect(idaho.resultCitations).toEqual([expect.objectContaining({
      publisherName: "Idaho Secretary of State",
      role: "statewide_original_publisher_landing",
      geographicScope: "statewide",
    })]);
  });

  it("requires state-specific research while all feasibility gates remain unknown", () => {
    for (const row of matrix.rows) {
      expect(row.conservativeFeasibilityClass).toBe("state_specific_research_required");
    }
  });

  it("rejects optimistic classes even if a result citation is certified while another gate is unassessed", () => {
    const mutated = structuredClone(artifact);
    const row = mutated.rows.find((candidate) => candidate.jurisdictionCode === "AL" && candidate.electionCycle === 2024)!;
    row.resultCitations[0].assessment = "certified_file_download_verified";
    row.conservativeFeasibilityClass = "direct_at_large";
    expect(() => parseFeasibilityMatrix(mutated)).toThrow("Unassessed feasibility gate requires state-specific research: AL-2024");
  });
});
