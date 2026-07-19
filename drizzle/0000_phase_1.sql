CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TYPE release_status AS ENUM ('candidate','published','retired');
CREATE TYPE missing_reason AS ENUM ('not_applicable','not_collected','not_reported','not_yet_reported','suppressed','unmatched','source_unavailable','not_defensibly_modeled');
CREATE TYPE fact_status AS ENUM ('certified','official','reported','modeled','estimated','superseded');
CREATE TYPE geography_kind AS ENUM ('house_district','state');
CREATE TYPE provenance_role AS ENUM ('original_publisher','intermediary','geometry_source','derived_input');

CREATE TABLE data_releases (id text PRIMARY KEY, label text NOT NULL, status release_status NOT NULL, source_cutoff timestamptz NOT NULL, created_at timestamptz NOT NULL, published_at timestamptz, previous_release_id text REFERENCES data_releases(id), CHECK ((status = 'candidate' AND published_at IS NULL) OR (status IN ('published','retired') AND published_at IS NOT NULL)));
CREATE UNIQUE INDEX one_published_release ON data_releases (status) WHERE status = 'published';
CREATE TABLE sources (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, name text NOT NULL, authority text NOT NULL CHECK (authority IN ('official','derived','editorial')), homepage_url text NOT NULL, PRIMARY KEY(release_id,id), UNIQUE(release_id,name));
CREATE TABLE source_snapshots (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, source_id text NOT NULL, source_url text NOT NULL, published_at timestamptz, retrieved_at timestamptz NOT NULL, checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'), parser_version text NOT NULL, license text NOT NULL, usage_status text NOT NULL CHECK (usage_status IN ('approved','restricted','review_required')), PRIMARY KEY(release_id,id), FOREIGN KEY(release_id,source_id) REFERENCES sources(release_id,id));
CREATE TABLE district_plans (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, name text NOT NULL, congress integer NOT NULL CHECK(congress>0), enacted_at date, effective_from date NOT NULL, effective_to date, jurisdiction_state_code text NOT NULL CHECK(jurisdiction_state_code ~ '^[A-Z]{2}$'), PRIMARY KEY(release_id,id), UNIQUE(release_id,jurisdiction_state_code,congress,name), CHECK(effective_to IS NULL OR effective_to >= effective_from));
CREATE TABLE geometry_artifacts (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, snapshot_id text NOT NULL, object_key text NOT NULL, format text NOT NULL CHECK(format IN ('geojson','shapefile','geopackage')), srid integer NOT NULL CHECK(srid=4326), checksum_sha256 text NOT NULL CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'), PRIMARY KEY(release_id,id), UNIQUE(release_id,object_key), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE geography_versions (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, kind geography_kind NOT NULL, district_plan_id text, geometry_artifact_id text NOT NULL, source_geoid text NOT NULL, label text NOT NULL, vintage text NOT NULL, state_code text NOT NULL CHECK(state_code ~ '^[A-Z]{2}$'), district_code text, boundary geometry(MultiPolygon,4326) NOT NULL, boundary_checksum_sha256 text NOT NULL CHECK(boundary_checksum_sha256 ~ '^[a-f0-9]{64}$'), PRIMARY KEY(release_id,id), UNIQUE(release_id,kind,source_geoid,vintage), FOREIGN KEY(release_id,district_plan_id) REFERENCES district_plans(release_id,id), FOREIGN KEY(release_id,geometry_artifact_id) REFERENCES geometry_artifacts(release_id,id), CHECK((kind='house_district' AND district_plan_id IS NOT NULL AND district_code ~ '^(AL|[0-9]{2})$') OR (kind='state' AND district_plan_id IS NULL AND district_code IS NULL)), CHECK(ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary)));
CREATE INDEX geography_versions_boundary_gist ON geography_versions USING gist(boundary);
CREATE TABLE offices (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, chamber text NOT NULL CHECK(chamber IN ('house','senate')), kind text NOT NULL CHECK(kind IN ('house_voting','house_delegate','resident_commissioner','senate')), state_code text NOT NULL CHECK(state_code ~ '^[A-Z]{2}$'), district_code text, senate_class integer, PRIMARY KEY(release_id,id), UNIQUE NULLS NOT DISTINCT(release_id,chamber,state_code,district_code,senate_class), CHECK((chamber='senate' AND kind='senate' AND district_code IS NULL AND senate_class BETWEEN 1 AND 3) OR (chamber='house' AND kind IN ('house_voting','house_delegate','resident_commissioner') AND district_code ~ '^(AL|[0-9]{2})$' AND senate_class IS NULL)));
CREATE TABLE people (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, display_name text NOT NULL, birth_date date, bioguide_id text, PRIMARY KEY(release_id,id));
CREATE UNIQUE INDEX people_bioguide_uq ON people(release_id,bioguide_id) WHERE bioguide_id IS NOT NULL;
CREATE TABLE office_terms (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, office_id text NOT NULL, starts_at date NOT NULL, ends_at date NOT NULL, PRIMARY KEY(release_id,id), UNIQUE(release_id,office_id,starts_at,ends_at), FOREIGN KEY(release_id,office_id) REFERENCES offices(release_id,id), CHECK(ends_at>starts_at));
CREATE TABLE memberships (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, office_term_id text NOT NULL, person_id text NOT NULL, party text NOT NULL CHECK(party IN ('democratic','republican','independent','other')), starts_at date NOT NULL, ends_at date, PRIMARY KEY(release_id,id), FOREIGN KEY(release_id,office_term_id) REFERENCES office_terms(release_id,id), FOREIGN KEY(release_id,person_id) REFERENCES people(release_id,id), CHECK(ends_at IS NULL OR ends_at>starts_at));
CREATE TABLE seat_cycles (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, office_id text NOT NULL, office_term_id text NOT NULL, geography_version_id text NOT NULL, cycle_year integer NOT NULL CHECK(cycle_year BETWEEN 1788 AND 2200), election_date date, election_kind text NOT NULL CHECK(election_kind IN ('regular','special')), incumbency_status text NOT NULL CHECK(incumbency_status IN ('incumbent_running','incumbent_not_running','open','unknown')), occupancy_status text NOT NULL CHECK(occupancy_status IN ('occupied','vacant','unknown')), occupancy_as_of date NOT NULL, PRIMARY KEY(release_id,id), UNIQUE(release_id,office_id,cycle_year,election_kind), FOREIGN KEY(release_id,office_id) REFERENCES offices(release_id,id), FOREIGN KEY(release_id,office_term_id) REFERENCES office_terms(release_id,id), FOREIGN KEY(release_id,geography_version_id) REFERENCES geography_versions(release_id,id));
CREATE TABLE contests (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, seat_cycle_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('president_general','house_general','senate_general','democratic_presidential_primary')), round text NOT NULL CHECK(round IN ('primary','runoff','general')), election_date date NOT NULL, geography_version_id text NOT NULL, certification_status text NOT NULL CONSTRAINT contests_certification_status_ck CHECK(certification_status IN ('certified','official_unfinalized','unofficial','modeled','unavailable')), reporting_completeness_percent numeric NOT NULL CHECK(reporting_completeness_percent BETWEEN 0 AND 100), denominator_votes numeric, denominator_missing_reason missing_reason, reporting_unit text NOT NULL CHECK(reporting_unit IN ('district','precinct','county','state','mixed')), allocation_method text NOT NULL CHECK(allocation_method IN ('none','precinct_overlay','population_crosswalk','other')), allocation_coverage_percent numeric, allocation_coverage_missing_reason missing_reason, lineage_as_of date NOT NULL, lineage_methodology text NOT NULL, lineage_status fact_status NOT NULL, PRIMARY KEY(release_id,id), FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), FOREIGN KEY(release_id,geography_version_id) REFERENCES geography_versions(release_id,id), CHECK((denominator_votes IS NULL) <> (denominator_missing_reason IS NULL)), CHECK((allocation_coverage_percent IS NULL) <> (allocation_coverage_missing_reason IS NULL)));
CREATE TABLE candidacies (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, contest_id text NOT NULL, person_id text, party text NOT NULL CHECK(party IN ('democratic','republican','independent','other')), status text NOT NULL CHECK(status IN ('filed','qualified','withdrawn','nominee','write_in')), PRIMARY KEY(release_id,id), UNIQUE(release_id,id,contest_id), FOREIGN KEY(release_id,contest_id) REFERENCES contests(release_id,id), FOREIGN KEY(release_id,person_id) REFERENCES people(release_id,id));
CREATE TABLE result_options (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, contest_id text NOT NULL, candidacy_id text, label text NOT NULL, party text CHECK(party IN ('democratic','republican','independent','other')), option_kind text NOT NULL CHECK(option_kind IN ('candidate','write_in_total','other')), PRIMARY KEY(release_id,id), UNIQUE(release_id,contest_id,id), FOREIGN KEY(release_id,contest_id) REFERENCES contests(release_id,id), FOREIGN KEY(release_id,candidacy_id,contest_id) REFERENCES candidacies(release_id,id,contest_id));
CREATE TABLE election_results (release_id text NOT NULL REFERENCES data_releases(id), contest_id text NOT NULL, result_option_id text NOT NULL, votes numeric, votes_missing_reason missing_reason, lineage_as_of date NOT NULL, lineage_methodology text NOT NULL, lineage_status fact_status NOT NULL, PRIMARY KEY(release_id,contest_id,result_option_id), FOREIGN KEY(release_id,contest_id) REFERENCES contests(release_id,id), FOREIGN KEY(release_id,result_option_id,contest_id) REFERENCES result_options(release_id,id,contest_id), CHECK((votes IS NULL) <> (votes_missing_reason IS NULL)));
CREATE TABLE acs_observations (release_id text NOT NULL REFERENCES data_releases(id), geography_version_id text NOT NULL, variable text NOT NULL, label text NOT NULL, estimate numeric, estimate_missing_reason missing_reason, margin_of_error numeric, margin_of_error_missing_reason missing_reason, unit text NOT NULL CHECK(unit IN ('count','percent','usd')), survey_period text NOT NULL, universe text NOT NULL, lineage_as_of date NOT NULL, lineage_methodology text NOT NULL, lineage_status fact_status NOT NULL, PRIMARY KEY(release_id,geography_version_id,variable,survey_period), FOREIGN KEY(release_id,geography_version_id) REFERENCES geography_versions(release_id,id), CHECK((estimate IS NULL) <> (estimate_missing_reason IS NULL)), CHECK((margin_of_error IS NULL) <> (margin_of_error_missing_reason IS NULL)));
CREATE TABLE committees (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, source_committee_id text NOT NULL, name text NOT NULL, committee_type text NOT NULL, PRIMARY KEY(release_id,id), UNIQUE(release_id,source_committee_id));
CREATE TABLE committee_relationships (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, committee_id text NOT NULL, candidacy_id text NOT NULL, relationship text NOT NULL CHECK(relationship IN ('principal_campaign_committee','authorized')), effective_from date NOT NULL, effective_to date, PRIMARY KEY(release_id,id), FOREIGN KEY(release_id,committee_id) REFERENCES committees(release_id,id), FOREIGN KEY(release_id,candidacy_id) REFERENCES candidacies(release_id,id), CHECK(effective_to IS NULL OR effective_to>effective_from));
CREATE TABLE fec_filing_summaries (release_id text NOT NULL REFERENCES data_releases(id), id text NOT NULL, seat_cycle_id text NOT NULL, committee_id text NOT NULL, source_filing_id text NOT NULL, report_type text NOT NULL, reporting_period_start date NOT NULL, reporting_period_end date NOT NULL, filed_at timestamptz NOT NULL, amendment_number integer NOT NULL CHECK(amendment_number>=0), amendment_status text NOT NULL CHECK(amendment_status IN ('new','amended','superseded')), amends_filing_id text, cash_on_hand numeric, cash_on_hand_missing_reason missing_reason, total_receipts numeric, total_receipts_missing_reason missing_reason, total_disbursements numeric, total_disbursements_missing_reason missing_reason, lineage_as_of date NOT NULL, lineage_methodology text NOT NULL, lineage_status fact_status NOT NULL, PRIMARY KEY(release_id,id), UNIQUE(release_id,source_filing_id), UNIQUE(release_id,id,seat_cycle_id), UNIQUE(release_id,seat_cycle_id,committee_id,report_type,reporting_period_start,reporting_period_end,amendment_number), FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), FOREIGN KEY(release_id,committee_id) REFERENCES committees(release_id,id), FOREIGN KEY(release_id,amends_filing_id) REFERENCES fec_filing_summaries(release_id,id), CHECK(reporting_period_end>=reporting_period_start), CHECK((cash_on_hand IS NULL) <> (cash_on_hand_missing_reason IS NULL)), CHECK((total_receipts IS NULL) <> (total_receipts_missing_reason IS NULL)), CHECK((total_disbursements IS NULL) <> (total_disbursements_missing_reason IS NULL)), CHECK((amendment_number = 0) = (amends_filing_id IS NULL)));
CREATE TABLE seat_finance_summaries (release_id text NOT NULL REFERENCES data_releases(id), seat_cycle_id text NOT NULL, filing_id text, missing_reason missing_reason, as_of date, PRIMARY KEY(release_id,seat_cycle_id), FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id), FOREIGN KEY(release_id,filing_id,seat_cycle_id) REFERENCES fec_filing_summaries(release_id,id,seat_cycle_id), CHECK((filing_id IS NULL) <> (missing_reason IS NULL)), CHECK((filing_id IS NOT NULL) = (as_of IS NULL)));
CREATE TABLE provenance (release_id text NOT NULL REFERENCES data_releases(id), entity_type text NOT NULL, entity_id text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,entity_type,entity_id,snapshot_id,role), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));

-- An amendment is a single linear chain within a release: no branching and no cycles.
CREATE UNIQUE INDEX fec_filings_one_successor_uq ON fec_filing_summaries(release_id, amends_filing_id) WHERE amends_filing_id IS NOT NULL;
CREATE FUNCTION guard_fec_amendment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE predecessor fec_filing_summaries%ROWTYPE;
BEGIN
  -- A predecessor's chain-defining fields cannot change after a successor exists.
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM fec_filing_summaries successor WHERE successor.release_id=OLD.release_id AND successor.amends_filing_id=OLD.id)
     AND (NEW.seat_cycle_id,NEW.committee_id,NEW.report_type,NEW.reporting_period_start,NEW.reporting_period_end,NEW.amendment_number,NEW.filed_at)
         IS DISTINCT FROM (OLD.seat_cycle_id,OLD.committee_id,OLD.report_type,OLD.reporting_period_start,OLD.reporting_period_end,OLD.amendment_number,OLD.filed_at) THEN
    RAISE EXCEPTION 'FEC predecessor fields are immutable once referenced by a successor' USING ERRCODE = '23514';
  END IF;
  IF NEW.amends_filing_id IS NOT NULL THEN
    SELECT * INTO predecessor FROM fec_filing_summaries WHERE release_id = NEW.release_id AND id = NEW.amends_filing_id;
    IF NOT FOUND OR predecessor.seat_cycle_id <> NEW.seat_cycle_id OR predecessor.committee_id <> NEW.committee_id
      OR predecessor.report_type <> NEW.report_type OR predecessor.reporting_period_start <> NEW.reporting_period_start
      OR predecessor.reporting_period_end <> NEW.reporting_period_end OR predecessor.amendment_number <> NEW.amendment_number - 1
      OR predecessor.filed_at >= NEW.filed_at THEN
      RAISE EXCEPTION 'FEC amendment must immediately follow an earlier filing in the same release, seat, committee, report, and period' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.amends_filing_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE chain(id) AS (
      SELECT NEW.amends_filing_id
      UNION ALL
      SELECT f.amends_filing_id FROM fec_filing_summaries f JOIN chain c ON f.id = c.id
      WHERE f.release_id = NEW.release_id AND f.amends_filing_id IS NOT NULL
    ) SELECT 1 FROM chain WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'FEC amendment chain cannot be cyclic' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fec_amendment_guard BEFORE INSERT OR UPDATE OF amends_filing_id, seat_cycle_id, committee_id, report_type, reporting_period_start, reporting_period_end, amendment_number, filed_at ON fec_filing_summaries FOR EACH ROW EXECUTE FUNCTION guard_fec_amendment();

-- Explicit FK indexes keep release-scoped joins and deletes predictable.
CREATE INDEX data_releases_previous_release_fk_idx ON data_releases(previous_release_id);
CREATE INDEX source_snapshots_source_fk_idx ON source_snapshots(release_id,source_id);
CREATE INDEX geometry_artifacts_snapshot_fk_idx ON geometry_artifacts(release_id,snapshot_id);
CREATE INDEX geography_versions_plan_fk_idx ON geography_versions(release_id,district_plan_id);
CREATE INDEX geography_versions_artifact_fk_idx ON geography_versions(release_id,geometry_artifact_id);
CREATE INDEX office_terms_office_fk_idx ON office_terms(release_id,office_id);
CREATE INDEX memberships_term_fk_idx ON memberships(release_id,office_term_id);
CREATE INDEX memberships_person_fk_idx ON memberships(release_id,person_id);
CREATE INDEX seat_cycles_office_fk_idx ON seat_cycles(release_id,office_id);
CREATE INDEX seat_cycles_term_fk_idx ON seat_cycles(release_id,office_term_id);
CREATE INDEX seat_cycles_geography_fk_idx ON seat_cycles(release_id,geography_version_id);
CREATE INDEX contests_seat_fk_idx ON contests(release_id,seat_cycle_id);
CREATE INDEX contests_geography_fk_idx ON contests(release_id,geography_version_id);
CREATE INDEX candidacies_contest_fk_idx ON candidacies(release_id,contest_id);
CREATE INDEX candidacies_person_fk_idx ON candidacies(release_id,person_id);
CREATE INDEX result_options_contest_fk_idx ON result_options(release_id,contest_id);
CREATE INDEX result_options_candidacy_fk_idx ON result_options(release_id,candidacy_id);
CREATE INDEX election_results_option_fk_idx ON election_results(release_id,result_option_id);
CREATE INDEX election_results_contest_fk_idx ON election_results(release_id,contest_id);
CREATE INDEX acs_observations_geography_fk_idx ON acs_observations(release_id,geography_version_id);
CREATE INDEX committee_relationships_committee_fk_idx ON committee_relationships(release_id,committee_id);
CREATE INDEX committee_relationships_candidacy_fk_idx ON committee_relationships(release_id,candidacy_id);
CREATE INDEX fec_filings_seat_fk_idx ON fec_filing_summaries(release_id,seat_cycle_id);
CREATE INDEX fec_filings_committee_fk_idx ON fec_filing_summaries(release_id,committee_id);
CREATE INDEX fec_filings_amends_fk_idx ON fec_filing_summaries(release_id,amends_filing_id);
CREATE INDEX seat_finance_filing_fk_idx ON seat_finance_summaries(release_id,filing_id);
CREATE INDEX provenance_snapshot_fk_idx ON provenance(release_id,snapshot_id);

-- Release publication hardening.  Targeted tables retain the full natural identity
-- of composite lineage records; generic provenance is deliberately simple-ID only.
ALTER TABLE provenance ADD CONSTRAINT provenance_simple_entity_type_ck CHECK (entity_type IN ('district_plans','geography_versions','offices','people','office_terms','memberships','seat_cycles','contests','candidacies','result_options','committees','committee_relationships'));
CREATE TABLE contest_lineage (release_id text NOT NULL REFERENCES data_releases(id), contest_id text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,contest_id,snapshot_id,role), FOREIGN KEY(release_id,contest_id) REFERENCES contests(release_id,id), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE election_result_lineage (release_id text NOT NULL REFERENCES data_releases(id), contest_id text NOT NULL, result_option_id text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,contest_id,result_option_id,snapshot_id,role), FOREIGN KEY(release_id,contest_id,result_option_id) REFERENCES election_results(release_id,contest_id,result_option_id), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE acs_observation_lineage (release_id text NOT NULL REFERENCES data_releases(id), geography_version_id text NOT NULL, variable text NOT NULL, survey_period text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,geography_version_id,variable,survey_period,snapshot_id,role), FOREIGN KEY(release_id,geography_version_id,variable,survey_period) REFERENCES acs_observations(release_id,geography_version_id,variable,survey_period), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE fec_filing_lineage (release_id text NOT NULL REFERENCES data_releases(id), filing_id text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,filing_id,snapshot_id,role), FOREIGN KEY(release_id,filing_id) REFERENCES fec_filing_summaries(release_id,id), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE seat_finance_summary_lineage (release_id text NOT NULL REFERENCES data_releases(id), seat_cycle_id text NOT NULL, snapshot_id text NOT NULL, role provenance_role NOT NULL, PRIMARY KEY(release_id,seat_cycle_id,snapshot_id,role), FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_finance_summaries(release_id,seat_cycle_id), FOREIGN KEY(release_id,snapshot_id) REFERENCES source_snapshots(release_id,id));
CREATE TABLE release_manifests (release_id text PRIMARY KEY REFERENCES data_releases(id), schema_version integer NOT NULL CONSTRAINT release_manifests_schema_version_ck CHECK(schema_version=1), canonical_data_checksum_sha256 text NOT NULL CONSTRAINT release_manifests_checksum_ck CHECK(canonical_data_checksum_sha256 ~ '^[a-f0-9]{64}$'), geometry_checksum_sha256 text NOT NULL CHECK(geometry_checksum_sha256 ~ '^[a-f0-9]{64}$'), content_checksum_sha256 text NOT NULL CHECK(content_checksum_sha256 ~ '^[a-f0-9]{64}$'), validated_at timestamptz);
CREATE TABLE release_profile_seats (release_id text NOT NULL REFERENCES data_releases(id), seat_cycle_id text NOT NULL, position integer NOT NULL CONSTRAINT release_profile_seats_position_ck CHECK(position BETWEEN 1 AND 12), PRIMARY KEY(release_id,seat_cycle_id), UNIQUE(release_id,position), FOREIGN KEY(release_id,seat_cycle_id) REFERENCES seat_cycles(release_id,id));
CREATE INDEX release_profile_seats_seat_fk_idx ON release_profile_seats(release_id,seat_cycle_id);

-- Metadata is content and can only be changed for candidates. Promotion validates
-- the persisted rows itself; no session-local trust marker exists.
-- This is intentionally a dedicated gate, rather than candidate_content_gate:
-- manifest writes must never recursively invalidate release_manifests.
CREATE FUNCTION guard_release_manifest() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release_row data_releases%ROWTYPE;
BEGIN
  SELECT * INTO release_row FROM data_releases WHERE id=COALESCE(NEW.release_id, OLD.release_id) FOR UPDATE;
  IF NOT FOUND OR release_row.status <> 'candidate' THEN
    RAISE EXCEPTION 'release manifest is mutable only while candidate' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.release_id <> OLD.release_id THEN RAISE EXCEPTION 'release manifest release is immutable' USING ERRCODE='23514'; END IF;
    IF (NEW.schema_version, NEW.canonical_data_checksum_sha256) IS DISTINCT FROM (OLD.schema_version, OLD.canonical_data_checksum_sha256) THEN
      NEW.validated_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release_manifest_gate BEFORE INSERT OR UPDATE OR DELETE ON release_manifests FOR EACH ROW EXECUTE FUNCTION guard_release_manifest();
COMMENT ON TRIGGER release_manifest_gate ON release_manifests IS 'Locks the owning release and permits manifest metadata writes only for candidate releases; deliberately does not invoke generic invalidation.';

ALTER TABLE contests ADD CONSTRAINT contests_natural_uq UNIQUE(release_id,seat_cycle_id,kind,round,election_date), ADD CONSTRAINT contests_denominator_whole_nonnegative_ck CHECK(denominator_votes IS NULL OR (denominator_votes >= 0 AND denominator_votes = trunc(denominator_votes))), ADD CONSTRAINT contests_reporting_percent_ck CHECK(reporting_completeness_percent BETWEEN 0 AND 100), ADD CONSTRAINT contests_allocation_percent_ck CHECK(allocation_coverage_percent IS NULL OR allocation_coverage_percent BETWEEN 0 AND 100);
ALTER TABLE election_results ADD CONSTRAINT election_results_votes_whole_nonnegative_ck CHECK(votes IS NULL OR (votes >= 0 AND votes = trunc(votes)));
ALTER TABLE acs_observations ADD CONSTRAINT acs_moe_nonnegative_ck CHECK(margin_of_error IS NULL OR margin_of_error >= 0);
ALTER TABLE fec_filing_summaries ADD CONSTRAINT fec_cash_nonnegative_ck CHECK(cash_on_hand IS NULL OR cash_on_hand >= 0), ADD CONSTRAINT fec_receipts_nonnegative_ck CHECK(total_receipts IS NULL OR total_receipts >= 0), ADD CONSTRAINT fec_disbursements_nonnegative_ck CHECK(total_disbursements IS NULL OR total_disbursements >= 0);

CREATE FUNCTION guard_candidate_release_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE content_release_id text := COALESCE(NEW.release_id, OLD.release_id); release_row data_releases%ROWTYPE;
BEGIN
  -- Never let an UPDATE use a candidate destination to bypass the source release lock.
  IF TG_OP = 'UPDATE' AND NEW.release_id IS DISTINCT FROM OLD.release_id THEN
    RAISE EXCEPTION 'release content cannot move between releases' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('dsa_seats_release:' || content_release_id));
  SELECT * INTO release_row FROM data_releases WHERE id=content_release_id FOR UPDATE;
  IF NOT FOUND OR release_row.status <> 'candidate' THEN RAISE EXCEPTION 'release content is mutable only while candidate' USING ERRCODE='23514'; END IF;
  UPDATE release_manifests SET validated_at=NULL WHERE release_id=content_release_id;
  RETURN COALESCE(NEW,OLD);
END $$;
-- One reusable gate also serializes writers with validation/promotion by locking data_releases.
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON sources FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON source_snapshots FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON district_plans FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON geometry_artifacts FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON geography_versions FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON offices FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON people FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON office_terms FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON memberships FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON seat_cycles FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON contests FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON candidacies FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON result_options FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON election_results FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON acs_observations FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON committees FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON committee_relationships FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON fec_filing_summaries FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON seat_finance_summaries FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON provenance FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON contest_lineage FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON election_result_lineage FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON acs_observation_lineage FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON fec_filing_lineage FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON seat_finance_summary_lineage FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();
CREATE TRIGGER candidate_content_gate BEFORE INSERT OR UPDATE OR DELETE ON release_profile_seats FOR EACH ROW EXECUTE FUNCTION guard_candidate_release_content();

-- A release has immutable identity metadata and a deliberately tiny state machine.
CREATE FUNCTION guard_release_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.label IS DISTINCT FROM OLD.label
     OR NEW.source_cutoff IS DISTINCT FROM OLD.source_cutoff OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'release identity metadata is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status='candidate' AND NEW.status='published') OR
    (OLD.status='published' AND NEW.status='retired') OR
    (OLD.status='retired' AND NEW.status='published')
  ) THEN RAISE EXCEPTION 'illegal release lifecycle transition' USING ERRCODE='23514'; END IF;
  IF OLD.status IN ('published','retired') AND NEW.status = OLD.status
     AND (NEW.published_at, NEW.previous_release_id) IS DISTINCT FROM (OLD.published_at, OLD.previous_release_id) THEN
    RAISE EXCEPTION 'published release history is immutable' USING ERRCODE='23514';
  END IF;
  IF (OLD.status='published' AND NEW.status='retired') OR (OLD.status='retired' AND NEW.status='published') THEN
    IF (NEW.published_at, NEW.previous_release_id) IS DISTINCT FROM (OLD.published_at, OLD.previous_release_id) THEN
      RAISE EXCEPTION 'release history must be preserved across retirement and rollback' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release_lifecycle_guard BEFORE UPDATE ON data_releases FOR EACH ROW EXECUTE FUNCTION guard_release_lifecycle();

-- Generic provenance is lossless only for simple-ID entity contracts. Its parent
-- must exist at insertion time; content tables are candidate-only so it cannot
-- outlive a parent through an allowed delete.
CREATE FUNCTION guard_provenance_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE exists_parent boolean;
BEGIN
  -- Check before dynamic SQL so unsupported provenance is a controlled integrity
  -- violation rather than a relation-name error from the trigger.
  IF NEW.entity_type NOT IN ('district_plans','geography_versions','offices','people','office_terms','memberships','seat_cycles','contests','candidacies','result_options','committees','committee_relationships') THEN
    RAISE EXCEPTION 'unsupported provenance entity type' USING ERRCODE='23514';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE release_id=$1 AND id=$2)', NEW.entity_type)
    INTO exists_parent USING NEW.release_id, NEW.entity_id;
  IF NOT exists_parent THEN RAISE EXCEPTION 'provenance parent does not exist' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provenance_parent_guard BEFORE INSERT OR UPDATE OF entity_type,entity_id,release_id ON provenance FOR EACH ROW EXECUTE FUNCTION guard_provenance_parent();

-- Finance-summary lineage explains absence only; a selected filing is already its source.
CREATE FUNCTION guard_seat_finance_summary_lineage_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM seat_finance_summaries summary
             WHERE summary.release_id=NEW.release_id AND summary.seat_cycle_id=NEW.seat_cycle_id
               AND summary.filing_id IS NOT NULL) THEN
    RAISE EXCEPTION 'finance summary lineage is valid only for missing summaries' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seat_finance_summary_lineage_parent_guard
  BEFORE INSERT OR UPDATE OF release_id,seat_cycle_id ON seat_finance_summary_lineage
  FOR EACH ROW EXECUTE FUNCTION guard_seat_finance_summary_lineage_parent();
CREATE FUNCTION guard_seat_finance_summary_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.filing_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM seat_finance_summary_lineage lineage
    WHERE lineage.release_id=NEW.release_id AND lineage.seat_cycle_id=NEW.seat_cycle_id
  ) THEN
    RAISE EXCEPTION 'finance summary with a filing cannot retain lineage' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seat_finance_summary_parent_guard
  BEFORE INSERT OR UPDATE OF release_id,seat_cycle_id,filing_id ON seat_finance_summaries
  FOR EACH ROW EXECUTE FUNCTION guard_seat_finance_summary_parent();
