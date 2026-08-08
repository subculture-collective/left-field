BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(hashtext('dsa_seats_correction_reviewer_exclusivity'));

CREATE OR REPLACE FUNCTION operations.assert_exclusive_correction_reviewer_v1()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,operations,pg_temp AS $$
DECLARE unsafe_login boolean; bad text;
BEGIN
  SELECT rolsuper OR rolinherit IS FALSE OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls
    INTO unsafe_login FROM pg_roles WHERE rolname=session_user;
  IF coalesce(unsafe_login,true)
    OR NOT pg_has_role(session_user,'dsa_seats_correction_reviewer','member') THEN
    RAISE EXCEPTION 'exclusive correction reviewer capability required' USING ERRCODE='42501';
  END IF;
  WITH RECURSIVE memberships(role_oid) AS (
    SELECT roleid FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user)
    UNION
    SELECT membership.roleid
      FROM pg_auth_members membership
      JOIN memberships prior ON membership.member=prior.role_oid
  )
  SELECT r.rolname INTO bad
    FROM memberships membership
    JOIN pg_roles r ON r.oid=membership.role_oid
   WHERE r.rolname LIKE 'dsa_seats_%'
     AND r.rolname<>'dsa_seats_correction_reviewer'
   ORDER BY r.rolname COLLATE "C"
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'exclusive correction reviewer capability required' USING ERRCODE='42501';
  END IF;
END $$;

ALTER FUNCTION operations.transition_correction_v1(uuid,integer,text,text,text,text,text)
  RENAME TO transition_correction_legacy_v1;
ALTER FUNCTION operations.list_corrections_v1(timestamptz,uuid,integer)
  RENAME TO list_corrections_legacy_v1;

REVOKE ALL ON FUNCTION operations.transition_correction_legacy_v1(uuid,integer,text,text,text,text,text)
  FROM PUBLIC,dsa_seats_correction_reviewer;
REVOKE ALL ON FUNCTION operations.list_corrections_legacy_v1(timestamptz,uuid,integer)
  FROM PUBLIC,dsa_seats_correction_reviewer;

CREATE FUNCTION operations.transition_correction_v1(
  p_correction_id uuid,
  p_expected_sequence integer,
  p_expected_status text,
  p_to_status text,
  p_reason_code text,
  p_candidate_release_id text,
  p_approved_snapshot_id text
) RETURNS TABLE(outcome text,sequence integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,operations,pg_temp AS $$
BEGIN
  PERFORM operations.assert_exclusive_correction_reviewer_v1();
  RETURN QUERY SELECT * FROM operations.transition_correction_legacy_v1(
    p_correction_id,p_expected_sequence,p_expected_status,p_to_status,
    p_reason_code,p_candidate_release_id,p_approved_snapshot_id
  );
END $$;

CREATE FUNCTION operations.list_corrections_v1(
  p_after_submitted_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
) RETURNS TABLE(
  id uuid,release_id text,seat_cycle_id text,field_path text,explanation text,
  source_url text,submitted_at timestamptz,status text,sequence integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,operations,pg_temp AS $$
BEGIN
  PERFORM operations.assert_exclusive_correction_reviewer_v1();
  RETURN QUERY SELECT * FROM operations.list_corrections_legacy_v1(
    p_after_submitted_at,p_after_id,p_limit
  );
END $$;

ALTER FUNCTION operations.assert_exclusive_correction_reviewer_v1()
  OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION operations.transition_correction_v1(uuid,integer,text,text,text,text,text)
  OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION operations.list_corrections_v1(timestamptz,uuid,integer)
  OWNER TO dsa_seats_migration_owner;

REVOKE ALL ON FUNCTION operations.assert_exclusive_correction_reviewer_v1()
  FROM PUBLIC,dsa_seats_correction_reviewer;
REVOKE ALL ON FUNCTION operations.transition_correction_v1(uuid,integer,text,text,text,text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION operations.list_corrections_v1(timestamptz,uuid,integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.transition_correction_v1(uuid,integer,text,text,text,text,text)
  TO dsa_seats_correction_reviewer;
GRANT EXECUTE ON FUNCTION operations.list_corrections_v1(timestamptz,uuid,integer)
  TO dsa_seats_correction_reviewer;

COMMIT;
