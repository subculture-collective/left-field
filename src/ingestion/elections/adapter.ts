import type { SnapshotId } from "@/domain/contracts";
import type { RawObjectResult, RawObjectStore } from "../core/raw-object-store";
import type { SourceAdapter, ValidationIssue } from "../core/types";
import { decodeElectionDecisionEnvelope, ELECTION_DECISION_ADAPTER_VERSION, electionDecisionEnvelopeSha256, encodeElectionDecisionEnvelope, type ElectionDecisionEnvelopeV1, type ElectionDecisionEvidenceReceipt } from "./decision-envelope";

export const ELECTION_DECISION_UPSTREAM_RELEASE = "election-decision-v1";
export const ELECTION_DECISION_SOURCE = Object.freeze({
  id: "src_election_decisions",
  name: "elections",
  authority: "editorial",
  homepageUrl: "https://data.dsa-seats.invalid/methodology/election-decisions",
});
export const electionDecisionSourceUrl = (envelope: ElectionDecisionEnvelopeV1, checksum: string): string =>
  `https://data.dsa-seats.invalid/election-decisions/v1/${envelope.decision.jurisdictionCode}/${envelope.decision.electionYear}/${checksum}.json`;
export type ElectionDecisionSourceLockEntry = Readonly<{ id: string; url: string; sha256: string; byteSize: number }>;
export interface ElectionDecisionAdapterOptions {
  readonly envelopeBytes: Uint8Array; readonly envelopeChecksumSha256: string; readonly envelopeByteSize: number;
  readonly sourceLockSha256: string; readonly releaseCutoff: string; readonly snapshotId: SnapshotId; readonly sourceUrl: string;
  readonly parserVersion: typeof ELECTION_DECISION_ADAPTER_VERSION; readonly upstreamRelease: typeof ELECTION_DECISION_UPSTREAM_RELEASE;
  readonly rawStore: RawObjectStore; readonly sourceLockEntries: readonly ElectionDecisionSourceLockEntry[];
}
const validSha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const chunks = async function* (bytes: Uint8Array): AsyncIterable<Uint8Array> { yield bytes; };
const sameReceipt = (a: RawObjectResult, b: RawObjectResult) => JSON.stringify(a) === JSON.stringify(b);
const objectKey = (checksum: string) => `elections/decision/${checksum}.json`;
const validSourceUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } };
const frozen = <T extends object>(value: T): Readonly<T> => Object.freeze({ ...value });

export function createElectionDecisionAdapter(options: ElectionDecisionAdapterOptions): SourceAdapter<ElectionDecisionEnvelopeV1, never> {
  if (!validSha(options.envelopeChecksumSha256) || !validSha(options.sourceLockSha256) || !Number.isSafeInteger(options.envelopeByteSize) || options.envelopeByteSize !== options.envelopeBytes.byteLength || electionDecisionEnvelopeSha256(options.envelopeBytes) !== options.envelopeChecksumSha256 || options.parserVersion !== ELECTION_DECISION_ADAPTER_VERSION || options.upstreamRelease !== ELECTION_DECISION_UPSTREAM_RELEASE || !validSourceUrl(options.sourceUrl)) throw new Error("ELECTION_DECISION_RECEIPT_MISMATCH");
  const envelope = decodeElectionDecisionEnvelope(options.envelopeBytes);
  if (options.sourceUrl !== electionDecisionSourceUrl(envelope, options.envelopeChecksumSha256)) throw new Error("ELECTION_DECISION_SOURCE_URL_MISMATCH");
  const expectedEntries = new Map(options.sourceLockEntries.map(entry => [entry.id, entry]));
  const receiptLockIds = new Set(envelope.evidenceReceipts.map((receipt) => receipt.lockEntryId));
  if (envelope.releaseCutoff !== options.releaseCutoff) throw new Error("ELECTION_DECISION_CUTOFF_MISMATCH");
  if (envelope.decisionSnapshotId !== options.snapshotId) throw new Error("ELECTION_DECISION_SNAPSHOT_MISMATCH");
  if (envelope.sourceLockSha256 !== options.sourceLockSha256 || expectedEntries.size !== options.sourceLockEntries.length || receiptLockIds.size !== envelope.evidenceReceipts.length || envelope.evidenceReceipts.some(receipt => { const entry = expectedEntries.get(receipt.lockEntryId); return !entry || entry.url !== receipt.url || entry.sha256 !== receipt.sha256 || entry.byteSize !== receipt.byteSize; }) || expectedEntries.size !== receiptLockIds.size || options.sourceLockEntries.some((entry) => !receiptLockIds.has(entry.id))) throw new Error("ELECTION_DECISION_SOURCE_LOCK_MISMATCH");
  const key = objectKey(options.envelopeChecksumSha256);
  let extractedReceipt: Readonly<RawObjectResult> | undefined;
  let extractedSnapshot: Readonly<{ id: SnapshotId; sourceUrl: string; checksumSha256: string; upstreamRelease: string; publishedAt: Date | null; license: string; usageStatus: "approved" }> | undefined;
  const receiptValid = (receipt: RawObjectResult) => receipt.sha256 === options.envelopeChecksumSha256 && receipt.byteSize === options.envelopeByteSize && receipt.storeLocator.length > 0 && ((receipt.storeKind === "local" && receipt.objectKey === key && receipt.versionId === undefined) || (receipt.storeKind === "s3" && receipt.objectKey === `${key}.${options.envelopeChecksumSha256}` && typeof receipt.versionId === "string" && receipt.versionId.length > 0));
  return {
    sourceName: "elections", adapterVersion: ELECTION_DECISION_ADAPTER_VERSION,
    async *extract(context) {
      if (context.signal?.aborted) throw new Error("INGEST_ABORTED");
      if (context.cutoff.toISOString().slice(0, 10) !== options.releaseCutoff || envelope.releaseCutoff !== options.releaseCutoff) throw new Error("ELECTION_DECISION_CUTOFF_MISMATCH");
      const receipt = await options.rawStore.put({ objectKey: key, body: chunks(options.envelopeBytes), expectedSha256: options.envelopeChecksumSha256, signal: context.signal });
      if (!receiptValid(receipt)) throw new Error("ELECTION_DECISION_RECEIPT_MISMATCH");
      const snapshot = { id: options.snapshotId, sourceUrl: options.sourceUrl, checksumSha256: options.envelopeChecksumSha256, upstreamRelease: ELECTION_DECISION_UPSTREAM_RELEASE, publishedAt: null, license: "project-generated", usageStatus: "approved" as const };
      extractedReceipt = frozen(receipt); extractedSnapshot = frozen(snapshot);
      yield { value: envelope, receipt: extractedReceipt, snapshot: extractedSnapshot, expectedRecordCount: 0 };
    },
    async *parse(raw) {
      if (!extractedReceipt || !extractedSnapshot || !sameReceipt(raw.receipt, extractedReceipt) || !receiptValid(raw.receipt) || raw.snapshot.id !== extractedSnapshot.id || raw.snapshot.sourceUrl !== extractedSnapshot.sourceUrl || raw.snapshot.checksumSha256 !== extractedSnapshot.checksumSha256 || raw.snapshot.upstreamRelease !== extractedSnapshot.upstreamRelease || raw.snapshot.publishedAt !== null || raw.snapshot.license !== "project-generated" || raw.snapshot.usageStatus !== "approved" || raw.value.sourceLockSha256 !== options.sourceLockSha256 || !Buffer.from(encodeElectionDecisionEnvelope(raw.value)).equals(Buffer.from(options.envelopeBytes))) throw new Error("ELECTION_DECISION_RAW_BINDING_MISMATCH");
      return;
    },
    naturalKey: (_row) => { throw new Error("ELECTION_DECISION_NO_ROWS"); },
    async stage(_client, _runId, rows) { if (rows.length) throw new Error("ELECTION_DECISION_NO_ROWS"); },
    async validateStaged(client, runId): Promise<readonly ValidationIssue[]> {
      const result = await client.query<{ valid: unknown }>("SELECT ir.extracted_count=0 AND ir.staged_count=0 AND ir.quarantined_count=0 AND ir.snapshot_id=$2 AND ir.raw_object_sha256=$3 AND ir.adapter_version=$4 AND ir.upstream_release=$5 AND (SELECT count(*) FROM stg_elections WHERE run_id=ir.id)=0 AS valid FROM ingest_runs ir WHERE ir.id=$1", [runId, options.snapshotId, options.envelopeChecksumSha256, ELECTION_DECISION_ADAPTER_VERSION, ELECTION_DECISION_UPSTREAM_RELEASE]);
      return result.rows[0]?.valid === true || result.rows[0]?.valid === "t" ? [] : [{ code: "ELECTION_DECISION_STAGE_INVALID", message: "Election decision run must remain a zero-row reviewed envelope." }];
    },
    async loadFromStage() { throw new Error("ELECTION_FINALIZE_REQUIRED"); },
  };
}
export type { ElectionDecisionEnvelopeV1, ElectionDecisionEvidenceReceipt };
