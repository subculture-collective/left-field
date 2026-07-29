BEGIN;
SET LOCAL lock_timeout = '5s';
-- Existing relations are locked in the Task 7 global order.  Do not add the
-- new 0010 relations here: they do not exist until the generated DDL below.
LOCK TABLE public.data_releases IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.sources IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.source_snapshots IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_plans IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_plan_targets IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_runs IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_run_snapshots IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_run_failures IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_run_receipts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_run_closure_candidates IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_snapshot_metadata IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_artifacts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_artifact_receipts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_enumeration_pages IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_filing_ledgers IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_filing_ledger_entries IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_page_lineage IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_amendment_chain_links IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_sanitized_filings IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_alternate_scoping IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_candidate_mappings IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_committee_mappings IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_election_mappings IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_finance_closures IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_closure_input_receipts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_closure_input_snapshots IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_seat_coverage IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_exact_election_aggregates IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_data_review_signatures IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_publication_signatures IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.fec_v2_publication_proofs IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.finance_proof_routes IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.release_manifests IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.release_content_digests IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.nationwide_validation_gates IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE bad boolean;
BEGIN
  -- A V1-only candidate remains a valid forward upgrade.  A release which
  -- owns a V2 plan must be completely pre-acquisition, and runs are rejected
  -- globally because this migration makes their lifecycle fields NOT NULL.
  SELECT EXISTS (SELECT 1 FROM public.fec_v2_runs) INTO bad;
  IF bad OR EXISTS (
    SELECT 1 FROM public.fec_v2_plans p WHERE EXISTS (
      SELECT 1 FROM public.fec_v2_run_snapshots x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_run_failures x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_run_receipts x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_run_closure_candidates x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_snapshot_metadata x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_artifacts x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_artifact_receipts x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_enumeration_pages x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_filing_ledgers x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_filing_ledger_entries x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_page_lineage x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_amendment_chain_links x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_sanitized_filings x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_alternate_scoping x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_candidate_mappings x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_committee_mappings x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_election_mappings x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_finance_closures x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_closure_input_receipts x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_closure_input_snapshots x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_seat_coverage x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_exact_election_aggregates x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_data_review_signatures x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_publication_signatures x WHERE x.release_id=p.release_id AND x.plan_sha256=p.plan_sha256
      UNION ALL SELECT 1 FROM public.fec_v2_publication_proofs x WHERE x.release_id=p.release_id
    )
  ) OR EXISTS (SELECT 1 FROM public.release_manifests m JOIN public.fec_v2_plans p ON p.release_id=m.release_id)
    OR EXISTS (SELECT 1 FROM public.release_content_digests d JOIN public.fec_v2_plans p ON p.release_id=d.release_id)
    OR EXISTS (SELECT 1 FROM public.nationwide_validation_gates g JOIN public.fec_v2_plans p ON p.release_id=g.release_id)
    OR EXISTS (SELECT 1 FROM public.finance_proof_routes r JOIN public.fec_v2_plans p ON p.release_id=r.release_id) THEN
    RAISE EXCEPTION '0010 requires V2 plans to have no acquisition or downstream graph' USING ERRCODE='P0010';
  END IF;
END $$;

CREATE TABLE "fec_v2_acquisition_outcomes" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"outcome" text NOT NULL,
	CONSTRAINT "fec_v2_acquisition_outcomes_release_id_plan_sha256_ledger_sha256_file_number_entry_identity_sha256_pk" PRIMARY KEY("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256"),
	CONSTRAINT "f2ao_ck" CHECK ("fec_v2_acquisition_outcomes"."file_number">0 AND "fec_v2_acquisition_outcomes"."file_number"<=9007199254740991 AND "fec_v2_acquisition_outcomes"."entry_identity_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_acquisition_outcomes"."outcome" IN ('source_unavailable','paper_filing_unreviewed','unsupported_layout','malformed_filing'))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_acquisition_receipts" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"receipt_id" text NOT NULL,
	CONSTRAINT "fec_v2_acquisition_receipts_release_id_plan_sha256_receipt_id_pk" PRIMARY KEY("release_id","plan_sha256","receipt_id")
);
--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_acquisition_seals" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"origin_release_id" text NOT NULL,
	"origin_run_id" text NOT NULL,
	"source_snapshot_id" text NOT NULL,
	"acquisition_graph_sha256" text NOT NULL,
	"descriptor_sha256" text NOT NULL,
	"transcript_sha256" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fec_v2_acquisition_seals_release_id_plan_sha256_pk" PRIMARY KEY("release_id","plan_sha256"),
	CONSTRAINT "f2as_hash_ck" CHECK ("fec_v2_acquisition_seals"."acquisition_graph_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_acquisition_seals"."descriptor_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_acquisition_seals"."transcript_sha256" ~ '^[a-f0-9]{64}$' AND length("fec_v2_acquisition_seals"."origin_run_id")>0)
);
--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_seals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_replay_attestations" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"id" text NOT NULL,
	"purpose" text NOT NULL,
	"acquisition_graph_sha256" text NOT NULL,
	"descriptor_sha256" text NOT NULL,
	"transcript_sha256" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "fec_v2_replay_attestations_release_id_plan_sha256_run_id_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","id"),
	CONSTRAINT "f2ra_ck" CHECK ("fec_v2_replay_attestations"."purpose" IN ('staged_promotion','completed_reuse') AND "fec_v2_replay_attestations"."acquisition_graph_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_replay_attestations"."descriptor_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_replay_attestations"."transcript_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_replay_attestations"."expires_at">"fec_v2_replay_attestations"."issued_at" AND "fec_v2_replay_attestations"."expires_at"<="fec_v2_replay_attestations"."issued_at"+interval '10 minutes' AND ("fec_v2_replay_attestations"."consumed_at" IS NULL OR ("fec_v2_replay_attestations"."consumed_at">="fec_v2_replay_attestations"."issued_at" AND "fec_v2_replay_attestations"."consumed_at"<="fec_v2_replay_attestations"."expires_at")))
);
--> statement-breakpoint
ALTER TABLE "fec_v2_replay_attestations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_acquisition_outcomes" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"outcome" text NOT NULL,
	CONSTRAINT "stg_fec_v2_acquisition_outcomes_release_id_plan_sha256_run_id_ledger_sha256_file_number_entry_identity_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256"),
	CONSTRAINT "sf2ao_ck" CHECK ("stg_fec_v2_acquisition_outcomes"."outcome" IN ('source_unavailable','paper_filing_unreviewed','unsupported_layout','malformed_filing'))
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_acquisition_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_amendment_links" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"predecessor_file_number" bigint NOT NULL,
	CONSTRAINT "stg_fec_v2_amendment_links_release_id_plan_sha256_run_id_ledger_sha256_file_number_predecessor_file_number_pk" PRIMARY KEY("release_id","plan_sha256","run_id","ledger_sha256","file_number","predecessor_file_number"),
	CONSTRAINT "sf2al_distinct_ck" CHECK ("stg_fec_v2_amendment_links"."file_number"<>"stg_fec_v2_amendment_links"."predecessor_file_number")
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_amendment_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_artifact_receipts" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"receipt_id" text NOT NULL,
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
	"store_locator" text,
	CONSTRAINT "stg_fec_v2_artifact_receipts_release_id_plan_sha256_run_id_receipt_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","receipt_id"),
	CONSTRAINT "sf2ar_receipt_uq" UNIQUE("release_id","plan_sha256","run_id","receipt_id"),
	CONSTRAINT "sf2ar_ck" CHECK ("stg_fec_v2_artifact_receipts"."artifact_sha256" ~ '^[a-f0-9]{64}$' AND ("stg_fec_v2_artifact_receipts"."upstream_entity_sha256" IS NULL OR "stg_fec_v2_artifact_receipts"."upstream_entity_sha256" ~ '^[a-f0-9]{64}$') AND "stg_fec_v2_artifact_receipts"."byte_size">0 AND "stg_fec_v2_artifact_receipts"."byte_size"="stg_fec_v2_artifact_receipts"."canonical_byte_size" AND length("stg_fec_v2_artifact_receipts"."object_key") BETWEEN 1 AND 2048 AND length("stg_fec_v2_artifact_receipts"."version_id") BETWEEN 1 AND 512 AND length("stg_fec_v2_artifact_receipts"."etag") BETWEEN 1 AND 512 AND ("stg_fec_v2_artifact_receipts"."store_locator" IS NULL OR length("stg_fec_v2_artifact_receipts"."store_locator") BETWEEN 1 AND 2048))
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifact_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_artifacts" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stg_fec_v2_artifacts_release_id_plan_sha256_run_id_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","artifact_sha256"),
	CONSTRAINT "sf2a_identity_uq" UNIQUE("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size"),
	CONSTRAINT "sf2a_ck" CHECK ("stg_fec_v2_artifacts"."artifact_kind" IN ('enumeration_page','filing_ledger','sanitized_filing') AND "stg_fec_v2_artifacts"."artifact_sha256" ~ '^[a-f0-9]{64}$' AND "stg_fec_v2_artifacts"."canonical_byte_size">0)
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_enumeration_pages" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"pass" integer NOT NULL,
	"form_type" text NOT NULL,
	"receipt_date" date,
	"requested_file_number" bigint,
	"provenance_key" text GENERATED ALWAYS AS (CASE WHEN "receipt_date" IS NOT NULL THEN 'd:' || ("receipt_date" - DATE '2000-01-01')::text ELSE 'f:' || "requested_file_number"::text END) STORED,
	"page_number" integer NOT NULL,
	"terminal" integer NOT NULL,
	CONSTRAINT "stg_fec_v2_enumeration_pages_release_id_plan_sha256_run_id_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","artifact_sha256"),
	CONSTRAINT "sf2ep_artifact_pass_uq" UNIQUE("release_id","plan_sha256","run_id","artifact_sha256","pass"),
	CONSTRAINT "sf2ep_provenance_page_uq" UNIQUE("release_id","plan_sha256","run_id","pass","form_type","provenance_key","page_number"),
	CONSTRAINT "sf2ep_ck" CHECK ("stg_fec_v2_enumeration_pages"."artifact_kind"='enumeration_page' AND "stg_fec_v2_enumeration_pages"."pass" IN (1,2) AND "stg_fec_v2_enumeration_pages"."form_type" IN ('F3','F3X','F24','F5') AND "stg_fec_v2_enumeration_pages"."page_number">0 AND "stg_fec_v2_enumeration_pages"."terminal" IN (0,1) AND (("stg_fec_v2_enumeration_pages"."receipt_date" IS NOT NULL) <> ("stg_fec_v2_enumeration_pages"."requested_file_number" IS NOT NULL)) AND ("stg_fec_v2_enumeration_pages"."requested_file_number" IS NULL OR "stg_fec_v2_enumeration_pages"."requested_file_number" BETWEEN 1 AND 9007199254740991))
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_enumeration_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_filing_ledger_entries" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"canonical_form_type" text NOT NULL,
	"base_form_type" text NOT NULL,
	"report_type" text NOT NULL,
	"report_date" date,
	"receipt_date" date NOT NULL,
	"coverage_start" date,
	"coverage_end" date,
	"amendment_indicator" text,
	"filer_id" text,
	"committee_id" text,
	"electronic_status" text NOT NULL,
	"raw_source_availability" text NOT NULL,
	CONSTRAINT "stg_fec_v2_filing_ledger_entries_release_id_plan_sha256_run_id_ledger_sha256_file_number_pk" PRIMARY KEY("release_id","plan_sha256","run_id","ledger_sha256","file_number"),
	CONSTRAINT "sf2fle_entry_identity_uq" UNIQUE("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256"),
	CONSTRAINT "sf2fle_ck" CHECK ("stg_fec_v2_filing_ledger_entries"."file_number">0 AND "stg_fec_v2_filing_ledger_entries"."file_number"<=9007199254740991 AND "stg_fec_v2_filing_ledger_entries"."entry_identity_sha256" ~ '^[a-f0-9]{64}$' AND "stg_fec_v2_filing_ledger_entries"."canonical_form_type" IN ('F3','F3X','F24','F5') AND "stg_fec_v2_filing_ledger_entries"."base_form_type" IN ('F3','F3X','F24','F5') AND "stg_fec_v2_filing_ledger_entries"."report_type" ~ '^[A-Z0-9]{1,8}$' AND ("stg_fec_v2_filing_ledger_entries"."coverage_start" IS NULL)=("stg_fec_v2_filing_ledger_entries"."coverage_end" IS NULL) AND ("stg_fec_v2_filing_ledger_entries"."coverage_start" IS NULL OR "stg_fec_v2_filing_ledger_entries"."coverage_start"<="stg_fec_v2_filing_ledger_entries"."coverage_end") AND ("stg_fec_v2_filing_ledger_entries"."amendment_indicator" IS NULL OR "stg_fec_v2_filing_ledger_entries"."amendment_indicator" IN ('N','A','T')) AND ("stg_fec_v2_filing_ledger_entries"."filer_id" IS NULL OR "stg_fec_v2_filing_ledger_entries"."filer_id" ~ '^[A-Z0-9]{9}$') AND ("stg_fec_v2_filing_ledger_entries"."committee_id" IS NULL OR "stg_fec_v2_filing_ledger_entries"."committee_id" ~ '^[A-Z0-9]{9}$') AND "stg_fec_v2_filing_ledger_entries"."electronic_status" IN ('electronic','paper','unknown') AND "stg_fec_v2_filing_ledger_entries"."raw_source_availability" IN ('available','unavailable','paper','unknown'))
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_filing_ledgers" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"stable" integer NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "stg_fec_v2_filing_ledgers_release_id_plan_sha256_run_id_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","artifact_sha256"),
	CONSTRAINT "sf2fl_one_ledger_per_run_uq" UNIQUE("release_id","plan_sha256","run_id"),
	CONSTRAINT "sf2fl_ck" CHECK ("stg_fec_v2_filing_ledgers"."artifact_kind"='filing_ledger' AND "stg_fec_v2_filing_ledgers"."stable" IN (0,1) AND (("stg_fec_v2_filing_ledgers"."stable"=1)=("stg_fec_v2_filing_ledgers"."finalized_at" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledgers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_page_lineage" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"page_sha256" text NOT NULL,
	"pass" integer NOT NULL,
	"occurrence_index" integer NOT NULL,
	CONSTRAINT "stg_fec_v2_page_lineage_release_id_plan_sha256_run_id_ledger_sha256_file_number_page_sha256_occurrence_index_pk" PRIMARY KEY("release_id","plan_sha256","run_id","ledger_sha256","file_number","page_sha256","occurrence_index"),
	CONSTRAINT "sf2pl_ck" CHECK ("stg_fec_v2_page_lineage"."pass" IN (1,2) AND "stg_fec_v2_page_lineage"."occurrence_index" BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_page_lineage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_sanitized_filings" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"ledger_sha256" text NOT NULL,
	"file_number" bigint NOT NULL,
	"entry_identity_sha256" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"canonical_byte_size" bigint NOT NULL,
	"report_date" date,
	CONSTRAINT "stg_fec_v2_sanitized_filings_release_id_plan_sha256_run_id_artifact_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","artifact_sha256"),
	CONSTRAINT "sf2sf_exact_entry_uq" UNIQUE("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256"),
	CONSTRAINT "sf2sf_kind_ck" CHECK ("stg_fec_v2_sanitized_filings"."artifact_kind"='sanitized_filing')
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_sanitized_filings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stg_fec_v2_snapshots" (
	"release_id" text NOT NULL,
	"plan_sha256" text NOT NULL,
	"run_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"origin_release_id" text NOT NULL,
	"receipt_set_digest_sha256" text,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"checksum_sha256" text,
	"parser_version" text NOT NULL,
	"license" text NOT NULL,
	"usage_status" text NOT NULL,
	CONSTRAINT "stg_fec_v2_snapshots_release_id_plan_sha256_run_id_snapshot_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","snapshot_id"),
	CONSTRAINT "sf2s_one_snapshot_per_run_uq" UNIQUE("release_id","plan_sha256","run_id"),
	CONSTRAINT "sf2s_restricted_ck" CHECK ("stg_fec_v2_snapshots"."usage_status"='restricted' AND ("stg_fec_v2_snapshots"."checksum_sha256" IS NULL OR "stg_fec_v2_snapshots"."checksum_sha256" ~ '^[a-f0-9]{64}$') AND ("stg_fec_v2_snapshots"."receipt_set_digest_sha256" IS NULL OR "stg_fec_v2_snapshots"."receipt_set_digest_sha256" ~ '^[a-f0-9]{64}$') AND length("stg_fec_v2_snapshots"."source_url") BETWEEN 1 AND 2048 AND length("stg_fec_v2_snapshots"."parser_version") BETWEEN 1 AND 256 AND length("stg_fec_v2_snapshots"."license") BETWEEN 1 AND 512)
);
--> statement-breakpoint
ALTER TABLE "stg_fec_v2_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" DROP CONSTRAINT "fec_v2_filing_ledger_entries_form_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_enumeration_pages" DROP CONSTRAINT "fec_v2_enumeration_pages_provenance_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" DROP CONSTRAINT "f2rf_sha_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_runs" DROP CONSTRAINT "f2runs_lifecycle_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" DROP CONSTRAINT "f2sm_sha_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" DROP CONSTRAINT "f2sf_entry_fk";
--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" DROP CONSTRAINT "f2sm_plan_fk";
--> statement-breakpoint
DROP INDEX "f2fle_identity_uq";--> statement-breakpoint
-- Keep the legacy exact-filing key because f2as_exact_filing_fk still
-- references it; the stricter ledger-identity key is added below.
ALTER INDEX "f2sf_exact_entry_uq" RENAME TO "f2sf_alternate_scope_uq";--> statement-breakpoint
DROP INDEX "f2sf_entry_fk_idx";--> statement-breakpoint
DROP INDEX "f2sm_plan_fk_idx";--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ALTER COLUMN "receipt_set_digest_sha256" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD COLUMN "scope_sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD COLUMN "owner_token_sha256" text;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD COLUMN "heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD COLUMN "run_deadline_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD COLUMN "accepted_descriptor_sha256" text;--> statement-breakpoint
-- These referenced keys must exist before the generated foreign-key batch.
-- Drizzle emits unique constraints after that batch; this same-migration move
-- keeps a fresh PostgreSQL application valid.
ALTER TABLE "fec_v2_filing_ledger_entries" ADD CONSTRAINT "f2fle_entry_identity_uq" UNIQUE("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
ALTER TABLE "fec_v2_plans" ADD CONSTRAINT "f2p_plan_origin_uq" UNIQUE("release_id","plan_sha256","origin_release_id");--> statement-breakpoint
ALTER TABLE "fec_v2_run_snapshots" ADD CONSTRAINT "f2rs_one_snapshot_uq" UNIQUE("release_id","plan_sha256","run_id");--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ADD CONSTRAINT "f2sf_exact_entry_uq" UNIQUE("release_id","plan_sha256","ledger_sha256","file_number","ledger_identity_sha256");--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "f2sm_plan_snapshot_origin_uq" UNIQUE("release_id","plan_sha256","snapshot_id","origin_release_id");--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_outcomes" ADD CONSTRAINT "fec_v2_acquisition_outcomes_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_outcomes" ADD CONSTRAINT "f2ao_entry_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_receipts" ADD CONSTRAINT "fec_v2_acquisition_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_receipts" ADD CONSTRAINT "f2acr_receipt_fk" FOREIGN KEY ("release_id","plan_sha256","receipt_id") REFERENCES "public"."fec_v2_artifact_receipts"("release_id","plan_sha256","receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_seals" ADD CONSTRAINT "fec_v2_acquisition_seals_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_seals" ADD CONSTRAINT "f2as_plan_fk" FOREIGN KEY ("release_id","plan_sha256","origin_release_id") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256","origin_release_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_acquisition_seals" ADD CONSTRAINT "f2as_snapshot_fk" FOREIGN KEY ("release_id","plan_sha256","source_snapshot_id","origin_release_id") REFERENCES "public"."fec_v2_snapshot_metadata"("release_id","plan_sha256","snapshot_id","origin_release_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_replay_attestations" ADD CONSTRAINT "fec_v2_replay_attestations_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_acquisition_outcomes" ADD CONSTRAINT "stg_fec_v2_acquisition_outcomes_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_acquisition_outcomes" ADD CONSTRAINT "sf2ao_entry_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") REFERENCES "public"."stg_fec_v2_filing_ledger_entries"("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_amendment_links" ADD CONSTRAINT "stg_fec_v2_amendment_links_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_amendment_links" ADD CONSTRAINT "sf2al_entry_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") REFERENCES "public"."stg_fec_v2_filing_ledger_entries"("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_amendment_links" ADD CONSTRAINT "sf2al_predecessor_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256","predecessor_file_number") REFERENCES "public"."stg_fec_v2_filing_ledger_entries"("release_id","plan_sha256","run_id","ledger_sha256","file_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifact_receipts" ADD CONSTRAINT "stg_fec_v2_artifact_receipts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifact_receipts" ADD CONSTRAINT "sf2ar_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") REFERENCES "public"."stg_fec_v2_artifacts"("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifact_receipts" ADD CONSTRAINT "sf2ar_snapshot_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","snapshot_id") REFERENCES "public"."stg_fec_v2_snapshots"("release_id","plan_sha256","run_id","snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifacts" ADD CONSTRAINT "stg_fec_v2_artifacts_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_artifacts" ADD CONSTRAINT "sf2a_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_enumeration_pages" ADD CONSTRAINT "stg_fec_v2_enumeration_pages_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_enumeration_pages" ADD CONSTRAINT "sf2ep_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") REFERENCES "public"."stg_fec_v2_artifacts"("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledger_entries" ADD CONSTRAINT "stg_fec_v2_filing_ledger_entries_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledger_entries" ADD CONSTRAINT "sf2fle_ledger_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256") REFERENCES "public"."stg_fec_v2_filing_ledgers"("release_id","plan_sha256","run_id","artifact_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledgers" ADD CONSTRAINT "stg_fec_v2_filing_ledgers_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_filing_ledgers" ADD CONSTRAINT "sf2fl_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") REFERENCES "public"."stg_fec_v2_artifacts"("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_page_lineage" ADD CONSTRAINT "stg_fec_v2_page_lineage_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_page_lineage" ADD CONSTRAINT "sf2pl_entry_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") REFERENCES "public"."stg_fec_v2_filing_ledger_entries"("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_page_lineage" ADD CONSTRAINT "sf2pl_page_pass_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","page_sha256","pass") REFERENCES "public"."stg_fec_v2_enumeration_pages"("release_id","plan_sha256","run_id","artifact_sha256","pass") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_sanitized_filings" ADD CONSTRAINT "stg_fec_v2_sanitized_filings_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_sanitized_filings" ADD CONSTRAINT "sf2sf_entry_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") REFERENCES "public"."stg_fec_v2_filing_ledger_entries"("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_sanitized_filings" ADD CONSTRAINT "sf2sf_artifact_fk" FOREIGN KEY ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") REFERENCES "public"."stg_fec_v2_artifacts"("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_snapshots" ADD CONSTRAINT "stg_fec_v2_snapshots_release_id_data_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."data_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_snapshots" ADD CONSTRAINT "sf2s_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_snapshots" ADD CONSTRAINT "sf2s_plan_origin_fk" FOREIGN KEY ("release_id","plan_sha256","origin_release_id") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256","origin_release_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_fec_v2_snapshots" ADD CONSTRAINT "sf2s_source_fk" FOREIGN KEY ("release_id","source_id") REFERENCES "public"."sources"("release_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "f2ao_entry_fk_idx" ON "fec_v2_acquisition_outcomes" USING btree ("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
CREATE INDEX "f2acr_receipt_fk_idx" ON "fec_v2_acquisition_receipts" USING btree ("release_id","plan_sha256","receipt_id");--> statement-breakpoint
CREATE INDEX "f2as_snapshot_fk_idx" ON "fec_v2_acquisition_seals" USING btree ("release_id","plan_sha256","source_snapshot_id","origin_release_id");--> statement-breakpoint
CREATE INDEX "sf2ao_entry_fk_idx" ON "stg_fec_v2_acquisition_outcomes" USING btree ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
CREATE INDEX "sf2al_entry_fk_idx" ON "stg_fec_v2_amendment_links" USING btree ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
CREATE INDEX "sf2al_predecessor_fk_idx" ON "stg_fec_v2_amendment_links" USING btree ("release_id","plan_sha256","run_id","ledger_sha256","predecessor_file_number");--> statement-breakpoint
CREATE INDEX "sf2ar_artifact_fk_idx" ON "stg_fec_v2_artifact_receipts" USING btree ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE INDEX "sf2ar_snapshot_fk_idx" ON "stg_fec_v2_artifact_receipts" USING btree ("release_id","plan_sha256","run_id","snapshot_id");--> statement-breakpoint
CREATE INDEX "sf2a_run_fk_idx" ON "stg_fec_v2_artifacts" USING btree ("release_id","plan_sha256","run_id");--> statement-breakpoint
CREATE INDEX "sf2ep_artifact_fk_idx" ON "stg_fec_v2_enumeration_pages" USING btree ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE INDEX "sf2fle_ledger_fk_idx" ON "stg_fec_v2_filing_ledger_entries" USING btree ("release_id","plan_sha256","run_id","ledger_sha256");--> statement-breakpoint
CREATE INDEX "sf2fl_artifact_fk_idx" ON "stg_fec_v2_filing_ledgers" USING btree ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE INDEX "sf2pl_entry_fk_idx" ON "stg_fec_v2_page_lineage" USING btree ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
CREATE INDEX "sf2pl_page_pass_fk_idx" ON "stg_fec_v2_page_lineage" USING btree ("release_id","plan_sha256","run_id","page_sha256","pass");--> statement-breakpoint
CREATE INDEX "sf2sf_entry_fk_idx" ON "stg_fec_v2_sanitized_filings" USING btree ("release_id","plan_sha256","run_id","ledger_sha256","file_number","entry_identity_sha256");--> statement-breakpoint
CREATE INDEX "sf2sf_artifact_fk_idx" ON "stg_fec_v2_sanitized_filings" USING btree ("release_id","plan_sha256","run_id","artifact_sha256","artifact_kind","canonical_byte_size");--> statement-breakpoint
CREATE INDEX "sf2s_run_fk_idx" ON "stg_fec_v2_snapshots" USING btree ("release_id","plan_sha256","run_id");--> statement-breakpoint
CREATE INDEX "sf2s_plan_origin_fk_idx" ON "stg_fec_v2_snapshots" USING btree ("release_id","plan_sha256","origin_release_id");--> statement-breakpoint
CREATE INDEX "sf2s_source_fk_idx" ON "stg_fec_v2_snapshots" USING btree ("release_id","source_id");--> statement-breakpoint
ALTER TABLE "fec_v2_sanitized_filings" ADD CONSTRAINT "f2sf_entry_fk" FOREIGN KEY ("release_id","plan_sha256","ledger_sha256","file_number","ledger_identity_sha256") REFERENCES "public"."fec_v2_filing_ledger_entries"("release_id","plan_sha256","ledger_sha256","file_number","entry_identity_sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "f2sm_plan_fk" FOREIGN KEY ("release_id","plan_sha256","origin_release_id") REFERENCES "public"."fec_v2_plans"("release_id","plan_sha256","origin_release_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "f2runs_one_active_uq" ON "fec_v2_runs" USING btree ("release_id","plan_sha256") WHERE "fec_v2_runs"."status" IN ('running','completed');--> statement-breakpoint
CREATE INDEX "f2sf_entry_fk_idx" ON "fec_v2_sanitized_filings" USING btree ("release_id","plan_sha256","ledger_sha256","file_number","ledger_identity_sha256");--> statement-breakpoint
CREATE INDEX "f2sm_plan_fk_idx" ON "fec_v2_snapshot_metadata" USING btree ("release_id","plan_sha256","origin_release_id");--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD CONSTRAINT "fec_v2_filing_ledger_entries_form_ck" CHECK ("fec_v2_filing_ledger_entries"."canonical_form_type" IN ('F3','F3X','F24','F5') AND "fec_v2_filing_ledger_entries"."base_form_type" IN ('F3','F3X','F24','F5') AND "fec_v2_filing_ledger_entries"."report_type" ~ '^[A-Z0-9]{1,8}$' AND "fec_v2_filing_ledger_entries"."file_number">0 AND "fec_v2_filing_ledger_entries"."file_number"<=9007199254740991 AND "fec_v2_filing_ledger_entries"."entry_identity_sha256" ~ '^[a-f0-9]{64}$' AND ("fec_v2_filing_ledger_entries"."coverage_start" IS NULL)=("fec_v2_filing_ledger_entries"."coverage_end" IS NULL) AND ("fec_v2_filing_ledger_entries"."coverage_start" IS NULL OR "fec_v2_filing_ledger_entries"."coverage_start"<="fec_v2_filing_ledger_entries"."coverage_end") AND ("fec_v2_filing_ledger_entries"."amendment_indicator" IS NULL OR "fec_v2_filing_ledger_entries"."amendment_indicator" IN ('N','A','T')) AND ("fec_v2_filing_ledger_entries"."filer_id" IS NULL OR "fec_v2_filing_ledger_entries"."filer_id" ~ '^[A-Z0-9]{9}$') AND ("fec_v2_filing_ledger_entries"."committee_id" IS NULL OR "fec_v2_filing_ledger_entries"."committee_id" ~ '^[A-Z0-9]{9}$') AND "fec_v2_filing_ledger_entries"."electronic_status" IN ('electronic','paper','unknown') AND "fec_v2_filing_ledger_entries"."raw_source_availability" IN ('available','unavailable','paper','unknown'));--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD CONSTRAINT "f2rf_code_ck" CHECK ("fec_v2_run_failures"."failure_code" IN ('aborted','lease_expired','enumeration_unstable','store_failure','connection_lost','promotion_failed','internal_failure'));--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD CONSTRAINT "f2rf_sha_ck" CHECK ("fec_v2_run_failures"."scope_sha256" ~ '^[a-f0-9]{64}$' AND "fec_v2_run_failures"."subject_sha256" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_hash_ck" CHECK (("fec_v2_runs"."owner_token_sha256" IS NULL OR "fec_v2_runs"."owner_token_sha256" ~ '^[a-f0-9]{64}$') AND ("fec_v2_runs"."accepted_descriptor_sha256" IS NULL OR "fec_v2_runs"."accepted_descriptor_sha256" ~ '^[a-f0-9]{64}$'));--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_id_ck" CHECK ("fec_v2_runs"."run_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$');--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_deadline_ck" CHECK ("fec_v2_runs"."run_deadline_at"<="fec_v2_runs"."started_at"+interval '6 hours');--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_lifecycle_ck" CHECK (("fec_v2_runs"."status"='running' AND "fec_v2_runs"."completed_at" IS NULL AND "fec_v2_runs"."owner_token_sha256" IS NOT NULL AND "fec_v2_runs"."heartbeat_at" IS NOT NULL AND "fec_v2_runs"."lease_expires_at" IS NOT NULL AND "fec_v2_runs"."accepted_descriptor_sha256" IS NULL AND "fec_v2_runs"."started_at"<="fec_v2_runs"."heartbeat_at" AND "fec_v2_runs"."heartbeat_at"<"fec_v2_runs"."lease_expires_at" AND "fec_v2_runs"."lease_expires_at"<="fec_v2_runs"."run_deadline_at") OR ("fec_v2_runs"."status"='completed' AND "fec_v2_runs"."completed_at" IS NOT NULL AND "fec_v2_runs"."accepted_descriptor_sha256" IS NOT NULL AND "fec_v2_runs"."owner_token_sha256" IS NULL AND "fec_v2_runs"."heartbeat_at" IS NULL AND "fec_v2_runs"."lease_expires_at" IS NULL) OR ("fec_v2_runs"."status"='failed' AND "fec_v2_runs"."completed_at" IS NOT NULL AND "fec_v2_runs"."accepted_descriptor_sha256" IS NULL AND "fec_v2_runs"."owner_token_sha256" IS NULL AND "fec_v2_runs"."heartbeat_at" IS NULL AND "fec_v2_runs"."lease_expires_at" IS NULL) OR ("fec_v2_runs"."status"='invalidated' AND "fec_v2_runs"."completed_at" IS NOT NULL AND "fec_v2_runs"."accepted_descriptor_sha256" IS NOT NULL AND "fec_v2_runs"."owner_token_sha256" IS NULL AND "fec_v2_runs"."heartbeat_at" IS NULL AND "fec_v2_runs"."lease_expires_at" IS NULL));--> statement-breakpoint
ALTER TABLE "fec_v2_snapshot_metadata" ADD CONSTRAINT "f2sm_sha_ck" CHECK ("fec_v2_snapshot_metadata"."receipt_set_digest_sha256" IS NULL OR "fec_v2_snapshot_metadata"."receipt_set_digest_sha256" ~ '^[a-f0-9]{64}$');
--> statement-breakpoint
ALTER TABLE "fec_v2_enumeration_pages" ADD CONSTRAINT "fec_v2_enumeration_pages_provenance_ck" CHECK ("fec_v2_enumeration_pages"."pass" IN (1,2) AND "fec_v2_enumeration_pages"."form_type" IN ('F3','F3X','F24','F5') AND "fec_v2_enumeration_pages"."page_number">0 AND "fec_v2_enumeration_pages"."terminal" IN (0,1) AND (("fec_v2_enumeration_pages"."receipt_date" IS NOT NULL) <> ("fec_v2_enumeration_pages"."requested_file_number" IS NOT NULL)) AND ("fec_v2_enumeration_pages"."requested_file_number" IS NULL OR "fec_v2_enumeration_pages"."requested_file_number" BETWEEN 1 AND 9007199254740991));

-- Task 7A.1 capability boundary.  The owner role installs these routines; a
-- LOGIN must use exactly the acquisition capability as its session identity.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_fec_v2_replay_verifier') THEN CREATE ROLE dsa_seats_fec_v2_replay_verifier NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_fec_v2_invalidator') THEN CREATE ROLE dsa_seats_fec_v2_invalidator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION; END IF;
  ALTER ROLE dsa_seats_fec_v2_acquisition NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
  ALTER ROLE dsa_seats_fec_v2_replay_verifier NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
  ALTER ROLE dsa_seats_fec_v2_invalidator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
END $$;

CREATE OR REPLACE FUNCTION public.assert_fec_v2_acquisition_admission() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE forbidden text[] := ARRAY['dsa_seats_migration_owner','dsa_seats_ingest','dsa_seats_web','dsa_seats_release_operator','dsa_seats_release_preflight','dsa_seats_fec_v2_replay_verifier','dsa_seats_fec_v2_invalidator','dsa_seats_fec_v2_data_reviewer','dsa_seats_fec_v2_publisher']; r text;
BEGIN
  IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') THEN RAISE EXCEPTION 'FEC V2 acquisition capability required' USING ERRCODE='42501'; END IF;
  SELECT rolname INTO r FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication);
  IF r IS NOT NULL THEN RAISE EXCEPTION 'privileged acquisition login forbidden' USING ERRCODE='42501'; END IF;
  FOREACH r IN ARRAY forbidden LOOP IF pg_has_role(session_user,r,'member') THEN RAISE EXCEPTION 'overlapping acquisition capability forbidden' USING ERRCODE='42501'; END IF; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fec_v2_owner_token_sha256(p_token text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'owner token must be 32-byte lowercase hex' USING ERRCODE='22023'; END IF;
  RETURN encode(digest(convert_to('fec-v2-run-owner-v1','UTF8') || decode('00','hex') || decode(p_token,'hex'),'sha256'),'hex');
END $$;

CREATE OR REPLACE FUNCTION public.lock_fec_v2_run(p_release text,p_plan text,p_run text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'));
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
  PERFORM 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run FOR UPDATE;
END $$;

CREATE OR REPLACE FUNCTION public.claim_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text)
RETURNS TABLE(release_id text,plan_sha256 text,run_id text,started_at timestamptz,heartbeat_at timestamptz,lease_expires_at timestamptz,run_deadline_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp();
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission();
  IF NOT EXISTS (SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'sealed plan required' USING ERRCODE='55000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
  IF EXISTS (SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND status IN ('running','completed')) THEN RAISE EXCEPTION 'active run exists' USING ERRCODE='23505'; END IF;
  INSERT INTO public.fec_v2_runs(run_id,release_id,plan_sha256,receipt_cutoff,started_at,status,owner_token_sha256,heartbeat_at,lease_expires_at,run_deadline_at) VALUES(p_run,p_release,p_plan,DATE '2026-07-18',now_at,'running',public.fec_v2_owner_token_sha256(p_owner_token),now_at,now_at+interval '300 seconds',now_at+interval '6 hours');
  RETURN QUERY SELECT r.release_id,r.plan_sha256,r.run_id,r.started_at,r.heartbeat_at,r.lease_expires_at,r.run_deadline_at FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run;
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text)
RETURNS TABLE(heartbeat_at timestamptz,lease_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp();
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM public.lock_fec_v2_run(p_release,p_plan,p_run);
  UPDATE public.fec_v2_runs SET heartbeat_at=now_at,lease_expires_at=LEAST(now_at+interval '300 seconds',run_deadline_at)
   WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' AND lease_expires_at>now_at AND run_deadline_at>now_at AND owner_token_sha256=public.fec_v2_owner_token_sha256(p_owner_token)
   RETURNING fec_v2_runs.heartbeat_at,fec_v2_runs.lease_expires_at INTO heartbeat_at,lease_expires_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'live owner fence required' USING ERRCODE='42501'; END IF; RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.stage_fec_v2_acquisition_outcome(p_release text,p_plan text,p_run text,p_owner_token text,p_ledger text,p_file bigint,p_identity text,p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp();
BEGIN
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM public.lock_fec_v2_run(p_release,p_plan,p_run);
 IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' AND lease_expires_at>now_at AND run_deadline_at>now_at AND owner_token_sha256=public.fec_v2_owner_token_sha256(p_owner_token)) THEN RAISE EXCEPTION 'live owner fence required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.stg_fec_v2_acquisition_outcomes VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_outcome);
END $$;

CREATE OR REPLACE FUNCTION public.abort_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp(); scope text;
BEGIN
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM public.lock_fec_v2_run(p_release,p_plan,p_run);
 IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' AND lease_expires_at>now_at AND owner_token_sha256=public.fec_v2_owner_token_sha256(p_owner_token)) THEN RAISE EXCEPTION 'live owner fence required' USING ERRCODE='42501'; END IF;
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
 DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
 scope:=encode(digest(convert_to('fec-v2-run-abort-v1','UTF8')||decode('00','hex')||convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_run,'UTF8'),'sha256'),'hex');
 INSERT INTO public.fec_v2_run_failures(release_id,plan_sha256,run_id,failure_code,scope_sha256,subject_sha256) VALUES(p_release,p_plan,p_run,'aborted',scope,scope);
 UPDATE public.fec_v2_runs SET status='failed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
END $$;

REVOKE ALL ON FUNCTION public.finalize_fec_v2_run(text,text,text,text),public.create_fec_v2_source_snapshot(text,text,text,text,timestamptz,text) FROM dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.assert_fec_v2_acquisition_admission(),public.fec_v2_owner_token_sha256(text),public.lock_fec_v2_run(text,text,text),public.claim_fec_v2_run(text,text,text,text),public.heartbeat_fec_v2_run(text,text,text,text),public.stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text),public.abort_fec_v2_run(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_fec_v2_run(text,text,text,text),public.heartbeat_fec_v2_run(text,text,text,text),public.stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text),public.abort_fec_v2_run(text,text,text,text) TO dsa_seats_fec_v2_acquisition;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['fec_v2_runs','fec_v2_run_snapshots','fec_v2_run_failures','fec_v2_run_receipts','fec_v2_run_closure_candidates','fec_v2_replay_attestations','stg_fec_v2_acquisition_outcomes','stg_fec_v2_amendment_links','stg_fec_v2_artifact_receipts','stg_fec_v2_artifacts','stg_fec_v2_enumeration_pages','stg_fec_v2_filing_ledger_entries','stg_fec_v2_filing_ledgers','stg_fec_v2_page_lineage','stg_fec_v2_sanitized_filings','stg_fec_v2_snapshots'] LOOP
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE public.%I OWNER TO dsa_seats_migration_owner',t); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,dsa_seats_fec_v2_acquisition',t); EXECUTE format('DROP POLICY IF EXISTS f2run_acquisition ON public.%I',t); EXECUTE format('DROP POLICY IF EXISTS f2run_owner ON public.%I',t); EXECUTE format('CREATE POLICY f2run_owner ON public.%I FOR ALL TO dsa_seats_migration_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
-- The remaining acquisition surface deliberately has one typed routine per
-- relation.  Callers cannot smuggle an arbitrary row through a JSON payload.
CREATE OR REPLACE FUNCTION public.assert_fec_v2_live_owner(p_release text,p_plan text,p_run text,p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp();
BEGIN
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM public.lock_fec_v2_run(p_release,p_plan,p_run);
 IF NOT EXISTS (SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' AND owner_token_sha256=public.fec_v2_owner_token_sha256(p_token) AND lease_expires_at>now_at AND run_deadline_at>now_at) THEN RAISE EXCEPTION 'live owner fence required' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_snapshot(p_release text,p_plan text,p_run text,p_token text,p_snapshot text,p_origin text,p_receipt_digest text,p_source text,p_url text,p_published timestamptz,p_retrieved timestamptz,p_checksum text,p_parser text,p_license text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_snapshots VALUES(p_release,p_plan,p_run,p_snapshot,p_origin,p_receipt_digest,p_source,p_url,p_published,p_retrieved,p_checksum,p_parser,p_license,'restricted'); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_artifact(p_release text,p_plan text,p_run text,p_token text,p_sha text,p_kind text,p_bytes bigint,p_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_artifacts VALUES(p_release,p_plan,p_run,p_sha,p_kind,p_bytes,p_created); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_receipt(p_release text,p_plan text,p_run text,p_token text,p_id text,p_sha text,p_kind text,p_canonical_bytes bigint,p_upstream text,p_key text,p_version text,p_etag text,p_bytes bigint,p_retrieved timestamptz,p_snapshot text,p_locator text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_artifact_receipts VALUES(p_release,p_plan,p_run,p_id,p_sha,p_kind,p_canonical_bytes,p_upstream,p_key,p_version,p_etag,p_bytes,p_retrieved,p_snapshot,p_locator); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_enumeration_page(p_release text,p_plan text,p_run text,p_token text,p_sha text,p_kind text,p_bytes bigint,p_pass integer,p_form text,p_date date,p_file bigint,p_page integer,p_terminal integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_enumeration_pages(release_id,plan_sha256,run_id,artifact_sha256,artifact_kind,canonical_byte_size,pass,form_type,receipt_date,requested_file_number,page_number,terminal) VALUES(p_release,p_plan,p_run,p_sha,p_kind,p_bytes,p_pass,p_form,p_date,p_file,p_page,p_terminal); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_ledger_header(p_release text,p_plan text,p_run text,p_token text,p_sha text,p_kind text,p_bytes bigint,p_stable integer,p_finalized timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_filing_ledgers VALUES(p_release,p_plan,p_run,p_sha,p_kind,p_bytes,p_stable,p_finalized); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_ledger_entry(p_release text,p_plan text,p_run text,p_token text,p_ledger text,p_file bigint,p_identity text,p_canonical_form text,p_base_form text,p_report_type text,p_report_date date,p_receipt_date date,p_coverage_start date,p_coverage_end date,p_amendment text,p_filer text,p_committee text,p_electronic text,p_raw text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_filing_ledger_entries VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_canonical_form,p_base_form,p_report_type,p_report_date,p_receipt_date,p_coverage_start,p_coverage_end,p_amendment,p_filer,p_committee,p_electronic,p_raw); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_page_lineage(p_release text,p_plan text,p_run text,p_token text,p_ledger text,p_file bigint,p_identity text,p_page text,p_pass integer,p_occurrence integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_page_lineage VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_page,p_pass,p_occurrence); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_amendment_link(p_release text,p_plan text,p_run text,p_token text,p_ledger text,p_file bigint,p_identity text,p_predecessor bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_amendment_links VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_predecessor); END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_sanitized_filing(p_release text,p_plan text,p_run text,p_token text,p_ledger text,p_file bigint,p_identity text,p_sha text,p_kind text,p_bytes bigint,p_report_date date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token); INSERT INTO public.stg_fec_v2_sanitized_filings VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_sha,p_kind,p_bytes,p_report_date); END $$;

CREATE OR REPLACE FUNCTION public.read_fec_v2_run_status(p_release text,p_plan text,p_run text) RETURNS TABLE(run_id text,status text,started_at timestamptz,heartbeat_at timestamptz,lease_expires_at timestamptz,run_deadline_at timestamptz,completed_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT run_id,status,started_at,heartbeat_at,lease_expires_at,run_deadline_at,completed_at FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_receipt_descriptors(p_release text,p_plan text,p_run text) RETURNS TABLE(receipt_id text,artifact_sha256 text,artifact_kind text,canonical_byte_size bigint,upstream_entity_sha256 text,object_key text,version_id text,etag text,byte_size bigint,retrieved_at timestamptz,snapshot_id text,store_locator text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT receipt_id,artifact_sha256,artifact_kind,canonical_byte_size,upstream_entity_sha256,object_key,version_id,etag,byte_size,retrieved_at,snapshot_id,store_locator FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY receipt_id $$;

CREATE OR REPLACE FUNCTION public.reap_expired_fec_v2_run(p_release text,p_plan text,p_expired_run text,p_new_run text,p_new_raw_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz:=clock_timestamp(); scope text; subject_hash text; old_status text; new_status text; new_hash text:=public.fec_v2_owner_token_sha256(p_new_raw_token);
BEGIN
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 SELECT status INTO old_status FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run FOR UPDATE;
 SELECT status INTO new_status FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_new_run FOR UPDATE;
 IF old_status='failed' AND new_status='running' AND EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_new_run AND owner_token_sha256=new_hash) THEN RETURN; END IF;
 IF old_status IS DISTINCT FROM 'running' OR NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run AND (lease_expires_at<now_at OR run_deadline_at<=now_at)) OR new_status IS NOT NULL THEN RAISE EXCEPTION 'exact expired old run and absent new run required' USING ERRCODE='55000'; END IF;
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
 scope:=encode(digest(convert_to('fec-v2-run-lease-expired-v1','UTF8')||decode('00','hex')||convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_expired_run,'UTF8'),'sha256'),'hex');
 subject_hash:=encode(digest(convert_to('{"schemaVersion":1,"runId":'||to_json(p_expired_run::text)::text||',"failureCode":"lease_expired","scopeSha256":'||to_json(scope::text)::text||'}'||chr(10),'UTF8'),'sha256'),'hex');
 INSERT INTO public.fec_v2_run_failures(release_id,plan_sha256,run_id,failure_code,scope_sha256,subject_sha256) VALUES(p_release,p_plan,p_expired_run,'lease_expired',scope,subject_hash); UPDATE public.fec_v2_runs SET status='failed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; INSERT INTO public.fec_v2_runs(run_id,release_id,plan_sha256,receipt_cutoff,started_at,status,owner_token_sha256,heartbeat_at,lease_expires_at,run_deadline_at) SELECT p_new_run,p_release,p_plan,receipt_cutoff,now_at,'running',new_hash,now_at,now_at+interval '300 seconds',now_at+interval '6 hours' FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
END $$;

CREATE OR REPLACE FUNCTION public.guard_fec_v2_run_boundary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF TG_OP='UPDATE' AND OLD.status='running' AND NEW.status<>OLD.status AND NOT (current_user='dsa_seats_migration_owner' AND session_user<>'dsa_seats_migration_owner') THEN RAISE EXCEPTION 'running FEC V2 state requires an acquisition routine' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_stage_terminal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=OLD.release_id AND plan_sha256=OLD.plan_sha256 AND run_id=OLD.run_id AND status<>'running') THEN RAISE EXCEPTION 'terminal staging rows are immutable' USING ERRCODE='55000'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DROP TRIGGER IF EXISTS f2run_boundary ON public.fec_v2_runs; CREATE TRIGGER f2run_boundary BEFORE UPDATE ON public.fec_v2_runs FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_run_boundary();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stg_fec_v2_acquisition_outcomes','stg_fec_v2_amendment_links','stg_fec_v2_artifact_receipts','stg_fec_v2_artifacts','stg_fec_v2_enumeration_pages','stg_fec_v2_filing_ledger_entries','stg_fec_v2_filing_ledgers','stg_fec_v2_page_lineage','stg_fec_v2_sanitized_filings','stg_fec_v2_snapshots'] LOOP EXECUTE format('DROP TRIGGER IF EXISTS f2stage_terminal ON public.%I',t); EXECUTE format('CREATE TRIGGER f2stage_terminal BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_stage_terminal()',t); END LOOP; END $$;
DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['assert_fec_v2_live_owner(text,text,text,text)','stage_fec_v2_snapshot(text,text,text,text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,text,text,text)','stage_fec_v2_artifact(text,text,text,text,text,text,bigint,timestamp with time zone)','stage_fec_v2_receipt(text,text,text,text,text,text,text,bigint,text,text,text,text,bigint,timestamp with time zone,text,text)','stage_fec_v2_enumeration_page(text,text,text,text,text,text,bigint,integer,text,date,bigint,integer,integer)','stage_fec_v2_ledger_header(text,text,text,text,text,text,bigint,integer,timestamp with time zone)','stage_fec_v2_ledger_entry(text,text,text,text,text,bigint,text,text,text,text,date,date,date,date,text,text,text,text,text)','stage_fec_v2_page_lineage(text,text,text,text,text,bigint,text,text,integer,integer)','stage_fec_v2_amendment_link(text,text,text,text,text,bigint,text,bigint)','stage_fec_v2_sanitized_filing(text,text,text,text,text,bigint,text,text,text,bigint,date)','read_fec_v2_run_status(text,text,text)','read_fec_v2_staged_receipt_descriptors(text,text,text)','reap_expired_fec_v2_run(text,text,text,text,text)','guard_fec_v2_run_boundary()','guard_fec_v2_stage_terminal()'] LOOP EXECUTE 'ALTER FUNCTION public.'||f||' OWNER TO dsa_seats_migration_owner'; EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC'; END LOOP; END $$;
GRANT EXECUTE ON FUNCTION public.claim_fec_v2_run(text,text,text,text),public.heartbeat_fec_v2_run(text,text,text,text),public.abort_fec_v2_run(text,text,text,text),public.reap_expired_fec_v2_run(text,text,text,text,text),public.stage_fec_v2_snapshot(text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text),public.stage_fec_v2_artifact(text,text,text,text,text,text,bigint,timestamptz),public.stage_fec_v2_receipt(text,text,text,text,text,text,text,bigint,text,text,text,text,bigint,timestamptz,text,text),public.stage_fec_v2_enumeration_page(text,text,text,text,text,text,bigint,integer,text,date,bigint,integer,integer),public.stage_fec_v2_ledger_header(text,text,text,text,text,text,bigint,integer,timestamptz),public.stage_fec_v2_ledger_entry(text,text,text,text,text,bigint,text,text,text,text,date,date,date,date,text,text,text,text,text),public.stage_fec_v2_page_lineage(text,text,text,text,text,bigint,text,text,integer,integer),public.stage_fec_v2_amendment_link(text,text,text,text,text,bigint,text,bigint),public.stage_fec_v2_sanitized_filing(text,text,text,text,text,bigint,text,text,text,bigint,date),public.stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text),public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) TO dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) FROM dsa_seats_fec_v2_replay_verifier,dsa_seats_fec_v2_invalidator;
-- Replace the small bootstrap abort body with the full reverse-FK cleanup.
CREATE OR REPLACE FUNCTION public.abort_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz; scope text; subject_hash text;
BEGIN
 PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_owner_token);
 now_at:=clock_timestamp();
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
 scope:=encode(digest(convert_to('fec-v2-run-abort-v1','UTF8')||decode('00','hex')||convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_run,'UTF8'),'sha256'),'hex');
 subject_hash:=encode(digest(convert_to('{"schemaVersion":1,"runId":'||to_json(p_run::text)::text||',"failureCode":"aborted","scopeSha256":'||to_json(scope::text)::text||'}'||chr(10),'UTF8'),'sha256'),'hex');
 INSERT INTO public.fec_v2_run_failures(release_id,plan_sha256,run_id,failure_code,scope_sha256,subject_sha256) VALUES(p_release,p_plan,p_run,'aborted',scope,subject_hash); UPDATE public.fec_v2_runs SET status='failed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
END $$;
ALTER FUNCTION public.abort_fec_v2_run(text,text,text,text) OWNER TO dsa_seats_migration_owner;
DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['assert_fec_v2_acquisition_admission()','fec_v2_owner_token_sha256(text)','lock_fec_v2_run(text,text,text)','claim_fec_v2_run(text,text,text,text)','heartbeat_fec_v2_run(text,text,text,text)','stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text)','abort_fec_v2_run(text,text,text,text)','assert_fec_v2_live_owner(text,text,text,text)','reap_expired_fec_v2_run(text,text,text,text,text)'] LOOP EXECUTE 'ALTER FUNCTION public.'||f||' OWNER TO dsa_seats_migration_owner'; END LOOP; END $$;
-- Task 7A.1 hardening is deliberately part of this unapplied cutover.
-- Keep these replacements after the bootstrap APIs so they are effective.
CREATE OR REPLACE FUNCTION public.assert_fec_v2_acquisition_admission() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE bad text;
BEGIN
  IF session_user <> 'dsa_seats_fec_v2_acquisition' AND NOT pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') THEN RAISE EXCEPTION 'FEC V2 acquisition capability required' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN RAISE EXCEPTION 'privileged acquisition login forbidden' USING ERRCODE='42501'; END IF;
  WITH RECURSIVE memberships(role_oid) AS (SELECT oid FROM pg_roles WHERE rolname=session_user UNION SELECT m.roleid FROM pg_auth_members m JOIN memberships x ON x.role_oid=m.member)
  SELECT r.rolname INTO bad FROM memberships x JOIN pg_roles r ON r.oid=x.role_oid WHERE left(r.rolname,length('dsa_seats_'))='dsa_seats_' AND r.rolname NOT IN ('dsa_seats_fec_v2_acquisition',session_user) LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'overlapping acquisition capability forbidden' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.fec_v2_constant_time_digest_eq(p_left bytea,p_right bytea) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE i integer; different integer := length(p_left) # length(p_right);
BEGIN FOR i IN 0..31 LOOP different := different | (get_byte(p_left || decode(repeat('00',32),'hex'),i) # get_byte(p_right || decode(repeat('00',32),'hex'),i)); END LOOP; RETURN length(p_left)=32 AND length(p_right)=32 AND different=0; END $$;
CREATE OR REPLACE FUNCTION public.fec_v2_owner_token_sha256(p_token text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN IF p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'owner token must be 32-byte lowercase hex' USING ERRCODE='22023'; END IF; RETURN encode(digest(convert_to('fec-v2-run-owner-v1','UTF8')||decode('00','hex')||decode(p_token,'hex'),'sha256'),'hex'); END $$;
CREATE OR REPLACE FUNCTION public.assert_fec_v2_live_owner(p_release text,p_plan text,p_run text,p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz; stored text;
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM public.lock_fec_v2_run(p_release,p_plan,p_run); now_at:=clock_timestamp();
  IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
  SELECT owner_token_sha256 INTO stored FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' AND lease_expires_at>now_at AND run_deadline_at>now_at;
  IF stored IS NULL OR NOT public.fec_v2_constant_time_digest_eq(decode(stored,'hex'),decode(public.fec_v2_owner_token_sha256(p_token),'hex')) THEN RAISE EXCEPTION 'live owner fence required' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_run_operational() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF current_user='dsa_seats_migration_owner' AND session_user<>'dsa_seats_migration_owner' THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_OP <> 'UPDATE' OR OLD.status <> 'running' OR NEW.status <> 'running' OR NEW.heartbeat_at IS NOT DISTINCT FROM OLD.heartbeat_at OR NEW.lease_expires_at IS NOT DISTINCT FROM OLD.lease_expires_at OR (to_jsonb(NEW) - ARRAY['heartbeat_at','lease_expires_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['heartbeat_at','lease_expires_at']) THEN RAISE EXCEPTION 'only a running heartbeat may update a FEC V2 run' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fec_v2_run_operational_fec_v2_runs ON public.fec_v2_runs;
CREATE TRIGGER fec_v2_run_operational_fec_v2_runs BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_runs FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_run_operational();
CREATE OR REPLACE FUNCTION public.claim_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text) RETURNS TABLE(release_id text,plan_sha256 text,run_id text,started_at timestamptz,heartbeat_at timestamptz,lease_expires_at timestamptz,run_deadline_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz;
BEGIN
  IF p_run !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$' THEN RAISE EXCEPTION 'invalid FEC V2 run id' USING ERRCODE='22023'; END IF;
  PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); now_at:=clock_timestamp();
  IF NOT EXISTS (SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND status IN ('running','completed')) THEN RAISE EXCEPTION 'active run exists' USING ERRCODE='23505'; END IF;
  INSERT INTO public.fec_v2_runs(run_id,release_id,plan_sha256,receipt_cutoff,started_at,status,owner_token_sha256,heartbeat_at,lease_expires_at,run_deadline_at) VALUES(p_run,p_release,p_plan,DATE '2026-07-18',now_at,'running',public.fec_v2_owner_token_sha256(p_owner_token),now_at,now_at+interval '300 seconds',now_at+interval '6 hours');
  RETURN QUERY SELECT r.release_id,r.plan_sha256,r.run_id,r.started_at,r.heartbeat_at,r.lease_expires_at,r.run_deadline_at FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run;
END $$;
CREATE OR REPLACE FUNCTION public.heartbeat_fec_v2_run(p_release text,p_plan text,p_run text,p_owner_token text) RETURNS TABLE(heartbeat_at timestamptz,lease_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz;
BEGIN PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_owner_token); now_at:=clock_timestamp(); UPDATE public.fec_v2_runs SET heartbeat_at=now_at,lease_expires_at=LEAST(now_at+interval '300 seconds',run_deadline_at) WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run RETURNING fec_v2_runs.heartbeat_at,fec_v2_runs.lease_expires_at INTO heartbeat_at,lease_expires_at; RETURN NEXT; END $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_stage_terminal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r text:=COALESCE(NEW.release_id,OLD.release_id); p text:=COALESCE(NEW.plan_sha256,OLD.plan_sha256); n text:=COALESCE(NEW.run_id,OLD.run_id);
BEGIN IF NOT EXISTS (SELECT 1 FROM public.fec_v2_runs WHERE release_id=r AND plan_sha256=p AND run_id=n AND status='running') THEN RAISE EXCEPTION 'terminal run staging is immutable' USING ERRCODE='55000'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stg_fec_v2_acquisition_outcomes','stg_fec_v2_amendment_links','stg_fec_v2_artifact_receipts','stg_fec_v2_artifacts','stg_fec_v2_enumeration_pages','stg_fec_v2_filing_ledger_entries','stg_fec_v2_filing_ledgers','stg_fec_v2_page_lineage','stg_fec_v2_sanitized_filings','stg_fec_v2_snapshots'] LOOP EXECUTE format('DROP TRIGGER IF EXISTS f2stage_terminal ON public.%I',t); EXECUTE format('CREATE TRIGGER f2stage_terminal BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_stage_terminal()',t); END LOOP; END $$;
DO $$ DECLARE t text; pol text; BEGIN FOREACH t IN ARRAY ARRAY['fec_v2_runs','fec_v2_run_snapshots','fec_v2_run_failures','fec_v2_run_receipts','fec_v2_run_closure_candidates','fec_v2_snapshot_metadata','fec_v2_artifacts','fec_v2_artifact_receipts','fec_v2_enumeration_pages','fec_v2_filing_ledgers','fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_amendment_chain_links','fec_v2_sanitized_filings','fec_v2_alternate_scoping','fec_v2_acquisition_outcomes','fec_v2_acquisition_receipts','fec_v2_acquisition_seals','fec_v2_replay_attestations','stg_fec_v2_acquisition_outcomes','stg_fec_v2_amendment_links','stg_fec_v2_artifact_receipts','stg_fec_v2_artifacts','stg_fec_v2_enumeration_pages','stg_fec_v2_filing_ledger_entries','stg_fec_v2_filing_ledgers','stg_fec_v2_page_lineage','stg_fec_v2_sanitized_filings','stg_fec_v2_snapshots'] LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO dsa_seats_migration_owner',t); EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,dsa_seats_fec_v2_acquisition,dsa_seats_ingest,dsa_seats_web,dsa_seats_release_operator,dsa_seats_release_preflight,dsa_seats_fec_v2_replay_verifier,dsa_seats_fec_v2_invalidator',t); FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname <> 'f2run_owner' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',pol,t); END LOOP; EXECUTE format('DROP POLICY IF EXISTS f2run_owner ON public.%I',t); EXECUTE format('CREATE POLICY f2run_owner ON public.%I FOR ALL TO dsa_seats_migration_owner USING (true) WITH CHECK (true)',t); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.finalize_fec_v2_run(text,text,text,text),public.create_fec_v2_source_snapshot(text,text,text,text,timestamp with time zone,text),public.lock_fec_v2_releases(text,text),public.fec_v2_owner_token_sha256(text),public.fec_v2_constant_time_digest_eq(bytea,bytea) FROM PUBLIC,dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) FROM PUBLIC,dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.assert_fec_v2_acquisition_admission() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.fec_v2_constant_time_digest_eq(bytea,bytea) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.fec_v2_owner_token_sha256(text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.assert_fec_v2_live_owner(text,text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_run_operational() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_stage_terminal() OWNER TO dsa_seats_migration_owner;
-- Reaping samples its clock only after the candidate and release locks are held.
CREATE OR REPLACE FUNCTION public.reap_expired_fec_v2_run(p_release text,p_plan text,p_expired_run text,p_new_run text,p_new_raw_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz; scope text; subject_hash text; old_status text; new_status text; stored text; new_hash text;
BEGIN
  IF p_expired_run !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$' OR p_new_run !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$' THEN RAISE EXCEPTION 'invalid FEC V2 run id' USING ERRCODE='22023'; END IF;
  new_hash:=public.fec_v2_owner_token_sha256(p_new_raw_token);
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); now_at:=clock_timestamp();
 IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
 -- Lock both possible identities in canonical order; concurrent reap attempts
 -- must not acquire old/new rows in opposite orders.
 PERFORM 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id IN (p_expired_run,p_new_run) ORDER BY run_id COLLATE "C" FOR UPDATE;
 SELECT status INTO old_status FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; SELECT status,owner_token_sha256 INTO new_status,stored FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_new_run;
 IF old_status='failed' AND new_status='running' AND stored IS NOT NULL AND public.fec_v2_constant_time_digest_eq(decode(stored,'hex'),decode(new_hash,'hex')) THEN RETURN; END IF;
 IF old_status IS DISTINCT FROM 'running' OR NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run AND (lease_expires_at<now_at OR run_deadline_at<=now_at)) OR new_status IS NOT NULL THEN RAISE EXCEPTION 'exact expired old run and absent new run required' USING ERRCODE='55000'; END IF;
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
 scope:=encode(digest(convert_to('fec-v2-run-lease-expired-v1','UTF8')||decode('00','hex')||convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_expired_run,'UTF8'),'sha256'),'hex'); subject_hash:=encode(digest(convert_to('{"schemaVersion":1,"runId":'||to_json(p_expired_run::text)::text||',"failureCode":"lease_expired","scopeSha256":'||to_json(scope::text)::text||'}'||chr(10),'UTF8'),'sha256'),'hex'); INSERT INTO public.fec_v2_run_failures(release_id,plan_sha256,run_id,failure_code,scope_sha256,subject_sha256) VALUES(p_release,p_plan,p_expired_run,'lease_expired',scope,subject_hash); UPDATE public.fec_v2_runs SET status='failed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; INSERT INTO public.fec_v2_runs(run_id,release_id,plan_sha256,receipt_cutoff,started_at,status,owner_token_sha256,heartbeat_at,lease_expires_at,run_deadline_at) SELECT p_new_run,p_release,p_plan,receipt_cutoff,now_at,'running',new_hash,now_at,now_at+interval '300 seconds',now_at+interval '6 hours' FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
END $$;
ALTER FUNCTION public.reap_expired_fec_v2_run(text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- These are the effective cutover definitions.  Keep them last: earlier
-- bootstrap definitions intentionally remain only to make this single
-- migration forward-applicable.
CREATE OR REPLACE FUNCTION public.assert_fec_v2_acquisition_admission() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE bad text;
BEGIN
  IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') THEN RAISE EXCEPTION 'FEC V2 acquisition capability required' USING ERRCODE='42501'; END IF;
  WITH RECURSIVE memberships(role_oid) AS (
    SELECT oid FROM pg_roles WHERE rolname=session_user
    UNION
    SELECT m.roleid FROM pg_auth_members m JOIN memberships x ON x.role_oid=m.member
  )
  SELECT r.rolname INTO bad FROM memberships x JOIN pg_roles r ON r.oid=x.role_oid
   WHERE (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR (r.rolname <> session_user AND r.rolname <> 'dsa_seats_fec_v2_acquisition' AND r.rolname LIKE 'dsa_seats_%'))
   LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'privileged or overlapping acquisition capability forbidden' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.stage_fec_v2_acquisition_outcome(p_release text,p_plan text,p_run text,p_owner_token text,p_ledger text,p_file bigint,p_identity text,p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_owner_token);
  INSERT INTO public.stg_fec_v2_acquisition_outcomes VALUES(p_release,p_plan,p_run,p_ledger,p_file,p_identity,p_outcome);
END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_run_status(p_release text,p_plan text,p_run text) RETURNS TABLE(run_id text,status text,started_at timestamptz,heartbeat_at timestamptz,lease_expires_at timestamptz,run_deadline_at timestamptz,completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission();
  IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT r.run_id,r.status,r.started_at,r.heartbeat_at,r.lease_expires_at,r.run_deadline_at,r.completed_at FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run;
END $$;
DROP FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text);
CREATE FUNCTION public.read_fec_v2_staged_receipt_descriptors(p_release text,p_plan text,p_run text) RETURNS TABLE(receipt_id text,artifact_sha256 text,artifact_kind text,canonical_byte_size bigint,upstream_entity_sha256 text,object_key text,version_id text,etag text,byte_size bigint,retrieved_at timestamptz,snapshot_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission();
  IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT x.receipt_id,x.artifact_sha256,x.artifact_kind,x.canonical_byte_size,x.upstream_entity_sha256,x.object_key,x.version_id,x.etag,x.byte_size,x.retrieved_at,x.snapshot_id FROM public.stg_fec_v2_artifact_receipts x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND x.run_id=p_run ORDER BY x.receipt_id;
END $$;
REVOKE ALL ON FUNCTION public.seal_fec_v2_snapshot(text,text,text),public.seal_fec_v2_plan(text,text),public.fec_v2_target_universe_bytes(text,text),public.fec_v2_plan_bytes(text,text),public.fec_v2_snapshot_receipt_bytes(text,text,text),public.lock_fec_v2_releases(text,text),public.finalize_fec_v2_run(text,text,text,text),public.create_fec_v2_source_snapshot(text,text,text,text,timestamptz,text),public.guard_fec_v2_publication_lifecycle(),public.guard_fec_v2_sealed(),public.guard_fec_v2_source_snapshot(),public.guard_fec_v2_origin(),public.guard_fec_v2_publication_append_only() FROM PUBLIC,dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) FROM PUBLIC,dsa_seats_fec_v2_replay_verifier,dsa_seats_fec_v2_invalidator;
GRANT EXECUTE ON FUNCTION public.claim_fec_v2_run(text,text,text,text),public.heartbeat_fec_v2_run(text,text,text,text),public.abort_fec_v2_run(text,text,text,text),public.reap_expired_fec_v2_run(text,text,text,text,text),public.stage_fec_v2_snapshot(text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text),public.stage_fec_v2_artifact(text,text,text,text,text,text,bigint,timestamptz),public.stage_fec_v2_receipt(text,text,text,text,text,text,text,bigint,text,text,text,text,bigint,timestamptz,text,text),public.stage_fec_v2_enumeration_page(text,text,text,text,text,text,bigint,integer,text,date,bigint,integer,integer),public.stage_fec_v2_ledger_header(text,text,text,text,text,text,bigint,integer,timestamptz),public.stage_fec_v2_ledger_entry(text,text,text,text,text,bigint,text,text,text,text,date,date,date,date,text,text,text,text,text),public.stage_fec_v2_page_lineage(text,text,text,text,text,bigint,text,text,integer,integer),public.stage_fec_v2_amendment_link(text,text,text,text,text,bigint,text,bigint),public.stage_fec_v2_sanitized_filing(text,text,text,text,text,bigint,text,text,text,bigint,date),public.stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text),public.read_fec_v2_run_status(text,text,text),public.read_fec_v2_staged_receipt_descriptors(text,text,text) TO dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.assert_fec_v2_acquisition_admission() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.stage_fec_v2_acquisition_outcome(text,text,text,text,text,bigint,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_run_status(text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text) OWNER TO dsa_seats_migration_owner;
-- Final run-row boundary: only SECURITY DEFINER lifecycle routines may make
-- these shapes reachable.  This definition intentionally replaces the
-- bootstrap operational trigger above.
CREATE OR REPLACE FUNCTION public.assert_fec_v2_invalidator_admission() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE bad text;
BEGIN
  IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_invalidator','member')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
    RAISE EXCEPTION 'FEC V2 invalidator capability required' USING ERRCODE='42501';
  END IF;
  WITH RECURSIVE memberships(role_oid) AS (
    SELECT oid FROM pg_roles WHERE rolname=session_user
    UNION
    SELECT m.roleid FROM pg_auth_members m JOIN memberships x ON x.role_oid=m.member
  )
  SELECT r.rolname INTO bad FROM memberships x JOIN pg_roles r ON r.oid=x.role_oid
   WHERE r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
      OR (r.rolname<>session_user AND r.rolname<>'dsa_seats_fec_v2_invalidator' AND r.rolname LIKE 'dsa_seats_%') LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'privileged or overlapping invalidator capability forbidden' USING ERRCODE='42501'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_run_boundary() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF current_user <> 'dsa_seats_migration_owner' THEN
    RAISE EXCEPTION 'FEC V2 run boundary definer must be migration owner' USING ERRCODE='42501';
  END IF;
  IF session_user='dsa_seats_migration_owner' THEN
    RAISE EXCEPTION 'migration DDL may not create FEC V2 runs' USING ERRCODE='P0010';
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FEC V2 run deletion forbidden' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM public.assert_fec_v2_acquisition_admission();
    IF NEW.status<>'running' OR NEW.completed_at IS NOT NULL OR NEW.accepted_descriptor_sha256 IS NOT NULL
       OR NEW.owner_token_sha256 IS NULL OR NEW.heartbeat_at IS DISTINCT FROM NEW.started_at
       OR NEW.lease_expires_at IS DISTINCT FROM NEW.started_at+interval '300 seconds'
       OR NEW.run_deadline_at IS DISTINCT FROM NEW.started_at+interval '6 hours'
       OR NEW.receipt_cutoff IS DISTINCT FROM (SELECT receipt_cutoff FROM public.fec_v2_plans WHERE release_id=NEW.release_id AND plan_sha256=NEW.plan_sha256 AND sealed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'exact acquisition claim shape required' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.release_id IS DISTINCT FROM NEW.release_id OR OLD.run_id IS DISTINCT FROM NEW.run_id
     OR OLD.plan_sha256 IS DISTINCT FROM NEW.plan_sha256 OR OLD.receipt_cutoff IS DISTINCT FROM NEW.receipt_cutoff
     OR OLD.started_at IS DISTINCT FROM NEW.started_at OR OLD.run_deadline_at IS DISTINCT FROM NEW.run_deadline_at THEN
    RAISE EXCEPTION 'FEC V2 run identity and deadline are immutable' USING ERRCODE='55000';
  END IF;
  IF OLD.status='running' AND NEW.status='running' THEN
    PERFORM public.assert_fec_v2_acquisition_admission();
    IF NEW.owner_token_sha256 IS DISTINCT FROM OLD.owner_token_sha256 OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.accepted_descriptor_sha256 IS DISTINCT FROM OLD.accepted_descriptor_sha256
       OR NEW.heartbeat_at IS NOT DISTINCT FROM OLD.heartbeat_at OR NEW.lease_expires_at IS NOT DISTINCT FROM OLD.lease_expires_at
       OR NEW.heartbeat_at < OLD.heartbeat_at OR NEW.heartbeat_at >= NEW.lease_expires_at
       OR NEW.lease_expires_at > NEW.run_deadline_at THEN
      RAISE EXCEPTION 'exact running heartbeat shape required' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='running' AND NEW.status IN ('failed','completed') THEN
    PERFORM public.assert_fec_v2_acquisition_admission();
    IF NEW.completed_at IS NULL OR NEW.completed_at < OLD.started_at OR NEW.owner_token_sha256 IS NOT NULL
       OR NEW.heartbeat_at IS NOT NULL OR NEW.lease_expires_at IS NOT NULL
       OR (NEW.status='failed' AND NEW.accepted_descriptor_sha256 IS NOT NULL)
       OR (NEW.status='completed' AND NEW.accepted_descriptor_sha256 IS NULL) THEN
      RAISE EXCEPTION 'exact terminal acquisition shape required' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='completed' AND NEW.status='invalidated' THEN
    PERFORM public.assert_fec_v2_invalidator_admission();
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.owner_token_sha256 IS NOT NULL
       OR NEW.heartbeat_at IS NOT NULL OR NEW.lease_expires_at IS NOT NULL
       OR NEW.accepted_descriptor_sha256 IS DISTINCT FROM OLD.accepted_descriptor_sha256 THEN
      RAISE EXCEPTION 'exact invalidation shape required' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'FEC V2 run transition forbidden' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS fec_v2_run_operational_fec_v2_runs ON public.fec_v2_runs;
DROP TRIGGER IF EXISTS f2run_boundary ON public.fec_v2_runs;
CREATE TRIGGER f2run_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_runs FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_run_boundary();
ALTER FUNCTION public.assert_fec_v2_invalidator_admission() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_run_boundary() OWNER TO dsa_seats_migration_owner;
CREATE OR REPLACE FUNCTION public.reap_expired_fec_v2_run(p_release text,p_plan text,p_expired_run text,p_new_run text,p_new_raw_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE now_at timestamptz; scope text; subject_hash text; old_status text; new_status text; stored text; new_hash text;
BEGIN
 IF p_expired_run !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$' OR p_new_run !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$' THEN RAISE EXCEPTION 'invalid FEC V2 run id' USING ERRCODE='22023'; END IF;
 new_hash:=public.fec_v2_owner_token_sha256(p_new_raw_token);
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); now_at:=clock_timestamp();
 IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
 scope:=encode(digest(convert_to('fec-v2-run-lease-expired-v1','UTF8')||decode('00','hex')||convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_expired_run,'UTF8'),'sha256'),'hex'); subject_hash:=encode(digest(convert_to('{"schemaVersion":1,"runId":'||to_json(p_expired_run::text)::text||',"failureCode":"lease_expired","scopeSha256":'||to_json(scope::text)::text||'}'||chr(10),'UTF8'),'sha256'),'hex');
 SELECT status INTO old_status FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run FOR UPDATE; SELECT status,owner_token_sha256 INTO new_status,stored FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_new_run FOR UPDATE;
 IF old_status='failed' AND new_status='running' AND stored IS NOT NULL AND public.fec_v2_constant_time_digest_eq(decode(stored,'hex'),decode(new_hash,'hex')) AND (SELECT count(*) FROM public.fec_v2_run_failures WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run)=1 AND EXISTS(SELECT 1 FROM public.fec_v2_run_failures WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run AND failure_code='lease_expired' AND scope_sha256=scope AND subject_sha256=subject_hash) THEN RETURN; END IF;
 IF old_status IS DISTINCT FROM 'running' OR NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run AND (lease_expires_at<now_at OR run_deadline_at<=now_at)) OR new_status IS NOT NULL THEN RAISE EXCEPTION 'exact expired old run and absent new run required' USING ERRCODE='55000'; END IF;
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; DELETE FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
 INSERT INTO public.fec_v2_run_failures(release_id,plan_sha256,run_id,failure_code,scope_sha256,subject_sha256) VALUES(p_release,p_plan,p_expired_run,'lease_expired',scope,subject_hash); UPDATE public.fec_v2_runs SET status='failed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run; INSERT INTO public.fec_v2_runs(run_id,release_id,plan_sha256,receipt_cutoff,started_at,status,owner_token_sha256,heartbeat_at,lease_expires_at,run_deadline_at) SELECT p_new_run,p_release,p_plan,receipt_cutoff,now_at,'running',new_hash,now_at,now_at+interval '300 seconds',now_at+interval '6 hours' FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_expired_run;
END $$;
ALTER FUNCTION public.reap_expired_fec_v2_run(text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- Task 7A.2: canonical, read-only commitments.  These deliberately consume
-- rows one at a time: a commitment must not depend on an unbounded aggregate.
CREATE OR REPLACE FUNCTION public.fec_v2_canonical_hash_step(p_state bytea,p_unit text) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF octet_length(p_unit)>65536 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  RETURN digest(p_state || digest(convert_to(p_unit,'UTF8'),'sha256'),'sha256');
END $$;
CREATE OR REPLACE FUNCTION public.fec_v2_iso_date(p_value date) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT isfinite(p_value) OR extract(year FROM p_value)<1 OR extract(year FROM p_value)>9999 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  RETURN to_char(p_value,'YYYY-MM-DD');
END $$;
CREATE OR REPLACE FUNCTION public.fec_v2_iso_instant(p_value timestamptz) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE utc timestamp:=p_value AT TIME ZONE 'UTC';
BEGIN
  IF NOT isfinite(p_value) OR extract(year FROM utc)<1 OR extract(year FROM utc)>9999 OR date_trunc('milliseconds',p_value)<>p_value THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  RETURN to_char(utc,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END $$;

CREATE OR REPLACE FUNCTION public.assert_fec_v2_replay_verifier_admission() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE bad text;
BEGIN
  IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_replay_verifier','member') THEN
    RAISE EXCEPTION 'FEC V2 replay verifier capability required' USING ERRCODE='42501';
  END IF;
  WITH RECURSIVE memberships(role_oid) AS (SELECT oid FROM pg_roles WHERE rolname=session_user UNION SELECT m.roleid FROM pg_auth_members m JOIN memberships x ON x.role_oid=m.member)
  SELECT r.rolname INTO bad FROM memberships x JOIN pg_roles r ON r.oid=x.role_oid WHERE r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR (r.rolname<>session_user AND r.rolname<>'dsa_seats_fec_v2_replay_verifier' AND r.rolname LIKE 'dsa_seats_%') LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'privileged or overlapping replay verifier capability forbidden' USING ERRCODE='42501'; END IF;
END $$;
DROP FUNCTION IF EXISTS public.read_fec_v2_staged_acquisition_commitment(text,text,text);
CREATE OR REPLACE FUNCTION public.fec_v2_staged_acquisition_commitment_owner(p_release text,p_plan text,p_run text)
RETURNS TABLE(acquisition_graph_sha256 text,descriptor_sha256 text,descriptor text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s bytea; x record; snap record; ledger record; unit text; receipt_set text; first_row boolean; budget bigint; n bigint;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release_promotion'));
  PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:'||p_release));
  SELECT * INTO snap FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run FOR SHARE;
  SELECT * INTO ledger FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run FOR SHARE;
  SELECT count(*),coalesce(sum(octet_length(receipt_id)+4),0) INTO n,budget FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  budget:=budget+1024+(SELECT count(*)*180 FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run);
  IF n>2020001 OR budget>268435456
     OR (SELECT count(*) FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>2020001
     OR (SELECT count(*) FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>20000
     OR (SELECT count(*) FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>2000000
     OR (SELECT count(*) FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>4000000
     OR (SELECT count(*) FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>2000000
     OR (SELECT count(*) FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>2000000
     OR (SELECT count(*) FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)>2000000
     OR (SELECT count(*) FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)<>1 OR (SELECT count(*) FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)<>1 OR snap.source_id<>'src_fec' OR snap.source_url<>'https://api.open.fec.gov/v1/filings/' OR snap.published_at IS NOT NULL OR snap.parser_version<>'fec-receipt-cutoff-v2' OR snap.license<>'public' OR snap.usage_status<>'restricted' OR ledger.stable<>1 OR ledger.finalized_at IS NULL OR snap.snapshot_id<>'fecv2snap_'||substr(encode(digest(convert_to('{"schemaVersion":1,"originReleaseId":'||to_json(snap.origin_release_id)::text||',"planSha256":'||to_json(p_plan)::text||',"originRunId":'||to_json(p_run)::text||'}'||chr(10),'UTF8'),'sha256'),'hex'),1,32) THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  IF date_trunc('milliseconds',snap.retrieved_at)<>snap.retrieved_at OR date_trunc('milliseconds',ledger.finalized_at)<>ledger.finalized_at
     OR EXISTS(SELECT 1 FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND date_trunc('milliseconds',created_at)<>created_at)
     OR EXISTS(SELECT 1 FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND date_trunc('milliseconds',retrieved_at)<>retrieved_at) THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  receipt_set:='{"schemaVersion":2,"acquisitionPlanSha256":'||to_json(p_plan)::text||',"snapshotId":'||to_json(snap.snapshot_id)::text||',"receipts":['; first_row:=true;
  FOR x IN SELECT * FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY receipt_id COLLATE "C" LOOP
    IF NOT first_row THEN receipt_set:=receipt_set||','; END IF; first_row:=false;
    receipt_set:=receipt_set||'{"receiptId":'||to_json(x.receipt_id)::text||',"artifactKind":'||to_json(x.artifact_kind)::text||',"artifactSha256":'||to_json(x.artifact_sha256)::text||',"upstreamEntitySha256":'||coalesce(to_json(x.upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(x.object_key)::text||',"versionId":'||to_json(x.version_id)::text||',"etag":'||to_json(x.etag)::text||',"byteSize":'||to_json(x.byte_size::text)::text||',"retrievedAt":'||to_json(public.fec_v2_iso_instant(x.retrieved_at))::text||'}';
  END LOOP;
  receipt_set:=receipt_set||']}'||chr(10);
  IF n=0 OR encode(digest(convert_to(receipt_set,'UTF8'),'sha256'),'hex') IS DISTINCT FROM snap.receipt_set_digest_sha256 OR snap.checksum_sha256 IS DISTINCT FROM snap.receipt_set_digest_sha256 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  IF snap.retrieved_at IS DISTINCT FROM (SELECT max(retrieved_at) FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)
     OR EXISTS(SELECT 1 FROM public.stg_fec_v2_acquisition_outcomes o JOIN public.stg_fec_v2_filing_ledger_entries e ON (e.release_id,e.plan_sha256,e.run_id,e.ledger_sha256,e.file_number,e.entry_identity_sha256)=(o.release_id,o.plan_sha256,o.run_id,o.ledger_sha256,o.file_number,o.entry_identity_sha256) WHERE o.release_id=p_release AND o.plan_sha256=p_plan AND o.run_id=p_run AND NOT ((e.electronic_status='paper' AND o.outcome='paper_filing_unreviewed') OR (e.electronic_status<>'paper' AND e.raw_source_availability<>'available' AND o.outcome='source_unavailable') OR (e.electronic_status<>'paper' AND e.raw_source_availability='available' AND o.outcome IN ('unsupported_layout','malformed_filing')))) THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.stg_fec_v2_artifacts a WHERE a.release_id=p_release AND a.plan_sha256=p_plan AND a.run_id=p_run AND NOT EXISTS (SELECT 1 FROM public.stg_fec_v2_artifact_receipts r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run AND r.artifact_sha256=a.artifact_sha256 AND r.artifact_kind=a.artifact_kind AND r.canonical_byte_size=a.canonical_byte_size)) OR EXISTS (SELECT 1 FROM public.stg_fec_v2_artifact_receipts r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run AND (r.snapshot_id<>snap.snapshot_id OR r.version_id='null' OR r.retrieved_at IS NULL OR (r.artifact_kind='filing_ledger' AND r.upstream_entity_sha256 IS NOT NULL) OR (r.artifact_kind<>'filing_ledger' AND r.upstream_entity_sha256 IS NULL))) OR (SELECT count(*) FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND artifact_kind='filing_ledger')<>1 OR EXISTS (SELECT 1 FROM public.stg_fec_v2_artifacts a WHERE a.release_id=p_release AND a.plan_sha256=p_plan AND a.run_id=p_run AND ((a.artifact_kind='enumeration_page' AND NOT EXISTS(SELECT 1 FROM public.stg_fec_v2_enumeration_pages q WHERE q.release_id=a.release_id AND q.plan_sha256=a.plan_sha256 AND q.run_id=a.run_id AND q.artifact_sha256=a.artifact_sha256)) OR (a.artifact_kind='sanitized_filing' AND NOT EXISTS(SELECT 1 FROM public.stg_fec_v2_sanitized_filings f WHERE f.release_id=a.release_id AND f.plan_sha256=a.plan_sha256 AND f.run_id=a.run_id AND f.artifact_sha256=a.artifact_sha256)))) OR EXISTS (SELECT 1 FROM public.stg_fec_v2_filing_ledger_entries e WHERE e.release_id=p_release AND e.plan_sha256=p_plan AND e.run_id=p_run AND e.ledger_sha256<>ledger.artifact_sha256) OR EXISTS (SELECT 1 FROM public.stg_fec_v2_filing_ledger_entries e WHERE e.release_id=p_release AND e.plan_sha256=p_plan AND e.run_id=p_run AND ((EXISTS(SELECT 1 FROM public.stg_fec_v2_sanitized_filings f WHERE (f.release_id,f.plan_sha256,f.run_id,f.ledger_sha256,f.file_number,f.entry_identity_sha256)=(e.release_id,e.plan_sha256,e.run_id,e.ledger_sha256,e.file_number,e.entry_identity_sha256)))=(EXISTS(SELECT 1 FROM public.stg_fec_v2_acquisition_outcomes o WHERE (o.release_id,o.plan_sha256,o.run_id,o.ledger_sha256,o.file_number,o.entry_identity_sha256)=(e.release_id,e.plan_sha256,e.run_id,e.ledger_sha256,e.file_number,e.entry_identity_sha256))))) THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  s:=digest(convert_to('fec-v2-acquisition-graph-v1','UTF8')||decode('00','hex'),'sha256');
  -- All thirteen boundaries are fixed and every row is cursor-hashed in TS order.
  FOR x IN SELECT t,j FROM (SELECT 1 ord,'snapshot' t, '{"planSha256":'||to_json(snap.plan_sha256)::text||',"id":'||to_json(snap.snapshot_id)::text||',"sourceId":'||to_json(snap.source_id)::text||',"sourceUrl":'||to_json(snap.source_url)::text||',"publishedAt":null,"retrievedAt":'||to_json(public.fec_v2_iso_instant(snap.retrieved_at))::text||',"checksumSha256":'||to_json(snap.checksum_sha256)::text||',"parserVersion":'||to_json(snap.parser_version)::text||',"license":'||to_json(snap.license)::text||'}' j UNION ALL SELECT 2,'snapshotMetadata','{"snapshotId":'||to_json(snap.snapshot_id)::text||',"planSha256":'||to_json(snap.plan_sha256)::text||',"originReleaseId":'||to_json(snap.origin_release_id)::text||',"receiptSetDigestSha256":'||to_json(snap.receipt_set_digest_sha256)::text||'}') q ORDER BY ord LOOP s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":'||to_json(x.t)::text||'}'||chr(10)); s:=public.fec_v2_canonical_hash_step(s,x.j||chr(10)); END LOOP;
  FOR x IN SELECT a.artifact_sha256 k,'{"planSha256":'||to_json(a.plan_sha256)::text||',"artifactSha256":'||to_json(a.artifact_sha256)::text||',"artifactKind":'||to_json(a.artifact_kind)::text||',"canonicalByteSize":'||to_json(a.canonical_byte_size::text)::text||',"createdAt":'||to_json(public.fec_v2_iso_instant(a.created_at))::text||'}' j FROM public.stg_fec_v2_artifacts a WHERE a.release_id=p_release AND a.plan_sha256=p_plan AND a.run_id=p_run ORDER BY k COLLATE "C" LOOP IF unit IS NULL THEN s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"artifacts"}'||chr(10)); unit:='x'; END IF; s:=public.fec_v2_canonical_hash_step(s,x.j||chr(10)); END LOOP; IF unit IS NULL THEN s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"artifacts"}'||chr(10)); END IF; unit:=NULL;
  FOR x IN SELECT r.receipt_id k,'{"planSha256":'||to_json(r.plan_sha256)::text||',"receiptId":'||to_json(r.receipt_id)::text||',"artifactSha256":'||to_json(r.artifact_sha256)::text||',"artifactKind":'||to_json(r.artifact_kind)::text||',"canonicalByteSize":'||to_json(r.canonical_byte_size::text)::text||',"upstreamEntitySha256":'||coalesce(to_json(r.upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(r.object_key)::text||',"versionId":'||to_json(r.version_id)::text||',"etag":'||to_json(r.etag)::text||',"byteSize":'||to_json(r.byte_size::text)::text||',"retrievedAt":'||to_json(public.fec_v2_iso_instant(r.retrieved_at))::text||',"snapshotId":'||to_json(r.snapshot_id)::text||'}' j FROM public.stg_fec_v2_artifact_receipts r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run ORDER BY k COLLATE "C" LOOP IF unit IS NULL THEN s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"receipts"}'||chr(10)); unit:='x'; END IF; s:=public.fec_v2_canonical_hash_step(s,x.j||chr(10)); END LOOP; IF unit IS NULL THEN s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"receipts"}'||chr(10)); END IF; unit:=NULL;
  -- Cursor recurrences follow each boundary; no json/jsonb object serializer is used.
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"enumerationPages"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY artifact_sha256 COLLATE "C" LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"artifactSha256":'||to_json(x.artifact_sha256)::text||',"artifactKind":"enumeration_page","pass":'||x.pass||',"formType":'||to_json(x.form_type)::text||',"receiptDate":'||coalesce(to_json(public.fec_v2_iso_date(x.receipt_date))::text,'null')||',"requestedFileNumber":'||coalesce(x.requested_file_number::text,'null')||',"pageNumber":'||x.page_number||',"terminal":'||CASE WHEN x.terminal=1 THEN 'true' ELSE 'false' END||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"ledgerHeader"}'||chr(10));
  s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(ledger.plan_sha256)::text||',"ledgerSha256":'||to_json(ledger.artifact_sha256)::text||',"artifactKind":"filing_ledger","stable":true}'||chr(10));
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"ledgerEntries"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,entry_identity_sha256 COLLATE "C" LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"ledgerSha256":'||to_json(x.ledger_sha256)::text||',"fileNumber":'||x.file_number||',"entryIdentitySha256":'||to_json(x.entry_identity_sha256)::text||',"canonicalFormType":'||to_json(x.canonical_form_type)::text||',"baseFormType":'||to_json(x.base_form_type)::text||',"reportType":'||to_json(x.report_type)::text||',"reportDate":'||coalesce(to_json(public.fec_v2_iso_date(x.report_date))::text,'null')||',"receiptDate":'||to_json(public.fec_v2_iso_date(x.receipt_date))::text||',"coverageStart":'||coalesce(to_json(public.fec_v2_iso_date(x.coverage_start))::text,'null')||',"coverageEnd":'||coalesce(to_json(public.fec_v2_iso_date(x.coverage_end))::text,'null')||',"amendmentIndicator":'||coalesce(to_json(x.amendment_indicator)::text,'null')||',"filerId":'||coalesce(to_json(x.filer_id)::text,'null')||',"committeeId":'||coalesce(to_json(x.committee_id)::text,'null')||',"electronicStatus":'||to_json(x.electronic_status)::text||',"rawSourceAvailability":'||to_json(x.raw_source_availability)::text||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"pageLineage"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,pass,page_sha256 COLLATE "C",occurrence_index LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"ledgerSha256":'||to_json(x.ledger_sha256)::text||',"fileNumber":'||x.file_number||',"pageSha256":'||to_json(x.page_sha256)::text||',"pass":'||x.pass||',"occurrenceIndex":'||x.occurrence_index||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"amendmentLinks"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,predecessor_file_number LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"ledgerSha256":'||to_json(x.ledger_sha256)::text||',"fileNumber":'||x.file_number||',"predecessorFileNumber":'||x.predecessor_file_number||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"sanitizedFilings"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,artifact_sha256 COLLATE "C" LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"artifactSha256":'||to_json(x.artifact_sha256)::text||',"artifactKind":"sanitized_filing","fileNumber":'||x.file_number||',"ledgerSha256":'||to_json(x.ledger_sha256)::text||',"ledgerIdentitySha256":'||to_json(x.entry_identity_sha256)::text||',"reportDate":'||coalesce(to_json(public.fec_v2_iso_date(x.report_date))::text,'null')||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"alternateScoping"}'||chr(10));
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"acquisitionOutcomes"}'||chr(10));
  FOR x IN SELECT * FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,entry_identity_sha256 COLLATE "C" LOOP s:=public.fec_v2_canonical_hash_step(s,'{"planSha256":'||to_json(x.plan_sha256)::text||',"ledgerSha256":'||to_json(x.ledger_sha256)::text||',"fileNumber":'||x.file_number||',"entryIdentitySha256":'||to_json(x.entry_identity_sha256)::text||',"outcome":'||to_json(x.outcome)::text||'}'||chr(10)); END LOOP;
  s:=public.fec_v2_canonical_hash_step(s,'{"schemaVersion":1,"table":"acquisitionReceiptIds"}'||chr(10));
  FOR x IN SELECT receipt_id FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY receipt_id COLLATE "C" LOOP s:=public.fec_v2_canonical_hash_step(s,'{"receiptId":'||to_json(x.receipt_id)::text||'}'||chr(10)); END LOOP;
  descriptor:='{"schemaVersion":1,"originRunId":'||to_json(p_run)::text||',"originReleaseId":'||to_json(snap.origin_release_id)::text||',"acquisitionPlanSha256":'||to_json(p_plan)::text||',"receiptCutoff":"2026-07-18","artifactReceiptIds":['; first_row:=true; FOR x IN SELECT receipt_id FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY receipt_id COLLATE "C" LOOP IF NOT first_row THEN descriptor:=descriptor||','; END IF; first_row:=false; descriptor:=descriptor||to_json(x.receipt_id)::text; END LOOP; descriptor:=descriptor||'],"sourceSnapshotId":'||to_json(snap.snapshot_id)::text||',"acquisitionOutcomes":['; first_row:=true; FOR x IN SELECT * FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number,entry_identity_sha256 COLLATE "C" LOOP IF NOT first_row THEN descriptor:=descriptor||','; END IF; first_row:=false; descriptor:=descriptor||'{"fileNumber":'||x.file_number||',"entryIdentitySha256":'||to_json(x.entry_identity_sha256)::text||',"outcome":'||to_json(x.outcome)::text||'}'; END LOOP; descriptor:=descriptor||'],"operationalFailures":[],"closureCandidates":[]}'||chr(10);
  IF octet_length(descriptor)>268435456 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  acquisition_graph_sha256:=encode(s,'hex'); descriptor_sha256:=encode(digest(convert_to(descriptor,'UTF8'),'sha256'),'hex'); RETURN NEXT;
END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_acquisition_commitment(p_release text,p_plan text,p_run text) RETURNS TABLE(acquisition_graph_sha256 text,descriptor_sha256 text,descriptor text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_replay_verifier_admission(); RETURN QUERY SELECT * FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run); END $$;
CREATE UNIQUE INDEX f2ra_one_live_purpose_run_uq ON public.fec_v2_replay_attestations(release_id,plan_sha256,run_id,purpose) WHERE consumed_at IS NULL;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_replay_attestation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN IF current_user<>'dsa_seats_migration_owner' THEN RAISE EXCEPTION 'replay attestation boundary definer must be migration owner' USING ERRCODE='42501'; END IF; IF TG_OP='INSERT' THEN PERFORM public.assert_fec_v2_replay_verifier_admission(); RETURN NEW; END IF; IF TG_OP='DELETE' AND pg_has_role(session_user,'dsa_seats_fec_v2_invalidator','member') THEN PERFORM public.assert_fec_v2_invalidator_admission(); PERFORM 1 FROM public.fec_v2_acquisition_seals s WHERE s.release_id=OLD.release_id AND s.plan_sha256=OLD.plan_sha256 FOR KEY SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'locked matching acquisition seal required' USING ERRCODE='42501'; END IF; RETURN OLD; END IF; PERFORM public.assert_fec_v2_acquisition_admission(); IF TG_OP='UPDATE' AND (NEW.release_id IS DISTINCT FROM OLD.release_id OR NEW.plan_sha256 IS DISTINCT FROM OLD.plan_sha256 OR NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.acquisition_graph_sha256 IS DISTINCT FROM OLD.acquisition_graph_sha256 OR NEW.descriptor_sha256 IS DISTINCT FROM OLD.descriptor_sha256 OR NEW.transcript_sha256 IS DISTINCT FROM OLD.transcript_sha256 OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL) THEN RAISE EXCEPTION 'replay attestation is append-only except one consumption' USING ERRCODE='42501'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER f2ra_boundary BEFORE INSERT OR UPDATE OR DELETE ON public.fec_v2_replay_attestations FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_replay_attestation();
CREATE OR REPLACE FUNCTION public.invalidate_fec_v2_staged_replay_attestation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN DELETE FROM public.fec_v2_replay_attestations WHERE release_id=COALESCE(NEW.release_id,OLD.release_id) AND plan_sha256=COALESCE(NEW.plan_sha256,OLD.plan_sha256) AND run_id=COALESCE(NEW.run_id,OLD.run_id) AND purpose='staged_promotion' AND consumed_at IS NULL; RETURN COALESCE(NEW,OLD); END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stg_fec_v2_acquisition_outcomes','stg_fec_v2_amendment_links','stg_fec_v2_artifact_receipts','stg_fec_v2_artifacts','stg_fec_v2_enumeration_pages','stg_fec_v2_filing_ledger_entries','stg_fec_v2_filing_ledgers','stg_fec_v2_page_lineage','stg_fec_v2_sanitized_filings','stg_fec_v2_snapshots'] LOOP EXECUTE format('CREATE TRIGGER f2stage_replay_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.invalidate_fec_v2_staged_replay_attestation()',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.issue_fec_v2_replay_attestation(p_release text,p_plan text,p_run text,p_purpose text,p_graph text,p_descriptor text,p_transcript text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE c record; now_at timestamptz:=clock_timestamp(); i text; BEGIN PERFORM public.assert_fec_v2_replay_verifier_admission(); IF p_purpose NOT IN ('staged_promotion','completed_reuse') OR p_graph !~ '^[a-f0-9]{64}$' OR p_descriptor !~ '^[a-f0-9]{64}$' OR p_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid replay attestation' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:'||p_release)); IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF; IF p_purpose='completed_reuse' THEN RAISE EXCEPTION 'completed reuse commitment is unavailable' USING ERRCODE='0A000'; END IF; IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running') THEN RAISE EXCEPTION 'staged promotion requires running run' USING ERRCODE='55000'; END IF; SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run); IF c.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR c.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF; i:=encode(digest(convert_to(p_release||chr(0)||p_plan||chr(0)||p_run||chr(0)||p_purpose||chr(0)||p_graph||chr(0)||p_descriptor||chr(0)||p_transcript||chr(0)||now_at::text,'UTF8'),'sha256'),'hex'); INSERT INTO public.fec_v2_replay_attestations VALUES(p_release,p_plan,p_run,i,p_purpose,p_graph,p_descriptor,p_transcript,now_at,now_at+interval '10 minutes',NULL); RETURN i; END $$;
CREATE OR REPLACE FUNCTION public.consume_fec_v2_staged_replay_attestation_owner(p_release text,p_plan text,p_run text,p_id text,p_graph text,p_descriptor text,p_transcript text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE a record; c record; now_at timestamptz; BEGIN PERFORM public.assert_fec_v2_acquisition_admission(); IF p_graph !~ '^[a-f0-9]{64}$' OR p_descriptor !~ '^[a-f0-9]{64}$' OR p_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid replay attestation hash' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); SELECT * INTO a FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id FOR UPDATE; now_at:=clock_timestamp(); IF NOT FOUND OR a.purpose<>'staged_promotion' OR a.consumed_at IS NOT NULL OR a.expires_at<now_at OR a.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR a.descriptor_sha256 IS DISTINCT FROM p_descriptor OR a.transcript_sha256 IS DISTINCT FROM p_transcript THEN RAISE EXCEPTION 'live exact staged replay attestation required' USING ERRCODE='42501'; END IF; SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run); IF c.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR c.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF; UPDATE public.fec_v2_replay_attestations SET consumed_at=now_at WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id AND consumed_at IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'replay attestation already consumed' USING ERRCODE='42501'; END IF; END $$;
REVOKE ALL ON FUNCTION public.fec_v2_canonical_hash_step(bytea,text),public.fec_v2_iso_date(date),public.fec_v2_iso_instant(timestamptz),public.assert_fec_v2_replay_verifier_admission(),public.fec_v2_staged_acquisition_commitment_owner(text,text,text),public.consume_fec_v2_staged_replay_attestation_owner(text,text,text,text,text,text,text),public.guard_fec_v2_replay_attestation(),public.invalidate_fec_v2_staged_replay_attestation() FROM PUBLIC,dsa_seats_fec_v2_acquisition;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_staged_acquisition_commitment(text,text,text) TO dsa_seats_fec_v2_replay_verifier;
REVOKE ALL ON FUNCTION public.issue_fec_v2_replay_attestation(text,text,text,text,text,text,text) FROM PUBLIC,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_invalidator;
GRANT EXECUTE ON FUNCTION public.issue_fec_v2_replay_attestation(text,text,text,text,text,text,text) TO dsa_seats_fec_v2_replay_verifier;
ALTER FUNCTION public.fec_v2_canonical_hash_step(bytea,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.fec_v2_iso_date(date) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.fec_v2_iso_instant(timestamptz) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.assert_fec_v2_replay_verifier_admission() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.fec_v2_staged_acquisition_commitment_owner(text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_staged_acquisition_commitment(text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.guard_fec_v2_replay_attestation() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.invalidate_fec_v2_staged_replay_attestation() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.issue_fec_v2_replay_attestation(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.consume_fec_v2_staged_replay_attestation_owner(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- Task 7A.3 is deliberately the only acquisition path that writes the final
-- graph.  The commitment routine above is the canonical exact-graph validator.
CREATE OR REPLACE FUNCTION public.promote_fec_v2_acquisition(p_release text,p_plan text,p_run text,p_raw_token text,p_expected_graph text,p_expected_descriptor text,p_expected_transcript text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a record; c record; s record; now_at timestamptz;
BEGIN
  PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_raw_token);
  IF p_expected_graph !~ '^[a-f0-9]{64}$' OR p_expected_descriptor !~ '^[a-f0-9]{64}$' OR p_expected_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid promotion hash' USING ERRCODE='22023'; END IF;
  -- assert_fec_v2_live_owner takes these in the required global order.
  SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run);
  IF c.acquisition_graph_sha256 IS DISTINCT FROM p_expected_graph OR c.descriptor_sha256 IS DISTINCT FROM p_expected_descriptor THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release AND plan_sha256=p_plan)
     OR EXISTS(SELECT 1 FROM public.fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan)
     OR EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan)
     OR EXISTS(SELECT 1 FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan)
     OR EXISTS(SELECT 1 FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan) THEN RAISE EXCEPTION 'final acquisition graph already exists' USING ERRCODE='55000'; END IF;
  -- Consumption re-locks and recomputes the canonical staged commitment, so the
  -- attestation and graph acceptance are one transaction.
  SELECT id INTO a FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND purpose='staged_promotion' AND consumed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'live exact staged replay attestation required' USING ERRCODE='42501'; END IF;
  PERFORM public.consume_fec_v2_staged_replay_attestation_owner(p_release,p_plan,p_run,a.id,p_expected_graph,p_expected_descriptor,p_expected_transcript);
  now_at:=clock_timestamp();
  INSERT INTO public.source_snapshots(id,release_id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status)
    VALUES(s.snapshot_id,p_release,s.source_id,s.source_url,s.published_at,s.retrieved_at,s.checksum_sha256,s.parser_version,s.license,'restricted');
  INSERT INTO public.fec_v2_snapshot_metadata(release_id,snapshot_id,plan_sha256,origin_release_id,receipt_set_digest_sha256,sealed_at)
    VALUES(p_release,s.snapshot_id,p_plan,s.origin_release_id,s.receipt_set_digest_sha256,NULL);
  INSERT INTO public.fec_v2_artifacts(release_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,created_at)
    SELECT release_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,created_at FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_artifact_receipts(receipt_id,release_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,upstream_entity_sha256,object_key,version_id,etag,byte_size,retrieved_at,snapshot_id)
    SELECT receipt_id,release_id,plan_sha256,artifact_sha256,artifact_kind,canonical_byte_size,upstream_entity_sha256,object_key,version_id,etag,byte_size,retrieved_at,snapshot_id FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_enumeration_pages(release_id,plan_sha256,artifact_sha256,artifact_kind,pass,form_type,receipt_date,requested_file_number,page_number,terminal)
    SELECT release_id,plan_sha256,artifact_sha256,artifact_kind,pass,form_type,receipt_date,requested_file_number,page_number,terminal FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_filing_ledgers(release_id,plan_sha256,artifact_sha256,artifact_kind,stable,finalized_at)
    SELECT release_id,plan_sha256,artifact_sha256,artifact_kind,stable,finalized_at FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_filing_ledger_entries(release_id,plan_sha256,ledger_sha256,file_number,entry_identity_sha256,canonical_form_type,base_form_type,report_type,report_date,receipt_date,coverage_start,coverage_end,amendment_indicator,filer_id,committee_id,electronic_status,raw_source_availability)
    SELECT release_id,plan_sha256,ledger_sha256,file_number,entry_identity_sha256,canonical_form_type,base_form_type,report_type,report_date,receipt_date,coverage_start,coverage_end,amendment_indicator,filer_id,committee_id,electronic_status,raw_source_availability FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_page_lineage(release_id,plan_sha256,ledger_sha256,file_number,page_sha256,pass,occurrence_index)
    SELECT release_id,plan_sha256,ledger_sha256,file_number,page_sha256,pass,occurrence_index FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_amendment_chain_links(release_id,plan_sha256,ledger_sha256,file_number,predecessor_file_number)
    SELECT release_id,plan_sha256,ledger_sha256,file_number,predecessor_file_number FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_sanitized_filings(release_id,plan_sha256,artifact_sha256,artifact_kind,file_number,ledger_sha256,ledger_identity_sha256,report_date)
    SELECT release_id,plan_sha256,artifact_sha256,artifact_kind,file_number,ledger_sha256,entry_identity_sha256,report_date FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_acquisition_outcomes(release_id,plan_sha256,ledger_sha256,file_number,entry_identity_sha256,outcome)
    SELECT release_id,plan_sha256,ledger_sha256,file_number,entry_identity_sha256,outcome FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_acquisition_receipts(release_id,plan_sha256,receipt_id)
    SELECT release_id,plan_sha256,receipt_id FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  INSERT INTO public.fec_v2_run_snapshots(release_id,plan_sha256,run_id,snapshot_id) VALUES(p_release,p_plan,p_run,s.snapshot_id);
  INSERT INTO public.fec_v2_run_receipts(release_id,plan_sha256,run_id,receipt_id)
    SELECT release_id,plan_sha256,p_run,receipt_id FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  IF (SELECT count(*) FROM public.fec_v2_run_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)<>1
     OR EXISTS((SELECT receipt_id FROM public.fec_v2_acquisition_receipts WHERE release_id=p_release AND plan_sha256=p_plan) EXCEPT (SELECT receipt_id FROM public.fec_v2_run_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run))
     OR EXISTS((SELECT receipt_id FROM public.fec_v2_run_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run) EXCEPT (SELECT receipt_id FROM public.fec_v2_acquisition_receipts WHERE release_id=p_release AND plan_sha256=p_plan)) THEN RAISE EXCEPTION 'exact run snapshot and receipt joins required' USING ERRCODE='22023'; END IF;
  INSERT INTO public.fec_v2_acquisition_seals(release_id,plan_sha256,origin_release_id,origin_run_id,source_snapshot_id,acquisition_graph_sha256,descriptor_sha256,transcript_sha256,created_at)
    VALUES(p_release,p_plan,s.origin_release_id,p_run,s.snapshot_id,p_expected_graph,p_expected_descriptor,p_expected_transcript,now_at);
  DELETE FROM public.stg_fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_raw_token);
  UPDATE public.fec_v2_runs SET status='completed',completed_at=now_at,owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL,accepted_descriptor_sha256=p_expected_descriptor WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
END $$;
REVOKE ALL ON FUNCTION public.promote_fec_v2_acquisition(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_fec_v2_acquisition(text,text,text,text,text,text,text) TO dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.promote_fec_v2_acquisition(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
CREATE OR REPLACE FUNCTION public.guard_fec_v2_acquisition_seal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE data jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; rel text:=data->>'release_id'; plan text:=data->>'plan_sha256'; frozen boolean;
BEGIN
  IF TG_TABLE_NAME='fec_v2_acquisition_seals' THEN
    IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'FEC V2 acquisition seal is immutable' USING ERRCODE='55000'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='source_snapshots' THEN
    SELECT EXISTS(SELECT 1 FROM public.fec_v2_acquisition_seals s WHERE s.release_id=rel AND s.source_snapshot_id=data->>'id') INTO frozen;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.fec_v2_acquisition_seals s WHERE s.release_id=rel AND s.plan_sha256=plan) INTO frozen;
  END IF;
  IF frozen THEN RAISE EXCEPTION 'sealed FEC V2 acquisition graph is immutable' USING ERRCODE='55000'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['source_snapshots','fec_v2_snapshot_metadata','fec_v2_artifacts','fec_v2_artifact_receipts','fec_v2_enumeration_pages','fec_v2_filing_ledgers','fec_v2_filing_ledger_entries','fec_v2_page_lineage','fec_v2_amendment_chain_links','fec_v2_sanitized_filings','fec_v2_acquisition_outcomes','fec_v2_acquisition_receipts','fec_v2_acquisition_seals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS f2_acquisition_seal_guard ON public.%I',t);
    EXECUTE format('CREATE TRIGGER f2_acquisition_seal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_acquisition_seal()',t);
  END LOOP;
END $$;
-- Task 7 acquisition seals supersede the older finalized-ledger trigger for
-- this relation; the seal-aware guard preserves immutability while admitting
-- only the fenced invalidator DELETE path.
DROP TRIGGER IF EXISTS fec_v2_sealed_fec_v2_filing_ledgers ON public.fec_v2_filing_ledgers;
REVOKE ALL ON FUNCTION public.guard_fec_v2_acquisition_seal() FROM PUBLIC;
ALTER FUNCTION public.guard_fec_v2_acquisition_seal() OWNER TO dsa_seats_migration_owner;
-- Task 7 completed reuse is deliberately reconstructed from the sealed final
-- closure, never from an operational run (a clone has no such run).
CREATE OR REPLACE FUNCTION public.fec_v2_completed_acquisition_descriptor_owner(p_release text,p_plan text)
RETURNS TABLE(descriptor text,descriptor_sha256 text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s record; x record; out_text text; first_row boolean:=true;
BEGIN
  SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact acquisition seal required' USING ERRCODE='55000'; END IF;
  out_text:='{"schemaVersion":1,"originRunId":'||to_json(s.origin_run_id)::text||',"originReleaseId":'||to_json(s.origin_release_id)::text||',"acquisitionPlanSha256":'||to_json(p_plan)::text||',"receiptCutoff":"2026-07-18","artifactReceiptIds":[';
  FOR x IN SELECT receipt_id FROM public.fec_v2_acquisition_receipts WHERE release_id=p_release AND plan_sha256=p_plan ORDER BY receipt_id COLLATE "C" LOOP IF NOT first_row THEN out_text:=out_text||','; END IF; first_row:=false; out_text:=out_text||to_json(x.receipt_id)::text; END LOOP;
  out_text:=out_text||'],"sourceSnapshotId":'||to_json(s.source_snapshot_id)::text||',"acquisitionOutcomes":['; first_row:=true;
  FOR x IN SELECT file_number,entry_identity_sha256,outcome FROM public.fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan ORDER BY file_number,entry_identity_sha256 COLLATE "C" LOOP IF NOT first_row THEN out_text:=out_text||','; END IF; first_row:=false; out_text:=out_text||'{"fileNumber":'||x.file_number||',"entryIdentitySha256":'||to_json(x.entry_identity_sha256)::text||',"outcome":'||to_json(x.outcome)::text||'}'; END LOOP;
  out_text:=out_text||'],"operationalFailures":[],"closureCandidates":[]}'||chr(10);
  descriptor:=out_text; descriptor_sha256:=encode(digest(convert_to(out_text,'UTF8'),'sha256'),'hex'); RETURN NEXT;
END $$;
CREATE OR REPLACE FUNCTION public.issue_fec_v2_replay_attestation(p_release text,p_plan text,p_run text,p_purpose text,p_graph text,p_descriptor text,p_transcript text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c record; s record; d record; now_at timestamptz:=clock_timestamp(); i text;
BEGIN
 PERFORM public.assert_fec_v2_replay_verifier_admission();
 IF p_purpose NOT IN ('staged_promotion','completed_reuse') OR p_graph !~ '^[a-f0-9]{64}$' OR p_descriptor !~ '^[a-f0-9]{64}$' OR p_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid replay attestation' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:'||p_release));
 IF NOT EXISTS(SELECT 1 FROM public.data_releases r JOIN public.fec_v2_plans p ON p.release_id=r.id WHERE r.id=p_release AND r.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
 IF p_purpose='completed_reuse' THEN
   SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE;
   SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
   IF p_run IS DISTINCT FROM s.origin_run_id
      OR NOT EXISTS(SELECT 1 FROM public.source_snapshots WHERE release_id=p_release AND id=s.source_snapshot_id AND ((usage_status='restricted' AND NOT EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)) OR (usage_status='approved' AND EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL))))
      OR s.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR s.descriptor_sha256 IS DISTINCT FROM p_descriptor OR s.transcript_sha256 IS DISTINCT FROM p_transcript OR d.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'exact completed reuse commitment required' USING ERRCODE='22023'; END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running') THEN RAISE EXCEPTION 'staged promotion requires running run' USING ERRCODE='55000'; END IF;
   SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run); IF c.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR c.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF;
 END IF;
 i:=encode(digest(convert_to(p_release||chr(0)||p_plan||chr(0)||p_run||chr(0)||p_purpose||chr(0)||p_graph||chr(0)||p_descriptor||chr(0)||p_transcript||chr(0)||now_at::text,'UTF8'),'sha256'),'hex');
 INSERT INTO public.fec_v2_replay_attestations VALUES(p_release,p_plan,p_run,i,p_purpose,p_graph,p_descriptor,p_transcript,now_at,now_at+interval '10 minutes',NULL); RETURN i;
END $$;
CREATE OR REPLACE FUNCTION public.consume_fec_v2_completed_reuse_attestation(p_release text,p_plan text,p_run text,p_id text,p_graph text,p_descriptor text,p_transcript text)
RETURNS TABLE(descriptor text,descriptor_sha256 text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a record; s record; d record; now_at timestamptz:=clock_timestamp();
BEGIN
 PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 SELECT * INTO a FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id FOR UPDATE;
 SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
 IF NOT FOUND OR a.purpose<>'completed_reuse' OR a.consumed_at IS NOT NULL OR a.expires_at<now_at OR a.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR a.descriptor_sha256 IS DISTINCT FROM p_descriptor OR a.transcript_sha256 IS DISTINCT FROM p_transcript
    OR NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='completed' AND accepted_descriptor_sha256=p_descriptor)
    OR NOT EXISTS(SELECT 1 FROM public.source_snapshots WHERE release_id=p_release AND id=s.source_snapshot_id AND usage_status='restricted') OR EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL)
    OR (s.acquisition_graph_sha256,s.descriptor_sha256,s.transcript_sha256,d.descriptor_sha256) IS DISTINCT FROM (p_graph,p_descriptor,p_transcript,p_descriptor) THEN RAISE EXCEPTION 'live exact completed reuse attestation required' USING ERRCODE='42501'; END IF;
 UPDATE public.fec_v2_replay_attestations SET consumed_at=now_at WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id AND consumed_at IS NULL;
 descriptor:=d.descriptor; descriptor_sha256:=d.descriptor_sha256; RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.consume_fec_v2_completed_reuse_attestation(text,text,text,text,text,text,text) TO dsa_seats_fec_v2_acquisition;
REVOKE ALL ON FUNCTION public.fec_v2_completed_acquisition_descriptor_owner(text,text),public.consume_fec_v2_completed_reuse_attestation(text,text,text,text,text,text,text) FROM PUBLIC,dsa_seats_fec_v2_replay_verifier,dsa_seats_fec_v2_invalidator;
ALTER FUNCTION public.fec_v2_completed_acquisition_descriptor_owner(text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.consume_fec_v2_completed_reuse_attestation(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- The seal guard has one narrow non-GUC escape hatch: only the isolated
-- invalidator capability may remove a still-restricted closure.  The API below
-- performs the complete shape check before the first delete; the capability has
-- no table privileges, so this is not a direct-DML bypass.
CREATE OR REPLACE FUNCTION public.guard_fec_v2_acquisition_seal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE data jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; rel text:=data->>'release_id'; plan text:=data->>'plan_sha256'; frozen boolean;
BEGIN
 IF TG_OP='DELETE' AND pg_has_role(session_user,'dsa_seats_fec_v2_invalidator','member') THEN
   PERFORM public.assert_fec_v2_invalidator_admission();
   -- This exclusive capability has no table DML; only the fenced invalidation
   -- SECURITY DEFINER API can reach this trigger branch.
   RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='fec_v2_acquisition_seals' THEN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'FEC V2 acquisition seal is immutable' USING ERRCODE='55000'; END IF; RETURN NEW; END IF;
 IF TG_TABLE_NAME='source_snapshots' THEN SELECT EXISTS(SELECT 1 FROM public.fec_v2_acquisition_seals s WHERE s.release_id=rel AND s.source_snapshot_id=data->>'id') INTO frozen; ELSE SELECT EXISTS(SELECT 1 FROM public.fec_v2_acquisition_seals s WHERE s.release_id=rel AND s.plan_sha256=plan) INTO frozen; END IF;
 IF frozen THEN RAISE EXCEPTION 'sealed FEC V2 acquisition graph is immutable' USING ERRCODE='55000'; END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE OR REPLACE FUNCTION public.invalidate_fec_v2_completed_acquisition(p_release text,p_plan text,p_run text,p_expected_graph text,p_expected_descriptor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s record; d record;
BEGIN
 PERFORM public.assert_fec_v2_invalidator_admission();
 IF p_expected_graph !~ '^[a-f0-9]{64}$' OR p_expected_descriptor !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid invalidation hash' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
 SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR UPDATE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
 IF NOT EXISTS(SELECT 1 FROM public.data_releases WHERE id=p_release AND status='candidate') OR p_run IS DISTINCT FROM s.origin_run_id OR (EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan) AND NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='completed' AND accepted_descriptor_sha256=p_expected_descriptor))
    OR s.acquisition_graph_sha256 IS DISTINCT FROM p_expected_graph OR s.descriptor_sha256 IS DISTINCT FROM p_expected_descriptor OR d.descriptor_sha256 IS DISTINCT FROM p_expected_descriptor
    OR NOT EXISTS(SELECT 1 FROM public.source_snapshots WHERE release_id=p_release AND id=s.source_snapshot_id AND usage_status='restricted') OR EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.fec_v2_data_review_signatures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_publication_signatures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_candidate_mappings WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_committee_mappings WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_election_mappings WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.fec_v2_finance_closures WHERE release_id=p_release) OR EXISTS(SELECT 1 FROM public.finance_proof_routes WHERE release_id=p_release) THEN RAISE EXCEPTION 'exact unreviewed restricted completed acquisition required' USING ERRCODE='55000'; END IF;
 DELETE FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan;
 DELETE FROM public.fec_v2_run_receipts WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_run_snapshots WHERE release_id=p_release AND plan_sha256=p_plan;
 DELETE FROM public.fec_v2_acquisition_receipts WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_acquisition_outcomes WHERE release_id=p_release AND plan_sha256=p_plan;
 DELETE FROM public.fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_amendment_chain_links WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_artifacts WHERE release_id=p_release AND plan_sha256=p_plan;
 DELETE FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.fec_v2_snapshot_metadata WHERE release_id=p_release AND plan_sha256=p_plan; DELETE FROM public.source_snapshots WHERE release_id=p_release AND id=s.source_snapshot_id;
 DELETE FROM public.fec_v2_run_closure_candidates WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run; DELETE FROM public.fec_v2_run_failures WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
 UPDATE public.fec_v2_runs SET status='invalidated',owner_token_sha256=NULL,heartbeat_at=NULL,lease_expires_at=NULL WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='completed';
 DELETE FROM public.release_content_digests WHERE release_id=p_release; DELETE FROM public.nationwide_validation_gates WHERE release_id=p_release; UPDATE public.release_manifests SET validated_at=NULL WHERE release_id=p_release;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_fec_v2_completed_acquisition(text,text,text,text,text) FROM PUBLIC,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_replay_verifier;
GRANT EXECUTE ON FUNCTION public.invalidate_fec_v2_completed_acquisition(text,text,text,text,text) TO dsa_seats_fec_v2_invalidator;
ALTER FUNCTION public.invalidate_fec_v2_completed_acquisition(text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- These final acquisition tables were introduced after the earlier V2 live
-- trigger inventory; give them the same live-proof invalidation boundary.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['fec_v2_acquisition_outcomes','fec_v2_acquisition_receipts','fec_v2_acquisition_seals'] LOOP EXECUTE format('DROP TRIGGER IF EXISTS fec_v2_live_%I ON public.%I',t,t); EXECUTE format('CREATE TRIGGER fec_v2_live_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content()',t,t); END LOOP; END $$;
-- Effective runless-reuse override: a cloned/reviewed release retains the
-- originating run id in its seal but intentionally has no local run row.
CREATE OR REPLACE FUNCTION public.issue_fec_v2_replay_attestation(p_release text,p_plan text,p_run text,p_purpose text,p_graph text,p_descriptor text,p_transcript text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE c record; s record; d record; now_at timestamptz:=clock_timestamp(); i text; BEGIN PERFORM public.assert_fec_v2_replay_verifier_admission(); IF p_purpose NOT IN ('staged_promotion','completed_reuse') OR p_graph !~ '^[a-f0-9]{64}$' OR p_descriptor !~ '^[a-f0-9]{64}$' OR p_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid replay attestation' USING ERRCODE='22023'; END IF; PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:'||p_release)); IF NOT EXISTS(SELECT 1 FROM public.data_releases r JOIN public.fec_v2_plans p ON p.release_id=r.id WHERE r.id=p_release AND r.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF; IF p_purpose='completed_reuse' THEN SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan); IF p_run IS DISTINCT FROM s.origin_run_id OR NOT EXISTS(SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ((ss.usage_status='restricted' AND NOT EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)) OR (ss.usage_status='approved' AND EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)))) OR s.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR s.descriptor_sha256 IS DISTINCT FROM p_descriptor OR s.transcript_sha256 IS DISTINCT FROM p_transcript OR d.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'exact completed reuse commitment required' USING ERRCODE='22023'; END IF; ELSE IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running') THEN RAISE EXCEPTION 'staged promotion requires running run' USING ERRCODE='55000'; END IF; SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run); IF c.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR c.descriptor_sha256 IS DISTINCT FROM p_descriptor THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF; END IF; i:=encode(digest(convert_to(p_release||chr(0)||p_plan||chr(0)||p_run||chr(0)||p_purpose||chr(0)||p_graph||chr(0)||p_descriptor||chr(0)||p_transcript||chr(0)||now_at::text,'UTF8'),'sha256'),'hex'); INSERT INTO public.fec_v2_replay_attestations VALUES(p_release,p_plan,p_run,i,p_purpose,p_graph,p_descriptor,p_transcript,now_at,now_at+interval '10 minutes',NULL); RETURN i; END $$;
CREATE OR REPLACE FUNCTION public.consume_fec_v2_completed_reuse_attestation(p_release text,p_plan text,p_run text,p_id text,p_graph text,p_descriptor text,p_transcript text) RETURNS TABLE(descriptor text,descriptor_sha256 text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE a record; s record; d record; now_at timestamptz:=clock_timestamp(); BEGIN PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release)); SELECT * INTO a FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id FOR UPDATE; SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan); IF NOT FOUND OR a.purpose<>'completed_reuse' OR a.consumed_at IS NOT NULL OR a.expires_at<now_at OR a.acquisition_graph_sha256 IS DISTINCT FROM p_graph OR a.descriptor_sha256 IS DISTINCT FROM p_descriptor OR a.transcript_sha256 IS DISTINCT FROM p_transcript OR p_run IS DISTINCT FROM s.origin_run_id OR NOT EXISTS(SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ((ss.usage_status='restricted' AND NOT EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)) OR (ss.usage_status='approved' AND EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)))) OR (s.acquisition_graph_sha256,s.descriptor_sha256,s.transcript_sha256,d.descriptor_sha256) IS DISTINCT FROM (p_graph,p_descriptor,p_transcript,p_descriptor) THEN RAISE EXCEPTION 'live exact completed reuse attestation required' USING ERRCODE='42501'; END IF; UPDATE public.fec_v2_replay_attestations SET consumed_at=now_at WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id AND consumed_at IS NULL; descriptor:=d.descriptor; descriptor_sha256:=d.descriptor_sha256; RETURN NEXT; END $$;
-- Final conservative reuse definitions. Approved/sealed reuse remains blocked
-- until Phase 4 can prove destination review/publication evidence.
CREATE OR REPLACE FUNCTION public.issue_fec_v2_replay_attestation(p_release text,p_plan text,p_run text,p_purpose text,p_graph text,p_descriptor text,p_transcript text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c record; s record; d record; now_at timestamptz:=clock_timestamp(); i text;
BEGIN
  PERFORM public.assert_fec_v2_replay_verifier_admission();
  IF p_purpose NOT IN ('staged_promotion','completed_reuse') OR p_graph !~ '^[a-f0-9]{64}$' OR p_descriptor !~ '^[a-f0-9]{64}$' OR p_transcript !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid replay attestation' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:'||p_release));
  IF p_purpose='staged_promotion' THEN
    IF NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running') THEN RAISE EXCEPTION 'staged promotion requires running run' USING ERRCODE='55000'; END IF;
    SELECT * INTO c FROM public.fec_v2_staged_acquisition_commitment_owner(p_release,p_plan,p_run);
    IF (c.acquisition_graph_sha256,c.descriptor_sha256) IS DISTINCT FROM (p_graph,p_descriptor) THEN RAISE EXCEPTION 'replay commitment mismatch' USING ERRCODE='22023'; END IF;
  ELSE
    SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
    IF p_run IS DISTINCT FROM s.origin_run_id OR NOT EXISTS(SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ss.usage_status='restricted' AND NOT EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)) OR (s.acquisition_graph_sha256,s.descriptor_sha256,s.transcript_sha256,d.descriptor_sha256) IS DISTINCT FROM (p_graph,p_descriptor,p_transcript,p_descriptor) THEN RAISE EXCEPTION 'exact restricted completed acquisition required' USING ERRCODE='55000'; END IF;
  END IF;
  i:=encode(digest(convert_to(p_release,'UTF8')||decode('00','hex')||convert_to(p_plan,'UTF8')||decode('00','hex')||convert_to(p_run,'UTF8')||decode('00','hex')||convert_to(p_purpose,'UTF8')||decode('00','hex')||convert_to(p_graph||p_descriptor||p_transcript,'UTF8')||decode('00','hex')||convert_to(public.fec_v2_iso_instant(now_at),'UTF8'),'sha256'),'hex');
  INSERT INTO public.fec_v2_replay_attestations(release_id,plan_sha256,run_id,id,purpose,acquisition_graph_sha256,descriptor_sha256,transcript_sha256,issued_at,expires_at,consumed_at) VALUES(p_release,p_plan,p_run,i,p_purpose,p_graph,p_descriptor,p_transcript,now_at,now_at+interval '10 minutes',NULL); RETURN i;
END $$;
CREATE OR REPLACE FUNCTION public.consume_fec_v2_completed_reuse_attestation(p_release text,p_plan text,p_run text,p_id text,p_graph text,p_descriptor text,p_transcript text) RETURNS TABLE(descriptor text,descriptor_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a record; s record; d record; now_at timestamptz:=clock_timestamp();
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission(); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion')); PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
  SELECT * INTO a FROM public.fec_v2_replay_attestations WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id FOR UPDATE; SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
  IF NOT FOUND OR a.purpose<>'completed_reuse' OR a.consumed_at IS NOT NULL OR a.expires_at<now_at OR p_run IS DISTINCT FROM s.origin_run_id OR NOT EXISTS(SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ss.usage_status='restricted' AND NOT EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL)) OR (a.acquisition_graph_sha256,a.descriptor_sha256,a.transcript_sha256,s.acquisition_graph_sha256,s.descriptor_sha256,s.transcript_sha256,d.descriptor_sha256) IS DISTINCT FROM (p_graph,p_descriptor,p_transcript,p_graph,p_descriptor,p_transcript,p_descriptor) THEN RAISE EXCEPTION 'live exact restricted completed reuse attestation required' USING ERRCODE='42501'; END IF;
  UPDATE public.fec_v2_replay_attestations SET consumed_at=now_at WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND id=p_id AND consumed_at IS NULL; descriptor:=d.descriptor; descriptor_sha256:=d.descriptor_sha256; RETURN NEXT;
END $$;
ALTER FUNCTION public.issue_fec_v2_replay_attestation(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.consume_fec_v2_completed_reuse_attestation(text,text,text,text,text,text,text) OWNER TO dsa_seats_migration_owner;

-- Finalization is deliberately separate from staging: the attested commitment
-- cannot be read until this exact, bounded receipt-set has been written.
CREATE OR REPLACE FUNCTION public.finalize_fec_v2_staged_snapshot(p_release text,p_plan text,p_run text,p_raw_token text,p_snapshot_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE snap record; x record; receipt_set text; first_row boolean:=true; n bigint; actual text; latest timestamptz;
BEGIN
  PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_raw_token);
  IF NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000'; END IF;
  SELECT * INTO snap FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND snapshot_id=p_snapshot_id FOR UPDATE;
  IF NOT FOUND OR (snap.receipt_set_digest_sha256 IS NULL)<>(snap.checksum_sha256 IS NULL) OR (SELECT count(*) FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run)<>1 THEN RAISE EXCEPTION 'exact staged snapshot required' USING ERRCODE='22023'; END IF;
  SELECT count(*),max(retrieved_at) INTO n,latest FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  IF n=0 OR n>2020001 OR latest IS NULL OR date_trunc('milliseconds',latest)<>latest OR EXISTS(SELECT 1 FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND (snapshot_id<>p_snapshot_id OR date_trunc('milliseconds',retrieved_at)<>retrieved_at)) THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  receipt_set:='{"schemaVersion":2,"acquisitionPlanSha256":'||to_json(p_plan)::text||',"snapshotId":'||to_json(p_snapshot_id)::text||',"receipts":[';
  FOR x IN SELECT * FROM public.stg_fec_v2_artifact_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY receipt_id COLLATE "C" LOOP
    IF NOT first_row THEN receipt_set:=receipt_set||','; END IF; first_row:=false;
    receipt_set:=receipt_set||'{"receiptId":'||to_json(x.receipt_id)::text||',"artifactKind":'||to_json(x.artifact_kind)::text||',"artifactSha256":'||to_json(x.artifact_sha256)::text||',"upstreamEntitySha256":'||coalesce(to_json(x.upstream_entity_sha256)::text,'null')||',"objectKey":'||to_json(x.object_key)::text||',"versionId":'||to_json(x.version_id)::text||',"etag":'||to_json(x.etag)::text||',"byteSize":'||to_json(x.byte_size::text)::text||',"retrievedAt":'||to_json(public.fec_v2_iso_instant(x.retrieved_at))::text||'}';
    IF octet_length(receipt_set)>268435456 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  END LOOP;
  receipt_set:=receipt_set||']}'||chr(10); IF octet_length(receipt_set)>268435456 THEN RAISE EXCEPTION 'FEC_V2_GRAPH_INVALID' USING ERRCODE='22023'; END IF;
  actual:=encode(digest(convert_to(receipt_set,'UTF8'),'sha256'),'hex');
  UPDATE public.stg_fec_v2_snapshots SET receipt_set_digest_sha256=actual,checksum_sha256=actual,retrieved_at=latest WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND snapshot_id=p_snapshot_id AND receipt_set_digest_sha256 IS NULL AND checksum_sha256 IS NULL;
  IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM public.stg_fec_v2_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND snapshot_id=p_snapshot_id AND receipt_set_digest_sha256=actual AND checksum_sha256=actual AND retrieved_at=latest) THEN RAISE EXCEPTION 'staged snapshot finalization mismatch' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finalize_fec_v2_staged_snapshot(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_fec_v2_staged_snapshot(text,text,text,text,text) TO dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.finalize_fec_v2_staged_snapshot(text,text,text,text,text) OWNER TO dsa_seats_migration_owner;
-- Snapshot digest/checksum values are exclusively the finalizer's output; this
-- prevents a caller from staging a value that merely looks committed.
CREATE OR REPLACE FUNCTION public.stage_fec_v2_snapshot(p_release text,p_plan text,p_run text,p_token text,p_snapshot text,p_origin text,p_receipt_digest text,p_source text,p_url text,p_published timestamptz,p_retrieved timestamptz,p_checksum text,p_parser text,p_license text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_live_owner(p_release,p_plan,p_run,p_token);
  IF p_receipt_digest IS NOT NULL OR p_checksum IS NOT NULL THEN RAISE EXCEPTION 'staged snapshot metadata is finalized only by its fenced finalizer' USING ERRCODE='22023'; END IF;
  INSERT INTO public.stg_fec_v2_snapshots VALUES(p_release,p_plan,p_run,p_snapshot,p_origin,NULL,p_source,p_url,p_published,p_retrieved,NULL,p_parser,p_license,'restricted');
END $$;
ALTER FUNCTION public.stage_fec_v2_snapshot(text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text,text,text) OWNER TO dsa_seats_migration_owner;
-- Verifier replay receives only a locator-free, exact-version descriptor set.
DROP FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text);
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_receipt_descriptors(p_release text,p_plan text,p_run text)
RETURNS TABLE(receipt_id text,artifact_sha256 text,artifact_kind text,canonical_byte_size text,upstream_entity_sha256 text,object_key text,version_id text,etag text,byte_size text,retrieved_at timestamptz,snapshot_id text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_replay_verifier_admission();
  RETURN QUERY SELECT r.receipt_id,r.artifact_sha256,r.artifact_kind,r.canonical_byte_size::text,r.upstream_entity_sha256,r.object_key,r.version_id,r.etag,r.byte_size::text,r.retrieved_at,r.snapshot_id FROM public.stg_fec_v2_artifact_receipts r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.run_id=p_run ORDER BY r.receipt_id COLLATE "C";
END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_acquisition_commitment(p_release text,p_plan text)
RETURNS TABLE(origin_run_id text,acquisition_graph_sha256 text,descriptor_sha256 text,transcript_sha256 text,descriptor text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s record; d record;
BEGIN
  PERFORM public.assert_fec_v2_replay_verifier_admission();
  SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ss.usage_status='restricted') OR EXISTS (SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'exact restricted unsealed completed acquisition required' USING ERRCODE='55000'; END IF;
  SELECT * INTO d FROM public.fec_v2_completed_acquisition_descriptor_owner(p_release,p_plan);
  origin_run_id:=s.origin_run_id; acquisition_graph_sha256:=s.acquisition_graph_sha256; descriptor_sha256:=s.descriptor_sha256; transcript_sha256:=s.transcript_sha256; descriptor:=d.descriptor;
  IF d.descriptor_sha256 IS DISTINCT FROM descriptor_sha256 THEN RAISE EXCEPTION 'completed descriptor mismatch' USING ERRCODE='22023'; END IF;
  RETURN NEXT;
END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_receipt_descriptors(p_release text,p_plan text)
RETURNS TABLE(receipt_id text,artifact_sha256 text,artifact_kind text,canonical_byte_size text,upstream_entity_sha256 text,object_key text,version_id text,etag text,byte_size text,retrieved_at timestamptz,snapshot_id text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s record;
BEGIN
  PERFORM public.assert_fec_v2_replay_verifier_admission();
  SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ss.usage_status='restricted') OR EXISTS (SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'exact restricted unsealed completed acquisition required' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT r.receipt_id,r.artifact_sha256,r.artifact_kind,r.canonical_byte_size::text,r.upstream_entity_sha256,r.object_key,r.version_id,r.etag,r.byte_size::text,r.retrieved_at,r.snapshot_id FROM public.fec_v2_acquisition_receipts a JOIN public.fec_v2_artifact_receipts r ON (r.release_id,r.plan_sha256,r.receipt_id)=(a.release_id,a.plan_sha256,a.receipt_id) WHERE a.release_id=p_release AND a.plan_sha256=p_plan ORDER BY r.receipt_id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text),public.read_fec_v2_completed_acquisition_commitment(text,text),public.read_fec_v2_completed_receipt_descriptors(text,text) FROM PUBLIC,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_invalidator;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text),public.read_fec_v2_completed_acquisition_commitment(text,text),public.read_fec_v2_completed_receipt_descriptors(text,text) TO dsa_seats_fec_v2_replay_verifier;
ALTER FUNCTION public.read_fec_v2_staged_receipt_descriptors(text,text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_acquisition_commitment(text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_receipt_descriptors(text,text) OWNER TO dsa_seats_migration_owner;
CREATE OR REPLACE FUNCTION public.read_fec_v2_active_run_candidate(p_release text,p_plan text)
RETURNS TABLE(run_id text,status text,lease_expires_at timestamptz,run_deadline_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_acquisition_admission();
  IF NOT EXISTS (SELECT 1 FROM public.fec_v2_plans WHERE release_id=p_release AND plan_sha256=p_plan AND sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'sealed plan required' USING ERRCODE='55000'; END IF;
  RETURN QUERY SELECT r.run_id,r.status,r.lease_expires_at,r.run_deadline_at FROM public.fec_v2_runs r WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND r.status='running' ORDER BY r.run_id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION public.read_fec_v2_active_run_candidate(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_active_run_candidate(text,text) TO dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.read_fec_v2_active_run_candidate(text,text) OWNER TO dsa_seats_migration_owner;
-- Fixed-path verifier-only semantic graph readers. Scalar fields only; no JSON.
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_enumeration_pages_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,pass integer,form_type text,receipt_date text,requested_file_number text,page_number integer,terminal integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_replay_verifier_admission(); IF p_limit NOT BETWEEN 1 AND 1000 OR NOT EXISTS(SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running') THEN RAISE EXCEPTION 'sealed running candidate required' USING ERRCODE='55000'; END IF; RETURN QUERY SELECT artifact_sha256,pass,form_type,receipt_date::text,requested_file_number::text,page_number,terminal FROM public.stg_fec_v2_enumeration_pages WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND (p_cursor IS NULL OR artifact_sha256 COLLATE "C">p_cursor COLLATE "C") ORDER BY artifact_sha256 COLLATE "C" LIMIT p_limit; END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_ledger_headers_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,stable integer,finalized_at text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT artifact_sha256,stable,finalized_at::text FROM public.stg_fec_v2_filing_ledgers WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY artifact_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000) $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_ledger_entries_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,canonical_form_type text,base_form_type text,report_type text,report_date text,receipt_date text,coverage_start text,coverage_end text,amendment_indicator text,filer_id text,committee_id text,electronic_status text,raw_source_availability text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT file_number::text,entry_identity_sha256,canonical_form_type,base_form_type,report_type,report_date::text,receipt_date::text,coverage_start::text,coverage_end::text,amendment_indicator,filer_id,committee_id,electronic_status,raw_source_availability FROM public.stg_fec_v2_filing_ledger_entries WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number LIMIT LEAST(GREATEST(p_limit,1),1000) $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_page_lineage_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,page_sha256 text,pass integer,occurrence_index integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT file_number::text,entry_identity_sha256,page_sha256,pass,occurrence_index FROM public.stg_fec_v2_page_lineage WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY page_sha256,file_number LIMIT LEAST(GREATEST(p_limit,1),1000) $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_amendment_links_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,predecessor_file_number text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT file_number::text,entry_identity_sha256,predecessor_file_number::text FROM public.stg_fec_v2_amendment_links WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY file_number LIMIT LEAST(GREATEST(p_limit,1),1000) $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_staged_sanitized_filings_page(p_release text,p_plan text,p_run text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,file_number text,entry_identity_sha256 text,report_date text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT artifact_sha256,file_number::text,entry_identity_sha256,report_date::text FROM public.stg_fec_v2_sanitized_filings WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run ORDER BY artifact_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000) $$;
REVOKE ALL ON FUNCTION public.read_fec_v2_staged_enumeration_pages_page(text,text,text,text,integer),public.read_fec_v2_staged_ledger_headers_page(text,text,text,text,integer),public.read_fec_v2_staged_ledger_entries_page(text,text,text,text,integer),public.read_fec_v2_staged_page_lineage_page(text,text,text,text,integer),public.read_fec_v2_staged_amendment_links_page(text,text,text,text,integer),public.read_fec_v2_staged_sanitized_filings_page(text,text,text,text,integer) FROM PUBLIC,dsa_seats_fec_v2_acquisition;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_staged_enumeration_pages_page(text,text,text,text,integer),public.read_fec_v2_staged_ledger_headers_page(text,text,text,text,integer),public.read_fec_v2_staged_ledger_entries_page(text,text,text,text,integer),public.read_fec_v2_staged_page_lineage_page(text,text,text,text,integer),public.read_fec_v2_staged_amendment_links_page(text,text,text,text,integer),public.read_fec_v2_staged_sanitized_filings_page(text,text,text,text,integer) TO dsa_seats_fec_v2_replay_verifier;
-- Completed semantic graph readers are verifier-only and deliberately bind to
-- the seal's one selected restricted, unsealed snapshot (not an origin run).
CREATE OR REPLACE FUNCTION public.assert_fec_v2_completed_graph_reader(p_release text,p_plan text) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE s record; BEGIN PERFORM public.assert_fec_v2_replay_verifier_admission(); SELECT * INTO s FROM public.fec_v2_acquisition_seals WHERE release_id=p_release AND plan_sha256=p_plan FOR SHARE; IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.source_snapshots ss WHERE ss.release_id=p_release AND ss.id=s.source_snapshot_id AND ss.usage_status='restricted') OR EXISTS(SELECT 1 FROM public.fec_v2_snapshot_metadata m WHERE m.release_id=p_release AND m.plan_sha256=p_plan AND m.snapshot_id=s.source_snapshot_id AND m.sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM public.fec_v2_artifact_receipts r LEFT JOIN public.fec_v2_acquisition_receipts a ON (a.release_id,a.plan_sha256,a.receipt_id)=(r.release_id,r.plan_sha256,r.receipt_id) WHERE r.release_id=p_release AND r.plan_sha256=p_plan AND (r.snapshot_id<>s.source_snapshot_id OR a.receipt_id IS NULL)) OR EXISTS(SELECT 1 FROM public.fec_v2_acquisition_receipts a LEFT JOIN public.fec_v2_artifact_receipts r ON (r.release_id,r.plan_sha256,r.receipt_id)=(a.release_id,a.plan_sha256,a.receipt_id) WHERE a.release_id=p_release AND a.plan_sha256=p_plan AND (r.receipt_id IS NULL OR r.snapshot_id<>s.source_snapshot_id)) OR EXISTS(SELECT 1 FROM public.fec_v2_artifacts x LEFT JOIN public.fec_v2_artifact_receipts r ON r.release_id=x.release_id AND r.plan_sha256=x.plan_sha256 AND r.artifact_sha256=x.artifact_sha256 WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND r.receipt_id IS NULL) THEN RAISE EXCEPTION 'exact restricted unsealed sealed closure required' USING ERRCODE='55000'; END IF; RETURN s.source_snapshot_id; END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_enumeration_pages_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,pass integer,form_type text,receipt_date text,requested_file_number text,page_number integer,terminal integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); IF p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid page limit' USING ERRCODE='22023'; END IF; RETURN QUERY SELECT x.artifact_sha256,x.pass,x.form_type,x.receipt_date::text,x.requested_file_number::text,x.page_number,x.terminal FROM public.fec_v2_enumeration_pages x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR x.artifact_sha256 COLLATE "C">p_cursor COLLATE "C") ORDER BY x.artifact_sha256 COLLATE "C" LIMIT p_limit; END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_ledger_headers_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,stable integer,finalized_at text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); RETURN QUERY SELECT x.artifact_sha256,x.stable,x.finalized_at::text FROM public.fec_v2_filing_ledgers x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR x.artifact_sha256 COLLATE "C">p_cursor COLLATE "C") ORDER BY x.artifact_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000); END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_ledger_entries_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,canonical_form_type text,base_form_type text,report_type text,report_date text,receipt_date text,coverage_start text,coverage_end text,amendment_indicator text,filer_id text,committee_id text,electronic_status text,raw_source_availability text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); RETURN QUERY SELECT x.file_number::text,x.entry_identity_sha256,x.canonical_form_type,x.base_form_type,x.report_type,x.report_date::text,x.receipt_date::text,x.coverage_start::text,x.coverage_end::text,x.amendment_indicator,x.filer_id,x.committee_id,x.electronic_status,x.raw_source_availability FROM public.fec_v2_filing_ledger_entries x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR (x.file_number::text||chr(1)||x.entry_identity_sha256) COLLATE "C">p_cursor COLLATE "C") ORDER BY x.file_number,x.entry_identity_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000); END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_page_lineage_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,page_sha256 text,pass integer,occurrence_index integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); RETURN QUERY SELECT x.file_number::text,x.entry_identity_sha256,x.page_sha256,x.pass,x.occurrence_index FROM public.fec_v2_page_lineage x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR (x.page_sha256||chr(1)||x.file_number::text||chr(1)||x.occurrence_index::text) COLLATE "C">p_cursor COLLATE "C") ORDER BY x.page_sha256 COLLATE "C",x.file_number,x.occurrence_index LIMIT LEAST(GREATEST(p_limit,1),1000); END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_amendment_links_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(file_number text,entry_identity_sha256 text,predecessor_file_number text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); RETURN QUERY SELECT x.file_number::text,x.entry_identity_sha256,x.predecessor_file_number::text FROM public.fec_v2_amendment_chain_links x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR (x.file_number::text||chr(1)||x.entry_identity_sha256) COLLATE "C">p_cursor COLLATE "C") ORDER BY x.file_number,x.entry_identity_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000); END $$;
CREATE OR REPLACE FUNCTION public.read_fec_v2_completed_sanitized_filings_page(p_release text,p_plan text,p_cursor text,p_limit integer) RETURNS TABLE(artifact_sha256 text,file_number text,entry_identity_sha256 text,report_date text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN PERFORM public.assert_fec_v2_completed_graph_reader(p_release,p_plan); RETURN QUERY SELECT x.artifact_sha256,x.file_number::text,x.entry_identity_sha256,x.report_date::text FROM public.fec_v2_sanitized_filings x WHERE x.release_id=p_release AND x.plan_sha256=p_plan AND (p_cursor IS NULL OR x.artifact_sha256 COLLATE "C">p_cursor COLLATE "C") ORDER BY x.artifact_sha256 COLLATE "C" LIMIT LEAST(GREATEST(p_limit,1),1000); END $$;
REVOKE ALL ON FUNCTION public.assert_fec_v2_completed_graph_reader(text,text),public.read_fec_v2_completed_enumeration_pages_page(text,text,text,integer),public.read_fec_v2_completed_ledger_headers_page(text,text,text,integer),public.read_fec_v2_completed_ledger_entries_page(text,text,text,integer),public.read_fec_v2_completed_page_lineage_page(text,text,text,integer),public.read_fec_v2_completed_amendment_links_page(text,text,text,integer),public.read_fec_v2_completed_sanitized_filings_page(text,text,text,integer) FROM PUBLIC,dsa_seats_fec_v2_acquisition,dsa_seats_fec_v2_invalidator;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_completed_enumeration_pages_page(text,text,text,integer),public.read_fec_v2_completed_ledger_headers_page(text,text,text,integer),public.read_fec_v2_completed_ledger_entries_page(text,text,text,integer),public.read_fec_v2_completed_page_lineage_page(text,text,text,integer),public.read_fec_v2_completed_amendment_links_page(text,text,text,integer),public.read_fec_v2_completed_sanitized_filings_page(text,text,text,integer) TO dsa_seats_fec_v2_replay_verifier;
ALTER FUNCTION public.assert_fec_v2_completed_graph_reader(text,text) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_enumeration_pages_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_ledger_headers_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_ledger_entries_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_page_lineage_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_amendment_links_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.read_fec_v2_completed_sanitized_filings_page(text,text,text,integer) OWNER TO dsa_seats_migration_owner;
COMMIT;
