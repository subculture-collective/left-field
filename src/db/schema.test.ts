import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "./schema";

describe("database schema", () => {
  it("exports every persisted manifest collection", () => {
    expect(Object.keys(schema)).toEqual(expect.arrayContaining([
      "dataReleases", "sources", "sourceSnapshots", "districtPlans", "geometryArtifacts",
      "geographyVersions", "offices", "people", "officeTerms", "memberships", "seatCycles",
      "contests", "candidacies", "resultOptions", "electionResults", "acsObservations",
      "committees", "committeeRelationships", "fecFilingSummaries", "seatFinanceSummaries",
    ]));
  });

  it("contains PostGIS, release safety, fact-union, and amendment safeguards", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_phase_1.sql"), "utf8");
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS postgis");
    expect(migration).toContain("geometry(MultiPolygon,4326)");
    expect(migration).toContain("USING gist(boundary)");
    expect(migration).toContain("one_published_release");
    expect(migration).toContain("CHECK((votes IS NULL) <> (votes_missing_reason IS NULL))");
    expect(migration).toContain("guard_fec_amendment");
    expect(migration).toContain("FOREIGN KEY(release_id,seat_cycle_id)");
    expect(migration).toContain("UNIQUE NULLS NOT DISTINCT");
    expect(migration).toContain("UNIQUE NULLS NOT DISTINCT(release_id,chamber,state_code,district_code,senate_class)");
    expect(migration).toContain("CHECK(ends_at>starts_at)");
    expect(migration).toContain("CHECK(ends_at IS NULL OR ends_at>starts_at)");
    expect(migration).toContain("CHECK(effective_to IS NULL OR effective_to>effective_from)");
    expect(migration).toContain("CHECK((amendment_number = 0) = (amends_filing_id IS NULL))");
    expect(migration).not.toContain("amends_filing_id IS NULL OR amendment_status='amended'");
    expect(migration).toContain("ST_IsValid(boundary)");
    expect(migration).toContain("CREATE TRIGGER release_manifest_gate BEFORE INSERT OR UPDATE OR DELETE ON release_manifests");
    expect(migration).toContain("manifest writes must never recursively invalidate release_manifests");
    expect(migration).not.toContain("ON release_manifests FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content()");
    expect(migration).toContain("unsupported provenance entity type");
  });

  it("accepts the explicit unavailable contest status", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_phase_1.sql"), "utf8");
    expect(migration).toContain("certification_status IN ('certified','official_unfinalized','unofficial','modeled','unavailable')");
  });
});
