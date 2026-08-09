\set ON_ERROR_STOP on

SELECT format(
  'CREATE ROLE dsa_seats_web_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'web_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_web_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_ingest_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'ingest_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_ingest_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_preflight_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'preflight_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_preflight_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_operator_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'operator_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_operator_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_launch_verifier_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'launch_verifier_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_launch_verifier_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_nationwide_finalizer_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'nationwide_finalizer_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_nationwide_finalizer_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_fec_v2_acquisition_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'fec_v2_acquisition_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_fec_v2_acquisition_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_fec_v2_replay_verifier_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'fec_v2_replay_verifier_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_fec_v2_replay_verifier_login') \gexec
SELECT format(
  'CREATE ROLE dsa_seats_correction_reviewer_login LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION PASSWORD %L',
  :'correction_reviewer_password'
) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsa_seats_correction_reviewer_login') \gexec

ALTER ROLE dsa_seats_web_login PASSWORD :'web_password';
ALTER ROLE dsa_seats_ingest_login PASSWORD :'ingest_password';
ALTER ROLE dsa_seats_preflight_login PASSWORD :'preflight_password';
ALTER ROLE dsa_seats_operator_login PASSWORD :'operator_password';
ALTER ROLE dsa_seats_launch_verifier_login PASSWORD :'launch_verifier_password';
ALTER ROLE dsa_seats_nationwide_finalizer_login PASSWORD :'nationwide_finalizer_password';
ALTER ROLE dsa_seats_fec_v2_acquisition_login PASSWORD :'fec_v2_acquisition_password';
ALTER ROLE dsa_seats_fec_v2_replay_verifier_login PASSWORD :'fec_v2_replay_verifier_password';
ALTER ROLE dsa_seats_correction_reviewer_login PASSWORD :'correction_reviewer_password';
ALTER ROLE dsa_seats_web_login INHERIT;
ALTER ROLE dsa_seats_ingest_login INHERIT;
ALTER ROLE dsa_seats_preflight_login INHERIT;
ALTER ROLE dsa_seats_operator_login INHERIT;
ALTER ROLE dsa_seats_launch_verifier_login INHERIT;
ALTER ROLE dsa_seats_nationwide_finalizer_login INHERIT;
ALTER ROLE dsa_seats_fec_v2_acquisition_login INHERIT;
ALTER ROLE dsa_seats_fec_v2_replay_verifier_login INHERIT;
ALTER ROLE dsa_seats_correction_reviewer_login NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;

GRANT dsa_seats_web TO dsa_seats_web_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_ingest TO dsa_seats_ingest_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_release_preflight TO dsa_seats_preflight_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_release_operator TO dsa_seats_operator_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_launch_verifier TO dsa_seats_launch_verifier_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_nationwide_finalizer TO dsa_seats_nationwide_finalizer_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_fec_v2_acquisition TO dsa_seats_fec_v2_acquisition_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_fec_v2_replay_verifier TO dsa_seats_fec_v2_replay_verifier_login WITH INHERIT TRUE, SET TRUE;
GRANT dsa_seats_correction_reviewer TO dsa_seats_correction_reviewer_login WITH INHERIT TRUE, SET TRUE;

ALTER ROLE dsa_seats_web_login SET statement_timeout = '15s';
ALTER ROLE dsa_seats_web_login SET lock_timeout = '1s';
ALTER ROLE dsa_seats_ingest_login SET statement_timeout = '15s';
ALTER ROLE dsa_seats_ingest_login SET lock_timeout = '1s';
ALTER ROLE dsa_seats_fec_v2_acquisition_login SET statement_timeout = '5min';
ALTER ROLE dsa_seats_fec_v2_acquisition_login SET lock_timeout = '5s';
ALTER ROLE dsa_seats_fec_v2_replay_verifier_login SET statement_timeout = '5min';
ALTER ROLE dsa_seats_fec_v2_replay_verifier_login SET lock_timeout = '5s';
ALTER ROLE dsa_seats_correction_reviewer_login SET statement_timeout = '15s';
ALTER ROLE dsa_seats_correction_reviewer_login SET lock_timeout = '2s';

-- Migration 0010 isolates FEC acquisition capabilities from ordinary
-- application roles. Release preflight still needs read-only access to the
-- clone-stable FEC content registry in order to recompute the finance digest.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'fec_v2_plans',
    'finance_proof_routes',
    'fec_v2_plan_targets',
    'fec_v2_snapshot_metadata',
    'fec_v2_artifacts',
    'fec_v2_artifact_receipts',
    'fec_v2_enumeration_pages',
    'fec_v2_filing_ledgers',
    'fec_v2_filing_ledger_entries',
    'fec_v2_page_lineage',
    'fec_v2_amendment_chain_links',
    'fec_v2_sanitized_filings',
    'fec_v2_alternate_scoping',
    'fec_v2_acquisition_outcomes',
    'fec_v2_acquisition_receipts',
    'fec_v2_acquisition_seals',
    'fec_v2_candidate_mappings',
    'fec_v2_committee_mappings',
    'fec_v2_election_mappings',
    'fec_v2_finance_closures',
    'fec_v2_closure_input_receipts',
    'fec_v2_closure_input_snapshots',
    'fec_v2_seat_coverage',
    'fec_v2_exact_election_aggregates',
    'fec_v2_data_review_signatures'
  ]
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO dsa_seats_release_preflight', table_name);
    EXECUTE format('DROP POLICY IF EXISTS preflight_fec_read ON public.%I', table_name);
    EXECUTE format('CREATE POLICY preflight_fec_read ON public.%I FOR SELECT TO dsa_seats_release_preflight USING (true)', table_name);
  END LOOP;
END $$;
