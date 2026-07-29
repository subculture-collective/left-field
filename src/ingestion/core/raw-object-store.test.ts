import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
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
    expect(store.storeLocator).toBe("bucket");
    await expect(store.read(receipt)).resolves.toEqual(Buffer.from(bytes));
    expect(sent[0]?.input).toEqual({ Bucket: "bucket", Key: "object", VersionId: "v1" });
    await expect(store.read({ ...receipt, storeLocator: "other" })).rejects.toThrow("belong");
    await expect(store.read({ ...receipt, versionId: undefined })).rejects.toThrow("VersionId");
    const before = sent.length;
    await expect(store.read({ ...receipt, versionId: "null" })).rejects.toThrow("VersionId");
    expect(sent).toHaveLength(before);
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

describe("S3RawObjectStore V2 direct final", () => {
  it("sends the caller signal on every command and never COPYs", async () => {
    const sha256=digest(bytes), calls: Array<{ constructor:{ name:string }; input:Record<string,unknown> }>=[];
    const signal=new AbortController().signal;
    const store=new S3RawObjectStore({send:async(command: { constructor:{name:string};input:Record<string,unknown> }, options:{abortSignal?:AbortSignal})=>{
      calls.push(command); expect(options.abortSignal).toBe(signal);
      if(command.constructor.name==="GetBucketVersioningCommand")return {Status:"Enabled"};
      if(command.constructor.name==="HeadObjectCommand"&&!command.input.VersionId){const error=Object.assign(new Error("missing"),{name:"NotFound"});throw error;}
      if(command.constructor.name==="PutObjectCommand")return {VersionId:"v1",ETag:"etag"};
      return {VersionId:"v1",ETag:"etag",Metadata:{sha256},ContentLength:bytes.length};
    }} as never,"bucket");
    await expect(store.putKnownVersioned({objectKey:`fec-v2/${sha256}/enumeration_page/artifact.${sha256}`,expectedSha256:sha256,expectedByteSize:bytes.byteLength,signal,body:bytes})).resolves.toMatchObject({versionId:"v1",etag:"etag",disposition:"created"});
    expect(calls.map(call=>call.constructor.name)).not.toContain("CopyObjectCommand");
  });

  it("never deletes a visible direct-final version after verification fails",async()=>{
    const sha256=digest(bytes),calls:Array<{constructor:{name:string};input:{VersionId?:string}}>=[];
    const store=new S3RawObjectStore({send:async(command:{constructor:{name:string};input:{VersionId?:string}})=>{calls.push(command);if(command.constructor.name==="GetBucketVersioningCommand")return {Status:"Enabled"};if(command.constructor.name==="HeadObjectCommand"&&!command.input.VersionId)throw Object.assign(new Error("missing"),{name:"NotFound"});if(command.constructor.name==="PutObjectCommand")return {VersionId:"created-v",ETag:"etag"};return {VersionId:"created-v",ETag:"wrong",Metadata:{sha256},ContentLength:bytes.length};}} as never,"bucket");
    await expect(store.putKnownVersioned({objectKey:`fec-v2/${sha256}/enumeration_page/artifact.${sha256}`,expectedSha256:sha256,expectedByteSize:bytes.length,body:bytes})).rejects.toThrow("verification");
    expect(calls.map(call=>call.constructor.name)).not.toContain("DeleteObjectCommand");
  });

  it("deduplicates an exact direct artifact without another PUT",async()=>{
    const sha256=digest(bytes),calls:string[]=[];
    const store=new S3RawObjectStore({send:async(command:{constructor:{name:string}})=>{calls.push(command.constructor.name);if(command.constructor.name==="GetBucketVersioningCommand")return {Status:"Enabled"};return {VersionId:"existing-v",ETag:"etag",Metadata:{sha256},ContentLength:bytes.length};}} as never,"bucket");
    await expect(store.putKnownVersioned({objectKey:`fec-v2/${sha256}/enumeration_page/artifact.${sha256}`,expectedSha256:sha256,expectedByteSize:bytes.length,body:bytes})).resolves.toMatchObject({versionId:"existing-v",disposition:"existing"});
    expect(calls).not.toContain("PutObjectCommand");
  });
  it("marks synchronously immediately before PUT, never for deduplication", async () => { const sha256 = digest(bytes), events: string[] = []; const store = new S3RawObjectStore({ send: async (command: { constructor: { name: string } }) => { events.push(command.constructor.name); if (command.constructor.name === "GetBucketVersioningCommand") return { Status: "Enabled" }; if (command.constructor.name === "HeadObjectCommand") throw Object.assign(new Error("missing"), { name: "NotFound" }); return { VersionId: "v1", ETag: "etag" }; } } as never, "bucket"); await expect(store.putKnownVersioned({ objectKey: `fec-v2/${sha256}/enumeration_page/artifact.${sha256}`, expectedSha256: sha256, expectedByteSize: bytes.length, body: bytes, onMutationAttempt: () => events.push("marker") } as never)).rejects.toThrow(); expect(events).toContain("marker"); expect(events.indexOf("marker")).toBe(events.indexOf("PutObjectCommand") - 1); const dedup = new S3RawObjectStore({ send: async (command: { constructor: { name: string } }) => command.constructor.name === "GetBucketVersioningCommand" ? { Status: "Enabled" } : { VersionId: "v1", ETag: "etag", Metadata: { sha256 }, ContentLength: bytes.length } } as never, "bucket"); const marker = vi.fn(); await dedup.putKnownVersioned({ objectKey: `fec-v2/${sha256}/enumeration_page/artifact.${sha256}`, expectedSha256: sha256, expectedByteSize: bytes.length, body: bytes, onMutationAttempt: marker } as never); expect(marker).not.toHaveBeenCalled(); });
});
