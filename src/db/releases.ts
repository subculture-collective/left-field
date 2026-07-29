import type { Pool, PoolClient } from "pg";
import { verifyPersistedTask9ElectionWithClient, type FinalizeCandidateElectionDecisionsOptions } from "@/ingestion/elections/finalize-elections";
import { validatePrototypeManifest } from "@/domain/validate-manifest";
import { loadNationwideManifest, loadPrototypeManifest } from "./manifest";
import { recheckNationwideValidationGateShared } from "./catalog-release";
import { createHash, randomUUID } from "node:crypto";
import type { MapArtifactReceipt, MapArtifactStore } from "@/maps/map-artifact-store";
import { isCanonicalDistrictGeoJson } from "@/maps/public-map";
import { boundedDuration, boundedFailureCode, emitOperationalSignal, signalTimestamp, type OperationalSignalSink } from "@/operations/signals";
import {
  verifyElectionPublicationProofWithClient,
  verifyFinancePublicationProofWithClient,
  verifyFecV2PublicationProofWithClient,
  prepareFecV2ArtifactTranscriptWithClient,
  type ElectionPublicationProof as LaunchElectionPublicationProof,
  type FinancePublicationProof,
  type FecV2PublicationProof,
  type FecV2ArtifactVerifier,
  type FecV2ArtifactVerificationBundle,
  type LaunchArtifactStoreResolver,
  type PublicKeyResolver,
  type SignatureVerifier,
} from "./launch-data-proofs";

const SERIALIZATION_FAILURE = "40001";
export type ElectionPublicationProof = Omit<FinalizeCandidateElectionDecisionsOptions, "pool" | "candidateReleaseId">;
export interface LaunchPublicationEvidence {
  readonly finance?:
    | { readonly kind: "fec_v1"; readonly proof: FinancePublicationProof; readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly stores: LaunchArtifactStoreResolver }
    | { readonly kind: "fec_v2_exact_election"; readonly proof: FecV2PublicationProof; readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly artifactVerifier: FecV2ArtifactVerifier };
  readonly election?: { readonly proof: LaunchElectionPublicationProof; readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly stores: LaunchArtifactStoreResolver };
}
/** @deprecated Compatibility only for persisted callers; new callers must use the orthogonal root object. */
type LegacyLaunchPublicationEvidence =
  | { readonly kind: "finance"; readonly proof: FinancePublicationProof; readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly stores: LaunchArtifactStoreResolver }
  | { readonly kind: "election"; readonly proof: LaunchElectionPublicationProof; readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly stores: LaunchArtifactStoreResolver };
type AnyLaunchPublicationEvidence = LaunchPublicationEvidence | LegacyLaunchPublicationEvidence;
const normalizeEvidence = (evidence: AnyLaunchPublicationEvidence | undefined): LaunchPublicationEvidence | undefined => {
  if (!evidence || !("kind" in evidence)) return evidence;
  return evidence.kind === "finance" ? { finance: { kind: "fec_v1", proof: evidence.proof, resolver: evidence.resolver, verifier: evidence.verifier, stores: evidence.stores } } : { election: { proof: evidence.proof, resolver: evidence.resolver, verifier: evidence.verifier, stores: evidence.stores } };
};
/** Required out-of-database evidence before a map-bearing release can be public. */
export interface MapPublicationProof { readonly store: MapArtifactStore; }
/** Separate least-privilege connections for capability issuance and consumption. */
export interface ReleaseLifecyclePools { readonly preflightPool?: Pool; readonly launchVerifierPool?: Pool; readonly operatorPool?: Pool; readonly signalSink?: OperationalSignalSink; readonly launchEvidence?: AnyLaunchPublicationEvidence; /** Bounded FEC V2 replay window (1 second through 8 hours). */ readonly artifactReplayTimeoutMs?: number; }
type LaunchStageValidation = { readonly stage: "legacy" | "member" | "acs" | "finance" | "election" | "maps"; readonly proofKind?: "member" | "acs" | "finance" | "election" | "maps" | "fec_v2_finance" | "fec_v2_election" | "fec_v2_maps"; readonly canonicalSha256?: string };
export type FecV2CombinedStage = "finance" | "election" | "maps";
export function fecV2CombinedStageBytes(releaseId: string, stage: FecV2CombinedStage, financeCanonicalSha256: string | null, electionCanonicalSha256: string | null, mapReceiptsFingerprint: string | null): Uint8Array {
  const hash = (value: string | null): boolean => value === null || /^[a-f0-9]{64}$/.test(value);
  if (!releaseId || !hash(financeCanonicalSha256) || !hash(electionCanonicalSha256) || !hash(mapReceiptsFingerprint)
    || (stage === "finance" && (!financeCanonicalSha256 || electionCanonicalSha256 !== null || mapReceiptsFingerprint !== null))
    || (stage === "election" && (!financeCanonicalSha256 || !electionCanonicalSha256 || mapReceiptsFingerprint !== null))
    || (stage === "maps" && (!financeCanonicalSha256 || electionCanonicalSha256 !== null || !mapReceiptsFingerprint))) throw new Error("Invalid FEC V2 combined launch stage");
  return new TextEncoder().encode(`${JSON.stringify({ schemaVersion: 1, releaseId, stage, financeCanonicalSha256, electionCanonicalSha256, mapReceiptsFingerprint })}\n`);
}
export const fecV2CombinedStageSha256 = (releaseId: string, stage: FecV2CombinedStage, financeCanonicalSha256: string | null, electionCanonicalSha256: string | null, mapReceiptsFingerprint: string | null): string => createHash("sha256").update(fecV2CombinedStageBytes(releaseId, stage, financeCanonicalSha256, electionCanonicalSha256, mapReceiptsFingerprint)).digest("hex");

async function issuePreflight(client: PoolClient, operation: "promote" | "roll_forward", releaseId: string, currentId: string | null, predecessorId: string | null, runIds?: readonly string[]): Promise<string> {
  const proofId = randomUUID();
  await client.query("SELECT public.issue_release_preflight($1,$2,$3,$4,$5,$6,$7)", [proofId, operation, releaseId, currentId, predecessorId, runIds ?? null, 300]);
  return proofId;
}

async function consumeLifecycle(pool: Pool, sql: string, args: unknown[]): Promise<void> {
  const client = await pool.connect();
  try { await client.query(sql, args); } finally { client.release(); }
}

async function lockReleases(client: PoolClient, ids: readonly (string | null | undefined)[]): Promise<void> {
  for (const id of [...new Set(ids.filter((value): value is string => value !== null && value !== undefined))].sort()) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [id]);
  }
}

const launchCutoff = "2026-07-18";

async function assertInheritedFinance(client: PoolClient, releaseId: string, predecessorId: string): Promise<void> {
  await recheckNationwideValidationGateShared(client, predecessorId);
  const result = await client.query<{ equal: boolean }>(`
    SELECT EXISTS(
      SELECT 1 FROM release_content_digests target
      JOIN release_content_digests predecessor
        ON predecessor.release_id=$2 AND predecessor.domain='finance'
      WHERE target.release_id=$1 AND target.domain='finance'
        AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
    ) AS equal`, [releaseId, predecessorId]);
  if (!result.rows[0]?.equal) throw new Error(`Election release ${releaseId} did not inherit predecessor finance content`);
}
async function inheritedElectionSha(client: PoolClient, releaseId: string, predecessorId: string): Promise<string> {
  const result = await client.query<{ canonical_sha256: string; equal: boolean }>(`SELECT p.canonical_sha256, EXISTS(SELECT 1 FROM release_content_digests t JOIN release_content_digests q ON q.release_id=$2 AND q.domain='elections' WHERE t.release_id=$1 AND t.domain='elections' AND (t.row_count,t.sha256)=(q.row_count,q.sha256)) equal FROM election_publication_proofs p WHERE p.release_id=$2`, [releaseId, predecessorId]);
  if (result.rowCount !== 1 || !result.rows[0]?.equal || !/^[a-f0-9]{64}$/.test(result.rows[0].canonical_sha256)) throw new Error(`Map release ${releaseId} did not inherit exact predecessor election proof`);
  return result.rows[0].canonical_sha256;
}

async function validateLaunchStage(
  client: PoolClient,
  releaseId: string,
  predecessorId: string | null,
  hasMaps: boolean,
  legacyElectionProof: ElectionPublicationProof | undefined,
  evidence: LaunchPublicationEvidence | undefined,
  bundle?: FecV2ArtifactVerificationBundle,
): Promise<LaunchStageValidation> {
  const state = await client.query<{
    cutoff: string;
    finance_proofs: number;
    election_proofs: number;
    finance_content: boolean;
    election_content: boolean;
    predecessor_finance_proofs: number;
    predecessor_election_proofs: number;
    predecessor_finance_content: boolean;
    predecessor_election_content: boolean;
    finance_facts: boolean;
    election_facts: boolean;
    v2_content: boolean;
    route: string | null;
    predecessor_finance_facts: boolean;
    predecessor_election_facts: boolean;
    v2_publication_proofs: number;
    predecessor_v2_publication_proofs: number;
    maps: number;
    predecessor_maps: number;
    member_facts: number;
    predecessor_member_facts: number;
    acs_facts: number;
    predecessor_acs_facts: number;
    inherited_nonfactual: boolean;
    inherited_member: boolean;
    inherited_acs: boolean;
    manifest_content_sha256: string;
  }>(`
    SELECT to_char(r.source_cutoff AT TIME ZONE 'UTC','YYYY-MM-DD') cutoff,
      (SELECT content_checksum_sha256 FROM release_manifests m WHERE m.release_id=r.id) manifest_content_sha256,
      (SELECT count(*)::int FROM finance_publication_proofs p WHERE p.release_id=r.id) finance_proofs,
      (SELECT count(*)::int FROM election_publication_proofs p WHERE p.release_id=r.id) election_proofs,
      EXISTS(SELECT 1 FROM finance_launch_receipts f WHERE f.release_id=r.id) finance_content,
      EXISTS(SELECT 1 FROM election_launch_receipts e WHERE e.release_id=r.id) election_content,
      EXISTS(SELECT 1 FROM fec_v2_plans p WHERE p.release_id=r.id) v2_content,
      (SELECT count(*)::int FROM fec_v2_publication_proofs p WHERE p.release_id=r.id) v2_publication_proofs,
      (SELECT count(*)::int FROM map_artifacts m WHERE m.release_id=r.id) maps,
      (SELECT route FROM finance_proof_routes f WHERE f.release_id=r.id) route,
      (SELECT count(*)::int FROM finance_publication_proofs p WHERE p.release_id=r.previous_release_id) predecessor_finance_proofs,
      (SELECT count(*)::int FROM election_publication_proofs p WHERE p.release_id=r.previous_release_id) predecessor_election_proofs,
      (SELECT count(*)::int FROM fec_v2_publication_proofs p WHERE p.release_id=r.previous_release_id) predecessor_v2_publication_proofs,
      (SELECT count(*)::int FROM map_artifacts m WHERE m.release_id=r.previous_release_id) predecessor_maps,
      (SELECT count(*)::int FROM biographical_facts b WHERE b.release_id=r.id) member_facts,
      (SELECT count(*)::int FROM biographical_facts b WHERE b.release_id=r.previous_release_id) predecessor_member_facts,
      (SELECT count(*)::int FROM acs_observations a WHERE a.release_id=r.id) acs_facts,
      (SELECT count(*)::int FROM acs_observations a WHERE a.release_id=r.previous_release_id) predecessor_acs_facts,
      NOT EXISTS(
        SELECT 1 FROM unnest(ARRAY['identity','geography','finance','elections','maps']::text[]) AS domains(domain_name)
        WHERE NOT EXISTS(
          SELECT 1 FROM release_content_digests target
          JOIN release_content_digests predecessor
            ON predecessor.release_id=r.previous_release_id AND predecessor.domain=domains.domain_name
          WHERE target.release_id=r.id AND target.domain=domains.domain_name
            AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
        )
      ) inherited_nonfactual,
      EXISTS(
        SELECT 1 FROM release_content_digests target
        JOIN release_content_digests predecessor
          ON predecessor.release_id=r.previous_release_id AND predecessor.domain='member'
        WHERE target.release_id=r.id AND target.domain='member'
          AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
      ) inherited_member,
      EXISTS(
        SELECT 1 FROM release_content_digests target
        JOIN release_content_digests predecessor
          ON predecessor.release_id=r.previous_release_id AND predecessor.domain='acs'
        WHERE target.release_id=r.id AND target.domain='acs'
          AND (target.row_count,target.sha256)=(predecessor.row_count,predecessor.sha256)
      ) inherited_acs,
      EXISTS(SELECT 1 FROM finance_launch_receipts f WHERE f.release_id=r.previous_release_id) predecessor_finance_content,
      EXISTS(SELECT 1 FROM election_launch_receipts e WHERE e.release_id=r.previous_release_id) predecessor_election_content,
      EXISTS(SELECT 1 FROM fec_filing_summaries f WHERE f.release_id=r.id UNION ALL SELECT 1 FROM seat_finance_summaries f WHERE f.release_id=r.id AND f.filing_id IS NOT NULL UNION ALL SELECT 1 FROM finance_aggregates f WHERE f.release_id=r.id AND (f.cash_on_hand IS NOT NULL OR f.receipts IS NOT NULL OR f.disbursements IS NOT NULL) UNION ALL SELECT 1 FROM funding_category_aggregates f WHERE f.release_id=r.id AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM funding_organization_aggregates f WHERE f.release_id=r.id AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM outside_spending_aggregates f WHERE f.release_id=r.id AND (f.support_amount IS NOT NULL OR f.oppose_amount IS NOT NULL)) finance_facts,
      EXISTS(SELECT 1 FROM election_decisions e WHERE e.release_id=r.id AND e.status<>'unassessed' UNION ALL SELECT 1 FROM contests c WHERE c.release_id=r.id AND EXTRACT(YEAR FROM c.election_date)::int IN(2020,2022,2024) UNION ALL SELECT 1 FROM election_results e WHERE e.release_id=r.id) election_facts,
      EXISTS(SELECT 1 FROM fec_filing_summaries f WHERE f.release_id=r.previous_release_id UNION ALL SELECT 1 FROM seat_finance_summaries f WHERE f.release_id=r.previous_release_id AND f.filing_id IS NOT NULL UNION ALL SELECT 1 FROM finance_aggregates f WHERE f.release_id=r.previous_release_id AND (f.cash_on_hand IS NOT NULL OR f.receipts IS NOT NULL OR f.disbursements IS NOT NULL) UNION ALL SELECT 1 FROM funding_category_aggregates f WHERE f.release_id=r.previous_release_id AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM funding_organization_aggregates f WHERE f.release_id=r.previous_release_id AND f.amount IS NOT NULL UNION ALL SELECT 1 FROM outside_spending_aggregates f WHERE f.release_id=r.previous_release_id AND (f.support_amount IS NOT NULL OR f.oppose_amount IS NOT NULL)) predecessor_finance_facts,
      EXISTS(SELECT 1 FROM election_decisions e WHERE e.release_id=r.previous_release_id AND e.status<>'unassessed' UNION ALL SELECT 1 FROM contests c WHERE c.release_id=r.previous_release_id AND EXTRACT(YEAR FROM c.election_date)::int IN(2020,2022,2024) UNION ALL SELECT 1 FROM election_results e WHERE e.release_id=r.previous_release_id) predecessor_election_facts
    FROM data_releases r WHERE r.id=$1`, [releaseId]);
  const row = state.rows[0];
  if (!row) throw new Error(`Release ${releaseId} is missing`);
  if (row.cutoff !== launchCutoff) {
    if (evidence) throw new Error(`Launch publication evidence is only valid for cutoff ${launchCutoff}`);
    return { stage: "legacy" };
  }
  const finance = evidence?.finance;
  const election = evidence?.election;
  const isV2 = row.v2_content || row.route === "fec_v2_exact_election";
  if (isV2) {
    if (row.route !== "fec_v2_exact_election" || !row.v2_content || row.v2_publication_proofs !== 1 || row.finance_proofs !== 0 || row.finance_content || !finance || finance.kind !== "fec_v2_exact_election" || finance.proof.releaseId !== releaseId || !bundle) throw new Error(`FEC V2 release ${releaseId} requires only its sealed V2 publication route and replay bundle`);
    const financeSha = await verifyFecV2PublicationProofWithClient(client, finance.proof, finance.resolver, finance.verifier, bundle);
    if (hasMaps) {
      if (row.maps !== 441 || election || row.election_proofs !== 0 || row.election_content || row.election_facts || !predecessorId || row.predecessor_v2_publication_proofs !== 1 || row.predecessor_election_proofs !== 1 || !row.predecessor_election_content || !row.predecessor_election_facts || row.predecessor_maps !== 0) throw new Error(`FEC V2 map release ${releaseId} requires exact V2 finance and predecessor election evidence`);
      await assertInheritedFinance(client, releaseId, predecessorId);
      const fingerprint = await client.query<{ map_receipts_fingerprint: string }>("SELECT map_receipts_fingerprint FROM public.release_preflight_fingerprint($1,NULL)", [releaseId]);
      await inheritedElectionSha(client, releaseId, predecessorId);
      return { stage: "maps", proofKind: "fec_v2_maps", canonicalSha256: fecV2CombinedStageSha256(releaseId, "maps", financeSha, null, fingerprint.rows[0]!.map_receipts_fingerprint) };
    }
    if (row.election_proofs === 0) {
      if (row.maps !== 0 || election || row.election_content || row.election_facts || row.predecessor_v2_publication_proofs !== 0 || row.predecessor_election_proofs !== 0 || row.predecessor_finance_proofs !== 0 || row.predecessor_finance_content || row.predecessor_election_content || row.predecessor_finance_facts || row.predecessor_election_facts || row.predecessor_maps !== 0) throw new Error(`FEC V2 finance release ${releaseId} requires no election component or predecessor launch proof`);
      return { stage: "finance", proofKind: "fec_v2_finance", canonicalSha256: fecV2CombinedStageSha256(releaseId, "finance", financeSha, null, null) };
    }
    if (row.election_proofs !== 1 || row.maps !== 0 || !election || election.proof.releaseId !== releaseId || !row.election_content || !row.election_facts || !predecessorId || row.predecessor_v2_publication_proofs !== 1 || row.predecessor_finance_proofs !== 0 || row.predecessor_election_proofs !== 0 || row.predecessor_finance_content || row.predecessor_election_content || row.predecessor_finance_facts || row.predecessor_election_facts || row.predecessor_maps !== 0) throw new Error(`FEC V2 election release ${releaseId} requires exact V2 finance and election evidence`);
    await assertInheritedFinance(client, releaseId, predecessorId);
    const electionSha = await verifyElectionPublicationProofWithClient(client, election.proof, election.resolver, election.verifier, election.stores);
    return { stage: "election", proofKind: "fec_v2_election", canonicalSha256: fecV2CombinedStageSha256(releaseId, "election", financeSha, electionSha, null) };
  }
  if (hasMaps) {
    if (evidence || row.finance_proofs !== 0 || row.election_proofs !== 0 || !row.finance_content || !row.election_content || !row.finance_facts || !row.election_facts || !predecessorId || row.predecessor_finance_proofs !== 0 || row.predecessor_election_proofs !== 1 || !row.predecessor_finance_content || !row.predecessor_election_content || !row.predecessor_finance_facts || !row.predecessor_election_facts) throw new Error(`Production map release ${releaseId} requires an exact proofed R3 predecessor and no target launch proof`);
    await assertInheritedFinance(client, releaseId, predecessorId);
    const fingerprint = await client.query<{ map_receipts_fingerprint: string }>("SELECT map_receipts_fingerprint FROM public.release_preflight_fingerprint($1,NULL)", [releaseId]);
    return { stage: "maps", canonicalSha256: fingerprint.rows[0]!.map_receipts_fingerprint };
  }
  if (predecessorId === null) {
    if (evidence || row.finance_proofs !== 0 || row.election_proofs !== 0 || row.finance_content || row.election_content || row.finance_facts || row.election_facts) throw new Error(`Initial production release ${releaseId} must not contain R2/R3 launch evidence or public facts`);
    return { stage: "legacy" };
  }
  const factualOnly =
    !evidence
    && !legacyElectionProof?.runIds.length
    && row.finance_proofs === 0
    && row.election_proofs === 0
    && !row.finance_content
    && !row.election_content
    && !row.finance_facts
    && !row.election_facts
    && !row.v2_content
    && row.v2_publication_proofs === 0
    && row.maps === 0
    && row.predecessor_finance_proofs === 0
    && row.predecessor_election_proofs === 0
    && !row.predecessor_finance_content
    && !row.predecessor_election_content
    && !row.predecessor_finance_facts
    && !row.predecessor_election_facts
    && row.predecessor_v2_publication_proofs === 0
    && row.predecessor_maps === 0;
  const memberStage =
    factualOnly
    && row.inherited_nonfactual
    && row.member_facts > 0
    && row.predecessor_member_facts === 0
    && row.acs_facts === 0
    && row.predecessor_acs_facts === 0
    && !row.inherited_member
    && row.inherited_acs;
  const acsStage =
    factualOnly
    && row.member_facts > 0
    && row.member_facts === row.predecessor_member_facts
    && row.acs_facts > 0
    && row.predecessor_acs_facts === 0
    && !row.inherited_acs;
  if (memberStage || acsStage) {
    if (!/^[a-f0-9]{64}$/.test(row.manifest_content_sha256)) throw new Error(`Factual release ${releaseId} has an invalid manifest content checksum`);
    if (acsStage) {
      await client.query("SELECT public.assert_acs_inherited_content($1,$2)", [releaseId, predecessorId]);
    }
    return {
      stage: memberStage ? "member" : "acs",
      proofKind: memberStage ? "member" : "acs",
      canonicalSha256: row.manifest_content_sha256,
    };
  }
  if (row.finance_proofs === 1 && row.election_proofs === 0) {
    if (legacyElectionProof?.runIds.length || !finance || finance.kind !== "fec_v1" || election || finance.proof.releaseId !== releaseId || !row.finance_content || !row.finance_facts || row.election_content || row.election_facts || row.predecessor_finance_proofs !== 0 || row.predecessor_election_proofs !== 0 || row.predecessor_finance_content || row.predecessor_election_content || row.predecessor_finance_facts || row.predecessor_election_facts) throw new Error(`Finance release ${releaseId} requires fact-free proofless R1 and only its exact finance proof`);
    const canonicalSha256 = await verifyFinancePublicationProofWithClient(client, finance.proof, finance.resolver, finance.verifier, finance.stores);
    return { stage: "finance", canonicalSha256 };
  }
  if (row.election_proofs === 1 && row.finance_proofs === 0) {
    if (legacyElectionProof?.runIds.length || !election || finance || election.proof.releaseId !== releaseId || !row.finance_content || !row.election_content || !row.finance_facts || !row.election_facts || row.predecessor_finance_proofs !== 1 || row.predecessor_election_proofs !== 0 || !row.predecessor_finance_content || !row.predecessor_finance_facts || row.predecessor_election_content || row.predecessor_election_facts) throw new Error(`Election release ${releaseId} requires only its exact election proof and an exact proofed R2 predecessor`);
    await assertInheritedFinance(client, releaseId, predecessorId);
    const canonicalSha256 = await verifyElectionPublicationProofWithClient(client, election.proof, election.resolver, election.verifier, election.stores);
    return { stage: "election", canonicalSha256 };
  }
  throw new Error(`Production release ${releaseId} has an invalid or missing launch publication stage`);
}

/** Reads every exact persisted receipt, failing closed on a missing, replaced, or malformed map object. */
export async function verifyPublishedMapObjectsWithClient(client: Parameters<typeof loadPrototypeManifest>[0], store: MapArtifactStore, releaseId: string): Promise<void> {
  const result = await client.query<{ geography_id: string; raw_store_kind: "local" | "s3"; store_identity: string; object_key: string; sha256: string; byte_size: number | string; version_id: string | null; etag: string | null }>(`
    WITH cutoff_house_geographies AS (
      SELECT DISTINCT sc.geography_version_id
      FROM data_releases r JOIN release_profile_seats rps ON rps.release_id=r.id
      JOIN seat_cycles sc ON sc.release_id=rps.release_id AND sc.id=rps.seat_cycle_id
      JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
      JOIN office_terms ot ON ot.release_id=sc.release_id AND ot.id=sc.office_term_id
      JOIN geography_versions gv ON gv.release_id=sc.release_id AND gv.id=sc.geography_version_id
      JOIN district_plans dp ON dp.release_id=gv.release_id AND dp.id=gv.district_plan_id
      WHERE r.id=$1 AND o.chamber='house' AND sc.occupancy_as_of <= r.source_cutoff::date
        AND ot.starts_at <= r.source_cutoff::date AND ot.ends_at > r.source_cutoff::date
        AND dp.effective_from <= r.source_cutoff::date AND (dp.effective_to IS NULL OR dp.effective_to > r.source_cutoff::date)
    )
    SELECT ma.geography_version_id geography_id,mr.raw_store_kind,mr.store_identity,mr.object_key,mr.sha256,mr.byte_size,mr.version_id,mr.etag
    FROM cutoff_house_geographies chg JOIN map_artifacts ma ON ma.release_id=$1 AND ma.geography_version_id=chg.geography_version_id
    JOIN map_artifact_receipts mr ON mr.release_id=ma.release_id AND mr.map_artifact_id=ma.id`, [releaseId]);
  if (result.rows.length !== 441 || new Set(result.rows.map(row => row.geography_id)).size !== 441) throw new Error(`Map-bearing release ${releaseId} has incomplete cutoff-active map receipts`);
  for (const row of result.rows) {
    const byteSize = Number(row.byte_size);
    const receipt = row.raw_store_kind === "local" && row.version_id === null && row.etag === null
      ? { storeKind: "local", storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize }
      : row.raw_store_kind === "s3" && typeof row.version_id === "string" && typeof row.etag === "string"
        ? { storeKind: "s3", storeIdentity: row.store_identity, key: row.object_key, sha256: row.sha256, byteSize, versionId: row.version_id, etag: row.etag }
        : null;
    if (!receipt || row.object_key !== `maps/${releaseId}/${row.geography_id}.geojson` || !Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error(`Map-bearing release ${releaseId} has an invalid map receipt`);
    const bytes = await store.read(receipt as MapArtifactReceipt);
    if (bytes.byteLength !== byteSize || createHash("sha256").update(bytes).digest("hex") !== row.sha256 || !isCanonicalDistrictGeoJson(bytes)) throw new Error(`Map-bearing release ${releaseId} map object verification failed`);
  }
}

/**
 * Legacy nationwide releases contain only unassessed planning rows. Once a
 * candidate introduces any reviewed election decision, publication must close
 * the complete presidential review cohort and every approved decision must
 * have corresponding publishable result facts. Candidate validation remains
 * available for partial cohort work; this stricter check is publication-only.
 */
export async function assertElectionPublicationReadiness(
  client: Parameters<typeof loadPrototypeManifest>[0],
  releaseId: string,
): Promise<boolean> {
  const decisions = await client.query<{
    reviewed_any: string | number;
    unassessed_any: string | number;
    reviewed: string | number;
    unassessed: string | number;
    alaska_approved: string | number;
    approved_without_results: string | number;
  }>(`
    WITH presidential AS (
      SELECT jurisdiction_code, election_year, status
      FROM election_decisions
      WHERE release_id=$1
    ), result_closure AS (
      SELECT ed.jurisdiction_code,ed.election_year
      FROM election_decisions ed
      JOIN election_decision_inputs edi ON edi.release_id=ed.release_id AND edi.election_decision_id=ed.id
      WHERE ed.release_id=$1 AND ed.status='approved' AND ed.election_year IN (2020,2024)
        AND EXISTS (
          SELECT 1 FROM contests c
          JOIN seat_cycles sc ON sc.release_id=c.release_id AND sc.id=c.seat_cycle_id
          JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
          WHERE c.release_id=ed.release_id AND c.kind='president_general' AND o.state_code=ed.jurisdiction_code AND EXTRACT(YEAR FROM c.election_date)::int=ed.election_year
        )
        AND NOT EXISTS (
          SELECT 1 FROM contests c
          JOIN seat_cycles sc ON sc.release_id=c.release_id AND sc.id=c.seat_cycle_id
          JOIN offices o ON o.release_id=sc.release_id AND o.id=sc.office_id
          WHERE c.release_id=ed.release_id AND c.kind='president_general' AND o.state_code=ed.jurisdiction_code AND EXTRACT(YEAR FROM c.election_date)::int=ed.election_year
            AND (
              c.round<>'general' OR c.certification_status NOT IN ('certified','modeled') OR c.reporting_completeness_percent<>100 OR c.denominator_votes IS NULL
              OR (c.allocation_method<>'none' AND c.allocation_coverage_percent IS DISTINCT FROM 100)
              OR NOT EXISTS (SELECT 1 FROM result_options ro WHERE ro.release_id=c.release_id AND ro.contest_id=c.id)
              OR NOT EXISTS (SELECT 1 FROM contest_lineage cl JOIN snapshot_derivation_inputs sdi ON sdi.release_id=cl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=cl.snapshot_id WHERE cl.release_id=c.release_id AND cl.contest_id=c.id)
              OR EXISTS (SELECT 1 FROM contest_lineage cl WHERE cl.release_id=c.release_id AND cl.contest_id=c.id AND NOT EXISTS (SELECT 1 FROM snapshot_derivation_inputs sdi WHERE sdi.release_id=cl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=cl.snapshot_id))
              OR EXISTS (
                SELECT 1 FROM result_options ro
                LEFT JOIN election_results er ON er.release_id=ro.release_id AND er.contest_id=ro.contest_id AND er.result_option_id=ro.id
                WHERE ro.release_id=c.release_id AND ro.contest_id=c.id AND (
                  er.result_option_id IS NULL OR er.votes IS NULL
                  OR NOT EXISTS (SELECT 1 FROM election_result_lineage erl JOIN snapshot_derivation_inputs sdi ON sdi.release_id=erl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=erl.snapshot_id WHERE erl.release_id=ro.release_id AND erl.contest_id=ro.contest_id AND erl.result_option_id=ro.id)
                  OR EXISTS (SELECT 1 FROM election_result_lineage erl WHERE erl.release_id=ro.release_id AND erl.contest_id=ro.contest_id AND erl.result_option_id=ro.id AND NOT EXISTS (SELECT 1 FROM snapshot_derivation_inputs sdi WHERE sdi.release_id=erl.release_id AND sdi.output_snapshot_id=edi.snapshot_id AND sdi.input_snapshot_id=erl.snapshot_id))
                )
              )
              OR c.denominator_votes IS DISTINCT FROM (SELECT sum(er.votes) FROM election_results er WHERE er.release_id=c.release_id AND er.contest_id=c.id)
            )
        )
    )
    SELECT
      count(*) FILTER (WHERE status<>'unassessed') AS reviewed_any,
      count(*) FILTER (WHERE status='unassessed') AS unassessed_any,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND status<>'unassessed') AS reviewed,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND status='unassessed') AS unassessed,
      count(*) FILTER (WHERE election_year IN (2020,2024) AND jurisdiction_code='AK' AND status='approved') AS alaska_approved,
      count(*) FILTER (
        WHERE election_year IN (2020,2024) AND status='approved' AND NOT EXISTS (
          SELECT 1 FROM result_closure r
          WHERE r.jurisdiction_code=presidential.jurisdiction_code
            AND r.election_year=presidential.election_year
        )
      ) AS approved_without_results
    FROM presidential
  `, [releaseId]);
  const row = decisions.rows[0];
  const reviewedAny = Number(row?.reviewed_any ?? 0);
  if (reviewedAny === 0) return false;
  if (
    reviewedAny !== 158 ||
    Number(row?.unassessed_any ?? 0) !== 0 ||
    Number(row?.reviewed ?? 0) !== 102 ||
    Number(row?.unassessed ?? 0) !== 0 ||
    Number(row?.alaska_approved ?? 0) !== 2 ||
    Number(row?.approved_without_results ?? 0) !== 0
  ) throw new Error(`Release ${releaseId} failed election publication readiness`);
  return true;
}

async function validateReleaseForPublication(client: Parameters<typeof loadPrototypeManifest>[0], pool: Pool, releaseId: string, targetStatus: "candidate" | "retired", electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, launchEvidence?: LaunchPublicationEvidence, bundle?: FecV2ArtifactVerificationBundle): Promise<LaunchStageValidation> {
  const version = await client.query<{ schema_version: number }>("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId]);
  switch (version.rows[0]?.schema_version) {
    case 1: {
      const manifest = await loadPrototypeManifest(client, releaseId);
      const semantic = validatePrototypeManifest(manifest);
      if (!semantic.success || manifest.profileSeatCycleIds.length < 10 || manifest.profileSeatCycleIds.length > 12) throw new Error(`Release ${releaseId} failed validation immediately before promotion`);
      return { stage: "legacy" };
    }
    case 2:
      await recheckNationwideValidationGateShared(client as PoolClient, releaseId);
      // Strict-load after the gate recheck: promotion must never rely only on a
      // digest row when the persisted manifest itself cannot be reconstructed.
      await loadNationwideManifest(client, releaseId);
      const mapTarget = await client.query<{ previous_release_id: string | null; maps: boolean }>("SELECT r.previous_release_id,EXISTS(SELECT 1 FROM map_artifacts ma WHERE ma.release_id=r.id) maps FROM data_releases r WHERE r.id=$1", [releaseId]);
      if (mapTarget.rowCount !== 1) throw new Error(`Release ${releaseId} is missing`);
      const launchStage = await validateLaunchStage(client as PoolClient, releaseId, mapTarget.rows[0]!.previous_release_id, mapTarget.rows[0]!.maps, electionProof, launchEvidence, bundle);
      if (mapTarget.rows[0]!.maps) {
        const predecessor = mapTarget.rows[0]!.previous_release_id;
        if (predecessor === null) throw new Error(`Map-bearing release ${releaseId} requires an immutable predecessor`);
        await recheckNationwideValidationGateShared(client as PoolClient, predecessor);
        if (launchStage.stage === "legacy") {
          if (!electionProof || electionProof.runIds.length !== 158) throw new Error(`Release ${releaseId} requires predecessor Task 9 evidence`);
          await verifyPersistedTask9ElectionWithClient(client as never, { ...electionProof, pool, candidateReleaseId: predecessor }, ["published", "retired"]);
        } else if (electionProof?.runIds.length) throw new Error(`Production map release ${releaseId} must not use legacy Task 9 run-ID evidence`);
        const inherited = await client.query<{ equal: boolean }>("SELECT EXISTS(SELECT 1 FROM release_content_digests t JOIN release_content_digests p ON p.domain='elections' AND p.release_id=$2 WHERE t.release_id=$1 AND t.domain='elections' AND t.row_count=p.row_count AND t.sha256=p.sha256) equal", [releaseId, predecessor]);
        if (!inherited.rows[0]!.equal) throw new Error(`Map-bearing release ${releaseId} did not inherit predecessor elections content`);
        if (!mapProof) throw new Error(`Map-bearing release ${releaseId} requires map publication evidence`);
        await verifyPublishedMapObjectsWithClient(client, mapProof.store, releaseId);
        return launchStage;
      }
      if (launchStage.stage === "member" || launchStage.stage === "acs" || launchStage.stage === "finance" || launchStage.stage === "election") return launchStage;
      if (await assertElectionPublicationReadiness(client, releaseId)) {
        if (!electionProof || electionProof.runIds.length !== 158) throw new Error(`Release ${releaseId} requires exact Task 9 publication evidence`);
        const options = { ...electionProof, pool, candidateReleaseId: releaseId };
        await verifyPersistedTask9ElectionWithClient(client as never, options, [targetStatus]);
        const closure = await client.query<{ reviewed: string | number; matched: string | number }>(`SELECT count(*) FILTER (WHERE ed.status<>'unassessed') reviewed,count(*) FILTER (WHERE ed.status<>'unassessed' AND ir.id IS NOT NULL) matched FROM election_decisions ed LEFT JOIN election_decision_inputs edi ON edi.release_id=ed.release_id AND edi.election_decision_id=ed.id LEFT JOIN ingest_runs ir ON ir.release_id=edi.release_id AND ir.snapshot_id=edi.snapshot_id AND ir.id=ANY($2) AND ir.status='loaded' WHERE ed.release_id=$1`, [releaseId, electionProof.runIds]);
        if (Number(closure.rows[0]?.reviewed) !== 158 || Number(closure.rows[0]?.matched) !== 158) throw new Error(`Release ${releaseId} requires complete Task 9 publication evidence`);
      } else if (electionProof?.runIds.length) {
        throw new Error(`All-unassessed release ${releaseId} must not supply Task 9 evidence`);
      }
      return launchStage;
    default:
      throw new Error(`Release ${releaseId} has an unsupported manifest schema version`);
  }
}

async function issueLaunchVerifierAttestation(client: PoolClient, operation: "promote" | "roll_forward", releaseId: string, currentId: string | null, predecessorId: string | null, validation: LaunchStageValidation): Promise<void> {
  if (validation.stage === "legacy") return;
  if (!validation.canonicalSha256) throw new Error(`Launch stage ${validation.stage} did not produce a canonical verifier hash`);
  await client.query("SELECT public.issue_launch_verifier_attestation($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), operation, releaseId, currentId, predecessorId, validation.proofKind ?? validation.stage, validation.canonicalSha256, 300]);
}

async function issuePreflightOnPool(pool: Pool, operation: "promote" | "roll_forward", releaseId: string, currentId: string | null, predecessorId: string | null, runIds?: readonly string[]): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    const proofId = await issuePreflight(client, operation, releaseId, currentId, predecessorId, runIds);
    await client.query("COMMIT");
    return proofId;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}
const DEFAULT_ARTIFACT_REPLAY_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
async function prepareFecV2Replay(pool: Pool, evidence: LaunchPublicationEvidence | undefined, artifactReplayTimeoutMs?: number): Promise<FecV2ArtifactVerificationBundle | undefined> {
  const finance = evidence?.finance;
  if (!finance || finance.kind !== "fec_v2_exact_election") return undefined;
  const timeoutMs = artifactReplayTimeoutMs ?? DEFAULT_ARTIFACT_REPLAY_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 8 * 60 * 60 * 1_000) throw new Error("artifactReplayTimeoutMs must be between 1 second and 8 hours");
  const controller = new AbortController(), deadlineMs = Date.now() + timeoutMs, timer = setTimeout(() => controller.abort(), timeoutMs);
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    return await prepareFecV2ArtifactTranscriptWithClient(client, finance.proof, finance.artifactVerifier, { signal: controller.signal, deadlineMs });
  } finally { clearTimeout(timer); client?.release(); }
}

/** Atomically makes a candidate the sole published release after the content lock exposes its latest committed state. */
async function promoteCandidateReleaseImpl(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<void> {
  const launchEvidence = normalizeEvidence(lifecyclePools.launchEvidence);
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  if (lifecyclePools.launchEvidence && !lifecyclePools.launchVerifierPool) throw new Error("Launch publication evidence requires a separate launch verifier pool");
  if (lifecyclePools.launchVerifierPool && (!lifecyclePools.preflightPool || !lifecyclePools.operatorPool || lifecyclePools.launchVerifierPool === lifecyclePools.preflightPool || lifecyclePools.launchVerifierPool === lifecyclePools.operatorPool || lifecyclePools.preflightPool === lifecyclePools.operatorPool)) throw new Error("Launch verification requires distinct verifier, preflight, and operator pools");
  const validationPool = lifecyclePools.launchVerifierPool ?? lifecyclePools.preflightPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Remote artifact replay deliberately precedes BEGIN and every advisory lock.
    const bundle = await prepareFecV2Replay(validationPool, launchEvidence, lifecyclePools.artifactReplayTimeoutMs);
    const client = await validationPool.connect();
    let committed = false;
    try {
      // Candidate writers and promotion share explicit advisory/row locks. READ COMMITTED
      // is intentional: a serializable snapshot taken before a blocked content lock could
      // validate stale candidate rows after that writer commits.
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const candidate = await client.query<{ id: string; previous_release_id: string | null }>(
        "SELECT id,previous_release_id FROM data_releases WHERE id = $1 AND status = 'candidate'", [releaseId],
      );
      if (candidate.rowCount !== 1) throw new Error(`Release ${releaseId} is not a candidate`);
      const published = await client.query<{ id: string }>(
        "SELECT id FROM data_releases WHERE status = 'published'",
      );
      if ((published.rowCount ?? published.rows.length) > 1) throw new Error("Expected at most one published release to promote");
      const currentId = published.rows[0]?.id ?? null;
      // The global lock freezes lifecycle topology; lock every release whose
      // lineage/evidence is read so writers and finalizers share one order.
      await lockReleases(client, [releaseId, candidate.rows[0]!.previous_release_id, currentId]);
      const validation = await validateReleaseForPublication(client, validationPool, releaseId, "candidate", electionProof, mapProof, launchEvidence, bundle);
      await issueLaunchVerifierAttestation(client, "promote", releaseId, currentId, currentId, validation);
      if (lifecyclePools.launchVerifierPool) {
        await client.query("COMMIT"); committed = true;
        const proofId = await issuePreflightOnPool(lifecyclePools.preflightPool!, "promote", releaseId, currentId, currentId, electionProof?.runIds);
        await consumeLifecycle(lifecyclePools.operatorPool!, "SELECT public.lifecycle_promote_candidate($1,$2,$3,$4,$5)", [proofId, releaseId, currentId, currentId, electionProof?.runIds ?? null]);
        return;
      }
      const proofId = await issuePreflight(client, "promote", releaseId, currentId, currentId, electionProof?.runIds);
      const args = [proofId, releaseId, currentId, currentId, electionProof?.runIds ?? null];
      if (lifecyclePools.operatorPool) {
        await client.query("COMMIT"); committed = true;
        await consumeLifecycle(lifecyclePools.operatorPool, "SELECT public.lifecycle_promote_candidate($1,$2,$3,$4,$5)", args);
      } else {
        await client.query("SELECT public.lifecycle_promote_candidate($1,$2,$3,$4,$5)", args);
        await client.query("COMMIT"); committed = true;
      }
      return;
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
}

/** Republishes the direct retired successor of the current release after revalidating immutable content. */
async function rollForwardRetiredReleaseImpl(pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  const launchEvidence = normalizeEvidence(lifecyclePools.launchEvidence);
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  if (lifecyclePools.launchEvidence && !lifecyclePools.launchVerifierPool) throw new Error("Launch publication evidence requires a separate launch verifier pool");
  if (lifecyclePools.launchVerifierPool && (!lifecyclePools.preflightPool || !lifecyclePools.operatorPool || lifecyclePools.launchVerifierPool === lifecyclePools.preflightPool || lifecyclePools.launchVerifierPool === lifecyclePools.operatorPool || lifecyclePools.preflightPool === lifecyclePools.operatorPool)) throw new Error("Launch verification requires distinct verifier, preflight, and operator pools");
  const validationPool = lifecyclePools.launchVerifierPool ?? lifecyclePools.preflightPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Remote artifact replay deliberately precedes BEGIN and every advisory lock.
    const bundle = await prepareFecV2Replay(validationPool, launchEvidence, lifecyclePools.artifactReplayTimeoutMs);
    const client = await validationPool.connect();
    let committed = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const published = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE status = 'published'");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll forward");
      const current = published.rows[0]!;
      if (current.id === releaseId) throw new Error(`Release ${releaseId} is already published`);
      const target = await client.query<{ id: string; previous_release_id: string | null }>("SELECT id,previous_release_id FROM data_releases WHERE id=$1 AND status='retired' AND previous_release_id=$2", [releaseId, current.id]);
      if (target.rowCount !== 1) throw new Error(`Retired release ${releaseId} is not the direct successor of published release ${current.id}`);
      await lockReleases(client, [releaseId, current.id, target.rows[0]!.previous_release_id]);
      const validation = await validateReleaseForPublication(client, validationPool, releaseId, "retired", electionProof, mapProof, launchEvidence, bundle);
      await issueLaunchVerifierAttestation(client, "roll_forward", releaseId, current.id, current.id, validation);
      if (lifecyclePools.launchVerifierPool) {
        await client.query("COMMIT"); committed = true;
        const proofId = await issuePreflightOnPool(lifecyclePools.preflightPool!, "roll_forward", releaseId, current.id, current.id, electionProof?.runIds);
        await consumeLifecycle(lifecyclePools.operatorPool!, "SELECT public.lifecycle_roll_forward($1,$2,$3,$4,$5)", [proofId, releaseId, current.id, current.id, electionProof?.runIds ?? null]);
        return { publishedReleaseId: releaseId, retiredReleaseId: current.id };
      }
      // The SECURITY DEFINER routine preserves the target's historical metadata.
      const proofId = await issuePreflight(client, "roll_forward", releaseId, current.id, current.id, electionProof?.runIds);
      const args = [proofId, releaseId, current.id, current.id, electionProof?.runIds ?? null];
      if (lifecyclePools.operatorPool) {
        await client.query("COMMIT"); committed = true;
        await consumeLifecycle(lifecyclePools.operatorPool, "SELECT public.lifecycle_roll_forward($1,$2,$3,$4,$5)", args);
      } else {
        await client.query("SELECT public.lifecycle_roll_forward($1,$2,$3,$4,$5)", args);
        await client.query("COMMIT"); committed = true;
      }
      return { publishedReleaseId: releaseId, retiredReleaseId: current.id };
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Roll-forward attempts exhausted");
}

/** Restores the retired predecessor of the sole published release, retrying complete serializable attempts. */
async function rollbackPublishedReleaseImpl(pool: Pool, maxAttempts = 3, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> {
  if (lifecyclePools.preflightPool && !lifecyclePools.operatorPool) throw new Error("A separate preflight pool requires a separate operator pool");
  const validationPool = lifecyclePools.preflightPool ?? pool;
  const operatorPool = lifecyclePools.operatorPool ?? pool;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = await validationPool.connect();
    let committed = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release_promotion'))");
      const published = await client.query<{ id: string; previous_release_id: string | null }>("SELECT id, previous_release_id FROM data_releases WHERE status = 'published'");
      if (published.rowCount !== 1) throw new Error("Expected exactly one published release to roll back");
      const current = published.rows[0]!;
      if (current.previous_release_id === null) throw new Error(`Published release ${current.id} has no previous release to restore`);
      const previous = await client.query<{ id: string }>("SELECT id FROM data_releases WHERE id = $1 AND status = 'retired'", [current.previous_release_id]);
      if (previous.rowCount !== 1) throw new Error(`Previous release ${current.previous_release_id} must exist and be retired`);
      await lockReleases(client, [current.id, previous.rows[0]!.id]);
      // Do not change published_at: the restored release retains its original publication time.
      await client.query("COMMIT");
      committed = true;
      // Do not hold the validation connection's global advisory lock while the
      // operator acquires it, even when both capabilities use the same Pool.
      await consumeLifecycle(operatorPool, "SELECT public.lifecycle_rollback($1,$2)", [current.id, previous.rows[0]!.id]);
      return { publishedReleaseId: previous.rows[0]!.id, retiredReleaseId: current.id };
    } catch (error: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === SERIALIZATION_FAILURE && attempt < maxAttempts) continue;
      throw error;
    } finally { client.release(); }
  }
  throw new Error("Rollback attempts exhausted");
}

async function observeLifecycle<T>(sink: OperationalSignalSink | undefined, operation: "promote" | "rollback" | "roll_forward", releaseId: string | undefined, work: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try { const result = await work(); emitOperationalSignal(sink, { version: 1, timestamp: signalTimestamp(), kind: "lifecycle", operation, ...(releaseId ? { releaseId } : {}), outcome: "success", durationMs: boundedDuration(startedAt) }); return result; }
  catch (error) { emitOperationalSignal(sink, { version: 1, timestamp: signalTimestamp(), kind: "lifecycle", operation, ...(releaseId ? { releaseId } : {}), outcome: "failure", failureCode: boundedFailureCode("lifecycle"), durationMs: boundedDuration(startedAt) }); throw error; }
}
export const promoteCandidateRelease = (pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<void> => observeLifecycle(lifecyclePools.signalSink, "promote", releaseId, () => promoteCandidateReleaseImpl(pool, releaseId, maxAttempts, electionProof, mapProof, lifecyclePools));
export const rollForwardRetiredRelease = (pool: Pool, releaseId: string, maxAttempts = 3, electionProof?: ElectionPublicationProof, mapProof?: MapPublicationProof, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> => observeLifecycle(lifecyclePools.signalSink, "roll_forward", releaseId, () => rollForwardRetiredReleaseImpl(pool, releaseId, maxAttempts, electionProof, mapProof, lifecyclePools));
export const rollbackPublishedRelease = (pool: Pool, maxAttempts = 3, lifecyclePools: ReleaseLifecyclePools = {}): Promise<{ publishedReleaseId: string; retiredReleaseId: string }> => observeLifecycle(lifecyclePools.signalSink, "rollback", undefined, () => rollbackPublishedReleaseImpl(pool, maxAttempts, lifecyclePools));
