import coverage from "../../data/metadata/golden-case-coverage-v1.json";
import acsData from "../../data/source/acs2024/selected-district-observations.json";
import { describe, expect, it } from "vitest";
import { canonicalManifest } from "@/data/canonical-manifest";
import { computeCanonicalDataChecksum, validatePrototypeManifest } from "@/domain/validate-manifest";
import { coherentManifest } from "@/test/fixtures/prototype-manifest";
import { validEvidenceChain } from "./evidence-fixtures";
import { GOLDEN_CASE_KEYS, parseGoldenCaseCoverage } from "./golden-case-coverage";
import { scoringFixtureCatalog } from "./scoring-fixtures";

const ledger = parseGoldenCaseCoverage(coverage);
const canonicalCollections = {
  geographyVersions: canonicalManifest.geographyVersions,
  districtPlans: canonicalManifest.districtPlans,
  seatCycles: canonicalManifest.seatCycles,
  contests: canonicalManifest.contests,
  fecFilingSummaries: canonicalManifest.fecFilingSummaries,
  acsObservations: canonicalManifest.acsObservations.map((row) => ({ id: `${row.geographyVersionId}:${row.variable}` })),
};

describe("golden-case coverage ledger", () => {
  it("has exactly the required cases and validates its canonical references", () => {
    expect(Object.keys(ledger.cases)).toEqual(GOLDEN_CASE_KEYS);
    for (const entry of Object.values(ledger.cases)) for (const reference of entry.references) {
      if (reference.kind === "canonical_record") expect(canonicalCollections[reference.collection].some((row) => row.id === reference.id)).toBe(true);
    }
  });

  it("cross-checks offline fixture references", () => {
    expect(scoringFixtureCatalog.ineligible_delegate.election.voting).toBe(false);
    expect(validEvidenceChain).toHaveLength(6);
  });

  it("cross-checks the retained ACS estimate and MOE", () => {
    const row = acsData.tables[0]!.rows[0]!;
    expect(row).toMatchObject({ GEO_ID: "5001900US0102", B01003_E001: "710301", B01003_M001: "3002" });
  });

  it("keeps unsupported cases documented as gaps", () => {
    for (const key of ["boundary_change", "uncontested_race", "incomplete_precinct_allocation", "missing_sanders_2020"] as const) {
      expect(ledger.cases[key]).toMatchObject({ status: "documented_gap", satisfied: false });
    }
  });

  it("accepts a genuinely coherent synthetic modeled contest", () => {
    const manifest = coherentManifest();
    const contest = manifest.contests[0]!;
    contest.certificationStatus = "modeled";
    contest.allocationMethod = "other";
    contest.allocationCoveragePercent = { kind: "value", value: 100 };
    contest.lineage = { ...contest.lineage, status: "modeled" };
    manifest.electionResults[0]!.lineage = { ...manifest.electionResults[0]!.lineage, status: "modeled" };
    manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
    expect(validatePrototypeManifest(manifest).success).toBe(true);
  });

  it("rejects unapproved references and a satisfied documented gap", () => {
    expect(() => parseGoldenCaseCoverage({ ...coverage, cases: { ...coverage.cases, at_large: { ...coverage.cases.at_large, references: [{ kind: "offline_fixture", module: "src/offline/x.ts", exportName: "x" }] } } })).toThrow("not allowed");
    expect(() => parseGoldenCaseCoverage({ ...coverage, cases: { ...coverage.cases, missing_sanders_2020: { ...coverage.cases.missing_sanders_2020, satisfied: true } } })).toThrow("cannot claim");
  });
});
