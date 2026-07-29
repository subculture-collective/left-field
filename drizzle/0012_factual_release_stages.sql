BEGIN;

-- The launch verifier recomputes the complete seven-domain manifest. Migration
-- 0010 deliberately removed these tables from broad application roles; restore
-- only the same read surface already provisioned for release preflight.
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
      'GRANT SELECT ON TABLE public.%I TO dsa_seats_release_preflight,dsa_seats_launch_verifier',
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS preflight_fec_read ON public.%I',table_name);
    EXECUTE format(
      'CREATE POLICY preflight_fec_read ON public.%I FOR SELECT TO dsa_seats_release_preflight,dsa_seats_launch_verifier USING (true)',
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.release_launch_verifier_attestations
  DROP CONSTRAINT release_launch_verifier_attestations_kind_ck;
ALTER TABLE public.release_launch_verifier_attestations
  ADD CONSTRAINT release_launch_verifier_attestations_kind_ck
  CHECK(proof_kind IN('member','acs','finance','election','maps'));

ALTER FUNCTION public.assert_launch_stage(text,text,text)
  RENAME TO assert_launch_data_stage;

CREATE OR REPLACE FUNCTION public.assert_factual_launch_stage(
  p_target text,
  p_predecessor text,
  p_kind text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  target_member integer;
  predecessor_member integer;
  target_acs integer;
  predecessor_acs integer;
  inherited_nonfactual boolean;
  inherited_member boolean;
  inherited_acs boolean;
BEGIN
  IF p_kind NOT IN('member','acs') THEN
    RAISE EXCEPTION 'invalid factual launch stage kind' USING ERRCODE='22023';
  END IF;
  IF p_predecessor IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM public.data_releases target
      JOIN public.data_releases predecessor ON predecessor.id=target.previous_release_id
      WHERE target.id=p_target AND predecessor.id=p_predecessor
        AND target.source_cutoff=predecessor.source_cutoff
        AND to_char(target.source_cutoff AT TIME ZONE 'UTC','YYYY-MM-DD')='2026-07-18'
    )
  THEN
    RAISE EXCEPTION 'factual launch stage requires the exact fixed-cutoff predecessor'
      USING ERRCODE='23514';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.finance_publication_proofs WHERE release_id IN(p_target,p_predecessor)
    UNION ALL SELECT 1 FROM public.election_publication_proofs WHERE release_id IN(p_target,p_predecessor)
    UNION ALL SELECT 1 FROM public.fec_v2_publication_proofs WHERE release_id IN(p_target,p_predecessor)
    UNION ALL SELECT 1 FROM public.finance_launch_receipts WHERE release_id IN(p_target,p_predecessor)
    UNION ALL SELECT 1 FROM public.election_launch_receipts WHERE release_id IN(p_target,p_predecessor)
    UNION ALL SELECT 1 FROM public.map_artifacts WHERE release_id IN(p_target,p_predecessor)
  ) OR public.launch_has_finance_facts(p_target)
    OR public.launch_has_finance_facts(p_predecessor)
    OR public.launch_has_election_facts(p_target)
    OR public.launch_has_election_facts(p_predecessor)
  THEN
    RAISE EXCEPTION 'factual launch stage cannot contain or inherit launch facts or proofs'
      USING ERRCODE='23514';
  END IF;

  SELECT count(*)::int INTO target_member
    FROM public.biographical_facts WHERE release_id=p_target;
  SELECT count(*)::int INTO predecessor_member
    FROM public.biographical_facts WHERE release_id=p_predecessor;
  SELECT count(*)::int INTO target_acs
    FROM public.acs_observations WHERE release_id=p_target;
  SELECT count(*)::int INTO predecessor_acs
    FROM public.acs_observations WHERE release_id=p_predecessor;

  SELECT NOT EXISTS(
    SELECT 1
    FROM unnest(ARRAY['identity','geography','finance','elections','maps']::text[]) AS domains(domain_name)
    WHERE NOT EXISTS(
      SELECT 1 FROM public.release_content_digests target
      JOIN public.release_content_digests predecessor
        ON predecessor.release_id=p_predecessor
       AND predecessor.domain=domains.domain_name
      WHERE target.release_id=p_target
        AND target.domain=domains.domain_name
        AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
    )
  ) INTO inherited_nonfactual;
  SELECT EXISTS(
    SELECT 1 FROM public.release_content_digests target
    JOIN public.release_content_digests predecessor
      ON predecessor.release_id=p_predecessor AND predecessor.domain='member'
    WHERE target.release_id=p_target AND target.domain='member'
      AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
  ) INTO inherited_member;
  SELECT EXISTS(
    SELECT 1 FROM public.release_content_digests target
    JOIN public.release_content_digests predecessor
      ON predecessor.release_id=p_predecessor AND predecessor.domain='acs'
    WHERE target.release_id=p_target AND target.domain='acs'
      AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
  ) INTO inherited_acs;

  IF NOT inherited_nonfactual
    OR (
      p_kind='member'
      AND NOT (
        target_member>0 AND predecessor_member=0
        AND target_acs=0 AND predecessor_acs=0
        AND NOT inherited_member AND inherited_acs
      )
    )
    OR (
      p_kind='acs'
      AND NOT (
        target_member>0 AND target_member=predecessor_member
        AND target_acs>0 AND predecessor_acs=0
        AND inherited_member AND NOT inherited_acs
      )
    )
  THEN
    RAISE EXCEPTION 'invalid exact factual member or ACS launch stage'
      USING ERRCODE='23514';
  END IF;
END $$;

ALTER FUNCTION public.assert_factual_launch_stage(text,text,text)
  OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.assert_factual_launch_stage(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_launch_data_stage(text,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assert_launch_stage(
  p_target text,
  p_predecessor text,
  p_kind text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF p_kind IN('member','acs') THEN
    PERFORM public.assert_factual_launch_stage(p_target,p_predecessor,p_kind);
  ELSE
    PERFORM public.assert_launch_data_stage(p_target,p_predecessor,p_kind);
  END IF;
END $$;
ALTER FUNCTION public.assert_launch_stage(text,text,text)
  OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.assert_launch_stage(text,text,text) FROM PUBLIC;

ALTER FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)
  RENAME TO issue_launch_data_verifier_attestation;

CREATE OR REPLACE FUNCTION public.issue_launch_verifier_attestation(
  p_id text,
  p_operation text,
  p_target text,
  p_current text,
  p_predecessor text,
  p_kind text,
  p_canonical_sha256 text,
  p_ttl_seconds integer DEFAULT 300
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  issued timestamptz:=clock_timestamp();
  actual_sha text;
  operational_sha text;
  f record;
BEGIN
  IF p_kind NOT IN('member','acs') THEN
    PERFORM public.issue_launch_data_verifier_attestation(
      p_id,p_operation,p_target,p_current,p_predecessor,p_kind,p_canonical_sha256,p_ttl_seconds
    );
    RETURN;
  END IF;
  IF NOT pg_has_role(session_user,'dsa_seats_launch_verifier','member')
    OR pg_has_role(session_user,'dsa_seats_release_operator','member')
    OR pg_has_role(session_user,'dsa_seats_ingest','member')
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper)
  THEN
    RAISE EXCEPTION 'only exclusive launch verifier may attest publication evidence'
      USING ERRCODE='42501';
  END IF;
  IF p_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_operation NOT IN('promote','roll_forward')
    OR p_canonical_sha256 !~ '^[a-f0-9]{64}$'
    OR p_ttl_seconds NOT BETWEEN 1 AND 300
  THEN
    RAISE EXCEPTION 'invalid factual launch verifier attestation' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'));
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:'||p_target));
  PERFORM public.assert_preflight_branch(p_operation,p_target,p_current,p_predecessor);
  PERFORM public.assert_factual_launch_stage(p_target,p_predecessor,p_kind);
  SELECT content_checksum_sha256 INTO actual_sha
    FROM public.release_manifests WHERE release_id=p_target;
  IF actual_sha IS DISTINCT FROM p_canonical_sha256 THEN
    RAISE EXCEPTION 'factual launch attestation canonical hash mismatch'
      USING ERRCODE='23514';
  END IF;
  SELECT public.operational_evidence_fingerprint(p_target,p_predecessor)
    INTO operational_sha;
  SELECT * INTO f FROM public.release_preflight_fingerprint(p_target,NULL);
  IF EXISTS(
    SELECT 1 FROM public.release_launch_verifier_attestations
    WHERE consumed_at IS NULL AND expires_at>=issued
      AND (operation,target_release_id,current_release_id,predecessor_release_id)
        IS NOT DISTINCT FROM(p_operation,p_target,p_current,p_predecessor)
  ) THEN
    RAISE EXCEPTION 'a live launch verifier attestation already exists'
      USING ERRCODE='23505';
  END IF;
  INSERT INTO public.release_launch_verifier_attestations(
    id,operation,target_release_id,current_release_id,predecessor_release_id,
    proof_kind,canonical_sha256,run_ids_fingerprint,map_receipts_fingerprint,
    manifest_fingerprint,gate_fingerprint,digest_fingerprint,
    operational_evidence_fingerprint,issued_by,issued_at,expires_at,consumed_at
  ) VALUES(
    p_id,p_operation,p_target,p_current,p_predecessor,p_kind,actual_sha,
    f.run_ids_fingerprint,f.map_receipts_fingerprint,f.manifest_fingerprint,
    f.gate_fingerprint,f.digest_fingerprint,operational_sha,session_user,
    issued,issued+make_interval(secs=>p_ttl_seconds),NULL
  );
END $$;

ALTER FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)
  OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_launch_verifier_attestation(text,text,text,text,text,text,text,integer)
  TO dsa_seats_launch_verifier;
REVOKE ALL ON FUNCTION public.issue_launch_data_verifier_attestation(text,text,text,text,text,text,text,integer)
  FROM PUBLIC;

COMMIT;
