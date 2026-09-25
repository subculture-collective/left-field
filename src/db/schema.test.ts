import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
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
    for (const [file, digest] of Object.entries({
      "0002_ingestion_integrity.sql": "a405ddf92045f1f227bc2b3eff6e9e9dc844bcf2e65f3a1b1b779f250b9a4697",
      "0003_steep_kid_colt.sql": "cede2fd4c5fd0cf2da02a5213446f68bf7a2ef4768c5c6a8ec3d2aa8df36a583",
      "0004_large_johnny_storm.sql": "41dfabccc60cddd7bdb84e78b963b66dbb153e3cf190ce64c277319802cd52be",
      "0005_petite_black_bolt.sql": "7427e0a9523082e0b608d8083f3e0c395fe6320c280ddf7c26723c7b76302f1d",
      "0006_launch_data_proofs.sql": "eb7193c794294aadfd7c73f87a8f1977b7190615d9a7243fd18cfe76805fb77c",
      "0007_parallel_scrambler.sql": "9687e3cfda598b1635f170b1b48942a7cbc9ab7e6289d15a16f5143453db7277",
      "0008_hot_living_tribunal.sql": "f95603d17eff5c94de95c46c6fc50d898ccab8a65e7fe87a060397df8c3b2318",
      "0009_ledger_identity_transcript.sql": "c4b310b7df0d4f8a5f6022325402730ca53a1abce47e39434a00f053c6b32704",
    })) expect(createHash("sha256").update(readFileSync(resolve(process.cwd(), `drizzle/${file}`))).digest("hex")).toBe(digest);
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
    const historicalNationwideTables = contentTableRegistry.filter((entry) => !["map_artifact_receipts", "finance_proof_routes", "finance_launch_receipts", "finance_deletion_attestations", "finance_candidate_mappings", "finance_committee_mappings", "finance_page_closures", "finance_amendment_closures", "vacancy_reviews", "finance_terminal_dispositions", "finance_coverage_closures", "election_launch_receipts", "election_inventory_rows", "election_geometry_attestations", "election_authority_artifacts", "election_result_envelopes", "election_result_rows", "election_result_receipt_lineage", ...contentTableRegistry.filter((entry) => entry.name.startsWith("fec_v2_")).map((entry) => entry.name)].includes(entry.name));
    expect(historicalNationwideTables.map((entry) => entry.name)).toContain("coverage_records");
    // Launch receipt evidence was introduced later; its invalidators live in
    // 0006 rather than rewriting the immutable nationwide migration.
    for (const { name, domains } of historicalNationwideTables) expect(migration).toContain(`['${name}','${domains.join(",")}']`);
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
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0000_phase_1", "0001_phase_1_nationwide", "0002_ingestion_integrity", "0003_steep_kid_colt", "0004_large_johnny_storm", "0005_petite_black_bolt", "0006_launch_data_proofs", "0007_parallel_scrambler", "0008_hot_living_tribunal", "0009_ledger_identity_transcript", "0010_lyrical_silver_samurai", "0011_fec_v2_plan_expectation", "0012_factual_release_stages", "0013_nationwide_finalizer_role", "0014_acs_inheritance_proof", "0015_correction_reviewer_exclusivity", "0016_correction_maintenance_exclusivity", "0017_nationwide_office_universe_intake", "0018_office_universe_pilot_readiness", "0019_fec_v2_acquisition_invalidation", "0020_launch_attestation_proof_kinds", "0021_sour_deathstrike"]);
    expect(snapshot.tables["public.ingest_runs"]?.columns).toEqual(expect.objectContaining({ snapshot_id: expect.anything(), lease_token: expect.anything(), failure_code: expect.anything() }));
    for (const name of ["guard_ingest_run", "guard_ingest_publication", "data_releases_ingest_publication_guard", "ingest_runs_one_live_identity_uq"]) expect(migration).toContain(name);
  });

  it("records Task 10 receipt, ACL, and lifecycle foundations", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0003_steep_kid_colt.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0003_snapshot.json"), "utf8")) as { tables: Record<string, unknown> };
    expect(snapshot.tables["public.map_artifact_receipts"]).toBeDefined();
    expect(snapshot.tables["public.release_preflight_proofs"]).toBeDefined();
    for (const text of ["maps/{releaseId}/{geographyId}.geojson", "map_artifacts_release_artifact_uq", "dsa_seats_web", "dsa_seats_ingest", "dsa_seats_release_preflight", "dsa_seats_release_operator", "release_preflight_proofs", "SECURITY DEFINER", "issue_release_preflight", "consume_release_preflight", "lifecycle_promote_candidate", "lifecycle_roll_forward", "lifecycle_rollback", "REVOKE CREATE ON SCHEMA public", "SET search_path = pg_catalog, public"]) expect(migration).toContain(text);
    const historicalTask10Tables = contentTableRegistry.filter((entry) => ![...contentTableRegistry.filter((item) => item.name.startsWith("fec_v2_")).map((item) => item.name)].includes(entry.name));
    expect(historicalTask10Tables.map((entry) => entry.name)).toContain("map_artifact_receipts");
    expect(historicalTask10Tables.findIndex((entry) => entry.name === "map_artifact_receipts")).toBe(historicalTask10Tables.findIndex((entry) => entry.name === "map_artifacts") + 1);
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
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0000_phase_1", "0001_phase_1_nationwide", "0002_ingestion_integrity", "0003_steep_kid_colt", "0004_large_johnny_storm", "0005_petite_black_bolt", "0006_launch_data_proofs", "0007_parallel_scrambler", "0008_hot_living_tribunal", "0009_ledger_identity_transcript", "0010_lyrical_silver_samurai", "0011_fec_v2_plan_expectation", "0012_factual_release_stages", "0013_nationwide_finalizer_role", "0014_acs_inheritance_proof", "0015_correction_reviewer_exclusivity", "0016_correction_maintenance_exclusivity", "0017_nationwide_office_universe_intake", "0018_office_universe_pilot_readiness", "0019_fec_v2_acquisition_invalidation", "0020_launch_attestation_proof_kinds", "0021_sour_deathstrike"]);
    expect(() => readFileSync(resolve(process.cwd(), "drizzle/0004_task10_oracle_hardening.sql"))).toThrow();
  });

  it("isolates Task 11 correction controls from immutable release content", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0004_large_johnny_storm.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0004_snapshot.json"), "utf8")) as { prevId: string; tables: Record<string, { isRLSEnabled?: boolean }> };
    const prior = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0003_snapshot.json"), "utf8")) as { id: string };
    const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toEqual(["0000_phase_1", "0001_phase_1_nationwide", "0002_ingestion_integrity", "0003_steep_kid_colt", "0004_large_johnny_storm", "0005_petite_black_bolt", "0006_launch_data_proofs", "0007_parallel_scrambler", "0008_hot_living_tribunal", "0009_ledger_identity_transcript", "0010_lyrical_silver_samurai", "0011_fec_v2_plan_expectation", "0012_factual_release_stages", "0013_nationwide_finalizer_role", "0014_acs_inheritance_proof", "0015_correction_reviewer_exclusivity", "0016_correction_maintenance_exclusivity", "0017_nationwide_office_universe_intake", "0018_office_universe_pilot_readiness", "0019_fec_v2_acquisition_invalidation", "0020_launch_attestation_proof_kinds", "0021_sour_deathstrike"]);
    for (const table of ["correction_submissions", "correction_review_events", "correction_idempotency_keys", "correction_rate_limit_buckets"]) expect(snapshot.tables[`operations.${table}`]).toBeDefined();
    expect(snapshot.prevId).toBe(prior.id);
    for (const table of ["correction_submissions", "correction_review_events", "correction_idempotency_keys", "correction_rate_limit_buckets"]) expect(snapshot.tables[`operations.${table}`]!.isRLSEnabled).toBe(true);
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(["operations", "correctionSubmissions", "correctionReviewEvents", "correctionIdempotencyKeys", "correctionRateLimitBuckets"]));
    expect(contentTableRegistry.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(["correction_submissions", "correction_review_events"]));
    for (const text of ["operations.consume_correction_attempt_v1", "operations.submit_correction_v1", "operations.transition_correction_v1", "operations.cleanup_correction_controls_v1", "SECURITY DEFINER", "ENABLE ROW LEVEL SECURITY", "dsa_seats_correction_intake", "dsa_seats_correction_reviewer", "dsa_seats_correction_maintenance", "correction records are immutable", "target_unavailable", "idempotency_conflict"]) expect(migration).toContain(text);
  });

  it("hardens Task 11 correction functions and contracts", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0004_large_johnny_storm.sql"), "utf8");
    const fields = "'identity.current_holder','identity.party','identity.occupancy','biography.bioguide_id','biography.birth_date','biography.other','elections','finance','demographics','district_boundary','sources','other'";
    expect(migration).toContain(fields);
    expect(migration).not.toContain("'seat_cycle','office','person','membership','contest','result','finance','acs','map'");
    for (const fn of ["forbid_correction_mutation", "submit_correction_v1", "transition_correction_v1", "cleanup_correction_controls_v1"]) {
      expect(migration).toMatch(new RegExp(`FUNCTION operations\\.${fn}[\\s\\S]*?search_path=pg_catalog,operations(?:,public)?,pg_temp`));
    }
    for (const role of ["dsa_seats_correction_intake", "dsa_seats_correction_reviewer", "dsa_seats_correction_maintenance"]) expect(migration).toContain(`pg_has_role(session_user,'${role}','member')`);
    expect(migration).toContain("DELETE FROM operations.correction_idempotency_keys WHERE key_hash=p_key_hash AND expires_at<=now_at");
    expect(migration).toContain("replace(p_explanation,E'\\r\\n',E'\\n')");
    expect(migration).toContain("digest(jsonb_build_object");
    expect(migration).toContain("usage_status='approved'");
    expect(migration).toContain("p_candidate_release_id IS DISTINCT FROM latest.candidate_release_id");
    expect(migration).toContain("WHERE NOT r.id=ANY(l.path)");
  });

  it("keeps correction review exclusive as later capability roles are added", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0015_correction_reviewer_exclusivity.sql"), "utf8");
    for (const text of [
      "assert_exclusive_correction_reviewer_v1",
      "transition_correction_legacy_v1",
      "list_corrections_legacy_v1",
      "rolsuper OR rolinherit IS FALSE OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls",
    ]) expect(migration).toContain(text);
    expect(migration).toContain("r.rolname LIKE 'dsa_seats_%'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION operations.transition_correction_v1");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION operations.list_corrections_v1");
  });

  it("keeps correction maintenance exclusive as later capability roles are added", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0016_correction_maintenance_exclusivity.sql"), "utf8");
    for (const text of [
      "assert_exclusive_correction_maintenance_v1",
      "cleanup_correction_controls_legacy_v1",
      "cleanup_correction_controls_v1",
      "rolbypassrls",
      "r.rolname LIKE 'dsa_seats_%'",
      "r.rolname<>'dsa_seats_correction_maintenance'",
      "exclusive correction maintenance capability required",
    ]) expect(migration).toContain(text);
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION operations.cleanup_correction_controls_v1()");
    expect(migration).toContain("TO dsa_seats_correction_maintenance");
  });

  it("adds nationwide state/local intake in an isolated additive schema", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0017_nationwide_office_universe_intake.sql"), "utf8");
    expect(migration).toContain("CREATE SCHEMA office_universe");
    for (const table of ["source_registrations", "raw_payloads", "intake_issues", "jurisdictions", "governing_bodies", "offices", "terms", "holder_observations", "contests", "result_observations", "fact_observations", "formula_programs", "calculation_runs", "coverage"]) expect(migration).toContain(`office_universe.${table}`);
    expect(migration).not.toContain("REFERENCES public.");
    expect(migration).not.toContain("REFERENCES data_releases");
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(["officeUniverse", "universeSourceRegistrations", "universeRawPayloads", "universeCoverage"]));
  });

  it("persists reviewed-source provenance and pilot run state as append-only office_universe data", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0018_office_universe_pilot_readiness.sql"), "utf8");
    const parity: ReadonlyArray<readonly [string, PgTable]> = [["source_definitions", schema.universeSourceDefinitions], ["retained_object_receipts", schema.universeRetainedObjectReceipts], ["intake_runs", schema.universeIntakeRuns], ["intake_snapshots", schema.universeIntakeSnapshots], ["snapshot_issues", schema.universeSnapshotIssues]];
    const tableList = parity.map(([table]) => `office_universe.${table}`).join(",");
    for (const [table, drizzleTable] of parity) {
      const ddl = migration.match(new RegExp(`CREATE TABLE office_universe\\.${table} \\((.*)\\);`))?.[1];
      expect(migration).toContain(`CREATE TABLE office_universe.${table}`);
      expect(ddl).toBeDefined();
      const sqlColumns = [...ddl!.matchAll(/(?:^|, )([a-z_0-9]+) (?:text|jsonb|integer|bigint|boolean|timestamptz)\b/g)].map((match) => match[1]);
      expect(Object.values(getTableColumns(drizzleTable)).map((column) => column.name).sort()).toEqual([...sqlColumns].sort());
    }
    expect(migration).toContain("REFERENCES office_universe.source_definitions(id)");
    expect(migration).toContain("REFERENCES office_universe.retained_object_receipts(id)");
    expect(migration).toContain("REFERENCES office_universe.intake_runs(id)");
    expect(migration).toContain("REFERENCES office_universe.intake_snapshots(id)");
    expect(migration.match(/REFERENCES\s+([a-z_.]+)/g)?.every((edge) => edge.startsWith("REFERENCES office_universe."))).toBe(true);
    expect(migration).not.toMatch(/REFERENCES\s+(public\.|offices|seat_cycles)/);
    expect(migration).not.toMatch(/raw_payloads[^\n]*REFERENCES/);
    expect(migration).toContain("CHECK(status IN ('running','succeeded','failed','cancelled'))");
    expect(migration).toContain("CHECK(disposition IN ('accepted','accepted_with_row_quarantine','quarantined'))");
    expect(migration).toContain("CHECK(privacy_policy IN ('public_office_only','finance_allowlist'))");
    expect(migration).toContain("CHECK(status IN ('draft','reviewed','rejected','retired'))");
    expect(migration).toContain("CHECK(sha256 ~ '^[a-f0-9]{64}$')");
    expect(migration).toContain("CHECK(source_url ~ '^https://')");
    expect(migration).toContain(`GRANT SELECT,INSERT ON ${tableList} TO dsa_seats_ingest;`);
    expect(migration).toContain(`REVOKE UPDATE,DELETE ON ${tableList} FROM dsa_seats_ingest;`);
    expect(migration).toContain(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${tableList} TO dsa_seats_migration_owner;`);
    expect(migration).not.toMatch(/GRANT[^\n]*(UPDATE|DELETE|ALL)[^\n]*TO[^\n]*dsa_seats_ingest/);
    expect(readFileSync(resolve(process.cwd(), "drizzle/0017_nationwide_office_universe_intake.sql"), "utf8")).not.toContain("0018");
  });

  it("isolates Task 12 address admission state and grants only current published reads", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0005_petite_black_bolt.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0005_snapshot.json"), "utf8")) as { tables: Record<string, { isRLSEnabled?: boolean }> };
    for (const table of ["address_quota_buckets", "address_canary_nonces"]) expect(snapshot.tables[`operations.${table}`]?.isRLSEnabled).toBe(true);
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(["addressQuotaBuckets", "addressCanaryNonces"]));
    expect(contentTableRegistry.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(["address_quota_buckets", "address_canary_nonces"]));
    for (const text of ["dsa_seats_address_lookup", "dsa_seats_address_maintenance", "consume_address_metadata_attempt_v1", "consume_address_lookup_v1", "consume_address_canary_v1", "cleanup_address_admission_v1", "SECURITY DEFINER", "pg_advisory_xact_lock", "LIMIT 1000", "status='published'"]) expect(migration).toContain(text);
    expect(migration).toContain("GRANT SELECT ON public.data_releases,public.geography_versions,public.release_profile_seats,public.seat_cycles,public.offices,public.office_terms,public.jurisdictions TO dsa_seats_address_lookup");
  });

  it("consolidates each Task 11 function definition exactly once", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0004_large_johnny_storm.sql"), "utf8");
    for (const name of ["canonical_correction_source_url", "submit_correction_v1", "transition_correction_v1", "list_corrections_v1", "cleanup_correction_controls_v1", "forbid_correction_mutation"]) {
      expect(migration.match(new RegExp(`CREATE OR REPLACE FUNCTION operations\\.${name}\\(`, "g"))).toHaveLength(1);
    }
  });

  it("adds normalized launch content with schema-only safeguards", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0006_launch_data_proofs.sql"), "utf8");
    for (const table of ["finance_launch_receipts", "finance_deletion_attestations", "finance_candidate_mappings", "finance_committee_mappings", "finance_page_closures", "finance_amendment_closures", "vacancy_reviews", "finance_terminal_dispositions", "finance_coverage_closures", "election_launch_receipts", "election_inventory_rows", "election_geometry_attestations", "election_authority_artifacts", "election_result_envelopes", "election_result_rows", "election_result_receipt_lineage", "reviewer_signatures", "finance_publication_proofs", "election_publication_proofs"]) expect(migration).toContain(`"${table}"`);
    expect(migration).toContain("CREATE TABLE public.release_launch_verifier_attestations");
    expect(migration).toContain("guard_launch_operational_evidence()");
    expect(migration).not.toContain("EXECUTE FUNCTION public.guard_nationwide_operational()',t,t");
    expect(migration).toContain("operational_evidence_fingerprint text NOT NULL");
    expect(migration).toContain("operational_evidence_fingerprint ~ '^[a-f0-9]{64}$'");
    for (const contract of ["dsa_seats_launch_verifier", "issue_launch_verifier_attestation", "launch_attestation_id", "production launch preflight requires live verifier attestation", "invalid or expired launch verifier attestation"]) expect(migration).toContain(contract);
    expect(migration).toContain("jsonb_build_object('table','reviewer_signatures'");
    expect(migration).toContain('COLLATE \"C\"');
    expect(migration).toContain("guard_nationwide_content(''elections'')");
    expect(migration).toContain("guard_live_preflight_content()");
    expect(migration).toContain("OWNER TO dsa_seats_migration_owner");
    expect(migration).toContain("ALTER TABLE \"finance_launch_receipts\" ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain('"finance_aggregates" DROP CONSTRAINT');
    for (const contract of ["acquisition_batch", "request_sha256", "response_sha256", "cursor_in", "cursor_out", "terminal_page", "campaign_cycle", "candidacy_key", "expected_terminal_page", "actual_terminal_page", "expected_terminal_amendment", "actual_terminal_amendment", "boundary_kind", "inventory_receipt_id", "decision_run_id", "first_failed_gate", "reconciliation_status", "allocation_coverage_percent", "election_result_envelopes_release_id_inventory_row_id_election_inventory_rows_release_id_id_fk", "finance_candidate_mappings_release_id_receipt_id_finance_launch_receipts_release_id_id_fk", "election_geometry_attestations_release_id_receipt_id_election_launch_receipts_release_id_id_fk", "finance_coverage_closures_release_id_seat_cycle_id_kind_pk", "no_declared_cycle", "modeled_current", "unavailable' AND \"election_result_envelopes\".\"first_failed_gate\" IS NOT NULL", "GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_ingest", "GRANT SELECT ON public.%I TO dsa_seats_release_preflight", "REVOKE ALL ON public.%I FROM dsa_seats_web"]) expect(migration).toContain(contract);
    expect(contentTableRegistry.map((entry) => entry.name)).toEqual(expect.arrayContaining(["finance_launch_receipts", "finance_coverage_closures", "election_launch_receipts", "election_result_receipt_lineage"]));
    expect(contentTableRegistry.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(["reviewer_signatures", "finance_publication_proofs", "election_publication_proofs"]));
  });

  it("adds isolated receipt-cutoff FEC v2 foundation and hardened seals", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0007_parallel_scrambler.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0007_snapshot.json"), "utf8")) as { tables: Record<string, { checkConstraints: Record<string, { value: string }> }> };
    for (const table of ["finance_proof_routes", "fec_v2_plans", "fec_v2_snapshot_metadata", "fec_v2_artifact_receipts", "fec_v2_enumeration_pages", "fec_v2_filing_ledgers", "fec_v2_exact_election_aggregates", "fec_v2_data_review_signatures", "fec_v2_publication_signatures", "fec_v2_publication_proofs"]) expect(migration).toContain(`"${table}"`);
    for (const contract of ["f2pt_union_ck", "f2ar_ck", "fec_v2_seat_coverage_outcome_ck", "seal_fec_v2_snapshot", "seal_fec_v2_plan", "FORCE ROW LEVEL SECURITY", "dsa_seats_migration_owner"]) expect(migration).toContain(contract);
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(["fecV2Plans", "fecV2PlanTargets", "fecV2ArtifactReceipts", "fecV2ExactElectionAggregates"]));
    expect(contentTableRegistry.map((entry) => entry.name)).toEqual(expect.arrayContaining(["fec_v2_plans", "fec_v2_snapshot_metadata", "fec_v2_artifact_receipts", "fec_v2_data_review_signatures"]));
    expect(contentTableRegistry.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(["fec_v2_runs", "fec_v2_run_failures", "fec_v2_publication_signatures", "fec_v2_publication_proofs"]));
    expect(migration).toMatch(/ALTER TABLE "fec_v2_plans" ADD CONSTRAINT "f2p_origin_release_ck" CHECK \(length\("origin_release_id"\)>0\)/);
    expect(snapshot.tables["public.release_launch_verifier_attestations"]!.checkConstraints.release_launch_verifier_attestations_kind_ck!.value).toBe('"release_launch_verifier_attestations"."proof_kind" IN (\'finance\',\'election\',\'maps\',\'fec_v2_finance\',\'fec_v2_election\',\'fec_v2_maps\')');
  });

  it("makes the V2 seal and lineage contracts fail closed", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0007_parallel_scrambler.sql"), "utf8");
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.seal_fec_v2_snapshot/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migration).toContain("release_profile_seats WHERE release_id=p_release_id");
    expect(migration).toContain("count(*) FROM public.fec_v2_plan_targets");
    expect(migration).toContain("<>541");
    expect(migration).toContain("string_agg(to_json(seat_cycle_id)::text,',' ORDER BY seat_cycle_id COLLATE \"C\")");
    for (const contract of ["f2ar_metadata_fk", "f2ar_identity_fk", "f2cir_closure_fk", "f2cis_snapshot_fk", "f2acl_predecessor_fk", "f2sf_entry_fk", "f2as_exact_filing_fk", "guard_fec_v2_sealed", "BEFORE INSERT OR UPDATE OR DELETE", '\"key_id\" text NOT NULL', "f2pp_signature_fk"]) expect(migration).toContain(contract);
    expect(migration).not.toContain("'publication') AND subject_sha256");
  });

  it("restores Phase 2A migration-owned integrity, routing, and least privilege", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0007_parallel_scrambler.sql"), "utf8");
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.seal_fec_v2_plan/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.seal_fec_v2_snapshot/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migration).toContain("YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"");
    expect(migration).toContain("ORDER BY receipt_id COLLATE \"C\"");
    expect(migration).toContain("p.plan_sha256<>p_trusted_plan_sha256");
    expect(migration).toContain("EXCEPT SELECT seat_cycle_id FROM public.release_profile_seats");
    expect(migration).toContain("sealed FEC v2 plan is immutable");
    expect(migration).toContain("sealed FEC v2 receipt membership/identity is immutable");
    expect(migration).toContain("guard_live_preflight_content()");
    expect(migration).toContain("V2 route requires sealed plan");
    expect(migration).toContain("fec_v2_exact_election_aggregates");
    expect(migration).toContain("d.previous_release_id IS NOT NULL");
    expect(migration).toContain("d.status IS NOT DISTINCT FROM 'candidate'");
    for (const [column, value] of [["plan_sha256", "new_plan"], ["seat_cycle_id", "new_data->>'seat_cycle_id'"], ["candidate_mapping_id", "new_data->>'candidate_mapping_id'"], ["election_mapping_id", "new_data->>'election_mapping_id'"], ["closure_id", "new_data->>'closure_id'"], ["support_cents", "(new_data->>'support_cents')::bigint"], ["oppose_cents", "(new_data->>'oppose_cents')::bigint"], ["methodology", "new_data->>'methodology'"], ["coverage_through", "(new_data->>'coverage_through')::date"]]) expect(migration).toContain(`s.${column} IS NOT DISTINCT FROM ${value}`);
    expect(migration).not.toContain("GRANT dsa_seats_fec_v2_publisher TO dsa_seats_migration_owner");
    expect(migration).toContain("receipt_cutoff=DATE '2026-07-18'");
    expect(migration).toContain("aggregate requires coherent complete finalized closure");
    expect(migration).toContain("dsa_seats_fec_v2_data_reviewer");
    expect(migration).toContain("data/publication signer separation or binding failure");
    expect(migration).toContain("publication/data signer separation or binding failure");
    expect(migration).toContain("publication proof canonical hash must equal signature subject hash");
    expect(migration).not.toContain("GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_ingest");
    expect(migration).toContain("data_releases_fec_v2_publication_guard");
    expect(migration).toContain("guard_fec_v2_publication_lifecycle");
    // Historical Phase 2A fail-closed text may remain, but it cannot be the
    // effective (last) publication API definition.
    const finalPublicationSignature = migration.slice(migration.lastIndexOf("CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature"));
    expect(finalPublicationSignature).not.toContain("FEC_V2_PUBLICATION_PAYLOAD_NOT_IMPLEMENTED");
    expect(migration).toContain("lock_fec_v2_releases");
    expect(migration).toContain('p_old_release COLLATE "C" < p_new_release COLLATE "C"');
    expect(migration).toContain("create_fec_v2_source_snapshot");
    expect(migration).toContain("only FEC v2 acquisition may create source snapshots");
    expect(migration).toContain("name='fec' AND authority='official' AND homepage_url='https://api.open.fec.gov'");
    expect(migration).toContain("'fec-receipt-cutoff-v2','public','restricted'");
    expect(migration).toContain("sealed FEC v2 source snapshot is immutable");
    for (const index of ["f2cm_contest_seat_fk_idx", "f2ea_candidate_fk_idx", "f2ea_coverage_fk_idx"]) expect(migration).toContain(index);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.fec_v2_target_universe_bytes(text,text),public.fec_v2_plan_bytes(text,text) FROM PUBLIC");
  });

  it("uses executable DDL, compact canonical bytes, and trusted fixed-path APIs", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0007_parallel_scrambler.sql"), "utf8");
    // Strip comments so a prose mention cannot satisfy these DDL assertions.
    const sql = migration.replace(/--[^\n]*/g, "");
    expect(sql).toMatch(/ALTER TABLE "fec_v2_artifact_receipts" ADD CONSTRAINT "f2ar_metadata_fk" FOREIGN KEY/);
    expect(sql).toMatch(/ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "f2ea_election_fk" FOREIGN KEY/);
    expect(sql).toContain("LOCK TABLE public.fec_v2_artifact_receipts IN SHARE ROW EXCLUSIVE MODE");
    expect(sql).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    expect(sql).toContain("assert_fec_v2_publication_route");
    expect(sql).toContain("import_fec_v2_data_signature");
    expect(sql).toContain("import_fec_v2_publication_signature");
    expect(sql).toContain("finalize_fec_v2_exact_election_aggregate");
    expect(sql).toContain("REVOKE ALL ON public.%I FROM PUBLIC");
    for (const table of contentTableRegistry.filter(({ name }) => name.startsWith("fec_v2_") || name === "finance_proof_routes").filter(({ name }) => !["fec_v2_runs", "fec_v2_run_failures", "fec_v2_run_snapshots", "fec_v2_publication_signatures", "fec_v2_publication_proofs", "fec_v2_acquisition_outcomes", "fec_v2_acquisition_receipts", "fec_v2_acquisition_seals", "fec_v2_replay_attestations"].includes(name))) {
      expect(sql).toContain(`'${table.name}'`);
    }
    expect(sql).toContain("EXECUTE FUNCTION public.guard_nationwide_content(''finance'')");
  });

  it("pins the final Phase 2B publication boundary rather than historical overwritten definitions", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0007_parallel_scrambler.sql"), "utf8");
    const final = (name: string) => migration.slice(migration.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}`));
    const publication = final("import_fec_v2_publication_signature");
    expect(publication).toContain("publication signature must follow plan, finalizations, and reviews");
    expect(publication).toContain("release_id=p_release");
    expect(final("assert_fec_v2_publication_route")).toContain("(SELECT count(*) FROM public.fec_v2_publication_proofs WHERE release_id=p_release)<>1");
    const fingerprint = final("operational_evidence_fingerprint");
    for (const field of ["fec_v2_data_review_signatures", "fec_v2_publication_signatures", "fec_v2_publication_proofs", "public_key_fingerprint"]) expect(fingerprint).toContain(field);
    expect(migration).toContain("fec_v2_live_publication_signatures");
    expect(migration).toContain("fec_v2_publication_proof_append_only");
    expect(migration).toContain("GRANT SELECT ON public.fec_v2_plans,public.fec_v2_plan_targets");
    const attestation = final("issue_launch_verifier_attestation");
    expect(attestation).toContain('"electionCanonicalSha256":');
    expect(attestation).toContain("replace(p_kind,'fec_v2_','')");
    expect(attestation).toContain("'fec_v2_finance','fec_v2_election','fec_v2_maps'");
  });

  it("records the Phase 3 forward-only run descriptors and clone-stable identities", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0008_hot_living_tribunal.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0008_snapshot.json"), "utf8")) as { prevId: string; tables: Record<string, { columns: Record<string, unknown> }> };
    expect(snapshot.prevId).toBe(JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0007_snapshot.json"), "utf8")).id);
    for (const table of ["fec_v2_run_receipts", "fec_v2_run_closure_candidates"]) expect(snapshot.tables[`public.${table}`]).toBeDefined();
    expect(snapshot.tables["public.fec_v2_filing_ledger_entries"]!.columns).toHaveProperty("entry_identity_sha256");
    expect(snapshot.tables["public.fec_v2_page_lineage"]!.columns).toHaveProperty("occurrence_index");
    expect(contentTableRegistry.map(({ name }) => name)).toEqual(expect.arrayContaining(["fec_v2_filing_ledger_entries", "fec_v2_page_lineage"]));
    expect(contentTableRegistry.map(({ name }) => name).filter((name) => name.startsWith("fec_v2_run_"))).toEqual([]);
    for (const text of ["f2fl_one_final_stable_uq", "f2rf_run_fk_idx", "f2rr_receipt_fk", "f2rcc_target_fk", "FORCE ROW LEVEL SECURITY", "SECURITY INVOKER", "REVOKE UPDATE ON public.fec_v2_runs FROM dsa_seats_fec_v2_acquisition", "completed or failed FEC v2 run descriptor is immutable", "finalize_fec_v2_run", "base_form_type", "raw_source_availability", "P0008", "ACCESS EXCLUSIVE MODE", "f2pl_page_pass_occurrence_fk_idx"]) expect(migration).toContain(text);
    expect(migration.lastIndexOf("REVOKE UPDATE ON public.fec_v2_runs FROM dsa_seats_fec_v2_acquisition")).toBeGreaterThan(migration.lastIndexOf("GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_fec_v2_acquisition"));
    expect(contentTableRegistry.find(({ name }) => name === "fec_v2_filing_ledger_entries")?.columns).toEqual(["plan_sha256", "ledger_sha256", "file_number", "entry_identity_sha256", "canonical_form_type", "base_form_type", "report_type", "report_date", "receipt_date", "coverage_start", "coverage_end", "amendment_indicator", "filer_id", "committee_id", "electronic_status", "raw_source_availability"]);
    expect(migration).not.toContain("dsa_seats.fec_v2_finalize");
  });

  it("records ledger identity in the 0009 snapshot only", () => {
    const meta = resolve(process.cwd(), "drizzle/meta");
    const snapshot = JSON.parse(readFileSync(resolve(meta, "0009_snapshot.json"), "utf8")) as { prevId: string; tables: Record<string, { columns: Record<string, { notNull: boolean }> }> };
    const prior = JSON.parse(readFileSync(resolve(meta, "0008_snapshot.json"), "utf8")) as { id: string; tables: Record<string, unknown> };
    const journal = JSON.parse(readFileSync(resolve(meta, "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
    expect(snapshot.prevId).toBe(prior.id);
    expect(snapshot.tables["public.fec_v2_sanitized_filings"]!.columns.ledger_identity_sha256).toMatchObject({ notNull: true });
    const inherited = structuredClone(snapshot.tables) as Record<string, { columns?: Record<string, unknown> }>;
    delete inherited["public.fec_v2_sanitized_filings"]!.columns!.ledger_identity_sha256;
    expect(inherited).toEqual(prior.tables);
    expect(journal.entries.filter(({ tag }) => tag === "0009_ledger_identity_transcript")).toHaveLength(1);
    expect(journal.entries.find(({ tag }) => tag === "0009_ledger_identity_transcript")).toMatchObject({ idx: 9, tag: "0009_ledger_identity_transcript" });
    expect(readdirSync(resolve(process.cwd(), "drizzle")).filter((file) => /^00(?:1[1-9]|[2-9]\d)_.*\.sql$/.test(file)).filter((file) => readFileSync(resolve(process.cwd(), "drizzle", file), "utf8").includes("ledger_identity_sha256"))).toEqual([]);
  });

  it("declares the isolated FEC v2 replay staging boundary in regenerated 0010", () => {
    const meta = resolve(process.cwd(), "drizzle/meta");
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(meta, "0010_snapshot.json"), "utf8")) as { prevId: string; tables: Record<string, { columns: Record<string, unknown>; foreignKeys: Record<string, unknown>; uniqueConstraints: Record<string, unknown>; checkConstraints: Record<string, unknown>; isRLSEnabled: boolean }> };
    const prior = JSON.parse(readFileSync(resolve(meta, "0009_snapshot.json"), "utf8")) as { id: string };
    const staged = ["snapshots", "artifacts", "artifact_receipts", "enumeration_pages", "filing_ledgers", "filing_ledger_entries", "page_lineage", "amendment_links", "sanitized_filings", "acquisition_outcomes"];
    expect(snapshot.prevId).toBe(prior.id);
    for (const suffix of staged) {
      const table = snapshot.tables[`public.stg_fec_v2_${suffix}`]!;
      expect(table).toBeDefined();
      expect(table.isRLSEnabled).toBe(true);
      expect(table.foreignKeys).not.toEqual({});
    }
    const receipts = snapshot.tables["public.stg_fec_v2_artifact_receipts"]!;
    expect(receipts.columns).toEqual(expect.objectContaining({ artifact_sha256: expect.anything(), snapshot_id: expect.anything(), object_key: expect.anything(), version_id: expect.anything(), etag: expect.anything(), store_locator: expect.anything() }));
    expect(Object.keys(receipts.foreignKeys)).toEqual(expect.arrayContaining(["sf2ar_artifact_fk", "sf2ar_snapshot_fk"]));
    const entries = snapshot.tables["public.stg_fec_v2_filing_ledger_entries"]!;
    expect(entries.columns).toEqual(expect.objectContaining({ entry_identity_sha256: expect.anything(), raw_source_availability: expect.anything() }));
    expect(Object.keys(entries.uniqueConstraints)).toContain("sf2fle_entry_identity_uq");
    expect(Object.keys(snapshot.tables["public.stg_fec_v2_page_lineage"]!.foreignKeys)).toEqual(expect.arrayContaining(["sf2pl_entry_fk", "sf2pl_page_pass_fk"]));
    expect(Object.keys(snapshot.tables["public.stg_fec_v2_amendment_links"]!.foreignKeys)).toEqual(expect.arrayContaining(["sf2al_entry_fk", "sf2al_predecessor_fk"]));
    for (const [tableName, key] of [["public.stg_fec_v2_page_lineage", "sf2pl_entry_fk"], ["public.stg_fec_v2_amendment_links", "sf2al_entry_fk"]] as const) expect((snapshot.tables[tableName]!.foreignKeys[key] as { columnsFrom: string[]; columnsTo: string[] })).toMatchObject({ columnsFrom: ["release_id", "plan_sha256", "run_id", "ledger_sha256", "file_number", "entry_identity_sha256"], columnsTo: ["release_id", "plan_sha256", "run_id", "ledger_sha256", "file_number", "entry_identity_sha256"] });
    expect(JSON.stringify(snapshot.tables["public.stg_fec_v2_filing_ledgers"]!.checkConstraints.sf2fl_ck)).toContain("finalized_at\\\" IS NOT NULL))");
    for (const tableName of ["public.fec_v2_enumeration_pages", "public.stg_fec_v2_enumeration_pages"]) expect(JSON.stringify(snapshot.tables[tableName]!.checkConstraints)).toContain("BETWEEN 1 AND 9007199254740991");
    const attestations = snapshot.tables["public.fec_v2_replay_attestations"]!;
    expect(Object.keys(attestations.columns).sort()).toEqual(["acquisition_graph_sha256", "consumed_at", "descriptor_sha256", "expires_at", "id", "issued_at", "plan_sha256", "purpose", "release_id", "run_id", "transcript_sha256"]);
    expect(Object.keys(attestations.checkConstraints)).toContain("f2ra_ck");
    expect(JSON.stringify(attestations)).toContain("staged_promotion");
    expect(JSON.stringify(attestations)).toContain("completed_reuse");
    expect(JSON.stringify(attestations)).not.toContain("publication_replay");
    // Completed reuse can bind a cloned seal's origin run without requiring a
    // local operational run in the clone.
    expect(Object.keys(attestations.foreignKeys)).not.toContain("f2ra_run_fk");
    expect(migration).toContain("f2ra_one_live_purpose_run_uq");
    for (const api of ["issue_fec_v2_replay_attestation", "consume_fec_v2_staged_replay_attestation_owner", "consume_fec_v2_completed_reuse_attestation", "fec_v2_completed_acquisition_descriptor_owner", "fec_v2_staged_acquisition_commitment_owner", "guard_fec_v2_replay_attestation", "invalidate_fec_v2_completed_acquisition"]) expect(migration).toContain(`FUNCTION public.${api}`);
    expect(migration).toContain("exact completed reuse commitment required");
    expect(migration).toContain("f2stage_replay_invalidate");
    expect(migration).toContain("sf2s_restricted_ck");
    expect(migration).toContain('("stg_fec_v2_filing_ledgers"."stable"=1)=("stg_fec_v2_filing_ledgers"."finalized_at" IS NOT NULL)');
    expect(migration).not.toContain("publication_replay");
    expect(migration).toContain('"origin_release_id" text NOT NULL');
    expect(migration).toContain('"receipt_set_digest_sha256" text');
    for (const name of ["sf2ar_artifact_fk", "sf2ep_artifact_fk", "sf2fl_artifact_fk", "sf2sf_artifact_fk", "sf2sf_entry_fk", "sf2pl_page_pass_fk"]) expect(migration).toContain(name);
    expect(contentTableRegistry.map(({ name }) => name)).not.toEqual(expect.arrayContaining(["stg_fec_v2_snapshots", "stg_fec_v2_artifacts", "fec_v2_replay_attestations"]));
    expect(migration).not.toContain("release_content_digests_stg_fec_v2");
    const operationalFailureCodes = "'aborted','lease_expired','enumeration_unstable','store_failure','connection_lost','promotion_failed','internal_failure'";
    expect(migration).toContain(operationalFailureCodes);
    expect(JSON.stringify(snapshot.tables["public.fec_v2_run_failures"]!.checkConstraints.f2rf_code_ck)).toContain(operationalFailureCodes);
    for (const code of ["'invalid'", "'internal_error'", "'deadline_exceeded'"]) expect(snapshot.tables["public.fec_v2_run_failures"]!.checkConstraints.f2rf_code_ck).not.toContain(code);
  });

  it("makes 0010's run admission cutover atomic and capability-only", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    expect(migration.indexOf("BEGIN;")).toBeLessThan(migration.indexOf('CREATE TABLE "fec_v2_acquisition_outcomes"'));
    expect(migration).toContain("SET LOCAL lock_timeout = '5s'");
    const locks = ["data_releases", "sources", "source_snapshots", "fec_v2_plans", "fec_v2_plan_targets", "fec_v2_runs", "fec_v2_run_snapshots", "fec_v2_run_failures", "fec_v2_run_receipts", "fec_v2_run_closure_candidates", "fec_v2_snapshot_metadata", "fec_v2_artifacts", "fec_v2_artifact_receipts", "fec_v2_enumeration_pages", "fec_v2_filing_ledgers", "fec_v2_filing_ledger_entries", "fec_v2_page_lineage", "fec_v2_amendment_chain_links", "fec_v2_sanitized_filings", "fec_v2_alternate_scoping", "fec_v2_candidate_mappings", "fec_v2_committee_mappings", "fec_v2_election_mappings", "fec_v2_finance_closures", "fec_v2_closure_input_receipts", "fec_v2_closure_input_snapshots", "fec_v2_seat_coverage", "fec_v2_exact_election_aggregates", "fec_v2_data_review_signatures", "fec_v2_publication_signatures", "fec_v2_publication_proofs", "finance_proof_routes", "release_manifests", "release_content_digests", "nationwide_validation_gates"];
    let previous = -1;
    for (const table of locks) { const position = migration.indexOf(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`); expect(position).toBeGreaterThan(previous); previous = position; }
    expect(migration).toContain("ERRCODE='P0010'");
    for (const role of ["dsa_seats_fec_v2_acquisition", "dsa_seats_fec_v2_replay_verifier", "dsa_seats_fec_v2_invalidator"]) expect(migration).toContain(role);
    for (const api of ["claim_fec_v2_run", "heartbeat_fec_v2_run", "abort_fec_v2_run", "reap_expired_fec_v2_run", "stage_fec_v2_snapshot", "stage_fec_v2_artifact", "stage_fec_v2_receipt", "stage_fec_v2_enumeration_page", "stage_fec_v2_ledger_header", "stage_fec_v2_ledger_entry", "stage_fec_v2_page_lineage", "stage_fec_v2_amendment_link", "stage_fec_v2_sanitized_filing", "stage_fec_v2_acquisition_outcome", "finalize_fec_v2_staged_snapshot", "read_fec_v2_run_status", "read_fec_v2_staged_receipt_descriptors"]) expect(migration).toContain(`FUNCTION public.${api}`);
    expect(migration).not.toMatch(/stage_fec_v2_[^(]+\([^)]*json/i);
    for (const control of ["guard_fec_v2_run_boundary", "guard_fec_v2_stage_terminal", "REVOKE ALL ON FUNCTION public.read_fec_v2_run_status", "ALTER ROLE dsa_seats_fec_v2_replay_verifier NOLOGIN NOINHERIT", "ALTER ROLE dsa_seats_fec_v2_invalidator NOLOGIN NOINHERIT"]) expect(migration).toContain(control);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.finalize_fec_v2_run");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.finalize_fec_v2_staged_snapshot(text,text,text,text,text) TO dsa_seats_fec_v2_acquisition");
    expect(migration.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(migration.match(/\bCOMMIT;/g)).toHaveLength(1);
    expect(() => readFileSync(resolve(process.cwd(), "drizzle/0011_task7a1_security_hardening.sql"))).toThrow();
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("keeps Task 7A.2 canonical staged commitment reads bounded and fixed-path", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const commitment = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.fec_v2_staged_acquisition_commitment_owner"));
    expect(migration).toContain("FUNCTION public.fec_v2_canonical_hash_step");
    expect(migration).toContain("FUNCTION public.read_fec_v2_staged_acquisition_commitment");
    expect(migration).toContain("SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp");
    expect(commitment).not.toContain("string_agg");
    expect(migration).toContain('COLLATE "C"');
    expect(migration).toContain("FEC_V2_GRAPH_INVALID");
    expect(migration).toContain("e.electronic_status<>'paper' AND e.raw_source_availability<>'available' AND o.outcome='source_unavailable'");
    expect(migration).toContain("e.electronic_status<>'paper' AND e.raw_source_availability='available' AND o.outcome IN ('unsupported_layout','malformed_filing')");
    expect(migration).not.toContain("e.electronic_status='unknown' AND o.outcome='source_unavailable'");
    expect(commitment).toContain("fec_v2_canonical_hash_step");
    expect(commitment).toContain("artifactReceiptIds");
    expect(commitment).toContain("acquisitionOutcomes");
    expect(commitment).toContain("operationalFailures");
    expect(commitment).toContain("closureCandidates");
  });

  it("makes staged-to-final acquisition promotion the sole typed, attested boundary", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const promotion = migration.match(/CREATE OR REPLACE FUNCTION public\.promote_fec_v2_acquisition[\s\S]*?END \$\$/)?.[0] ?? "";
    expect(promotion).toContain("(p_release text,p_plan text,p_run text,p_raw_token text,p_expected_graph text,p_expected_descriptor text,p_expected_transcript text)");
    expect(promotion).toContain("assert_fec_v2_live_owner");
    expect(promotion).toContain("consume_fec_v2_staged_replay_attestation_owner");
    expect(promotion).toContain("fec_v2_staged_acquisition_commitment_owner");
    expect(promotion).toContain("accepted_descriptor_sha256=p_expected_descriptor");
    expect(promotion).toContain("status='completed'");
    expect(promotion).toContain("DELETE FROM public.stg_fec_v2_snapshots");
    expect(promotion).toContain("fec_v2_acquisition_seals");
    expect(promotion).toContain("fec_v2_run_snapshots");
    expect(promotion).toContain("fec_v2_run_receipts");
    expect(promotion).toContain("purpose='staged_promotion' AND consumed_at IS NULL");
    expect(promotion).toContain("exact run snapshot and receipt joins required");
    expect(promotion).toContain("receipt_set_digest_sha256");
    expect(promotion).toContain("fec_v2_acquisition_outcomes");
    expect(promotion).toContain("fec_v2_sanitized_filings");
    expect(promotion).not.toContain("completed_reuse");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.promote_fec_v2_acquisition(text,text,text,text,text,text,text) TO dsa_seats_fec_v2_acquisition");
  });

  it("ends 0010 with the hardened acquisition-only run surface", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const final = migration.slice(migration.lastIndexOf("-- These are the effective cutover definitions"));
    expect(final).toContain("PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_owner_token)");
    const outcome = final.match(/CREATE OR REPLACE FUNCTION public\.stage_fec_v2_acquisition_outcome[\s\S]*?END \$\$/)?.[0] ?? "";
    expect(outcome).not.toContain("DECLARE now_at");
    expect(final).toContain("WITH RECURSIVE memberships(role_oid)");
    expect(final).toContain("r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR (r.rolname <> session_user");
    expect(final).toContain("CREATE TRIGGER f2run_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_runs");
    expect(final).toContain("current_user <> 'dsa_seats_migration_owner'");
    expect(final).toContain("exact acquisition claim shape required");
    expect(final).toContain("exact running heartbeat shape required");
    expect(final).toContain("assert_fec_v2_invalidator_admission");
    expect(final).toContain("failure_code='lease_expired' AND scope_sha256=scope AND subject_sha256=subject_hash");
    expect(final).toContain("count(*) FROM public.fec_v2_run_failures");
    expect(final).toContain("r.rolname <> session_user AND r.rolname <> 'dsa_seats_fec_v2_acquisition'");
    for (const role of ["dsa_seats_fec_v2_acquisition", "dsa_seats_fec_v2_replay_verifier", "dsa_seats_fec_v2_invalidator"]) expect(migration).toContain(`ALTER ROLE ${role} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION`);
    expect(final).toContain("public.seal_fec_v2_snapshot(text,text,text),public.seal_fec_v2_plan(text,text),public.fec_v2_target_universe_bytes(text,text),public.fec_v2_plan_bytes(text,text)");
    expect(final).toContain("public.lock_fec_v2_releases(text,text),public.finalize_fec_v2_run(text,text,text,text),public.create_fec_v2_source_snapshot");
    expect(final).toContain("PERFORM public.assert_fec_v2_acquisition_admission();");
    expect(final).toContain("candidate sealed plan required");
    expect(final).not.toContain("store_locator");
    expect(final).toContain("public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) TO dsa_seats_fec_v2_acquisition");
  });

  it("implements sealed completed reuse and invalidation only in effective 0010", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const reuse = migration.slice(migration.lastIndexOf("CREATE OR REPLACE FUNCTION public.consume_fec_v2_completed_reuse_attestation"));
    const invalidation = migration.slice(migration.lastIndexOf("CREATE OR REPLACE FUNCTION public.invalidate_fec_v2_completed_acquisition"));
    expect(reuse).toContain("purpose<>'completed_reuse'");
    expect(reuse).toContain("a.expires_at<now_at");
    expect(reuse).toContain("consumed_at=now_at");
    expect(reuse).toContain("usage_status='restricted'");
    expect(reuse).toContain("sealed_at IS NOT NULL");
    expect(reuse).toContain("p_run IS DISTINCT FROM s.origin_run_id");
    expect(reuse).not.toContain("f2ra_run_fk");
    expect(invalidation).toContain("assert_fec_v2_invalidator_admission()");
    expect(invalidation).toContain("status='invalidated'");
    expect(invalidation).toContain("fec_v2_data_review_signatures");
    expect(invalidation).toContain("fec_v2_acquisition_seals");
    expect(invalidation).toContain("release_content_digests");
    expect(invalidation).toContain("nationwide_validation_gates");
    expect(invalidation).toContain("GRANT EXECUTE ON FUNCTION public.invalidate_fec_v2_completed_acquisition");
    expect(() => readFileSync(resolve(process.cwd(), "drizzle/0011_task7_completed_reuse.sql"))).toThrow();
  });


  it("adds the bounded FEC V2 replay expectation reader in 0011", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0011_fec_v2_plan_expectation.sql"), "utf8");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.read_fec_v2_plan_expectation");
    expect(migration).toContain("PERFORM public.assert_fec_v2_replay_verifier_admission()");
    expect(migration).toContain("d.status='candidate'");
    expect(migration).toContain("p.sealed_at IS NOT NULL");
    expect(migration).toContain('ORDER BY t.seat_cycle_id COLLATE "C"');
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.read_fec_v2_plan_expectation(text,text) FROM PUBLIC");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.read_fec_v2_plan_expectation(text,text) TO dsa_seats_fec_v2_replay_verifier");
    expect(migration).toContain("ALTER FUNCTION public.read_fec_v2_plan_expectation(text,text) OWNER TO dsa_seats_migration_owner");
  });

  it("adds exact member and ACS production launch stages in 0012", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0012_factual_release_stages.sql"), "utf8");
    for (const text of [
      "proof_kind IN('member','acs','finance','election','maps')",
      "assert_factual_launch_stage",
      "target.source_cutoff=predecessor.source_cutoff",
      "factual launch stage cannot contain or inherit launch facts or proofs",
      "ARRAY['identity','geography','finance','elections','maps']",
      "target_member>0 AND predecessor_member=0",
      "target_member>0 AND target_member=predecessor_member",
      "target_acs>0 AND predecessor_acs=0",
      "SELECT content_checksum_sha256 INTO actual_sha",
      "only exclusive launch verifier may attest publication evidence",
    ]) expect(migration).toContain(text);
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.assert_factual_launch_stage(text,text,text) FROM PUBLIC");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)");
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("adds a non-promoting nationwide finalizer capability in 0013", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0013_nationwide_finalizer_role.sql"), "utf8");
    for (const text of [
      "CREATE ROLE dsa_seats_nationwide_finalizer NOLOGIN INHERIT",
      "GRANT dsa_seats_ingest TO dsa_seats_nationwide_finalizer",
      "GRANT SELECT ON TABLE public.%I TO dsa_seats_nationwide_finalizer",
      "CREATE POLICY nationwide_finalizer_fec_read",
      "REVOKE EXECUTE ON FUNCTION public.lifecycle_promote_candidate",
      "REVOKE EXECUTE ON FUNCTION public.issue_release_preflight",
      "REVOKE EXECUTE ON FUNCTION public.issue_launch_verifier_attestation",
    ]) expect(migration).toContain(text);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("proves exact non-ACS inheritance while allowing only the three ACS receipts in 0014", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0014_acs_inheritance_proof.sql"), "utf8");
    for (const text of [
      "CREATE OR REPLACE FUNCTION public.assert_acs_inherited_content",
      "SELECT to_jsonb(t)-'release_id'",
      "domain<>''acs''",
      "count(*)=3",
      "ir.status='loaded'",
      "ir.raw_object_version_id IS NOT NULL",
      "PERFORM public.assert_acs_inherited_content(p_target,p_predecessor)",
      "GRANT EXECUTE ON FUNCTION public.assert_acs_inherited_content",
    ]) expect(migration).toContain(text);
    expect(migration).toContain("'src_acs_2024'");
    expect(migration).toContain("target_member=predecessor_member");
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });
  it("invalidates finance validation for FEC V2 acquisition content in 0019", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0019_fec_v2_acquisition_invalidation.sql"), "utf8");
    for (const table of ["fec_v2_acquisition_outcomes", "fec_v2_acquisition_receipts", "fec_v2_acquisition_seals"]) {
      expect(migration).toContain(`AFTER INSERT OR UPDATE OR DELETE ON public.${table}`);
    }
    expect(migration.match(/guard_nationwide_content\('finance'\)/g)).toHaveLength(3);
    expect(migration).toContain("DELETE FROM public.nationwide_validation_gates");
    expect(migration).toContain("d.domain='finance' AND r.status='candidate'");
    expect(migration).toContain("SET validated_at=NULL");
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
  });

  it("keeps all factual and FEC V2 launch proof kinds in 0020", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0020_launch_attestation_proof_kinds.sql"), "utf8");
    expect(migration).toContain("'member','acs','finance','election','maps','fec_v2_finance','fec_v2_election','fec_v2_maps'");
  });

  it("bounds FEC V2 run ids without exceeding PostgreSQL's repetition limit", () => {
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0021_sour_deathstrike.sql"), "utf8");
    const original = readFileSync(resolve(process.cwd(), "drizzle/0010_lyrical_silver_samurai.sql"), "utf8");
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/0021_snapshot.json"), "utf8")) as { tables: Record<string, { checkConstraints: Record<string, { value: string }> }> };
    const grammar = "^[A-Za-z0-9][A-Za-z0-9._:-]*$";
    const constraint = `length(\"fec_v2_runs\".\"run_id\") BETWEEN 1 AND 512 AND \"fec_v2_runs\".\"run_id\" ~ '${grammar}'`;
    expect(migration).toContain('DROP CONSTRAINT "f2runs_id_ck"');
    expect(migration).toContain(`ADD CONSTRAINT "f2runs_id_ck" CHECK (${constraint})`);
    expect(snapshot.tables["public.fec_v2_runs"]!.checkConstraints.f2runs_id_ck!.value).toContain(constraint);
    const effective = (source: string, name: string) => source.slice(source.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}`)).match(/CREATE OR REPLACE FUNCTION[\s\S]*?END \$\$/)?.[0] ?? "";
    const claim = effective(migration, "claim_fec_v2_run");
    const reaper = effective(migration, "reap_expired_fec_v2_run");
    expect(claim).toContain(`length(p_run) BETWEEN 1 AND 512 AND p_run ~ '${grammar}'`);
    expect(claim).toContain("FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.status IN ('running','completed')");
    expect(reaper).toContain(`length(p_expired_run) BETWEEN 1 AND 512 AND p_expired_run ~ '${grammar}'`);
    expect(reaper).toContain(`length(p_new_run) BETWEEN 1 AND 512 AND p_new_run ~ '${grammar}'`);
    expect(migration).not.toContain("{0,511}");
    const withoutValidation = (definition: string) => definition.split("\n").filter((line) => !line.includes("invalid FEC V2 run id")).join("\n").replace("FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.status", "FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND status");
    expect(withoutValidation(claim)).toBe(withoutValidation(effective(original, "claim_fec_v2_run")));
    expect(withoutValidation(reaper)).toBe(withoutValidation(effective(original, "reap_expired_fec_v2_run")));
    expect(migration).not.toMatch(/(?:DROP|ALTER) FUNCTION|(?:REVOKE|GRANT) /);
  });

});
