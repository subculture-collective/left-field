-- Phase 3 is intentionally forward-only.  There was no Task 5 data at the
-- time this migration was authored, so identities and occurrence ordinals are
-- never invented for an already-populated database.
DO $$
BEGIN
  -- Take the upgraded relations in one globally fixed order before examining
  -- legacy state or changing their shape.  This makes a seeded 0007 upgrade
  -- fail atomically rather than race concurrent acquisition writes.
  LOCK TABLE public.fec_v2_filing_ledger_entries IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.fec_v2_page_lineage IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.fec_v2_runs IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.fec_v2_run_failures IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.fec_v2_filing_ledger_entries)
     OR EXISTS (SELECT 1 FROM public.fec_v2_page_lineage) THEN
    RAISE EXCEPTION '0008 requires empty legacy ledger/page lineage tables' USING ERRCODE='P0008';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.fec_v2_runs r
    WHERE r.failure_code IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.fec_v2_run_failures f
                      WHERE (f.release_id,f.plan_sha256,f.run_id,f.failure_code)
                          =(r.release_id,r.plan_sha256,r.run_id,r.failure_code))
  ) THEN
    RAISE EXCEPTION '0008 cannot discard unmatched legacy run failure_code' USING ERRCODE='P0008';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "entry_identity_sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "base_form_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "report_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "coverage_start" date;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "coverage_end" date;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "amendment_indicator" text;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "filer_id" text;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "committee_id" text;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "electronic_status" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD COLUMN "raw_source_availability" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD COLUMN "occurrence_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" DROP CONSTRAINT "fec_v2_filing_ledger_entries_form_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" DROP CONSTRAINT "fec_v2_page_lineage_release_id_plan_sha256_ledger_sha256_file_number_page_sha256_pk";--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" DROP CONSTRAINT "fec_v2_run_failures_release_id_plan_sha256_run_id_pk";--> statement-breakpoint
ALTER TABLE "fec_v2_runs" DROP CONSTRAINT "f2runs_lifecycle_ck";--> statement-breakpoint
ALTER TABLE "fec_v2_runs" DROP COLUMN "failure_code";--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD CONSTRAINT "fec_v2_page_lineage_release_id_plan_sha256_ledger_sha256_file_number_page_sha256_occurrence_index_pk" PRIMARY KEY("release_id","plan_sha256","ledger_sha256","file_number","page_sha256","occurrence_index");--> statement-breakpoint
ALTER TABLE "fec_v2_run_failures" ADD CONSTRAINT "fec_v2_run_failures_release_id_plan_sha256_run_id_failure_code_subject_sha256_pk" PRIMARY KEY("release_id","plan_sha256","run_id","failure_code","subject_sha256");--> statement-breakpoint
ALTER TABLE "fec_v2_filing_ledger_entries" ADD CONSTRAINT "fec_v2_filing_ledger_entries_form_ck" CHECK (
  "canonical_form_type" IN ('F3','F3X','F24','F5') AND "base_form_type" IN ('F3','F3X','F24','F5')
  AND "report_type" ~ '^[A-Z0-9]{1,8}$' AND "file_number">0
  AND "entry_identity_sha256" ~ '^[a-f0-9]{64}$'
  AND ("coverage_start" IS NULL) = ("coverage_end" IS NULL)
  AND ("coverage_start" IS NULL OR "coverage_start" <= "coverage_end")
  AND ("amendment_indicator" IS NULL OR "amendment_indicator" IN ('N','A','T'))
  AND ("filer_id" IS NULL OR "filer_id" ~ '^[A-Z0-9]{9}$')
  AND ("committee_id" IS NULL OR "committee_id" ~ '^[A-Z0-9]{9}$')
  AND "electronic_status" IN ('electronic','paper','unknown')
  AND "raw_source_availability" IN ('available','unavailable','paper','unknown')
);--> statement-breakpoint
ALTER TABLE "fec_v2_page_lineage" ADD CONSTRAINT "f2pl_occurrence_ck" CHECK ("occurrence_index" BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "fec_v2_runs" ADD CONSTRAINT "f2runs_lifecycle_ck" CHECK (("status"='running' AND "completed_at" IS NULL) OR ("status" IN ('completed','failed') AND "completed_at" IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "f2fle_identity_uq" ON "fec_v2_filing_ledger_entries" USING btree ("release_id","plan_sha256","ledger_sha256","entry_identity_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "f2fl_one_final_stable_uq" ON "fec_v2_filing_ledgers" USING btree ("release_id","plan_sha256") WHERE "stable"=1 AND "finalized_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "f2pl_page_pass_occurrence_fk_idx" ON "fec_v2_page_lineage" USING btree ("release_id","plan_sha256","page_sha256","pass","occurrence_index");--> statement-breakpoint
CREATE INDEX "f2rf_run_fk_idx" ON "fec_v2_run_failures" USING btree ("release_id","plan_sha256","run_id");--> statement-breakpoint
CREATE TABLE "fec_v2_run_receipts" ("release_id" text NOT NULL,"plan_sha256" text NOT NULL,"run_id" text NOT NULL,"receipt_id" text NOT NULL,CONSTRAINT "fec_v2_run_receipts_release_id_plan_sha256_run_id_receipt_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","receipt_id"));--> statement-breakpoint
ALTER TABLE "fec_v2_run_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fec_v2_run_closure_candidates" ("release_id" text NOT NULL,"plan_sha256" text NOT NULL,"run_id" text NOT NULL,"seat_cycle_id" text NOT NULL,"subject_id" text NOT NULL,CONSTRAINT "fec_v2_run_closure_candidates_release_id_plan_sha256_run_id_seat_cycle_id_subject_id_pk" PRIMARY KEY("release_id","plan_sha256","run_id","seat_cycle_id","subject_id"),CONSTRAINT "f2rcc_subject_id_ck" CHECK (length("subject_id") BETWEEN 1 AND 128 AND "subject_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'));--> statement-breakpoint
ALTER TABLE "fec_v2_run_closure_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fec_v2_run_receipts" ADD CONSTRAINT "f2rr_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id");--> statement-breakpoint
ALTER TABLE "fec_v2_run_receipts" ADD CONSTRAINT "f2rr_receipt_fk" FOREIGN KEY ("release_id","plan_sha256","receipt_id") REFERENCES "public"."fec_v2_artifact_receipts"("release_id","plan_sha256","receipt_id");--> statement-breakpoint
ALTER TABLE "fec_v2_run_closure_candidates" ADD CONSTRAINT "f2rcc_run_fk" FOREIGN KEY ("release_id","plan_sha256","run_id") REFERENCES "public"."fec_v2_runs"("release_id","plan_sha256","run_id");--> statement-breakpoint
ALTER TABLE "fec_v2_run_closure_candidates" ADD CONSTRAINT "f2rcc_target_fk" FOREIGN KEY ("release_id","plan_sha256","seat_cycle_id") REFERENCES "public"."fec_v2_plan_targets"("release_id","plan_sha256","seat_cycle_id");--> statement-breakpoint
CREATE INDEX "f2rr_receipt_fk_idx" ON "fec_v2_run_receipts" USING btree ("release_id","plan_sha256","receipt_id");--> statement-breakpoint
CREATE INDEX "f2rcc_target_fk_idx" ON "fec_v2_run_closure_candidates" USING btree ("release_id","plan_sha256","seat_cycle_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.guard_fec_v2_run_operational() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r text; p text; run text; state text;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD.release_id; p:=OLD.plan_sha256; run:=OLD.run_id; PERFORM public.lock_fec_v2_releases(OLD.release_id,NULL); ELSE r:=NEW.release_id; p:=NEW.plan_sha256; run:=NEW.run_id; PERFORM public.lock_fec_v2_releases(NULL,NEW.release_id); END IF;
  IF TG_TABLE_NAME='fec_v2_runs' THEN
    IF TG_OP='INSERT' AND (NEW.status<>'running' OR NEW.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'runs must start running' USING ERRCODE='55000'; END IF;
    IF TG_OP='UPDATE' THEN
      IF current_user<>'dsa_seats_migration_owner' OR OLD.status<>'running' OR NEW.status NOT IN ('completed','failed') OR NEW.completed_at IS NULL OR NEW.release_id IS DISTINCT FROM OLD.release_id OR NEW.plan_sha256 IS DISTINCT FROM OLD.plan_sha256 OR NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.receipt_cutoff IS DISTINCT FROM OLD.receipt_cutoff OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN RAISE EXCEPTION 'completed or failed FEC v2 run descriptor is immutable' USING ERRCODE='42501'; END IF;
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- The release advisory lock above serializes this read with finalization.
  -- Avoid a row-lock clause here: PostgreSQL requires UPDATE privilege for
  -- locking reads, while acquisition intentionally has no direct run UPDATE.
  SELECT status INTO state FROM public.fec_v2_runs WHERE release_id=r AND plan_sha256=p AND run_id=run;
  IF state IS DISTINCT FROM 'running' THEN RAISE EXCEPTION 'run joins are mutable only while running' USING ERRCODE='55000'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.finalize_fec_v2_run(p_release text,p_plan text,p_run text,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE receipt_count bigint; snapshot_count bigint;
BEGIN
  IF NOT pg_has_role(session_user,'dsa_seats_fec_v2_acquisition','member') THEN RAISE EXCEPTION 'FEC v2 acquisition role required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'terminal status required' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_release));
  PERFORM 1 FROM public.data_releases WHERE id=p_release AND status='candidate'; IF NOT FOUND THEN RAISE EXCEPTION 'candidate release required' USING ERRCODE='55000'; END IF;
  PERFORM 1 FROM public.fec_v2_runs WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run AND status='running' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'running run required' USING ERRCODE='55000'; END IF;
  SELECT count(*) INTO receipt_count FROM public.fec_v2_run_receipts WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  SELECT count(*) INTO snapshot_count FROM public.fec_v2_run_snapshots WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
  IF p_status='completed' THEN
    IF receipt_count=0 OR EXISTS (SELECT 1 FROM public.fec_v2_run_receipts rr JOIN public.fec_v2_artifact_receipts ar ON (ar.release_id,ar.plan_sha256,ar.receipt_id)=(rr.release_id,rr.plan_sha256,rr.receipt_id) WHERE rr.release_id=p_release AND rr.plan_sha256=p_plan AND rr.run_id=p_run AND NOT EXISTS (SELECT 1 FROM public.fec_v2_run_snapshots rs WHERE (rs.release_id,rs.plan_sha256,rs.run_id,rs.snapshot_id)=(p_release,p_plan,p_run,ar.snapshot_id))) OR EXISTS (SELECT 1 FROM public.fec_v2_run_snapshots rs WHERE rs.release_id=p_release AND rs.plan_sha256=p_plan AND rs.run_id=p_run AND NOT EXISTS (SELECT 1 FROM public.fec_v2_run_receipts rr JOIN public.fec_v2_artifact_receipts ar ON (ar.release_id,ar.plan_sha256,ar.receipt_id)=(rr.release_id,rr.plan_sha256,rr.receipt_id) WHERE rr.release_id=p_release AND rr.plan_sha256=p_plan AND rr.run_id=p_run AND ar.snapshot_id=rs.snapshot_id)) OR EXISTS (SELECT 1 FROM public.fec_v2_run_failures WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run) THEN RAISE EXCEPTION 'completed run evidence is incomplete' USING ERRCODE='55000'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.fec_v2_run_failures WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run) OR receipt_count<>0 OR snapshot_count<>0 OR EXISTS (SELECT 1 FROM public.fec_v2_run_closure_candidates WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run) THEN RAISE EXCEPTION 'failed run must contain only plural failure evidence' USING ERRCODE='55000'; END IF;
  END IF;
  UPDATE public.fec_v2_runs SET status=p_status,completed_at=clock_timestamp() WHERE release_id=p_release AND plan_sha256=p_plan AND run_id=p_run;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fec_v2_runs','fec_v2_run_snapshots','fec_v2_run_failures','fec_v2_run_receipts','fec_v2_run_closure_candidates'] LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE TRIGGER fec_v2_run_operational_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_fec_v2_run_operational()',t,t);
    EXECUTE format('CREATE TRIGGER fec_v2_run_live_%I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_live_preflight_content()',t,t);
    EXECUTE format('ALTER TABLE public.%I OWNER TO dsa_seats_migration_owner',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,dsa_seats_web,dsa_seats_ingest,dsa_seats_release_operator,dsa_seats_fec_v2_publisher,dsa_seats_fec_v2_data_reviewer',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO dsa_seats_fec_v2_acquisition',t);
    EXECUTE format('GRANT SELECT ON public.%I TO dsa_seats_release_preflight,dsa_seats_launch_verifier',t);
    EXECUTE format('CREATE POLICY f2run_owner ON public.%I FOR ALL TO dsa_seats_migration_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY f2run_acquisition ON public.%I FOR ALL TO dsa_seats_fec_v2_acquisition USING(EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status=''candidate'')) WITH CHECK(EXISTS(SELECT 1 FROM public.data_releases d WHERE d.id=release_id AND d.status=''candidate''))',t);
    EXECUTE format('CREATE POLICY f2run_preflight_read ON public.%I FOR SELECT TO dsa_seats_release_preflight,dsa_seats_launch_verifier USING(true)',t);
  END LOOP;
END $$;
REVOKE UPDATE ON public.fec_v2_runs FROM dsa_seats_fec_v2_acquisition;
ALTER FUNCTION public.guard_fec_v2_run_operational() OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION public.finalize_fec_v2_run(text,text,text,text) OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.guard_fec_v2_run_operational() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_fec_v2_run(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_fec_v2_run(text,text,text,text) TO dsa_seats_fec_v2_acquisition;
GRANT EXECUTE ON FUNCTION public.lock_fec_v2_releases(text,text) TO dsa_seats_fec_v2_acquisition;
