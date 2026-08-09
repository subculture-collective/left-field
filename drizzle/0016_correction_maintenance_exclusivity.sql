BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(hashtext('dsa_seats_correction_maintenance_exclusivity'));

CREATE OR REPLACE FUNCTION operations.assert_exclusive_correction_maintenance_v1()
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
    OR NOT pg_has_role(session_user,'dsa_seats_correction_maintenance','member') THEN
    RAISE EXCEPTION 'exclusive correction maintenance capability required' USING ERRCODE='42501';
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
     AND r.rolname<>'dsa_seats_correction_maintenance'
   ORDER BY r.rolname COLLATE "C"
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'exclusive correction maintenance capability required' USING ERRCODE='42501';
  END IF;
END $$;

ALTER FUNCTION operations.cleanup_correction_controls_v1()
  RENAME TO cleanup_correction_controls_legacy_v1;
REVOKE ALL ON FUNCTION operations.cleanup_correction_controls_legacy_v1()
  FROM PUBLIC,dsa_seats_correction_maintenance;

CREATE FUNCTION operations.cleanup_correction_controls_v1()
RETURNS TABLE(idempotency_deleted integer,rate_buckets_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,operations,pg_temp AS $$
BEGIN
  PERFORM operations.assert_exclusive_correction_maintenance_v1();
  RETURN QUERY SELECT * FROM operations.cleanup_correction_controls_legacy_v1();
END $$;

ALTER FUNCTION operations.assert_exclusive_correction_maintenance_v1()
  OWNER TO dsa_seats_migration_owner;
ALTER FUNCTION operations.cleanup_correction_controls_v1()
  OWNER TO dsa_seats_migration_owner;

REVOKE ALL ON FUNCTION operations.assert_exclusive_correction_maintenance_v1()
  FROM PUBLIC,dsa_seats_correction_maintenance;
REVOKE ALL ON FUNCTION operations.cleanup_correction_controls_v1()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.cleanup_correction_controls_v1()
  TO dsa_seats_correction_maintenance;

COMMIT;
