BEGIN;

-- ACS adds one official source and three immutable receipts to the global
-- provenance catalog. Because sources/source_snapshots intentionally
-- participate in every domain digest, ordinary digest equality cannot prove
-- that the non-ACS facts were inherited. Prove that stronger property directly:
-- every non-ACS content row is byte-identical, every predecessor source and
-- snapshot is preserved, and the only catalog additions are the exact ACS
-- source plus its three loaded receipts.
CREATE OR REPLACE FUNCTION public.assert_acs_inherited_content(
  p_target text,
  p_predecessor text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  table_name text;
  mismatch boolean;
  valid boolean;
BEGIN
  IF p_target IS NULL OR p_predecessor IS NULL OR p_target=p_predecessor THEN
    RAISE EXCEPTION 'ACS inheritance requires distinct target and predecessor'
      USING ERRCODE='22023';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'district_plans','geometry_artifacts','geography_versions','jurisdictions',
    'offices','people','office_terms','memberships','seat_cycles',
    'release_profile_seats','biographical_facts',
    'biographical_fact_provenance','committees','committee_assignments',
    'committee_assignment_provenance','contests','candidacies','result_options',
    'election_results','contest_lineage','election_result_lineage',
    'committee_relationships','fec_filing_summaries','fec_filing_lineage',
    'seat_finance_summaries','seat_finance_summary_lineage',
    'finance_aggregates','finance_aggregate_inputs','funding_category_aggregates',
    'funding_category_input_snapshots','funding_organization_aggregates',
    'funding_organization_input_snapshots','outside_spending_aggregates',
    'outside_spending_input_snapshots','election_decisions',
    'election_decision_inputs','map_artifacts','map_artifact_receipts',
    'map_artifact_inputs','snapshot_derivations','snapshot_derivation_inputs',
    'provenance','finance_launch_receipts','finance_deletion_attestations',
    'finance_candidate_mappings','finance_committee_mappings',
    'finance_page_closures','finance_amendment_closures','vacancy_reviews',
    'finance_terminal_dispositions','finance_coverage_closures','fec_v2_plans',
    'finance_proof_routes','fec_v2_plan_targets','fec_v2_snapshot_metadata',
    'fec_v2_artifacts','fec_v2_artifact_receipts','fec_v2_enumeration_pages',
    'fec_v2_filing_ledgers','fec_v2_filing_ledger_entries',
    'fec_v2_page_lineage','fec_v2_amendment_chain_links',
    'fec_v2_sanitized_filings','fec_v2_alternate_scoping',
    'fec_v2_acquisition_outcomes','fec_v2_acquisition_receipts',
    'fec_v2_acquisition_seals','fec_v2_candidate_mappings',
    'fec_v2_committee_mappings','fec_v2_election_mappings',
    'fec_v2_finance_closures','fec_v2_closure_input_receipts',
    'fec_v2_closure_input_snapshots','fec_v2_seat_coverage',
    'fec_v2_exact_election_aggregates','fec_v2_data_review_signatures',
    'election_launch_receipts','election_inventory_rows',
    'election_geometry_attestations','election_authority_artifacts',
    'election_result_envelopes','election_result_rows',
    'election_result_receipt_lineage'
  ]
  LOOP
    EXECUTE format(
      'SELECT EXISTS(
         (SELECT to_jsonb(t)-''release_id'' FROM public.%1$I t WHERE release_id=$1
          EXCEPT
          SELECT to_jsonb(p)-''release_id'' FROM public.%1$I p WHERE release_id=$2)
         UNION ALL
         (SELECT to_jsonb(p)-''release_id'' FROM public.%1$I p WHERE release_id=$2
          EXCEPT
          SELECT to_jsonb(t)-''release_id'' FROM public.%1$I t WHERE release_id=$1)
       )',
      table_name
    ) INTO mismatch USING p_target,p_predecessor;
    IF mismatch THEN
      RAISE EXCEPTION 'ACS target changed inherited table %',table_name
        USING ERRCODE='23514';
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'coverage_records','coverage_missing_reasons','coverage_input_snapshots'
  ]
  LOOP
    EXECUTE format(
      'SELECT EXISTS(
         (SELECT to_jsonb(t)-''release_id'' FROM public.%1$I t
           WHERE release_id=$1 AND domain<>''acs''
          EXCEPT
          SELECT to_jsonb(p)-''release_id'' FROM public.%1$I p
           WHERE release_id=$2 AND domain<>''acs'')
         UNION ALL
         (SELECT to_jsonb(p)-''release_id'' FROM public.%1$I p
           WHERE release_id=$2 AND domain<>''acs''
          EXCEPT
          SELECT to_jsonb(t)-''release_id'' FROM public.%1$I t
           WHERE release_id=$1 AND domain<>''acs'')
       )',
      table_name
    ) INTO mismatch USING p_target,p_predecessor;
    IF mismatch THEN
      RAISE EXCEPTION 'ACS target changed inherited coverage table %',table_name
        USING ERRCODE='23514';
    END IF;
  END LOOP;

  SELECT
    NOT EXISTS(
      SELECT to_jsonb(p)-'release_id' FROM public.sources p
       WHERE p.release_id=p_predecessor
      EXCEPT
      SELECT to_jsonb(t)-'release_id' FROM public.sources t
       WHERE t.release_id=p_target
    )
    AND (
      SELECT count(*)=1
        AND bool_and(
          t.id='src_acs_2024' AND t.name='acs' AND t.authority='official'
          AND t.homepage_url='https://www.census.gov/programs-surveys/acs.html'
        )
      FROM public.sources t
      WHERE t.release_id=p_target
        AND NOT EXISTS(
          SELECT 1 FROM public.sources p
           WHERE p.release_id=p_predecessor
             AND (to_jsonb(p)-'release_id')=(to_jsonb(t)-'release_id')
        )
    )
  INTO valid;
  IF NOT coalesce(valid,false) THEN
    RAISE EXCEPTION 'ACS target source catalog is not an exact additive successor'
      USING ERRCODE='23514';
  END IF;

  SELECT
    NOT EXISTS(
      SELECT to_jsonb(p)-'release_id' FROM public.source_snapshots p
       WHERE p.release_id=p_predecessor
      EXCEPT
      SELECT to_jsonb(t)-'release_id' FROM public.source_snapshots t
       WHERE t.release_id=p_target
    )
    AND (
      SELECT count(*)=3
        AND count(DISTINCT ir.id)=3
        AND bool_and(
          t.source_id='src_acs_2024'
          AND t.source_url IN(
            'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01002.dat',
            'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01003.dat',
            'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b19013.dat'
          )
          AND t.published_at IS NULL
          AND t.license='public-domain'
          AND t.usage_status='approved'
          AND ir.status='loaded'
          AND ir.upstream_release='acs-2024-5yr'
          AND ir.raw_object_sha256=t.checksum_sha256
          AND ir.raw_object_version_id IS NOT NULL
          AND ir.extracted_count=437
          AND ir.staged_count=437
          AND ir.quarantined_count=0
        )
      FROM public.source_snapshots t
      JOIN public.ingest_runs ir
        ON ir.release_id=t.release_id AND ir.snapshot_id=t.id
      WHERE t.release_id=p_target
        AND NOT EXISTS(
          SELECT 1 FROM public.source_snapshots p
           WHERE p.release_id=p_predecessor
             AND (to_jsonb(p)-'release_id')=(to_jsonb(t)-'release_id')
        )
    )
  INTO valid;
  IF NOT coalesce(valid,false) THEN
    RAISE EXCEPTION 'ACS target snapshot catalog is not an exact three-receipt successor'
      USING ERRCODE='23514';
  END IF;
END $$;

ALTER FUNCTION public.assert_acs_inherited_content(text,text)
  OWNER TO dsa_seats_migration_owner;
REVOKE ALL ON FUNCTION public.assert_acs_inherited_content(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_acs_inherited_content(text,text)
  TO dsa_seats_ingest,dsa_seats_release_preflight,dsa_seats_launch_verifier,
     dsa_seats_nationwide_finalizer;

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

  IF p_kind='acs' THEN
    PERFORM public.assert_acs_inherited_content(p_target,p_predecessor);
  END IF;

  IF (
      p_kind='member'
      AND NOT (
        inherited_nonfactual
        AND target_member>0 AND predecessor_member=0
        AND target_acs=0 AND predecessor_acs=0
        AND NOT inherited_member AND inherited_acs
      )
    )
    OR (
      p_kind='acs'
      AND NOT (
        target_member>0 AND target_member=predecessor_member
        AND target_acs>0 AND predecessor_acs=0
        AND NOT inherited_acs
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

COMMIT;
