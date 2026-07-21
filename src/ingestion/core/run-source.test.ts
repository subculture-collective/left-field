import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { LocalRawObjectStore, S3RawObjectStore } from "./raw-object-store";
import { runSource } from "./run-source";
import type { RawObject, SourceAdapter } from "./types";

type Row = { id: string };
const raw = (count: number): RawObject<null> => ({ value: null, receipt: { storeKind: "local", storeLocator: "/fixtures", objectKey: "fixture", sha256: "a".repeat(64), byteSize: 0 }, expectedRecordCount: count, snapshot: { id: "snap_fixture" as never, sourceUrl: "https://example.test/feed", checksumSha256: "a".repeat(64), upstreamRelease: "fixture-1", publishedAt: null, license: "public", usageStatus: "approved" } });
interface FakeRun { id: string; status: "running" | "validated" | "failed" | "loaded"; extractedCount?: number; stagedCount?: number; quarantinedCount?: number; }
const statefulPool = (state: { runs?: FakeRun[]; snapshot?: Record<string, unknown>; writes?: string[] } = {}): Pool => {
  const runs = state.runs ?? []; const writes = state.writes ?? [];
  const client = {
    query: async <T,>(sql: string, values: readonly unknown[] = []): Promise<{ rowCount: number; rows: T[] }> => {
      if (sql.startsWith("SELECT pg_try_advisory_lock")) return { rowCount: 1, rows: [{ acquired: true }] as T[] };
      if (sql.startsWith("SELECT id,status")) return { rowCount: runs.length, rows: [...runs].reverse().map(run => ({ ...run, lease_token: "11111111-1111-4111-8111-111111111111", lease_expires_at: run.status === "running" ? new Date("2999-01-01") : new Date(0), snapshot_id: "snap_fixture", raw_store_kind: "local", raw_store_locator: "/fixtures", raw_object_key: "fixture", raw_object_sha256: "a".repeat(64), raw_object_byte_size: 0, raw_object_version_id: null, raw_object_etag: null, extracted_count: run.extractedCount ?? 1, staged_count: run.stagedCount ?? 0, quarantined_count: run.quarantinedCount ?? 0 })) as T[] };
      if (sql.startsWith("SELECT source_id,source_url")) return { rowCount: state.snapshot ? 1 : 0, rows: state.snapshot ? [state.snapshot as T] : [] };
      if (sql.startsWith("INSERT INTO source_snapshots")) { writes.push("snapshot"); state.snapshot = { source_id: values[2], source_url: values[3], published_at: values[4] === null ? null : new Date(values[4] as string), checksum_sha256: values[5], parser_version: values[6], license: values[7], usage_status: values[8] }; return { rowCount: 1, rows: [] }; }
      if (sql.startsWith("INSERT INTO ingest_runs")) { writes.push("run"); runs.push({ id: values[0] as string, status: "running" }); return { rowCount: 1, rows: [] }; }
      if (sql.startsWith("UPDATE ingest_runs SET status")) { const run = runs.find(item => item.id === values[0]); if (!run || run.status !== values[4]) return { rowCount: 0, rows: [] }; run.status = values[2] as FakeRun["status"]; writes.push(`status:${run.status}`); return { rowCount: 1, rows: [] }; }
      if (sql.startsWith("UPDATE ingest_runs SET staged_count") || sql.startsWith("UPDATE ingest_runs SET quarantined_count")) return { rowCount: 1, rows: [] };
      if (sql.startsWith("INSERT INTO quarantined_records")) { writes.push(`quarantine:${(values[5] as string[])[0]}`); return { rowCount: 1, rows: [] }; }
      return { rowCount: 1, rows: [] };
    }, release: () => undefined,
  };
  return { connect: async () => client } as never as Pool;
};
const pool = (): Pool => statefulPool();
const adapter = (count: number, hooks: { peak: number; staged: number; loaded: number; issue?: boolean }): SourceAdapter<null, Row> => ({
  sourceName: "fixture", adapterVersion: "test", async *extract() { yield raw(count); },
  async *parse() { for (let index = 0; index < count; index += 1) yield { kind: "row", row: { id: `key-${index}` } }; },
  naturalKey: row => row.id,
  async stage(_client: PoolClient, _run, rows) { hooks.peak = Math.max(hooks.peak, rows.length); hooks.staged += rows.length; },
  async validateStaged() { return hooks.issue ? [{ code: "invalid", message: "invalid" }] : []; },
  async loadFromStage() { hooks.loaded += 1; },
});

describe("raw-object stores", () => {
  it("hashes before publishing and removes checksum-mismatch partials", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-store-")); const store = new LocalRawObjectStore(root);
    const bytes = new TextEncoder().encode("safe fixture"); const sha256 = createHash("sha256").update(bytes).digest("hex");
    await expect(store.put({ objectKey: "objects/feed", body: (async function* () { yield bytes; })(), expectedSha256: sha256 })).resolves.toMatchObject({ sha256, byteSize: bytes.length });
    await expect(readFile(join(root, "objects/feed"), "utf8")).resolves.toBe("safe fixture");
    await expect(store.put({ objectKey: "objects/bad", body: (async function* () { yield bytes; })(), expectedSha256: "0".repeat(64) })).rejects.toThrow("checksum");
    await rm(root, { recursive: true, force: true });
  });
  it("rejects traversal and symlink escapes", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-store-")); const outside = await mkdtemp(join(tmpdir(), "raw-outside-")); await symlink(outside, join(root, "link"));
    const store = new LocalRawObjectStore(root); const body = (async function* () { yield new Uint8Array([1]); })();
    await expect(store.put({ objectKey: "../escape", body })).rejects.toThrow("escapes");
    await expect(store.put({ objectKey: "link/escape", body: (async function* () { yield new Uint8Array([1]); })() })).rejects.toThrow("outside");
    await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true });
  });
  it("rejects nested symlinks and makes repeat puts idempotent without clobbering", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-store-")); const outside = await mkdtemp(join(tmpdir(), "raw-outside-")); await mkdir(join(root, "nested")); await symlink(outside, join(root, "nested", "link"));
    const store = new LocalRawObjectStore(root); const bytes = new TextEncoder().encode("same"); const sha256 = createHash("sha256").update(bytes).digest("hex");
    await expect(store.put({ objectKey: "nested/link/nope", body: (async function* () { yield bytes; })() })).rejects.toThrow("outside");
    await store.put({ objectKey: "stable", body: (async function* () { yield bytes; })(), expectedSha256: sha256 });
    await expect(store.put({ objectKey: "stable", body: (async function* () { yield bytes; })(), expectedSha256: sha256 })).resolves.toMatchObject({ sha256 });
    await expect(store.put({ objectKey: "stable", body: (async function* () { yield new Uint8Array([9]); })(), expectedSha256: createHash("sha256").update(new Uint8Array([9])).digest("hex") })).rejects.toThrow("mismatch");
    await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true });
  });
  it("aborts local writes without publishing a partial object", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-store-")); const controller = new AbortController(); controller.abort();
    await expect(new LocalRawObjectStore(root).put({ objectKey: "cancelled", body: (async function* () { yield new Uint8Array([1]); })(), signal: controller.signal })).rejects.toBeDefined();
    await expect(readFile(join(root, "cancelled"))).rejects.toMatchObject({ code: "ENOENT" }); await rm(root, { recursive: true, force: true });
  });
  it("requires enabled S3 versioning", async () => {
    const client = { send: async () => ({ Status: "Suspended" }) };
    await expect(new S3RawObjectStore(client as never, "bucket").put({ objectKey: "safe", body: (async function* () { yield new Uint8Array([1]); })() })).rejects.toThrow("versioning Enabled");
  });
  it("uploads to a temporary S3 version, promotes it, verifies that exact version, and deletes the temporary version", async () => {
    const sent: Array<{ constructor: { name: string }; input: { Key?: string; VersionId?: string; CopySource?: string } }> = []; let heads = 0;
    const client = { send: async (command: { constructor: { name: string }; input: { Key?: string; VersionId?: string; CopySource?: string } }) => { sent.push(command); if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") { heads += 1; if (heads < 2) { const error = new Error("missing") as Error & { name: string }; error.name = "NotFound"; throw error; } return { Metadata: { sha256: hash }, ContentLength: 2, VersionId: "canonical-v" }; } if (command.constructor.name === "CopyObjectCommand") return { VersionId: "canonical-v" }; return {}; } };
    const factory = (params: { Body: AsyncIterable<Uint8Array> }) => ({ done: async () => { for await (const chunk of params.Body) expect(chunk.byteLength).toBeGreaterThan(0); return { VersionId: "temp-v" }; }, abort: () => undefined });
    const bytes = new Uint8Array([1, 2]); const hash = createHash("sha256").update(bytes).digest("hex");
    await expect(new S3RawObjectStore(client as never, "bucket", factory).put({ objectKey: "object", body: (async function* () { yield bytes; })(), expectedSha256: hash })).resolves.toMatchObject({ versionId: "canonical-v", sha256: hash });
    const copy = sent.find(c => c.constructor.name === "CopyObjectCommand");
    expect(copy?.input).toMatchObject({ Key: `object.${hash}`, CopySource: expect.stringMatching(/^bucket\/object\.tmp\.[^?]+\?versionId=temp-v$/) });
    expect(sent.find(c => c.constructor.name === "HeadObjectCommand" && c.input.VersionId === "canonical-v")?.input).toMatchObject({ Key: `object.${hash}`, VersionId: "canonical-v" });
    expect(sent.find(c => c.constructor.name === "DeleteObjectCommand")?.input).toMatchObject({ Key: expect.stringMatching(/^object\.tmp\./), VersionId: "temp-v" });
  });
  it("concurrently promotes content-addressed S3 versions and only reads exact versions after copy", async () => {
    const bytes = new Uint8Array([3, 4, 5]); const hash = createHash("sha256").update(bytes).digest("hex"); const sent: Array<{ name: string; input: { Key?: string; VersionId?: string } }> = []; let copies = 0;
    const client = { send: async (command: { constructor: { name: string }; input: { Key?: string; VersionId?: string } }) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" };
      if (command.constructor.name === "HeadObjectCommand") { if (!command.input.VersionId) { const error = new Error("missing") as Error & { name: string }; error.name = "NotFound"; throw error; } return { Metadata: { sha256: hash }, ContentLength: bytes.length, VersionId: command.input.VersionId }; }
      if (command.constructor.name === "CopyObjectCommand") return { VersionId: `canonical-${++copies}` };
      return {};
    } };
    let upload = 0; const factory = (params: { Body: AsyncIterable<Uint8Array> }) => ({ done: async () => { for await (const chunk of params.Body) expect([...chunk]).toEqual([...bytes]); return { VersionId: `temp-${++upload}` }; }, abort: () => undefined });
    const input = () => ({ objectKey: "logical/feed", body: (async function* () { yield bytes; })(), expectedSha256: hash });
    const results = await Promise.all([new S3RawObjectStore(client as never, "bucket", factory).put(input()), new S3RawObjectStore(client as never, "bucket", factory).put(input())]);
    expect(results).toEqual(expect.arrayContaining([expect.objectContaining({ objectKey: `logical/feed.${hash}`, sha256: hash, byteSize: bytes.length, versionId: "canonical-1" }), expect.objectContaining({ objectKey: `logical/feed.${hash}`, sha256: hash, byteSize: bytes.length, versionId: "canonical-2" })]));
    const copiedAt = sent.findIndex(command => command.name === "CopyObjectCommand");
    expect(sent.slice(copiedAt + 1).filter(command => command.name === "HeadObjectCommand").every(command => !!command.input.VersionId)).toBe(true);
    expect(sent.filter(command => command.name === "HeadObjectCommand" && command.input.VersionId).map(command => command.input.VersionId).sort()).toEqual(["canonical-1", "canonical-2"]);
    expect(sent.filter(command => command.name === "DeleteObjectCommand").map(command => command.input.VersionId).sort()).toEqual(["temp-1", "temp-2"]);
  });
  it("does not upload when aborted and reuses only an existing object with the supplied checksum", async () => {
    const expected = "a".repeat(64); const send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" };
      if (command.constructor.name === "HeadObjectCommand") return { Metadata: { sha256: expected }, ContentLength: 2, VersionId: "existing-v" };
      return {};
    }); const upload = vi.fn(); const store = new S3RawObjectStore({ send } as never, "bucket", upload as never);
    await expect(store.put({ objectKey: "object", body: (async function* () { yield new Uint8Array([1, 2]); })(), expectedSha256: expected })).resolves.toMatchObject({ versionId: "existing-v" }); expect(upload).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort();
    await expect(store.put({ objectKey: "new", body: (async function* () { yield new Uint8Array([1]); })(), signal: controller.signal })).rejects.toThrow("aborted"); expect(send).toHaveBeenCalledTimes(2);
  });
  it("cleans up a checksum-mismatched temporary version and never promotes it", async () => {
    const sent: string[] = []; const client = { send: async (command: { constructor: { name: string } }) => { sent.push(command.constructor.name); if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") { const error = new Error() as Error & { name: string }; error.name = "NotFound"; throw error; } return {}; } };
    const factory = (params: { Body: AsyncIterable<Uint8Array> }) => ({ done: async () => { for await (const chunk of params.Body) expect(chunk.byteLength).toBeGreaterThan(0); return { VersionId: "temp-v" }; }, abort: () => undefined });
    await expect(new S3RawObjectStore(client as never, "bucket", factory).put({ objectKey: "object", body: (async function* () { yield new Uint8Array([1]); })(), expectedSha256: "0".repeat(64) })).rejects.toThrow("checksum");
    expect(sent).toContain("DeleteObjectCommand"); expect(sent).not.toContain("CopyObjectCommand");
  });
  it("rejects missing temporary or promoted VersionIds", async () => {
    const client = { send: async (command: { constructor: { name: string } }) => { if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") { const error = new Error() as Error & { name: string }; error.name = "NotFound"; throw error; } return {}; } };
    const body = () => (async function* () { yield new Uint8Array([1]); })();
    await expect(new S3RawObjectStore(client as never, "bucket", params => ({ done: async () => { for await (const chunk of params.Body) void chunk; return {}; }, abort: () => undefined })).put({ objectKey: "object", body: body() })).rejects.toThrow("VersionId");
    await expect(new S3RawObjectStore(client as never, "bucket", params => ({ done: async () => { for await (const chunk of params.Body) void chunk; return { VersionId: "temp-v" }; }, abort: () => undefined })).put({ objectKey: "object", body: body() })).rejects.toThrow("promotion");
  });
  it("rejects a promoted version whose checksum or length cannot be verified, while cleaning up", async () => {
    const sent: string[] = []; let heads = 0;
    const client = { send: async (command: { constructor: { name: string } }) => { sent.push(command.constructor.name); if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") { heads += 1; if (heads < 1) { const error = new Error() as Error & { name: string }; error.name = "NotFound"; throw error; } return { Metadata: { sha256: "0".repeat(64) }, ContentLength: 99 }; } if (command.constructor.name === "CopyObjectCommand") return { VersionId: "canonical-v" }; return {}; } };
    const factory = (params: { Body: AsyncIterable<Uint8Array> }) => ({ done: async () => { for await (const chunk of params.Body) expect(chunk.byteLength).toBeGreaterThan(0); return { VersionId: "temp-v" }; }, abort: () => undefined });
    await expect(new S3RawObjectStore(client as never, "bucket", factory).put({ objectKey: "object", body: (async function* () { yield new Uint8Array([1]); })() })).rejects.toThrow("verification");
    expect(sent).toContain("DeleteObjectCommand");
  });
  it("surfaces temporary-version cleanup failures", async () => {
    const client = { send: async (command: { constructor: { name: string } }) => { if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") { const error = new Error() as Error & { name: string }; error.name = "NotFound"; throw error; } if (command.constructor.name === "DeleteObjectCommand") throw new Error("cleanup failed"); return {}; } };
    const factory = (params: { Body: AsyncIterable<Uint8Array> }) => ({ done: async () => { for await (const chunk of params.Body) expect(chunk.byteLength).toBeGreaterThan(0); return { VersionId: "temp-v" }; }, abort: () => undefined });
    await expect(new S3RawObjectStore(client as never, "bucket", factory).put({ objectKey: "object", body: (async function* () { yield new Uint8Array([1]); })(), expectedSha256: "0".repeat(64) })).rejects.toThrow("cleanup failed");
  });
});

describe("runSource", () => {
  it("uses identity-bound loaded and dry-run validated runs without content writes", async () => {
    const loadedWrites: string[] = []; const loaded = { id: "run_prior", status: "loaded" as const }; const matchingSnapshot = { source_id: "src_fixture", source_url: "https://example.test/feed", published_at: null, checksum_sha256: "a".repeat(64), parser_version: "test", license: "public", usage_status: "approved" };
    const result = await runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs: [loaded], snapshot: matchingSnapshot, writes: loadedWrites }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") });
    expect(result).toEqual({ runIds: [], reusedRunIds: ["run_prior"] }); expect(loadedWrites).toEqual([]);
    const validatedWrites: string[] = []; const dry = await runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs: [{ id: "run_dry", status: "validated" }], snapshot: matchingSnapshot, writes: validatedWrites }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), dryRun: true });
    expect(dry.reusedRunIds).toEqual(["run_dry"]); expect(validatedWrites).toEqual([]);
  });
  it("retries failed runs with an opaque UUID suffix and rejects running or conflicting snapshots", async () => {
    const runs: FakeRun[] = [{ id: "run_old", status: "failed" }]; const writes: string[] = [];
    await runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs, writes }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), dryRun: true });
    expect(runs.at(-1)?.id).toMatch(/^run_[a-f0-9]{64}_[0-9a-f-]{36}$/);
    await expect(runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs: [{ id: "run_busy", status: "running" }] }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("INGEST_ALREADY_RUNNING");
    await expect(runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ snapshot: { source_id: "wrong", source_url: "https://example.test/feed", published_at: null, checksum_sha256: "a".repeat(64), parser_version: "test", license: "public", usage_status: "approved" } }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("SNAPSHOT_CONFLICT");
  });
  it("validates inputs before opening a connection and batches opaque quarantines", async () => {
    const connect = vi.fn(); const badPool = { connect } as never as Pool;
    const invalid = { ...raw(0), receipt: { ...raw(0).receipt, objectKey: "../bad", byteSize: -1 } };
    const badAdapter = { ...adapter(0, { peak: 0, staged: 0, loaded: 0 }), async *extract() { yield invalid; } };
    await expect(runSource(badAdapter, { pool: badPool, releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("invalid") })).rejects.toThrow("cutoff"); expect(connect).not.toHaveBeenCalled();
    const writes: string[] = []; const quarantining = { ...adapter(2, { peak: 0, staged: 0, loaded: 0 }), async *parse() { yield { kind: "quarantine" as const, sourceNaturalKey: "secret", payloadChecksum: "b".repeat(64), errorCode: "parser says email@example.test" }; yield { kind: "quarantine" as const, sourceNaturalKey: "other", payloadChecksum: "c".repeat(64), errorCode: "parser says email@example.test" }; } };
    await runSource(quarantining, { pool: statefulPool({ writes }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), dryRun: true });
    expect(writes.find(write => write.startsWith("quarantine:"))).toMatch(/^quarantine:parse_[a-f0-9]{16}$/);
  });
  it("streams a generated million-record source within its batch bound", async () => {
    const hooks = { peak: 0, staged: 0, loaded: 0 };
    await runSource(adapter(1_000_000, hooks), { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), maxBatchSize: 257 });
    expect(hooks).toEqual({ peak: 257, staged: 1_000_000, loaded: 1 });
  }, 20_000);
  it("does not load when dry-run or staged validation fails", async () => {
    const dry = { peak: 0, staged: 0, loaded: 0 }; await runSource(adapter(2, dry), { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), dryRun: true }); expect(dry.loaded).toBe(0);
    const invalid = { peak: 0, staged: 0, loaded: 0, issue: true };
    await expect(runSource(adapter(1, invalid), { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("Staged validation failed"); expect(invalid.loaded).toBe(0);
  });
  it("fails deterministically for duplicate natural keys", async () => {
    const duplicate: SourceAdapter<null, Row> = {
      ...adapter(2, { peak: 0, staged: 0, loaded: 0 }),
      async *parse() { yield { kind: "row", row: { id: "same" } } as const; yield { kind: "row", row: { id: "same" } } as const; },
      naturalKey: () => "same",
    };
    await expect(runSource(duplicate, { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("DUPLICATE_BATCH_KEY");
  });
  it("emits exact aggregate counters and one terminal signal even when the sink throws", async () => {
    const signals: unknown[] = []; const sink = { emit: vi.fn((signal) => { signals.push(signal); throw new Error("sink failure"); }) };
    const mixed = { ...adapter(3, { peak: 0, staged: 0, loaded: 0 }), async *parse() { yield { kind: "row" as const, row: { id: "one" } }; yield { kind: "quarantine" as const, sourceNaturalKey: "two", payloadChecksum: "b".repeat(64), errorCode: "bad" }; yield { kind: "row" as const, row: { id: "three" } }; } };
    await expect(runSource(mixed, { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), signalSink: sink })).resolves.toBeDefined();
    expect(signals).toHaveLength(1); expect(signals[0]).toMatchObject({ outcome: "success", extractedCount: 3, stagedCount: 2, quarantinedCount: 1 });
  });
  it("uses persisted, exactly matching counts when a run is reused", async () => {
    const signals: unknown[] = []; const matchingSnapshot = { source_id: "src_fixture", source_url: "https://example.test/feed", published_at: null, checksum_sha256: "a".repeat(64), parser_version: "test", license: "public", usage_status: "approved" };
    await runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs: [{ id: "run_prior", status: "loaded", extractedCount: 1, stagedCount: 1, quarantinedCount: 0 }], snapshot: matchingSnapshot }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), signalSink: { emit: signal => { signals.push(signal); } } });
    expect(signals).toEqual([expect.objectContaining({ outcome: "success", extractedCount: 1, stagedCount: 1, quarantinedCount: 0 })]);
    await expect(runSource(adapter(1, { peak: 0, staged: 0, loaded: 0 }), { pool: statefulPool({ runs: [{ id: "run_bad", status: "loaded", extractedCount: 2 }], snapshot: matchingSnapshot }), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("RAW_RECEIPT_MISMATCH");
  });
  it("emits one sanitized failure terminal signal without leaking raw errors", async () => {
    const signals: unknown[] = []; const secret = "postgres://user:secret@example.test";
    const failing = { ...adapter(0, { peak: 0, staged: 0, loaded: 0 }), async *extract() { throw new Error(secret); } };
    await expect(runSource(failing, { pool: pool(), releaseId: "rel_fixture" as never, sourceId: "src_fixture" as never, cutoff: new Date("2025-01-01Z"), signalSink: { emit: signal => { signals.push(signal); } } })).rejects.toThrow(secret);
    expect(signals).toEqual([expect.objectContaining({ outcome: "failure", failureCode: "INGESTION_FAILED", extractedCount: 0, stagedCount: 0, quarantinedCount: 0 })]); expect(JSON.stringify(signals)).not.toContain(secret);
  });
});
