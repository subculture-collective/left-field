import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as schema from "./schema";
import { contentTableRegistry } from "./catalog-release";

describe("database schema", () => {
  it("exports every persisted manifest collection", () => {
    expect(Object.keys(schema)).toEqual(expect.arrayContaining([
      "dataReleases", "sources", "sourceSnapshots", "districtPlans", "geometryArtifacts",
      "geographyVersions", "offices", "people", "officeTerms", "memberships", "seatCycles",
      "contests", "candidacies", "resultOptions", "electionResults", "acsObservations",
      "committees", "committeeRelationships", "fecFilingSummaries", "seatFinanceSummaries", "mapArtifactReceipts",
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

  it("pins the immutable v1 migrations", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_phase_1.sql"));
    expect(createHash("sha256").update(migration).digest("hex")).toBe("f787611116580a526ee3d4990709b14fe11d0fca78f810409bd6b0b8b7da8164");
    const nationwide = readFileSync(resolve(process.cwd(), "drizzle/0001_phase_1_nationwide.sql"));
    expect(createHash("sha256").update(nationwide).digest("hex")).toBe("542dd1e1d2d922060d060a5fcef93167bdec1271626b78199d96008a7a2f7967");
  });

  it("accepts the explicit unavailable contest status", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_phase_1.sql"), "utf8");
    expect(migration).toContain("certification_status IN ('certified','official_unfinalized','unofficial','modeled','unavailable')");
  });

  it("keeps the nationwide migration additive and declares operational v2 storage", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0001_phase_1_nationwide.sql"), "utf8");
    expect(migration).toContain('DROP CONSTRAINT "release_profile_seats_position_ck"');
    expect(migration).toContain('"schema_version" IN (1,2)');
    expect(migration).toContain('release_manifests_nationwide_identity_uq');
    expect(migration).toContain("result_options_release_id_id_contest_uq");
    expect(migration).toContain("'years'");
    expect(migration).toContain('CREATE TABLE "jurisdictions"');
    expect(migration).toContain('CREATE TABLE "coverage_records"');
    expect(migration).toContain('"scope_key" text NOT NULL');
    expect(migration).toContain('PRIMARY KEY("release_id","domain","scope_key")');
    expect(migration).toContain('FOREIGN KEY ("release_id","domain","scope_key") REFERENCES "public"."coverage_records"');
    expect(migration).toContain('CREATE TABLE "ingest_runs"');
    expect(migration).toContain('CREATE TABLE "stg_identity"');
    expect(migration).toContain('CREATE TABLE "quarantined_records"');
    expect(migration).toContain("guard_nationwide_content");
    expect(migration).not.toContain("CREATE TABLE correction_requests");
    expect(migration).not.toContain("definition jsonb");
    expect(migration).not.toContain("amount jsonb");
    expect(migration).not.toContain("input_snapshot_ids");
    expect(migration).toContain('CREATE TABLE "coverage_missing_reasons"');
    expect(migration).toContain('CREATE TABLE "acs_variable_dependencies"');
    expect(migration).toContain('CREATE TABLE "nationwide_validation_gates"');
    expect(migration).toContain("FOREIGN KEY(release_id,source_id) REFERENCES sources(release_id,id)");
    expect(migration).toContain("ingest identity is immutable");
    expect(migration).toContain("redacted_diagnostic !~* '(address|contributor)'");
    expect(migration).toContain("jurisdictions_house_representation_ck");
    expect(migration).toContain("jurisdictions_senate_representation_ck");
    for (const index of ["seat_cycles_release_year_id_idx", "people_display_name_search_idx", "finance_aggregates_cash_on_hand_sort_idx", "contests_presidential_kind_date_seat_idx", "result_options_presidential_party_contest_idx", "election_results_presidential_votes_idx"]) expect(migration).toContain(index);
    expect(migration).not.toContain("contributor_name");
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(["jurisdictions", "coverageRecords", "coverageMissingReasons", "acsVariableDependencies", "nationwideValidationGates", "ingestRuns", "stgIdentity", "stgTiger", "stgAcs", "stgFec", "stgElections"]));
  });

  it("adds deferred keys once and before their dependent foreign keys", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0001_phase_1_nationwide.sql"), "utf8");
    const assignmentKey = 'ALTER TABLE committee_assignments ADD CONSTRAINT "committee_assignments_release_id_person_id_committee_id_role_effective_from_pk" PRIMARY KEY(release_id,person_id,committee_id,role,effective_from)';
    const provenanceForeignKey = 'ALTER TABLE committee_assignment_provenance ADD CONSTRAINT "committee_assignment_provenance_release_id_person_id_committee_id_role_name_effective_from_snapshot_id_provenance_role_pk" PRIMARY KEY(release_id,person_id,committee_id,role_name,effective_from,snapshot_id,provenance_role)';
    expect(migration.indexOf(assignmentKey)).toBeGreaterThan(-1);
    expect(migration.indexOf(provenanceForeignKey)).toBeGreaterThan(migration.indexOf(assignmentKey));
    expect(migration.match(/ALTER TABLE jurisdictions ADD PRIMARY KEY\(release_id,jurisdiction_code\)/g)).toBeNull();
    expect(migration).toContain('ADD CONSTRAINT "acs_variable_dependencies_release_id_acs_variable_id_dependency_kind_dependency_variable_id_pk" PRIMARY KEY');
  });

  it("keeps the hand-owned nationwide guard, trigger, and index inventories", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0001_phase_1_nationwide.sql"), "utf8");
    for (const fn of ["guard_nationwide_content", "guard_nationwide_operational", "guard_nationwide_validation", "guard_ingest_run"]) expect(migration).toContain(`CREATE FUNCTION ${fn}`);
    for (const table of ["ingest_runs", "stg_identity", "stg_tiger", "stg_acs", "stg_fec", "stg_elections", "quarantined_records"]) expect(migration).toContain(`${table}_operational`);
    expect(contentTableRegistry).toHaveLength(52);
    for (const { name, domains } of contentTableRegistry.filter((entry) => entry.name !== "map_artifact_receipts")) expect(migration).toContain(`['${name}','${domains.join(",")}']`);
    for (const index of ["release_profile_seats_position_idx", "offices_state_chamber_idx", "memberships_term_party_dates_idx", "seat_cycles_year_kind_status_idx", "contests_date_kind_status_idx", "acs_observations_variable_geography_idx", "finance_aggregates_seat_coverage_idx", "funding_category_aggregates_seat_coverage_idx", "funding_organization_aggregates_seat_coverage_idx", "outside_spending_aggregates_seat_coverage_idx", "election_decisions_jurisdiction_year_idx", "map_artifacts_geography_artifact_idx", "ingest_runs_release_source_status_idx", "quarantined_records_run_snapshot_idx", "stg_identity_run_snapshot_idx", "stg_tiger_run_snapshot_idx", "stg_acs_run_snapshot_idx", "stg_fec_run_snapshot_idx", "stg_elections_run_snapshot_idx", "coverage_input_snapshots_snapshot_fk_idx", "biographical_fact_provenance_snapshot_fk_idx", "committee_assignment_provenance_snapshot_fk_idx", "acs_variable_inputs_snapshot_fk_idx", "acs_variable_dependencies_dependency_fk_idx", "finance_aggregate_inputs_committee_fk_idx", "finance_aggregate_inputs_filing_fk_idx", "election_decision_inputs_snapshot_fk_idx", "map_artifact_inputs_snapshot_fk_idx", "snapshot_derivation_inputs_snapshot_fk_idx"]) expect(migration).toContain(index);
  });

  it("keeps the final Drizzle catalog aligned with Task 2 contracts", () => {
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0001_snapshot.json"), "utf8")) as { enums: Record<string, { values: string[] }>; tables: Record<string, { compositePrimaryKeys: Record<string, unknown>; foreignKeys: Record<string, unknown>; checkConstraints: Record<string, { value: string }>; indexes: Record<string, unknown> }> };
    const variables = snapshot.tables["public.acs_variables"]!;
    expect(snapshot.enums["public.missing_reason"]!.values).toContain("license_unavailable");
    expect(variables.checkConstraints.acs_variables_definition_ck!.value).toContain("derived_ratio");
    expect(variables.checkConstraints.acs_variables_definition_ck!.value).not.toContain("='derived'");
    for (const table of Object.values(snapshot.tables)) {
      expect(table.compositePrimaryKeys).toBeDefined();
      expect(table.foreignKeys).toBeDefined();
      expect(table.checkConstraints).toBeDefined();
      expect(table.indexes).toBeDefined();
    }
  });

  it("records Task 3's final migration metadata and hand-owned guards", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0002_ingestion_integrity.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0002_snapshot.json"), "utf8")) as { tables: Record<string, { columns: Record<string, unknown> }> };
    const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0000_phase_1", "0001_phase_1_nationwide", "0002_ingestion_integrity", "0003_steep_kid_colt"]);
    expect(snapshot.tables["public.ingest_runs"]?.columns).toEqual(expect.objectContaining({ snapshot_id: expect.anything(), lease_token: expect.anything(), failure_code: expect.anything() }));
    for (const name of ["guard_ingest_run", "guard_ingest_publication", "data_releases_ingest_publication_guard", "ingest_runs_one_live_identity_uq"]) expect(migration).toContain(name);
  });

  it("records Task 10 receipt, ACL, and lifecycle foundations", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0003_steep_kid_colt.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0003_snapshot.json"), "utf8")) as { tables: Record<string, unknown> };
    expect(snapshot.tables["public.map_artifact_receipts"]).toBeDefined();
    expect(snapshot.tables["public.release_preflight_proofs"]).toBeDefined();
    for (const text of ["maps/{releaseId}/{geographyId}.geojson", "map_artifacts_release_artifact_uq", "dsa_seats_web", "dsa_seats_ingest", "dsa_seats_release_preflight", "dsa_seats_release_operator", "release_preflight_proofs", "SECURITY DEFINER", "issue_release_preflight", "consume_release_preflight", "lifecycle_promote_candidate", "lifecycle_roll_forward", "lifecycle_rollback", "REVOKE CREATE ON SCHEMA public", "SET search_path = pg_catalog, public"]) expect(migration).toContain(text);
    expect(contentTableRegistry).toHaveLength(52);
    expect(contentTableRegistry.findIndex((entry) => entry.name === "map_artifact_receipts")).toBe(contentTableRegistry.findIndex((entry) => entry.name === "map_artifacts") + 1);
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dsa_seats_web,dsa_seats_ingest,dsa_seats_release_operator,dsa_seats_release_preflight");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_map_artifacts WITH(security_barrier=true)");
    expect(migration).toContain("GRANT SELECT ON public.public_map_artifacts TO dsa_seats_web");
    expect(migration).toContain("map_artifact_receipts");
    expect(migration).toContain("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO dsa_seats_migration_owner");
    expect(migration).not.toContain("GRANT dsa_seats_migration_owner TO CURRENT_USER");
  });

  it("statically pins Task 10 publication closure and least-privilege predicates", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0003_steep_kid_colt.sql"), "utf8");
    expect(migration).not.toContain("position('/' in NEW.release_id)=0");
    for (const text of [
      "^[A-Za-z0-9_-]{1,128}$",
      "maps must exactly cover 441 cutoff-active House geographies",
      "assert_task9_publication_ready", "release lacks exact Task 9 publication closure",
      "GRANT INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_ingest", "c.column_name='release_id'", "c.table_name NOT IN('release_preflight_proofs','data_releases')",
      "GRANT USAGE ON SCHEMA public TO dsa_seats_migration_owner,dsa_seats_web,dsa_seats_ingest,dsa_seats_release_preflight,dsa_seats_release_operator",
      "REVOKE ALL ON FUNCTION public.guard_map_artifact_receipt()", "same-status release history is immutable",
      "ALTER FUNCTION public.guard_candidate_release_content() SECURITY DEFINER",
      "pg_advisory_xact_lock(hashtext('dsa_seats_release:'||r))",
      "target lacks required v2 manifest, gate, or all-seven stored digests", "cardinality(p_run_ids)<>158",
      "REVOKE CREATE ON SCHEMA public FROM PUBLIC", "guard_ingest_publication() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp",
      "pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))", "assert_preflight_branch",
      "a live preflight proof already exists for this lifecycle state", "candidate content is frozen while a live preflight proof exists",
      "UPDATE public.release_preflight_proofs SET consumed_at=clock_timestamp() WHERE consumed_at IS NULL",
    ]) expect(migration).toContain(text);
  });

  it("installs one hardened lifecycle API and keeps operational reads private", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0003_steep_kid_colt.sql"), "utf8");
    for (const name of ["assert_task9_publication_ready"]) {
      expect(migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`, "g"))).toHaveLength(1);
    }
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.assert_lifecycle_ready\(/g)).toHaveLength(1);
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.lifecycle_rollback\(/g)).toHaveLength(1);
    expect(migration).toContain("lifecycle_promote_candidate(text,text,text,text,text[])");
    expect(migration).toContain("lifecycle_roll_forward(text,text,text,text,text[])");
    expect(migration).toContain("lifecycle_rollback(text,text)");
    expect(migration).toContain("CREATE TABLE public.release_preflight_proofs");
    expect(migration).toContain("expires_at<=issued_at+interval '5 minutes'");
    expect(migration).toContain("consumed_at=clock_timestamp()");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.guard_map_artifact_receipt()");
  });

  it("keeps Task 10 in migration 0003 only", () => {
    const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0000_phase_1", "0001_phase_1_nationwide", "0002_ingestion_integrity", "0003_steep_kid_colt"]);
    expect(() => readFileSync(resolve(process.cwd(), "drizzle/0004_task10_oracle_hardening.sql"))).toThrow();
  });
});
