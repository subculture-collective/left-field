import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, lstat, mkdir, realpath, rm } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { HeadObjectCommand, GetBucketVersioningCommand, GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { MAX_MAP_ARTIFACT_BYTES } from "./public-map";

const MAX_ARTIFACT_BYTES = MAX_MAP_ARTIFACT_BYTES;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const S3_BUCKET = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const OPAQUE_ID = /^[\x21-\x7e]{1,1024}$/;
const validS3Bucket = (bucket: string) => S3_BUCKET.test(bucket) && !bucket.includes("..");

export interface MapArtifactPut { readonly releaseId: string; readonly geographyId: string; readonly bytes: Uint8Array; }
export interface MapArtifactReceipt {
  readonly storeKind: "local" | "s3";
  readonly storeIdentity: string;
  readonly key: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly versionId?: string;
  readonly etag?: string;
}
// The local and S3 variants are enforced at the runtime boundary because receipts may be deserialized.
export interface MapArtifactStore { put(input: MapArtifactPut): Promise<MapArtifactReceipt>; read(receipt: MapArtifactReceipt): Promise<Uint8Array>; }
type S3Sender = Pick<S3Client, "send">;

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const keyFor = (releaseId: string, geographyId: string) => {
  if (!ID.test(releaseId) || !ID.test(geographyId)) throw new Error("Map release and geography IDs must be bounded identifiers");
  return `maps/${releaseId}/${geographyId}.geojson`;
};
const checkBytes = (bytes: Uint8Array) => {
  if (!Number.isSafeInteger(bytes.byteLength) || bytes.byteLength < 1 || bytes.byteLength > MAX_ARTIFACT_BYTES) throw new Error("Map artifact bytes must be nonempty and within the configured limit");
};
const checkReceipt = (receipt: MapArtifactReceipt, kind: "local" | "s3", identity: string) => {
  if (!receipt || typeof receipt !== "object") throw new Error("Map artifact receipt is invalid");
  const ownKeys = Reflect.ownKeys(receipt);
  if (!ownKeys.every((key): key is string => typeof key === "string")) throw new Error("Map artifact receipt has an invalid shape");
  const keys = ownKeys.sort();
  const expected = kind === "local" ? ["byteSize", "key", "sha256", "storeIdentity", "storeKind"] : ["byteSize", "etag", "key", "sha256", "storeIdentity", "storeKind", "versionId"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new Error("Map artifact receipt has an invalid shape");
  if (receipt.storeKind !== kind || typeof receipt.storeIdentity !== "string" || receipt.storeIdentity !== identity) throw new Error("Map artifact receipt does not belong to this store");
  const match = /^maps\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\.geojson$/.exec(receipt.key);
  if (typeof receipt.key !== "string" || typeof receipt.sha256 !== "string" || !match || keyFor(match[1]!, match[2]!) !== receipt.key || !/^[a-f0-9]{64}$/.test(receipt.sha256) || !Number.isSafeInteger(receipt.byteSize) || receipt.byteSize < 1 || receipt.byteSize > MAX_ARTIFACT_BYTES) throw new Error("Map artifact receipt is invalid");
  if (kind === "s3" && (!("versionId" in receipt) || !("etag" in receipt) || typeof receipt.versionId !== "string" || typeof receipt.etag !== "string" || !OPAQUE_ID.test(receipt.versionId) || !OPAQUE_ID.test(receipt.etag))) throw new Error("S3 map artifact receipt requires nonempty valid VersionId and ETag");
};
const checked = (bytes: Uint8Array, receipt: MapArtifactReceipt) => {
  checkBytes(bytes);
  if (bytes.byteLength !== receipt.byteSize || hash(bytes) !== receipt.sha256) throw new Error("Map artifact content verification failed");
  return bytes;
};
async function readBounded(stream: AsyncIterable<Uint8Array>, limit: number): Promise<Uint8Array> {
  const iterator = stream[Symbol.asyncIterator]();
  const chunks: Buffer[] = []; let size = 0; let complete = false;
  try {
    for (;;) {
      const next = await iterator.next(); if (next.done) { complete = true; break; }
      const chunk = Buffer.from(next.value);
      if (chunk.byteLength > limit - size) throw new Error("Map artifact exceeds the configured limit");
      size += chunk.byteLength; chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, size);
  } finally {
    if (!complete) await iterator.return?.().catch(() => undefined);
  }
}

export class LocalMapArtifactStore implements MapArtifactStore {
  constructor(private readonly configuredRoot: string) {}
  async put(input: MapArtifactPut): Promise<MapArtifactReceipt> {
    const key = keyFor(input.releaseId, input.geographyId); checkBytes(input.bytes);
    await mkdir(this.configuredRoot, { recursive: true }); const root = await realpath(this.configuredRoot);
    let parent = root;
    for (const part of key.split("/").slice(0, -1)) {
      const next = resolve(parent, part);
      if (relative(root, next).startsWith("..")) throw new Error("Map artifact path escapes configured root");
      try { const stat = await lstat(next); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Map artifact path resolves through a symlink"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; try { await mkdir(next); } catch (mkdirError) { if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError; } const stat = await lstat(next); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Map artifact path resolves through a symlink"); }
      parent = next;
    }
    const target = resolve(parent, basename(key)); const wanted = hash(input.bytes);
    try {
      const stat = await lstat(target); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Map artifact target cannot be replaced");
      const old = await this.read({ storeKind: "local", storeIdentity: root, key, sha256: wanted, byteSize: input.bytes.byteLength });
      return { storeKind: "local", storeIdentity: root, key, sha256: wanted, byteSize: old.byteLength };
    } catch (error) { const mismatch = error instanceof Error && (error.message === "Map artifact content verification failed" || error.message === "Map artifact exceeds the configured limit"); if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !mismatch) throw error; if (mismatch) throw new Error("Map artifact key already exists with different bytes"); }
    const temporary = resolve(parent, `.${basename(target)}.${randomUUID()}.partial`);
    try { await pipeline([input.bytes], createWriteStream(temporary, { flags: "wx" })); await link(temporary, target); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const old = await this.read({ storeKind: "local", storeIdentity: root, key, sha256: wanted, byteSize: input.bytes.byteLength });
      if (old.byteLength !== input.bytes.byteLength) throw new Error("Map artifact key already exists with different bytes");
      return { storeKind: "local", storeIdentity: root, key, sha256: wanted, byteSize: old.byteLength };
    }
    finally { await rm(temporary, { force: true }); }
    return { storeKind: "local", storeIdentity: root, key, sha256: wanted, byteSize: input.bytes.byteLength };
  }
  async read(receipt: MapArtifactReceipt): Promise<Uint8Array> {
    const root = await realpath(this.configuredRoot); checkReceipt(receipt, "local", root);
    let path = root;
    for (const part of receipt.key.split("/")) { path = resolve(path, part); if (relative(root, path).startsWith("..")) throw new Error("Map artifact path escapes configured root"); const stat = await lstat(path); if (stat.isSymbolicLink() || (part.endsWith(".geojson") ? !stat.isFile() : !stat.isDirectory())) throw new Error("Map artifact path is not a regular file"); if (part.endsWith(".geojson") && stat.size > MAX_ARTIFACT_BYTES) throw new Error("Map artifact exceeds the configured limit"); }
    return checked(await readBounded(createReadStream(path), Math.min(MAX_ARTIFACT_BYTES, receipt.byteSize)), receipt);
  }
}

export class S3MapArtifactStore implements MapArtifactStore {
  constructor(private readonly client: S3Sender, private readonly bucket: string) {
    if (!validS3Bucket(bucket)) throw new Error("Map artifact bucket must be a nonempty bounded S3 bucket identity");
  }
  async put(input: MapArtifactPut): Promise<MapArtifactReceipt> {
    const key = keyFor(input.releaseId, input.geographyId); checkBytes(input.bytes); const sha256 = hash(input.bytes);
    const versioning = await this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket })); if (versioning.Status !== "Enabled") throw new Error("Map artifact bucket must have versioning Enabled");
    const existing = async (): Promise<MapArtifactReceipt | null> => {
      try {
        const old = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })) as { VersionId?: string; ETag?: string; Metadata?: Record<string, string>; ContentLength?: number };
        if (!old.VersionId || !old.ETag || !OPAQUE_ID.test(old.VersionId) || !OPAQUE_ID.test(old.ETag) || old.Metadata?.sha256 !== sha256 || old.ContentLength !== input.bytes.byteLength) throw new Error("Map artifact key already exists with different bytes");
        const receipt: MapArtifactReceipt = { storeKind: "s3", storeIdentity: this.bucket, key, sha256, byteSize: input.bytes.byteLength, versionId: old.VersionId, etag: old.ETag };
        await this.read(receipt); return receipt;
      } catch (error) { const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode; if (status === 404 || (error as { name?: string }).name === "NotFound") return null; throw error; }
    };
    const found = await existing(); if (found) return found;
    let put: { VersionId?: string; ETag?: string };
    try { put = await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.bytes, Metadata: { sha256 }, IfNoneMatch: "*" })) as { VersionId?: string; ETag?: string }; }
    catch (error) { const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode; if (status !== 412 && (error as { name?: string }).name !== "PreconditionFailed") throw error; const raced = await existing(); if (raced) return raced; throw error; }
    if (!put.VersionId || !put.ETag || !OPAQUE_ID.test(put.VersionId) || !OPAQUE_ID.test(put.ETag)) throw new Error("Map artifact upload did not return valid VersionId and ETag");
    const receipt: MapArtifactReceipt = { storeKind: "s3", storeIdentity: this.bucket, key, sha256, byteSize: input.bytes.byteLength, versionId: put.VersionId, etag: put.ETag };
    await this.read(receipt); return receipt;
  }
  async read(receipt: MapArtifactReceipt): Promise<Uint8Array> {
    checkReceipt(receipt, "s3", this.bucket);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: receipt.key, VersionId: receipt.versionId })) as { VersionId?: string; ETag?: string; Metadata?: Record<string, string>; ContentLength?: number; Body?: AsyncIterable<Uint8Array> };
    if (result.VersionId !== receipt.versionId || result.ETag !== receipt.etag || result.Metadata?.sha256 !== receipt.sha256 || result.ContentLength !== receipt.byteSize || !result.Body) throw new Error("Map artifact response verification failed");
    return checked(await readBounded(result.Body, Math.min(MAX_ARTIFACT_BYTES, receipt.byteSize)), receipt);
  }
}
