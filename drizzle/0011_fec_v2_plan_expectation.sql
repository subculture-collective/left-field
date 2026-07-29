CREATE OR REPLACE FUNCTION public.read_fec_v2_plan_expectation(p_release text,p_plan text)
RETURNS TABLE(source_lock_sha256 text,seat_cycle_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_fec_v2_replay_verifier_admission();
  IF NOT EXISTS (SELECT 1 FROM public.data_releases d JOIN public.fec_v2_plans p ON p.release_id=d.id WHERE d.id=p_release AND d.status='candidate' AND p.plan_sha256=p_plan AND p.sealed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'candidate sealed plan required' USING ERRCODE='55000';
  END IF;
  RETURN QUERY SELECT p.source_lock_sha256,t.seat_cycle_id FROM public.fec_v2_plans p JOIN public.fec_v2_plan_targets t ON t.release_id=p.release_id AND t.plan_sha256=p.plan_sha256 WHERE p.release_id=p_release AND p.plan_sha256=p_plan ORDER BY t.seat_cycle_id COLLATE "C";
END $$;
REVOKE ALL ON FUNCTION public.read_fec_v2_plan_expectation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_fec_v2_plan_expectation(text,text) TO dsa_seats_fec_v2_replay_verifier;
ALTER FUNCTION public.read_fec_v2_plan_expectation(text,text) OWNER TO dsa_seats_migration_owner;
