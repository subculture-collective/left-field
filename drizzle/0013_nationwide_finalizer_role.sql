BEGIN;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dsa_seats_nationwide_finalizer') THEN
    CREATE ROLE dsa_seats_nationwide_finalizer NOLOGIN INHERIT
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

ALTER ROLE dsa_seats_nationwide_finalizer NOLOGIN INHERIT
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT dsa_seats_ingest TO dsa_seats_nationwide_finalizer
  WITH INHERIT TRUE, SET TRUE;
GRANT USAGE ON SCHEMA public TO dsa_seats_nationwide_finalizer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dsa_seats_nationwide_finalizer;

-- The source may already be published/retired while the target is a candidate.
-- Ordinary ingest RLS intentionally cannot see that source, so this offline
-- finalizer receives read-only visibility across the public release catalog.
-- Sensitive correction/address control rows live in `operations`, not here.
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
    ORDER BY c.relname COLLATE "C"
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS nationwide_finalizer_catalog_read ON public.%I',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY nationwide_finalizer_catalog_read ON public.%I FOR SELECT TO dsa_seats_nationwide_finalizer USING (true)',
      table_name
    );
  END LOOP;
END $$;

-- Candidate baselining recomputes the complete seven-domain manifest. The
-- finalizer needs read-only access to the isolated FEC registry but receives no
-- FEC acquisition/review capability and no lifecycle transition capability.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'fec_v2_plans','finance_proof_routes','fec_v2_plan_targets',
    'fec_v2_snapshot_metadata','fec_v2_artifacts','fec_v2_artifact_receipts',
    'fec_v2_enumeration_pages','fec_v2_filing_ledgers',
    'fec_v2_filing_ledger_entries','fec_v2_page_lineage',
    'fec_v2_amendment_chain_links','fec_v2_sanitized_filings',
    'fec_v2_alternate_scoping','fec_v2_acquisition_outcomes',
    'fec_v2_acquisition_receipts','fec_v2_acquisition_seals',
    'fec_v2_candidate_mappings','fec_v2_committee_mappings',
    'fec_v2_election_mappings','fec_v2_finance_closures',
    'fec_v2_closure_input_receipts','fec_v2_closure_input_snapshots',
    'fec_v2_seat_coverage','fec_v2_exact_election_aggregates',
    'fec_v2_data_review_signatures'
  ]
  LOOP
    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO dsa_seats_nationwide_finalizer',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS nationwide_finalizer_fec_read ON public.%I',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY nationwide_finalizer_fec_read ON public.%I FOR SELECT TO dsa_seats_nationwide_finalizer USING (true)',
      table_name
    );
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.lifecycle_promote_candidate(text,text,text,text,text[])
  FROM dsa_seats_nationwide_finalizer;
REVOKE EXECUTE ON FUNCTION public.lifecycle_roll_forward(text,text,text,text,text[])
  FROM dsa_seats_nationwide_finalizer;
REVOKE EXECUTE ON FUNCTION public.lifecycle_rollback(text,text)
  FROM dsa_seats_nationwide_finalizer;
REVOKE EXECUTE ON FUNCTION public.issue_release_preflight(text,text,text,text,text,text[],integer)
  FROM dsa_seats_nationwide_finalizer;
REVOKE EXECUTE ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)
  FROM dsa_seats_nationwide_finalizer;

COMMIT;
