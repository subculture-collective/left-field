CREATE TABLE "election_authority_artifacts" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"receipt_id" text NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"election_year" integer NOT NULL,
	"certification_status" text NOT NULL,
	"certified_at" timestamp with time zone,
	CONSTRAINT "election_authority_artifacts_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "election_authority_artifacts_ck" CHECK ("election_authority_artifacts"."election_year" IN (2020,2022,2024))
);
--> statement-breakpoint
ALTER TABLE "election_authority_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_geometry_attestations" (
	"release_id" text NOT NULL,
	"contest_key" text NOT NULL,
	"required" integer NOT NULL,
	"receipt_id" text,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	CONSTRAINT "election_geometry_attestations_release_id_contest_key_pk" PRIMARY KEY("release_id","contest_key"),
	CONSTRAINT "election_geometry_attestations_ck" CHECK ("election_geometry_attestations"."required" IN (0,1) AND ("election_geometry_attestations"."required"=0 OR "election_geometry_attestations"."receipt_id" IS NOT NULL) AND "election_geometry_attestations"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "election_geometry_attestations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_inventory_rows" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"election_year" integer NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"contest_key" text NOT NULL,
	"contest_kind" text NOT NULL,
	"boundary_kind" text NOT NULL,
	"inventory_receipt_id" text NOT NULL,
	"decision_run_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	CONSTRAINT "election_inventory_rows_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "election_inventory_rows_ck" CHECK ("election_inventory_rows"."election_year" IN (2020,2022,2024) AND "election_inventory_rows"."boundary_kind" IN ('original','modeled_current') AND "election_inventory_rows"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "election_inventory_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_launch_receipts" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"raw_store_kind" "raw_store_kind" NOT NULL,
	"store_identity" text NOT NULL,
	"object_key" text NOT NULL,
	"version_id" text,
	"etag" text,
	"authority" text NOT NULL,
	"source_url" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"version" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"source_lock_entry_id" text NOT NULL,
	"usage_status" text NOT NULL,
	CONSTRAINT "election_launch_receipts_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "election_launch_receipts_ck" CHECK ("election_launch_receipts"."sha256" ~ '^[a-f0-9]{64}$' AND "election_launch_receipts"."byte_size">0 AND "election_launch_receipts"."object_key" !~ '(^/|\\|(^|/)\.\.(/|$))' AND (("election_launch_receipts"."raw_store_kind"='local' AND "election_launch_receipts"."version_id" IS NULL AND "election_launch_receipts"."etag" IS NULL) OR ("election_launch_receipts"."raw_store_kind"='s3' AND "election_launch_receipts"."version_id" IS NOT NULL AND "election_launch_receipts"."etag" IS NOT NULL)) AND "election_launch_receipts"."usage_status" IN ('approved','restricted','rejected'))
);
--> statement-breakpoint
ALTER TABLE "election_launch_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_publication_proofs" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"canonical_sha256" text NOT NULL,
	"signed_review_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "election_publication_proofs_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "election_publication_proofs_sha_ck" CHECK ("election_publication_proofs"."canonical_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "election_publication_proofs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "election_result_envelopes" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"inventory_row_id" text NOT NULL,
	"authority_artifact_id" text NOT NULL,
	"disposition" text NOT NULL,
	"first_failed_gate" text,
	"denominator_votes" bigint,
	"reporting_completeness_percent" numeric,
	"certification_status" text,
	"reconciliation_status" text,
	"allocation_method" text,
	"allocation_coverage_percent" numeric,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	CONSTRAINT "election_result_envelopes_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "election_result_envelopes_ck" CHECK ("election_result_envelopes"."disposition" IN ('approved','unavailable') AND "election_result_envelopes"."subject_sha256" ~ '^[a-f0-9]{64}$' AND (("election_result_envelopes"."disposition"='approved' AND "election_result_envelopes"."first_failed_gate" IS NULL AND "election_result_envelopes"."denominator_votes" IS NOT NULL AND "election_result_envelopes"."reporting_completeness_percent" IS NOT NULL AND "election_result_envelopes"."certification_status" IS NOT NULL AND "election_result_envelopes"."reconciliation_status" IS NOT NULL AND "election_result_envelopes"."allocation_method" IS NOT NULL AND "election_result_envelopes"."allocation_coverage_percent" IS NOT NULL) OR ("election_result_envelopes"."disposition"='unavailable' AND "election_result_envelopes"."first_failed_gate" IS NOT NULL AND "election_result_envelopes"."denominator_votes" IS NULL AND "election_result_envelopes"."reporting_completeness_percent" IS NULL AND "election_result_envelopes"."certification_status" IS NULL AND "election_result_envelopes"."reconciliation_status" IS NULL AND "election_result_envelopes"."allocation_method" IS NULL AND "election_result_envelopes"."allocation_coverage_percent" IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "election_result_envelopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_result_rows" (
	"release_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"option_key" text NOT NULL,
	"votes" bigint NOT NULL,
	CONSTRAINT "election_result_rows_release_id_envelope_id_option_key_pk" PRIMARY KEY("release_id","envelope_id","option_key"),
	CONSTRAINT "election_result_rows_votes_ck" CHECK ("election_result_rows"."votes">=0)
);
--> statement-breakpoint
ALTER TABLE "election_result_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_amendment_closures" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"report_type" text NOT NULL,
	"reporting_period_start" date NOT NULL,
	"reporting_period_end" date NOT NULL,
	"expected_terminal_amendment" integer NOT NULL,
	"actual_terminal_amendment" integer NOT NULL,
	"expected_filing_id" text,
	"actual_filing_id" text,
	CONSTRAINT "finance_amendment_closures_release_id_seat_cycle_id_committee_id_report_type_reporting_period_start_reporting_period_end_pk" PRIMARY KEY("release_id","seat_cycle_id","committee_id","report_type","reporting_period_start","reporting_period_end"),
	CONSTRAINT "finance_amendment_closures_ck" CHECK ("finance_amendment_closures"."subject_sha256" ~ '^[a-f0-9]{64}$' AND "finance_amendment_closures"."expected_terminal_amendment">=0 AND "finance_amendment_closures"."actual_terminal_amendment">=0)
);
--> statement-breakpoint
ALTER TABLE "finance_amendment_closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_candidate_mappings" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"fec_candidate_id" text,
	"campaign_cycle" integer,
	"candidacy_key" text,
	"outcome" text NOT NULL,
	"receipt_id" text NOT NULL,
	CONSTRAINT "finance_candidate_mappings_release_id_seat_cycle_id_pk" PRIMARY KEY("release_id","seat_cycle_id"),
	CONSTRAINT "finance_candidate_mappings_ck" CHECK ("finance_candidate_mappings"."outcome" IN ('mapped','no_declared_cycle','unresolved') AND "finance_candidate_mappings"."subject_sha256" ~ '^[a-f0-9]{64}$' AND ("finance_candidate_mappings"."outcome"='mapped') = ("finance_candidate_mappings"."fec_candidate_id" IS NOT NULL AND "finance_candidate_mappings"."campaign_cycle" IS NOT NULL AND "finance_candidate_mappings"."candidacy_key" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "finance_candidate_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_committee_mappings" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"fec_candidate_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"designation" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"receipt_id" text NOT NULL,
	CONSTRAINT "finance_committee_mappings_release_id_seat_cycle_id_fec_candidate_id_committee_id_designation_effective_from_pk" PRIMARY KEY("release_id","seat_cycle_id","fec_candidate_id","committee_id","designation","effective_from"),
	CONSTRAINT "finance_committee_mappings_ck" CHECK ("finance_committee_mappings"."subject_sha256" ~ '^[a-f0-9]{64}$' AND ("finance_committee_mappings"."effective_to" IS NULL OR "finance_committee_mappings"."effective_to">"finance_committee_mappings"."effective_from"))
);
--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_coverage_closures" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "finance_coverage_closures_release_id_seat_cycle_id_kind_pk" PRIMARY KEY("release_id","seat_cycle_id","kind"),
	CONSTRAINT "finance_coverage_closures_ck" CHECK ("finance_coverage_closures"."kind" IN ('summary','category','organization','outside_spending') AND "finance_coverage_closures"."status" IN ('complete','not_collected') AND "finance_coverage_closures"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "finance_coverage_closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_deletion_attestations" (
	"release_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	"deleted_at" timestamp with time zone NOT NULL,
	"attestation_sha256" text NOT NULL,
	CONSTRAINT "finance_deletion_attestations_release_id_receipt_id_pk" PRIMARY KEY("release_id","receipt_id"),
	CONSTRAINT "finance_deletion_attestations_sha_ck" CHECK ("finance_deletion_attestations"."attestation_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "finance_deletion_attestations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_launch_receipts" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"raw_store_kind" "raw_store_kind" NOT NULL,
	"store_identity" text NOT NULL,
	"object_key" text NOT NULL,
	"version_id" text,
	"etag" text,
	"acquisition_batch" text NOT NULL,
	"source_url" text NOT NULL,
	"request_sha256" text NOT NULL,
	"response_sha256" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"source_lock_entry_id" text NOT NULL,
	"usage_status" text NOT NULL,
	"retention" text NOT NULL,
	"page_number" integer NOT NULL,
	"cursor_in" text,
	"cursor_out" text,
	"terminal_page" integer NOT NULL,
	CONSTRAINT "finance_launch_receipts_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "finance_launch_receipts_ck" CHECK ("finance_launch_receipts"."request_sha256" ~ '^[a-f0-9]{64}$' AND "finance_launch_receipts"."response_sha256" ~ '^[a-f0-9]{64}$' AND "finance_launch_receipts"."byte_size">0 AND "finance_launch_receipts"."object_key" !~ '(^/|\\|(^|/)\.\.(/|$))' AND (("finance_launch_receipts"."raw_store_kind"='local' AND "finance_launch_receipts"."version_id" IS NULL AND "finance_launch_receipts"."etag" IS NULL) OR ("finance_launch_receipts"."raw_store_kind"='s3' AND "finance_launch_receipts"."version_id" IS NOT NULL AND "finance_launch_receipts"."etag" IS NOT NULL)) AND "finance_launch_receipts"."terminal_page" IN (0,1) AND "finance_launch_receipts"."usage_status" IN ('approved','restricted','rejected'))
);
--> statement-breakpoint
ALTER TABLE "finance_launch_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_page_closures" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"acquisition_batch" text NOT NULL,
	"expected_terminal_page" integer NOT NULL,
	"actual_terminal_page" integer NOT NULL,
	"expected_cursor_out" text,
	"actual_cursor_out" text,
	CONSTRAINT "finance_page_closures_release_id_seat_cycle_id_acquisition_batch_pk" PRIMARY KEY("release_id","seat_cycle_id","acquisition_batch"),
	CONSTRAINT "finance_page_closures_ck" CHECK ("finance_page_closures"."subject_sha256" ~ '^[a-f0-9]{64}$' AND "finance_page_closures"."expected_terminal_page">=1 AND "finance_page_closures"."actual_terminal_page">=1)
);
--> statement-breakpoint
ALTER TABLE "finance_page_closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_publication_proofs" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"canonical_sha256" text NOT NULL,
	"signed_review_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "finance_publication_proofs_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "finance_publication_proofs_sha_ck" CHECK ("finance_publication_proofs"."canonical_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "finance_publication_proofs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "finance_terminal_dispositions" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"outcome" text NOT NULL,
	CONSTRAINT "finance_terminal_dispositions_release_id_seat_cycle_id_pk" PRIMARY KEY("release_id","seat_cycle_id"),
	CONSTRAINT "finance_terminal_dispositions_ck" CHECK ("finance_terminal_dispositions"."outcome" IN ('approved_finance','vacancy','no_declared_cycle','no_authorized_committee','no_report') AND "finance_terminal_dispositions"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "finance_terminal_dispositions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "election_result_receipt_lineage" (
	"release_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	CONSTRAINT "election_result_receipt_lineage_release_id_envelope_id_receipt_id_pk" PRIMARY KEY("release_id","envelope_id","receipt_id")
);
--> statement-breakpoint
ALTER TABLE "election_result_receipt_lineage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviewer_signatures" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	"key_id" text NOT NULL,
	CONSTRAINT "reviewer_signatures_release_id_review_id_pk" PRIMARY KEY("release_id","review_id"),
	CONSTRAINT "reviewer_signatures_ck" CHECK ("reviewer_signatures"."subject_type" IN ('fec_mapping','committee_mapping','finance_page_closure','finance_amendment_closure','vacancy','finance_terminal','finance_closure','election_decision','election_result','election_geometry','publication') AND "reviewer_signatures"."subject_sha256" ~ '^[a-f0-9]{64}$' AND length("reviewer_signatures"."signature") > 0)
);
--> statement-breakpoint
ALTER TABLE "reviewer_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vacancy_reviews" (
	"release_id" text NOT NULL,
	"review_id" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	CONSTRAINT "vacancy_reviews_release_id_seat_cycle_id_pk" PRIMARY KEY("release_id","seat_cycle_id"),
	CONSTRAINT "vacancy_reviews_sha_ck" CHECK ("vacancy_reviews"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "vacancy_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_aggregates" DROP CONSTRAINT "finance_aggregates_cash_ck";--> statement-breakpoint
ALTER TABLE "finance_aggregates" DROP CONSTRAINT "finance_aggregates_receipts_ck";--> statement-breakpoint
ALTER TABLE "finance_aggregates" DROP CONSTRAINT "finance_aggregates_disbursements_ck";--> statement-breakpoint
ALTER TABLE "funding_category_aggregates" DROP CONSTRAINT "funding_category_amount_ck";--> statement-breakpoint
ALTER TABLE "funding_organization_aggregates" DROP CONSTRAINT "funding_organization_amount_ck";--> statement-breakpoint
ALTER TABLE "outside_spending_aggregates" DROP CONSTRAINT "outside_spending_support_ck";--> statement-breakpoint
ALTER TABLE "outside_spending_aggregates" DROP CONSTRAINT "outside_spending_oppose_ck";--> statement-breakpoint
ALTER TABLE "stg_fec" DROP CONSTRAINT "stg_fec_fields_ck";--> statement-breakpoint
ALTER TABLE "election_authority_artifacts" ADD CONSTRAINT "election_authority_artifacts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_authority_artifacts" ADD CONSTRAINT "election_authority_artifacts_release_id_receipt_id_election_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."election_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_geometry_attestations" ADD CONSTRAINT "election_geometry_attestations_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_geometry_attestations" ADD CONSTRAINT "election_geometry_attestations_release_id_receipt_id_election_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."election_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_geometry_attestations" ADD CONSTRAINT "election_geometry_attestations_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_inventory_rows" ADD CONSTRAINT "election_inventory_rows_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_inventory_rows" ADD CONSTRAINT "election_inventory_rows_release_id_inventory_receipt_id_election_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","inventory_receipt_id") REFERENCES "public"."election_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_inventory_rows" ADD CONSTRAINT "election_inventory_rows_release_id_decision_run_id_election_decisions_release_id_id_fk" FOREIGN KEY ("release_id","decision_run_id") REFERENCES "public"."election_decisions"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_inventory_rows" ADD CONSTRAINT "election_inventory_rows_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_launch_receipts" ADD CONSTRAINT "election_launch_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_publication_proofs" ADD CONSTRAINT "election_publication_proofs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_publication_proofs" ADD CONSTRAINT "election_publication_proofs_release_id_signed_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","signed_review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_envelopes" ADD CONSTRAINT "election_result_envelopes_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_envelopes" ADD CONSTRAINT "election_result_envelopes_release_id_inventory_row_id_election_inventory_rows_release_id_id_fk" FOREIGN KEY ("release_id","inventory_row_id") REFERENCES "public"."election_inventory_rows"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_envelopes" ADD CONSTRAINT "election_result_envelopes_release_id_authority_artifact_id_election_authority_artifacts_release_id_id_fk" FOREIGN KEY ("release_id","authority_artifact_id") REFERENCES "public"."election_authority_artifacts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_envelopes" ADD CONSTRAINT "election_result_envelopes_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_rows" ADD CONSTRAINT "election_result_rows_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_rows" ADD CONSTRAINT "election_result_rows_release_id_envelope_id_election_result_envelopes_release_id_id_fk" FOREIGN KEY ("release_id","envelope_id") REFERENCES "public"."election_result_envelopes"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_amendment_closures" ADD CONSTRAINT "finance_amendment_closures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_amendment_closures" ADD CONSTRAINT "finance_amendment_closures_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_amendment_closures" ADD CONSTRAINT "finance_amendment_closures_release_id_committee_id_committees_release_id_id_fk" FOREIGN KEY ("release_id","committee_id") REFERENCES "public"."committees"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_amendment_closures" ADD CONSTRAINT "finance_amendment_closures_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_candidate_mappings" ADD CONSTRAINT "finance_candidate_mappings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_candidate_mappings" ADD CONSTRAINT "finance_candidate_mappings_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_candidate_mappings" ADD CONSTRAINT "finance_candidate_mappings_release_id_receipt_id_finance_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."finance_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_candidate_mappings" ADD CONSTRAINT "finance_candidate_mappings_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ADD CONSTRAINT "finance_committee_mappings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ADD CONSTRAINT "finance_committee_mappings_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ADD CONSTRAINT "finance_committee_mappings_release_id_committee_id_committees_release_id_id_fk" FOREIGN KEY ("release_id","committee_id") REFERENCES "public"."committees"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ADD CONSTRAINT "finance_committee_mappings_release_id_receipt_id_finance_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."finance_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_committee_mappings" ADD CONSTRAINT "finance_committee_mappings_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_coverage_closures" ADD CONSTRAINT "finance_coverage_closures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_coverage_closures" ADD CONSTRAINT "finance_coverage_closures_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_coverage_closures" ADD CONSTRAINT "finance_coverage_closures_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_deletion_attestations" ADD CONSTRAINT "finance_deletion_attestations_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_deletion_attestations" ADD CONSTRAINT "finance_deletion_attestations_release_id_receipt_id_finance_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."finance_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_launch_receipts" ADD CONSTRAINT "finance_launch_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_page_closures" ADD CONSTRAINT "finance_page_closures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_page_closures" ADD CONSTRAINT "finance_page_closures_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_page_closures" ADD CONSTRAINT "finance_page_closures_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_publication_proofs" ADD CONSTRAINT "finance_publication_proofs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_publication_proofs" ADD CONSTRAINT "finance_publication_proofs_release_id_signed_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","signed_review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_terminal_dispositions" ADD CONSTRAINT "finance_terminal_dispositions_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_terminal_dispositions" ADD CONSTRAINT "finance_terminal_dispositions_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_terminal_dispositions" ADD CONSTRAINT "finance_terminal_dispositions_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_receipt_lineage" ADD CONSTRAINT "election_result_receipt_lineage_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_receipt_lineage" ADD CONSTRAINT "election_result_receipt_lineage_release_id_envelope_id_election_result_envelopes_release_id_id_fk" FOREIGN KEY ("release_id","envelope_id") REFERENCES "public"."election_result_envelopes"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_result_receipt_lineage" ADD CONSTRAINT "election_result_receipt_lineage_release_id_receipt_id_election_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."election_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_signatures" ADD CONSTRAINT "reviewer_signatures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_reviews" ADD CONSTRAINT "vacancy_reviews_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_reviews" ADD CONSTRAINT "vacancy_reviews_release_id_seat_cycle_id_seat_cycles_release_id_id_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_reviews" ADD CONSTRAINT "vacancy_reviews_release_id_receipt_id_finance_launch_receipts_release_id_id_fk" FOREIGN KEY ("release_id","receipt_id") REFERENCES "public"."finance_launch_receipts"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancy_reviews" ADD CONSTRAINT "vacancy_reviews_release_id_review_id_reviewer_signatures_release_id_review_id_fk" FOREIGN KEY ("release_id","review_id") REFERENCES "public"."reviewer_signatures"("release_id","review_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "election_authority_artifacts_natural_uq" ON "election_authority_artifacts" USING btree ("release_id","receipt_id","jurisdiction_code","election_year");--> statement-breakpoint
CREATE UNIQUE INDEX "election_inventory_rows_natural_uq" ON "election_inventory_rows" USING btree ("release_id","election_year","jurisdiction_code","contest_key","boundary_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "election_launch_receipts_natural_uq" ON "election_launch_receipts" USING btree ("release_id","authority","source_lock_entry_id","sha256","version");--> statement-breakpoint
CREATE UNIQUE INDEX "election_result_envelopes_inventory_uq" ON "election_result_envelopes" USING btree ("release_id","inventory_row_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_launch_receipts_natural_uq" ON "finance_launch_receipts" USING btree ("release_id","acquisition_batch","source_lock_entry_id","request_sha256","response_sha256","page_number");--> statement-breakpoint
CREATE UNIQUE INDEX "reviewer_signatures_subject_uq" ON "reviewer_signatures" USING btree ("release_id","subject_type","subject_sha256","reviewer_id");--> statement-breakpoint
ALTER TABLE "finance_aggregates" ADD CONSTRAINT "finance_aggregates_cash_ck" CHECK (("finance_aggregates"."cash_on_hand" IS NULL) <> ("finance_aggregates"."cash_on_hand_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "finance_aggregates" ADD CONSTRAINT "finance_aggregates_receipts_ck" CHECK (("finance_aggregates"."receipts" IS NULL) <> ("finance_aggregates"."receipts_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "finance_aggregates" ADD CONSTRAINT "finance_aggregates_disbursements_ck" CHECK (("finance_aggregates"."disbursements" IS NULL) <> ("finance_aggregates"."disbursements_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "funding_category_aggregates" ADD CONSTRAINT "funding_category_amount_ck" CHECK (("funding_category_aggregates"."amount" IS NULL) <> ("funding_category_aggregates"."amount_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "funding_organization_aggregates" ADD CONSTRAINT "funding_organization_amount_ck" CHECK (("funding_organization_aggregates"."amount" IS NULL) <> ("funding_organization_aggregates"."amount_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "outside_spending_aggregates" ADD CONSTRAINT "outside_spending_support_ck" CHECK (("outside_spending_aggregates"."support_amount" IS NULL) <> ("outside_spending_aggregates"."support_amount_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "outside_spending_aggregates" ADD CONSTRAINT "outside_spending_oppose_ck" CHECK (("outside_spending_aggregates"."oppose_amount" IS NULL) <> ("outside_spending_aggregates"."oppose_amount_missing_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "stg_fec" ADD CONSTRAINT "stg_fec_fields_ck" CHECK ("stg_fec"."reporting_period_end">="stg_fec"."reporting_period_start" AND "stg_fec"."amendment_number">=0);--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_launch_operational_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE r text; BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'launch operational evidence is append-only' USING ERRCODE='55000'; END IF; r:=NEW.release_id; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||r)); IF NOT EXISTS(SELECT 1 FROM public.data_releases WHERE id=r AND status='candidate') OR EXISTS(SELECT 1 FROM public.release_preflight_proofs WHERE target_release_id=r AND consumed_at IS NULL AND expires_at>=clock_timestamp()) OR EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations WHERE target_release_id=r AND consumed_at IS NULL AND expires_at>=clock_timestamp()) THEN RAISE EXCEPTION 'launch operational evidence requires an unfrozen candidate release' USING ERRCODE='55000'; END IF; RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_launch_receipts','finance_deletion_attestations','finance_candidate_mappings','finance_committee_mappings','finance_page_closures','finance_amendment_closures','vacancy_reviews','finance_terminal_dispositions','finance_coverage_closures'] LOOP
    EXECUTE format('CREATE TRIGGER launch_content_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content(''finance'')',t,t);
    EXECUTE format('CREATE TRIGGER launch_preflight_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content()',t,t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['election_launch_receipts','election_inventory_rows','election_geometry_attestations','election_authority_artifacts','election_result_envelopes','election_result_rows','election_result_receipt_lineage'] LOOP
    EXECUTE format('CREATE TRIGGER launch_content_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content(''elections'')',t,t);
    EXECUTE format('CREATE TRIGGER launch_preflight_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content()',t,t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['reviewer_signatures','finance_publication_proofs','election_publication_proofs'] LOOP
    EXECUTE format('CREATE TRIGGER launch_operational_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_launch_operational_evidence()',t,t);
  END LOOP;
END $$;--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['finance_launch_receipts','finance_deletion_attestations','finance_candidate_mappings','finance_committee_mappings','finance_page_closures','finance_amendment_closures','vacancy_reviews','finance_terminal_dispositions','finance_coverage_closures','election_launch_receipts','election_inventory_rows','election_geometry_attestations','election_authority_artifacts','election_result_envelopes','election_result_rows','election_result_receipt_lineage','reviewer_signatures','finance_publication_proofs','election_publication_proofs'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO dsa_seats_migration_owner',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM dsa_seats_web,dsa_seats_ingest,dsa_seats_release_preflight,dsa_seats_release_operator',t);
    EXECUTE format('CREATE POLICY launch_ingest_read ON public.%I FOR SELECT TO dsa_seats_ingest USING(true)',t);
    EXECUTE format('CREATE POLICY launch_preflight_read ON public.%I FOR SELECT TO dsa_seats_release_preflight USING(true)',t);
    EXECUTE format('CREATE POLICY launch_ingest_candidate ON public.%I FOR ALL TO dsa_seats_ingest USING(EXISTS(SELECT 1 FROM public.data_releases r WHERE r.id=release_id AND r.status=''candidate'')) WITH CHECK(EXISTS(SELECT 1 FROM public.data_releases r WHERE r.id=release_id AND r.status=''candidate''))',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['finance_launch_receipts','finance_deletion_attestations','finance_candidate_mappings','finance_committee_mappings','finance_page_closures','finance_amendment_closures','vacancy_reviews','finance_terminal_dispositions','finance_coverage_closures','election_launch_receipts','election_inventory_rows','election_geometry_attestations','election_authority_artifacts','election_result_envelopes','election_result_rows','election_result_receipt_lineage'] LOOP EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_ingest',t); END LOOP;
  FOREACH t IN ARRAY ARRAY['reviewer_signatures','finance_publication_proofs','election_publication_proofs'] LOOP EXECUTE format('GRANT SELECT,INSERT ON public.%I TO dsa_seats_ingest',t); END LOOP;
  FOREACH t IN ARRAY ARRAY['finance_launch_receipts','finance_deletion_attestations','finance_candidate_mappings','finance_committee_mappings','finance_page_closures','finance_amendment_closures','vacancy_reviews','finance_terminal_dispositions','finance_coverage_closures','election_launch_receipts','election_inventory_rows','election_geometry_attestations','election_authority_artifacts','election_result_envelopes','election_result_rows','election_result_receipt_lineage','reviewer_signatures','finance_publication_proofs','election_publication_proofs'] LOOP EXECUTE format('GRANT SELECT ON public.%I TO dsa_seats_release_preflight',t); END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.guard_launch_review_subject() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE expected text; review text; hash text;
BEGIN
  IF TG_TABLE_NAME IN ('finance_publication_proofs','election_publication_proofs') THEN review:=NEW.signed_review_id; hash:=NEW.canonical_sha256; ELSE review:=NEW.review_id; hash:=NEW.subject_sha256; END IF;
  expected:=CASE TG_TABLE_NAME WHEN 'finance_candidate_mappings' THEN 'fec_mapping' WHEN 'finance_committee_mappings' THEN 'committee_mapping' WHEN 'finance_page_closures' THEN 'finance_page_closure' WHEN 'finance_amendment_closures' THEN 'finance_amendment_closure' WHEN 'vacancy_reviews' THEN 'vacancy' WHEN 'finance_terminal_dispositions' THEN 'finance_terminal' WHEN 'finance_coverage_closures' THEN 'finance_closure' WHEN 'election_inventory_rows' THEN 'election_decision' WHEN 'election_geometry_attestations' THEN 'election_geometry' WHEN 'election_result_envelopes' THEN 'election_result' ELSE 'publication' END;
  IF NOT EXISTS(SELECT 1 FROM public.reviewer_signatures s WHERE s.release_id=NEW.release_id AND s.review_id=review AND s.subject_type=expected AND s.subject_sha256=hash) THEN RAISE EXCEPTION 'launch review subject/type mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION public.guard_launch_review_subject() OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.guard_launch_review_subject() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['finance_candidate_mappings','finance_committee_mappings','finance_page_closures','finance_amendment_closures','vacancy_reviews','finance_terminal_dispositions','finance_coverage_closures','election_inventory_rows','election_geometry_attestations','election_result_envelopes','finance_publication_proofs','election_publication_proofs'] LOOP EXECUTE format('CREATE TRIGGER launch_review_subject_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_launch_review_subject()',t,t); END LOOP; END $$;
ALTER TABLE public.release_preflight_proofs ADD COLUMN operational_evidence_fingerprint text NOT NULL DEFAULT encode(digest('', 'sha256'), 'hex');
ALTER TABLE public.release_preflight_proofs ADD CONSTRAINT release_preflight_proofs_operational_evidence_sha_ck CHECK(operational_evidence_fingerprint ~ '^[a-f0-9]{64}$');
ALTER TABLE public.release_preflight_proofs ALTER COLUMN operational_evidence_fingerprint DROP DEFAULT;
CREATE OR REPLACE FUNCTION public.operational_evidence_fingerprint(p_target text,p_predecessor text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ WITH releases(id) AS (SELECT p_target UNION SELECT p_predecessor WHERE p_predecessor IS NOT NULL), records(record) AS (SELECT jsonb_build_object('table','reviewer_signatures','release_id',release_id,'review_id',review_id,'subject_type',subject_type,'subject_sha256',subject_sha256,'reviewer_id',reviewer_id,'signed_at',to_char(signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'signature',signature,'key_id',key_id) FROM public.reviewer_signatures WHERE release_id IN(SELECT id FROM releases) UNION ALL SELECT jsonb_build_object('table','finance_publication_proofs','release_id',release_id,'id',id,'canonical_sha256',canonical_sha256,'signed_review_id',signed_review_id,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.finance_publication_proofs WHERE release_id IN(SELECT id FROM releases) UNION ALL SELECT jsonb_build_object('table','election_publication_proofs','release_id',release_id,'id',id,'canonical_sha256',canonical_sha256,'signed_review_id',signed_review_id,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.election_publication_proofs WHERE release_id IN(SELECT id FROM releases)) SELECT encode(digest(coalesce(string_agg(record::text,E'\n' ORDER BY record::text COLLATE "C"),''),'sha256'),'hex') FROM records $$;
ALTER FUNCTION public.guard_launch_operational_evidence() OWNER TO dsa_seats_migration_owner; ALTER FUNCTION public.operational_evidence_fingerprint(text,text) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.guard_launch_operational_evidence(),public.operational_evidence_fingerprint(text,text) FROM PUBLIC;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['reviewer_signatures','finance_publication_proofs','election_publication_proofs'] LOOP EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,dsa_seats_web,dsa_seats_release_operator',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.assert_task9_publication_ready(p_release_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_release_id) THEN RETURN; END IF;
 IF (SELECT count(*) FROM public.election_decisions WHERE release_id=p_release_id)<>158 OR EXISTS(SELECT 1 FROM public.election_decisions ed WHERE ed.release_id=p_release_id AND (ed.status='unassessed' OR (SELECT count(*) FROM public.election_decision_inputs i WHERE i.release_id=ed.release_id AND i.election_decision_id=ed.id)<>1)) OR EXISTS(SELECT 1 FROM public.election_decision_inputs i LEFT JOIN public.ingest_runs ir ON ir.release_id=i.release_id AND ir.snapshot_id=i.snapshot_id AND ir.status='loaded' WHERE i.release_id=p_release_id AND ir.id IS NULL) THEN RAISE EXCEPTION 'release lacks exact Task 9 publication closure'; END IF;
END $$;
ALTER FUNCTION public.assert_task9_publication_ready(text) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.assert_task9_publication_ready(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.assert_lifecycle_run_ids(p_target text,p_predecessor text,p_run_ids text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE proof_release text; has_maps boolean; reviewed boolean; BEGIN
 SELECT EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_target),EXISTS(SELECT 1 FROM public.election_decisions WHERE release_id=p_target AND status<>'unassessed') INTO has_maps,reviewed;
 proof_release:=CASE WHEN has_maps THEN p_predecessor ELSE p_target END;
 IF proof_release IS NOT NULL AND EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=proof_release) THEN IF p_run_ids IS NOT NULL AND cardinality(p_run_ids)<>0 THEN RAISE EXCEPTION 'proofed election transition must not use legacy run IDs'; END IF; RETURN; END IF;
 IF NOT has_maps AND NOT reviewed THEN IF p_run_ids IS NOT NULL AND cardinality(p_run_ids)<>0 THEN RAISE EXCEPTION 'all-unassessed mapless transition requires no election run IDs'; END IF; RETURN; END IF;
 IF proof_release IS NULL OR p_run_ids IS NULL OR cardinality(p_run_ids)<>158 OR (SELECT count(DISTINCT x) FROM unnest(p_run_ids) x)<>158 OR EXISTS(SELECT 1 FROM unnest(p_run_ids) x LEFT JOIN public.ingest_runs r ON r.id=x AND r.release_id=proof_release AND r.status='loaded' WHERE r.id IS NULL) OR EXISTS((SELECT i.snapshot_id FROM public.election_decisions d JOIN public.election_decision_inputs i ON i.release_id=d.release_id AND i.election_decision_id=d.id WHERE d.release_id=proof_release EXCEPT SELECT r.snapshot_id FROM public.ingest_runs r WHERE r.release_id=proof_release AND r.status='loaded' AND r.id=ANY(p_run_ids)) UNION ALL (SELECT r.snapshot_id FROM public.ingest_runs r WHERE r.release_id=proof_release AND r.status='loaded' AND r.id=ANY(p_run_ids) EXCEPT SELECT i.snapshot_id FROM public.election_decisions d JOIN public.election_decision_inputs i ON i.release_id=d.release_id AND i.election_decision_id=d.id WHERE d.release_id=proof_release)) THEN RAISE EXCEPTION 'transition requires exactly the reviewed-decision run set'; END IF;
END $$;
ALTER FUNCTION public.assert_lifecycle_run_ids(text,text,text[]) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.assert_lifecycle_run_ids(text,text,text[]) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.issue_release_preflight(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_run_ids text[],p_ttl_seconds integer DEFAULT 300) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE f record; issued timestamptz:=clock_timestamp(); o text; BEGIN IF NOT pg_has_role(session_user,'dsa_seats_release_preflight','member') AND current_setting('is_superuser')<>'on' THEN RAISE EXCEPTION 'only preflight role may issue proofs' USING ERRCODE='42501'; END IF; IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_operation NOT IN('promote','roll_forward') OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid preflight capability' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor); IF EXISTS(SELECT 1 FROM public.release_preflight_proofs WHERE consumed_at IS NULL AND expires_at>=issued AND (operation,target_release_id,current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)) THEN RAISE EXCEPTION 'a live preflight proof already exists for this lifecycle state' USING ERRCODE='23505'; END IF; PERFORM public.assert_lifecycle_ready(p_target,p_predecessor); PERFORM public.assert_lifecycle_run_ids(p_target,p_predecessor,p_run_ids); SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,p_run_ids); SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO o; INSERT INTO public.release_preflight_proofs(id,operation,target_release_id,current_release_id,predecessor_release_id,run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at) VALUES(p_id,p_operation,p_target,p_current,p_predecessor,f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o,session_user,issued,issued+make_interval(secs=>p_ttl_seconds),NULL); END $$;
CREATE OR REPLACE FUNCTION public.consume_release_preflight(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_run_ids text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE p public.release_preflight_proofs%ROWTYPE; f record; o text; BEGIN IF NOT pg_has_role(session_user,'dsa_seats_release_operator','member') AND current_setting('is_superuser')<>'on' THEN RAISE EXCEPTION 'only release operator may consume proofs' USING ERRCODE='42501'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); SELECT * INTO p FROM public.release_preflight_proofs WHERE id=p_id FOR UPDATE; IF NOT FOUND OR p.consumed_at IS NOT NULL OR p.expires_at<clock_timestamp() OR (p.operation,p.target_release_id,p.current_release_id,p.predecessor_release_id) IS DISTINCT FROM(p_operation,p_target,p_current,p_predecessor) THEN RAISE EXCEPTION 'invalid, expired, or consumed preflight proof' USING ERRCODE='42501'; END IF; PERFORM public.assert_lifecycle_ready(p_target,p_predecessor); PERFORM public.assert_lifecycle_run_ids(p_target,p_predecessor,p_run_ids); SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,p_run_ids); SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO o; IF (p.run_ids_fingerprint,p.map_receipts_fingerprint,p.manifest_fingerprint,p.gate_fingerprint,p.digest_fingerprint,p.operational_evidence_fingerprint) IS DISTINCT FROM(f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o) THEN RAISE EXCEPTION 'preflight proof no longer matches release content' USING ERRCODE='23514'; END IF; UPDATE public.release_preflight_proofs SET consumed_at=clock_timestamp() WHERE id=p_id; END $$;
ALTER FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer) OWNER TO dsa_seats_migration_owner; ALTER FUNCTION public.consume_release_preflight(text,text,text,text,text,text[]) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer),public.consume_release_preflight(text,text,text,text,text,text[]) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer) TO dsa_seats_release_preflight;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_launch_verifier') THEN CREATE ROLE dsa_seats_launch_verifier NOLOGIN NOINHERIT; END IF; END $$;
ALTER ROLE dsa_seats_launch_verifier INHERIT;
GRANT dsa_seats_release_preflight TO dsa_seats_launch_verifier;
GRANT USAGE ON SCHEMA public TO dsa_seats_launch_verifier;
CREATE TABLE public.release_launch_verifier_attestations (
 id text PRIMARY KEY NOT NULL, operation text NOT NULL, target_release_id text NOT NULL, current_release_id text, predecessor_release_id text,
 proof_kind text NOT NULL, canonical_sha256 text NOT NULL, run_ids_fingerprint text NOT NULL, map_receipts_fingerprint text NOT NULL, manifest_fingerprint text NOT NULL, gate_fingerprint text NOT NULL, digest_fingerprint text NOT NULL, operational_evidence_fingerprint text NOT NULL, issued_by text NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL, consumed_at timestamptz,
 CONSTRAINT release_launch_verifier_attestations_id_ck CHECK(id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 CONSTRAINT release_launch_verifier_attestations_operation_ck CHECK(operation IN('promote','roll_forward')),
 CONSTRAINT release_launch_verifier_attestations_kind_ck CHECK(proof_kind IN('finance','election','maps')),
 CONSTRAINT release_launch_verifier_attestations_sha_ck CHECK(canonical_sha256 ~ '^[a-f0-9]{64}$' AND run_ids_fingerprint ~ '^[a-f0-9]{64}$' AND map_receipts_fingerprint ~ '^[a-f0-9]{64}$' AND manifest_fingerprint ~ '^[a-f0-9]{64}$' AND gate_fingerprint ~ '^[a-f0-9]{64}$' AND digest_fingerprint ~ '^[a-f0-9]{64}$' AND operational_evidence_fingerprint ~ '^[a-f0-9]{64}$'),
 CONSTRAINT release_launch_verifier_attestations_expiry_ck CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '5 minutes'),
 FOREIGN KEY(target_release_id) REFERENCES public.data_releases(id), FOREIGN KEY(current_release_id) REFERENCES public.data_releases(id), FOREIGN KEY(predecessor_release_id) REFERENCES public.data_releases(id)
);
ALTER TABLE public.release_launch_verifier_attestations OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON public.release_launch_verifier_attestations FROM PUBLIC,dsa_seats_web,dsa_seats_ingest,dsa_seats_release_preflight,dsa_seats_release_operator,dsa_seats_launch_verifier;
ALTER TABLE public.release_preflight_proofs ADD COLUMN launch_attestation_id text REFERENCES public.release_launch_verifier_attestations(id);
CREATE OR REPLACE FUNCTION public.guard_live_preflight_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE r text; BEGIN r:=CASE WHEN TG_OP='DELETE' THEN OLD.release_id ELSE NEW.release_id END; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||r)); IF EXISTS(SELECT 1 FROM public.release_preflight_proofs WHERE target_release_id=r AND consumed_at IS NULL AND expires_at>=clock_timestamp()) OR EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations WHERE target_release_id=r AND consumed_at IS NULL AND expires_at>=clock_timestamp()) THEN RAISE EXCEPTION 'candidate content is frozen by live publication verification' USING ERRCODE='55000'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
ALTER FUNCTION public.guard_live_preflight_content() OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.guard_live_preflight_content() FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.launch_has_finance_facts(p_release text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.fec_filing_summaries f WHERE f.release_id=p_release UNION ALL SELECT 1 FROM public.seat_finance_summaries f WHERE f.release_id=p_release AND f.filing_id IS NOT NULL UNION ALL SELECT 1 FROM public.finance_aggregates f WHERE f.release_id=p_release AND (f.cash_on_hand IS NOT NULL OR f.receipts IS NOT NULL OR f.disbursements IS NOT NULL) UNION ALL SELECT 1 FROM public.funding_category_aggregates f WHERE f.release_id=p_release AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM public.funding_organization_aggregates f WHERE f.release_id=p_release AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM public.outside_spending_aggregates f WHERE f.release_id=p_release AND (f.support_amount IS NOT NULL OR f.oppose_amount IS NOT NULL)) $$;
CREATE OR REPLACE FUNCTION public.launch_has_election_facts(p_release text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.election_decisions e WHERE e.release_id=p_release AND e.status<>'unassessed' UNION ALL SELECT 1 FROM public.contests c WHERE c.release_id=p_release AND EXTRACT(YEAR FROM c.election_date)::int IN(2020,2022,2024) UNION ALL SELECT 1 FROM public.election_results e WHERE e.release_id=p_release) $$;
ALTER FUNCTION public.launch_has_finance_facts(text) OWNER TO dsa_seats_migration_owner; ALTER FUNCTION public.launch_has_election_facts(text) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.launch_has_finance_facts(text),public.launch_has_election_facts(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.assert_launch_stage(p_target text,p_predecessor text,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE target_finance boolean:=EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_target); target_election boolean:=EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target); predecessor_finance boolean:=EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor); predecessor_election boolean:=EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor); BEGIN
 IF p_kind='finance' THEN
  IF (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT target_finance OR NOT public.launch_has_finance_facts(p_target) OR target_election OR public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR predecessor_finance OR predecessor_election OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'invalid exact R1 to R2 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='election' THEN
  IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR NOT target_finance OR NOT target_election OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_predecessor)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR NOT predecessor_finance OR NOT public.launch_has_finance_facts(p_predecessor) OR predecessor_election OR public.launch_has_election_facts(p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain='finance' WHERE t.release_id=p_target AND t.domain='finance' AND (t.row_count,t.sha256)=(p.row_count,p.sha256)) THEN RAISE EXCEPTION 'invalid exact R2 to R3 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='maps' THEN
  IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT target_finance OR NOT target_election OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR NOT predecessor_finance OR NOT predecessor_election OR NOT public.launch_has_finance_facts(p_predecessor) OR NOT public.launch_has_election_facts(p_predecessor) OR EXISTS(SELECT 1 FROM (VALUES('finance'),('elections')) d(domain) WHERE NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain=d.domain WHERE t.release_id=p_target AND t.domain=d.domain AND (t.row_count,t.sha256)=(p.row_count,p.sha256))) THEN RAISE EXCEPTION 'invalid exact R3 to R4 launch stage' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'invalid launch stage kind' USING ERRCODE='22023'; END IF;
END $$;
ALTER FUNCTION public.assert_launch_stage(text,text,text) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.assert_launch_stage(text,text,text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.issue_launch_verifier_attestation(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_kind text,p_canonical_sha256 text,p_ttl_seconds integer DEFAULT 300) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE issued timestamptz:=clock_timestamp(); actual_sha text; operational_sha text; f record; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_launch_verifier','member') OR pg_has_role(session_user,'dsa_seats_release_operator','member') OR pg_has_role(session_user,'dsa_seats_ingest','member') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) THEN RAISE EXCEPTION 'only exclusive launch verifier may attest publication evidence' USING ERRCODE='42501'; END IF;
 IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_operation NOT IN('promote','roll_forward') OR p_kind NOT IN('finance','election','maps') OR p_canonical_sha256 !~ '^[a-f0-9]{64}$' OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid launch verifier attestation' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor);
 IF to_char((SELECT source_cutoff FROM public.data_releases WHERE id=p_target) AT TIME ZONE 'UTC','YYYY-MM-DD')<>'2026-07-18' OR p_predecessor IS NULL THEN RAISE EXCEPTION 'launch attestation requires the fixed production lineage' USING ERRCODE='23514'; END IF;
 PERFORM public.assert_launch_stage(p_target,p_predecessor,p_kind);
 IF p_kind='finance' THEN
  IF (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'finance attestation requires exact R1 to R2 lineage' USING ERRCODE='23514'; END IF;
  SELECT canonical_sha256 INTO actual_sha FROM public.finance_publication_proofs WHERE release_id=p_target;
 ELSIF p_kind='election' THEN
  IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR NOT public.launch_has_election_facts(p_target) OR (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_predecessor)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'election attestation requires exact R2 to R3 lineage' USING ERRCODE='23514'; END IF;
  SELECT canonical_sha256 INTO actual_sha FROM public.election_publication_proofs WHERE release_id=p_target;
 ELSE
  IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR NOT public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR NOT public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'map attestation requires exact R3 to R4 lineage' USING ERRCODE='23514'; END IF;
  SELECT map_receipts_fingerprint INTO actual_sha FROM public.release_preflight_fingerprint(p_target,NULL);
 END IF;
 IF actual_sha IS DISTINCT FROM p_canonical_sha256 THEN RAISE EXCEPTION 'launch attestation canonical hash mismatch' USING ERRCODE='23514'; END IF;
 SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO operational_sha;
 SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,NULL);
 IF EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations WHERE consumed_at IS NULL AND expires_at>=issued AND (operation,target_release_id,current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)) THEN RAISE EXCEPTION 'a live launch verifier attestation already exists' USING ERRCODE='23505'; END IF;
 INSERT INTO public.release_launch_verifier_attestations(id,operation,target_release_id,current_release_id,predecessor_release_id,proof_kind,canonical_sha256,run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at) VALUES(p_id,p_operation,p_target,p_current,p_predecessor,p_kind,actual_sha,f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,operational_sha,session_user,issued,issued+make_interval(secs=>p_ttl_seconds),NULL);
END $$;
ALTER FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer) TO dsa_seats_launch_verifier;
CREATE OR REPLACE FUNCTION public.issue_release_preflight(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_run_ids text[],p_ttl_seconds integer DEFAULT 300) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE f record; issued timestamptz:=clock_timestamp(); o text; attestation text; attestation_kind text; launch_required boolean; BEGIN
 IF current_setting('is_superuser')<>'on' AND (pg_has_role(session_user,'dsa_seats_launch_verifier','member') OR pg_has_role(session_user,'dsa_seats_release_operator','member') OR pg_has_role(session_user,'dsa_seats_ingest','member') OR NOT pg_has_role(session_user,'dsa_seats_release_preflight','member')) THEN RAISE EXCEPTION 'only exclusive preflight role may issue proofs' USING ERRCODE='42501'; END IF;
 IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_operation NOT IN('promote','roll_forward') OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid preflight capability' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor);
 IF EXISTS(SELECT 1 FROM public.release_preflight_proofs WHERE consumed_at IS NULL AND expires_at>=issued AND (operation,target_release_id,current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)) THEN RAISE EXCEPTION 'a live preflight proof already exists for this lifecycle state' USING ERRCODE='23505'; END IF;
 PERFORM public.assert_lifecycle_ready(p_target,p_predecessor); PERFORM public.assert_lifecycle_run_ids(p_target,p_predecessor,p_run_ids); SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,p_run_ids); SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO o;
 SELECT to_char(source_cutoff AT TIME ZONE 'UTC','YYYY-MM-DD')='2026-07-18' AND previous_release_id IS NOT NULL INTO launch_required FROM public.data_releases WHERE id=p_target;
 IF launch_required THEN
  SELECT id,proof_kind INTO attestation,attestation_kind FROM public.release_launch_verifier_attestations WHERE operation=p_operation AND target_release_id=p_target AND (current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_current,p_predecessor) AND (run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint) IS NOT DISTINCT FROM(f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o) AND consumed_at IS NULL AND expires_at>=issued ORDER BY issued_at DESC LIMIT 1 FOR UPDATE;
  IF attestation IS NULL THEN RAISE EXCEPTION 'production launch preflight requires live verifier attestation' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_launch_stage(p_target,p_predecessor,attestation_kind);
 END IF;
 INSERT INTO public.release_preflight_proofs(id,operation,target_release_id,current_release_id,predecessor_release_id,run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at,launch_attestation_id) VALUES(p_id,p_operation,p_target,p_current,p_predecessor,f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o,session_user,issued,issued+make_interval(secs=>p_ttl_seconds),NULL,attestation);
END $$;
CREATE OR REPLACE FUNCTION public.consume_release_preflight(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_run_ids text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE p public.release_preflight_proofs%ROWTYPE; f record; o text; launch_required boolean; BEGIN
 IF current_setting('is_superuser')<>'on' AND (NOT pg_has_role(session_user,'dsa_seats_release_operator','member') OR pg_has_role(session_user,'dsa_seats_release_preflight','member') OR pg_has_role(session_user,'dsa_seats_launch_verifier','member') OR pg_has_role(session_user,'dsa_seats_ingest','member')) THEN RAISE EXCEPTION 'only exclusive release operator may consume proofs' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); SELECT * INTO p FROM public.release_preflight_proofs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.consumed_at IS NOT NULL OR p.expires_at<clock_timestamp() OR (p.operation,p.target_release_id,p.current_release_id,p.predecessor_release_id) IS DISTINCT FROM(p_operation,p_target,p_current,p_predecessor) THEN RAISE EXCEPTION 'invalid, expired, or consumed preflight proof' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_lifecycle_ready(p_target,p_predecessor); PERFORM public.assert_lifecycle_run_ids(p_target,p_predecessor,p_run_ids); SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,p_run_ids); SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO o;
 IF (p.run_ids_fingerprint,p.map_receipts_fingerprint,p.manifest_fingerprint,p.gate_fingerprint,p.digest_fingerprint,p.operational_evidence_fingerprint) IS DISTINCT FROM(f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o) THEN RAISE EXCEPTION 'preflight proof no longer matches release content' USING ERRCODE='23514'; END IF;
 SELECT to_char(source_cutoff AT TIME ZONE 'UTC','YYYY-MM-DD')='2026-07-18' AND previous_release_id IS NOT NULL INTO launch_required FROM public.data_releases WHERE id=p_target;
 IF launch_required AND (p.launch_attestation_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations a WHERE a.id=p.launch_attestation_id AND a.operation=p_operation AND a.target_release_id=p_target AND (a.current_release_id,a.predecessor_release_id) IS NOT DISTINCT FROM(p_current,p_predecessor) AND (a.run_ids_fingerprint,a.map_receipts_fingerprint,a.manifest_fingerprint,a.gate_fingerprint,a.digest_fingerprint,a.operational_evidence_fingerprint) IS NOT DISTINCT FROM(f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,o) AND a.consumed_at IS NULL AND a.expires_at>=clock_timestamp() FOR UPDATE)) THEN RAISE EXCEPTION 'invalid or expired launch verifier attestation' USING ERRCODE='42501'; END IF;
 IF launch_required THEN PERFORM public.assert_launch_stage(p_target,p_predecessor,(SELECT proof_kind FROM public.release_launch_verifier_attestations WHERE id=p.launch_attestation_id)); END IF;
 UPDATE public.release_preflight_proofs SET consumed_at=clock_timestamp() WHERE id=p_id; IF p.launch_attestation_id IS NOT NULL THEN UPDATE public.release_launch_verifier_attestations SET consumed_at=clock_timestamp() WHERE id=p.launch_attestation_id; END IF;
END $$;
ALTER FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer) OWNER TO dsa_seats_migration_owner; ALTER FUNCTION public.consume_release_preflight(text,text,text,text,text,text[]) OWNER TO dsa_seats_migration_owner; REVOKE ALL ON FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer),public.consume_release_preflight(text,text,text,text,text,text[]) FROM PUBLIC,dsa_seats_launch_verifier; GRANT EXECUTE ON FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer) TO dsa_seats_release_preflight;
