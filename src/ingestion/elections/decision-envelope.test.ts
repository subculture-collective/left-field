import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PoolClient } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { LocalRawObjectStore, type RawObjectStore } from "../core/raw-object-store";
import { createElectionDecisionAdapter, electionDecisionSourceUrl, type ElectionDecisionAdapterOptions } from "./adapter";
import { decodeElectionDecisionEnvelope, ELECTION_DECISION_ADAPTER_VERSION, electionDecisionEnvelopeSha256, encodeElectionDecisionEnvelope, type ElectionDecisionEnvelopeV1 } from "./decision-envelope";
import type { ElectionGateName } from "./gate";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const collect = async <T,>(items: AsyncIterable<T>) => { const values: T[] = []; for await (const item of items) values.push(item); return values; };
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const values: Record<ElectionGateName, object> = { sourceAuthority: { originalPublisher: { identity: "official", role: "original_publisher", evidenceKind: "record" }, intermediaries: [] }, license: { assessment: "approved" }, certification: { value: "certified", scope: "contest" }, reportingUnitGeometry: { release: "r", vintage: "v" }, nonGeographicPolicy: { policy: "excluded" }, allocation: { method: "none", crosswalkMethodology: "none", weightsMethodology: "none" }, reconciliation: { delta: 0, authorityTotal: 1 }, rounding: { rule: "largest_remainder" }, coverage: { expectedCount: 1, actualCount: 1 } };
const envelope = (): ElectionDecisionEnvelopeV1 => ({ schemaVersion: 1, adapterVersion: ELECTION_DECISION_ADAPTER_VERSION, sourceLockSha256: "a".repeat(64), releaseCutoff: "2026-01-01", decisionSnapshotId: "snap_decision", evidenceReceipts: [{ snapshotId: "snap_1", lockEntryId: "lock_1", url: "https://official.example/evidence", sha256: "b".repeat(64), byteSize: 1 }], decision: { schemaVersion: 1, jurisdictionCode: "AL", electionYear: 2024, reviewDate: "2026-01-01", methodology: "review", evidenceSnapshotIds: ["snap_1"], gates: Object.fromEntries((Object.keys(values) as ElectionGateName[]).map(name => [name, { outcome: "passed", evidenceSnapshotIds: ["snap_1"], value: values[name], failureReason: null }])) as never } });
const options = (bytes = encodeElectionDecisionEnvelope(envelope()), store: RawObjectStore = { put: async () => { throw new Error("unused"); }, read: async () => new Uint8Array() }): ElectionDecisionAdapterOptions => { const checksum = electionDecisionEnvelopeSha256(bytes); return { envelopeBytes: bytes, envelopeChecksumSha256: checksum, envelopeByteSize: bytes.byteLength, sourceLockSha256: "a".repeat(64), releaseCutoff: "2026-01-01", snapshotId: "snap_decision" as never, sourceUrl: electionDecisionSourceUrl(decodeElectionDecisionEnvelope(bytes), checksum), parserVersion: ELECTION_DECISION_ADAPTER_VERSION, upstreamRelease: ELECTION_DECISION_ADAPTER_VERSION, rawStore: store, sourceLockEntries: [{ id: "lock_1", url: "https://official.example/evidence", sha256: "b".repeat(64), byteSize: 1 }] }; };

describe("election decision envelope", () => {
  it("is canonical and rejects tampering, unknown keys, closure failures, bounds, and unassessed decisions", () => {
    const bytes = encodeElectionDecisionEnvelope(envelope());
    expect(decodeElectionDecisionEnvelope(bytes)).toEqual(envelope());
    expect(() => decodeElectionDecisionEnvelope(Buffer.from(Buffer.from(bytes).toString().replace('"schemaVersion":1', '"adapterVersion":"election-decision-v1","schemaVersion":1')))).toThrow("NONCANONICAL");
    const unknown = JSON.parse(Buffer.from(bytes).toString()); unknown.extra = true;
    expect(() => decodeElectionDecisionEnvelope(Buffer.from(JSON.stringify(unknown)))).toThrow("UNKNOWN_FIELD");
    const closure = structuredClone(envelope()) as unknown as { evidenceReceipts: unknown[] }; closure.evidenceReceipts = [];
    expect(() => encodeElectionDecisionEnvelope(closure)).toThrow("CLOSURE");
    const unassessed = structuredClone(envelope()) as unknown as { decision: { gates: Record<string, unknown>; evidenceSnapshotIds: unknown[] }; evidenceReceipts: unknown[] }; unassessed.decision.gates.sourceAuthority = { outcome: "unassessed", evidenceSnapshotIds: [], value: null, failureReason: null };
    for (const name of Object.keys(values).slice(1)) unassessed.decision.gates[name] = { outcome: "unassessed", evidenceSnapshotIds: [], value: null, failureReason: null };
    unassessed.decision.evidenceSnapshotIds = []; unassessed.evidenceReceipts = [];
    expect(() => encodeElectionDecisionEnvelope(unassessed)).toThrow("UNASSESSED");
    const large = structuredClone(envelope()) as unknown as { evidenceReceipts: { byteSize: number }[] }; large.evidenceReceipts[0]!.byteSize = 128 * 1024 * 1024 + 1;
    expect(() => encodeElectionDecisionEnvelope(large)).toThrow("RECEIPT_INVALID");
  });
  it("stores only canonical envelope bytes and preserves receipt/snapshot bindings", async () => {
    const root = await mkdtemp(join(tmpdir(), "decision-")); roots.push(root);
    const adapter = createElectionDecisionAdapter(options(undefined, new LocalRawObjectStore(root)));
    const raw = (await collect(adapter.extract({ releaseId: "release" as never, sourceId: "elections" as never, cutoff: new Date("2026-01-01T00:00:00Z") })))[0]!;
    expect(raw.expectedRecordCount).toBe(0); expect(raw.snapshot.license).toBe("project-generated"); expect(raw.snapshot.usageStatus).toBe("approved");
    expect(Object.isFrozen(raw.receipt)).toBe(true); expect(Object.isFrozen(raw.snapshot)).toBe(true);
    expect(() => { (raw.receipt as { storeKind: string }).storeKind = "s3"; }).toThrow();
    expect(await collect(adapter.parse(raw))).toEqual([]);
    await expect(adapter.stage({} as PoolClient, "run", [])).resolves.toBeUndefined();
    await expect(adapter.stage({} as PoolClient, "run", [{} as never])).rejects.toThrow("NO_ROWS");
    const mutated = { ...raw, snapshot: { ...raw.snapshot, sourceUrl: "https://mutated.example" } };
    await expect(collect(adapter.parse(mutated))).rejects.toThrow("RAW_BINDING");
    const client = { query: async (_query: string, values?: unknown[]) => ({ rows: [{ valid: values?.[1] === "snap_decision" }] }) } as unknown as PoolClient;
    expect(await adapter.validateStaged(client, "run")).toEqual([]);
    await expect(adapter.loadFromStage(client, "run", "release" as never)).rejects.toThrow("ELECTION_FINALIZE_REQUIRED");
  });
  it("accepts only exact S3 receipt semantics and source-lock entries", async () => {
    const bytes = encodeElectionDecisionEnvelope(envelope()); const checksum = sha(bytes);
    const s3: RawObjectStore = { put: async input => ({ storeKind: "s3", storeLocator: "bucket", objectKey: `${input.objectKey}.${checksum}`, sha256: checksum, byteSize: bytes.byteLength, versionId: "version" }), read: async () => bytes };
    const adapter = createElectionDecisionAdapter(options(bytes, s3));
    expect((await collect(adapter.extract({ releaseId: "r" as never, sourceId: "elections" as never, cutoff: new Date("2026-01-01Z") })))[0]!.receipt.storeKind).toBe("s3");
    expect(() => createElectionDecisionAdapter({ ...options(bytes, s3), sourceLockEntries: [{ id: "lock_1", url: "https://wrong.example", sha256: "b".repeat(64), byteSize: 1 }] })).toThrow("SOURCE_LOCK_MISMATCH");
    expect(() => createElectionDecisionAdapter({ ...options(bytes, s3), releaseCutoff: "2026-01-02" })).toThrow("CUTOFF");
  });
  it("rejects duplicate receipt lock IDs even when supplied lock-entry counts match", () => {
    const duplicate = structuredClone(envelope()) as unknown as { evidenceReceipts: Array<{ snapshotId: string; lockEntryId: string; url: string; sha256: string; byteSize: number }>; decision: { evidenceSnapshotIds: string[]; gates: Record<string, { evidenceSnapshotIds: string[] }> } };
    duplicate.evidenceReceipts.push({ snapshotId: "snap_2", lockEntryId: "lock_1", url: "https://official.example/evidence-2", sha256: "c".repeat(64), byteSize: 2 });
    duplicate.decision.evidenceSnapshotIds.push("snap_2");
    duplicate.decision.gates.license!.evidenceSnapshotIds.push("snap_2");
    const bytes = encodeElectionDecisionEnvelope(duplicate); const base = options(bytes);
    expect(() => createElectionDecisionAdapter({ ...base, sourceLockEntries: [...base.sourceLockEntries, { id: "lock_2", url: "https://official.example/evidence-2", sha256: "c".repeat(64), byteSize: 2 }] })).toThrow("SOURCE_LOCK_MISMATCH");
  });
});
