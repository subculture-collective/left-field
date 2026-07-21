import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  expectedContentChecksum,
  recheckNationwideValidationGate,
  recheckNationwideValidationGateShared,
  validateNationwideCandidateReleaseWithClient,
} from "@/db/catalog-release";
import { markLoaded } from "@/db/ingestion";
import { loadNationwideManifest, loadNationwideManifestForFinalization } from "@/db/manifest";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";
import type { RawObjectResult, RawObjectStore } from "@/ingestion/core/raw-object-store";
import {
  ELECTION_DECISION_SOURCE,
  ELECTION_DECISION_UPSTREAM_RELEASE,
  electionDecisionSourceUrl,
  type ElectionDecisionSourceLockEntry,
} from "./adapter";
import {
  decodeElectionDecisionEnvelope,
  ELECTION_DECISION_ADAPTER_VERSION,
  electionDecisionEnvelopeSha256,
  type ElectionDecisionEnvelopeV1,
} from "./decision-envelope";
import { deriveElectionDecisionStatus } from "./gate";

export interface FinalizeCandidateElectionDecisionsOptions {
  readonly pool: Pool;
  readonly rawStore: RawObjectStore;
  readonly candidateReleaseId: string;
  readonly sourceReleaseId: string;
  readonly runIds: readonly string[];
  readonly sourceLockSha256: string;
  readonly sourceLockEntries: readonly ElectionDecisionSourceLockEntry[];
  readonly signal?: AbortSignal;
}

type LockMode = "FOR UPDATE" | "FOR SHARE";
type Run = QueryResultRow & {
  id: string; source_id: string; snapshot_id: string; adapter_version: string; upstream_release: string;
  raw_store_kind: "local" | "s3"; raw_store_locator: string; raw_object_key: string; raw_object_sha256: string;
  raw_object_byte_size: unknown; raw_object_version_id: string | null; raw_object_etag: string | null;
  lease_token: string; status: string; extracted_count: unknown; staged_count: unknown; quarantined_count: unknown;
  source_cutoff: Date | string; source_name: string; source_authority: string; source_homepage_url: string;
  source_url: string; checksum_sha256: string; published_at: Date | string | null; retrieved_at: Date | string;
  parser_version: string; license: string; usage_status: string;
};
type Replayed = Readonly<{ run: Run; envelope: ElectionDecisionEnvelopeV1; status: "approved" | "unavailable" }>;
export type ElectionDecisionEvidenceUsage = Readonly<{ id: string; usageStatus: string }>;
type Manifest = Awaited<ReturnType<typeof loadNationwideManifest>>;

const fail = (code: string): never => { throw new Error(code); };
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const date = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);
const instant = (value: Date | string): string => new Date(value).toISOString();
const count = (value: unknown): number => { const result = Number(value); if (!Number.isSafeInteger(result) || result < 0) fail("ELECTION_FINALIZE_RUN_INVALID"); return result; };
const scopeKey = (jurisdictionCode: string, electionYear: number): string => JSON.stringify({ kind: "election", jurisdictionCode, seatCycleId: null, variable: null, surveyPeriod: null, electionYear, fundingKind: null });
const decisionKey = (jurisdictionCode: string, electionYear: number): string => `${jurisdictionCode}:${electionYear}`;

export function assertElectionDecisionEvidencePolicy(envelope: ElectionDecisionEnvelopeV1, evidence: readonly ElectionDecisionEvidenceUsage[]): "approved" | "unavailable" {
  const status = deriveElectionDecisionStatus(envelope.decision.gates);
  if (status === "unassessed") fail("ELECTION_FINALIZE_UNASSESSED");
  const gateOrder = ["sourceAuthority", "license", "certification", "reportingUnitGeometry", "nonGeographicPolicy", "allocation", "reconciliation", "rounding", "coverage"] as const;
  const license = envelope.decision.gates.license;
  const firstNonPassed = gateOrder.find((name) => envelope.decision.gates[name].outcome !== "passed");
  const nonLicenseEvidence = new Set(gateOrder.filter((name) => name !== "license").flatMap((name) => envelope.decision.gates[name].evidenceSnapshotIds));
  const restrictedAllowed = status === "unavailable" && firstNonPassed === "license" && license.outcome === "failed" ? new Set(license.evidenceSnapshotIds.filter((id) => !nonLicenseEvidence.has(id))) : new Set<string>();
  if (evidence.some((row) => row.usageStatus !== "approved" && !(row.usageStatus === "restricted" && restrictedAllowed.has(row.id)))) fail("ELECTION_FINALIZE_EVIDENCE_INVALID");
  return status === "approved" ? "approved" : "unavailable";
}

function assertInput(options: FinalizeCandidateElectionDecisionsOptions): void {
  const validEntry = (entry: ElectionDecisionSourceLockEntry) => /^[A-Za-z0-9:_-]{1,128}$/.test(entry.id) && (() => { try { const url = new URL(entry.url); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } })() && /^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.byteSize) && entry.byteSize >= 0 && entry.byteSize <= 128 * 1024 * 1024;
  if (!options.candidateReleaseId || !options.sourceReleaseId || options.candidateReleaseId === options.sourceReleaseId || options.runIds.length < 1 || options.runIds.length > 158 || options.runIds.some((id) => !id) || new Set(options.runIds).size !== options.runIds.length || !/^[a-f0-9]{64}$/.test(options.sourceLockSha256) || options.sourceLockEntries.length < 1 || options.sourceLockEntries.length > 1024 || options.sourceLockEntries.some((entry) => !validEntry(entry)) || new Set(options.sourceLockEntries.map((entry) => entry.id)).size !== options.sourceLockEntries.length) fail("ELECTION_FINALIZE_INPUT_INVALID");
}

async function assertReleaseLineage(client: PoolClient, options: FinalizeCandidateElectionDecisionsOptions, lock: LockMode, statuses: readonly ("candidate" | "retired")[]): Promise<void> {
  const result = await client.query(`SELECT 1 FROM data_releases r JOIN data_releases p ON p.id=r.previous_release_id JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1 AND r.status=ANY($3) AND r.previous_release_id=$2 AND p.status IN ('published','retired') AND r.source_cutoff=p.source_cutoff AND m.schema_version=2 ${lock}`, [options.candidateReleaseId, options.sourceReleaseId, statuses]);
  if (result.rowCount !== 1) fail("ELECTION_FINALIZE_CANDIDATE_INVALID");
}

async function loadRuns(client: PoolClient, options: FinalizeCandidateElectionDecisionsOptions, lock: LockMode): Promise<Run[]> {
  const result = await client.query<Run>(`SELECT ir.*,r.source_cutoff,s.name source_name,s.authority source_authority,s.homepage_url source_homepage_url,ss.source_url,ss.checksum_sha256,ss.published_at,ss.retrieved_at,ss.parser_version,ss.usage_status,ss.license FROM ingest_runs ir JOIN data_releases r ON r.id=ir.release_id JOIN sources s ON s.release_id=ir.release_id AND s.id=ir.source_id JOIN source_snapshots ss ON ss.release_id=ir.release_id AND ss.id=ir.snapshot_id WHERE ir.release_id=$1 AND ir.id=ANY($2) ${lock}`, [options.candidateReleaseId, options.runIds]);
  if (result.rowCount !== options.runIds.length || new Set(result.rows.map((run) => run.snapshot_id)).size !== result.rows.length) fail("ELECTION_FINALIZE_RUN_INVALID");
  return [...result.rows].sort((a, b) => a.id.localeCompare(b.id));
}

function rawReceipt(run: Run): RawObjectResult {
  return { storeKind: run.raw_store_kind, storeLocator: run.raw_store_locator, objectKey: run.raw_object_key, sha256: run.raw_object_sha256, byteSize: count(run.raw_object_byte_size), ...(run.raw_object_version_id === null ? {} : { versionId: run.raw_object_version_id }), ...(run.raw_object_etag === null ? {} : { etag: run.raw_object_etag }) };
}

async function replayRun(client: PoolClient, options: FinalizeCandidateElectionDecisionsOptions, run: Run): Promise<Replayed> {
  const receipt = rawReceipt(run);
  const expectedObjectKey = `elections/decision/${run.raw_object_sha256}.json`;
  const receiptOk = !!run.raw_store_locator && ((run.raw_store_kind === "local" && run.raw_object_key === expectedObjectKey && run.raw_object_version_id === null) || (run.raw_store_kind === "s3" && run.raw_object_key === `${expectedObjectKey}.${run.raw_object_sha256}` && typeof run.raw_object_version_id === "string" && run.raw_object_version_id.length > 0));
  if (!receiptOk || run.checksum_sha256 !== run.raw_object_sha256) fail("ELECTION_FINALIZE_RECEIPT_INVALID");
  const bytes = await options.rawStore.read(receipt, options.signal);
  if (sha256(bytes) !== run.raw_object_sha256 || electionDecisionEnvelopeSha256(bytes) !== run.raw_object_sha256 || bytes.byteLength !== count(run.raw_object_byte_size)) fail("ELECTION_FINALIZE_RAW_MISMATCH");
  let envelope: ElectionDecisionEnvelopeV1;
  try { envelope = decodeElectionDecisionEnvelope(bytes); } catch { return fail("ELECTION_FINALIZE_ENVELOPE_INVALID"); }
  const cutoff = date(run.source_cutoff);
  const expectedUrl = electionDecisionSourceUrl(envelope, run.raw_object_sha256);
  if (run.source_id !== ELECTION_DECISION_SOURCE.id || run.source_name !== ELECTION_DECISION_SOURCE.name || run.source_authority !== ELECTION_DECISION_SOURCE.authority || run.source_homepage_url !== ELECTION_DECISION_SOURCE.homepageUrl || run.snapshot_id !== envelope.decisionSnapshotId || run.source_url !== expectedUrl || run.adapter_version !== ELECTION_DECISION_ADAPTER_VERSION || run.parser_version !== ELECTION_DECISION_ADAPTER_VERSION || run.upstream_release !== ELECTION_DECISION_UPSTREAM_RELEASE || run.published_at !== null || run.license !== "project-generated" || run.usage_status !== "approved" || instant(run.retrieved_at) < instant(run.source_cutoff) || envelope.adapterVersion !== ELECTION_DECISION_ADAPTER_VERSION || envelope.sourceLockSha256 !== options.sourceLockSha256 || envelope.releaseCutoff !== cutoff || count(run.extracted_count) !== 0 || count(run.staged_count) !== 0 || count(run.quarantined_count) !== 0) fail("ELECTION_FINALIZE_RUN_INVALID");
  const staged = await client.query("SELECT 1 FROM stg_elections WHERE run_id=$1 LIMIT 1", [run.id]);
  if (staged.rowCount !== 0) fail("ELECTION_FINALIZE_STAGE_INVALID");
  const entries = new Map(options.sourceLockEntries.map((entry) => [entry.id, entry]));
  if (envelope.evidenceReceipts.some((evidence) => { const entry = entries.get(evidence.lockEntryId); return !entry || entry.url !== evidence.url || entry.sha256 !== evidence.sha256 || entry.byteSize !== evidence.byteSize; }) || new Set(envelope.evidenceReceipts.map((receiptRow) => receiptRow.lockEntryId)).size !== envelope.evidenceReceipts.length) fail("ELECTION_FINALIZE_SOURCE_LOCK_MISMATCH");
  const evidenceIds = envelope.evidenceReceipts.map((row) => row.snapshotId);
  const evidence = await client.query<{ id: string; source_url: string; checksum_sha256: string; usage_status: string }>("SELECT id,source_url,checksum_sha256,usage_status FROM source_snapshots WHERE release_id=$1 AND id=ANY($2) ORDER BY id", [options.candidateReleaseId, evidenceIds]);
  if (evidence.rowCount !== evidenceIds.length) fail("ELECTION_FINALIZE_EVIDENCE_INVALID");
  const expectedEvidence = new Map(envelope.evidenceReceipts.map((row) => [row.snapshotId, row]));
  for (const row of evidence.rows) {
    const expected = expectedEvidence.get(row.id);
    if (!expected || row.source_url !== expected.url || row.checksum_sha256 !== expected.sha256) fail("ELECTION_FINALIZE_EVIDENCE_INVALID");
  }
  const status = assertElectionDecisionEvidencePolicy(envelope, evidence.rows.map((row) => ({ id: row.id, usageStatus: row.usage_status })));
  return { run, envelope, status: status === "approved" ? "approved" : "unavailable" };
}

function targetRecords(manifest: Manifest, replayed: readonly Replayed[]) {
  const keys = new Set<string>();
  const result = replayed.map((item) => {
    const key = decisionKey(item.envelope.decision.jurisdictionCode, item.envelope.decision.electionYear);
    if (keys.has(key)) fail("ELECTION_FINALIZE_DUPLICATE_DECISION");
    keys.add(key);
    const decisions = manifest.electionDecisions.filter((row) => decisionKey(row.jurisdictionCode, row.electionYear) === key);
    const coverages = manifest.coverageRecords.filter((row) => row.domain === `election_${item.envelope.decision.electionYear}` && row.scope.kind === "election" && decisionKey(row.scope.jurisdictionCode, row.scope.electionYear) === key);
    if (decisions.length !== 1 || coverages.length !== 1) fail("ELECTION_FINALIZE_TARGET_INVALID");
    const decision = decisions[0]!;
    const coverage = coverages[0]!;
    if (decision.status !== "unassessed" || decision.inputSnapshotIds.length !== 0 || coverage.status !== "not_collected" || coverage.expectedCount !== 1 || coverage.observedCount !== 0 || coverage.quarantinedCount !== 0 || coverage.incompatibleCount !== 0 || coverage.missingByReason.length !== 1 || coverage.missingByReason[0]?.reason !== "not_collected" || coverage.missingByReason[0]?.count !== 1) fail("ELECTION_FINALIZE_TARGET_INVALID");
    return { item, decision, coverage };
  });
  return result;
}

function assertOnlyReviewStagingDrift(loaded: Manifest, source: Manifest, storedChecksum: string, replayed: readonly Replayed[], options: FinalizeCandidateElectionDecisionsOptions): void {
  const targets = targetRecords(loaded, replayed);
  const reconstructed = structuredClone(loaded);
  const sourceDecisionByKey = new Map(source.electionDecisions.map((row) => [decisionKey(row.jurisdictionCode, row.electionYear), row]));
  const sourceCoverageByKey = new Map(source.coverageRecords.filter((row) => row.scope.kind === "election").map((row) => [decisionKey(row.scope.kind === "election" ? row.scope.jurisdictionCode : "", row.scope.kind === "election" ? row.scope.electionYear : 0), row]));
  for (const { item } of targets) {
    const key = decisionKey(item.envelope.decision.jurisdictionCode, item.envelope.decision.electionYear);
    const oldDecision = sourceDecisionByKey.get(key);
    const oldCoverage = sourceCoverageByKey.get(key);
    if (!oldDecision || !oldCoverage || oldDecision.status !== "unassessed" || oldDecision.inputSnapshotIds.length !== 0 || oldCoverage.status !== "not_collected" || oldCoverage.expectedCount !== 1 || oldCoverage.observedCount !== 0 || oldCoverage.quarantinedCount !== 0 || oldCoverage.incompatibleCount !== 0 || oldCoverage.missingByReason.length !== 1 || oldCoverage.missingByReason[0]?.reason !== "not_collected" || oldCoverage.missingByReason[0]?.count !== 1) fail("ELECTION_FINALIZE_DRIFT_INVALID");
    const currentDecision = loaded.electionDecisions.find((row) => decisionKey(row.jurisdictionCode, row.electionYear) === key);
    const currentCoverage = loaded.coverageRecords.find((row) => row.scope.kind === "election" && decisionKey(row.scope.jurisdictionCode, row.scope.electionYear) === key);
    const expectedDecision = { ...oldDecision, releaseId: options.candidateReleaseId };
    const expectedCoverage = { ...oldCoverage, releaseId: options.candidateReleaseId };
    if (!same(currentDecision, expectedDecision) || !same(currentCoverage, expectedCoverage)) fail("ELECTION_FINALIZE_DRIFT_INVALID");
    reconstructed.electionDecisions = reconstructed.electionDecisions.map((row) => decisionKey(row.jurisdictionCode, row.electionYear) === key ? { ...oldDecision, releaseId: options.candidateReleaseId as typeof row.releaseId } : row) as typeof reconstructed.electionDecisions;
    reconstructed.coverageRecords = reconstructed.coverageRecords.map((row) => row.scope.kind === "election" && decisionKey(row.scope.jurisdictionCode, row.scope.electionYear) === key ? { ...oldCoverage, releaseId: options.candidateReleaseId as typeof row.releaseId } : row) as typeof reconstructed.coverageRecords;
  }
  const currentSnapshotIds = new Set(replayed.map((item) => item.run.snapshot_id));
  reconstructed.snapshots = reconstructed.snapshots.filter((row) => !currentSnapshotIds.has(row.id));
  const sourceWasStored = source.sources.some((row) => row.id === ELECTION_DECISION_SOURCE.id) || reconstructed.snapshots.some((row) => row.sourceId === ELECTION_DECISION_SOURCE.id);
  if (!sourceWasStored) reconstructed.sources = reconstructed.sources.filter((row) => row.id !== ELECTION_DECISION_SOURCE.id);
  reconstructed.canonicalDataChecksumSha256 = storedChecksum;
  if (!validateReleaseManifest(reconstructed).success || computeCanonicalDataChecksum(reconstructed) !== storedChecksum) fail("ELECTION_FINALIZE_DRIFT_INVALID");
}

async function persist(client: PoolClient, options: FinalizeCandidateElectionDecisionsOptions, replayed: readonly Replayed[]): Promise<void> {
  const loaded = await loadNationwideManifestForFinalization(client, options.candidateReleaseId);
  const source = await loadNationwideManifest(client, options.sourceReleaseId);
  assertOnlyReviewStagingDrift(loaded.manifest, source, loaded.storedCanonicalDataChecksumSha256, replayed, options);
  const targets = targetRecords(loaded.manifest, replayed);
  const candidate = structuredClone(loaded.manifest);
  for (const { item, decision, coverage } of targets) {
    const snapshotId = item.run.snapshot_id;
    const evidenceIds = item.envelope.decision.evidenceSnapshotIds;
    const key = decisionKey(decision.jurisdictionCode, decision.electionYear);
    const existingDerivation = candidate.snapshotDerivations.filter((row) => row.outputSnapshotId === snapshotId);
    if (existingDerivation.length) fail("ELECTION_FINALIZE_ALREADY_WRITTEN");
    await client.query("INSERT INTO snapshot_derivations(release_id,output_snapshot_id,methodology_version) VALUES($1,$2,$3)", [options.candidateReleaseId, snapshotId, ELECTION_DECISION_ADAPTER_VERSION]);
    for (const evidenceId of evidenceIds) await client.query("INSERT INTO snapshot_derivation_inputs(release_id,output_snapshot_id,input_snapshot_id) VALUES($1,$2,$3)", [options.candidateReleaseId, snapshotId, evidenceId]);
    await client.query("UPDATE election_decisions SET status=$3 WHERE release_id=$1 AND id=$2", [options.candidateReleaseId, decision.id, item.status]);
    await client.query("INSERT INTO election_decision_inputs(release_id,election_decision_id,snapshot_id) VALUES($1,$2,$3)", [options.candidateReleaseId, decision.id, snapshotId]);
    const sqlScopeKey = scopeKey(decision.jurisdictionCode, decision.electionYear);
    await client.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [options.candidateReleaseId, `election_${decision.electionYear}`, sqlScopeKey]);
    await client.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [options.candidateReleaseId, `election_${decision.electionYear}`, sqlScopeKey]);
    await client.query("UPDATE coverage_records SET status=$4,observed_count=$5 WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [options.candidateReleaseId, `election_${decision.electionYear}`, sqlScopeKey, item.status === "approved" ? "complete" : "unavailable", item.status === "approved" ? 1 : 0]);
    if (item.status === "unavailable") await client.query("INSERT INTO coverage_missing_reasons(release_id,domain,scope_key,reason,count) VALUES($1,$2,$3,'not_defensibly_modeled',1)", [options.candidateReleaseId, `election_${decision.electionYear}`, sqlScopeKey]);
    await client.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) VALUES($1,$2,$3,$4)", [options.candidateReleaseId, `election_${decision.electionYear}`, sqlScopeKey, snapshotId]);
    candidate.snapshotDerivations.push({ releaseId: options.candidateReleaseId as never, outputSnapshotId: snapshotId as never, inputSnapshotIds: evidenceIds as never, methodologyVersion: ELECTION_DECISION_ADAPTER_VERSION });
    candidate.electionDecisions = candidate.electionDecisions.map((row) => decisionKey(row.jurisdictionCode, row.electionYear) === key ? { ...row, status: item.status, inputSnapshotIds: [snapshotId] as never } : row) as typeof candidate.electionDecisions;
    candidate.coverageRecords = candidate.coverageRecords.map((row) => row.scope.kind === "election" && decisionKey(row.scope.jurisdictionCode, row.scope.electionYear) === key ? { ...coverage, status: item.status === "approved" ? "complete" as const : "unavailable" as const, observedCount: item.status === "approved" ? 1 : 0, missingByReason: item.status === "approved" ? [] : [{ reason: "not_defensibly_modeled" as const, count: 1 }], inputSnapshotIds: [snapshotId] as never } : row) as typeof candidate.coverageRecords;
  }
  candidate.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(candidate);
  if (!validateReleaseManifest(candidate).success) fail("ELECTION_FINALIZE_MANIFEST_INVALID");
  const metadata = await client.query<{ schema_version: number; canonical_data_checksum_sha256: string; geometry_checksum_sha256: string; content_checksum_sha256: string }>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR UPDATE", [options.candidateReleaseId]);
  if (metadata.rowCount !== 1 || metadata.rows[0]?.schema_version !== 2) fail("ELECTION_FINALIZE_MANIFEST_INVALID");
  const canonical = candidate.canonicalDataChecksumSha256;
  const content = expectedContentChecksum({ ...metadata.rows[0]!, canonical_data_checksum_sha256: canonical });
  await client.query("UPDATE release_manifests SET canonical_data_checksum_sha256=$2,content_checksum_sha256=$3,validated_at=NULL WHERE release_id=$1", [options.candidateReleaseId, canonical, content]);
  const persisted = await loadNationwideManifest(client, options.candidateReleaseId);
  if (computeCanonicalDataChecksum(persisted) !== canonical) fail("ELECTION_FINALIZE_PERSISTED_INVARIANT");
}

async function assertExactPersistedInvariant(client: PoolClient, options: FinalizeCandidateElectionDecisionsOptions, replayed: readonly Replayed[]): Promise<void> {
  const manifest = await loadNationwideManifest(client, options.candidateReleaseId);
  for (const item of replayed) {
    const { decision } = item.envelope;
    const rows = manifest.electionDecisions.filter((row) => row.jurisdictionCode === decision.jurisdictionCode && row.electionYear === decision.electionYear);
    if (rows.length !== 1 || rows[0]?.status !== item.status || !same(rows[0]?.inputSnapshotIds, [item.run.snapshot_id])) fail("ELECTION_FINALIZE_PERSISTED_INVARIANT");
    const coverage = manifest.coverageRecords.filter((row) => row.domain === `election_${decision.electionYear}` && row.scope.kind === "election" && row.scope.jurisdictionCode === decision.jurisdictionCode && row.scope.electionYear === decision.electionYear);
    const expectedCoverage = item.status === "approved" ? { status: "complete", observed: 1, missing: [] } : { status: "unavailable", observed: 0, missing: [{ reason: "not_defensibly_modeled", count: 1 }] };
    if (coverage.length !== 1 || coverage[0]?.status !== expectedCoverage.status || coverage[0]?.expectedCount !== 1 || coverage[0]?.observedCount !== expectedCoverage.observed || coverage[0]?.quarantinedCount !== 0 || coverage[0]?.incompatibleCount !== 0 || !same(coverage[0]?.missingByReason, expectedCoverage.missing) || !same(coverage[0]?.inputSnapshotIds, [item.run.snapshot_id])) fail("ELECTION_FINALIZE_PERSISTED_INVARIANT");
    const derivations = manifest.snapshotDerivations.filter((row) => row.outputSnapshotId === item.run.snapshot_id);
    if (derivations.length !== 1 || derivations[0]?.methodologyVersion !== ELECTION_DECISION_ADAPTER_VERSION || !same(derivations[0]?.inputSnapshotIds, decision.evidenceSnapshotIds)) fail("ELECTION_FINALIZE_PERSISTED_INVARIANT");
  }
  const statuses = await client.query<{ id: string; status: string }>("SELECT id,status FROM ingest_runs WHERE release_id=$1 AND id=ANY($2) ORDER BY id", [options.candidateReleaseId, options.runIds]);
  if (statuses.rowCount !== options.runIds.length || statuses.rows.some((row) => row.status !== "loaded")) fail("ELECTION_FINALIZE_PERSISTED_INVARIANT");
}

export async function finalizeCandidateElectionDecisions(options: FinalizeCandidateElectionDecisionsOptions): Promise<void> {
  assertInput(options);
  const client = await options.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await assertReleaseLineage(client, options, "FOR UPDATE", ["candidate"]);
    const runs = await loadRuns(client, options, "FOR UPDATE");
    const replayed = await Promise.all(runs.map((run) => replayRun(client, options, run)));
    const usedLockEntries = new Set(replayed.flatMap((item) => item.envelope.evidenceReceipts.map((receipt) => receipt.lockEntryId)));
    if (usedLockEntries.size !== options.sourceLockEntries.length || options.sourceLockEntries.some((entry) => !usedLockEntries.has(entry.id))) fail("ELECTION_FINALIZE_SOURCE_LOCK_MISMATCH");
    if (runs.every((run) => run.status === "loaded")) {
      await recheckNationwideValidationGate(client, options.candidateReleaseId);
      await assertExactPersistedInvariant(client, options, replayed);
    } else {
      if (runs.some((run) => run.status !== "validated")) fail("ELECTION_FINALIZE_MIXED_STATUS");
      await persist(client, options, replayed);
      for (const run of runs) await markLoaded(client, run.id, run.lease_token);
      await validateNationwideCandidateReleaseWithClient(client, options.candidateReleaseId);
      await recheckNationwideValidationGate(client, options.candidateReleaseId);
      await assertExactPersistedInvariant(client, options, replayed);
      await loadNationwideManifest(client, options.candidateReleaseId);
    }
    await client.query("COMMIT"); begun = false;
  } catch (error) {
    if (begun) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && /^ELECTION_FINALIZE_/.test(error.message)) throw error;
    throw new Error("ELECTION_FINALIZE_FAILED");
  } finally { client.release(); }
}

export async function verifyPersistedTask9ElectionCandidate(options: FinalizeCandidateElectionDecisionsOptions): Promise<void> {
  assertInput(options);
  const client = await options.pool.connect(); let begun = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); begun = true;
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('dsa_seats_release:' || $1))", [options.candidateReleaseId]);
    await verifyPersistedTask9ElectionWithClient(client, options, ["candidate"]);
    await recheckNationwideValidationGateShared(client, options.candidateReleaseId);
    await client.query("COMMIT"); begun = false;
  } catch (error) {
    if (begun) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof Error && /^ELECTION_FINALIZE_/.test(error.message)) throw error;
    throw new Error("ELECTION_FINALIZE_FAILED");
  } finally { client.release(); }
}

/** Replays exact Task 9 evidence while the caller holds the publication lock. */
export async function verifyPersistedTask9ElectionWithClient(
  client: PoolClient,
  options: FinalizeCandidateElectionDecisionsOptions,
  statuses: readonly ("candidate" | "retired")[] = ["candidate"],
): Promise<void> {
  assertInput(options);
  await assertReleaseLineage(client, options, "FOR SHARE", statuses);
  const runs = await loadRuns(client, options, "FOR SHARE");
  if (runs.some((run) => run.status !== "loaded")) fail("ELECTION_FINALIZE_MIXED_STATUS");
  const replayed = await Promise.all(runs.map((run) => replayRun(client, options, run)));
  const usedLockEntries = new Set(replayed.flatMap((item) => item.envelope.evidenceReceipts.map((receipt) => receipt.lockEntryId)));
  if (usedLockEntries.size !== options.sourceLockEntries.length || options.sourceLockEntries.some((entry) => !usedLockEntries.has(entry.id))) fail("ELECTION_FINALIZE_SOURCE_LOCK_MISMATCH");
  await assertExactPersistedInvariant(client, options, replayed);
  await loadNationwideManifest(client, options.candidateReleaseId);
}
