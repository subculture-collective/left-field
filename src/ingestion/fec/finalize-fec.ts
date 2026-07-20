import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { expectedContentChecksum, recheckNationwideValidationGate, recheckNationwideValidationGateShared, validateNationwideCandidateReleaseWithClient } from "@/db/catalog-release";
import { markLoaded } from "@/db/ingestion";
import { loadNationwideManifest, loadNationwideManifestForFinalization } from "@/db/manifest";
import { assertPersistedTask7AcsInvariant } from "@/ingestion/acs/finalize-acs";
import type { RawObjectResult, RawObjectStore } from "@/ingestion/core/raw-object-store";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";
import { normalizeFecCents, fecStagedRowEquals, type FecStageRow } from "./adapter";
import { aggregateFecFinance, type FecCandidateMapping, type FinanceScope } from "./aggregates";
import { resolveFecAmendments, type ResolvedFecReportVersion } from "./amendments";
import { canonicalizeFecFinanceScope, decodeFecSanitizedEnvelope, fecEnvelopeSha256, FEC_SANITIZED_ADAPTER_VERSION, type FecSanitizedEnvelopeV1 } from "./envelope";

export type FinalizationSource = Readonly<{ id: string; name: string; authority: string; homepageUrl: string }>;
export type FecFinalizationSource = Readonly<FinalizationSource & { name: "fec"; authority: "official" }>;
export type FecFinalizationSnapshot = Readonly<{
  id: string; sourceId: string; sourceUrl: string; checksumSha256: string;
  publishedAt: string | null; retrievedAt: string; parserVersion: typeof FEC_SANITIZED_ADAPTER_VERSION;
  license: string; usageStatus: "approved" | "restricted";
}>;
export type MappingFinalizationSnapshot = Readonly<Omit<FecFinalizationSnapshot, "parserVersion"> & { parserVersion: string }>;
export interface FinalizeCandidateFecOptions {
  readonly pool: Pool; readonly rawStore: RawObjectStore; readonly candidateReleaseId: string; readonly sourceReleaseId: string;
  readonly runIds: readonly string[]; readonly sourceLockSha256: string; readonly source: FecFinalizationSource;
  readonly snapshot: FecFinalizationSnapshot; readonly mappingSource: FinalizationSource; readonly mappingSnapshot: MappingFinalizationSnapshot; readonly mapping: FecCandidateMapping; readonly financeScope: FinanceScope; readonly signal?: AbortSignal;
}
type LockMode = "FOR UPDATE" | "FOR SHARE";
type Run = QueryResultRow & { id: string; source_id: string; snapshot_id: string; adapter_version: string; upstream_release: string; raw_store_kind: "local" | "s3"; raw_store_locator: string; raw_object_key: string; raw_object_sha256: string; raw_object_byte_size: unknown; raw_object_version_id: string | null; raw_object_etag: string | null; lease_token: string; status: string; extracted_count: unknown; staged_count: unknown; quarantined_count: unknown; source_cutoff: Date | string; checksum_sha256: string; parser_version: string; usage_status: string; source_name: string; source_authority: string; source_homepage_url: string; source_url: string; license: string; published_at: Date | string | null; retrieved_at: Date | string };
type Stage = QueryResultRow & { source_natural_key: string; snapshot_id: string; committee_id: string; filing_id: string; report_type: string; reporting_period_start: Date | string; reporting_period_end: Date | string; filed_at: Date | string; amendment_number: number | string; cash_on_hand: string | null; total_receipts: string | null; total_disbursements: string | null; redacted_extras: unknown };

const fail = (code: string): never => { throw new Error(code); };
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const count = (value: unknown): number => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) fail("FEC_FINALIZE_RUN_INVALID"); return n; };
const date = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const receipt = (run: Run): RawObjectResult => ({ storeKind: run.raw_store_kind, storeLocator: run.raw_store_locator, objectKey: run.raw_object_key, sha256: run.raw_object_sha256, byteSize: count(run.raw_object_byte_size), ...(run.raw_object_version_id === null ? {} : { versionId: run.raw_object_version_id }), ...(run.raw_object_etag === null ? {} : { etag: run.raw_object_etag }) });

function assertInput(options: FinalizeCandidateFecOptions): void {
  if (options.snapshot.usageStatus !== "approved" || options.mappingSnapshot.usageStatus !== "approved") fail("FEC_FINALIZE_IMMUTABLE_CONTRACT");
  const metadata = (source: FinalizationSource, snapshot: MappingFinalizationSnapshot) => !!source.id && !!source.name && !!source.authority && !!source.homepageUrl && !!snapshot.id && snapshot.sourceId === source.id && !!snapshot.sourceUrl && /^[a-f0-9]{64}$/.test(snapshot.checksumSha256) && !!snapshot.retrievedAt && !!snapshot.parserVersion;
  if (!options.candidateReleaseId || !options.sourceReleaseId || options.candidateReleaseId === options.sourceReleaseId || options.runIds.length !== 1 || !options.runIds[0] || !/^[a-f0-9]{64}$/.test(options.sourceLockSha256) || options.source.name !== "fec" || options.source.authority !== "official" || !metadata(options.source, options.snapshot) || options.snapshot.parserVersion !== FEC_SANITIZED_ADAPTER_VERSION || !metadata(options.mappingSource, options.mappingSnapshot) || options.mapping.snapshotId !== options.mappingSnapshot.id || !options.mapping.committees.every((committee) => /^C\d{8}$/.test(committee.committeeId))) fail("FEC_FINALIZE_INPUT_INVALID");
  try { canonicalizeFecFinanceScope(options.financeScope); } catch { fail("FEC_FINALIZE_INPUT_INVALID"); }
}
async function assertCandidate(client: PoolClient, options: FinalizeCandidateFecOptions, lock: LockMode): Promise<void> {
  const result = await client.query(`SELECT 1 FROM data_releases r JOIN data_releases p ON p.id=r.previous_release_id JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1 AND r.status='candidate' AND r.previous_release_id=$2 AND r.source_cutoff=p.source_cutoff AND m.schema_version=2 ${lock}`, [options.candidateReleaseId, options.sourceReleaseId]);
  if (result.rowCount !== 1) fail("FEC_FINALIZE_CANDIDATE_INVALID");
}
async function loadRuns(client: PoolClient, options: FinalizeCandidateFecOptions, lock: LockMode): Promise<Run[]> {
  const result = await client.query<Run>(`SELECT ir.*,r.source_cutoff,s.name source_name,s.authority source_authority,s.homepage_url source_homepage_url,ss.source_url,ss.checksum_sha256,ss.published_at,ss.retrieved_at,ss.parser_version,ss.usage_status,ss.license FROM ingest_runs ir JOIN data_releases r ON r.id=ir.release_id JOIN sources s ON s.release_id=ir.release_id AND s.id=ir.source_id JOIN source_snapshots ss ON ss.release_id=ir.release_id AND ss.id=ir.snapshot_id WHERE ir.release_id=$1 AND ir.id=ANY($2) ${lock}`, [options.candidateReleaseId, options.runIds]);
  if (result.rowCount !== options.runIds.length) fail("FEC_FINALIZE_RUN_INVALID");
  return [...result.rows].sort((a, b) => a.id.localeCompare(b.id));
}
async function assertMapping(client: PoolClient, releaseId: string, options: FinalizeCandidateFecOptions, mapping: FecCandidateMapping): Promise<void> {
  const candidacy = await client.query(`SELECT 1 FROM candidacies ca JOIN contests co ON co.release_id=ca.release_id AND co.id=ca.contest_id WHERE ca.release_id=$1 AND ca.id=$2 AND co.seat_cycle_id=$3`, [releaseId, mapping.candidacyId, mapping.seatCycleId]);
  const source = await client.query("SELECT id,name,authority,homepage_url FROM sources WHERE release_id=$1 AND id=$2", [releaseId, options.mappingSource.id]);
  const snapshot = await client.query("SELECT id,source_id,source_url,checksum_sha256,published_at,retrieved_at,parser_version,license,usage_status FROM source_snapshots WHERE release_id=$1 AND id=$2", [releaseId, mapping.snapshotId]);
  const expectedSource = { id: options.mappingSource.id, name: options.mappingSource.name, authority: options.mappingSource.authority, homepage_url: options.mappingSource.homepageUrl };
  const expectedSnapshot = { id: options.mappingSnapshot.id, source_id: options.mappingSnapshot.sourceId, source_url: options.mappingSnapshot.sourceUrl, checksum_sha256: options.mappingSnapshot.checksumSha256, published_at: options.mappingSnapshot.publishedAt, retrieved_at: options.mappingSnapshot.retrievedAt, parser_version: options.mappingSnapshot.parserVersion, license: options.mappingSnapshot.license, usage_status: options.mappingSnapshot.usageStatus };
  const timestamp = (row: Record<string, unknown>) => ({ ...row, published_at: row.published_at === null ? null : new Date(row.published_at as string).toISOString(), retrieved_at: new Date(row.retrieved_at as string).toISOString() });
  if (candidacy.rowCount !== 1 || source.rowCount !== 1 || snapshot.rowCount !== 1 || !same(source.rows[0], expectedSource) || !same(timestamp(snapshot.rows[0]!), expectedSnapshot)) fail("FEC_FINALIZE_MAPPING_INVALID");
  const entityIds: Array<[string, string]> = [["candidacies", mapping.candidacyId]];
  for (const committee of mapping.committees) {
    const row = await client.query(`SELECT 1 FROM committees c JOIN committee_relationships cr ON cr.release_id=c.release_id AND cr.committee_id=c.id WHERE c.release_id=$1 AND c.source_committee_id=$2 AND cr.candidacy_id=$3 AND cr.relationship=$4 AND cr.effective_from=$5 AND cr.effective_to IS NOT DISTINCT FROM $6`, [releaseId, committee.committeeId, mapping.candidacyId, committee.relationshipType, committee.effectiveFrom, committee.effectiveTo]);
    if (row.rowCount !== 1) fail("FEC_FINALIZE_MAPPING_INVALID");
    const relationship = await client.query<{ id: string }>(`SELECT cr.id FROM committees c JOIN committee_relationships cr ON cr.release_id=c.release_id AND cr.committee_id=c.id WHERE c.release_id=$1 AND c.source_committee_id=$2 AND cr.candidacy_id=$3 AND cr.relationship=$4 AND cr.effective_from=$5 AND cr.effective_to IS NOT DISTINCT FROM $6`, [releaseId, committee.committeeId, mapping.candidacyId, committee.relationshipType, committee.effectiveFrom, committee.effectiveTo]);
    entityIds.push(["committees", (await client.query<{ id: string }>("SELECT id FROM committees WHERE release_id=$1 AND source_committee_id=$2", [releaseId, committee.committeeId])).rows[0]!.id], ["committee_relationships", relationship.rows[0]!.id]);
  }
  const provenance = await client.query<{ entity_type: string; entity_id: string; snapshot_id: string }>("SELECT entity_type,entity_id,snapshot_id FROM provenance WHERE release_id=$1 AND (entity_type,entity_id) IN (SELECT * FROM unnest($2::text[],$3::text[])) ORDER BY entity_type,entity_id,snapshot_id", [releaseId, entityIds.map(([type]) => type), entityIds.map(([, id]) => id)]);
  const expected = entityIds.map(([entity_type, entity_id]) => `${entity_type}:${entity_id}:${mapping.snapshotId}`).sort();
  if (!same(provenance.rows.map((row) => `${row.entity_type}:${row.entity_id}:${row.snapshot_id}`), expected)) fail("FEC_FINALIZE_MAPPING_INVALID");
}
async function replayRun(client: PoolClient, options: FinalizeCandidateFecOptions, run: Run): Promise<FecSanitizedEnvelopeV1> {
  const bytes = await options.rawStore.read(receipt(run), options.signal);
  if (sha(bytes) !== run.raw_object_sha256 || fecEnvelopeSha256(bytes) !== run.raw_object_sha256) fail("FEC_FINALIZE_RAW_MISMATCH");
  const envelope = decodeFecSanitizedEnvelope(bytes);
  if (envelope.sourceLockSha256 !== options.sourceLockSha256 || envelope.adapterVersion !== FEC_SANITIZED_ADAPTER_VERSION || envelope.releaseCutoff !== date(run.source_cutoff) || !same(envelope.financeScope, canonicalizeFecFinanceScope(options.financeScope)) || !same(envelope.mapping, options.mapping) || run.source_id !== options.source.id || run.source_name !== options.source.name || run.source_authority !== options.source.authority || run.source_homepage_url !== options.source.homepageUrl || run.snapshot_id !== options.snapshot.id || run.source_id !== options.snapshot.sourceId || run.source_url !== options.snapshot.sourceUrl || run.checksum_sha256 !== options.snapshot.checksumSha256 || run.checksum_sha256 !== run.raw_object_sha256 || (run.published_at === null ? null : new Date(run.published_at).toISOString()) !== options.snapshot.publishedAt || new Date(run.retrieved_at).toISOString() !== options.snapshot.retrievedAt || run.parser_version !== options.snapshot.parserVersion || run.license !== options.snapshot.license || run.usage_status !== options.snapshot.usageStatus || run.adapter_version !== FEC_SANITIZED_ADAPTER_VERSION || run.upstream_release !== "openfec-v1" || count(run.extracted_count) !== count(run.staged_count) || count(run.quarantined_count) !== 0) fail("FEC_FINALIZE_RUN_INVALID");
  await assertMapping(client, options.candidateReleaseId, options, envelope.mapping);
  const expected = new Map(resolveFecAmendments(envelope.reports).map((report) => [report.filingId, report]));
  const staged = await client.query<Stage>("SELECT source_natural_key,snapshot_id,committee_id,filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,cash_on_hand,total_receipts,total_disbursements,redacted_extras FROM stg_fec WHERE run_id=$1 ORDER BY source_natural_key", [run.id]);
  if (staged.rowCount !== expected.size) fail("FEC_FINALIZE_STAGE_INVALID");
  for (const row of staged.rows) {
    const wanted = expected.get(`fec:${row.committee_id}:${row.filing_id}`);
    const candidate: Parameters<typeof fecStagedRowEquals>[0] = { sourceNaturalKey: row.source_natural_key, snapshotId: row.snapshot_id, committeeId: row.committee_id, filingId: row.filing_id, reportType: row.report_type, reportingPeriodStart: row.reporting_period_start, reportingPeriodEnd: row.reporting_period_end, filedAt: row.filed_at, amendmentNumber: row.amendment_number, cashOnHand: row.cash_on_hand, totalReceipts: row.total_receipts, totalDisbursements: row.total_disbursements, redactedExtras: row.redacted_extras };
    if (!wanted || !fecStagedRowEquals(candidate, toStage(wanted, run.raw_object_sha256, envelope.electionKey), run.snapshot_id)) fail("FEC_FINALIZE_STAGE_INVALID");
  }
  return envelope;
}
function toStage(report: ResolvedFecReportVersion, checksum: string, electionKey: string): FecStageRow {
  return { sourceNaturalKey: report.filingId, committeeId: report.committeeId, filingId: String(report.fileNumber), reportType: report.reportType, reportingPeriodStart: report.coverageStartDate, reportingPeriodEnd: report.coverageEndDate, filedAt: `${report.receiptDate}T00:00:00.000Z`, amendmentNumber: report.amendmentNumber, cashOnHand: report.cashOnHandEndPeriod, totalReceipts: report.totalReceiptsYtd, totalDisbursements: report.totalDisbursementsYtd, redactedExtras: { schemaVersion: 1, envelopeChecksumSha256: checksum, candidateId: report.candidateId, electionCycle: report.electionCycle, electionKey, amendmentIndicator: report.amendmentIndicator, amendmentChain: report.amendmentChain, mostRecent: report.mostRecent, mostRecentFileNumber: report.mostRecentFileNumber, missingReasons: { cashOnHand: report.cashOnHandEndPeriod === null ? "not_reported" : null, totalReceipts: report.totalReceiptsYtd === null ? "not_reported" : null, totalDisbursements: report.totalDisbursementsYtd === null ? "not_reported" : null } } };
}

function assertOnlyFecStagingDrift(manifest: Parameters<typeof computeCanonicalDataChecksum>[0], checksum: string, runs: readonly Run[], options: FinalizeCandidateFecOptions): void {
  const sourceIds = new Set(runs.map((run) => run.source_id)); const snapshotIds = new Set(runs.map((run) => run.snapshot_id));
  if (sourceIds.size !== 1 || snapshotIds.size !== runs.length || !sourceIds.has(options.source.id)) fail("FEC_FINALIZE_DRIFT_INVALID");
  const source = manifest.sources.filter((row) => row.id === options.source.id);
  const snapshots = manifest.snapshots.filter((row) => snapshotIds.has(row.id));
  if (source.length !== 1 || !same(source[0], { id: options.source.id, releaseId: options.candidateReleaseId, name: options.source.name, authority: options.source.authority, homepageUrl: options.source.homepageUrl }) || snapshots.length !== runs.length || snapshots.some((row) => row.sourceId !== options.source.id) || manifest.snapshots.some((row) => row.sourceId === options.source.id && !snapshotIds.has(row.id))) fail("FEC_FINALIZE_DRIFT_INVALID");
  const stripped = structuredClone(manifest) as typeof manifest & { canonicalDataChecksumSha256: string }; stripped.sources = stripped.sources.filter((row) => row.id !== options.source.id); stripped.snapshots = stripped.snapshots.filter((row) => !snapshotIds.has(row.id)); stripped.canonicalDataChecksumSha256 = checksum;
  if (!validateReleaseManifest(stripped).success || computeCanonicalDataChecksum(stripped) !== checksum) fail("FEC_FINALIZE_DRIFT_INVALID");
}
const fact = (value: string | null) => value === null ? { value: null, reason: "not_reported" } : { value, reason: null };
const filingId = (sourceFilingId: string): string => `fec_${sha(Buffer.from(sourceFilingId)).slice(0, 48)}`;
function exactMoney(value: string | null): { readonly sql: string | null; readonly manifest: number | null } {
  if (value === null) return { sql: null, manifest: null };
  const cents = normalizeFecCents(value);
  if (cents === "invalid" || cents === null) fail("FEC_FINALIZE_MONEY_INVALID");
  const numeric = Number(cents);
  const sql = `${Math.floor(numeric / 100)}.${String(numeric % 100).padStart(2, "0")}`;
  if (!Number.isSafeInteger(numeric) || normalizeFecCents(sql) !== cents || normalizeFecCents((numeric / 100).toFixed(2)) !== cents) fail("FEC_FINALIZE_MONEY_INVALID");
  return { sql, manifest: numeric / 100 };
}
async function persist(client: PoolClient, options: FinalizeCandidateFecOptions, runs: readonly Run[], envelope: FecSanitizedEnvelopeV1): Promise<ReturnType<typeof structuredClone>> {
  if (runs.length !== 1) fail("FEC_FINALIZE_RUN_INVALID");
  const loaded = await loadNationwideManifestForFinalization(client, options.candidateReleaseId);
  assertOnlyFecStagingDrift(loaded.manifest, loaded.storedCanonicalDataChecksumSha256, runs, options);
  const existing = await client.query<{ filings: boolean; aggregate: boolean }>("SELECT EXISTS(SELECT 1 FROM fec_filing_summaries WHERE release_id=$1 AND seat_cycle_id=$2) filings, EXISTS(SELECT 1 FROM finance_aggregates WHERE release_id=$1 AND seat_cycle_id=$2 AND as_of=$3 AND methodology_version='fec-gross-ytd-v1') aggregate", [options.candidateReleaseId, options.mapping.seatCycleId, options.financeScope.asOf]);
  if (existing.rows[0]?.filings || existing.rows[0]?.aggregate) fail("FEC_FINALIZE_ALREADY_WRITTEN");
  const committees = await client.query<{ id: string; source_committee_id: string }>("SELECT id,source_committee_id FROM committees WHERE release_id=$1", [options.candidateReleaseId]);
  const committeeIds = new Map(committees.rows.map((row) => [row.source_committee_id, row.id]));
  const resolved = resolveFecAmendments(envelope.reports);
  const mapped = { ...options.mapping, committees: options.mapping.committees.map((committee) => ({ ...committee, committeeId: committeeIds.get(committee.committeeId) ?? fail("FEC_FINALIZE_MAPPING_INVALID") })) };
  const filings = resolved.map((filing) => ({ ...filing, filingId: filingId(filing.filingId), amendsSourceFilingId: filing.amendsSourceFilingId === null ? null : filingId(filing.amendsSourceFilingId), committeeId: committeeIds.get(filing.committeeId) ?? fail("FEC_FINALIZE_MAPPING_INVALID") }));
  const aggregate = aggregateFecFinance([mapped], envelope.candidateId, envelope.electionCycle, options.financeScope, filings as ResolvedFecReportVersion[]);
  if (aggregate.kind !== "aggregate") fail("FEC_FINALIZE_NO_COMMITTEE_UNSUPPORTED");
  const exactAggregate = aggregate as Extract<typeof aggregate, { kind: "aggregate" }>;
  for (const filing of filings) {
    const cash = fact(exactMoney(filing.cashOnHandEndPeriod).sql), receipts = fact(exactMoney(filing.totalReceiptsYtd).sql), disbursements = fact(exactMoney(filing.totalDisbursementsYtd).sql);
    await client.query("INSERT INTO fec_filing_summaries(release_id,id,seat_cycle_id,committee_id,source_filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'fec-sanitized-envelope-v1','reported')", [options.candidateReleaseId, filing.filingId, options.mapping.seatCycleId, filing.committeeId, String(filing.fileNumber), filing.reportType, filing.coverageStartDate, filing.coverageEndDate, `${filing.receiptDate}T00:00:00.000Z`, filing.amendmentNumber, filing.status, filing.amendsSourceFilingId, cash.value, cash.reason, receipts.value, receipts.reason, disbursements.value, disbursements.reason, options.financeScope.asOf]);
    await client.query("INSERT INTO fec_filing_lineage(release_id,filing_id,snapshot_id,role) VALUES($1,$2,$3,'original_publisher')", [options.candidateReleaseId, filing.filingId, options.snapshot.id]);
  }
  const aggregateId = `fec-finance:${options.mapping.seatCycleId}:${options.financeScope.reportForm}:${options.financeScope.reportType}:${options.financeScope.coverageStartDate}:${options.financeScope.coverageEndDate}:${options.financeScope.asOf}`;
  const aggregateCash = exactMoney(exactAggregate.cashOnHand.kind === "value" ? exactAggregate.cashOnHand.value : null), aggregateReceipts = exactMoney(exactAggregate.receipts.kind === "value" ? exactAggregate.receipts.value : null), aggregateDisbursements = exactMoney(exactAggregate.disbursements.kind === "value" ? exactAggregate.disbursements.value : null);
  const cash = fact(aggregateCash.sql), receipts = fact(aggregateReceipts.sql), disbursements = fact(aggregateDisbursements.sql);
  await client.query("INSERT INTO finance_aggregates(release_id,id,seat_cycle_id,as_of,coverage_through,reporting_period_start,cash_on_hand,cash_on_hand_missing_reason,receipts,receipts_missing_reason,disbursements,disbursements_missing_reason,methodology_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'fec-gross-ytd-v1')", [options.candidateReleaseId, aggregateId, options.mapping.seatCycleId, options.financeScope.asOf, options.financeScope.coverageEndDate, options.financeScope.coverageStartDate, cash.value, cash.reason, receipts.value, receipts.reason, disbursements.value, disbursements.reason]);
  for (const input of exactAggregate.committeeInputs) await client.query("INSERT INTO finance_aggregate_inputs(release_id,finance_aggregate_id,committee_id,filing_id,missing_reason) VALUES($1,$2,$3,$4,$5)", [options.candidateReleaseId, aggregateId, input.committeeId, input.kind === "included" ? input.filingId : null, input.kind === "missing" ? input.reason : null]);
  const scope = { kind: "funding" as const, seatCycleId: options.mapping.seatCycleId, fundingKind: "summary" as const };
  const scopeKey = JSON.stringify({ kind: "funding", jurisdictionCode: null, seatCycleId: options.mapping.seatCycleId, variable: null, surveyPeriod: null, electionYear: null, fundingKind: "summary" });
  const inputSnapshotIds = [options.mapping.snapshotId, options.snapshot.id].sort();
  await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [options.candidateReleaseId, scopeKey]);
  await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [options.candidateReleaseId, scopeKey]);
  await client.query("DELETE FROM coverage_records WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [options.candidateReleaseId, scopeKey]);
  await client.query("INSERT INTO coverage_records(release_id,domain,scope_key,scope_kind,seat_cycle_id,funding_kind,status,expected_count,observed_count,quarantined_count,incompatible_count) VALUES($1,'finance',$2,'funding',$3,'summary','complete',1,1,0,0)", [options.candidateReleaseId, scopeKey, options.mapping.seatCycleId]);
  for (const snapshotId of inputSnapshotIds) await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,'finance',$2,$3)", [options.candidateReleaseId, scopeKey, snapshotId]);
  const candidate = structuredClone(loaded.manifest);
  candidate.fecFilingSummaries.push(...filings.map((filing) => ({ id: filing.filingId as typeof candidate.fecFilingSummaries[number]["id"], releaseId: options.candidateReleaseId as typeof candidate.release.id, seatCycleId: options.mapping.seatCycleId as typeof candidate.seatCycles[number]["id"], committeeId: filing.committeeId as typeof candidate.committees[number]["id"], sourceFilingId: String(filing.fileNumber), reportType: filing.reportType, reportingPeriodStart: filing.coverageStartDate, reportingPeriodEnd: filing.coverageEndDate, filedAt: `${filing.receiptDate}T00:00:00.000Z`, amendmentNumber: filing.amendmentNumber, amendmentStatus: filing.status, amendsFilingId: filing.amendsSourceFilingId as typeof candidate.fecFilingSummaries[number]["amendsFilingId"], cashOnHand: filing.cashOnHandEndPeriod === null ? { kind: "missing" as const, reason: "not_reported" as const } : { kind: "value" as const, value: exactMoney(filing.cashOnHandEndPeriod).manifest! }, totalReceipts: filing.totalReceiptsYtd === null ? { kind: "missing" as const, reason: "not_reported" as const } : { kind: "value" as const, value: exactMoney(filing.totalReceiptsYtd).manifest! }, totalDisbursements: filing.totalDisbursementsYtd === null ? { kind: "missing" as const, reason: "not_reported" as const } : { kind: "value" as const, value: exactMoney(filing.totalDisbursementsYtd).manifest! }, lineage: { inputs: [{ snapshotId: options.snapshot.id as typeof candidate.snapshots[number]["id"], role: "original_publisher" as const }], asOf: options.financeScope.asOf, methodology: "fec-sanitized-envelope-v1", status: "reported" as const } })));
  candidate.financeAggregates.push({ id: aggregateId, releaseId: options.candidateReleaseId as typeof candidate.release.id, seatCycleId: options.mapping.seatCycleId as typeof candidate.seatCycles[number]["id"], asOf: options.financeScope.asOf, coverageThrough: options.financeScope.coverageEndDate, reportingPeriodStart: options.financeScope.coverageStartDate, cashOnHand: aggregateCash.manifest === null ? { kind: "missing", reason: "not_reported" } : { kind: "value", value: aggregateCash.manifest }, receipts: aggregateReceipts.manifest === null ? { kind: "missing", reason: "not_reported" } : { kind: "value", value: aggregateReceipts.manifest }, disbursements: aggregateDisbursements.manifest === null ? { kind: "missing", reason: "not_reported" } : { kind: "value", value: aggregateDisbursements.manifest }, methodologyVersion: "fec-gross-ytd-v1", committeeInputs: exactAggregate.committeeInputs as typeof candidate.financeAggregates[number]["committeeInputs"] });
  candidate.coverageRecords = candidate.coverageRecords.filter((record) => record.domain !== "finance" || JSON.stringify(record.scope) !== JSON.stringify(scope));
  candidate.coverageRecords.push({ releaseId: options.candidateReleaseId as typeof candidate.release.id, domain: "finance", scope: scope as typeof candidate.coverageRecords[number]["scope"], status: "complete", expectedCount: 1, observedCount: 1, missingByReason: [], quarantinedCount: 0, incompatibleCount: 0, inputSnapshotIds: inputSnapshotIds as typeof candidate.coverageRecords[number]["inputSnapshotIds"] });
  candidate.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(candidate);
  if (!validateReleaseManifest(candidate).success) fail("FEC_FINALIZE_MANIFEST_INVALID");
  // The schema has one seat_finance_summaries row per seat and cannot represent an aggregate without falsely selecting a filing.
  const row = await client.query<{ schema_version: number; canonical_data_checksum_sha256: string; geometry_checksum_sha256: string; content_checksum_sha256: string }>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR UPDATE", [options.candidateReleaseId]);
  if (!row.rows[0]) fail("FEC_FINALIZE_MANIFEST_INVALID");
  const canonical = candidate.canonicalDataChecksumSha256;
  const content = expectedContentChecksum({ ...row.rows[0], canonical_data_checksum_sha256: canonical });
  await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [options.candidateReleaseId, canonical, content]);
  const persisted = await loadNationwideManifest(client, options.candidateReleaseId);
  if (computeCanonicalDataChecksum(persisted) !== candidate.canonicalDataChecksumSha256) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  return candidate;
}

/** Exact finalizer proof for the single canonical FEC envelope. */
async function assertExactPersistedTask8Invariant(client: PoolClient, options: FinalizeCandidateFecOptions, envelopes: readonly FecSanitizedEnvelopeV1[]): Promise<void> {
  if (envelopes.length !== 1) fail("FEC_FINALIZE_RUN_INVALID");
  const committees = await client.query<{ id: string; source_committee_id: string }>("SELECT id,source_committee_id FROM committees WHERE release_id=$1", [options.candidateReleaseId]);
  const committeeIds = new Map(committees.rows.map((row) => [row.source_committee_id, row.id]));
  const expectedResolved = resolveFecAmendments(envelopes[0]!.reports).map((filing) => ({ ...filing, id: filingId(filing.filingId), predecessor: filing.amendsSourceFilingId === null ? null : filingId(filing.amendsSourceFilingId), committeeId: committeeIds.get(filing.committeeId) ?? fail("FEC_FINALIZE_PERSISTED_INVARIANT") }));
  const expectedFilings = expectedResolved.map((filing) => filing.id).sort();
  const actualFilings = await client.query<{ id: string; committee_id: string; source_filing_id: string; report_type: string; reporting_period_start: string; reporting_period_end: string; filed_at: string; amendment_number: number; amendment_status: string; amends_filing_id: string | null; cash_on_hand: string | null; cash_on_hand_missing_reason: string | null; total_receipts: string | null; total_receipts_missing_reason: string | null; total_disbursements: string | null; total_disbursements_missing_reason: string | null; lineage_as_of: string; lineage_methodology: string; lineage_status: string }>("SELECT id,committee_id,source_filing_id,report_type,reporting_period_start,filed_at,reporting_period_end,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status FROM fec_filing_summaries WHERE release_id=$1 AND seat_cycle_id=$2 ORDER BY id", [options.candidateReleaseId, options.mapping.seatCycleId]);
  const equal = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((value, index) => value === right[index]);
  const normalizedActualFilings = actualFilings.rows.map((row) => ({ ...row, reporting_period_start: date(row.reporting_period_start), reporting_period_end: date(row.reporting_period_end), filed_at: new Date(row.filed_at).toISOString(), lineage_as_of: date(row.lineage_as_of) }));
  const expectedRows = expectedResolved.sort((a, b) => a.id.localeCompare(b.id)).map((filing) => ({ id: filing.id, committee_id: filing.committeeId, source_filing_id: String(filing.fileNumber), report_type: filing.reportType, reporting_period_start: filing.coverageStartDate, filed_at: `${filing.receiptDate}T00:00:00.000Z`, reporting_period_end: filing.coverageEndDate, amendment_number: filing.amendmentNumber, amendment_status: filing.status, amends_filing_id: filing.predecessor, cash_on_hand: exactMoney(filing.cashOnHandEndPeriod).sql, cash_on_hand_missing_reason: filing.cashOnHandEndPeriod === null ? "not_reported" : null, total_receipts: exactMoney(filing.totalReceiptsYtd).sql, total_receipts_missing_reason: filing.totalReceiptsYtd === null ? "not_reported" : null, total_disbursements: exactMoney(filing.totalDisbursementsYtd).sql, total_disbursements_missing_reason: filing.totalDisbursementsYtd === null ? "not_reported" : null, lineage_as_of: options.financeScope.asOf, lineage_methodology: "fec-sanitized-envelope-v1", lineage_status: "reported" }));
  if (!equal(actualFilings.rows.map((row) => row.id), expectedFilings) || !same(normalizedActualFilings, expectedRows)) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const lineage = await client.query<{ filing_id: string; snapshot_id: string }>("SELECT filing_id,snapshot_id FROM fec_filing_lineage WHERE release_id=$1 AND filing_id=ANY($2) ORDER BY filing_id,snapshot_id", [options.candidateReleaseId, expectedFilings]);
  if (!equal(lineage.rows.map((row) => `${row.filing_id}:${row.snapshot_id}`), expectedFilings.map((id) => `${id}:${options.snapshot.id}`))) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const aggregateId = `fec-finance:${options.mapping.seatCycleId}:${options.financeScope.reportForm}:${options.financeScope.reportType}:${options.financeScope.coverageStartDate}:${options.financeScope.coverageEndDate}:${options.financeScope.asOf}`;
  const aggregate = await client.query<{ id: string }>("SELECT id FROM finance_aggregates WHERE release_id=$1 AND seat_cycle_id=$2 AND methodology_version='fec-gross-ytd-v1'", [options.candidateReleaseId, options.mapping.seatCycleId]);
  if (!equal(aggregate.rows.map((row) => row.id).sort(), [aggregateId])) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const inputs = await client.query<{ committee_id: string; filing_id: string | null; missing_reason: string | null }>("SELECT committee_id,filing_id,missing_reason FROM finance_aggregate_inputs WHERE release_id=$1 AND finance_aggregate_id=$2 ORDER BY committee_id", [options.candidateReleaseId, aggregateId]);
  const mapped = { ...options.mapping, committees: options.mapping.committees.map((committee) => ({ ...committee, committeeId: committeeIds.get(committee.committeeId) ?? fail("FEC_FINALIZE_PERSISTED_INVARIANT") })) };
  const resolved = resolveFecAmendments(envelopes[0]!.reports).map((filing) => ({ ...filing, filingId: filingId(filing.filingId), committeeId: committeeIds.get(filing.committeeId) ?? fail("FEC_FINALIZE_PERSISTED_INVARIANT") }));
  const expectedAggregate = aggregateFecFinance([mapped], envelopes[0]!.candidateId, envelopes[0]!.electionCycle, options.financeScope, resolved);
  if (expectedAggregate.kind !== "aggregate") fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const expectedInputs = (expectedAggregate as Extract<typeof expectedAggregate, { kind: "aggregate" }>).committeeInputs.map((input) => `${input.committeeId}:${input.kind === "included" ? input.filingId : ""}:${input.kind === "missing" ? input.reason : ""}`).sort();
  if (!equal(inputs.rows.map((row) => `${row.committee_id}:${row.filing_id ?? ""}:${row.missing_reason ?? ""}`), expectedInputs)) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const scopeKey = JSON.stringify({ kind: "funding", jurisdictionCode: null, seatCycleId: options.mapping.seatCycleId, variable: null, surveyPeriod: null, electionYear: null, fundingKind: "summary" });
  const coverage = await client.query<{ status: string; expected_count: number; observed_count: number; quarantined_count: number; incompatible_count: number }>("SELECT status,expected_count,observed_count,quarantined_count,incompatible_count FROM coverage_records WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [options.candidateReleaseId, scopeKey]);
  const coverageInputs = await client.query<{ snapshot_id: string }>("SELECT snapshot_id FROM coverage_input_snapshots WHERE release_id=$1 AND domain='finance' AND scope_key=$2 ORDER BY snapshot_id", [options.candidateReleaseId, scopeKey]);
  const coverageMissing = await client.query("SELECT 1 FROM coverage_missing_reasons WHERE release_id=$1 AND domain='finance' AND scope_key=$2", [options.candidateReleaseId, scopeKey]);
  if (coverage.rowCount !== 1 || coverage.rows[0]?.status !== "complete" || Number(coverage.rows[0]?.expected_count) !== 1 || Number(coverage.rows[0]?.observed_count) !== 1 || Number(coverage.rows[0]?.quarantined_count) !== 0 || Number(coverage.rows[0]?.incompatible_count) !== 0 || coverageMissing.rowCount !== 0 || !equal(coverageInputs.rows.map((row) => row.snapshot_id), [options.mapping.snapshotId, options.snapshot.id].sort())) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
  const statuses = await client.query<{ id: string; status: string }>("SELECT id,status FROM ingest_runs WHERE release_id=$1 AND id=ANY($2) ORDER BY id", [options.candidateReleaseId, options.runIds]);
  if (statuses.rowCount !== options.runIds.length || statuses.rows.some((row) => row.status !== "loaded")) fail("FEC_FINALIZE_PERSISTED_INVARIANT");
}
export async function finalizeCandidateFec(options: FinalizeCandidateFecOptions): Promise<void> {
  assertInput(options); const client = await options.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await assertCandidate(client, options, "FOR UPDATE");
    const runs = await loadRuns(client, options, "FOR UPDATE");
    const envelopes = await Promise.all(runs.map((run) => replayRun(client, options, run)));
    if (runs.every((run) => run.status === "loaded")) {
      await recheckNationwideValidationGate(client, options.candidateReleaseId);
      await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
      await assertExactPersistedTask8Invariant(client, options, envelopes);
    } else {
      if (runs.some((run) => run.status !== "validated") || envelopes.length !== 1) fail("FEC_FINALIZE_MIXED_STATUS");
      await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
      await persist(client, options, runs, envelopes[0]!);
      for (const run of runs) await markLoaded(client, run.id, run.lease_token);
      await validateNationwideCandidateReleaseWithClient(client, options.candidateReleaseId);
      await recheckNationwideValidationGate(client, options.candidateReleaseId);
      await assertExactPersistedTask8Invariant(client, options, envelopes);
    }
    await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && (/^FEC_FINALIZE_/.test(error.message) || error.message.startsWith("Persisted Task"))) throw error; throw new Error("FEC_FINALIZE_FAILED"); } finally { client.release(); }
}
export async function verifyPersistedTask8FecCandidate(options: FinalizeCandidateFecOptions): Promise<void> {
  assertInput(options); const client = await options.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await assertCandidate(client, options, "FOR SHARE");
    const runs = await loadRuns(client, options, "FOR SHARE");
    if (runs.some((run) => run.status !== "loaded")) fail("FEC_FINALIZE_MIXED_STATUS");
    const envelopes = await Promise.all(runs.map((run) => replayRun(client, options, run)));
    await recheckNationwideValidationGateShared(client, options.candidateReleaseId);
    await assertPersistedTask7AcsInvariant(client, options.candidateReleaseId, options.sourceReleaseId);
    await assertExactPersistedTask8Invariant(client, options, envelopes);
    await client.query("COMMIT"); begun = false;
  } catch (error) { if (begun) await client.query("ROLLBACK").catch(() => undefined); if (error instanceof Error && (/^FEC_FINALIZE_/.test(error.message) || error.message.startsWith("Persisted Task"))) throw error; throw new Error("FEC_FINALIZE_FAILED"); } finally { client.release(); }
}
