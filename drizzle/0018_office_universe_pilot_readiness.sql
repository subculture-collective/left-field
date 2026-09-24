BEGIN;
SET LOCAL lock_timeout = '5s';

-- Pilot readiness: reviewed source provenance and run state as append-only office_universe data.
-- Every foreign key targets office_universe only; nothing here references public release, office, or seat-cycle tables.
-- Retained official bytes stay outside Postgres; receipts only record locator, size, digest, and parser identity.

CREATE TABLE office_universe.source_definitions (id text PRIMARY KEY, state_code text NOT NULL CHECK(state_code ~ '^[A-Z]{2}$'), family text NOT NULL CHECK(family IN ('discovery','elections','finance','geography','officeholders')), source_key text NOT NULL UNIQUE, authority_tier text NOT NULL CHECK(authority_tier IN ('official','aggregator')), authority_scope jsonb NOT NULL CHECK(jsonb_typeof(authority_scope)='array' AND jsonb_array_length(authority_scope)>0), precedence integer NOT NULL CHECK(precedence>0), source_url text NOT NULL CHECK(source_url ~ '^https://'), retention_basis text NOT NULL CHECK(length(retention_basis)>0), allowed_kinds jsonb NOT NULL CHECK(jsonb_typeof(allowed_kinds)='array' AND jsonb_array_length(allowed_kinds)>0), privacy_policy text NOT NULL CHECK(privacy_policy IN ('public_office_only','finance_allowlist')), status text NOT NULL CHECK(status IN ('draft','reviewed','rejected','retired')), reviewed_by text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK((status IN ('reviewed','rejected','retired')) = (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)));
CREATE INDEX ou_source_definitions_state_family_idx ON office_universe.source_definitions(state_code,family,precedence);

-- Immutable: one receipt per retained object; ingest may only append.
CREATE TABLE office_universe.retained_object_receipts (id text PRIMARY KEY, source_definition_id text NOT NULL REFERENCES office_universe.source_definitions(id), locator text NOT NULL CHECK(locator !~ '^/' AND locator !~ '\\' AND locator !~ '(^|/)\.\.?(/|$)'), byte_size bigint NOT NULL CHECK(byte_size>=0), sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), retrieved_at timestamptz NOT NULL, final_url text NOT NULL CHECK(final_url ~ '^https://'), parser_version text NOT NULL CHECK(length(parser_version)>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(source_definition_id,locator,sha256));
CREATE INDEX ou_retained_object_receipts_source_idx ON office_universe.retained_object_receipts(source_definition_id,retrieved_at);

CREATE TABLE office_universe.intake_runs (id text PRIMARY KEY, source_definition_id text NOT NULL REFERENCES office_universe.source_definitions(id), receipt_id text NOT NULL REFERENCES office_universe.retained_object_receipts(id), requested_cutoff timestamptz NOT NULL, status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','failed','cancelled')), started_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz CHECK(finished_at IS NULL OR finished_at>=started_at), CHECK((status='running') = (finished_at IS NULL)));
CREATE INDEX ou_intake_runs_source_cutoff_idx ON office_universe.intake_runs(source_definition_id,requested_cutoff);

CREATE TABLE office_universe.intake_snapshots (id text PRIMARY KEY, run_id text NOT NULL REFERENCES office_universe.intake_runs(id), disposition text NOT NULL CHECK(disposition IN ('accepted','accepted_with_row_quarantine','quarantined')), row_count integer NOT NULL CHECK(row_count>=0), accepted_row_count integer NOT NULL CHECK(accepted_row_count>=0), quarantined_row_count integer NOT NULL CHECK(quarantined_row_count>=0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK(accepted_row_count+quarantined_row_count=row_count), CHECK(disposition<>'quarantined' OR accepted_row_count=0), CHECK(disposition<>'accepted' OR quarantined_row_count=0), UNIQUE(run_id));

CREATE TABLE office_universe.snapshot_issues (id text PRIMARY KEY, snapshot_id text NOT NULL REFERENCES office_universe.intake_snapshots(id), code text NOT NULL CHECK(length(code)>0), diagnostic text NOT NULL CHECK(diagnostic !~* '(address|contributor)'), systemic boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX ou_snapshot_issues_snapshot_idx ON office_universe.snapshot_issues(snapshot_id,systemic);

-- Historic office_universe.raw_payloads.snapshot_id predates intake_snapshots and has no deterministic
-- backfill, so it deliberately gets no foreign key to intake_snapshots in this migration.

-- Ingest is append-only on evidence, runs, snapshots, and issues. 0017 granted UPDATE/DELETE on all tables
-- existing at that time; these five are new, so the explicit REVOKE is a guard against default-privilege drift.
-- dsa_seats_migration_owner keeps DDL access as schema owner and retains full table privileges.
GRANT SELECT,INSERT,UPDATE,DELETE ON office_universe.source_definitions,office_universe.retained_object_receipts,office_universe.intake_runs,office_universe.intake_snapshots,office_universe.snapshot_issues TO dsa_seats_migration_owner;
GRANT SELECT,INSERT ON office_universe.source_definitions,office_universe.retained_object_receipts,office_universe.intake_runs,office_universe.intake_snapshots,office_universe.snapshot_issues TO dsa_seats_ingest;
REVOKE UPDATE,DELETE ON office_universe.source_definitions,office_universe.retained_object_receipts,office_universe.intake_runs,office_universe.intake_snapshots,office_universe.snapshot_issues FROM dsa_seats_ingest;
COMMIT;
