import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { expectedContentChecksum, validateNationwideCandidateRelease } from "@/db/catalog-release";
import { loadNationwideManifestForFinalization, seedNationwideCandidateManifest } from "@/db/manifest";
import { baselineCandidateRelease } from "@/db/catalog-release";
import { buildElectionPublicationPayloadWithClient, buildFinancePublicationPayloadWithClient, canonicalSha256, reviewSubjectSha256, type ElectionPublicationProof, type FinancePublicationProof, type SubjectType } from "@/db/launch-data-proofs";
import { nationwideSkeleton } from "./nationwide-skeleton";

const hash = (value: string) => value.padEnd(64, "0").slice(0, 64);
const objectHash = (value: string) => createHash("sha256").update(value).digest("hex");
const signedAt = "2026-07-18T12:00:00.000Z";
type EvidenceRow = Record<string, unknown> & { review_id: string; subject_sha256: string };

async function bulk(client: PoolClient, table: string, columns: readonly string[], rows: readonly Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  const fields = columns.map((column) => `${column} text`).join(",");
  const types: Record<string, string> = { raw_store_kind: "raw_store_kind", byte_size: "bigint", campaign_cycle: "integer", page_number: "integer", terminal_page: "integer", expected_terminal_page: "integer", actual_terminal_page: "integer", expected_terminal_amendment: "integer", actual_terminal_amendment: "integer", election_year: "integer", required: "integer", denominator_votes: "bigint", reporting_completeness_percent: "numeric", allocation_coverage_percent: "numeric", votes: "bigint", effective_from: "date", effective_to: "date", reporting_period_start: "date", reporting_period_end: "date", retrieved_at: "timestamptz", deleted_at: "timestamptz", signed_at: "timestamptz", created_at: "timestamptz", certified_at: "timestamptz" };
  const values = columns.map((column) => `x.${column}::${types[column] ?? "text"}`).join(",");
  const payload = rows.map(input => { const row = { ...input }; delete row.release_id; return row; });
  await client.query(`INSERT INTO ${table}(release_id,${columns.join(",")}) SELECT $1,${values} FROM jsonb_to_recordset($2::jsonb) AS x(${fields})`, [rows[0]!.release_id, JSON.stringify(payload)]);
}

function reviewed(type: SubjectType, releaseId: string, row: Record<string, unknown>, n: number): EvidenceRow {
  const review_id = `${type}_${n}`;
  const result = { ...row, release_id: releaseId, review_id, subject_sha256: "" };
  return { ...result, subject_sha256: reviewSubjectSha256(type, result as never) };
}
async function signatures(client: PoolClient, rows: readonly [SubjectType, EvidenceRow][]): Promise<void> {
  await bulk(client, "reviewer_signatures", ["review_id", "subject_type", "subject_sha256", "reviewer_id", "signed_at", "signature", "key_id"], rows.map(([subject_type, row]) => ({ release_id: row.release_id, review_id: row.review_id, subject_type, subject_sha256: row.subject_sha256, reviewer_id: subject_type === "publication" ? "approver" : "reviewer", signed_at: signedAt, signature: `fixture-${row.review_id}`, key_id: subject_type === "publication" ? "approver-key" : "reviewer-key" })));
}

export const fixtureResolver = { resolve: async (keyId: string, reviewerId: string) => ({ publicKey: keyId, publicKeyFingerprint: "0".repeat(64), reviewerRole: reviewerId === "approver" ? "release_approver" as const : "data_reviewer" as const, allowedSubjectTypes: reviewerId === "approver" ? ["publication"] as const : ["fec_mapping", "committee_mapping", "finance_page_closure", "finance_amendment_closure", "vacancy", "finance_terminal", "finance_closure", "election_decision", "election_result", "election_geometry"] as const, validFrom: new Date("2020-01-01T00:00:00Z"), validUntil: null, revokedAt: null }) };
export const fixtureVerifier = { verify: async (_payload: string, signature: string) => signature.startsWith("fixture-") };
export const fixtureStores = { resolve: async (_kind: "local" | "s3", identity: string) => identity === "fixture-store" ? { read: async (receipt: { objectKey: string }) => new TextEncoder().encode(receipt.objectKey.startsWith("finance/") ? "f" : "e") } : undefined };

export async function seedLaunchR1(pool: Pool, id: string, options: { readonly memberFacts?: boolean } = {}): Promise<void> {
  const manifest = structuredClone(nationwideSkeleton());
  manifest.release = { ...manifest.release, id: id as never, label: "Launch R1", sourceCutoff: "2026-07-18T00:00:00.000Z" };
  const rewrite = (value: unknown): void => { if (Array.isArray(value)) value.forEach(rewrite); else if (value && typeof value === "object") { const row = value as Record<string, unknown>; if (row.releaseId === "rel_synthetic") row.releaseId = id; Object.values(row).forEach(rewrite); } };
  rewrite(manifest);
  manifest.contests = []; manifest.candidacies = []; manifest.resultOptions = []; manifest.electionResults = [];
  manifest.committeeRelationships = []; manifest.fecFilingSummaries = []; manifest.financeSummaries = []; manifest.financeAggregates = [];
  manifest.fundingCategoryAggregates = []; manifest.fundingOrganizationAggregates = []; manifest.outsideSpendingAggregates = [];
  for (const record of manifest.coverageRecords.filter(record => record.domain === "finance")) { record.status = "not_collected"; record.observedCount = 0; record.missingByReason = [{ reason: "not_collected", count: record.expectedCount }]; }
  const vacantTerms = new Set(manifest.seatCycles.slice(0, 4).map(cycle => cycle.officeTermId));
  manifest.seatCycles = manifest.seatCycles.map(cycle => vacantTerms.has(cycle.officeTermId) ? { ...cycle, occupancy: { ...cycle.occupancy, status: "vacant" as const } } : cycle);
  manifest.memberships = manifest.memberships.filter(member => !vacantTerms.has(member.officeTermId));
  const memberCoverage = manifest.coverageRecords.find(record => record.domain === "member" && record.scope.kind === "release");
  if (memberCoverage) { memberCoverage.expectedCount = manifest.memberships.length; memberCoverage.observedCount = manifest.memberships.length; }
  if (options.memberFacts === false) {
    manifest.biographicalFacts = [];
    manifest.committeeAssignments = [];
    if (memberCoverage) {
      memberCoverage.status = "not_collected";
      memberCoverage.observedCount = 0;
      memberCoverage.missingByReason = [{ reason: "not_collected", count: memberCoverage.expectedCount }];
    }
  }
  for (const term of manifest.officeTerms) { term.startsAt = "2025-01-03"; term.endsAt = "2027-01-03"; }
  for (const member of manifest.memberships) { member.startsAt = "2025-01-03"; member.endsAt = null; }
  for (const cycle of manifest.seatCycles) cycle.occupancy.asOf = "2026-07-18";
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  const bundle = [{ artifactId: manifest.geometryArtifacts[0]!.id, objectKey: manifest.geometryArtifacts[0]!.objectKey, bytes: JSON.stringify({ type: "FeatureCollection", features: manifest.geographyVersions.map((g, i) => { const x = -170 + (i % 50) * 6; const y = Math.floor(i / 50) * 5; return { type: "Feature", properties: { sourceGeoid: g.sourceGeoid, stateCode: g.stateCode, districtCode: g.kind === "house_district" ? g.districtCode : null }, geometry: { type: "MultiPolygon", coordinates: [[[[x, y], [x + .01, y], [x + .01, y + .01], [x, y + .01], [x, y]]]] } }; }) }) }];
  // The persisted fixture needs a geometry checksum that matches its synthetic bytes.
  manifest.geometryArtifacts[0]!.checksumSha256 = (await import("node:crypto")).createHash("sha256").update(bundle[0]!.bytes).digest("hex");
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  await seedNationwideCandidateManifest(pool, manifest, bundle as never);
  await validateNationwideCandidateRelease(pool, id);
}

export async function cloneLaunchRelease(pool: Pool, source: string, target: string): Promise<void> {
  await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) SELECT $1,$1,'candidate',source_cutoff,now(),NULL,id FROM data_releases WHERE id=$2", [target, source]);
  await baselineCandidateRelease(pool, source, target);
}

export async function addFinanceEvidence(pool: Pool, releaseId: string): Promise<FinancePublicationProof> {
  const client = await pool.connect();
  try { await client.query("BEGIN");
    const seedSeat = (await client.query<{ id: string; geography_version_id: string }>("SELECT id,geography_version_id FROM seat_cycles WHERE release_id=$1 AND occupancy_status='occupied' ORDER BY id COLLATE \"C\" LIMIT 1", [releaseId])).rows[0];
    if (!seedSeat) throw new Error("Launch finance fixture requires an occupied seat");
    await client.query("INSERT INTO contests(release_id,id,seat_cycle_id,kind,round,election_date,geography_version_id,certification_status,reporting_completeness_percent,denominator_votes,denominator_missing_reason,reporting_unit,allocation_method,allocation_coverage_percent,allocation_coverage_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,'contest_launch_finance',$2,'house_general','general','2026-11-03',$3,'official_unfinalized',0,NULL,'not_collected','district','none',NULL,'not_applicable','2026-07-18','launch-fixture','reported')", [releaseId, seedSeat.id, seedSeat.geography_version_id]);
    await client.query("INSERT INTO contest_lineage(release_id,contest_id,snapshot_id,role) VALUES($1,'contest_launch_finance','snap_input','original_publisher')", [releaseId]);
    await client.query("INSERT INTO candidacies(release_id,id,contest_id,person_id,party,status) VALUES($1,'candidacy_launch_finance','contest_launch_finance',NULL,'other','filed')", [releaseId]);
    await client.query("INSERT INTO committee_relationships(release_id,id,committee_id,candidacy_id,relationship,effective_from,effective_to) VALUES($1,'committee_rel_launch_finance','committee_synthetic','candidacy_launch_finance','authorized','2026-01-01',NULL)", [releaseId]);
    await client.query("INSERT INTO provenance(release_id,entity_type,entity_id,snapshot_id,role) VALUES($1,'contests','contest_launch_finance','snap_input','original_publisher'),($1,'candidacies','candidacy_launch_finance','snap_input','original_publisher'),($1,'committee_relationships','committee_rel_launch_finance','snap_input','original_publisher')", [releaseId]);
    await client.query("INSERT INTO fec_filing_summaries(release_id,id,seat_cycle_id,committee_id,source_filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,'fec_launch_0',$2,'committee_synthetic','launch-source-0','Q1','2026-01-01','2026-03-31','2026-04-01T00:00:00Z',0,'superseded',NULL,1,NULL,2,NULL,1,NULL,'2026-07-18','launch-fixture','reported'),($1,'fec_launch_1',$2,'committee_synthetic','launch-source-1','Q1','2026-01-01','2026-03-31','2026-04-02T00:00:00Z',1,'amended','fec_launch_0',10,NULL,20,NULL,5,NULL,'2026-07-18','launch-fixture','reported')", [releaseId, seedSeat.id]);
    await client.query("INSERT INTO fec_filing_lineage(release_id,filing_id,snapshot_id,role) VALUES($1,'fec_launch_0','snap_input','original_publisher'),($1,'fec_launch_1','snap_input','original_publisher')", [releaseId]);
    await client.query("INSERT INTO seat_finance_summaries(release_id,seat_cycle_id,filing_id,missing_reason,as_of) VALUES($1,$2,'fec_launch_1',NULL,NULL)", [releaseId, seedSeat.id]);
    await client.query("INSERT INTO finance_aggregates(release_id,id,seat_cycle_id,as_of,coverage_through,reporting_period_start,cash_on_hand,cash_on_hand_missing_reason,receipts,receipts_missing_reason,disbursements,disbursements_missing_reason,methodology_version) VALUES($1,'launch_finance_aggregate',$2,'2026-07-18','2026-03-31','2026-01-01',10,NULL,20,NULL,5,NULL,'launch-fixture')", [releaseId, seedSeat.id]);
    await client.query("INSERT INTO finance_aggregate_inputs(release_id,finance_aggregate_id,committee_id,filing_id,missing_reason) VALUES($1,'launch_finance_aggregate','committee_synthetic','fec_launch_1',NULL)", [releaseId]);
    const financeCoverage = await client.query<{ scope_key: string }>("SELECT scope_key FROM coverage_records WHERE release_id=$1 AND domain='finance' AND seat_cycle_id=$2 AND funding_kind='summary'", [releaseId, seedSeat.id]);
    if (financeCoverage.rowCount !== 1) throw new Error("Launch finance fixture requires summary coverage");
    await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [releaseId, financeCoverage.rows[0]!.scope_key]);
    await client.query("UPDATE coverage_records SET status='complete',observed_count=1 WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [releaseId, financeCoverage.rows[0]!.scope_key]);
    const seats = (await client.query<{ id: string; occupancy_status: string; has_finance: boolean; has_category: boolean; has_organization: boolean; has_outside: boolean }>("SELECT sc.id,sc.occupancy_status,EXISTS(SELECT 1 FROM seat_finance_summaries s WHERE (s.release_id,s.seat_cycle_id)=(sc.release_id,sc.id) AND s.filing_id IS NOT NULL) AND EXISTS(SELECT 1 FROM finance_aggregates a WHERE (a.release_id,a.seat_cycle_id)=(sc.release_id,sc.id)) has_finance,EXISTS(SELECT 1 FROM funding_category_aggregates a WHERE (a.release_id,a.seat_cycle_id)=(sc.release_id,sc.id)) has_category,EXISTS(SELECT 1 FROM funding_organization_aggregates a WHERE (a.release_id,a.seat_cycle_id)=(sc.release_id,sc.id)) has_organization,EXISTS(SELECT 1 FROM outside_spending_aggregates a WHERE (a.release_id,a.seat_cycle_id)=(sc.release_id,sc.id)) has_outside FROM release_profile_seats p JOIN seat_cycles sc ON sc.release_id=p.release_id AND sc.id=p.seat_cycle_id WHERE p.release_id=$1 ORDER BY sc.id", [releaseId])).rows;
    const receipt = { release_id: releaseId, id: "finance-receipt", raw_store_kind: "local", store_identity: "fixture-store", object_key: `finance/${releaseId}.json`, version_id: null, etag: null, acquisition_batch: "finance-batch", source_url: "https://example.test/fec", request_sha256: hash("1"), response_sha256: objectHash("f"), byte_size: "1", retrieved_at: signedAt, source_lock_entry_id: "finance-lock", usage_status: "approved", retention: "metadata", page_number: "1", cursor_in: null, cursor_out: null, terminal_page: "1" };
    await bulk(client, "finance_launch_receipts", Object.keys(receipt).filter(x => x !== "release_id"), [receipt]);
    await bulk(client, "finance_deletion_attestations", ["receipt_id", "deleted_at", "attestation_sha256"], [{ release_id: releaseId, receipt_id: receipt.id, deleted_at: signedAt, attestation_sha256: hash("3") }]);
    const signed: [SubjectType, EvidenceRow][] = []; let n = 0;
    const rows = (type: SubjectType, values: Record<string, unknown>[]) => values.map(value => { const row = reviewed(type, releaseId, value, ++n); signed.push([type, row]); return row; });
    const occupied = seats.filter(s => s.occupancy_status === "occupied"); const vacant = seats.filter(s => s.occupancy_status === "vacant");
    const latestFilings = new Map((await client.query<{ id: string; seat_cycle_id: string; committee_id: string; report_type: string; reporting_period_start: string; reporting_period_end: string; amendment_number: number }>('SELECT DISTINCT ON (seat_cycle_id COLLATE "C",committee_id COLLATE "C",report_type COLLATE "C",reporting_period_start,reporting_period_end) id,seat_cycle_id,committee_id,report_type,reporting_period_start,reporting_period_end,amendment_number FROM fec_filing_summaries WHERE release_id=$1 ORDER BY seat_cycle_id COLLATE "C",committee_id COLLATE "C",report_type COLLATE "C",reporting_period_start,reporting_period_end,amendment_number DESC,filed_at DESC,id COLLATE "C" DESC', [releaseId])).rows.map(row => [`${row.seat_cycle_id}\0${row.committee_id}\0${row.report_type}\0${row.reporting_period_start}\0${row.reporting_period_end}`, row]));
    const mappings = rows("fec_mapping", occupied.map(s => ({ seat_cycle_id: s.id, fec_candidate_id: `C${s.id}`, campaign_cycle: 2026, candidacy_key: `candidate-${s.id}`, outcome: "mapped", receipt_id: receipt.id })));
    const committees = rows("committee_mapping", occupied.map(s => ({ seat_cycle_id: s.id, fec_candidate_id: `C${s.id}`, committee_id: "committee_synthetic", designation: "principal", effective_from: "2026-01-01T06:00:00.000Z", effective_to: null, receipt_id: receipt.id })));
    const pages = rows("finance_page_closure", occupied.map(s => ({ seat_cycle_id: s.id, acquisition_batch: receipt.acquisition_batch, expected_terminal_page: 1, actual_terminal_page: 1, expected_cursor_out: null, actual_cursor_out: null })));
    const amendments = rows("finance_amendment_closure", [...latestFilings.values()].filter(filing => occupied.some(seat => seat.id === filing.seat_cycle_id && seat.has_finance)).map(filing => ({ seat_cycle_id: filing.seat_cycle_id, committee_id: filing.committee_id, report_type: filing.report_type, reporting_period_start: filing.reporting_period_start, reporting_period_end: filing.reporting_period_end, expected_terminal_amendment: filing.amendment_number, actual_terminal_amendment: filing.amendment_number, expected_filing_id: filing.id, actual_filing_id: filing.id })));
    const vacancies = rows("vacancy", vacant.map(s => ({ seat_cycle_id: s.id, receipt_id: receipt.id })));
    const terminals = rows("finance_terminal", seats.map(s => ({ seat_cycle_id: s.id, outcome: s.occupancy_status === "vacant" ? "vacancy" : s.has_finance ? "approved_finance" : "no_report" })));
    const coverage = rows("finance_closure", seats.flatMap(s => ["summary", "category", "organization", "outside_spending"].map(kind => ({ seat_cycle_id: s.id, kind, status: kind === "summary" || (kind === "category" && s.has_category) || (kind === "organization" && s.has_organization) || (kind === "outside_spending" && s.has_outside) ? "complete" : "not_collected" }))));
    await signatures(client, signed);
    for (const [table, columns, data] of [["finance_candidate_mappings", ["review_id","subject_sha256","seat_cycle_id","fec_candidate_id","campaign_cycle","candidacy_key","outcome","receipt_id"], mappings], ["finance_committee_mappings", ["review_id","subject_sha256","seat_cycle_id","fec_candidate_id","committee_id","designation","effective_from","effective_to","receipt_id"], committees], ["finance_page_closures", ["review_id","subject_sha256","seat_cycle_id","acquisition_batch","expected_terminal_page","actual_terminal_page","expected_cursor_out","actual_cursor_out"], pages], ["finance_amendment_closures", ["review_id","subject_sha256","seat_cycle_id","committee_id","report_type","reporting_period_start","reporting_period_end","expected_terminal_amendment","actual_terminal_amendment","expected_filing_id","actual_filing_id"], amendments], ["vacancy_reviews", ["review_id","subject_sha256","seat_cycle_id","receipt_id"], vacancies], ["finance_terminal_dispositions", ["review_id","subject_sha256","seat_cycle_id","outcome"], terminals], ["finance_coverage_closures", ["review_id","subject_sha256","seat_cycle_id","kind","status"], coverage]] as const) await bulk(client, table, columns, data);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  for (const [table, type] of [["finance_candidate_mappings", "fec_mapping"], ["finance_committee_mappings", "committee_mapping"], ["finance_page_closures", "finance_page_closure"], ["finance_amendment_closures", "finance_amendment_closure"], ["vacancy_reviews", "vacancy"], ["finance_terminal_dispositions", "finance_terminal"], ["finance_coverage_closures", "finance_closure"]] as const) { const checked = await pool.query(`SELECT * FROM ${table} WHERE release_id=$1`, [releaseId]); const bad = checked.rows.find(row => reviewSubjectSha256(type, row) !== row.subject_sha256); if (bad) throw new Error(`fixture hash mismatch: ${table}: ${JSON.stringify(bad)}`); }
  const finalized = (await loadNationwideManifestForFinalization(pool, releaseId)).manifest;
  const canonical = computeCanonicalDataChecksum(finalized);
  const geometryChecksum = (await pool.query<{ geometry_checksum_sha256: string }>("SELECT geometry_checksum_sha256 FROM release_manifests WHERE release_id=$1", [releaseId])).rows[0]!.geometry_checksum_sha256;
  await pool.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [releaseId, canonical, expectedContentChecksum({ canonical_data_checksum_sha256: canonical, geometry_checksum_sha256: geometryChecksum } as never)]);
  await validateNationwideCandidateRelease(pool, releaseId);
  const outcomes = (await pool.query<{ outcome: FinancePublicationProof["terminalOutcomes"][number] }>('SELECT DISTINCT outcome COLLATE "C" outcome FROM finance_terminal_dispositions WHERE release_id=$1 ORDER BY 1', [releaseId])).rows.map(row => row.outcome);
  const proof: FinancePublicationProof = { proofId: "finance-proof", releaseId, cutoff: "2026-07-18", summaryDispositions: 541, financeCoverageRows: 2164, terminalOutcomes: outcomes, unresolvedMappings: 0, paginationGaps: 0, amendmentGaps: 0, digestDomains: ["acs", "elections", "finance", "geography", "identity", "maps", "member"] };
  const proofClient = await pool.connect(); try { const payload = await buildFinancePublicationPayloadWithClient(proofClient, proof); const subject = reviewed("publication", releaseId, { canonical: canonicalSha256(payload) }, 999999); subject.subject_sha256 = canonicalSha256(payload); await signatures(proofClient, [["publication", subject]]); await bulk(proofClient, "finance_publication_proofs", ["id","canonical_sha256","signed_review_id","created_at"], [{ release_id: releaseId, id: proof.proofId, canonical_sha256: subject.subject_sha256, signed_review_id: subject.review_id, created_at: signedAt }]); } finally { proofClient.release(); }
  return proof;
}

export async function addElectionEvidence(pool: Pool, releaseId: string): Promise<ElectionPublicationProof> {
  const client = await pool.connect(); try { await client.query("BEGIN");
    await client.query("UPDATE election_decisions SET status='unavailable' WHERE release_id=$1", [releaseId]);
    const snapshot = (await client.query<{ id: string }>('SELECT id FROM source_snapshots WHERE release_id=$1 ORDER BY id COLLATE "C" LIMIT 1', [releaseId])).rows[0];
    if (!snapshot) throw new Error("Launch election fixture requires a source snapshot");
    await client.query("INSERT INTO election_decision_inputs(release_id,election_decision_id,snapshot_id) SELECT release_id,id,$2 FROM election_decisions WHERE release_id=$1", [releaseId, snapshot.id]);
    await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain IN ('election_2020','election_2022','election_2024')", [releaseId]);
    await client.query("UPDATE coverage_records SET status='unavailable',expected_count=1,observed_count=0,quarantined_count=0,incompatible_count=0 WHERE release_id=$1 AND scope_kind='election'", [releaseId]);
    await client.query("INSERT INTO coverage_missing_reasons(release_id,domain,scope_key,reason,count) SELECT release_id,domain,scope_key,'not_defensibly_modeled',1 FROM coverage_records WHERE release_id=$1 AND scope_kind='election'", [releaseId]);
    await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain IN ('election_2020','election_2022','election_2024')", [releaseId]);
    await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) SELECT release_id,domain,scope_key,$2 FROM coverage_records WHERE release_id=$1 AND scope_kind='election'", [releaseId, snapshot.id]);
    const decisions = (await client.query<{ id:string; jurisdiction_code:string; election_year:number }>("SELECT id,jurisdiction_code,election_year FROM election_decisions WHERE release_id=$1 ORDER BY id", [releaseId])).rows;
    const receipt = { release_id: releaseId, id: "election-receipt", raw_store_kind: "local", store_identity: "fixture-store", object_key: `elections/${releaseId}.json`, version_id: null, etag: null, authority: "fixture", source_url: "https://example.test/elections", sha256: objectHash("e"), byte_size: "1", version: "1", retrieved_at: signedAt, source_lock_entry_id: "election-lock", usage_status: "approved" }; await bulk(client, "election_launch_receipts", Object.keys(receipt).filter(x=>x!=="release_id"), [receipt]);
    const signed: [SubjectType,EvidenceRow][]=[]; let n=0; const rows=(type:SubjectType, values:Record<string,unknown>[])=>values.map(value=>{const row=reviewed(type,releaseId,value,++n);signed.push([type,row]);return row;});
    const inventory=rows("election_decision", decisions.map(d=>({id:`inventory-${d.id}`,election_year:d.election_year,jurisdiction_code:d.jurisdiction_code,contest_key:`${d.jurisdiction_code}-${d.election_year}`,contest_kind:d.election_year===2022?"house_general":"presidential_general",boundary_kind:"original",inventory_receipt_id:receipt.id,decision_run_id:d.id})));
    const envelopes=rows("election_result", inventory.map(i=>({id:`envelope-${i.id}`,inventory_row_id:i.id,authority_artifact_id:`authority-${i.id}`,disposition:"unavailable",first_failed_gate:"source_unavailable",denominator_votes:null,reporting_completeness_percent:null,certification_status:null,reconciliation_status:null,allocation_method:null,allocation_coverage_percent:null})));
    const geometry=rows("election_geometry", inventory.map(i=>({contest_key:i.contest_key,required:0,receipt_id:null})));
    await signatures(client,signed);
    await bulk(client,"election_inventory_rows",["id","election_year","jurisdiction_code","contest_key","contest_kind","boundary_kind","inventory_receipt_id","decision_run_id","review_id","subject_sha256"],inventory);
    await bulk(client,"election_authority_artifacts",["id","receipt_id","jurisdiction_code","election_year","certification_status","certified_at"],inventory.map(i=>({release_id:releaseId,id:`authority-${i.id}`,receipt_id:receipt.id,jurisdiction_code:i.jurisdiction_code,election_year:i.election_year,certification_status:"certified",certified_at:signedAt})));
    await bulk(client,"election_result_envelopes",["id","inventory_row_id","authority_artifact_id","disposition","first_failed_gate","denominator_votes","reporting_completeness_percent","certification_status","reconciliation_status","allocation_method","allocation_coverage_percent","review_id","subject_sha256"],envelopes);
    await bulk(client,"election_geometry_attestations",["contest_key","required","receipt_id","review_id","subject_sha256"],geometry);
    await client.query("COMMIT");
  } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}
  const loaded=(await loadNationwideManifestForFinalization(pool,releaseId)).manifest; const canonical=computeCanonicalDataChecksum(loaded); await pool.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1",[releaseId,canonical,expectedContentChecksum({canonical_data_checksum_sha256:canonical,geometry_checksum_sha256:(await pool.query<{geometry_checksum_sha256:string}>("SELECT geometry_checksum_sha256 FROM release_manifests WHERE release_id=$1",[releaseId])).rows[0]!.geometry_checksum_sha256} as never)]); await validateNationwideCandidateRelease(pool,releaseId);
  const proof: ElectionPublicationProof={proofId:"election-proof",releaseId,cutoff:"2026-07-18",decisionRuns:158,decisionYears:{2020:51,2022:56,2024:51},digestDomains:["acs","elections","finance","geography","identity","maps","member"]};
  const c=await pool.connect();try{const payload=await buildElectionPublicationPayloadWithClient(c,proof);const subject=reviewed("publication",releaseId,{canonical:canonicalSha256(payload)},999998);subject.subject_sha256=canonicalSha256(payload);await signatures(c,[["publication",subject]]);await bulk(c,"election_publication_proofs",["id","canonical_sha256","signed_review_id","created_at"],[{release_id:releaseId,id:proof.proofId,canonical_sha256:subject.subject_sha256,signed_review_id:subject.review_id,created_at:signedAt}]);}finally{c.release();} return proof;
}
