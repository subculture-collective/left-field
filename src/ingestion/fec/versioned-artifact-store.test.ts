import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { encodeFecEnumerationPage } from "./filing-ledger";
import { encodeFecSanitizedFilingArtifact } from "./efo-sanitizer";
import { createProductionS3ClientConfig, createS3VersionedRawObjectStore, createS3VersionedRawObjectStoreForTesting, fecV2ObjectKey, type CanonicalArtifactInput, type VersionedRawObjectStore } from "./versioned-artifact-store";
import { S3RawObjectStore } from "@/ingestion/core/raw-object-store";

const plan = "a".repeat(64), policy = { mode: "local_loopback" as const, endpointUrl: "http://127.0.0.1:9000", certificateValidation: false as const };
const context = { kind: "enumeration_page" as const, provenance: { kind: "daily_partition" as const, formType: "F3" as const, receiptDate: "2026-01-01" }, pass: 1 as const, pageNumber: 1, terminal: true };
const bytes = Uint8Array.from(encodeFecEnumerationPage({ schema: "fec-v2-enumeration-page-v1", version: 1, planSha256: plan, provenance: context.provenance, pass: 1, pageNumber: 1, terminal: true, records: [], recordMultiplicity: [] }));
const sha = createHash("sha256").update(bytes).digest("hex");
const future = (): number => Date.now() + 60_000;
function fake(): { store: VersionedRawObjectStore; puts: () => number; corrupt: () => void } { let body = Uint8Array.from(bytes), puts = 0, written = false; const raw = { storeLocator: "bucket", assertVersioning: async () => {}, putKnownVersioned: async (value: { body: Uint8Array; objectKey: string; expectedSha256: string }) => { const disposition = written ? "existing" as const : "created" as const; if (!written) { puts++; body = Uint8Array.from(value.body); written = true; } return { storeKind: "s3" as const, storeLocator: "bucket", objectKey: value.objectKey, sha256: value.expectedSha256, byteSize: body.byteLength, versionId: "v1", etag: "etag", disposition }; }, read: async (receipt: { storeLocator: string; objectKey: string; versionId?: string }) => { if (receipt.storeLocator !== "bucket" || receipt.objectKey !== fecV2ObjectKey(plan, "enumeration_page", sha) || receipt.versionId !== "v1") throw Error("wrong exact object"); return Uint8Array.from(body); } }; return { store: createS3VersionedRawObjectStoreForTesting(raw as never, policy), puts: () => puts, corrupt: () => { body[0] ^= 1; } }; }
const input = (activation: CanonicalArtifactInput["activation"]): CanonicalArtifactInput => ({ activation, planSha256: plan, artifactKind: "enumeration_page", canonicalBytes: bytes, expectedSha256: sha, expectedContext: context, deadlineMs: activation?.expiresAtMs ?? future() });

describe("VersionedRawObjectStore activation tokens", () => {
  it("rejects a missing token before mutation", async () => { const f = fake(); await f.store.preflight({ deadlineMs: future() }); await expect(f.store.putCanonical(input(undefined as never))).rejects.toThrow("ACTIVATION"); expect(f.puts()).toBe(0); });
  it("rejects forged, expired, and old preflight tokens without mutation", async () => { const f = fake(), first = await f.store.preflight({ deadlineMs: future() }), second = await f.store.preflight({ deadlineMs: future() }); await expect(f.store.putCanonical(input({ ...second } as never))).rejects.toThrow("ACTIVATION"); await expect(f.store.putCanonical(input(first))).rejects.toThrow("ACTIVATION"); await expect(f.store.putCanonical({ ...input(second), deadlineMs: Date.now() - 1 })).rejects.toThrow("ACTIVATION"); expect(f.puts()).toBe(0); });
  it("rejects a store-A token at store B without mutation", async () => { const a = fake(), b = fake(), token = await a.store.preflight({ deadlineMs: future() }); await b.store.preflight({ deadlineMs: future() }); await expect(b.store.putCanonical(input(token))).rejects.toThrow("ACTIVATION"); expect(b.puts()).toBe(0); });
  it("writes and reads the exact token-bound version", async () => { const f = fake(), token = await f.store.preflight({ deadlineMs: future() }), receipt = await f.store.putCanonical(input(token)); expect(receipt.objectKey).toBe(fecV2ObjectKey(plan, "enumeration_page", sha)); await expect(f.store.readExactVersion(receipt, { activation: token, deadlineMs: token.expiresAtMs, expectedContext: context })).resolves.toEqual(bytes); });
  it("deduplicates exact-version writes and rejects corrupted exact-version readback", async () => { const f = fake(), token = await f.store.preflight({ deadlineMs: future() }), request = input(token), first = await f.store.putCanonical(request), second = await f.store.putCanonical(request); expect(second).toEqual(first); expect(f.puts()).toBe(1); f.corrupt(); await expect(f.store.readExactVersion(first, { activation: token, deadlineMs: token.expiresAtMs, expectedContext: context })).rejects.toThrow("VERIFY"); });
  it("replays a persisted locator-free descriptor after preflight in a fresh store", async () => { const f = fake(), token = await f.store.preflight({ deadlineMs: future() }), descriptor = { plan, kind: "enumeration_page" as const, hash: sha, key: fecV2ObjectKey(plan, "enumeration_page", sha), version: "v1", etag: "etag", size: bytes.byteLength };
    await expect(f.store.readPersistedExactVersion(descriptor, { activation: token, deadlineMs: Date.now() + 1_000 })).resolves.toMatchObject({ bytes, context });
    await expect(f.store.readPersistedExactVersion({ ...descriptor, key: "wrong" }, { activation: token, deadlineMs: Date.now() + 1_000 })).rejects.toThrow("INVALID");
    await expect(f.store.readPersistedExactVersion({ ...descriptor, version: "wrong" }, { activation: token, deadlineMs: Date.now() + 1_000 })).rejects.toThrow();
    f.corrupt(); await expect(f.store.readPersistedExactVersion(descriptor, { activation: token, deadlineMs: Date.now() + 1_000 })).rejects.toThrow("VERIFY");
  });
});

describe("VersionedRawObjectStore production construction", () => {
  it("gives the AWS SDK a mutable copy of immutable parsed credentials", () => {
    const credentials = Object.freeze({ accessKeyId: "key", secretAccessKey: "secret" });
    const config = createProductionS3ClientConfig(
      { region: "us-east-1", endpoint: "https://s3.example.test/", forcePathStyle: true, credentials },
      () => ({}) as never,
    );
    expect(config.credentials).not.toBe(credentials);
    expect(Object.isFrozen(config.credentials)).toBe(false);
    expect(() => Object.assign(config.credentials, { CREDENTIALS_CODE: "e" })).not.toThrow();
  });

  it("replays a persisted descriptor after preflight without a local put", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async command => {
      if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" } as never;
      if (command.constructor.name === "GetObjectCommand") return { VersionId: "v1", ETag: "etag", Metadata: { sha256: sha }, ContentLength: bytes.byteLength, Body: (async function* () { yield bytes; })() } as never;
      throw Error("unexpected command");
    });
    try {
      const store = createS3VersionedRawObjectStore({ bucket: "bucket", policy: { mode: "production", endpointUrl: "https://s3.example.test/", certificateValidation: true, retentionEvidenceSha256: "b".repeat(64) }, client: { region: "us-east-1", endpoint: "https://s3.example.test/", forcePathStyle: true, credentials: { accessKeyId: "key", secretAccessKey: "secret" } } });
      const token = await store.preflight({ deadlineMs: future() });
      await expect(store.readPersistedExactVersion({ plan, kind: "enumeration_page", hash: sha, key: fecV2ObjectKey(plan, "enumeration_page", sha), version: "v1", etag: "etag", size: bytes.byteLength }, { activation: token, deadlineMs: Date.now() + 1_000 })).resolves.toMatchObject({ bytes, context });
    } finally { send.mockRestore(); }
  });
});

describe("VersionedRawObjectStore bounded replay", () => {
  it("returns within deadline plus grace, poisons an abort-resistant raw read, and leaves no unhandled rejection", async () => {
    const raw = new S3RawObjectStore({ send: async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" };
      if (command.constructor.name === "GetObjectCommand") return { VersionId: "v", ETag: "e", Metadata: { sha256: sha }, ContentLength: bytes.byteLength, Body: { [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<Uint8Array>>(() => undefined) }) } };
      throw Error("unexpected command");
    } } as never, "bucket");
    const store = createS3VersionedRawObjectStoreForTesting(raw, policy), token = await store.preflight({ deadlineMs: Date.now() + 5_000 });
    const receipt = { storeKind: "s3" as const, storeLocator: "bucket", objectKey: fecV2ObjectKey(plan, "enumeration_page", sha), sha256: sha, byteSize: bytes.byteLength, versionId: "v", etag: "e", planSha256: plan, artifactKind: "enumeration_page" as const };
    const deadlineMs = Date.now() + 20, started = Date.now();
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs, expectedContext: context })).rejects.toThrow("DEADLINE");
    expect(Date.now() - started).toBeLessThanOrEqual(1_150);
    await expect(store.preflight({ deadlineMs: Date.now() + 5_000 })).rejects.toThrow("ACTIVATION");
    await expect(store.putCanonical(input(token))).rejects.toThrow("ACTIVATION");
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs: Date.now() + 5_000, expectedContext: context })).rejects.toThrow("ACTIVATION");
  });
});

describe("real testing-store sanitized artifact", () => {
  const ledger = "b".repeat(64), sanitized = encodeFecSanitizedFilingArtifact({ schemaVersion: 2, artifactKind: "sanitized_filing", acquisitionPlanSha256: plan, fileNumber: 12, formatVersion: "8.5", ledgerIdentitySha256: ledger, reportDate: null, records: [], noRetention: { rawFilingNotStored: true, nonScheduleERecordsDiscarded: true, piiFieldsDiscarded: true } });
  const sanitizedSha = createHash("sha256").update(sanitized).digest("hex"), sanitizedContext = { kind: "sanitized_filing" as const, fileNumber: 12, ledgerIdentitySha256: ledger };
  it("stores canonical sanitizer bytes through created and dedup paths, pinned to the exact VersionId", async () => {
    const body = Uint8Array.from(sanitized); let created = 0, corrupt = false; const commands: Array<{ constructor: { name: string }; input: Record<string, unknown> }> = [];
    const sender = { send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => { commands.push(command); const name = command.constructor.name, input = command.input; if (name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (name === "HeadObjectCommand" && !created) throw Object.assign(new Error("missing"), { name: "NotFound" }); if (name === "PutObjectCommand") { created++; expect(Uint8Array.from(input.Body as Uint8Array)).toEqual(Uint8Array.from(sanitized)); return { VersionId: "version-1", ETag: "etag-1" }; } if (name === "HeadObjectCommand") return { VersionId: input.VersionId ?? "version-1", ETag: "etag-1", Metadata: { sha256: sanitizedSha }, ContentLength: body.byteLength }; if (name === "GetObjectCommand") return { VersionId: input.VersionId, ETag: "etag-1", Metadata: { sha256: sanitizedSha }, ContentLength: body.byteLength, Body: (async function* () { yield corrupt ? Uint8Array.from([body[0]! ^ 1, ...body.slice(1)]) : body; })() }; throw Error(`unexpected ${name}`); } };
    const upload = () => ({ done: async () => ({ VersionId: "unused", ETag: "unused" }), abort: () => undefined });
    const store = createS3VersionedRawObjectStoreForTesting(new S3RawObjectStore(sender as never, "bucket", upload), policy), token = await store.preflight({ deadlineMs: Date.now() + 5_000 });
    const request = { activation: token, planSha256: plan, artifactKind: "sanitized_filing" as const, canonicalBytes: sanitized, expectedSha256: sanitizedSha, expectedContext: sanitizedContext, deadlineMs: Date.now() + 1_000 };
    const receipt = await store.putCanonical(request);
    const duplicate = await store.putCanonical(request);
    expect(receipt).toEqual(duplicate); expect(created).toBe(1); expect(receipt.objectKey).toBe(fecV2ObjectKey(plan, "sanitized_filing", sanitizedSha)); expect(commands.some(x => x.constructor.name === "GetBucketVersioningCommand" && x.input.Bucket === "bucket")).toBe(true); expect(commands.some(x => x.constructor.name === "HeadObjectCommand" && x.input.VersionId === "version-1")).toBe(true); expect(commands.filter(x => x.constructor.name === "GetObjectCommand").every(x => x.input.VersionId === "version-1")).toBe(true);
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs: Date.now() + 1_000, expectedContext: sanitizedContext })).resolves.toEqual(Uint8Array.from(sanitized));
    const noncanonical = Uint8Array.from(Buffer.from(JSON.stringify(JSON.parse(Buffer.from(sanitized).toString()), null, 2)));
    await expect(store.putCanonical({ ...request, canonicalBytes: noncanonical, expectedSha256: createHash("sha256").update(noncanonical).digest("hex") })).rejects.toThrow();
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs: Date.now() + 1_000, expectedContext: { ...sanitizedContext, fileNumber: 13 } })).rejects.toThrow("VERIFY");
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs: Date.now() + 1_000, expectedContext: { ...sanitizedContext, ledgerIdentitySha256: "c".repeat(64) } })).rejects.toThrow("VERIFY");
    corrupt = true;
    await expect(store.readExactVersion(receipt, { activation: token, deadlineMs: Date.now() + 1_000, expectedContext: sanitizedContext })).rejects.toThrow();
  });
});
