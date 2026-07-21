import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalMapArtifactStore, S3MapArtifactStore } from "./map-artifact-store";
import type { MapArtifactReceipt } from "./map-artifact-store";

const bytes = new Uint8Array([1, 2, 3]); const sha256 = createHash("sha256").update(bytes).digest("hex");
const input = { releaseId: "rel_R4", geographyId: "geo_123", bytes };

describe("map artifact stores", () => {
  it("confines local paths, publishes atomically, and permits only same-byte retries", async () => {
    const root = await mkdtemp(join(tmpdir(), "maps-")); const store = new LocalMapArtifactStore(root);
    await expect(store.put({ ...input, releaseId: "../escape" })).rejects.toThrow("bounded");
    await expect(store.put({ ...input, geographyId: "" })).rejects.toThrow("bounded");
    await expect(store.put(input)).resolves.toMatchObject({ key: "maps/rel_R4/geo_123.geojson" });
    await expect(store.put(input)).resolves.toMatchObject({ sha256 });
    await expect(store.put({ ...input, bytes: new Uint8Array([4]) })).rejects.toThrow("different bytes");
    await symlink(join(root, "outside"), join(root, "maps", "rel_symlink"));
    await expect(store.put({ ...input, releaseId: "rel_symlink" })).rejects.toThrow("symlink");
    await rm(root, { recursive: true, force: true });
  });
  it("rejects mutated local receipts and replacement bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "maps-")); const store = new LocalMapArtifactStore(root); const receipt = await store.put(input);
    await expect(store.read({ ...receipt, storeIdentity: "other" })).rejects.toThrow("belong");
    await expect(store.read({ ...receipt, versionId: "v1", etag: "etag" } as MapArtifactReceipt)).rejects.toThrow("shape");
    await expect(store.read({ ...receipt, byteSize: 0 })).rejects.toThrow("invalid");
    await expect(store.put({ ...input, bytes: new Uint8Array() })).rejects.toThrow("nonempty");
    await expect(store.put({ ...input, bytes: new Uint8Array(32 * 1024 * 1024 + 1) })).rejects.toThrow("limit");
    await writeFile(join(root, receipt.key), new Uint8Array([9])); await expect(store.read(receipt)).rejects.toThrow("verification"); await rm(root, { recursive: true, force: true });
  });
  it("does not clobber a concurrently published local artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "maps-")); const store = new LocalMapArtifactStore(root); const replacement = new Uint8Array([4, 5, 6]);
    const results = await Promise.allSettled([store.put(input), store.put({ ...input, bytes: replacement })]);
    const published = results.filter((result): result is PromiseFulfilledResult<MapArtifactReceipt> => result.status === "fulfilled");
    expect(published).toHaveLength(1); expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(store.read(published[0]!.value)).resolves.toEqual(Buffer.from(published[0]!.value.sha256 === sha256 ? bytes : replacement));
    await rm(root, { recursive: true, force: true });
  });
  it("requires versioned S3 receipts and verifies their exact version, etag, hash, and size", async () => {
    const receipt: MapArtifactReceipt = { storeKind: "s3", storeIdentity: "bucket", key: "maps/rel_R4/geo_123.geojson", sha256, byteSize: bytes.length, versionId: "v1", etag: "etag" };
    const sent: Array<{ input: unknown }> = []; const store = new S3MapArtifactStore({ send: async (command: { input: unknown }) => { sent.push(command); return { VersionId: "v1", ETag: "etag", Metadata: { sha256 }, ContentLength: bytes.length, Body: (async function* () { yield bytes; })() }; } } as never, "bucket");
    await expect(store.read(receipt)).resolves.toEqual(Buffer.from(bytes)); expect(sent[0]?.input).toEqual({ Bucket: "bucket", Key: receipt.key, VersionId: "v1" });
    await expect(store.read({ ...receipt, versionId: undefined })).rejects.toThrow("VersionId");
    await expect(store.read({ ...receipt, etag: undefined })).rejects.toThrow("ETag");
    await expect(store.read({ ...receipt, etag: "wrong" })).rejects.toThrow("verification");
    await expect(store.read({ ...receipt, versionId: "" })).rejects.toThrow("VersionId");
    await expect(store.read({ ...receipt, versionId: " " })).rejects.toThrow("VersionId");
    await expect(store.read({ ...receipt, etag: "" })).rejects.toThrow("ETag");
    await expect(store.read({ ...receipt, extra: true } as unknown as MapArtifactReceipt)).rejects.toThrow("shape");
    const invalid = (result: object) => new S3MapArtifactStore({ send: async () => result } as never, "bucket");
    await expect(invalid({ VersionId: "v1", ETag: "etag", Metadata: { sha256 }, ContentLength: 4, Body: (async function* () { yield bytes; })() }).read(receipt)).rejects.toThrow("verification");
    await expect(invalid({ VersionId: "wrong", ETag: "etag", Metadata: { sha256 }, ContentLength: bytes.length, Body: (async function* () { yield bytes; })() }).read(receipt)).rejects.toThrow("verification");
    await expect(invalid({ VersionId: "v1", ETag: "etag", Metadata: { sha256: "0".repeat(64) }, ContentLength: bytes.length, Body: (async function* () { yield bytes; })() }).read(receipt)).rejects.toThrow("verification");
  });
  it("bounds S3 streams while consuming them and cancels oversized or partial responses", async () => {
    const receipt: MapArtifactReceipt = { storeKind: "s3", storeIdentity: "bucket", key: "maps/rel_R4/geo_123.geojson", sha256, byteSize: bytes.length, versionId: "v1", etag: "etag" };
    let cancelled = false;
    const oversized: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]() { let sent = false; return { next: async () => sent ? { done: true as const, value: undefined } : (sent = true, { done: false as const, value: new Uint8Array([1, 2, 3, 4]) }), return: async () => { cancelled = true; return { done: true as const, value: undefined }; } }; },
    };
    const result = { VersionId: "v1", ETag: "etag", Metadata: { sha256 }, ContentLength: bytes.length, Body: oversized };
    await expect(new S3MapArtifactStore({ send: async () => result } as never, "bucket").read(receipt)).rejects.toThrow("limit");
    expect(cancelled).toBe(true);
    const partial = { ...result, Body: (async function* () { yield new Uint8Array([1, 2]); })() };
    await expect(new S3MapArtifactStore({ send: async () => partial } as never, "bucket").read(receipt)).rejects.toThrow("verification");
  });
  it("rejects S3 puts without bucket versioning or immutable receipt identity", async () => {
    const noVersioning = new S3MapArtifactStore({ send: async () => ({ Status: "Suspended" }) } as never, "bucket"); await expect(noVersioning.put(input)).rejects.toThrow("versioning");
    const missingReceipt = new S3MapArtifactStore({ send: async (command: { input: { Key?: string; IfNoneMatch?: string } }) => { if (command.input.IfNoneMatch) return {}; if (command.input.Key) throw { name: "NotFound" }; return { Status: "Enabled" }; } } as never, "bucket"); await expect(missingReceipt.put(input)).rejects.toThrow("VersionId and ETag");
    expect(() => new S3MapArtifactStore({ send: async () => ({}) } as never, "")).toThrow("bucket identity");
    expect(() => new S3MapArtifactStore({ send: async () => ({}) } as never, "A".repeat(64))).toThrow("bucket identity");
    expect(() => new S3MapArtifactStore({ send: async () => ({}) } as never, "bucket..name")).toThrow("bucket identity");
  });
});
