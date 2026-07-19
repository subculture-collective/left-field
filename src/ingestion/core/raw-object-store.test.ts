import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalRawObjectStore, S3RawObjectStore } from "./raw-object-store";
import type { RawObjectResult } from "./raw-object-store";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const bytes = new Uint8Array([1, 2, 3]);

describe("RawObjectStore.read", () => {
  it("replays local bytes only from the canonical receipt path and verifies replacements", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-read-"));
    const store = new LocalRawObjectStore(root); const sha256 = digest(bytes);
    const receipt = await store.put({ objectKey: "nested/object", body: (async function* () { yield bytes; })(), expectedSha256: sha256 });
    await expect(store.read(receipt)).resolves.toEqual(Buffer.from(bytes));
    await expect(store.read({ ...receipt, storeLocator: `${root}-other` })).rejects.toThrow("belong");
    await unlink(join(root, "nested/object"));
    await expect(store.read(receipt)).rejects.toBeDefined();
    await writeFile(join(root, "nested/object"), new Uint8Array([4, 5, 6]));
    await expect(store.read(receipt)).rejects.toThrow("verification");
    await unlink(join(root, "nested/object")); await symlink(join(root, "nested"), join(root, "nested/object"));
    await expect(store.read(receipt)).rejects.toThrow("regular file");
    await rm(root, { recursive: true, force: true });
  });

  it("rejects invalid local receipt sizes and aborted reads", async () => {
    const root = await mkdtemp(join(tmpdir(), "raw-read-")); const store = new LocalRawObjectStore(root); const sha256 = digest(bytes);
    const receipt = await store.put({ objectKey: "object", body: (async function* () { yield bytes; })(), expectedSha256: sha256 });
    await expect(store.read({ ...receipt, byteSize: 256 * 1024 * 1024 + 1 })).rejects.toThrow("invalid");
    const controller = new AbortController(); controller.abort();
    await expect(store.read(receipt, controller.signal)).rejects.toThrow("aborted");
    await rm(root, { recursive: true, force: true });
  });

  it("gets and verifies only the exact S3 version", async () => {
    const sha256 = digest(bytes); const receipt: RawObjectResult = { storeKind: "s3", storeLocator: "bucket", objectKey: "object", sha256, byteSize: bytes.length, versionId: "v1" };
    const sent: Array<{ input: { Bucket?: string; Key?: string; VersionId?: string } }> = [];
    const store = new S3RawObjectStore({ send: async (command: { input: { Bucket?: string; Key?: string; VersionId?: string } }) => { sent.push(command); return { VersionId: "v1", Metadata: { sha256 }, ContentLength: bytes.length, Body: (async function* () { yield bytes; })() }; } } as never, "bucket");
    await expect(store.read(receipt)).resolves.toEqual(Buffer.from(bytes));
    expect(sent[0]?.input).toEqual({ Bucket: "bucket", Key: "object", VersionId: "v1" });
    await expect(store.read({ ...receipt, storeLocator: "other" })).rejects.toThrow("belong");
    await expect(store.read({ ...receipt, versionId: undefined })).rejects.toThrow("VersionId");
  });

  it("rejects deleted, mismatched, bodyless, and aborted S3 responses", async () => {
    const sha256 = digest(bytes); const receipt: RawObjectResult = { storeKind: "s3", storeLocator: "bucket", objectKey: "object", sha256, byteSize: bytes.length, versionId: "v1" };
    const response = (value: object) => new S3RawObjectStore({ send: async () => value } as never, "bucket");
    await expect(new S3RawObjectStore({ send: async () => { throw new Error("deleted"); } } as never, "bucket").read(receipt)).rejects.toThrow("deleted");
    await expect(response({ VersionId: "v1", Metadata: { sha256: "0".repeat(64) }, ContentLength: bytes.length, Body: (async function* () { yield bytes; })() }).read(receipt)).rejects.toThrow("response verification");
    await expect(response({ VersionId: "v1", Metadata: { sha256 }, ContentLength: bytes.length + 1, Body: (async function* () { yield bytes; })() }).read(receipt)).rejects.toThrow("response verification");
    await expect(response({ VersionId: "v1", Metadata: { sha256 }, ContentLength: bytes.length }).read(receipt)).rejects.toThrow("response verification");
    const controller = new AbortController(); controller.abort();
    await expect(response({}).read(receipt, controller.signal)).rejects.toThrow("aborted");
  });
});
