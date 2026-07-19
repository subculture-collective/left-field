ALTER TYPE missing_reason ADD VALUE IF NOT EXISTS 'license_unavailable';
--> statement-breakpoint
CREATE TABLE "acs_variable_dependencies" (
	"release_id" text NOT NULL,
	"acs_variable_id" text NOT NULL,
	"dependency_kind" text NOT NULL,
	"dependency_variable_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acs_variable_inputs" (
	"release_id" text NOT NULL,
	"acs_variable_id" text NOT NULL,
	"snapshot_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acs_variables" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"variable" text NOT NULL,
	"label" text NOT NULL,
	"unit" text NOT NULL,
	"survey_period" text NOT NULL,
	"universe" text NOT NULL,
	"definition_kind" text NOT NULL,
	"census_variable" text,
	"published_moe_method" text,
	"derivation_formula_version" text,
	"moe_propagation_method" text,
	CONSTRAINT "acs_variables_release_id_id_pk" PRIMARY KEY("release_id","id")
);
--> statement-breakpoint
CREATE TABLE "biographical_fact_provenance" (
	"release_id" text NOT NULL,
	"person_id" text NOT NULL,
	"fact" text NOT NULL,
	"effective_at" date NOT NULL,
	"snapshot_id" text NOT NULL,
	"role" "provenance_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biographical_facts" (
	"release_id" text NOT NULL,
	"person_id" text NOT NULL,
	"fact" text NOT NULL,
	"value" text,
	"value_missing_reason" "missing_reason",
	"effective_at" date NOT NULL,
	CONSTRAINT "biographical_facts_release_id_person_id_fact_effective_at_pk" PRIMARY KEY("release_id","person_id","fact","effective_at")
);
--> statement-breakpoint
CREATE TABLE "committee_assignment_provenance" (
	"release_id" text NOT NULL,
	"person_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"role_name" text NOT NULL,
	"effective_from" date NOT NULL,
	"snapshot_id" text NOT NULL,
	"provenance_role" "provenance_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_assignments" (
	"release_id" text NOT NULL,
	"person_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"role" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "coverage_input_snapshots" (
	"release_id" text NOT NULL,
	"domain" text NOT NULL,
	"scope_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	CONSTRAINT "coverage_input_snapshots_release_id_domain_scope_key_snapshot_id_pk" PRIMARY KEY("release_id","domain","scope_key","snapshot_id")
);
--> statement-breakpoint
CREATE TABLE "coverage_missing_reasons" (
	"release_id" text NOT NULL,
	"domain" text NOT NULL,
	"scope_key" text NOT NULL,
	"reason" "missing_reason" NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "coverage_missing_reasons_release_id_domain_scope_key_reason_pk" PRIMARY KEY("release_id","domain","scope_key","reason")
);
--> statement-breakpoint
CREATE TABLE "coverage_records" (
	"release_id" text NOT NULL,
	"domain" text NOT NULL,
	"scope_key" text NOT NULL,
	"scope_kind" text NOT NULL,
	"jurisdiction_code" text,
	"seat_cycle_id" text,
	"variable" text,
	"survey_period" text,
	"election_year" integer,
	"funding_kind" text,
	"status" text NOT NULL,
	"expected_count" integer NOT NULL,
	"observed_count" integer NOT NULL,
	"quarantined_count" integer NOT NULL,
	"incompatible_count" integer NOT NULL,
	CONSTRAINT "coverage_records_release_id_domain_scope_key_pk" PRIMARY KEY("release_id","domain","scope_key"),
	CONSTRAINT "coverage_records_scope_key_nonempty_ck" CHECK (length("coverage_records"."scope_key") > 0),
	CONSTRAINT "coverage_records_scope_fields_ck" CHECK (("coverage_records"."scope_kind" = 'release' AND "coverage_records"."jurisdiction_code" IS NULL AND "coverage_records"."seat_cycle_id" IS NULL AND "coverage_records"."variable" IS NULL AND "coverage_records"."survey_period" IS NULL AND "coverage_records"."election_year" IS NULL AND "coverage_records"."funding_kind" IS NULL) OR ("coverage_records"."scope_kind" = 'jurisdiction' AND "coverage_records"."jurisdiction_code" IS NOT NULL AND "coverage_records"."seat_cycle_id" IS NULL AND "coverage_records"."variable" IS NULL AND "coverage_records"."survey_period" IS NULL AND "coverage_records"."election_year" IS NULL AND "coverage_records"."funding_kind" IS NULL) OR ("coverage_records"."scope_kind" = 'seat_cycle' AND "coverage_records"."seat_cycle_id" IS NOT NULL AND "coverage_records"."jurisdiction_code" IS NULL AND "coverage_records"."variable" IS NULL AND "coverage_records"."survey_period" IS NULL AND "coverage_records"."election_year" IS NULL AND "coverage_records"."funding_kind" IS NULL) OR ("coverage_records"."scope_kind" = 'acs_indicator' AND "coverage_records"."variable" IS NOT NULL AND "coverage_records"."survey_period" IS NOT NULL AND "coverage_records"."jurisdiction_code" IS NULL AND "coverage_records"."seat_cycle_id" IS NULL AND "coverage_records"."election_year" IS NULL AND "coverage_records"."funding_kind" IS NULL) OR ("coverage_records"."scope_kind" = 'election' AND "coverage_records"."jurisdiction_code" IS NOT NULL AND "coverage_records"."election_year" IS NOT NULL AND "coverage_records"."seat_cycle_id" IS NULL AND "coverage_records"."variable" IS NULL AND "coverage_records"."survey_period" IS NULL AND "coverage_records"."funding_kind" IS NULL) OR ("coverage_records"."scope_kind" = 'funding' AND "coverage_records"."seat_cycle_id" IS NOT NULL AND "coverage_records"."funding_kind" IS NOT NULL AND "coverage_records"."jurisdiction_code" IS NULL AND "coverage_records"."variable" IS NULL AND "coverage_records"."survey_period" IS NULL AND "coverage_records"."election_year" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "election_decision_inputs" (
	"release_id" text NOT NULL,
	"election_decision_id" text NOT NULL,
	"snapshot_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_decisions" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"election_year" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_aggregate_inputs" (
	"release_id" text NOT NULL,
	"finance_aggregate_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"filing_id" text,
	"missing_reason" "missing_reason"
);
--> statement-breakpoint
CREATE TABLE "finance_aggregates" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"as_of" date NOT NULL,
	"coverage_through" date NOT NULL,
	"reporting_period_start" date NOT NULL,
	"cash_on_hand" numeric,
	"cash_on_hand_missing_reason" "missing_reason",
	"receipts" numeric,
	"receipts_missing_reason" "missing_reason",
	"disbursements" numeric,
	"disbursements_missing_reason" "missing_reason",
	"methodology_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_category_aggregates" (
	"release_id" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric,
	"amount_missing_reason" "missing_reason",
	"coverage_through" date NOT NULL,
	"methodology_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_organization_aggregates" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"organization_name" text NOT NULL,
	"organization_external_id" text,
	"amount" numeric,
	"amount_missing_reason" "missing_reason",
	"coverage_through" date NOT NULL,
	"methodology_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"source_id" text NOT NULL,
	"adapter_version" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text NOT NULL,
	"extracted_count" integer NOT NULL,
	"staged_count" integer DEFAULT 0 NOT NULL,
	"quarantined_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"release_id" text NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"house_representation" text NOT NULL,
	"senate_representation" text NOT NULL,
	CONSTRAINT "jurisdictions_release_id_jurisdiction_code_pk" PRIMARY KEY("release_id","jurisdiction_code")
);
--> statement-breakpoint
CREATE TABLE "map_artifact_inputs" (
	"release_id" text NOT NULL,
	"map_artifact_id" text NOT NULL,
	"snapshot_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_artifacts" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"geography_version_id" text NOT NULL,
	"artifact_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nationwide_validation_gates" (
	"release_id" text NOT NULL,
	"schema_version" integer NOT NULL,
	"manifest_checksum_sha256" text NOT NULL,
	"geometry_checksum_sha256" text NOT NULL,
	"content_checksum_sha256" text NOT NULL,
	"domain_count" integer NOT NULL,
	"domain_checksum_sha256" text NOT NULL,
	"validated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outside_spending_aggregates" (
	"release_id" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"support_amount" numeric,
	"support_amount_missing_reason" "missing_reason",
	"oppose_amount" numeric,
	"oppose_amount_missing_reason" "missing_reason",
	"coverage_through" date NOT NULL,
	"methodology_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quarantined_records" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"payload_checksum" text NOT NULL,
	"parser_error_code" text NOT NULL,
	"redacted_diagnostic" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_content_digests" (
	"release_id" text NOT NULL,
	"domain" text NOT NULL,
	"row_count" bigint NOT NULL,
	"sha256" text NOT NULL,
	"validated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshot_derivation_inputs" (
	"release_id" text NOT NULL,
	"output_snapshot_id" text NOT NULL,
	"input_snapshot_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshot_derivations" (
	"release_id" text NOT NULL,
	"output_snapshot_id" text NOT NULL,
	"methodology_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stg_acs" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"geography" text NOT NULL,
	"variable" text NOT NULL,
	"survey_period" text NOT NULL,
	"estimate" numeric,
	"margin_of_error" numeric,
	"unit" text NOT NULL,
	"redacted_extras" jsonb
);
--> statement-breakpoint
CREATE TABLE "stg_elections" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"contest_id" text NOT NULL,
	"reporting_unit" text NOT NULL,
	"option_id" text NOT NULL,
	"votes" numeric,
	"certification_status" text NOT NULL,
	"redacted_extras" jsonb
);
--> statement-breakpoint
CREATE TABLE "stg_fec" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"filing_id" text NOT NULL,
	"report_type" text NOT NULL,
	"reporting_period_start" date NOT NULL,
	"reporting_period_end" date NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"amendment_number" integer NOT NULL,
	"cash_on_hand" numeric,
	"total_receipts" numeric,
	"total_disbursements" numeric,
	"redacted_extras" jsonb
);
--> statement-breakpoint
CREATE TABLE "stg_identity" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_entity_id" text NOT NULL,
	"display_name" text NOT NULL,
	"office_chamber" text,
	"office_state_code" text,
	"office_district_code" text,
	"redacted_extras" jsonb
);
--> statement-breakpoint
CREATE TABLE "stg_tiger" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"source_natural_key" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"artifact_id" text NOT NULL,
	"geoid" text NOT NULL,
	"state_code" text NOT NULL,
	"district_code" text,
	"vintage" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"redacted_extras" jsonb
);
--> statement-breakpoint
ALTER TABLE "release_manifests" DROP CONSTRAINT "release_manifests_schema_version_ck";--> statement-breakpoint
ALTER TABLE "release_profile_seats" DROP CONSTRAINT "release_profile_seats_position_ck";--> statement-breakpoint
ALTER TABLE "acs_variable_dependencies" ADD CONSTRAINT "acs_variable_dependencies_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acs_variable_inputs" ADD CONSTRAINT "acs_variable_inputs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acs_variables" ADD CONSTRAINT "acs_variables_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biographical_fact_provenance" ADD CONSTRAINT "biographical_fact_provenance_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biographical_facts" ADD CONSTRAINT "biographical_facts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assignment_provenance" ADD CONSTRAINT "committee_assignment_provenance_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_input_snapshots" ADD CONSTRAINT "coverage_input_snapshots_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_input_snapshots" ADD CONSTRAINT "coverage_input_snapshots_release_id_domain_scope_key_coverage_records_release_id_domain_scope_key_fk" FOREIGN KEY ("release_id","domain","scope_key") REFERENCES "public"."coverage_records"("release_id","domain","scope_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_input_snapshots" ADD CONSTRAINT "coverage_input_snapshots_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY ("release_id","snapshot_id") REFERENCES "public"."source_snapshots"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_missing_reasons" ADD CONSTRAINT "coverage_missing_reasons_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_missing_reasons" ADD CONSTRAINT "coverage_missing_reasons_release_id_domain_scope_key_coverage_records_release_id_domain_scope_key_fk" FOREIGN KEY ("release_id","domain","scope_key") REFERENCES "public"."coverage_records"("release_id","domain","scope_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_records" ADD CONSTRAINT "coverage_records_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_decision_inputs" ADD CONSTRAINT "election_decision_inputs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_decisions" ADD CONSTRAINT "election_decisions_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_aggregate_inputs" ADD CONSTRAINT "finance_aggregate_inputs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_aggregates" ADD CONSTRAINT "finance_aggregates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_category_aggregates" ADD CONSTRAINT "funding_category_aggregates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_organization_aggregates" ADD CONSTRAINT "funding_organization_aggregates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_artifact_inputs" ADD CONSTRAINT "map_artifact_inputs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_artifacts" ADD CONSTRAINT "map_artifacts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nationwide_validation_gates" ADD CONSTRAINT "nationwide_validation_gates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outside_spending_aggregates" ADD CONSTRAINT "outside_spending_aggregates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarantined_records" ADD CONSTRAINT "quarantined_records_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_content_digests" ADD CONSTRAINT "release_content_digests_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_derivation_inputs" ADD CONSTRAINT "snapshot_derivation_inputs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_derivations" ADD CONSTRAINT "snapshot_derivations_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_acs" ADD CONSTRAINT "stg_acs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_elections" ADD CONSTRAINT "stg_elections_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec" ADD CONSTRAINT "stg_fec_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_identity" ADD CONSTRAINT "stg_identity_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_tiger" ADD CONSTRAINT "stg_tiger_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acs_variables_natural_uq" ON "acs_variables" USING btree ("release_id","variable","survey_period");--> statement-breakpoint
ALTER TABLE "acs_variables" ADD CONSTRAINT "acs_variables_definition_ck" CHECK (("acs_variables"."definition_kind"='source' AND "acs_variables"."census_variable" IS NOT NULL AND "acs_variables"."published_moe_method" IS NOT NULL AND "acs_variables"."derivation_formula_version" IS NULL AND "acs_variables"."moe_propagation_method" IS NULL) OR ("acs_variables"."definition_kind"='derived_ratio' AND "acs_variables"."census_variable" IS NULL AND "acs_variables"."published_moe_method" IS NULL AND "acs_variables"."derivation_formula_version" IS NOT NULL AND "acs_variables"."moe_propagation_method" IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "release_manifests_nationwide_identity_uq" ON "release_manifests" USING btree ("release_id","schema_version","canonical_data_checksum_sha256","geometry_checksum_sha256","content_checksum_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "result_options_release_id_id_contest_uq" ON "result_options" USING btree ("release_id","id","contest_id");--> statement-breakpoint
ALTER TABLE "release_manifests" ADD CONSTRAINT "release_manifests_schema_version_ck" CHECK ("release_manifests"."schema_version" IN (1,2));--> statement-breakpoint
ALTER TABLE "release_profile_seats" ADD CONSTRAINT "release_catalog_position_positive" CHECK ("release_profile_seats"."position" >= 1);
--> statement-breakpoint
-- Hand-authored PostgreSQL integrity which Drizzle cannot represent.
ALTER TABLE acs_observations DROP CONSTRAINT acs_observations_unit_check;
ALTER TABLE acs_observations ADD CONSTRAINT "acs_observations_unit_ck" CHECK(unit IN ('count','percent','usd','years'));
ALTER TABLE funding_category_aggregates ADD CONSTRAINT "funding_category_aggregates_release_id_seat_cycle_id_category_coverage_through_methodology_version_pk" PRIMARY KEY(release_id,seat_cycle_id,category,coverage_through,methodology_version);
ALTER TABLE funding_organization_aggregates ADD CONSTRAINT "funding_organization_aggregates_release_id_id_pk" PRIMARY KEY(release_id,id);
ALTER TABLE outside_spending_aggregates ADD CONSTRAINT "outside_spending_aggregates_release_id_seat_cycle_id_coverage_through_methodology_version_pk" PRIMARY KEY(release_id,seat_cycle_id,coverage_through,methodology_version);
CREATE TABLE funding_category_input_snapshots (release_id text NOT NULL, seat_cycle_id text NOT NULL, category text NOT NULL, coverage_through date NOT NULL, methodology_version text NOT NULL, snapshot_id text NOT NULL, CONSTRAINT "funding_category_input_snapshots_release_id_seat_cycle_id_category_coverage_through_methodology_version_snapshot_id_pk" PRIMARY KEY(release_id,seat_cycle_id,category,coverage_through,methodology_version,snapshot_id), CONSTRAINT "funding_category_input_snapshots_release_id_data_releases_id_fk" FOREIGN KEY(release_id) REFERENCES data_releases(id), CONSTRAINT "funding_category_input_snapshots_aggregate_fk" FOREIGN KEY(release_id,seat_cycle_id,category,coverage_through,methodology_version) REFERENCES funding_category_aggregates(release_id,seat_cycle_id,category,coverage_through,methodology_version), CONSTRAINT "funding_category_input_snapshots_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE funding_organization_input_snapshots (release_id text NOT NULL, aggregate_id text NOT NULL, snapshot_id text NOT NULL, CONSTRAINT "funding_organization_input_snapshots_release_id_aggregate_id_snapshot_id_pk" PRIMARY KEY(release_id,aggregate_id,snapshot_id), CONSTRAINT "funding_organization_input_snapshots_release_id_data_releases_id_fk" FOREIGN KEY(release_id) REFERENCES data_releases(id), CONSTRAINT "funding_organization_input_snapshots_release_id_aggregate_id_funding_organization_aggregates_release_id_id_fk" FOREIGN KEY(release_id,aggregate_id) REFERENCES funding_organization_aggregates(release_id,id), CONSTRAINT "funding_organization_input_snapshots_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE outside_spending_input_snapshots (release_id text NOT NULL, seat_cycle_id text NOT NULL, coverage_through date NOT NULL, methodology_version text NOT NULL, snapshot_id text NOT NULL, CONSTRAINT "outside_spending_input_snapshots_release_id_seat_cycle_id_coverage_through_methodology_version_snapshot_id_pk" PRIMARY KEY(release_id,seat_cycle_id,coverage_through,methodology_version,snapshot_id), CONSTRAINT "outside_spending_input_snapshots_release_id_data_releases_id_fk" FOREIGN KEY(release_id) REFERENCES data_releases(id), CONSTRAINT "outside_spending_input_snapshots_aggregate_fk" FOREIGN KEY(release_id,seat_cycle_id,coverage_through,methodology_version) REFERENCES outside_spending_aggregates(release_id,seat_cycle_id,coverage_through,methodology_version), CONSTRAINT "outside_spending_input_snapshots_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
ALTER TABLE ingest_runs ADD CONSTRAINT "ingest_runs_release_id_source_id_sources_release_id_id_fk" FOREIGN KEY(release_id,source_id) REFERENCES sources(release_id,id), ADD CONSTRAINT "ingest_runs_status_ck" CHECK(status IN ('running','validated','failed','loaded')), ADD CONSTRAINT "ingest_runs_counts_ck" CHECK(extracted_count>=0 AND staged_count>=0 AND quarantined_count>=0 AND staged_count+quarantined_count<=extracted_count);
ALTER TABLE release_content_digests ADD CONSTRAINT "release_content_digests_release_id_domain_pk" PRIMARY KEY(release_id,domain), ADD CONSTRAINT "release_content_digests_domain_ck" CHECK(domain IN ('identity','geography','member','acs','finance','elections','maps')), ADD CONSTRAINT "release_content_digests_count_ck" CHECK(row_count>=0), ADD CONSTRAINT "release_content_digests_sha_ck" CHECK(sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE nationwide_validation_gates ADD CONSTRAINT "nationwide_validation_gates_release_id_pk" PRIMARY KEY(release_id), ADD CONSTRAINT "nationwide_validation_gates_count_ck" CHECK(domain_count=7), ADD CONSTRAINT "nationwide_validation_gates_version_ck" CHECK(schema_version=2);
CREATE UNIQUE INDEX funding_organization_aggregates_natural_uq ON funding_organization_aggregates (release_id,seat_cycle_id,organization_name,organization_external_id,coverage_through,methodology_version) NULLS NOT DISTINCT;
CREATE INDEX ingest_runs_release_source_fk_idx ON ingest_runs(release_id,source_id); CREATE INDEX funding_category_input_snapshots_snapshot_fk_idx ON funding_category_input_snapshots(release_id,snapshot_id); CREATE INDEX funding_organization_input_snapshots_snapshot_fk_idx ON funding_organization_input_snapshots(release_id,snapshot_id); CREATE INDEX outside_spending_input_snapshots_snapshot_fk_idx ON outside_spending_input_snapshots(release_id,snapshot_id);
CREATE FUNCTION guard_nationwide_content() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE r text:=COALESCE(NEW.release_id,OLD.release_id); d text; BEGIN IF TG_OP='UPDATE' AND NEW.release_id IS DISTINCT FROM OLD.release_id THEN RAISE EXCEPTION 'release content cannot move between releases' USING ERRCODE='23514'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||r)); IF NOT EXISTS(SELECT 1 FROM data_releases WHERE id=r AND status='candidate' FOR UPDATE) THEN RAISE EXCEPTION 'nationwide content is mutable only while candidate' USING ERRCODE='23514'; END IF; FOREACH d IN ARRAY regexp_split_to_array(TG_ARGV[0],'\s*,\s*') LOOP DELETE FROM release_content_digests WHERE release_id=r AND domain=d; END LOOP; DELETE FROM nationwide_validation_gates WHERE release_id=r; UPDATE release_manifests SET validated_at=NULL WHERE release_id=r; RETURN COALESCE(NEW,OLD); END $$;
CREATE FUNCTION guard_nationwide_validation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE r text:=COALESCE(NEW.release_id,OLD.release_id); BEGIN IF TG_OP='UPDATE' AND NEW.release_id IS DISTINCT FROM OLD.release_id THEN RAISE EXCEPTION 'validation release is immutable' USING ERRCODE='23514'; END IF; IF NOT EXISTS(SELECT 1 FROM data_releases WHERE id=r AND status='candidate' FOR UPDATE) THEN RAISE EXCEPTION 'validation is mutable only while candidate' USING ERRCODE='23514'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE FUNCTION guard_ingest_run() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='INSERT' THEN IF NEW.status<>'running' OR NEW.completed_at IS NOT NULL OR NEW.extracted_count<0 OR NEW.staged_count<>0 OR NEW.quarantined_count<>0 THEN RAISE EXCEPTION 'new ingest run must start running with zero staged and quarantined counts' USING ERRCODE='23514'; END IF; RETURN NEW; END IF; IF (NEW.id,NEW.release_id,NEW.source_id,NEW.adapter_version,NEW.started_at,NEW.extracted_count) IS DISTINCT FROM (OLD.id,OLD.release_id,OLD.source_id,OLD.adapter_version,OLD.started_at,OLD.extracted_count) THEN RAISE EXCEPTION 'ingest identity is immutable' USING ERRCODE='23514'; END IF; IF NEW.staged_count<OLD.staged_count OR NEW.quarantined_count<OLD.quarantined_count OR NEW.staged_count+NEW.quarantined_count>NEW.extracted_count THEN RAISE EXCEPTION 'ingest counts must be monotonic and reconciled' USING ERRCODE='23514'; END IF; IF OLD.status='running' THEN IF NEW.status='running' THEN IF NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.completed_at IS NOT NULL THEN RAISE EXCEPTION 'running update may only increment counts' USING ERRCODE='23514'; END IF; ELSIF NEW.status='validated' THEN IF NEW.completed_at IS NULL OR NEW.staged_count+NEW.quarantined_count<>NEW.extracted_count THEN RAISE EXCEPTION 'validated ingest run requires exact reconciliation and completion' USING ERRCODE='23514'; END IF; ELSIF NEW.status='failed' THEN IF NEW.completed_at IS NULL THEN RAISE EXCEPTION 'failed ingest run requires completion' USING ERRCODE='23514'; END IF; ELSE RAISE EXCEPTION 'illegal ingest transition' USING ERRCODE='23514'; END IF; ELSIF OLD.status='validated' THEN IF NEW.status<>'loaded' OR NEW.completed_at IS NULL OR NEW.staged_count<>OLD.staged_count OR NEW.quarantined_count<>OLD.quarantined_count THEN RAISE EXCEPTION 'validated ingest run may only transition to loaded' USING ERRCODE='23514'; END IF; ELSE RAISE EXCEPTION 'terminal ingest run is immutable' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER ingest_runs_guard BEFORE INSERT OR UPDATE ON ingest_runs FOR EACH ROW EXECUTE FUNCTION guard_ingest_run();
CREATE TRIGGER nationwide_digest_guard BEFORE INSERT OR UPDATE OR DELETE ON release_content_digests FOR EACH ROW EXECUTE FUNCTION guard_nationwide_validation(); CREATE TRIGGER nationwide_gate_guard BEFORE INSERT OR UPDATE OR DELETE ON nationwide_validation_gates FOR EACH ROW EXECUTE FUNCTION guard_nationwide_validation();

-- The generated declarations above intentionally stop at relational shape.  The
-- following ownership layer is hand-authored: do not fold it back into Drizzle.
ALTER TABLE quarantined_records ADD CONSTRAINT "quarantined_records_diagnostic_ck" CHECK(redacted_diagnostic !~* '(address|contributor)');
ALTER TABLE quarantined_records ADD CONSTRAINT "quarantined_records_checksum_ck" CHECK(payload_checksum ~ '^[a-f0-9]{64}$');

CREATE FUNCTION guard_nationwide_operational() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r text:=COALESCE(NEW.release_id,OLD.release_id); run_release text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.release_id IS DISTINCT FROM OLD.release_id THEN RAISE EXCEPTION 'operational row cannot move between releases' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||r));
  IF NOT EXISTS(SELECT 1 FROM data_releases WHERE id=r AND status='candidate' FOR UPDATE) THEN RAISE EXCEPTION 'operational rows are mutable only while candidate' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME <> 'ingest_runs' THEN
    SELECT release_id INTO run_release FROM ingest_runs WHERE id=COALESCE(NEW.run_id,OLD.run_id) AND status='running' FOR KEY SHARE;
    IF run_release IS DISTINCT FROM r THEN RAISE EXCEPTION 'operational row requires a running run for the same release' USING ERRCODE='23514'; END IF;
  END IF;
  DELETE FROM nationwide_validation_gates WHERE release_id=r;
  UPDATE release_manifests SET validated_at=NULL WHERE release_id=r;
  RETURN COALESCE(NEW,OLD);
END $$;

CREATE TRIGGER ingest_runs_operational_guard BEFORE INSERT OR DELETE ON ingest_runs FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER ingest_runs_operational_update_guard BEFORE UPDATE ON ingest_runs FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER stg_identity_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON stg_identity FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER stg_tiger_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON stg_tiger FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER stg_acs_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON stg_acs FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER stg_fec_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON stg_fec FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER stg_elections_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON stg_elections FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();
CREATE TRIGGER quarantined_records_operational_guard BEFORE INSERT OR UPDATE OR DELETE ON quarantined_records FOR EACH ROW EXECUTE FUNCTION guard_nationwide_operational();

-- Every digest-bearing relation gets an explicit, catalog-visible invalidator.
-- The array is the SQL twin of contentTableRegistry (including its domain order).
DO $$
DECLARE t text[]; domains text;
BEGIN
  FOREACH t SLICE 1 IN ARRAY ARRAY[
    ['sources','identity,geography,member,acs,finance,elections,maps'],['source_snapshots','identity,geography,member,acs,finance,elections,maps'],['district_plans','geography'],['geometry_artifacts','geography,maps'],['geography_versions','geography,maps'],['jurisdictions','identity'],['offices','identity'],['people','member'],['office_terms','identity,member'],['memberships','member'],['seat_cycles','identity,geography,member,finance,elections'],['release_profile_seats','identity'],['coverage_records','identity,geography,member,acs,finance,elections,maps'],['coverage_missing_reasons','identity,geography,member,acs,finance,elections,maps'],['coverage_input_snapshots','identity,geography,member,acs,finance,elections,maps'],['biographical_facts','member'],['biographical_fact_provenance','member'],['committees','finance'],['committee_assignments','member,finance'],['committee_assignment_provenance','member,finance'],['contests','elections'],['candidacies','elections,member'],['result_options','elections'],['election_results','elections'],['contest_lineage','elections'],['election_result_lineage','elections'],['acs_observations','acs'],['acs_observation_lineage','acs'],['acs_variables','acs'],['acs_variable_inputs','acs'],['acs_variable_dependencies','acs'],['committee_relationships','finance'],['fec_filing_summaries','finance'],['fec_filing_lineage','finance'],['seat_finance_summaries','finance'],['seat_finance_summary_lineage','finance'],['finance_aggregates','finance'],['finance_aggregate_inputs','finance'],['funding_category_aggregates','finance'],['funding_category_input_snapshots','finance'],['funding_organization_aggregates','finance'],['funding_organization_input_snapshots','finance'],['outside_spending_aggregates','finance'],['outside_spending_input_snapshots','finance'],['election_decisions','elections'],['election_decision_inputs','elections'],['map_artifacts','maps'],['map_artifact_inputs','maps'],['snapshot_derivations','identity,geography,member,acs,finance,elections,maps'],['snapshot_derivation_inputs','identity,geography,member,acs,finance,elections,maps'],['provenance','identity,geography,member,finance,elections']
  ] LOOP
    domains:=t[2];
    EXECUTE format('CREATE TRIGGER nationwide_content_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_nationwide_content(%L)',t[1],t[1],domains);
  END LOOP;
END $$;

-- Public filters/sorts and every non-leading normalized FK need their own path.
CREATE INDEX release_profile_seats_position_idx ON release_profile_seats(release_id,position);
CREATE INDEX offices_state_chamber_idx ON offices(release_id,state_code,chamber,district_code);
CREATE INDEX memberships_term_party_dates_idx ON memberships(release_id,office_term_id,party,starts_at,ends_at);
CREATE INDEX seat_cycles_year_kind_status_idx ON seat_cycles(release_id,cycle_year,election_kind,incumbency_status,id);
CREATE INDEX contests_date_kind_status_idx ON contests(release_id,election_date,kind,certification_status,id);
CREATE INDEX acs_observations_variable_geography_idx ON acs_observations(release_id,variable,geography_version_id,survey_period);
CREATE INDEX finance_aggregates_seat_coverage_idx ON finance_aggregates(release_id,seat_cycle_id,coverage_through,as_of);
CREATE INDEX funding_category_aggregates_seat_coverage_idx ON funding_category_aggregates(release_id,seat_cycle_id,coverage_through);
CREATE INDEX funding_organization_aggregates_seat_coverage_idx ON funding_organization_aggregates(release_id,seat_cycle_id,coverage_through);
CREATE INDEX outside_spending_aggregates_seat_coverage_idx ON outside_spending_aggregates(release_id,seat_cycle_id,coverage_through);
CREATE INDEX election_decisions_jurisdiction_year_idx ON election_decisions(release_id,jurisdiction_code,election_year);
CREATE INDEX map_artifacts_geography_artifact_idx ON map_artifacts(release_id,geography_version_id,artifact_id);
CREATE INDEX ingest_runs_release_source_status_idx ON ingest_runs(release_id,source_id,status);
CREATE INDEX quarantined_records_run_snapshot_idx ON quarantined_records(run_id,release_id,snapshot_id);
CREATE INDEX stg_identity_run_snapshot_idx ON stg_identity(run_id,release_id,snapshot_id); CREATE INDEX stg_tiger_run_snapshot_idx ON stg_tiger(run_id,release_id,snapshot_id); CREATE INDEX stg_acs_run_snapshot_idx ON stg_acs(run_id,release_id,snapshot_id); CREATE INDEX stg_fec_run_snapshot_idx ON stg_fec(run_id,release_id,snapshot_id); CREATE INDEX stg_elections_run_snapshot_idx ON stg_elections(run_id,release_id,snapshot_id);
CREATE INDEX coverage_input_snapshots_snapshot_fk_idx ON coverage_input_snapshots(release_id,snapshot_id); CREATE INDEX biographical_fact_provenance_snapshot_fk_idx ON biographical_fact_provenance(release_id,snapshot_id); CREATE INDEX committee_assignment_provenance_snapshot_fk_idx ON committee_assignment_provenance(release_id,snapshot_id); CREATE INDEX acs_variable_inputs_snapshot_fk_idx ON acs_variable_inputs(release_id,snapshot_id); CREATE INDEX acs_variable_dependencies_dependency_fk_idx ON acs_variable_dependencies(release_id,dependency_variable_id); CREATE INDEX finance_aggregate_inputs_committee_fk_idx ON finance_aggregate_inputs(release_id,committee_id); CREATE INDEX finance_aggregate_inputs_filing_fk_idx ON finance_aggregate_inputs(release_id,filing_id); CREATE INDEX election_decision_inputs_snapshot_fk_idx ON election_decision_inputs(release_id,snapshot_id); CREATE INDEX map_artifact_inputs_snapshot_fk_idx ON map_artifact_inputs(release_id,snapshot_id); CREATE INDEX snapshot_derivation_inputs_snapshot_fk_idx ON snapshot_derivation_inputs(release_id,input_snapshot_id);

-- The initial generated CREATE TABLE statements omit relational declarations for
-- existing relations.  Materialize the snapshot's remaining keys here rather
-- than letting metadata claim constraints that a clean database does not have.
ALTER TABLE acs_variable_dependencies ADD CONSTRAINT "acs_variable_dependencies_release_id_acs_variable_id_dependency_kind_dependency_variable_id_pk" PRIMARY KEY(release_id,acs_variable_id,dependency_kind,dependency_variable_id), ADD CONSTRAINT "acs_variable_dependencies_release_id_acs_variable_id_acs_variables_release_id_id_fk" FOREIGN KEY(release_id,acs_variable_id) REFERENCES acs_variables(release_id,id), ADD CONSTRAINT "acs_variable_dependencies_release_id_dependency_variable_id_acs_variables_release_id_id_fk" FOREIGN KEY(release_id,dependency_variable_id) REFERENCES acs_variables(release_id,id), ADD CONSTRAINT "acs_variable_dependencies_kind_ck" CHECK(dependency_kind IN ('numerator','denominator','component'));
ALTER TABLE acs_variable_inputs ADD CONSTRAINT "acs_variable_inputs_release_id_acs_variable_id_snapshot_id_pk" PRIMARY KEY(release_id,acs_variable_id,snapshot_id), ADD CONSTRAINT "acs_variable_inputs_release_id_acs_variable_id_acs_variables_release_id_id_fk" FOREIGN KEY(release_id,acs_variable_id) REFERENCES acs_variables(release_id,id), ADD CONSTRAINT "acs_variable_inputs_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE biographical_fact_provenance ADD CONSTRAINT "biographical_fact_provenance_release_id_person_id_fact_effective_at_snapshot_id_role_pk" PRIMARY KEY(release_id,person_id,fact,effective_at,snapshot_id,role), ADD CONSTRAINT "biographical_fact_provenance_fact_fk" FOREIGN KEY(release_id,person_id,fact,effective_at) REFERENCES biographical_facts(release_id,person_id,fact,effective_at), ADD CONSTRAINT "biographical_fact_provenance_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE committee_assignments ADD CONSTRAINT "committee_assignments_release_id_person_id_committee_id_role_effective_from_pk" PRIMARY KEY(release_id,person_id,committee_id,role,effective_from), ADD CONSTRAINT "committee_assignments_release_id_person_id_people_release_id_id_fk" FOREIGN KEY(release_id,person_id) REFERENCES people(release_id,id), ADD CONSTRAINT "committee_assignments_release_id_committee_id_committees_release_id_id_fk" FOREIGN KEY(release_id,committee_id) REFERENCES committees(release_id,id), ADD CONSTRAINT "committee_assignments_dates_ck" CHECK(effective_to IS NULL OR effective_to>effective_from);
ALTER TABLE committee_assignment_provenance ADD CONSTRAINT "committee_assignment_provenance_release_id_person_id_committee_id_role_name_effective_from_snapshot_id_provenance_role_pk" PRIMARY KEY(release_id,person_id,committee_id,role_name,effective_from,snapshot_id,provenance_role), ADD CONSTRAINT "committee_assignment_provenance_assignment_fk" FOREIGN KEY(release_id,person_id,committee_id,role_name,effective_from) REFERENCES committee_assignments(release_id,person_id,committee_id,role,effective_from), ADD CONSTRAINT "committee_assignment_provenance_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE election_decisions ADD CONSTRAINT "election_decisions_release_id_id_pk" PRIMARY KEY(release_id,id), ADD CONSTRAINT "election_decisions_release_id_jurisdiction_code_jurisdictions_release_id_jurisdiction_code_fk" FOREIGN KEY(release_id,jurisdiction_code) REFERENCES jurisdictions(release_id,jurisdiction_code), ADD CONSTRAINT "election_decisions_year_ck" CHECK(election_year BETWEEN 1788 AND 2200), ADD CONSTRAINT "election_decisions_status_ck" CHECK(status IN ('unassessed','unavailable','approved'));
ALTER TABLE election_decision_inputs ADD CONSTRAINT "election_decision_inputs_release_id_election_decision_id_snapshot_id_pk" PRIMARY KEY(release_id,election_decision_id,snapshot_id), ADD CONSTRAINT "election_decision_inputs_release_id_election_decision_id_election_decisions_release_id_id_fk" FOREIGN KEY(release_id,election_decision_id) REFERENCES election_decisions(release_id,id), ADD CONSTRAINT "election_decision_inputs_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE finance_aggregates ADD CONSTRAINT "finance_aggregates_release_id_id_pk" PRIMARY KEY(release_id,id), ADD CONSTRAINT "finance_aggregates_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), ADD CONSTRAINT "finance_aggregates_dates_ck" CHECK(coverage_through>=reporting_period_start AND as_of>=coverage_through), ADD CONSTRAINT "finance_aggregates_cash_ck" CHECK((cash_on_hand IS NULL)<>(cash_on_hand_missing_reason IS NULL) AND (cash_on_hand IS NULL OR cash_on_hand>=0)), ADD CONSTRAINT "finance_aggregates_receipts_ck" CHECK((receipts IS NULL)<>(receipts_missing_reason IS NULL) AND (receipts IS NULL OR receipts>=0)), ADD CONSTRAINT "finance_aggregates_disbursements_ck" CHECK((disbursements IS NULL)<>(disbursements_missing_reason IS NULL) AND (disbursements IS NULL OR disbursements>=0));
ALTER TABLE finance_aggregate_inputs ADD CONSTRAINT "finance_aggregate_inputs_release_id_finance_aggregate_id_committee_id_pk" PRIMARY KEY(release_id,finance_aggregate_id,committee_id), ADD CONSTRAINT "finance_aggregate_inputs_release_id_finance_aggregate_id_finance_aggregates_release_id_id_fk" FOREIGN KEY(release_id,finance_aggregate_id) REFERENCES finance_aggregates(release_id,id), ADD CONSTRAINT "finance_aggregate_inputs_release_id_committee_id_committees_release_id_id_fk" FOREIGN KEY(release_id,committee_id) REFERENCES committees(release_id,id), ADD CONSTRAINT "finance_aggregate_inputs_release_id_filing_id_fec_filing_summaries_release_id_id_fk" FOREIGN KEY(release_id,filing_id) REFERENCES fec_filing_summaries(release_id,id), ADD CONSTRAINT "finance_aggregate_inputs_union_ck" CHECK((filing_id IS NULL)<>(missing_reason IS NULL));
ALTER TABLE map_artifacts ADD CONSTRAINT "map_artifacts_release_id_id_pk" PRIMARY KEY(release_id,id), ADD CONSTRAINT "map_artifacts_release_id_geography_version_id_geography_versions_release_id_id_fk" FOREIGN KEY(release_id,geography_version_id) REFERENCES geography_versions(release_id,id), ADD CONSTRAINT "map_artifacts_release_id_artifact_id_geometry_artifacts_release_id_id_fk" FOREIGN KEY(release_id,artifact_id) REFERENCES geometry_artifacts(release_id,id);
ALTER TABLE map_artifact_inputs ADD CONSTRAINT "map_artifact_inputs_release_id_map_artifact_id_snapshot_id_pk" PRIMARY KEY(release_id,map_artifact_id,snapshot_id), ADD CONSTRAINT "map_artifact_inputs_release_id_map_artifact_id_map_artifacts_release_id_id_fk" FOREIGN KEY(release_id,map_artifact_id) REFERENCES map_artifacts(release_id,id), ADD CONSTRAINT "map_artifact_inputs_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE snapshot_derivations ADD CONSTRAINT "snapshot_derivations_release_id_output_snapshot_id_pk" PRIMARY KEY(release_id,output_snapshot_id), ADD CONSTRAINT "snapshot_derivations_release_id_output_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,output_snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE snapshot_derivation_inputs ADD CONSTRAINT "snapshot_derivation_inputs_release_id_output_snapshot_id_input_snapshot_id_pk" PRIMARY KEY(release_id,output_snapshot_id,input_snapshot_id), ADD CONSTRAINT "snapshot_derivation_inputs_release_id_output_snapshot_id_snapshot_derivations_release_id_output_snapshot_id_fk" FOREIGN KEY(release_id,output_snapshot_id) REFERENCES snapshot_derivations(release_id,output_snapshot_id), ADD CONSTRAINT "snapshot_derivation_inputs_release_id_input_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,input_snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT "snapshot_derivation_inputs_distinct_ck" CHECK(output_snapshot_id<>input_snapshot_id);
-- Complete the declared Task 2 catalog shape, including operational children.
CREATE UNIQUE INDEX ingest_runs_id_release_id_uq ON ingest_runs(id,release_id);
ALTER TABLE biographical_facts ADD CONSTRAINT "biographical_facts_release_id_person_id_people_release_id_id_fk" FOREIGN KEY(release_id,person_id) REFERENCES people(release_id,id), ADD CONSTRAINT "biographical_facts_value_ck" CHECK((value IS NULL) <> (value_missing_reason IS NULL));
ALTER TABLE funding_category_aggregates ADD CONSTRAINT "funding_category_aggregates_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), ADD CONSTRAINT "funding_category_amount_ck" CHECK((amount IS NULL) <> (amount_missing_reason IS NULL) AND (amount IS NULL OR amount>=0));
ALTER TABLE funding_organization_aggregates ADD CONSTRAINT "funding_organization_aggregates_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), ADD CONSTRAINT "funding_organization_amount_ck" CHECK((amount IS NULL) <> (amount_missing_reason IS NULL) AND (amount IS NULL OR amount>=0));
ALTER TABLE outside_spending_aggregates ADD CONSTRAINT "outside_spending_aggregates_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), ADD CONSTRAINT "outside_spending_support_ck" CHECK((support_amount IS NULL) <> (support_amount_missing_reason IS NULL) AND (support_amount IS NULL OR support_amount>=0)), ADD CONSTRAINT "outside_spending_oppose_ck" CHECK((oppose_amount IS NULL) <> (oppose_amount_missing_reason IS NULL) AND (oppose_amount IS NULL OR oppose_amount>=0));
ALTER TABLE nationwide_validation_gates ADD CONSTRAINT "nationwide_validation_gates_release_id_schema_version_manifest_checksum_sha256_geometry_checksum_sha256_content_checksum_sha256_release_manifests_release_id_schema_version_canonical_data_checksum_sha256_geometry_checksum_sha256_content_checksum_sha256_fk" FOREIGN KEY(release_id,schema_version,manifest_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256) REFERENCES release_manifests(release_id,schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256), ADD CONSTRAINT "nationwide_validation_gates_sha_ck" CHECK(manifest_checksum_sha256 ~ '^[a-f0-9]{64}$' AND geometry_checksum_sha256 ~ '^[a-f0-9]{64}$' AND content_checksum_sha256 ~ '^[a-f0-9]{64}$' AND domain_checksum_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE quarantined_records ADD CONSTRAINT "quarantined_records_run_id_source_natural_key_pk" PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT "quarantined_records_run_id_release_id_ingest_runs_id_release_id_fk" FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT "quarantined_records_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id);
ALTER TABLE stg_identity ADD CONSTRAINT "stg_identity_run_id_source_natural_key_pk" PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT "stg_identity_run_id_release_id_ingest_runs_id_release_id_fk" FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT "stg_identity_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT "stg_identity_office_ck" CHECK((office_chamber IS NULL AND office_state_code IS NULL AND office_district_code IS NULL) OR (office_chamber IN ('house','senate') AND office_state_code ~ '^[A-Z]{2}$' AND (office_chamber='senate' AND office_district_code IS NULL OR office_chamber='house' AND office_district_code ~ '^(AL|[0-9]{2})$')));
ALTER TABLE stg_tiger ADD CONSTRAINT "stg_tiger_run_id_source_natural_key_pk" PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT "stg_tiger_run_id_release_id_ingest_runs_id_release_id_fk" FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT "stg_tiger_release_id_snapshot_id_source_snapshots_release_id_id_fk" FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT "stg_tiger_fields_ck" CHECK(state_code ~ '^[A-Z]{2}$' AND (district_code IS NULL OR district_code ~ '^(AL|[0-9]{2})$') AND checksum_sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE stg_acs ADD CONSTRAINT stg_acs_run_id_source_natural_key_pk PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT stg_acs_run_id_release_id_ingest_runs_id_release_id_fk FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT stg_acs_release_id_snapshot_id_source_snapshots_release_id_id_fk FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT stg_acs_unit_ck CHECK(unit IN ('count','percent','usd','years')), ADD CONSTRAINT stg_acs_moe_ck CHECK(margin_of_error IS NULL OR margin_of_error>=0);
ALTER TABLE stg_fec ADD CONSTRAINT stg_fec_run_id_source_natural_key_pk PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT stg_fec_run_id_release_id_ingest_runs_id_release_id_fk FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT stg_fec_release_id_snapshot_id_source_snapshots_release_id_id_fk FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT stg_fec_fields_ck CHECK(reporting_period_end>=reporting_period_start AND amendment_number>=0 AND (cash_on_hand IS NULL OR cash_on_hand>=0) AND (total_receipts IS NULL OR total_receipts>=0) AND (total_disbursements IS NULL OR total_disbursements>=0));
ALTER TABLE stg_elections ADD CONSTRAINT stg_elections_run_id_source_natural_key_pk PRIMARY KEY(run_id,source_natural_key), ADD CONSTRAINT stg_elections_run_id_release_id_ingest_runs_id_release_id_fk FOREIGN KEY(run_id,release_id) REFERENCES ingest_runs(id,release_id), ADD CONSTRAINT stg_elections_release_id_snapshot_id_source_snapshots_release_id_id_fk FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id), ADD CONSTRAINT stg_elections_fields_ck CHECK((votes IS NULL OR (votes>=0 AND votes=trunc(votes))) AND certification_status IN ('certified','official_unfinalized','unofficial','modeled','unavailable'));
ALTER TABLE acs_variables ADD CONSTRAINT acs_variables_unit_ck CHECK(unit IN ('count','percent','usd','years'));
CREATE INDEX biographical_facts_person_fk_idx ON biographical_facts(release_id,person_id);
CREATE INDEX funding_organization_aggregates_seat_fk_idx ON funding_organization_aggregates(release_id,seat_cycle_id);
CREATE INDEX quarantined_records_snapshot_fk_idx ON quarantined_records(release_id,snapshot_id);
CREATE INDEX stg_identity_snapshot_fk_idx ON stg_identity(release_id,snapshot_id);
CREATE INDEX stg_tiger_snapshot_fk_idx ON stg_tiger(release_id,snapshot_id);
CREATE INDEX stg_acs_snapshot_fk_idx ON stg_acs(release_id,snapshot_id);
CREATE INDEX stg_fec_snapshot_fk_idx ON stg_fec(release_id,snapshot_id);
CREATE INDEX stg_elections_snapshot_fk_idx ON stg_elections(release_id,snapshot_id);
CREATE INDEX committee_assignments_person_fk_idx ON committee_assignments(release_id,person_id);
CREATE INDEX committee_assignments_committee_fk_idx ON committee_assignments(release_id,committee_id);
CREATE UNIQUE INDEX election_decisions_natural_uq ON election_decisions(release_id,jurisdiction_code,election_year);
CREATE INDEX election_decisions_jurisdiction_fk_idx ON election_decisions(release_id,jurisdiction_code);
CREATE UNIQUE INDEX finance_aggregates_natural_uq ON finance_aggregates(release_id,seat_cycle_id,as_of,methodology_version);
CREATE INDEX finance_aggregates_seat_fk_idx ON finance_aggregates(release_id,seat_cycle_id);
CREATE UNIQUE INDEX map_artifacts_geography_uq ON map_artifacts(release_id,geography_version_id);
CREATE INDEX map_artifacts_artifact_fk_idx ON map_artifacts(release_id,artifact_id);

-- Frozen public-query paths: release/year enumeration, normalized identity, finance ordering, and presidential contest/result joins.
CREATE INDEX seat_cycles_release_year_id_idx ON seat_cycles(release_id,cycle_year,id);
CREATE INDEX people_display_name_search_idx ON people(release_id,lower(display_name),id);
CREATE INDEX finance_aggregates_cash_on_hand_sort_idx ON finance_aggregates(release_id,cash_on_hand DESC NULLS LAST,seat_cycle_id,id);
CREATE INDEX contests_presidential_kind_date_seat_idx ON contests(release_id,kind,election_date,seat_cycle_id,id);
CREATE INDEX result_options_presidential_party_contest_idx ON result_options(release_id,party,contest_id,id);
CREATE INDEX election_results_presidential_votes_idx ON election_results(release_id,contest_id,votes DESC NULLS LAST,result_option_id);
ALTER TABLE jurisdictions ADD CONSTRAINT jurisdictions_house_representation_ck CHECK(house_representation IN ('voting','delegate','resident_commissioner'));
ALTER TABLE jurisdictions ADD CONSTRAINT jurisdictions_senate_representation_ck CHECK(senate_representation IN ('two_seats','none'));
