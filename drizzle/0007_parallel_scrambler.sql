CREATE TABLE "fec_v2_alternate_scoping" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"sanitized_artifact_sha256" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"conclusion" text NOT NULL,
	CONSTRAINT "fec_v2_alternate_scoping_release_id_plan_sha256_file_number_sanitized_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","file_number","sanitized_artifact_sha256"),
	CONSTRAINT "f2as_ck" CHECK ("fec_v2_alternate_scoping"."conclusion"='outside_candidate_targets')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_alternate_scoping" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_amendment_chain_links" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"predecessor_file_number" bigint NOT NULL,
	CONSTRAINT "fec_v2_amendment_chain_links_release_id_plan_sha256_ledger_sha256_file_number_predecessor_file_number_pk" PRIMARY KEY("release_id","plan_sha256","ledger_sha256","file_number","predecessor_file_number"),
	CONSTRAINT "f2acl_distinct_ck" CHECK ("fec_v2_amendment_chain_links"."file_number"<>"fec_v2_amendment_chain_links"."predecessor_file_number")
);
--> statement-breakpoint
ALTER TABLE "fec_v2_amendment_chain_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_artifact_receipts" (
	"receipt_id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"upstream_entity_sha256" text,
	"object_key" text NOT NULL,
	"version_id" text NOT NULL,
	"etag" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"snapshot_id" text NOT NULL,
	CONSTRAINT "fec_v2_artifact_receipts_release_id_receipt_id_pk" PRIMARY KEY("release_id","receipt_id"),
	CONSTRAINT "f2ar_ck" CHECK ("fec_v2_artifact_receipts"."object_key" !~* '\.fec$' AND "fec_v2_artifact_receipts"."object_key" !~ '(^|/)\.\.?(/|$)' AND "fec_v2_artifact_receipts"."object_key" !~ '^/' AND "fec_v2_artifact_receipts"."object_key" !~ '\\' AND "fec_v2_artifact_receipts"."object_key" ~ ('(^|/)' || "fec_v2_artifact_receipts"."artifact_sha256" || '($|[./_-])') AND length("fec_v2_artifact_receipts"."version_id")>0 AND length("fec_v2_artifact_receipts"."etag")>0 AND "fec_v2_artifact_receipts"."byte_size">0 AND "fec_v2_artifact_receipts"."byte_size"="fec_v2_artifact_receipts"."canonical_byte_size" AND (("fec_v2_artifact_receipts"."artifact_kind" IN ('enumeration_page','sanitized_filing') AND "fec_v2_artifact_receipts"."upstream_entity_sha256" IS NOT NULL AND "fec_v2_artifact_receipts"."upstream_entity_sha256" ~ '^[a-f0-9]{64}$') OR ("fec_v2_artifact_receipts"."artifact_kind"='filing_ledger' AND "fec_v2_artifact_receipts"."upstream_entity_sha256" IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_artifact_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_artifacts" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fec_v2_artifacts_release_id_plan_sha256_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","artifact_sha256"),
	CONSTRAINT "f2art_ck" CHECK ("fec_v2_artifacts"."artifact_kind" IN ('enumeration_page','filing_ledger','sanitized_filing') AND "fec_v2_artifacts"."artifact_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_artifacts"."canonical_byte_size">0)
);
--> statement-breakpoint
ALTER TABLE "fec_v2_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_candidate_mappings" (
	"id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"outcome" text NOT NULL,
	"fec_candidate_id" text,
	"candidacy_id" text,
	"candidacy_contest_id" text,
	"evidence_sha256" text NOT NULL,
	CONSTRAINT "fec_v2_candidate_mappings_release_id_plan_sha256_id_pk" PRIMARY KEY("release_id","plan_sha256","id"),
	CONSTRAINT "f2cm_union_ck" CHECK (("fec_v2_candidate_mappings"."outcome"='mapped' AND "fec_v2_candidate_mappings"."target_kind"='candidate_resolution_required' AND "fec_v2_candidate_mappings"."fec_candidate_id" ~ '^[HSP][A-Z0-9]{8}$' AND "fec_v2_candidate_mappings"."candidacy_id" IS NOT NULL AND "fec_v2_candidate_mappings"."candidacy_contest_id" IS NOT NULL) OR ("fec_v2_candidate_mappings"."outcome"='unresolved' AND "fec_v2_candidate_mappings"."target_kind"='candidate_resolution_required' AND "fec_v2_candidate_mappings"."fec_candidate_id" IS NULL AND "fec_v2_candidate_mappings"."candidacy_id" IS NULL AND "fec_v2_candidate_mappings"."candidacy_contest_id" IS NULL)),
	CONSTRAINT "f2cm_evidence_ck" CHECK ("fec_v2_candidate_mappings"."evidence_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_closure_input_receipts" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"closure_id" text NOT NULL,
	"receipt_id" text NOT NULL,
	CONSTRAINT "fec_v2_closure_input_receipts_release_id_plan_sha256_closure_id_receipt_id_pk" PRIMARY KEY("release_id","plan_sha256","closure_id","receipt_id")
);
--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_closure_input_snapshots" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"closure_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	CONSTRAINT "fec_v2_closure_input_snapshots_release_id_plan_sha256_closure_id_snapshot_id_pk" PRIMARY KEY("release_id","plan_sha256","closure_id","snapshot_id")
);
--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_committee_mappings" (
	"id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"candidate_mapping_id" text NOT NULL,
	"committee_id" text NOT NULL,
	"designation" text NOT NULL,
	"evidence_sha256" text NOT NULL,
	CONSTRAINT "fec_v2_committee_mappings_release_id_plan_sha256_id_pk" PRIMARY KEY("release_id","plan_sha256","id"),
	CONSTRAINT "fec_v2_committee_mappings_sha_ck" CHECK ("fec_v2_committee_mappings"."evidence_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_committee_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_data_review_signatures" (
	"review_id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"origin_release_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_sha256" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"key_id" text NOT NULL,
	"public_key_fingerprint" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	CONSTRAINT "fec_v2_data_review_signatures_release_id_plan_sha256_review_id_pk" PRIMARY KEY("release_id","plan_sha256","review_id"),
	CONSTRAINT "fec_v2_data_review_signatures_ck" CHECK ("fec_v2_data_review_signatures"."subject_type" IN ('fec_mapping','committee_mapping','finance_page_closure','finance_amendment_closure','outside_spending_election_mapping','outside_spending_closure','finance_terminal','finance_closure') AND "fec_v2_data_review_signatures"."subject_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_data_review_signatures"."public_key_fingerprint" ~ '^[a-f0-9]{64}$' AND length("fec_v2_data_review_signatures"."reviewer_id")>0 AND length("fec_v2_data_review_signatures"."key_id")>0 AND length("fec_v2_data_review_signatures"."signature")>0)
);
--> statement-breakpoint
ALTER TABLE "fec_v2_data_review_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_election_mappings" (
	"id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"outcome" text NOT NULL,
	"candidate_mapping_id" text,
	"contest_id" text,
	"election_code" text,
	"election_date" date,
	"evidence_sha256" text NOT NULL,
	CONSTRAINT "fec_v2_election_mappings_release_id_plan_sha256_id_pk" PRIMARY KEY("release_id","plan_sha256","id"),
	CONSTRAINT "f2em_union_ck" CHECK (("fec_v2_election_mappings"."outcome"='mapped' AND "fec_v2_election_mappings"."candidate_mapping_id" IS NOT NULL AND "fec_v2_election_mappings"."contest_id" IS NOT NULL AND "fec_v2_election_mappings"."election_code" ~ '^[A-Z][0-9]{4}$' AND "fec_v2_election_mappings"."election_date" IS NOT NULL) OR ("fec_v2_election_mappings"."outcome"='unresolved' AND "fec_v2_election_mappings"."candidate_mapping_id" IS NULL AND "fec_v2_election_mappings"."contest_id" IS NULL AND "fec_v2_election_mappings"."election_code" IS NULL AND "fec_v2_election_mappings"."election_date" IS NULL)),
	CONSTRAINT "f2em_evidence_ck" CHECK ("fec_v2_election_mappings"."evidence_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_enumeration_pages" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"pass" integer NOT NULL,
	"form_type" text NOT NULL,
	"receipt_date" date,
	"requested_file_number" bigint,
	"page_number" integer NOT NULL,
	"terminal" integer NOT NULL,
	CONSTRAINT "fec_v2_enumeration_pages_release_id_plan_sha256_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","artifact_sha256"),
	CONSTRAINT "f2ep_kind_ck" CHECK ("fec_v2_enumeration_pages"."artifact_kind"='enumeration_page'),
	CONSTRAINT "fec_v2_enumeration_pages_provenance_ck" CHECK ("fec_v2_enumeration_pages"."pass" IN (1,2) AND "fec_v2_enumeration_pages"."form_type" IN ('F3','F3X','F24','F5') AND "fec_v2_enumeration_pages"."page_number">0 AND "fec_v2_enumeration_pages"."terminal" IN (0,1) AND (("fec_v2_enumeration_pages"."receipt_date" IS NOT NULL) <> ("fec_v2_enumeration_pages"."requested_file_number" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_enumeration_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_exact_election_aggregates" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"candidate_mapping_id" text,
	"election_mapping_id" text NOT NULL,
	"closure_id" text NOT NULL,
	"support_cents" bigint NOT NULL,
	"oppose_cents" bigint NOT NULL,
	"methodology" text NOT NULL,
	"coverage_through" date NOT NULL,
	CONSTRAINT "fec_v2_exact_election_aggregates_release_id_plan_sha256_seat_cycle_id_candidate_mapping_id_election_mapping_id_pk" PRIMARY KEY("release_id","plan_sha256","seat_cycle_id","candidate_mapping_id","election_mapping_id"),
	CONSTRAINT "f2ea_ck" CHECK ("fec_v2_exact_election_aggregates"."support_cents">=0 AND "fec_v2_exact_election_aggregates"."oppose_cents">=0 AND "fec_v2_exact_election_aggregates"."methodology"='fec-receipt-cutoff-v2')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_filing_ledger_entries" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"canonical_form_type" text NOT NULL,
	"report_date" date,
	"receipt_date" date NOT NULL,
	CONSTRAINT "fec_v2_filing_ledger_entries_release_id_plan_sha256_ledger_sha256_file_number_pk" PRIMARY KEY("release_id","plan_sha256","ledger_sha256","file_number"),
	CONSTRAINT "fec_v2_filing_ledger_entries_form_ck" CHECK ("fec_v2_filing_ledger_entries"."canonical_form_type" IN ('F3','F3X','F24','F5') AND "fec_v2_filing_ledger_entries"."file_number">0)
);
--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_filing_ledgers" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"stable" integer NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "fec_v2_filing_ledgers_release_id_plan_sha256_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","artifact_sha256"),
	CONSTRAINT "f2fl_kind_ck" CHECK ("fec_v2_filing_ledgers"."artifact_kind"='filing_ledger'),
	CONSTRAINT "fec_v2_filing_ledgers_stable_ck" CHECK ("fec_v2_filing_ledgers"."stable" IN (0,1))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledgers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_finance_closures" (
	"id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_identity" text NOT NULL,
	"candidate_mapping_id" text NOT NULL,
	"status" text NOT NULL,
	"finalized_at" timestamp with time zone,
	"subject_sha256" text NOT NULL,
	CONSTRAINT "fec_v2_finance_closures_release_id_plan_sha256_id_pk" PRIMARY KEY("release_id","plan_sha256","id"),
	CONSTRAINT "f2fc_union_ck" CHECK (("fec_v2_finance_closures"."subject_kind"='candidate' AND "fec_v2_finance_closures"."target_kind"='candidate_resolution_required' AND "fec_v2_finance_closures"."candidate_mapping_id" IS NOT NULL AND "fec_v2_finance_closures"."subject_identity"="fec_v2_finance_closures"."candidate_mapping_id") OR ("fec_v2_finance_closures"."subject_kind"='terminal' AND "fec_v2_finance_closures"."target_kind"='terminal' AND "fec_v2_finance_closures"."candidate_mapping_id" IS NULL AND "fec_v2_finance_closures"."subject_identity"='terminal')),
	CONSTRAINT "f2fc_sha_ck" CHECK ("fec_v2_finance_closures"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_finance_closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_page_lineage" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"page_sha256" text NOT NULL,
	"pass" integer NOT NULL,
	CONSTRAINT "fec_v2_page_lineage_release_id_plan_sha256_ledger_sha256_file_number_page_sha256_pk" PRIMARY KEY("release_id","plan_sha256","ledger_sha256","file_number","page_sha256"),
	CONSTRAINT "f2pl_pass_ck" CHECK ("fec_v2_page_lineage"."pass" IN (1,2))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_plan_targets" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"kind" text NOT NULL,
	"disposition" text,
	"evidence_sha256" text,
	CONSTRAINT "fec_v2_plan_targets_release_id_plan_sha256_seat_cycle_id_pk" PRIMARY KEY("release_id","plan_sha256","seat_cycle_id"),
	CONSTRAINT "f2pt_subject_uq" UNIQUE("release_id","plan_sha256","seat_cycle_id","kind"),
	CONSTRAINT "f2pt_union_ck" CHECK (("fec_v2_plan_targets"."kind"='candidate_resolution_required' AND "fec_v2_plan_targets"."disposition" IS NULL AND "fec_v2_plan_targets"."evidence_sha256" IS NULL) OR ("fec_v2_plan_targets"."kind"='terminal' AND "fec_v2_plan_targets"."disposition" IN ('vacant','non_candidate','not_contested') AND "fec_v2_plan_targets"."evidence_sha256" IS NOT NULL AND "fec_v2_plan_targets"."evidence_sha256" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_plan_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_plans" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"receipt_cutoff" date NOT NULL,
	"campaign_cycle" integer NOT NULL,
	"source_lock_sha256" text NOT NULL,
	"target_universe_sha256" text NOT NULL,
	"canonical_sha256" text NOT NULL,
	"sealed_at" timestamp with time zone,
	CONSTRAINT "fec_v2_plans_release_id_plan_sha256_pk" PRIMARY KEY("release_id","plan_sha256"),
	CONSTRAINT "fec_v2_plans_sha_ck" CHECK ("fec_v2_plans"."plan_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_plans"."source_lock_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_plans"."target_universe_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_plans"."canonical_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_publication_proofs" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"signature_id" text NOT NULL,
	"canonical_sha256" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fec_v2_publication_proofs_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "fec_v2_publication_proofs_sha_ck" CHECK ("fec_v2_publication_proofs"."canonical_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_publication_proofs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_publication_signatures" (
	"release_id" text NOT NULL,
	"id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"canonical_sha256" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"key_id" text NOT NULL,
	"public_key_fingerprint" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"signature" text NOT NULL,
	CONSTRAINT "fec_v2_publication_signatures_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "fec_v2_publication_signatures_ck" CHECK ("fec_v2_publication_signatures"."canonical_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_publication_signatures"."public_key_fingerprint" ~ '^[a-f0-9]{64}$' AND length("fec_v2_publication_signatures"."key_id")>0 AND length("fec_v2_publication_signatures"."signature")>0)
);
--> statement-breakpoint
ALTER TABLE "fec_v2_publication_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_run_failures" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"failure_code" text NOT NULL,
	"subject_sha256" text NOT NULL,
	CONSTRAINT "fec_v2_run_failures_release_id_plan_sha256_run_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id"),
	CONSTRAINT "f2rf_sha_ck" CHECK ("fec_v2_run_failures"."subject_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_run_snapshots" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	CONSTRAINT "fec_v2_run_snapshots_release_id_plan_sha256_run_id_snapshot_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","snapshot_id")
);
--> statement-breakpoint
ALTER TABLE "fec_v2_run_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_runs" (
	"run_id" text NOT NULL,
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"receipt_cutoff" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text NOT NULL,
	"failure_code" text,
	CONSTRAINT "fec_v2_runs_release_id_run_id_pk" PRIMARY KEY("release_id","run_id"),
	CONSTRAINT "f2runs_lifecycle_ck" CHECK (("fec_v2_runs"."status"='running' AND "fec_v2_runs"."completed_at" IS NULL AND "fec_v2_runs"."failure_code" IS NULL) OR ("fec_v2_runs"."status"='completed' AND "fec_v2_runs"."completed_at" IS NOT NULL AND "fec_v2_runs"."failure_code" IS NULL) OR ("fec_v2_runs"."status"='failed' AND "fec_v2_runs"."completed_at" IS NOT NULL AND "fec_v2_runs"."failure_code" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_sanitized_filings" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"file_number" bigint NOT NULL,
	"ledger_sha256" text NOT NULL,
	"report_date" date,
	CONSTRAINT "fec_v2_sanitized_filings_release_id_plan_sha256_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","artifact_sha256"),
	CONSTRAINT "f2sf_kind_ck" CHECK ("fec_v2_sanitized_filings"."artifact_kind"='sanitized_filing')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_seat_coverage" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"seat_cycle_id" text NOT NULL,
	"closure_id" text NOT NULL,
	"subject_identity" text NOT NULL,
	"outcome" text NOT NULL,
	"support_cents" bigint,
	"oppose_cents" bigint,
	CONSTRAINT "fec_v2_seat_coverage_release_id_plan_sha256_seat_cycle_id_pk" PRIMARY KEY("release_id","plan_sha256","seat_cycle_id"),
	CONSTRAINT "fec_v2_seat_coverage_outcome_ck" CHECK (("fec_v2_seat_coverage"."outcome"='complete_zero' AND "fec_v2_seat_coverage"."support_cents" IS NOT NULL AND "fec_v2_seat_coverage"."oppose_cents" IS NOT NULL AND "fec_v2_seat_coverage"."support_cents"=0 AND "fec_v2_seat_coverage"."oppose_cents"=0) OR ("fec_v2_seat_coverage"."outcome"='complete_nonzero' AND "fec_v2_seat_coverage"."support_cents" IS NOT NULL AND "fec_v2_seat_coverage"."oppose_cents" IS NOT NULL AND "fec_v2_seat_coverage"."support_cents">=0 AND "fec_v2_seat_coverage"."oppose_cents">=0 AND ("fec_v2_seat_coverage"."support_cents">0 OR "fec_v2_seat_coverage"."oppose_cents">0)) OR ("fec_v2_seat_coverage"."outcome" IN ('source_unavailable','paper_filing_unreviewed','unsupported_layout','malformed_filing','enumeration_unstable','unscoped_global_block','ambiguous_notice_pair','unresolved_election_mapping') AND "fec_v2_seat_coverage"."support_cents" IS NULL AND "fec_v2_seat_coverage"."oppose_cents" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_seat_coverage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_snapshot_metadata" (
	"release_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"origin_release_id" text NOT NULL,
	"receipt_set_digest_sha256" text NOT NULL,
	"sealed_at" timestamp with time zone,
	CONSTRAINT "fec_v2_snapshot_metadata_release_id_snapshot_id_pk" PRIMARY KEY("release_id","snapshot_id"),
	CONSTRAINT "f2sm_sha_ck" CHECK ("fec_v2_snapshot_metadata"."receipt_set_digest_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ALTER COLUMN "candidacy_contest_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ALTER COLUMN "candidate_mapping_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ALTER COLUMN "contest_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_finance_closures" ALTER COLUMN "candidate_mapping_id" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE "finance_proof_routes" (
	"release_id" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"plan_sha256" text,
	CONSTRAINT "fpr_shape_ck" CHECK (("finance_proof_routes"."route"='fec_v1' AND "finance_proof_routes"."plan_sha256" IS NULL) OR ("finance_proof_routes"."route"='fec_v2_exact_election' AND "finance_proof_routes"."plan_sha256" IS NOT NULL AND "finance_proof_routes"."plan_sha256" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "finance_proof_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_id_seat_uq" UNIQUE ("release_id","id","seat_cycle_id");--> statement-breakpoint
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_id_contest_uq" UNIQUE ("release_id","id","contest_id");--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_plan_run_uq" UNIQUE ("release_id","plan_sha256","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2sm_plan_snapshot_uq" ON "fec_v2_snapshot_metadata" ("release_id","plan_sha256","snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2art_kind_uq" ON "fec_v2_artifacts" ("release_id","plan_sha256","artifact_sha256","artifact_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "f2art_identity_uq" ON "fec_v2_artifacts" ("release_id","plan_sha256","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE UNIQUE INDEX "f2ar_plan_receipt_uq" ON "fec_v2_artifact_receipts" ("release_id","plan_sha256","receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2ep_pass_uq" ON "fec_v2_enumeration_pages" ("release_id","plan_sha256","artifact_sha256","pass");--> statement-breakpoint
CREATE UNIQUE INDEX "f2sf_exact_entry_uq" ON "fec_v2_sanitized_filings" ("release_id","plan_sha256","artifact_sha256","ledger_sha256","file_number");--> statement-breakpoint
CREATE UNIQUE INDEX "f2cm_subject_uq" ON "fec_v2_candidate_mappings" ("release_id","plan_sha256","id","seat_cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2em_subject_uq" ON "fec_v2_election_mappings" ("release_id","plan_sha256","id","candidate_mapping_id","seat_cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2fc_coverage_subject_uq" ON "fec_v2_finance_closures" ("release_id","plan_sha256","id","seat_cycle_id","subject_identity");--> statement-breakpoint
CREATE UNIQUE INDEX "f2fc_candidate_subject_uq" ON "fec_v2_finance_closures" ("release_id","plan_sha256","id","seat_cycle_id","candidate_mapping_id");--> statement-breakpoint
CREATE UNIQUE INDEX "f2sc_subject_uq" ON "fec_v2_seat_coverage" ("release_id","plan_sha256","seat_cycle_id","closure_id","subject_identity");--> statement-breakpoint
CREATE UNIQUE INDEX "f2ps_proof_uq" ON "fec_v2_publication_signatures" ("release_id","id","canonical_sha256");--> statement-breakpoint
ALTER TABLE "fec_v2_alternate_scoping" ADD CONSTRAINT "fec_v2_alternate_scoping_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_alternate_scoping" ADD CONSTRAINT "f2as_exact_filing_fk" FOREIGN KEY ("release_id","plan_sha256","sanitized_artifact_sha256","ledger_sha256","file_number") REFERENCES "public"."fec_v2_sanitized_filings"("release_id","plan_sha256","artifact_sha256","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_amendment_chain_links" ADD CONSTRAINT "fec_v2_amendment_chain_links_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_amendment_chain_links" ADD CONSTRAINT "f2acl_entry_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","file_number") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_amendment_chain_links" ADD CONSTRAINT "f2acl_predecessor_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","predecessor_file_number") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_artifact_receipts" ADD CONSTRAINT "fec_v2_artifact_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_artifact_receipts" ADD CONSTRAINT "f2ar_metadata_fk" FOREIGN KEY ("release_id","plan_sha256","snapshot_id") REFERENCES "public"."fec_v2_snapshot_metadata"("release_id","plan_sha256","snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_artifact_receipts" ADD CONSTRAINT "f2ar_identity_fk" FOREIGN KEY ("release_id","plan_sha256","artifact_sha256","artifact_kind","canonical_byte_size") REFERENCES "public"."fec_v2_artifacts"("release_id","plan_sha256","artifact_sha256","artifact_kind","canonical_byte_size") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_artifacts" ADD CONSTRAINT "fec_v2_artifacts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_artifacts" ADD CONSTRAINT "f2art_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ADD CONSTRAINT "fec_v2_candidate_mappings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ADD CONSTRAINT "f2cm_target_fk" FOREIGN KEY ("release_id","plan_sha256","seat_cycle_id","target_kind") REFERENCES "public"."fec_v2_plan_targets"("release_id","plan_sha256","seat_cycle_id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ADD CONSTRAINT "f2cm_candidacy_fk" FOREIGN KEY ("release_id","candidacy_id","candidacy_contest_id") REFERENCES "public"."candidacies"("release_id","id","contest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_candidate_mappings" ADD CONSTRAINT "f2cm_contest_seat_fk" FOREIGN KEY ("release_id","candidacy_contest_id","seat_cycle_id") REFERENCES "public"."contests"("release_id","id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_receipts" ADD CONSTRAINT "fec_v2_closure_input_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_receipts" ADD CONSTRAINT "f2cir_closure_fk" FOREIGN KEY ("release_id","plan_sha256","closure_id") REFERENCES "public"."fec_v2_finance_closures"("release_id","plan_sha256","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_receipts" ADD CONSTRAINT "f2cir_receipt_fk" FOREIGN KEY ("release_id","plan_sha256","receipt_id") REFERENCES "public"."fec_v2_artifact_receipts"("release_id","plan_sha256","receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_snapshots" ADD CONSTRAINT "fec_v2_closure_input_snapshots_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_snapshots" ADD CONSTRAINT "f2cis_closure_fk" FOREIGN KEY ("release_id","plan_sha256","closure_id") REFERENCES "public"."fec_v2_finance_closures"("release_id","plan_sha256","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_closure_input_snapshots" ADD CONSTRAINT "f2cis_snapshot_fk" FOREIGN KEY ("release_id","plan_sha256","snapshot_id") REFERENCES "public"."fec_v2_snapshot_metadata"("release_id","plan_sha256","snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_committee_mappings" ADD CONSTRAINT "fec_v2_committee_mappings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_committee_mappings" ADD CONSTRAINT "fec_v2_committee_mappings_release_id_plan_sha256_candidate_mapping_id_fec_v2_candidate_mappings_release_id_plan_sha256_id_fk" FOREIGN KEY ("release_id","plan_sha256","candidate_mapping_id") REFERENCES "public"."fec_v2_candidate_mappings"("release_id","plan_sha256","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_committee_mappings" ADD CONSTRAINT "fec_v2_committee_mappings_release_id_committee_id_committees_release_id_id_fk" FOREIGN KEY ("release_id","committee_id") REFERENCES "public"."committees"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_data_review_signatures" ADD CONSTRAINT "fec_v2_data_review_signatures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_data_review_signatures" ADD CONSTRAINT "f2drs_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ADD CONSTRAINT "fec_v2_election_mappings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ADD CONSTRAINT "f2em_candidate_fk" FOREIGN KEY ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id") REFERENCES "public"."fec_v2_candidate_mappings"("release_id","plan_sha256","id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_election_mappings" ADD CONSTRAINT "f2em_contest_seat_fk" FOREIGN KEY ("release_id","contest_id","seat_cycle_id") REFERENCES "public"."contests"("release_id","id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_enumeration_pages" ADD CONSTRAINT "fec_v2_enumeration_pages_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_enumeration_pages" ADD CONSTRAINT "f2ep_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","artifact_sha256","artifact_kind") REFERENCES "public"."fec_v2_artifacts"("release_id","plan_sha256","artifact_sha256","artifact_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "fec_v2_exact_election_aggregates_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "f2ea_candidate_fk" FOREIGN KEY ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id") REFERENCES "public"."fec_v2_candidate_mappings"("release_id","plan_sha256","id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "f2ea_election_fk" FOREIGN KEY ("release_id","plan_sha256","election_mapping_id","candidate_mapping_id","seat_cycle_id") REFERENCES "public"."fec_v2_election_mappings"("release_id","plan_sha256","id","candidate_mapping_id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "f2ea_closure_fk" FOREIGN KEY ("release_id","plan_sha256","closure_id","seat_cycle_id","candidate_mapping_id") REFERENCES "public"."fec_v2_finance_closures"("release_id","plan_sha256","id","seat_cycle_id","candidate_mapping_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_exact_election_aggregates" ADD CONSTRAINT "f2ea_coverage_fk" FOREIGN KEY ("release_id","plan_sha256","seat_cycle_id","closure_id","candidate_mapping_id") REFERENCES "public"."fec_v2_seat_coverage"("release_id","plan_sha256","seat_cycle_id","closure_id","subject_identity") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD CONSTRAINT "fec_v2_filing_ledger_entries_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD CONSTRAINT "f2fle_ledger_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256") REFERENCES "public"."fec_v2_filing_ledgers"("release_id","plan_sha256","artifact_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledgers" ADD CONSTRAINT "fec_v2_filing_ledgers_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledgers" ADD CONSTRAINT "f2fl_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","artifact_sha256","artifact_kind") REFERENCES "public"."fec_v2_artifacts"("release_id","plan_sha256","artifact_sha256","artifact_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_finance_closures" ADD CONSTRAINT "fec_v2_finance_closures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_finance_closures" ADD CONSTRAINT "f2fc_target_fk" FOREIGN KEY ("release_id","plan_sha256","seat_cycle_id","target_kind") REFERENCES "public"."fec_v2_plan_targets"("release_id","plan_sha256","seat_cycle_id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_finance_closures" ADD CONSTRAINT "f2fc_candidate_fk" FOREIGN KEY ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id") REFERENCES "public"."fec_v2_candidate_mappings"("release_id","plan_sha256","id","seat_cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD CONSTRAINT "fec_v2_page_lineage_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD CONSTRAINT "f2pl_entry_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","file_number") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD CONSTRAINT "f2pl_page_pass_fk" FOREIGN KEY ("release_id","plan_sha256","page_sha256","pass") REFERENCES "public"."fec_v2_enumeration_pages"("release_id","plan_sha256","artifact_sha256","pass") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_plan_targets" ADD CONSTRAINT "fec_v2_plan_targets_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_plan_targets" ADD CONSTRAINT "f2pt_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_plan_targets" ADD CONSTRAINT "f2pt_seat_fk" FOREIGN KEY ("release_id","seat_cycle_id") REFERENCES "public"."seat_cycles"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ADD CONSTRAINT "fec_v2_plans_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_publication_proofs" ADD CONSTRAINT "fec_v2_publication_proofs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_publication_proofs" ADD CONSTRAINT "f2pp_signature_fk" FOREIGN KEY ("release_id","signature_id","canonical_sha256") REFERENCES "public"."fec_v2_publication_signatures"("release_id","id","canonical_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_publication_signatures" ADD CONSTRAINT "fec_v2_publication_signatures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_publication_signatures" ADD CONSTRAINT "f2ps_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD CONSTRAINT "fec_v2_run_failures_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD CONSTRAINT "f2rf_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_run_snapshots" ADD CONSTRAINT "fec_v2_run_snapshots_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_run_snapshots" ADD CONSTRAINT "f2rs_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_run_snapshots" ADD CONSTRAINT "f2rs_snapshot_fk" FOREIGN KEY ("release_id","plan_sha256","snapshot_id") REFERENCES "public"."fec_v2_snapshot_metadata"("release_id","plan_sha256","snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "fec_v2_runs_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ADD CONSTRAINT "fec_v2_sanitized_filings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ADD CONSTRAINT "f2sf_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","artifact_sha256","artifact_kind") REFERENCES "public"."fec_v2_artifacts"("release_id","plan_sha256","artifact_sha256","artifact_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ADD CONSTRAINT "f2sf_entry_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","file_number") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_seat_coverage" ADD CONSTRAINT "fec_v2_seat_coverage_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_seat_coverage" ADD CONSTRAINT "f2sc_closure_subject_fk" FOREIGN KEY ("release_id","plan_sha256","closure_id","seat_cycle_id","subject_identity") REFERENCES "public"."fec_v2_finance_closures"("release_id","plan_sha256","id","seat_cycle_id","subject_identity") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "fec_v2_snapshot_metadata_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "f2sm_snapshot_fk" FOREIGN KEY ("release_id","snapshot_id") REFERENCES "public"."source_snapshots"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "f2sm_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_proof_routes" ADD CONSTRAINT "finance_proof_routes_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_proof_routes" ADD CONSTRAINT "fpr_plan_fk" FOREIGN KEY ("release_id","plan_sha256") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f2as_filing_fk_idx" ON "fec_v2_alternate_scoping" USING btree ("release_id","plan_sha256","sanitized_artifact_sha256","ledger_sha256","file_number");--> statement-breakpoint
CREATE INDEX "f2acl_predecessor_fk_idx" ON "fec_v2_amendment_chain_links" USING btree ("release_id","plan_sha256","ledger_sha256","predecessor_file_number");--> statement-breakpoint
CREATE INDEX "f2ar_metadata_fk_idx" ON "fec_v2_artifact_receipts" USING btree ("release_id","plan_sha256","snapshot_id");--> statement-breakpoint
CREATE INDEX "f2ar_identity_fk_idx" ON "fec_v2_artifact_receipts" USING btree ("release_id","plan_sha256","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE INDEX "f2art_plan_fk_idx" ON "fec_v2_artifacts" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2cm_target_fk_idx" ON "fec_v2_candidate_mappings" USING btree ("release_id","plan_sha256","seat_cycle_id","target_kind");--> statement-breakpoint
CREATE INDEX "f2cm_candidacy_fk_idx" ON "fec_v2_candidate_mappings" USING btree ("release_id","candidacy_id","candidacy_contest_id");--> statement-breakpoint
CREATE INDEX "f2cm_contest_seat_fk_idx" ON "fec_v2_candidate_mappings" USING btree ("release_id","candidacy_contest_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2drs_plan_fk_idx" ON "fec_v2_data_review_signatures" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2cir_receipt_fk_idx" ON "fec_v2_closure_input_receipts" USING btree ("release_id","plan_sha256","receipt_id");--> statement-breakpoint
CREATE INDEX "f2cis_snapshot_fk_idx" ON "fec_v2_closure_input_snapshots" USING btree ("release_id","plan_sha256","snapshot_id");--> statement-breakpoint
CREATE INDEX "fec_v2_committee_mappings_candidate_fk_idx" ON "fec_v2_committee_mappings" USING btree ("release_id","plan_sha256","candidate_mapping_id");--> statement-breakpoint
CREATE INDEX "fec_v2_committee_mappings_committee_fk_idx" ON "fec_v2_committee_mappings" USING btree ("release_id","committee_id");--> statement-breakpoint
CREATE INDEX "f2em_candidate_fk_idx" ON "fec_v2_election_mappings" USING btree ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2em_contest_seat_fk_idx" ON "fec_v2_election_mappings" USING btree ("release_id","contest_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2ep_artifact_fk_idx" ON "fec_v2_enumeration_pages" USING btree ("release_id","plan_sha256","artifact_sha256","artifact_kind");--> statement-breakpoint
CREATE INDEX "f2ea_election_fk_idx" ON "fec_v2_exact_election_aggregates" USING btree ("release_id","plan_sha256","election_mapping_id","candidate_mapping_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2ea_closure_fk_idx" ON "fec_v2_exact_election_aggregates" USING btree ("release_id","plan_sha256","closure_id","seat_cycle_id","candidate_mapping_id");--> statement-breakpoint
CREATE INDEX "f2ea_candidate_fk_idx" ON "fec_v2_exact_election_aggregates" USING btree ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2ea_coverage_fk_idx" ON "fec_v2_exact_election_aggregates" USING btree ("release_id","plan_sha256","seat_cycle_id","closure_id","candidate_mapping_id");--> statement-breakpoint
CREATE INDEX "fec_v2_filing_ledger_entries_ledger_fk_idx" ON "fec_v2_filing_ledger_entries" USING btree ("release_id","plan_sha256","ledger_sha256");--> statement-breakpoint
CREATE INDEX "f2fl_artifact_fk_idx" ON "fec_v2_filing_ledgers" USING btree ("release_id","plan_sha256","artifact_sha256","artifact_kind");--> statement-breakpoint
CREATE INDEX "f2fc_target_fk_idx" ON "fec_v2_finance_closures" USING btree ("release_id","plan_sha256","seat_cycle_id","target_kind");--> statement-breakpoint
CREATE INDEX "f2fc_candidate_fk_idx" ON "fec_v2_finance_closures" USING btree ("release_id","plan_sha256","candidate_mapping_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2pl_page_pass_fk_idx" ON "fec_v2_page_lineage" USING btree ("release_id","plan_sha256","page_sha256","pass");--> statement-breakpoint
CREATE INDEX "f2pt_plan_fk_idx" ON "fec_v2_plan_targets" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2pt_seat_fk_idx" ON "fec_v2_plan_targets" USING btree ("release_id","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2pp_signature_fk_idx" ON "fec_v2_publication_proofs" USING btree ("release_id","signature_id","canonical_sha256");--> statement-breakpoint
CREATE INDEX "f2ps_plan_fk_idx" ON "fec_v2_publication_signatures" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2rs_snapshot_fk_idx" ON "fec_v2_run_snapshots" USING btree ("release_id","plan_sha256","snapshot_id");--> statement-breakpoint
CREATE INDEX "f2runs_plan_fk_idx" ON "fec_v2_runs" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2sf_artifact_fk_idx" ON "fec_v2_sanitized_filings" USING btree ("release_id","plan_sha256","artifact_sha256","artifact_kind");--> statement-breakpoint
CREATE INDEX "f2sf_entry_fk_idx" ON "fec_v2_sanitized_filings" USING btree ("release_id","plan_sha256","ledger_sha256","file_number");--> statement-breakpoint
CREATE INDEX "f2sc_closure_subject_fk_idx" ON "fec_v2_seat_coverage" USING btree ("release_id","plan_sha256","closure_id","seat_cycle_id","subject_identity");--> statement-breakpoint
CREATE INDEX "f2sm_plan_fk_idx" ON "fec_v2_snapshot_metadata" USING btree ("release_id","plan_sha256");--> statement-breakpoint
CREATE INDEX "f2sm_snapshot_fk_idx" ON "fec_v2_snapshot_metadata" USING btree ("release_id","snapshot_id");--> statement-breakpoint
CREATE INDEX "fpr_plan_fk_idx" ON "finance_proof_routes" USING btree ("release_id","plan_sha256");
--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ADD COLUMN "origin_release_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ADD CONSTRAINT "f2p_origin_release_fk" FOREIGN KEY ("origin_release_id") REFERENCES "public"."data_releases"("id");--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ADD CONSTRAINT "f2p_origin_release_ck" CHECK (length("origin_release_id")>0);--> statement-breakpoint
CREATE INDEX "f2p_origin_release_fk_idx" ON "fec_v2_plans" USING btree ("origin_release_id");--> statement-breakpoint
-- Migration-owned FEC v2 procedure and privilege boundary.  The declarative
-- foreign keys above remain the source of truth for relationships.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_fec_v2_acquisition') THEN CREATE ROLE dsa_seats_fec_v2_acquisition NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_fec_v2_data_reviewer') THEN CREATE ROLE dsa_seats_fec_v2_data_reviewer NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_fec_v2_publisher') THEN CREATE ROLE dsa_seats_fec_v2_publisher NOLOGIN NOINHERIT; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO dsa_seats_migration_owner,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_data_reviewer,dsa_seats_fec_v2_publisher,dsa_seats_release_preflight;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['fec_v2_alternate_scoping','fec_v2_amendment_chain_links','fec_v2_artifact_receipts','fec_v2_artifacts','fec_v2_candidate_mappings','fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots','fec_v2_committee_mappings','fec_v2_data_review_signatures','fec_v2_election_mappings','fec_v2_enumeration_pages','fec_v2_exact_election_aggregates','fec_v2_filing_ledger_entries','fec_v2_filing_ledgers','fec_v2_finance_closures','fec_v2_page_lineage','fec_v2_plan_targets','fec_v2_plans','fec_v2_publication_proofs','fec_v2_publication_signatures','fec_v2_run_failures','fec_v2_run_snapshots','fec_v2_runs','fec_v2_sanitized_filings','fec_v2_seat_coverage','fec_v2_snapshot_metadata','finance_proof_routes'] LOOP
   EXECUTE format('ALTER TABLE public.%I OWNER TO dsa_seats_migration_owner',t);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,dsa_seats_web,dsa_seats_ingest,dsa_seats_release_preflight,dsa_seats_release_operator,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_data_reviewer,dsa_seats_fec_v2_publisher',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_migration_owner',t);
   EXECUTE format('CREATE POLICY fec_v2_owner ON public.%I FOR ALL TO dsa_seats_migration_owner USING(true) WITH CHECK(true)',t);
   EXECUTE format('CREATE POLICY fec_v2_preflight_read ON public.%I FOR SELECT TO dsa_seats_release_preflight USING(true)',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fec_v2_target_universe_bytes(p_release text,p_plan text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT '['||coalesce(string_agg(to_json(seat_cycle_id)::text,',' ORDER BY seat_cycle_id COLLATE "C"),'')||']'||E'\n' FROM public.fec_v2_plan_targets WHERE release_id=p_release AND plan_sha256=p_plan $$;
CREATE OR REPLACE FUNCTION public.fec_v2_plan_bytes(p_release text,p_plan text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.fec_v2_plans%ROWTYPE; targets text; BEGIN
 SELECT * INTO p FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan; IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT '['||coalesce(string_agg(CASE WHEN kind='candidate_resolution_required' THEN '{"kind":"candidate_resolution_required","seatCycleId":'||to_json(seat_cycle_id)::text||'}' ELSE '{"kind":"terminal","seatCycleId":'||to_json(seat_cycle_id)::text||',"disposition":'||to_json(disposition)::text||',"evidenceSha256":'||to_json(evidence_sha256)::text||'}' END,',' ORDER BY seat_cycle_id COLLATE "C"),'')||']' INTO targets FROM public.fec_v2_plan_targets WHERE release_id=p_release AND plan_sha256=p_plan;
 RETURN '{"schemaVersion":2,"adapterVersion":"fec-receipt-cutoff-v2","releaseId":'||to_json(p_release)::text||',"receiptCutoff":"'||p.receipt_cutoff::text||'","campaignCycle":'||p.campaign_cycle::text||',"sourceLockSha256":'||to_json(p.source_lock_sha256)::text||',"enumerationLowerBound":"2025-01-01","targetUniverseSha256":'||to_json(p.target_universe_sha256)::text||',"forms":["F24","F3","F3X","F5"],"enumeration":{"granularity":"day","serverOrderBy":"receipt_date","clientCanonicalOrderBy":"file_number","completePasses":2},"targets":'||targets||'}'||E'\n'; END $$;

CREATE OR REPLACE FUNCTION public.seal_fec_v2_plan(p_release_id text,p_trusted_plan_sha256 text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.fec_v2_plans%ROWTYPE; universe text; canonical text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release_id));
 LOCK TABLE public.release_profile_seats IN SHARE ROW EXCLUSIVE MODE; LOCK TABLE public.fec_v2_plan_targets IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO p FROM public.fec_v2_plans WHERE release_id=p_release_id AND plan_sha256=p_trusted_plan_sha256 FOR UPDATE;
 IF NOT FOUND OR p.sealed_at IS NOT NULL OR p.plan_sha256<>p_trusted_plan_sha256 OR p.receipt_cutoff<>DATE '2026-07-18' OR p.campaign_cycle<>2026 OR p_trusted_plan_sha256 !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid trusted FEC v2 plan'; END IF;
 IF EXISTS(SELECT 1 FROM public.data_releases WHERE id=p_release_id AND (source_cutoff AT TIME ZONE 'UTC')::date<>p.receipt_cutoff) THEN RAISE EXCEPTION 'plan cutoff does not match release'; END IF;
 IF (SELECT count(*) FROM public.fec_v2_plan_targets WHERE release_id=p_release_id AND plan_sha256=p.plan_sha256)<>541 OR EXISTS((SELECT seat_cycle_id FROM public.fec_v2_plan_targets WHERE release_id=p_release_id AND plan_sha256=p.plan_sha256 EXCEPT SELECT seat_cycle_id FROM public.release_profile_seats WHERE release_id=p_release_id) UNION ALL (SELECT seat_cycle_id FROM public.release_profile_seats WHERE release_id=p_release_id EXCEPT SELECT seat_cycle_id FROM public.fec_v2_plan_targets WHERE release_id=p_release_id AND plan_sha256=p.plan_sha256)) THEN RAISE EXCEPTION 'plan targets must exactly equal 541 release_profile_seats'; END IF;
 universe:=public.fec_v2_target_universe_bytes(p_release_id,p.plan_sha256); canonical:=public.fec_v2_plan_bytes(p_release_id,p.plan_sha256);
 IF encode(digest(convert_to(universe,'UTF8'),'sha256'),'hex')<>p.target_universe_sha256 OR encode(digest(convert_to(canonical,'UTF8'),'sha256'),'hex')<>p.canonical_sha256 OR p.canonical_sha256<>p.plan_sha256 THEN RAISE EXCEPTION 'plan hash parity failure'; END IF;
 UPDATE public.fec_v2_plans SET sealed_at=clock_timestamp() WHERE release_id=p_release_id AND plan_sha256=p.plan_sha256;
END $$;

CREATE OR REPLACE FUNCTION public.seal_fec_v2_snapshot(p_release_id text,p_plan_sha256 text,p_snapshot_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.fec_v2_snapshot_metadata%ROWTYPE; payload text; actual text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release_id)); LOCK TABLE public.fec_v2_artifact_receipts IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO m FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id FOR UPDATE;
 PERFORM 1 FROM public.fec_v2_plans WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND sealed_at IS NOT NULL FOR SHARE;
 PERFORM 1 FROM public.source_snapshots WHERE release_id=p_release_id AND id=p_snapshot_id FOR SHARE;
 IF NOT FOUND OR m.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'snapshot lacks sealed plan or is already sealed'; END IF;
 SELECT '{"schemaVersion":2,"acquisitionPlanSha256":'||to_json(p_plan_sha256)::text||',"snapshotId":'||to_json(p_snapshot_id)::text||',"receipts":['||coalesce(string_agg('{"receiptId":'||to_json(receipt_id)::text||',"artifactKind":'||to_json(artifact_kind)::text||',"artifactSha256":'||to_json(artifact_sha256)::text||',"upstreamEntitySha256":'||coalesce(to_json(upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(object_key)::text||',"versionId":'||to_json(version_id)::text||',"etag":'||to_json(etag)::text||',"byteSize":'||to_json(byte_size::text)::text||',"retrievedAt":'||to_json(to_char(retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text||'}',',' ORDER BY receipt_id COLLATE "C"),'')||']}'||E'\n' INTO payload FROM public.fec_v2_artifact_receipts WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id;
 actual:=encode(digest(convert_to(payload,'UTF8'),'sha256'),'hex'); IF actual<>m.receipt_set_digest_sha256 OR NOT EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id) THEN RAISE EXCEPTION 'snapshot receipt digest/membership failure'; END IF;
 UPDATE public.fec_v2_snapshot_metadata SET sealed_at=clock_timestamp() WHERE release_id=p_release_id AND snapshot_id=p_snapshot_id;
END $$;

CREATE OR REPLACE FUNCTION public.import_fec_v2_data_signature(p_review text,p_release text,p_plan text,p_origin text,p_subject_type text,p_subject text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') THEN RAISE EXCEPTION 'data/publication signer separation or binding failure' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'reviewer or key is already a publication signer'; END IF;
 INSERT INTO public.fec_v2_data_review_signatures VALUES(p_review,p_release,p_plan,p_origin,p_subject_type,p_subject,p_reviewer,p_key,p_fp,p_signed,p_signature);
END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature(p_id text,p_release text,p_plan text,p_hash text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') THEN RAISE EXCEPTION 'publication/data signer separation or binding failure' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF NOT EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL) OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'publication signature must bind a sealed destination payload'; END IF; IF EXISTS(SELECT 1 FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'reviewer or key is already a data signer'; END IF;
 INSERT INTO public.fec_v2_publication_signatures VALUES(p_release,p_id,p_plan,p_hash,p_reviewer,p_key,p_fp,p_signed,p_signature);
END $$;
CREATE OR REPLACE FUNCTION public.assert_fec_v2_publication_route(p_release text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release) THEN
  IF (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release AND route='fec_v2_exact_election')<>1 OR NOT EXISTS(SELECT 1 FROM public.finance_proof_routes r JOIN public.fec_v2_plans p ON(p.release_id,p.plan_sha256)=(r.release_id,r.plan_sha256) WHERE r.release_id=p_release AND p.sealed_at IS NOT NULL) OR (SELECT count(*) FROM public.fec_v2_publication_proofs)<>1 OR NOT EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs pr JOIN public.fec_v2_publication_signatures s ON(s.release_id,s.id,s.canonical_sha256)=(pr.release_id,pr.signature_id,pr.canonical_sha256) JOIN public.finance_proof_routes r ON(r.release_id=s.release_id AND r.plan_sha256=s.plan_sha256) WHERE pr.release_id=p_release AND r.route='fec_v2_exact_election') OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'V2 route requires exactly one matching V2 publication proof'; END IF;
 END IF;
END $$;
GRANT SELECT ON public.fec_v2_plans,public.fec_v2_plan_targets,public.fec_v2_snapshot_metadata,public.fec_v2_artifacts,public.fec_v2_artifact_receipts,public.fec_v2_runs,public.fec_v2_run_snapshots,public.fec_v2_run_failures,public.fec_v2_enumeration_pages,public.fec_v2_filing_ledgers,public.fec_v2_filing_ledger_entries,public.fec_v2_page_lineage,public.fec_v2_sanitized_filings,public.fec_v2_amendment_chain_links,public.fec_v2_alternate_scoping TO dsa_seats_fec_v2_acquisition;
GRANT INSERT,UPDATE,DELETE ON public.fec_v2_snapshot_metadata,public.fec_v2_artifacts,public.fec_v2_artifact_receipts,public.fec_v2_runs,public.fec_v2_run_snapshots,public.fec_v2_run_failures,public.fec_v2_enumeration_pages,public.fec_v2_filing_ledgers,public.fec_v2_filing_ledger_entries,public.fec_v2_page_lineage,public.fec_v2_sanitized_filings,public.fec_v2_amendment_chain_links,public.fec_v2_alternate_scoping TO dsa_seats_fec_v2_acquisition;
GRANT SELECT ON public.fec_v2_plans,public.fec_v2_plan_targets,public.fec_v2_snapshot_metadata,public.fec_v2_artifacts,public.fec_v2_artifact_receipts,public.fec_v2_candidate_mappings,public.fec_v2_election_mappings,public.fec_v2_finance_closures,public.fec_v2_seat_coverage,public.fec_v2_exact_election_aggregates,public.fec_v2_publication_proofs,public.fec_v2_publication_signatures,public.finance_proof_routes TO dsa_seats_release_preflight;
GRANT EXECUTE ON FUNCTION public.assert_fec_v2_publication_route(text) TO dsa_seats_release_preflight;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fec_v2_artifacts','fec_v2_artifact_receipts','fec_v2_runs','fec_v2_run_snapshots','fec_v2_run_failures','fec_v2_enumeration_pages','fec_v2_filing_ledgers','fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_sanitized_filings','fec_v2_amendment_chain_links','fec_v2_alternate_scoping'] LOOP EXECUTE format('CREATE POLICY fec_v2_acquisition_write ON public.%I FOR ALL TO dsa_seats_fec_v2_acquisition USING(EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status=''candidate'')) WITH CHECK(EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status=''candidate''))',t); END LOOP; FOREACH t IN ARRAY ARRAY['fec_v2_plans','fec_v2_plan_targets'] LOOP EXECUTE format('CREATE POLICY fec_v2_acquisition_read ON public.%I FOR SELECT TO dsa_seats_fec_v2_acquisition USING(true)',t); END LOOP; END $$;
CREATE POLICY fec_v2_acquisition_snapshot_write ON public.fec_v2_snapshot_metadata FOR ALL TO dsa_seats_fec_v2_acquisition USING(sealed_at IS NULL AND EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status='candidate')) WITH CHECK(sealed_at IS NULL AND EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status='candidate'));

CREATE OR REPLACE FUNCTION public.finalize_fec_v2_exact_election_aggregate(p_release text,p_plan text,p_seat text,p_candidate text,p_election text,p_closure text,p_support bigint,p_oppose bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') THEN RAISE EXCEPTION 'only trusted FEC v2 publisher may finalize aggregates' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 IF p_support<0 OR p_oppose<0 OR NOT EXISTS(SELECT 1 FROM public.fec_v2_plans p WHERE p.release_id=p_release AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL AND p.receipt_cutoff=DATE '2026-07-18') OR NOT EXISTS(SELECT 1 FROM public.fec_v2_plan_targets t JOIN public.fec_v2_candidate_mappings c ON(c.release_id,t.plan_sha256,c.seat_cycle_id,c.target_kind)=(t.release_id,t.plan_sha256,t.seat_cycle_id,t.kind) JOIN public.fec_v2_election_mappings e ON(e.release_id,e.plan_sha256,e.candidate_mapping_id,e.seat_cycle_id)=(c.release_id,c.plan_sha256,c.id,c.seat_cycle_id) JOIN public.fec_v2_finance_closures f ON(f.release_id,f.plan_sha256,f.id,f.seat_cycle_id,f.candidate_mapping_id)=(c.release_id,c.plan_sha256,p_closure,c.seat_cycle_id,c.id) JOIN public.fec_v2_seat_coverage v ON(v.release_id,v.plan_sha256,v.seat_cycle_id,v.closure_id,v.subject_identity)=(f.release_id,f.plan_sha256,f.seat_cycle_id,f.id,f.subject_identity) WHERE t.release_id=p_release AND t.plan_sha256=p_plan AND t.seat_cycle_id=p_seat AND t.kind='candidate_resolution_required' AND c.id=p_candidate AND c.outcome='mapped' AND e.id=p_election AND e.outcome='mapped' AND f.status='finalized' AND f.finalized_at IS NOT NULL AND v.outcome IN('complete_zero','complete_nonzero') AND v.support_cents=p_support AND v.oppose_cents=p_oppose) THEN RAISE EXCEPTION 'aggregate requires coherent complete finalized closure'; END IF;
 INSERT INTO public.fec_v2_exact_election_aggregates(release_id,plan_sha256,seat_cycle_id,candidate_mapping_id,election_mapping_id,closure_id,support_cents,oppose_cents,methodology,coverage_through) VALUES(p_release,p_plan,p_seat,p_candidate,p_election,p_closure,p_support,p_oppose,'fec-receipt-cutoff-v2',DATE '2026-07-18'); END $$;

CREATE OR REPLACE FUNCTION public.import_fec_v2_data_signature(p_review text,p_release text,p_plan text,p_origin text,p_subject_type text,p_subject text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') THEN RAISE EXCEPTION 'data/publication signer separation or binding failure' USING ERRCODE='42501'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'reviewer or key is already a publication signer'; END IF; INSERT INTO public.fec_v2_data_review_signatures VALUES(p_review,p_release,p_plan,p_origin,p_subject_type,p_subject,p_reviewer,p_key,p_fp,p_signed,p_signature); END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature(p_id text,p_release text,p_plan text,p_hash text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') THEN RAISE EXCEPTION 'publication/data signer separation or binding failure' USING ERRCODE='42501'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF NOT EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL AND canonical_sha256=p_hash) THEN RAISE EXCEPTION 'publication signature must bind sealed full plan hash'; END IF; IF EXISTS(SELECT 1 FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'reviewer or key is already a data signer'; END IF; INSERT INTO public.fec_v2_publication_signatures VALUES(p_release,p_id,p_plan,p_hash,p_reviewer,p_key,p_fp,p_signed,p_signature); END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_proof(p_id text,p_release text,p_signature text,p_hash text,p_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF NOT EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures s JOIN public.fec_v2_plans p ON(p.release_id,p.plan_sha256)=(s.release_id,s.plan_sha256) WHERE s.release_id=p_release AND s.id=p_signature AND s.canonical_sha256=p_hash AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'publication proof canonical hash must equal signature subject hash'; END IF; INSERT INTO public.fec_v2_publication_proofs VALUES(p_release,p_id,p_signature,p_hash,p_created); END $$;

CREATE OR REPLACE FUNCTION public.assert_fec_v2_publication_route(p_release text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE has_v2 boolean; BEGIN
 SELECT EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release) INTO has_v2; IF has_v2 THEN IF NOT EXISTS(SELECT 1 FROM public.finance_proof_routes r JOIN public.fec_v2_plans p ON(p.release_id,p.plan_sha256)=(r.release_id,r.plan_sha256) JOIN public.fec_v2_publication_signatures s ON(s.release_id,s.plan_sha256)=(r.release_id,r.plan_sha256) JOIN public.fec_v2_publication_proofs pr ON(pr.release_id,pr.signature_id,pr.canonical_sha256)=(s.release_id,s.id,s.canonical_sha256) WHERE r.release_id=p_release AND r.route='fec_v2_exact_election' AND p.sealed_at IS NOT NULL) OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release)<>1 OR (SELECT count(*) FROM public.fec_v2_publication_proofs WHERE release_id=p_release)<>1 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'V2 route requires sealed plan and exact V2 publication proof'; END IF; ELSE IF EXISTS(SELECT 1 FROM public.finance_proof_routes WHERE release_id=p_release AND route<>'fec_v1') OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'mixed V1/V2 proofs/content forbidden'; END IF; END IF; END $$;

DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['public.fec_v2_target_universe_bytes(text,text)','public.fec_v2_plan_bytes(text,text)','public.seal_fec_v2_plan(text,text)','public.seal_fec_v2_snapshot(text,text,text)','public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint)','public.import_fec_v2_data_signature(text,text,text,text,text,text,text,text,text,timestamptz,text)','public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text)','public.import_fec_v2_publication_proof(text,text,text,text,timestamptz)','public.assert_fec_v2_publication_route(text)'] LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dsa_seats_migration_owner',f); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.seal_fec_v2_plan(text,text),public.seal_fec_v2_snapshot(text,text,text),public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint),public.import_fec_v2_data_signature(text,text,text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz),public.assert_fec_v2_publication_route(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seal_fec_v2_plan(text,text),public.seal_fec_v2_snapshot(text,text,text) TO dsa_seats_fec_v2_acquisition; GRANT EXECUTE ON FUNCTION public.import_fec_v2_data_signature(text,text,text,text,text,text,text,text,text,timestamptz,text) TO dsa_seats_fec_v2_data_reviewer; GRANT EXECUTE ON FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz),public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint) TO dsa_seats_fec_v2_publisher;
--> statement-breakpoint
-- Phase 2A final hardening: post-plan acquisition remains writable, while each
-- independently sealed/finalized identity is immutable (including OLD moves).
CREATE OR REPLACE FUNCTION public.lock_fec_v2_releases(p_old_release text,p_new_release text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF p_old_release IS NOT NULL AND p_new_release IS NOT NULL AND p_old_release IS DISTINCT FROM p_new_release THEN
   IF p_old_release COLLATE "C" < p_new_release COLLATE "C" THEN PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_old_release)); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_new_release));
   ELSE PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_new_release)); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_old_release)); END IF;
 ELSIF coalesce(p_new_release,p_old_release) IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||coalesce(p_new_release,p_old_release))); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_sealed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE old_data jsonb:='{}'::jsonb; new_data jsonb:='{}'::jsonb; old_release text; old_plan text; new_release text; new_plan text; active_release text; sealed_evidence boolean; finalized_content boolean; BEGIN
 IF TG_OP<>'INSERT' THEN old_data:=to_jsonb(OLD); old_release:=old_data->>'release_id'; old_plan:=old_data->>'plan_sha256'; END IF;
 IF TG_OP<>'DELETE' THEN new_data:=to_jsonb(NEW); new_release:=new_data->>'release_id'; new_plan:=new_data->>'plan_sha256'; END IF;
  IF TG_TABLE_NAME IN ('fec_v2_candidate_mappings','fec_v2_committee_mappings','fec_v2_election_mappings','fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots','fec_v2_seat_coverage') THEN
   PERFORM public.lock_fec_v2_releases(old_release,new_release);
   finalized_content:=CASE TG_TABLE_NAME
    WHEN 'fec_v2_closure_input_receipts' THEN EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND ((f.release_id,f.plan_sha256,f.id)=(old_release,old_plan,old_data->>'closure_id') OR (f.release_id,f.plan_sha256,f.id)=(new_release,new_plan,new_data->>'closure_id')))
    WHEN 'fec_v2_closure_input_snapshots' THEN EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND ((f.release_id,f.plan_sha256,f.id)=(old_release,old_plan,old_data->>'closure_id') OR (f.release_id,f.plan_sha256,f.id)=(new_release,new_plan,new_data->>'closure_id')))
    WHEN 'fec_v2_candidate_mappings' THEN EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND ((f.release_id,f.plan_sha256,f.candidate_mapping_id)=(old_release,old_plan,old_data->>'id') OR (f.release_id,f.plan_sha256,f.candidate_mapping_id)=(new_release,new_plan,new_data->>'id'))) OR EXISTS(SELECT 1 FROM public.fec_v2_exact_election_aggregates a WHERE (a.release_id,a.plan_sha256,a.candidate_mapping_id)=(old_release,old_plan,old_data->>'id') OR (a.release_id,a.plan_sha256,a.candidate_mapping_id)=(new_release,new_plan,new_data->>'id'))
    WHEN 'fec_v2_committee_mappings' THEN EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND ((f.release_id,f.plan_sha256,f.candidate_mapping_id)=(old_release,old_plan,old_data->>'candidate_mapping_id') OR (f.release_id,f.plan_sha256,f.candidate_mapping_id)=(new_release,new_plan,new_data->>'candidate_mapping_id')))
    WHEN 'fec_v2_election_mappings' THEN EXISTS(SELECT 1 FROM public.fec_v2_exact_election_aggregates a WHERE (a.release_id,a.plan_sha256,a.election_mapping_id)=(old_release,old_plan,old_data->>'id') OR (a.release_id,a.plan_sha256,a.election_mapping_id)=(new_release,new_plan,new_data->>'id'))
    WHEN 'fec_v2_seat_coverage' THEN EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND ((f.release_id,f.plan_sha256,f.id)=(old_release,old_plan,old_data->>'closure_id') OR (f.release_id,f.plan_sha256,f.id)=(new_release,new_plan,new_data->>'closure_id'))) OR EXISTS(SELECT 1 FROM public.fec_v2_exact_election_aggregates a WHERE (a.release_id,a.plan_sha256,a.seat_cycle_id,a.closure_id,a.candidate_mapping_id)=(old_release,old_plan,old_data->>'seat_cycle_id',old_data->>'closure_id',old_data->>'subject_identity') OR (a.release_id,a.plan_sha256,a.seat_cycle_id,a.closure_id,a.candidate_mapping_id)=(new_release,new_plan,new_data->>'seat_cycle_id',new_data->>'closure_id',new_data->>'subject_identity'))
    ELSE false END;
   IF finalized_content THEN RAISE EXCEPTION 'finalized FEC v2 content is immutable' USING ERRCODE='55000'; END IF;
   RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
 active_release:=coalesce(new_release,old_release); PERFORM public.lock_fec_v2_releases(old_release,new_release);
 IF TG_TABLE_NAME IN ('fec_v2_plans','fec_v2_plan_targets') AND EXISTS(SELECT 1 FROM public.fec_v2_plans p WHERE p.sealed_at IS NOT NULL AND ((old_release IS NOT NULL AND (p.release_id,p.plan_sha256)=(old_release,old_plan)) OR (new_release IS NOT NULL AND (p.release_id,p.plan_sha256)=(new_release,new_plan)))) THEN
   IF TG_TABLE_NAME='fec_v2_plans' AND TG_OP='UPDATE' AND old_data->'sealed_at'='null'::jsonb AND new_data->'sealed_at'<>'null'::jsonb AND old_data-'sealed_at'=new_data-'sealed_at' THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'sealed FEC v2 plan is immutable' USING ERRCODE='55000';
 END IF;
 sealed_evidence:=CASE TG_TABLE_NAME
   WHEN 'fec_v2_artifact_receipts' THEN EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.sealed_at IS NOT NULL AND ((m.release_id,m.snapshot_id)=(old_release,old_data->>'snapshot_id') OR (m.release_id,m.snapshot_id)=(new_release,new_data->>'snapshot_id')))
   WHEN 'fec_v2_artifacts' THEN EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts r JOIN public.fec_v2_snapshot_metadata m ON(m.release_id,m.snapshot_id)=(r.release_id,r.snapshot_id) WHERE m.sealed_at IS NOT NULL AND ((r.release_id,r.plan_sha256,r.artifact_sha256)=(old_release,old_plan,old_data->>'artifact_sha256') OR (r.release_id,r.plan_sha256,r.artifact_sha256)=(new_release,new_plan,new_data->>'artifact_sha256')))
   WHEN 'fec_v2_runs' THEN EXISTS(SELECT 1 FROM public.fec_v2_run_snapshots rs JOIN public.fec_v2_snapshot_metadata m ON(m.release_id,m.snapshot_id)=(rs.release_id,rs.snapshot_id) WHERE m.sealed_at IS NOT NULL AND ((rs.release_id,rs.plan_sha256,rs.run_id)=(old_release,old_plan,old_data->>'run_id') OR (rs.release_id,rs.plan_sha256,rs.run_id)=(new_release,new_plan,new_data->>'run_id')))
   WHEN 'fec_v2_run_snapshots' THEN EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.sealed_at IS NOT NULL AND ((m.release_id,m.snapshot_id)=(old_release,old_data->>'snapshot_id') OR (m.release_id,m.snapshot_id)=(new_release,new_data->>'snapshot_id')))
   WHEN 'fec_v2_run_failures' THEN EXISTS(SELECT 1 FROM public.fec_v2_run_snapshots rs JOIN public.fec_v2_snapshot_metadata m ON(m.release_id,m.snapshot_id)=(rs.release_id,rs.snapshot_id) WHERE m.sealed_at IS NOT NULL AND ((rs.release_id,rs.plan_sha256,rs.run_id)=(old_release,old_plan,old_data->>'run_id') OR (rs.release_id,rs.plan_sha256,rs.run_id)=(new_release,new_plan,new_data->>'run_id')))
   ELSE EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts r JOIN public.fec_v2_snapshot_metadata m ON(m.release_id,m.snapshot_id)=(r.release_id,r.snapshot_id) WHERE m.sealed_at IS NOT NULL AND ((TG_TABLE_NAME IN ('fec_v2_enumeration_pages','fec_v2_filing_ledgers','fec_v2_sanitized_filings') AND (r.release_id,r.plan_sha256,r.artifact_sha256) IN ((old_release,old_plan,old_data->>'artifact_sha256'),(new_release,new_plan,new_data->>'artifact_sha256'))) OR (TG_TABLE_NAME IN ('fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_amendment_chain_links') AND (r.release_id,r.plan_sha256,r.artifact_sha256) IN ((old_release,old_plan,old_data->>'ledger_sha256'),(new_release,new_plan,new_data->>'ledger_sha256'))) OR (TG_TABLE_NAME='fec_v2_alternate_scoping' AND (r.release_id,r.plan_sha256,r.artifact_sha256) IN ((old_release,old_plan,old_data->>'sanitized_artifact_sha256'),(new_release,new_plan,new_data->>'sanitized_artifact_sha256'))))) END;
 IF sealed_evidence THEN RAISE EXCEPTION 'sealed FEC v2 acquisition evidence is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_snapshot_metadata' AND TG_OP<>'INSERT' AND old_data->'sealed_at'<>'null'::jsonb THEN RAISE EXCEPTION 'sealed FEC v2 snapshot is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_artifact_receipts' AND EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.sealed_at IS NOT NULL AND ((old_release IS NOT NULL AND (m.release_id,m.snapshot_id)=(old_release,old_data->>'snapshot_id')) OR (new_release IS NOT NULL AND (m.release_id,m.snapshot_id)=(new_release,new_data->>'snapshot_id')))) THEN RAISE EXCEPTION 'sealed FEC v2 receipt membership/identity is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_artifacts' AND EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts r JOIN public.fec_v2_snapshot_metadata m ON(m.release_id,m.snapshot_id)=(r.release_id,r.snapshot_id) WHERE m.sealed_at IS NOT NULL AND ((old_release IS NOT NULL AND (r.release_id,r.plan_sha256,r.artifact_sha256)=(old_release,old_plan,old_data->>'artifact_sha256')) OR (new_release IS NOT NULL AND (r.release_id,r.plan_sha256,r.artifact_sha256)=(new_release,new_plan,new_data->>'artifact_sha256')))) THEN RAISE EXCEPTION 'sealed FEC v2 artifact identity is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_filing_ledgers' AND TG_OP<>'INSERT' AND old_data->'finalized_at'<>'null'::jsonb THEN RAISE EXCEPTION 'finalized ledger is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_exact_election_aggregates' AND (TG_OP<>'INSERT' OR (NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') AND NOT (pg_has_role(session_user,'dsa_seats_migration_owner','member') AND EXISTS(
   SELECT 1 FROM public.data_releases d
   JOIN public.fec_v2_exact_election_aggregates s ON s.release_id IS NOT DISTINCT FROM d.previous_release_id
   WHERE d.id IS NOT DISTINCT FROM new_release
     AND d.status IS NOT DISTINCT FROM 'candidate'
     AND d.previous_release_id IS NOT NULL
     AND s.plan_sha256 IS NOT DISTINCT FROM new_plan
     AND s.seat_cycle_id IS NOT DISTINCT FROM new_data->>'seat_cycle_id'
     AND s.candidate_mapping_id IS NOT DISTINCT FROM new_data->>'candidate_mapping_id'
     AND s.election_mapping_id IS NOT DISTINCT FROM new_data->>'election_mapping_id'
     AND s.closure_id IS NOT DISTINCT FROM new_data->>'closure_id'
     AND s.support_cents IS NOT DISTINCT FROM (new_data->>'support_cents')::bigint
     AND s.oppose_cents IS NOT DISTINCT FROM (new_data->>'oppose_cents')::bigint
     AND s.methodology IS NOT DISTINCT FROM new_data->>'methodology'
     AND s.coverage_through IS NOT DISTINCT FROM (new_data->>'coverage_through')::date
 )))) THEN RAISE EXCEPTION 'finalized aggregate is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME IN ('fec_v2_candidate_mappings','fec_v2_committee_mappings','fec_v2_election_mappings','fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots','fec_v2_seat_coverage') AND EXISTS(SELECT 1 FROM public.fec_v2_finance_closures f WHERE f.finalized_at IS NOT NULL AND f.release_id=active_release AND f.plan_sha256=coalesce(new_plan,old_plan) AND (TG_TABLE_NAME NOT LIKE 'fec_v2_closure_input%' OR f.id=coalesce(new_data->>'closure_id',old_data->>'closure_id'))) THEN RAISE EXCEPTION 'finalized FEC v2 content is immutable' USING ERRCODE='55000'; END IF;
 IF TG_TABLE_NAME='fec_v2_finance_closures' AND TG_OP<>'INSERT' AND old_data->'finalized_at'<>'null'::jsonb THEN RAISE EXCEPTION 'finalized closure is immutable' USING ERRCODE='55000'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fec_v2_plans','finance_proof_routes','fec_v2_plan_targets','fec_v2_artifact_receipts','fec_v2_artifacts','fec_v2_snapshot_metadata','fec_v2_runs','fec_v2_run_snapshots','fec_v2_run_failures','fec_v2_candidate_mappings','fec_v2_committee_mappings','fec_v2_election_mappings','fec_v2_finance_closures','fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots','fec_v2_seat_coverage','fec_v2_exact_election_aggregates','fec_v2_filing_ledgers','fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_sanitized_filings','fec_v2_amendment_chain_links','fec_v2_alternate_scoping','fec_v2_enumeration_pages'] LOOP EXECUTE format('CREATE TRIGGER fec_v2_sealed_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_sealed()',t,t); EXECUTE format('CREATE TRIGGER fec_v2_live_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content()',t,t); END LOOP; END $$;
-- Clone-stable V2 content participates in the finance digest/gate.  Runs,
-- failures, snapshots, and publication attestations intentionally do not.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fec_v2_plans','finance_proof_routes','fec_v2_plan_targets','fec_v2_snapshot_metadata','fec_v2_artifacts','fec_v2_artifact_receipts','fec_v2_enumeration_pages','fec_v2_filing_ledgers','fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_amendment_chain_links','fec_v2_sanitized_filings','fec_v2_alternate_scoping','fec_v2_candidate_mappings','fec_v2_committee_mappings','fec_v2_election_mappings','fec_v2_finance_closures','fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots','fec_v2_seat_coverage','fec_v2_exact_election_aggregates','fec_v2_data_review_signatures'] LOOP EXECUTE format('CREATE TRIGGER fec_v2_nationwide_finance_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_nationwide_content(''finance'')',t,t); END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.seal_fec_v2_snapshot(p_release_id text,p_plan_sha256 text,p_snapshot_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.fec_v2_snapshot_metadata%ROWTYPE; payload text; actual text; plan_ok boolean; source_checksum text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release_id)); LOCK TABLE public.fec_v2_artifact_receipts IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO m FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'snapshot metadata missing'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND sealed_at IS NOT NULL) INTO plan_ok; IF NOT plan_ok OR m.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'snapshot lacks sealed plan or is already sealed'; END IF;
 SELECT checksum_sha256 INTO source_checksum FROM public.source_snapshots WHERE release_id=p_release_id AND id=p_snapshot_id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'source snapshot missing'; END IF;
 SELECT '{"schemaVersion":2,"acquisitionPlanSha256":'||to_json(p_plan_sha256)::text||',"snapshotId":'||to_json(p_snapshot_id)::text||',"receipts":['||coalesce(string_agg('{"receiptId":'||to_json(receipt_id)::text||',"artifactKind":'||to_json(artifact_kind)::text||',"artifactSha256":'||to_json(artifact_sha256)::text||',"upstreamEntitySha256":'||coalesce(to_json(upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(object_key)::text||',"versionId":'||to_json(version_id)::text||',"etag":'||to_json(etag)::text||',"byteSize":'||to_json(byte_size::text)::text||',"retrievedAt":'||to_json(to_char(retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text||'}',',' ORDER BY receipt_id COLLATE "C"),'')||']}'||E'\n' INTO payload FROM public.fec_v2_artifact_receipts WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id;
 actual:=encode(digest(convert_to(payload,'UTF8'),'sha256'),'hex'); IF actual<>m.receipt_set_digest_sha256 OR actual<>source_checksum OR NOT EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id) THEN RAISE EXCEPTION 'snapshot receipt digest/membership failure'; END IF;
 UPDATE public.fec_v2_snapshot_metadata SET sealed_at=clock_timestamp() WHERE release_id=p_release_id AND snapshot_id=p_snapshot_id;
END $$;
ALTER FUNCTION public.guard_fec_v2_sealed() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.seal_fec_v2_snapshot(text,text,text) OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.guard_fec_v2_sealed(),public.seal_fec_v2_snapshot(text,text,text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_source_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 PERFORM public.lock_fec_v2_releases(OLD.release_id,CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.release_id END);
 IF EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=OLD.release_id AND m.snapshot_id=OLD.id AND m.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'sealed FEC v2 source snapshot is immutable' USING ERRCODE='55000'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER fec_v2_source_snapshot_sealed BEFORE UPDATE OR DELETE ON public.source_snapshots FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_source_snapshot();
ALTER FUNCTION public.guard_fec_v2_source_snapshot() OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.guard_fec_v2_source_snapshot() FROM PUBLIC;
GRANT SELECT ON public.data_releases TO dsa_seats_fec_v2_acquisition;
CREATE POLICY fec_v2_acquisition_release_read ON public.data_releases FOR SELECT TO dsa_seats_fec_v2_acquisition USING(status='candidate');

-- Phase 2A deliberately leaves publication disabled until Phase 2B can build
-- and independently verify a canonical finalized-content payload.
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature(p_id text,p_release text,p_plan text,p_hash text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 RAISE EXCEPTION 'FEC_V2_PUBLICATION_PAYLOAD_NOT_IMPLEMENTED' USING ERRCODE='55000';
END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_proof(p_id text,p_release text,p_signature text,p_hash text,p_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 RAISE EXCEPTION 'FEC_V2_PUBLICATION_PAYLOAD_NOT_IMPLEMENTED' USING ERRCODE='55000';
END $$;
CREATE OR REPLACE FUNCTION public.assert_fec_v2_publication_route(p_release text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release) THEN RAISE EXCEPTION 'FEC_V2_PUBLICATION_PAYLOAD_NOT_IMPLEMENTED' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM public.finance_proof_routes WHERE release_id=p_release AND route<>'fec_v1') OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'mixed V1/V2 proofs/content forbidden'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_fec_v2_exact_election_aggregate(p_release text,p_plan text,p_seat text,p_candidate text,p_election text,p_closure text,p_support bigint,p_oppose bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') THEN RAISE EXCEPTION 'only trusted FEC v2 publisher may finalize aggregates' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 IF p_support<0 OR p_oppose<0 OR NOT EXISTS(SELECT 1 FROM public.fec_v2_plans p WHERE p.release_id=p_release AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL AND p.receipt_cutoff=DATE '2026-07-18') OR NOT EXISTS(
  SELECT 1 FROM public.fec_v2_plan_targets t
  JOIN public.fec_v2_candidate_mappings c ON(c.release_id,c.plan_sha256,c.seat_cycle_id,c.target_kind)=(t.release_id,t.plan_sha256,t.seat_cycle_id,t.kind)
  JOIN public.fec_v2_election_mappings e ON(e.release_id,e.plan_sha256,e.candidate_mapping_id,e.seat_cycle_id)=(c.release_id,c.plan_sha256,c.id,c.seat_cycle_id)
  JOIN public.fec_v2_finance_closures f ON(f.release_id,f.plan_sha256,f.id,f.seat_cycle_id,f.candidate_mapping_id)=(c.release_id,c.plan_sha256,p_closure,c.seat_cycle_id,c.id)
  JOIN public.fec_v2_seat_coverage v ON(v.release_id,v.plan_sha256,v.seat_cycle_id,v.closure_id,v.subject_identity)=(f.release_id,f.plan_sha256,f.seat_cycle_id,f.id,f.subject_identity)
  WHERE t.release_id=p_release AND t.plan_sha256=p_plan AND t.seat_cycle_id=p_seat AND t.kind='candidate_resolution_required' AND c.id=p_candidate AND c.outcome='mapped' AND e.id=p_election AND e.outcome='mapped' AND f.status='finalized' AND f.finalized_at IS NOT NULL AND v.outcome IN('complete_zero','complete_nonzero') AND v.support_cents=p_support AND v.oppose_cents=p_oppose
 ) THEN RAISE EXCEPTION 'aggregate requires coherent complete finalized closure'; END IF;
 INSERT INTO public.fec_v2_exact_election_aggregates(release_id,plan_sha256,seat_cycle_id,candidate_mapping_id,election_mapping_id,closure_id,support_cents,oppose_cents,methodology,coverage_through) VALUES(p_release,p_plan,p_seat,p_candidate,p_election,p_closure,p_support,p_oppose,'fec-receipt-cutoff-v2',DATE '2026-07-18');
END $$;
DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text)','public.import_fec_v2_publication_proof(text,text,text,text,timestamptz)','public.assert_fec_v2_publication_route(text)','public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint)'] LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dsa_seats_migration_owner',f); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz),public.assert_fec_v2_publication_route(text),public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_fec_v2_publication_route(text) TO dsa_seats_release_preflight;
GRANT EXECUTE ON FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz),public.finalize_fec_v2_exact_election_aggregate(text,text,text,text,text,text,bigint,bigint) TO dsa_seats_fec_v2_publisher;
-- Keep the Phase 2A route fail-closed even when callers use the legacy V1
-- lifecycle routines rather than the FEC-specific preflight API.
CREATE OR REPLACE FUNCTION public.guard_fec_v2_publication_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='published' AND EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=NEW.id) THEN PERFORM public.assert_fec_v2_publication_route(NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER data_releases_fec_v2_publication_guard BEFORE UPDATE OF status ON public.data_releases FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_publication_lifecycle();

-- Acquisition may create only a new, ordinary FEC-v2 snapshot for a candidate
-- release.  It cannot update arbitrary source snapshots or manufacture a
-- publishable snapshot outside the FEC receipt-cutoff contract.
CREATE OR REPLACE FUNCTION public.create_fec_v2_source_snapshot(p_release text,p_snapshot text,p_source text,p_source_url text,p_retrieved_at timestamptz,p_checksum text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') THEN RAISE EXCEPTION 'only FEC v2 acquisition may create source snapshots' USING ERRCODE='42501'; END IF;
 IF p_snapshot !~ '^[A-Za-z0-9_-]{1,128}$' OR p_checksum !~ '^[a-f0-9]{64}$' OR p_source_url !~ '^https://([A-Za-z0-9-]+\.)*fec\.gov/' THEN RAISE EXCEPTION 'invalid FEC v2 source snapshot' USING ERRCODE='22023'; END IF;
 PERFORM public.lock_fec_v2_releases(NULL,p_release);
 IF NOT EXISTS(SELECT 1 FROM public.data_releases WHERE id=p_release AND status='candidate') OR NOT EXISTS(SELECT 1 FROM public.sources WHERE release_id=p_release AND id=p_source AND name='fec' AND authority='official' AND homepage_url='https://api.open.fec.gov') OR EXISTS(SELECT 1 FROM public.source_snapshots WHERE release_id=p_release AND id=p_snapshot) THEN RAISE EXCEPTION 'FEC v2 source snapshot requires a new candidate official-source row' USING ERRCODE='23514'; END IF;
 INSERT INTO public.source_snapshots(release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES(p_release,p_snapshot,p_source,p_source_url,NULL,p_retrieved_at,p_checksum,'fec-receipt-cutoff-v2','public','restricted');
END $$;
ALTER FUNCTION public.lock_fec_v2_releases(text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_publication_lifecycle() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.create_fec_v2_source_snapshot(text,text,text,text,timestamptz,text) OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.lock_fec_v2_releases(text,text),public.guard_fec_v2_publication_lifecycle(),public.create_fec_v2_source_snapshot(text,text,text,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fec_v2_source_snapshot(text,text,text,text,timestamptz,text) TO dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.fec_v2_target_universe_bytes(text,text),public.fec_v2_plan_bytes(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fec_v2_target_universe_bytes(text,text),public.fec_v2_plan_bytes(text,text) TO dsa_seats_fec_v2_acquisition;
-- A plan's wire releaseId is its issuance identity, not the release that happens
-- to carry a clone.  This final definition supersedes the generated foundation.
CREATE OR REPLACE FUNCTION public.fec_v2_plan_bytes(p_release text,p_plan text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public.fec_v2_plans%ROWTYPE; targets text; BEGIN
 SELECT * INTO p FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan; IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT '['||coalesce(string_agg(CASE WHEN kind='candidate_resolution_required' THEN '{"kind":"candidate_resolution_required","seatCycleId":'||to_json(seat_cycle_id)::text||'}' ELSE '{"kind":"terminal","seatCycleId":'||to_json(seat_cycle_id)::text||',"disposition":'||to_json(disposition)::text||',"evidenceSha256":'||to_json(evidence_sha256)::text||'}' END,',' ORDER BY seat_cycle_id COLLATE "C"),'')||']' INTO targets FROM public.fec_v2_plan_targets WHERE release_id=p_release AND plan_sha256=p_plan;
 RETURN '{"schemaVersion":2,"adapterVersion":"fec-receipt-cutoff-v2","releaseId":'||to_json(p.origin_release_id)::text||',"receiptCutoff":"'||p.receipt_cutoff::text||'","campaignCycle":'||p.campaign_cycle::text||',"sourceLockSha256":'||to_json(p.source_lock_sha256)::text||',"enumerationLowerBound":"2025-01-01","targetUniverseSha256":'||to_json(p.target_universe_sha256)::text||',"forms":["F24","F3","F3X","F5"],"enumeration":{"granularity":"day","serverOrderBy":"receipt_date","clientCanonicalOrderBy":"file_number","completePasses":2},"targets":'||targets||'}'||E'\n';
END $$;
ALTER FUNCTION public.fec_v2_plan_bytes(text,text) OWNER TO dsa_seats_migration_owner;

-- The receipt payload has one canonical implementation.  Cloning and sealing
-- both hash these exact millisecond-UTC bytes.
CREATE OR REPLACE FUNCTION public.fec_v2_snapshot_receipt_bytes(p_release text,p_plan text,p_snapshot text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT '{"schemaVersion":2,"acquisitionPlanSha256":'||to_json(p_plan)::text||',"snapshotId":'||to_json(p_snapshot)::text||',"receipts":['||coalesce(string_agg('{"receiptId":'||to_json(receipt_id)::text||',"artifactKind":'||to_json(artifact_kind)::text||',"artifactSha256":'||to_json(artifact_sha256)::text||',"upstreamEntitySha256":'||coalesce(to_json(upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(object_key)::text||',"versionId":'||to_json(version_id)::text||',"etag":'||to_json(etag)::text||',"byteSize":'||to_json(byte_size::text)::text||',"retrievedAt":'||to_json(to_char(retrieved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text||'}',',' ORDER BY receipt_id COLLATE "C"),'')||']}'||E'\n' FROM public.fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND snapshot_id=p_snapshot $$;
CREATE OR REPLACE FUNCTION public.seal_fec_v2_snapshot(p_release_id text,p_plan_sha256 text,p_snapshot_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE m public.fec_v2_snapshot_metadata%ROWTYPE; actual text; source_checksum text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release_id)); LOCK TABLE public.fec_v2_artifact_receipts IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO m FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id FOR UPDATE;
 IF NOT FOUND OR m.sealed_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'snapshot lacks sealed plan or is already sealed'; END IF;
 SELECT checksum_sha256 INTO source_checksum FROM public.source_snapshots WHERE release_id=p_release_id AND id=p_snapshot_id FOR SHARE;
 actual:=encode(digest(convert_to(public.fec_v2_snapshot_receipt_bytes(p_release_id,p_plan_sha256,p_snapshot_id),'UTF8'),'sha256'),'hex');
 IF actual<>m.receipt_set_digest_sha256 OR actual<>source_checksum OR NOT EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts WHERE release_id=p_release_id AND plan_sha256=p_plan_sha256 AND snapshot_id=p_snapshot_id) THEN RAISE EXCEPTION 'snapshot receipt digest/membership failure'; END IF;
 UPDATE public.fec_v2_snapshot_metadata SET sealed_at=clock_timestamp() WHERE release_id=p_release_id AND snapshot_id=p_snapshot_id;
END $$;
CREATE OR REPLACE FUNCTION public.expected_fec_v2_origin(p_release text,p_plan_sha256 text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 WITH RECURSIVE lineage(id,previous_release_id,path) AS (SELECT id,previous_release_id,ARRAY[id] FROM public.data_releases WHERE id=p_release UNION ALL SELECT r.id,r.previous_release_id,l.path||r.id FROM lineage l JOIN public.data_releases r ON r.id=l.previous_release_id WHERE NOT r.id=ANY(l.path)) SELECT coalesce((SELECT p.origin_release_id FROM lineage l JOIN public.fec_v2_plans p ON p.release_id=l.id AND p.plan_sha256=p_plan_sha256 ORDER BY cardinality(l.path) ASC LIMIT 1),p_release) $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_origin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.origin_release_id<>public.expected_fec_v2_origin(NEW.release_id,NEW.plan_sha256) THEN RAISE EXCEPTION 'FEC v2 origin must equal the issuance release and remain stable through same-plan descendants' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER fec_v2_plan_origin BEFORE INSERT OR UPDATE ON public.fec_v2_plans FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_origin();
CREATE TRIGGER fec_v2_snapshot_origin BEFORE INSERT OR UPDATE ON public.fec_v2_snapshot_metadata FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_origin();
CREATE TRIGGER fec_v2_data_signature_origin BEFORE INSERT OR UPDATE ON public.fec_v2_data_review_signatures FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_origin();
DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['public.fec_v2_snapshot_receipt_bytes(text,text,text)','public.seal_fec_v2_snapshot(text,text,text)','public.expected_fec_v2_origin(text,text)','public.guard_fec_v2_origin()'] LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dsa_seats_migration_owner',f); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.fec_v2_snapshot_receipt_bytes(text,text,text),public.expected_fec_v2_origin(text,text),public.guard_fec_v2_origin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fec_v2_snapshot_receipt_bytes(text,text,text) TO dsa_seats_migration_owner;
--> statement-breakpoint
-- Phase 2B: structural publication boundary.  Signature cryptography remains
-- exclusively in the TypeScript verifier; these procedures only admit the
-- sealed, finalized and independently reviewed publication shape.
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature(p_id text,p_release text,p_plan text,p_hash text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_sealed_at timestamptz; latest_final timestamptz; latest_review timestamptz; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') THEN RAISE EXCEPTION 'publication/data signer separation or binding failure' USING ERRCODE='42501'; END IF;
 IF p_id='' OR p_reviewer='' OR p_key='' OR p_signature='' OR p_plan !~ '^[a-f0-9]{64}$' OR p_hash !~ '^[a-f0-9]{64}$' OR p_fp !~ '^[a-f0-9]{64}$' OR p_signed IS NULL OR p_signed>clock_timestamp() THEN RAISE EXCEPTION 'invalid FEC v2 publication signature fields' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 SELECT p.sealed_at INTO v_sealed_at FROM public.finance_proof_routes r JOIN public.fec_v2_plans p ON (p.release_id,p.plan_sha256)=(r.release_id,r.plan_sha256) JOIN public.data_releases d ON d.id=p.release_id WHERE r.release_id=p_release AND r.route='fec_v2_exact_election' AND r.plan_sha256=p_plan AND d.status='candidate';
 IF v_sealed_at IS NULL OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release)=0 OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release AND route='fec_v2_exact_election' AND plan_sha256=p_plan)=0 OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release)<>1 OR (SELECT count(*) FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL)<>1 THEN RAISE EXCEPTION 'publication signature requires exactly one sealed selected route/plan'; END IF;
 IF EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'publication signer/proof is already bound'; END IF;
 SELECT max(x) INTO latest_final FROM (SELECT finalized_at x FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan UNION ALL SELECT finalized_at FROM public.fec_v2_finance_closures WHERE release_id=p_release AND plan_sha256=p_plan) q;
 SELECT max(signed_at) INTO latest_review FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND plan_sha256=p_plan;
 IF EXISTS(SELECT 1 FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND finalized_at IS NULL) OR EXISTS(SELECT 1 FROM public.fec_v2_finance_closures WHERE release_id=p_release AND plan_sha256=p_plan AND finalized_at IS NULL) OR p_signed<=v_sealed_at OR (latest_final IS NOT NULL AND p_signed<=latest_final) OR (latest_review IS NOT NULL AND p_signed<=latest_review) THEN RAISE EXCEPTION 'publication signature must follow plan, finalizations, and reviews'; END IF;
 INSERT INTO public.fec_v2_publication_signatures(release_id,id,plan_sha256,canonical_sha256,reviewer_id,key_id,public_key_fingerprint,signed_at,signature) VALUES(p_release,p_id,p_plan,p_hash,p_reviewer,p_key,p_fp,p_signed,p_signature);
END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_proof(p_id text,p_release text,p_signature text,p_hash text,p_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE signed timestamptz; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') THEN RAISE EXCEPTION 'only publisher may import publication proof' USING ERRCODE='42501'; END IF;
 IF p_id='' OR p_signature='' OR p_hash !~ '^[a-f0-9]{64}$' OR p_created IS NULL OR p_created>clock_timestamp() THEN RAISE EXCEPTION 'invalid FEC v2 publication proof fields' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 SELECT signed_at INTO signed FROM public.fec_v2_publication_signatures WHERE release_id=p_release AND id=p_signature AND canonical_sha256=p_hash;
 IF signed IS NULL OR p_created<=signed OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'publication proof must uniquely follow its signature'; END IF;
 INSERT INTO public.fec_v2_publication_proofs(release_id,id,signature_id,canonical_sha256,created_at) VALUES(p_release,p_id,p_signature,p_hash,p_created);
END $$;
CREATE OR REPLACE FUNCTION public.assert_fec_v2_publication_route(p_release text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release) THEN
  IF (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release AND route='fec_v2_exact_election')<>1 OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release)<>1 OR (SELECT count(*) FROM public.fec_v2_plans p JOIN public.finance_proof_routes r ON (r.release_id,r.plan_sha256)=(p.release_id,p.plan_sha256) WHERE r.release_id=p_release AND p.sealed_at IS NOT NULL)<>1 OR (SELECT count(*) FROM public.fec_v2_publication_signatures WHERE release_id=p_release)<>1 OR (SELECT count(*) FROM public.fec_v2_publication_proofs WHERE release_id=p_release)<>1 OR NOT EXISTS(SELECT 1 FROM public.finance_proof_routes r JOIN public.fec_v2_publication_signatures s ON (s.release_id,s.plan_sha256)=(r.release_id,r.plan_sha256) JOIN public.fec_v2_publication_proofs p ON (p.release_id,p.signature_id,p.canonical_sha256)=(s.release_id,s.id,s.canonical_sha256) WHERE r.release_id=p_release AND r.route='fec_v2_exact_election') OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_release) THEN RAISE EXCEPTION 'V2 route requires exactly one matching V2 publication proof'; END IF;
 ELSIF EXISTS(SELECT 1 FROM public.finance_proof_routes WHERE release_id=p_release AND route<>'fec_v1') OR EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'mixed V1/V2 proofs/content forbidden'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.operational_evidence_fingerprint(p_target text,p_predecessor text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ WITH releases(id) AS (SELECT p_target UNION SELECT p_predecessor WHERE p_predecessor IS NOT NULL), records(record) AS (
 SELECT jsonb_build_object('table','reviewer_signatures','release_id',release_id,'review_id',review_id,'subject_type',subject_type,'subject_sha256',subject_sha256,'reviewer_id',reviewer_id,'signed_at',to_char(signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'signature',signature,'key_id',key_id) FROM public.reviewer_signatures WHERE release_id IN(SELECT id FROM releases)
 UNION ALL SELECT jsonb_build_object('table','finance_publication_proofs','release_id',release_id,'id',id,'canonical_sha256',canonical_sha256,'signed_review_id',signed_review_id,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.finance_publication_proofs WHERE release_id IN(SELECT id FROM releases)
 UNION ALL SELECT jsonb_build_object('table','election_publication_proofs','release_id',release_id,'id',id,'canonical_sha256',canonical_sha256,'signed_review_id',signed_review_id,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.election_publication_proofs WHERE release_id IN(SELECT id FROM releases)
 UNION ALL SELECT jsonb_build_object('table','fec_v2_data_review_signatures','release_id',release_id,'review_id',review_id,'plan_sha256',plan_sha256,'origin_release_id',origin_release_id,'subject_type',subject_type,'subject_sha256',subject_sha256,'reviewer_id',reviewer_id,'key_id',key_id,'public_key_fingerprint',public_key_fingerprint,'signed_at',to_char(signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'signature',signature) FROM public.fec_v2_data_review_signatures WHERE release_id IN(SELECT id FROM releases)
 UNION ALL SELECT jsonb_build_object('table','fec_v2_publication_signatures','release_id',release_id,'id',id,'plan_sha256',plan_sha256,'canonical_sha256',canonical_sha256,'reviewer_id',reviewer_id,'key_id',key_id,'public_key_fingerprint',public_key_fingerprint,'signed_at',to_char(signed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'signature',signature) FROM public.fec_v2_publication_signatures WHERE release_id IN(SELECT id FROM releases)
 UNION ALL SELECT jsonb_build_object('table','fec_v2_publication_proofs','release_id',release_id,'id',id,'signature_id',signature_id,'canonical_sha256',canonical_sha256,'created_at',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.fec_v2_publication_proofs WHERE release_id IN(SELECT id FROM releases)) SELECT encode(digest(coalesce(string_agg(record::text,E'\n' ORDER BY record::text COLLATE "C"),''),'sha256'),'hex') FROM records $$;
ALTER TABLE public.release_launch_verifier_attestations DROP CONSTRAINT release_launch_verifier_attestations_kind_ck;
ALTER TABLE public.release_launch_verifier_attestations ADD CONSTRAINT release_launch_verifier_attestations_kind_ck CHECK(proof_kind IN('finance','election','maps','fec_v2_finance','fec_v2_election','fec_v2_maps'));
CREATE OR REPLACE FUNCTION public.assert_launch_stage(p_target text,p_predecessor text,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tf boolean:=EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_target); te boolean:=EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target); pf boolean:=EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor); pe boolean:=EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor); BEGIN
 IF p_kind='fec_v2_finance' THEN
  PERFORM public.assert_fec_v2_publication_route(p_target); IF EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor) THEN RAISE EXCEPTION 'invalid exact V2 R1 to R2 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='fec_v2_election' THEN
  PERFORM public.assert_fec_v2_publication_route(p_target); PERFORM public.assert_fec_v2_publication_route(p_predecessor); IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain='finance' WHERE t.release_id=p_target AND t.domain='finance' AND (t.row_count,t.sha256)=(p.row_count,p.sha256)) THEN RAISE EXCEPTION 'invalid exact V2 R2 to R3 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='fec_v2_maps' THEN
  PERFORM public.assert_fec_v2_publication_route(p_target); PERFORM public.assert_fec_v2_publication_route(p_predecessor); IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR EXISTS(SELECT 1 FROM (VALUES('finance'),('elections')) d(domain) WHERE NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain=d.domain WHERE t.release_id=p_target AND t.domain=d.domain AND (t.row_count,t.sha256)=(p.row_count,p.sha256))) THEN RAISE EXCEPTION 'invalid exact V2 R3 to R4 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='finance' THEN
  IF (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT tf OR NOT public.launch_has_finance_facts(p_target) OR te OR public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR pf OR pe OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'invalid exact R1 to R2 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='election' THEN
  IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR NOT tf OR NOT te OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_predecessor)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR NOT pf OR NOT public.launch_has_finance_facts(p_predecessor) OR pe OR public.launch_has_election_facts(p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain='finance' WHERE t.release_id=p_target AND t.domain='finance' AND (t.row_count,t.sha256)=(p.row_count,p.sha256)) THEN RAISE EXCEPTION 'invalid exact R2 to R3 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='maps' THEN
  IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT tf OR NOT te OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR NOT pf OR NOT pe OR NOT public.launch_has_finance_facts(p_predecessor) OR NOT public.launch_has_election_facts(p_predecessor) OR EXISTS(SELECT 1 FROM (VALUES('finance'),('elections')) d(domain) WHERE NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain=d.domain WHERE t.release_id=p_target AND t.domain=d.domain AND (t.row_count,t.sha256)=(p.row_count,p.sha256))) THEN RAISE EXCEPTION 'invalid exact R3 to R4 launch stage' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'invalid launch stage kind' USING ERRCODE='22023'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.issue_launch_verifier_attestation(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_kind text,p_canonical_sha256 text,p_ttl_seconds integer DEFAULT 300) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE issued timestamptz:=clock_timestamp(); actual_sha text; finance_sha text; election_sha text; map_sha text; operational_sha text; f record; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_launch_verifier','member') OR pg_has_role(session_user,'dsa_seats_release_operator','member') OR pg_has_role(session_user,'dsa_seats_ingest','member') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) THEN RAISE EXCEPTION 'only exclusive launch verifier may attest publication evidence' USING ERRCODE='42501'; END IF;
 IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_operation NOT IN('promote','roll_forward') OR p_kind NOT IN('finance','election','maps','fec_v2_finance','fec_v2_election','fec_v2_maps') OR p_canonical_sha256 !~ '^[a-f0-9]{64}$' OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid launch verifier attestation' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor); IF to_char((SELECT source_cutoff FROM public.data_releases WHERE id=p_target) AT TIME ZONE 'UTC','YYYY-MM-DD')<>'2026-07-18' OR p_predecessor IS NULL THEN RAISE EXCEPTION 'launch attestation requires the fixed production lineage' USING ERRCODE='23514'; END IF;
 PERFORM public.assert_launch_stage(p_target,p_predecessor,p_kind);
 IF p_kind LIKE 'fec_v2_%' THEN
  PERFORM public.assert_fec_v2_publication_route(p_target); SELECT canonical_sha256 INTO finance_sha FROM public.fec_v2_publication_proofs WHERE release_id=p_target;
  IF p_kind='fec_v2_election' THEN SELECT canonical_sha256 INTO election_sha FROM public.election_publication_proofs WHERE release_id=p_target; ELSIF p_kind='fec_v2_maps' THEN SELECT map_receipts_fingerprint INTO map_sha FROM public.release_preflight_fingerprint(p_target,NULL); END IF;
  actual_sha:=encode(digest(convert_to('{"schemaVersion":1,"releaseId":'||to_json(p_target)::text||',"stage":'||to_json(replace(p_kind,'fec_v2_',''))::text||',"financeCanonicalSha256":'||to_json(finance_sha)::text||',"electionCanonicalSha256":'||coalesce(to_json(election_sha)::text,'null')||',"mapReceiptsFingerprint":'||coalesce(to_json(map_sha)::text,'null')||'}'||E'\n','UTF8'),'sha256'),'hex');
 ELSIF p_kind='finance' THEN SELECT canonical_sha256 INTO actual_sha FROM public.finance_publication_proofs WHERE release_id=p_target; ELSIF p_kind='election' THEN SELECT canonical_sha256 INTO actual_sha FROM public.election_publication_proofs WHERE release_id=p_target; ELSE SELECT map_receipts_fingerprint INTO actual_sha FROM public.release_preflight_fingerprint(p_target,NULL); END IF;
 IF actual_sha IS DISTINCT FROM p_canonical_sha256 THEN RAISE EXCEPTION 'launch attestation canonical hash mismatch' USING ERRCODE='23514'; END IF;
 SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO operational_sha; SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,NULL);
 IF EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations WHERE consumed_at IS NULL AND expires_at>=issued AND (operation,target_release_id,current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)) THEN RAISE EXCEPTION 'a live launch verifier attestation already exists' USING ERRCODE='23505'; END IF;
 INSERT INTO public.release_launch_verifier_attestations(id,operation,target_release_id,current_release_id,predecessor_release_id,proof_kind,canonical_sha256,run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at) VALUES(p_id,p_operation,p_target,p_current,p_predecessor,p_kind,actual_sha,f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,operational_sha,session_user,issued,issued+make_interval(secs=>p_ttl_seconds),NULL);
END $$;
CREATE TRIGGER fec_v2_live_publication_signatures BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_publication_signatures FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content();
CREATE TRIGGER fec_v2_live_publication_proofs BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_publication_proofs FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content();
CREATE TRIGGER fec_v2_live_data_review_signatures BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_data_review_signatures FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content();
CREATE OR REPLACE FUNCTION public.guard_fec_v2_publication_append_only() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'FEC v2 publication evidence is append-only' USING ERRCODE='55000'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fec_v2_publication_signature_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_publication_signatures FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_publication_append_only();
CREATE TRIGGER fec_v2_publication_proof_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_publication_proofs FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_publication_append_only();
GRANT SELECT ON public.fec_v2_plans,public.fec_v2_plan_targets,public.fec_v2_snapshot_metadata,public.fec_v2_artifacts,public.fec_v2_artifact_receipts,public.fec_v2_runs,public.fec_v2_run_snapshots,public.fec_v2_run_failures,public.fec_v2_enumeration_pages,public.fec_v2_filing_ledgers,public.fec_v2_filing_ledger_entries,public.fec_v2_page_lineage,public.fec_v2_amendment_chain_links,public.fec_v2_sanitized_filings,public.fec_v2_alternate_scoping,public.fec_v2_candidate_mappings,public.fec_v2_committee_mappings,public.fec_v2_election_mappings,public.fec_v2_finance_closures,public.fec_v2_closure_input_receipts,public.fec_v2_closure_input_snapshots,public.fec_v2_seat_coverage,public.fec_v2_exact_election_aggregates,public.fec_v2_data_review_signatures,public.fec_v2_publication_signatures,public.fec_v2_publication_proofs,public.finance_proof_routes TO dsa_seats_release_preflight;
REVOKE ALL ON public.fec_v2_publication_signatures,public.fec_v2_publication_proofs FROM PUBLIC,dsa_seats_web,dsa_seats_ingest,dsa_seats_release_operator,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_data_reviewer,dsa_seats_fec_v2_publisher;
ALTER FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.import_fec_v2_publication_proof(text,text,text,text,timestamptz) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.assert_fec_v2_publication_route(text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.operational_evidence_fingerprint(text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.assert_launch_stage(text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_publication_append_only() OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz),public.assert_fec_v2_publication_route(text),public.operational_evidence_fingerprint(text,text),public.assert_launch_stage(text,text,text),public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer),public.guard_fec_v2_publication_append_only() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_fec_v2_publication_signature(text,text,text,text,text,text,text,timestamptz,text),public.import_fec_v2_publication_proof(text,text,text,text,timestamptz) TO dsa_seats_fec_v2_publisher;
GRANT EXECUTE ON FUNCTION public.assert_fec_v2_publication_route(text) TO dsa_seats_release_preflight;
GRANT EXECUTE ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer) TO dsa_seats_launch_verifier;
-- Final lifecycle separation and exact V2 stage matrix.
CREATE OR REPLACE FUNCTION public.import_fec_v2_data_signature(p_review text,p_release text,p_plan text,p_origin text,p_subject_type text,p_subject text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_launch_verifier','member') THEN RAISE EXCEPTION 'data/publication/verifier signer separation or binding failure' USING ERRCODE='42501'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); IF EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'reviewer or key is already a publication signer'; END IF; INSERT INTO public.fec_v2_data_review_signatures VALUES(p_review,p_release,p_plan,p_origin,p_subject_type,p_subject,p_reviewer,p_key,p_fp,p_signed,p_signature); END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_signature(p_id text,p_release text,p_plan text,p_hash text,p_reviewer text,p_key text,p_fp text,p_signed timestamptz,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE v_sealed_at timestamptz; latest_final timestamptz; latest_review timestamptz; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_launch_verifier','member') THEN RAISE EXCEPTION 'publication/data/verifier signer separation or binding failure' USING ERRCODE='42501'; END IF; IF p_id='' OR p_reviewer='' OR p_key='' OR p_signature='' OR p_plan !~ '^[a-f0-9]{64}$' OR p_hash !~ '^[a-f0-9]{64}$' OR p_fp !~ '^[a-f0-9]{64}$' OR p_signed IS NULL OR p_signed>clock_timestamp() THEN RAISE EXCEPTION 'invalid FEC v2 publication signature fields' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); SELECT p.sealed_at INTO v_sealed_at FROM public.finance_proof_routes r JOIN public.fec_v2_plans p ON (p.release_id,p.plan_sha256)=(r.release_id,r.plan_sha256) JOIN public.data_releases d ON d.id=p.release_id WHERE r.release_id=p_release AND r.route='fec_v2_exact_election' AND r.plan_sha256=p_plan AND d.status='candidate'; IF v_sealed_at IS NULL OR (SELECT count(*) FROM public.finance_proof_routes WHERE release_id=p_release)<>1 OR (SELECT count(*) FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL)<>1 THEN RAISE EXCEPTION 'publication signature requires exactly one sealed selected route/plan'; END IF; IF EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND (reviewer_id=p_reviewer OR public_key_fingerprint=p_fp)) THEN RAISE EXCEPTION 'publication signer/proof is already bound'; END IF; SELECT max(x) INTO latest_final FROM (SELECT finalized_at x FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan UNION ALL SELECT finalized_at FROM public.fec_v2_finance_closures WHERE release_id=p_release AND plan_sha256=p_plan) q; SELECT max(signed_at) INTO latest_review FROM public.fec_v2_data_review_signatures WHERE release_id=p_release AND plan_sha256=p_plan; IF EXISTS(SELECT 1 FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND finalized_at IS NULL) OR EXISTS(SELECT 1 FROM public.fec_v2_finance_closures WHERE release_id=p_release AND plan_sha256=p_plan AND finalized_at IS NULL) OR p_signed<=v_sealed_at OR (latest_final IS NOT NULL AND p_signed<=latest_final) OR (latest_review IS NOT NULL AND p_signed<=latest_review) THEN RAISE EXCEPTION 'publication signature must follow plan, finalizations, and reviews'; END IF; INSERT INTO public.fec_v2_publication_signatures VALUES(p_release,p_id,p_plan,p_hash,p_reviewer,p_key,p_fp,p_signed,p_signature); END $$;
CREATE OR REPLACE FUNCTION public.import_fec_v2_publication_proof(p_id text,p_release text,p_signature text,p_hash text,p_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE signed timestamptz; BEGIN IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_launch_verifier','member') THEN RAISE EXCEPTION 'only exclusive publisher may import publication proof' USING ERRCODE='42501'; END IF; IF p_id='' OR p_signature='' OR p_hash !~ '^[a-f0-9]{64}$' OR p_created IS NULL OR p_created>clock_timestamp() THEN RAISE EXCEPTION 'invalid FEC v2 publication proof fields' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); SELECT signed_at INTO signed FROM public.fec_v2_publication_signatures WHERE release_id=p_release AND id=p_signature AND canonical_sha256=p_hash; IF signed IS NULL OR p_created<=signed OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) THEN RAISE EXCEPTION 'publication proof must uniquely follow its signature'; END IF; INSERT INTO public.fec_v2_publication_proofs VALUES(p_release,p_id,p_signature,p_hash,p_created); END $$;
CREATE OR REPLACE FUNCTION public.issue_launch_verifier_attestation(p_id text,p_operation text,p_target text,p_current text,p_predecessor text,p_kind text,p_canonical_sha256 text,p_ttl_seconds integer DEFAULT 300) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE issued timestamptz:=clock_timestamp(); actual_sha text; finance_sha text; election_sha text; map_sha text; operational_sha text; f record; BEGIN
 IF NOT pg_has_role(session_user,'dsa_seats_launch_verifier','member') OR pg_has_role(session_user,'dsa_seats_release_operator','member') OR pg_has_role(session_user,'dsa_seats_ingest','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_publisher','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_data_reviewer','member') OR pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) THEN RAISE EXCEPTION 'only exclusive launch verifier may attest publication evidence' USING ERRCODE='42501'; END IF; IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR p_operation NOT IN('promote','roll_forward') OR p_kind NOT IN('finance','election','maps','fec_v2_finance','fec_v2_election','fec_v2_maps') OR p_canonical_sha256 !~ '^[a-f0-9]{64}$' OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid launch verifier attestation' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target)); PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor); IF to_char((SELECT source_cutoff FROM public.data_releases WHERE id=p_target) AT TIME ZONE 'UTC','YYYY-MM-DD')<>'2026-07-18' OR p_predecessor IS NULL THEN RAISE EXCEPTION 'launch attestation requires the fixed production lineage' USING ERRCODE='23514'; END IF; PERFORM public.assert_launch_stage(p_target,p_predecessor,p_kind); IF p_kind LIKE 'fec_v2_%' THEN PERFORM public.assert_fec_v2_publication_route(p_target); SELECT canonical_sha256 INTO finance_sha FROM public.fec_v2_publication_proofs WHERE release_id=p_target; IF p_kind='fec_v2_election' THEN SELECT canonical_sha256 INTO election_sha FROM public.election_publication_proofs WHERE release_id=p_target; ELSIF p_kind='fec_v2_maps' THEN SELECT map_receipts_fingerprint INTO map_sha FROM public.release_preflight_fingerprint(p_target,NULL); END IF; actual_sha:=encode(digest(convert_to('{"schemaVersion":1,"releaseId":'||to_json(p_target)::text||',"stage":'||to_json(replace(p_kind,'fec_v2_',''))::text||',"financeCanonicalSha256":'||to_json(finance_sha)::text||',"electionCanonicalSha256":'||coalesce(to_json(election_sha)::text,'null')||',"mapReceiptsFingerprint":'||coalesce(to_json(map_sha)::text,'null')||'}'||E'\n','UTF8'),'sha256'),'hex'); ELSIF p_kind='finance' THEN SELECT canonical_sha256 INTO actual_sha FROM public.finance_publication_proofs WHERE release_id=p_target; ELSIF p_kind='election' THEN SELECT canonical_sha256 INTO actual_sha FROM public.election_publication_proofs WHERE release_id=p_target; ELSE SELECT map_receipts_fingerprint INTO actual_sha FROM public.release_preflight_fingerprint(p_target,NULL); END IF; IF actual_sha IS DISTINCT FROM p_canonical_sha256 THEN RAISE EXCEPTION 'launch attestation canonical hash mismatch' USING ERRCODE='23514'; END IF; SELECT public.operational_evidence_fingerprint(p_target,p_predecessor) INTO operational_sha; SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,NULL); IF EXISTS(SELECT 1 FROM public.release_launch_verifier_attestations WHERE consumed_at IS NULL AND expires_at>=issued AND (operation,target_release_id,current_release_id,predecessor_release_id) IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)) THEN RAISE EXCEPTION 'a live launch verifier attestation already exists' USING ERRCODE='23505'; END IF; INSERT INTO public.release_launch_verifier_attestations(id,operation,target_release_id,current_release_id,predecessor_release_id,proof_kind,canonical_sha256,run_ids_fingerprint,map_receipts_fingerprint,manifest_fingerprint,gate_fingerprint,digest_fingerprint,operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at) VALUES(p_id,p_operation,p_target,p_current,p_predecessor,p_kind,actual_sha,f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,f.gate_fingerprint,f.digest_fingerprint,operational_sha,session_user,issued,issued+make_interval(secs=>p_ttl_seconds),NULL); END $$;
CREATE OR REPLACE FUNCTION public.assert_launch_stage(p_target text,p_predecessor text,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF p_kind='fec_v2_finance' THEN PERFORM public.assert_fec_v2_publication_route(p_target); IF EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.map_artifacts WHERE release_id=p_predecessor) OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'invalid exact V2 finance stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='fec_v2_election' THEN PERFORM public.assert_fec_v2_publication_route(p_target); PERFORM public.assert_fec_v2_publication_route(p_predecessor); IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR NOT EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR NOT public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.map_artifacts WHERE release_id=p_predecessor) OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain='finance' WHERE t.release_id=p_target AND t.domain='finance' AND (t.row_count,t.sha256)=(p.row_count,p.sha256)) THEN RAISE EXCEPTION 'invalid exact V2 election stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='fec_v2_maps' THEN PERFORM public.assert_fec_v2_publication_route(p_target); PERFORM public.assert_fec_v2_publication_route(p_predecessor); IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR public.launch_has_election_facts(p_target) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR NOT EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor) OR NOT public.launch_has_election_facts(p_predecessor) OR EXISTS(SELECT 1 FROM public.map_artifacts WHERE release_id=p_predecessor) OR EXISTS(SELECT 1 FROM (VALUES('finance'),('elections')) d(domain) WHERE NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain=d.domain WHERE t.release_id=p_target AND t.domain=d.domain AND (t.row_count,t.sha256)=(p.row_count,p.sha256))) THEN RAISE EXCEPTION 'invalid exact V2 maps stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='finance' THEN IF (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_target) OR NOT public.launch_has_finance_facts(p_target) OR EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor UNION ALL SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor) OR public.launch_has_finance_facts(p_predecessor) OR public.launch_has_election_facts(p_predecessor) THEN RAISE EXCEPTION 'invalid exact R1 to R2 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='election' THEN IF (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_target)<>1 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target) OR NOT EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_target) OR NOT EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR (SELECT count(*) FROM public.finance_publication_proofs WHERE release_id=p_predecessor)<>1 OR EXISTS(SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor) OR NOT public.launch_has_finance_facts(p_predecessor) OR EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor) OR public.launch_has_election_facts(p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain='finance' WHERE t.release_id=p_target AND t.domain='finance' AND (t.row_count,t.sha256)=(p.row_count,p.sha256)) THEN RAISE EXCEPTION 'invalid exact R2 to R3 launch stage' USING ERRCODE='23514'; END IF;
 ELSIF p_kind='maps' THEN IF (SELECT count(*) FROM public.map_artifacts WHERE release_id=p_target)<>441 OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_target UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id=p_target) OR NOT EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_target) OR NOT EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_target) OR NOT public.launch_has_finance_facts(p_target) OR NOT public.launch_has_election_facts(p_target) OR EXISTS(SELECT 1 FROM public.finance_publication_proofs WHERE release_id=p_predecessor) OR (SELECT count(*) FROM public.election_publication_proofs WHERE release_id=p_predecessor)<>1 OR NOT EXISTS(SELECT 1 FROM public.finance_launch_receipts WHERE release_id=p_predecessor) OR NOT EXISTS(SELECT 1 FROM public.election_launch_receipts WHERE release_id=p_predecessor) OR NOT public.launch_has_finance_facts(p_predecessor) OR NOT public.launch_has_election_facts(p_predecessor) OR EXISTS(SELECT 1 FROM (VALUES('finance'),('elections')) d(domain) WHERE NOT EXISTS(SELECT 1 FROM public.release_content_digests t JOIN public.release_content_digests p ON p.release_id=p_predecessor AND p.domain=d.domain WHERE t.release_id=p_target AND t.domain=d.domain AND (t.row_count,t.sha256)=(p.row_count,p.sha256))) THEN RAISE EXCEPTION 'invalid exact R3 to R4 launch stage' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'invalid launch stage kind' USING ERRCODE='22023'; END IF; END $$;
