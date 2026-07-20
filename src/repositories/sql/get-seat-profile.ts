import type { Pool, PoolClient } from "pg";

import { seatProfileSchema } from "@/domain/repository";
import type { ReleaseId, SeatCycleId } from "@/domain/contracts";
import type { SeatProfile } from "@/domain/repository";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

// jsonb output keeps dates as ISO dates and numerics as JSON numbers.  Each fact
// collection is aggregated independently so provenance joins cannot multiply it.
const PROFILE_SQL = `
WITH root AS (
  SELECT r.*, sc.id seat_id, sc.office_id, sc.office_term_id, sc.geography_version_id,
         sc.cycle_year, sc.election_date, sc.election_kind, sc.incumbency_status,
         sc.occupancy_status, sc.occupancy_as_of
    FROM release_profile_seats ps
    JOIN data_releases r ON r.id = ps.release_id
    JOIN seat_cycles sc ON sc.release_id = ps.release_id AND sc.id = ps.seat_cycle_id
   WHERE ps.release_id = $1 AND ps.seat_cycle_id = $2
), p AS (
  SELECT entity_type, entity_id,
         jsonb_agg(jsonb_build_object('snapshotId', snapshot_id, 'role', role) ORDER BY snapshot_id COLLATE "C", role::text COLLATE "C") refs
    FROM provenance WHERE release_id = $1
   GROUP BY entity_type, entity_id
), contest_l AS (
  SELECT contest_id, jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C", role::text COLLATE "C") refs
  FROM contest_lineage WHERE release_id=$1 GROUP BY contest_id
), result_l AS (
  SELECT contest_id,result_option_id,jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C",role::text COLLATE "C") refs
  FROM election_result_lineage WHERE release_id=$1 GROUP BY contest_id,result_option_id
), acs_l AS (
  SELECT geography_version_id,variable,survey_period,jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C",role::text COLLATE "C") refs
  FROM acs_observation_lineage WHERE release_id=$1 GROUP BY geography_version_id,variable,survey_period
), fec_l AS (
  SELECT filing_id,jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C",role::text COLLATE "C") refs
  FROM fec_filing_lineage WHERE release_id=$1 GROUP BY filing_id
), bio_p AS (
   SELECT person_id,fact,effective_at,jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C",role::text COLLATE "C") refs
   FROM biographical_fact_provenance WHERE release_id=$1 GROUP BY person_id,fact,effective_at
), facts AS (
 SELECT root.seat_id,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',c.id,'seatCycleId',c.seat_cycle_id,'kind',c.kind,'round',c.round,'electionDate',c.election_date,'geographyVersionId',c.geography_version_id,'certificationStatus',c.certification_status,'reportingCompletenessPercent',c.reporting_completeness_percent,'denominatorVotes',CASE WHEN c.denominator_votes IS NULL THEN jsonb_build_object('kind','missing','reason',c.denominator_missing_reason) ELSE jsonb_build_object('kind','value','value',c.denominator_votes) END,'reportingUnit',c.reporting_unit,'allocationMethod',c.allocation_method,'allocationCoveragePercent',CASE WHEN c.allocation_coverage_percent IS NULL THEN jsonb_build_object('kind','missing','reason',c.allocation_coverage_missing_reason) ELSE jsonb_build_object('kind','value','value',c.allocation_coverage_percent) END,'lineage',jsonb_build_object('inputs',cl.refs,'asOf',c.lineage_as_of,'methodology',c.lineage_methodology,'status',c.lineage_status),'provenance',p.refs) ORDER BY c.id COLLATE "C") FROM contests c LEFT JOIN p ON p.entity_type='contests' AND p.entity_id=c.id LEFT JOIN contest_l cl ON cl.contest_id=c.id WHERE c.release_id=$1 AND c.seat_cycle_id=root.seat_id) contests,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',ca.id,'contestId',ca.contest_id,'personId',ca.person_id,'party',ca.party,'status',ca.status,'provenance',p.refs) ORDER BY ca.id COLLATE "C") FROM candidacies ca JOIN contests c ON c.release_id=ca.release_id AND c.id=ca.contest_id LEFT JOIN p ON p.entity_type='candidacies' AND p.entity_id=ca.id WHERE ca.release_id=$1 AND c.seat_cycle_id=root.seat_id) candidacies,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',o.id,'contestId',o.contest_id,'candidacyId',o.candidacy_id,'label',o.label,'party',o.party,'optionKind',o.option_kind,'provenance',p.refs) ORDER BY o.id COLLATE "C") FROM result_options o JOIN contests c ON c.release_id=o.release_id AND c.id=o.contest_id LEFT JOIN p ON p.entity_type='result_options' AND p.entity_id=o.id WHERE o.release_id=$1 AND c.seat_cycle_id=root.seat_id) options,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'contestId',e.contest_id,'resultOptionId',e.result_option_id,'votes',CASE WHEN e.votes IS NULL THEN jsonb_build_object('kind','missing','reason',e.votes_missing_reason) ELSE jsonb_build_object('kind','value','value',e.votes) END,'lineage',jsonb_build_object('inputs',rl.refs,'asOf',e.lineage_as_of,'methodology',e.lineage_methodology,'status',e.lineage_status)) ORDER BY e.contest_id COLLATE "C",e.result_option_id COLLATE "C") FROM election_results e JOIN contests c ON c.release_id=e.release_id AND c.id=e.contest_id LEFT JOIN result_l rl ON rl.contest_id=e.contest_id AND rl.result_option_id=e.result_option_id WHERE e.release_id=$1 AND c.seat_cycle_id=root.seat_id) results,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'geographyVersionId',a.geography_version_id,'variable',a.variable,'label',a.label,'estimate',CASE WHEN a.estimate IS NULL THEN jsonb_build_object('kind','missing','reason',a.estimate_missing_reason) ELSE jsonb_build_object('kind','value','value',a.estimate) END,'marginOfError',CASE WHEN a.margin_of_error IS NULL THEN jsonb_build_object('kind','missing','reason',a.margin_of_error_missing_reason) ELSE jsonb_build_object('kind','value','value',a.margin_of_error) END,'unit',a.unit,'surveyPeriod',a.survey_period,'universe',a.universe,'lineage',jsonb_build_object('inputs',al.refs,'asOf',a.lineage_as_of,'methodology',a.lineage_methodology,'status',a.lineage_status)) ORDER BY a.geography_version_id COLLATE "C",a.variable COLLATE "C",a.survey_period COLLATE "C") FROM acs_observations a LEFT JOIN acs_l al ON al.geography_version_id=a.geography_version_id AND al.variable=a.variable AND al.survey_period=a.survey_period WHERE a.release_id=$1 AND a.geography_version_id=root.geography_version_id) demographics,
  (SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',f.id,'seatCycleId',f.seat_cycle_id,'committeeId',f.committee_id,'sourceFilingId',f.source_filing_id,'reportType',f.report_type,'reportingPeriodStart',f.reporting_period_start,'reportingPeriodEnd',f.reporting_period_end,'filedAt',f.filed_at,'amendmentNumber',f.amendment_number,'amendmentStatus',f.amendment_status,'amendsFilingId',f.amends_filing_id,'cashOnHand',CASE WHEN f.cash_on_hand IS NULL THEN jsonb_build_object('kind','missing','reason',f.cash_on_hand_missing_reason) ELSE jsonb_build_object('kind','value','value',f.cash_on_hand) END,'totalReceipts',CASE WHEN f.total_receipts IS NULL THEN jsonb_build_object('kind','missing','reason',f.total_receipts_missing_reason) ELSE jsonb_build_object('kind','value','value',f.total_receipts) END,'totalDisbursements',CASE WHEN f.total_disbursements IS NULL THEN jsonb_build_object('kind','missing','reason',f.total_disbursements_missing_reason) ELSE jsonb_build_object('kind','value','value',f.total_disbursements) END,'lineage',jsonb_build_object('inputs',fl.refs,'asOf',f.lineage_as_of,'methodology',f.lineage_methodology,'status',f.lineage_status)) ORDER BY f.id COLLATE "C") FROM fec_filing_summaries f LEFT JOIN fec_l fl ON fl.filing_id=f.id WHERE f.release_id=$1 AND f.seat_cycle_id=root.seat_id) finance
 FROM root
)
SELECT jsonb_build_object(
 'release',jsonb_build_object('id',root.id,'label',root.label,'status',root.status,'sourceCutoff',root.source_cutoff,'createdAt',root.created_at,'publishedAt',root.published_at,'previousReleaseId',root.previous_release_id),
 'office',jsonb_build_object('releaseId',$1,'id',o.id,'chamber',o.chamber,'kind',o.kind,'stateCode',o.state_code,'districtCode',o.district_code,'senateClass',o.senate_class,'provenance',po.refs),
 'seatCycle',jsonb_build_object('releaseId',$1,'id',root.seat_id,'officeId',root.office_id,'officeTermId',root.office_term_id,'geographyVersionId',root.geography_version_id,'cycleYear',root.cycle_year,'electionDate',root.election_date,'electionKind',root.election_kind,'incumbencyStatus',root.incumbency_status,'occupancy',jsonb_build_object('status',root.occupancy_status,'asOf',root.occupancy_as_of),'provenance',ps.refs),
 'geography',jsonb_strip_nulls(jsonb_build_object('releaseId',$1,'id',g.id,'kind',g.kind,'districtPlanId',g.district_plan_id,'geometryArtifactId',g.geometry_artifact_id,'sourceGeoid',g.source_geoid,'label',g.label,'vintage',g.vintage,'stateCode',g.state_code,'districtCode',g.district_code,'provenance',pg.refs)),
 'officeTerm',jsonb_build_object('releaseId',$1,'id',t.id,'officeId',t.office_id,'startsAt',t.starts_at,'endsAt',t.ends_at,'provenance',pt.refs),
 'membership',CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object('releaseId',$1,'id',m.id,'officeTermId',m.office_term_id,'personId',m.person_id,'party',m.party,'startsAt',m.starts_at,'endsAt',m.ends_at,'provenance',pm.refs) END,
 'incumbent',CASE WHEN person.id IS NULL THEN NULL ELSE jsonb_build_object('releaseId',$1,'id',person.id,'displayName',person.display_name,'birthDate',person.birth_date,'bioguideId',person.bioguide_id,'provenance',pp.refs) END,
 'biographicalFacts',COALESCE((SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'personId',bf.person_id,'fact',bf.fact,'value',CASE WHEN bf.value IS NULL THEN jsonb_build_object('kind','missing','reason',bf.value_missing_reason) ELSE jsonb_build_object('kind','value','value',bf.value) END,'effectiveAt',bf.effective_at,'provenance',bp.refs) ORDER BY bf.fact COLLATE "C",bf.effective_at,bf.person_id COLLATE "C") FROM biographical_facts bf LEFT JOIN bio_p bp ON bp.person_id=bf.person_id AND bp.fact=bf.fact AND bp.effective_at=bf.effective_at WHERE bf.release_id=$1 AND bf.person_id=person.id),'[]'::jsonb),
 'memberCoverage',(SELECT jsonb_build_object('releaseId',$1,'domain',cr.domain,'scope',jsonb_build_object('kind','release'),'status',cr.status,'expectedCount',cr.expected_count,'observedCount',cr.observed_count,'missingByReason',COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',cmr.reason,'count',cmr.count) ORDER BY cmr.reason::text COLLATE "C") FROM coverage_missing_reasons cmr WHERE cmr.release_id=cr.release_id AND cmr.domain=cr.domain AND cmr.scope_key=cr.scope_key),'[]'::jsonb),'quarantinedCount',cr.quarantined_count,'incompatibleCount',cr.incompatible_count,'inputSnapshotIds',COALESCE((SELECT jsonb_agg(cis.snapshot_id ORDER BY cis.snapshot_id COLLATE "C") FROM coverage_input_snapshots cis WHERE cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key),'[]'::jsonb)) FROM coverage_records cr WHERE cr.release_id=$1 AND cr.domain='member' AND cr.scope_kind='release' ORDER BY cr.scope_key COLLATE "C" LIMIT 1),
 'contests',COALESCE(facts.contests,'[]'::jsonb),'candidacies',COALESCE(facts.candidacies,'[]'::jsonb),'resultOptions',COALESCE(facts.options,'[]'::jsonb),'electionResults',COALESCE(facts.results,'[]'::jsonb),'demographics',COALESCE(facts.demographics,'[]'::jsonb),'finance',COALESCE(facts.finance,'[]'::jsonb),
 'committees',COALESCE((SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',cm.id,'sourceCommitteeId',cm.source_committee_id,'name',cm.name,'committeeType',cm.committee_type,'provenance',pc.refs) ORDER BY cm.id COLLATE "C") FROM committees cm LEFT JOIN p pc ON pc.entity_type='committees' AND pc.entity_id=cm.id WHERE cm.release_id=$1 AND EXISTS (SELECT 1 FROM fec_filing_summaries ff WHERE ff.release_id=cm.release_id AND ff.committee_id=cm.id AND ff.seat_cycle_id=root.seat_id)),'[]'::jsonb),
 'committeeRelationships',COALESCE((SELECT jsonb_agg(jsonb_build_object('releaseId',$1,'id',cr.id,'committeeId',cr.committee_id,'candidacyId',cr.candidacy_id,'relationship',cr.relationship,'effectiveFrom',cr.effective_from,'effectiveTo',cr.effective_to,'provenance',pr.refs) ORDER BY cr.id COLLATE "C") FROM committee_relationships cr JOIN candidacies ca ON ca.release_id=cr.release_id AND ca.id=cr.candidacy_id JOIN contests co ON co.release_id=ca.release_id AND co.id=ca.contest_id LEFT JOIN p pr ON pr.entity_type='committee_relationships' AND pr.entity_id=cr.id WHERE cr.release_id=$1 AND co.seat_cycle_id=root.seat_id AND EXISTS (SELECT 1 FROM fec_filing_summaries ff WHERE ff.release_id=cr.release_id AND ff.committee_id=cr.committee_id AND ff.seat_cycle_id=root.seat_id)),'[]'::jsonb),'sources','[]'::jsonb,'snapshots','[]'::jsonb) profile
FROM root JOIN offices o ON o.release_id=$1 AND o.id=root.office_id JOIN geography_versions g ON g.release_id=$1 AND g.id=root.geography_version_id JOIN office_terms t ON t.release_id=$1 AND t.id=root.office_term_id
LEFT JOIN memberships m ON m.release_id=$1 AND m.office_term_id=root.office_term_id AND root.occupancy_status='occupied' AND m.starts_at<=root.occupancy_as_of AND (m.ends_at IS NULL OR root.occupancy_as_of<m.ends_at)
LEFT JOIN people person ON person.release_id=$1 AND person.id=m.person_id
LEFT JOIN p po ON po.entity_type='offices' AND po.entity_id=o.id LEFT JOIN p ps ON ps.entity_type='seat_cycles' AND ps.entity_id=root.seat_id LEFT JOIN p pg ON pg.entity_type='geography_versions' AND pg.entity_id=g.id LEFT JOIN p pt ON pt.entity_type='office_terms' AND pt.entity_id=t.id LEFT JOIN p pm ON pm.entity_type='memberships' AND pm.entity_id=m.id LEFT JOIN p pp ON pp.entity_type='people' AND pp.entity_id=person.id JOIN facts ON facts.seat_id=root.seat_id`;


const ACS_PROFILE_COVERAGE_SQL = `
SELECT jsonb_build_object('coverage',COALESCE(jsonb_agg(jsonb_build_object('releaseId',$1::text,'domain',cr.domain,'scope',jsonb_build_object('kind','acs_indicator','variable',cr.variable,'surveyPeriod',cr.survey_period),'status',cr.status,'expectedCount',cr.expected_count,'observedCount',cr.observed_count,'missingByReason','[]'::jsonb,'quarantinedCount',cr.quarantined_count,'incompatibleCount',cr.incompatible_count,'inputSnapshotIds',COALESCE((SELECT jsonb_agg(cis.snapshot_id ORDER BY cis.snapshot_id COLLATE "C") FROM coverage_input_snapshots cis WHERE cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key),'[]'::jsonb)) ORDER BY cr.variable COLLATE "C",cr.survey_period COLLATE "C"),'[]'::jsonb),'snapshotIds',COALESCE((SELECT jsonb_agg(DISTINCT (cis.snapshot_id COLLATE "C") ORDER BY cis.snapshot_id COLLATE "C") FROM coverage_records cr JOIN coverage_input_snapshots cis ON cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key WHERE cr.release_id=$1 AND cr.domain='acs' AND cr.scope_kind='acs_indicator' AND cr.survey_period='2020-2024' AND cr.variable IN ('B01003_001E','B01002_001E','B19013_001E')),'[]'::jsonb)) AS availability
FROM seat_cycles sc JOIN geography_versions g ON g.release_id=sc.release_id AND g.id=sc.geography_version_id CROSS JOIN coverage_records cr
WHERE sc.release_id=$1 AND sc.id=$2 AND g.source_geoid IN ('6098','6698','6998','7898') AND cr.release_id=$1 AND cr.domain='acs' AND cr.scope_kind='acs_indicator' AND cr.survey_period='2020-2024' AND cr.variable IN ('B01003_001E','B01002_001E','B19013_001E')`;

const FINANCE_PROFILE_COVERAGE_SQL = `SELECT jsonb_build_object('releaseId',$1::text,'domain',cr.domain,'scope',jsonb_build_object('kind','funding','seatCycleId',cr.seat_cycle_id,'fundingKind',cr.funding_kind),'status',cr.status,'expectedCount',cr.expected_count,'observedCount',cr.observed_count,'missingByReason',COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',cmr.reason,'count',cmr.count) ORDER BY cmr.reason::text COLLATE "C") FROM coverage_missing_reasons cmr WHERE cmr.release_id=cr.release_id AND cmr.domain=cr.domain AND cmr.scope_key=cr.scope_key),'[]'::jsonb),'quarantinedCount',cr.quarantined_count,'incompatibleCount',cr.incompatible_count,'inputSnapshotIds',COALESCE((SELECT jsonb_agg(cis.snapshot_id ORDER BY cis.snapshot_id COLLATE "C") FROM coverage_input_snapshots cis WHERE cis.release_id=cr.release_id AND cis.domain=cr.domain AND cis.scope_key=cr.scope_key),'[]'::jsonb)) AS coverage FROM coverage_records cr WHERE cr.release_id=$1 AND cr.domain='finance' AND cr.scope_kind='funding' AND cr.seat_cycle_id=$2 AND cr.funding_kind='summary' ORDER BY cr.scope_key COLLATE "C" LIMIT 1`;

const FINANCE_AGGREGATES_SQL = `SELECT COALESCE(jsonb_agg(jsonb_build_object('id',fa.id,'releaseId',$1::text,'seatCycleId',fa.seat_cycle_id,'asOf',fa.as_of,'coverageThrough',fa.coverage_through,'reportingPeriodStart',fa.reporting_period_start,'cashOnHand',CASE WHEN fa.cash_on_hand IS NULL THEN jsonb_build_object('kind','missing','reason',fa.cash_on_hand_missing_reason) ELSE jsonb_build_object('kind','value','value',fa.cash_on_hand) END,'receipts',CASE WHEN fa.receipts IS NULL THEN jsonb_build_object('kind','missing','reason',fa.receipts_missing_reason) ELSE jsonb_build_object('kind','value','value',fa.receipts) END,'disbursements',CASE WHEN fa.disbursements IS NULL THEN jsonb_build_object('kind','missing','reason',fa.disbursements_missing_reason) ELSE jsonb_build_object('kind','value','value',fa.disbursements) END,'methodologyVersion',fa.methodology_version,'committeeInputs',(SELECT jsonb_agg(CASE WHEN fai.filing_id IS NULL THEN jsonb_build_object('kind','missing','committeeId',fai.committee_id,'reason',fai.missing_reason) ELSE jsonb_build_object('kind','included','committeeId',fai.committee_id,'filingId',fai.filing_id) END ORDER BY fai.committee_id COLLATE "C") FROM finance_aggregate_inputs fai WHERE fai.release_id=fa.release_id AND fai.finance_aggregate_id=fa.id)) ORDER BY fa.as_of,fa.id COLLATE "C"),'[]'::jsonb) AS aggregates FROM finance_aggregates fa WHERE fa.release_id=$1 AND fa.seat_cycle_id=$2`;

const AGGREGATE_COMMITTEE_CLOSURE_SQL = `WITH p AS (SELECT entity_type,entity_id,jsonb_agg(jsonb_build_object('snapshotId',snapshot_id,'role',role) ORDER BY snapshot_id COLLATE "C",role::text COLLATE "C") refs FROM provenance WHERE release_id=$1 GROUP BY entity_type,entity_id), ids AS (SELECT DISTINCT fai.committee_id FROM finance_aggregate_inputs fai JOIN finance_aggregates fa ON fa.release_id=fai.release_id AND fa.id=fai.finance_aggregate_id WHERE fai.release_id=$1 AND fa.seat_cycle_id=$2) SELECT jsonb_build_object('committees',COALESCE((SELECT jsonb_agg(jsonb_build_object('releaseId',$1::text,'id',cm.id,'sourceCommitteeId',cm.source_committee_id,'name',cm.name,'committeeType',cm.committee_type,'provenance',p.refs) ORDER BY cm.id COLLATE "C") FROM committees cm JOIN ids ON ids.committee_id=cm.id LEFT JOIN p ON p.entity_type='committees' AND p.entity_id=cm.id WHERE cm.release_id=$1),'[]'::jsonb),'committeeRelationships',COALESCE((SELECT jsonb_agg(jsonb_build_object('releaseId',$1::text,'id',cr.id,'committeeId',cr.committee_id,'candidacyId',cr.candidacy_id,'relationship',cr.relationship,'effectiveFrom',cr.effective_from,'effectiveTo',cr.effective_to,'provenance',p.refs) ORDER BY cr.id COLLATE "C") FROM committee_relationships cr JOIN ids ON ids.committee_id=cr.committee_id JOIN candidacies ca ON ca.release_id=cr.release_id AND ca.id=cr.candidacy_id JOIN contests co ON co.release_id=ca.release_id AND co.id=ca.contest_id LEFT JOIN p ON p.entity_type='committee_relationships' AND p.entity_id=cr.id WHERE cr.release_id=$1 AND co.seat_cycle_id=$2),'[]'::jsonb)) AS closure`;

// One release-scoped closure query starts from profile facts,
// then includes derivation inputs recursively; unrelated release snapshots cannot enter.
const CLOSURE_SQL = `WITH RECURSIVE target AS (
 SELECT office_id, office_term_id, geography_version_id, occupancy_as_of FROM seat_cycles WHERE release_id=$1 AND id=$2
), derivation_edges AS (
 SELECT output_snapshot_id AS from_id, input_snapshot_id AS to_id FROM snapshot_derivation_inputs WHERE release_id=$1
), wanted(id) AS (
 SELECT p.snapshot_id FROM provenance p JOIN target t ON (p.entity_type='seat_cycles' AND p.entity_id=$2) OR (p.entity_type='offices' AND p.entity_id=t.office_id) OR (p.entity_type='office_terms' AND p.entity_id=t.office_term_id) OR (p.entity_type='geography_versions' AND p.entity_id=t.geography_version_id) WHERE p.release_id=$1
 UNION SELECT p.snapshot_id FROM provenance p JOIN memberships m ON m.release_id=p.release_id AND p.entity_type='memberships' AND p.entity_id=m.id JOIN target t ON m.office_term_id=t.office_term_id AND m.starts_at<=t.occupancy_as_of AND (m.ends_at IS NULL OR t.occupancy_as_of<m.ends_at) WHERE p.release_id=$1
 UNION SELECT p.snapshot_id FROM provenance p JOIN memberships m ON m.release_id=p.release_id JOIN target t ON m.office_term_id=t.office_term_id AND m.starts_at<=t.occupancy_as_of AND (m.ends_at IS NULL OR t.occupancy_as_of<m.ends_at) WHERE p.release_id=$1 AND p.entity_type='people' AND p.entity_id=m.person_id
 UNION SELECT bfp.snapshot_id FROM biographical_fact_provenance bfp JOIN memberships m ON m.release_id=bfp.release_id AND m.person_id=bfp.person_id JOIN target t ON m.office_term_id=t.office_term_id AND m.starts_at<=t.occupancy_as_of AND (m.ends_at IS NULL OR t.occupancy_as_of<m.ends_at) WHERE bfp.release_id=$1
 UNION SELECT cis.snapshot_id FROM coverage_input_snapshots cis JOIN coverage_records cr ON cr.release_id=cis.release_id AND cr.domain=cis.domain AND cr.scope_key=cis.scope_key WHERE cis.release_id=$1 AND cr.domain='member' AND cr.scope_kind='release'
 UNION SELECT p.snapshot_id FROM provenance p JOIN contests c ON c.release_id=p.release_id AND p.entity_type='contests' AND p.entity_id=c.id WHERE p.release_id=$1 AND c.seat_cycle_id=$2
 UNION SELECT p.snapshot_id FROM provenance p JOIN candidacies ca ON ca.release_id=p.release_id AND p.entity_type='candidacies' AND p.entity_id=ca.id JOIN contests c ON c.release_id=ca.release_id AND c.id=ca.contest_id WHERE p.release_id=$1 AND c.seat_cycle_id=$2
 UNION SELECT p.snapshot_id FROM provenance p JOIN result_options o ON o.release_id=p.release_id AND p.entity_type='result_options' AND p.entity_id=o.id JOIN contests c ON c.release_id=o.release_id AND c.id=o.contest_id WHERE p.release_id=$1 AND c.seat_cycle_id=$2
 UNION SELECT cl.snapshot_id FROM contest_lineage cl JOIN contests c ON c.release_id=cl.release_id AND c.id=cl.contest_id WHERE cl.release_id=$1 AND c.seat_cycle_id=$2
 UNION SELECT rl.snapshot_id FROM election_result_lineage rl JOIN contests c ON c.release_id=rl.release_id AND c.id=rl.contest_id WHERE rl.release_id=$1 AND c.seat_cycle_id=$2
 UNION SELECT al.snapshot_id FROM acs_observation_lineage al JOIN seat_cycles sc ON sc.release_id=al.release_id AND sc.geography_version_id=al.geography_version_id WHERE al.release_id=$1 AND sc.id=$2
 UNION SELECT fl.snapshot_id FROM fec_filing_lineage fl JOIN fec_filing_summaries f ON f.release_id=fl.release_id AND f.id=fl.filing_id WHERE fl.release_id=$1 AND f.seat_cycle_id=$2
 UNION SELECT sfl.snapshot_id FROM seat_finance_summary_lineage sfl WHERE sfl.release_id=$1 AND sfl.seat_cycle_id=$2
 UNION SELECT fl.snapshot_id FROM finance_aggregate_inputs fai JOIN finance_aggregates fa ON fa.release_id=fai.release_id AND fa.id=fai.finance_aggregate_id JOIN fec_filing_lineage fl ON fl.release_id=fai.release_id AND fl.filing_id=fai.filing_id WHERE fai.release_id=$1 AND fa.seat_cycle_id=$2
 UNION SELECT cis.snapshot_id FROM coverage_input_snapshots cis JOIN coverage_records cr ON cr.release_id=cis.release_id AND cr.domain=cis.domain AND cr.scope_key=cis.scope_key WHERE cis.release_id=$1 AND cr.domain='finance' AND cr.scope_kind='funding' AND cr.seat_cycle_id=$2 AND cr.funding_kind='summary'
 UNION SELECT cis.snapshot_id FROM coverage_input_snapshots cis JOIN coverage_records cr ON cr.release_id=cis.release_id AND cr.domain=cis.domain AND cr.scope_key=cis.scope_key JOIN offices o ON o.release_id=cr.release_id JOIN seat_cycles sc ON sc.release_id=o.release_id AND sc.office_id=o.id WHERE cis.release_id=$1 AND sc.id=$2 AND cr.domain='election_2024' AND cr.scope_kind='election' AND cr.jurisdiction_code=o.state_code AND cr.election_year=2024
 UNION SELECT p.snapshot_id FROM provenance p JOIN committees cm ON cm.release_id=p.release_id AND p.entity_type='committees' AND p.entity_id=cm.id JOIN fec_filing_summaries f ON f.release_id=cm.release_id AND f.committee_id=cm.id WHERE p.release_id=$1 AND f.seat_cycle_id=$2
 UNION SELECT p.snapshot_id FROM provenance p JOIN committee_relationships cr ON cr.release_id=p.release_id AND p.entity_type='committee_relationships' AND p.entity_id=cr.id JOIN candidacies ca ON ca.release_id=cr.release_id AND ca.id=cr.candidacy_id JOIN contests c ON c.release_id=ca.release_id AND c.id=ca.contest_id WHERE p.release_id=$1 AND c.seat_cycle_id=$2 AND EXISTS (SELECT 1 FROM fec_filing_summaries ff WHERE ff.release_id=cr.release_id AND ff.committee_id=cr.committee_id AND ff.seat_cycle_id=$2)
 UNION SELECT p.snapshot_id FROM provenance p JOIN committees cm ON cm.release_id=p.release_id AND p.entity_type='committees' AND p.entity_id=cm.id JOIN finance_aggregate_inputs fai ON fai.release_id=cm.release_id AND fai.committee_id=cm.id JOIN finance_aggregates fa ON fa.release_id=fai.release_id AND fa.id=fai.finance_aggregate_id WHERE p.release_id=$1 AND fa.seat_cycle_id=$2
 UNION SELECT p.snapshot_id FROM provenance p JOIN committee_relationships cr ON cr.release_id=p.release_id AND p.entity_type='committee_relationships' AND p.entity_id=cr.id JOIN candidacies ca ON ca.release_id=cr.release_id AND ca.id=cr.candidacy_id JOIN contests c ON c.release_id=ca.release_id AND c.id=ca.contest_id JOIN finance_aggregate_inputs fai ON fai.release_id=cr.release_id AND fai.committee_id=cr.committee_id JOIN finance_aggregates fa ON fa.release_id=fai.release_id AND fa.id=fai.finance_aggregate_id WHERE p.release_id=$1 AND c.seat_cycle_id=$2 AND fa.seat_cycle_id=$2
 UNION SELECT edge.to_id FROM derivation_edges edge JOIN wanted w ON w.id=edge.from_id
) SELECT ss.id,ss.release_id AS "releaseId",ss.source_id AS "sourceId",ss.source_url AS "sourceUrl",ss.published_at AS "publishedAt",ss.retrieved_at AS "retrievedAt",ss.checksum_sha256 AS "checksumSha256",ss.parser_version AS "parserVersion",ss.license,ss.usage_status AS "usageStatus",s.id AS source_id,s.release_id AS source_release_id,s.name,s.authority,s.homepage_url AS homepage_url FROM source_snapshots ss JOIN wanted w ON w.id=ss.id JOIN sources s ON s.release_id=ss.release_id AND s.id=ss.source_id WHERE ss.release_id=$1 ORDER BY ss.id COLLATE "C"`;


function normalizeDates(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  return value;
}

function normalizeReleaseTimestamps(value: Record<string, unknown>): Record<string, unknown> {
  const release = value.release as Record<string, unknown> | undefined;
  if (!release) return value;
  const iso = (input: unknown): unknown => typeof input === "string" || input instanceof Date ? new Date(input).toISOString() : input;
  const finance = Array.isArray(value.finance) ? value.finance.map((filing) => {
    if (filing === null || typeof filing !== "object") return filing;
    const record = filing as Record<string, unknown>;
    return { ...record, filedAt: iso(record.filedAt) };
  }) : value.finance;
  return { ...value, release: { ...release, sourceCutoff: iso(release.sourceCutoff), createdAt: iso(release.createdAt), publishedAt: release.publishedAt === null ? null : iso(release.publishedAt) }, finance };
}

// Deliberately accepts a PoolClient as well as a Pool: callers that need a consistent
// profile/closure snapshot can pass their transaction client without this helper
// creating or committing a broader transaction.
export async function getSeatProfile(pool: Queryable, releaseId: ReleaseId, seatCycleId: SeatCycleId): Promise<SeatProfile | null> {
  const profile = await pool.query<{ profile: unknown }>(PROFILE_SQL, [releaseId, seatCycleId]);
  if (profile.rowCount === 0) return null;
  const acs = await pool.query<{ availability: { coverage: unknown[]; snapshotIds: string[] } }>(ACS_PROFILE_COVERAGE_SQL, [releaseId, seatCycleId]);
  const financeCoverage = await pool.query<{ coverage: unknown }>(FINANCE_PROFILE_COVERAGE_SQL, [releaseId, seatCycleId]);
  const financeAggregates = await pool.query<{ aggregates: unknown }>(FINANCE_AGGREGATES_SQL, [releaseId, seatCycleId]);
  const aggregateCommitteeClosure = await pool.query<{ closure: { committees: unknown[]; committeeRelationships: unknown[] } }>(AGGREGATE_COMMITTEE_CLOSURE_SQL, [releaseId, seatCycleId]);
  const closure = await pool.query(CLOSURE_SQL, [releaseId, seatCycleId]);
  const value = profile.rows[0]!.profile as Record<string, unknown>;
  value.financeCoverage = financeCoverage.rows[0]?.coverage ?? null;
  value.financeAggregates = financeAggregates.rows[0]?.aggregates ?? [];
  const aggregateClosure = aggregateCommitteeClosure.rows[0]?.closure;
  if (aggregateClosure) {
    const mergeById = (rows: unknown[], additional: unknown[]) => [...new Map([...rows, ...additional].map((row) => [String((row as { id: string }).id), row])).values()];
    value.committees = mergeById(value.committees as unknown[], aggregateClosure.committees);
    value.committeeRelationships = mergeById(value.committeeRelationships as unknown[], aggregateClosure.committeeRelationships);
  }
  const availability = acs.rows[0]?.availability;
  if (availability?.coverage.length === 3) {
    value.acsAvailability = { kind: "incompatible_geography" };
    value.acsCoverage = availability.coverage;
  } else {
    value.acsAvailability = Array.isArray(value.demographics) && value.demographics.length > 0 ? { kind: "observations" } : { kind: "no_observations" };
    value.acsCoverage = [];
  }
  // The SQL predicate is authoritative; this defensive filter also prevents a mocked
  // or misbehaving driver result from leaking another release into the strict DTO.
  const coverageSnapshotIds = new Set(availability?.coverage.length === 3 ? availability.snapshotIds : []);
  const coverageRows = coverageSnapshotIds.size === 0 ? [] : (await pool.query(`SELECT ss.id,ss.release_id AS "releaseId",ss.source_id AS "sourceId",ss.source_url AS "sourceUrl",ss.published_at AS "publishedAt",ss.retrieved_at AS "retrievedAt",ss.checksum_sha256 AS "checksumSha256",ss.parser_version AS "parserVersion",ss.license,ss.usage_status AS "usageStatus",s.id AS source_id,s.release_id AS source_release_id,s.name,s.authority,s.homepage_url AS homepage_url FROM source_snapshots ss JOIN sources s ON s.release_id=ss.release_id AND s.id=ss.source_id WHERE ss.release_id=$1 AND ss.id = ANY($2::text[]) ORDER BY ss.id COLLATE "C"`, [releaseId, [...coverageSnapshotIds]])).rows;
  const rows = [...closure.rows, ...coverageRows].filter((row) => row.releaseId === releaseId && row.source_release_id === releaseId).map(normalizeDates) as Record<string, unknown>[];
  const snapshots = [...new Map(rows.map((row) => [String(row.id), { id: row.id, releaseId: row.releaseId, sourceId: row.sourceId, sourceUrl: row.sourceUrl, publishedAt: row.publishedAt, retrievedAt: row.retrievedAt, checksumSha256: row.checksumSha256, parserVersion: row.parserVersion, license: row.license, usageStatus: row.usageStatus }])).values()];
  const sources = [...new Map(rows.map((row) => [String(row.source_id), { id: row.source_id, releaseId: row.source_release_id, name: row.name, authority: row.authority, homepageUrl: row.homepage_url }])).values()].sort((left, right) => String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0);
  return seatProfileSchema.parse({ ...normalizeReleaseTimestamps(value), snapshots, sources });
}

export const __sql = { PROFILE_SQL, ACS_PROFILE_COVERAGE_SQL, FINANCE_PROFILE_COVERAGE_SQL, FINANCE_AGGREGATES_SQL, AGGREGATE_COMMITTEE_CLOSURE_SQL, CLOSURE_SQL };
