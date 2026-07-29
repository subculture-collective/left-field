import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import {
  createFecBulkBootstrap,
  decodeFecBulkManifest,
  encodeFecBulkBootstrap,
  fecBulkBootstrapSha256,
} from "@/ingestion/fec/bulk-bootstrap";
import { createArtifactRawObjectStore } from "./ingestion-config";

export type BootstrapFecBulkArgs = Readonly<{
  root: string;
  manifest: string;
  outputKey: string;
}>;
export type BootstrapFecBulkDependencies = Readonly<{
  store?: RawObjectStore;
  readManifest?: (path: string) => Buffer;
}>;

const usage = "Require --root, --manifest, and --output-key under fec/bootstrap/2026/ ending in .json";

export function parseBootstrapFecBulkArgs(argv: readonly string[]): BootstrapFecBulkArgs {
  const values = new Map<string, string>();
  const known = new Set(["--root", "--manifest", "--output-key"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !value || !known.has(key) || value.startsWith("--") || values.has(key))
      throw new Error(usage);
    values.set(key, value);
  }
  const root = values.get("--root");
  const manifest = values.get("--manifest");
  const outputKey = values.get("--output-key");
  if (
    !root ||
    !manifest ||
    !outputKey ||
    !/^fec\/bootstrap\/2026\/[a-z0-9][a-z0-9._-]{0,180}\.json$/.test(outputKey)
  ) throw new Error(usage);
  return { root, manifest, outputKey };
}

export function readFecBulkManifestFile(path: string): Buffer {
  let descriptor = -1;
  try {
    const namedBefore = lstatSync(path);
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedBefore = fstatSync(descriptor);
    if (
      !namedBefore.isFile() ||
      !openedBefore.isFile() ||
      openedBefore.dev !== namedBefore.dev ||
      openedBefore.ino !== namedBefore.ino ||
      openedBefore.size < 1 ||
      openedBefore.size > 64 * 1024
    ) throw new Error("FEC_BULK_MANIFEST_FILE_INVALID");
    const bytes = Buffer.alloc(openedBefore.size);
    for (let offset = 0; offset < bytes.length;) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (!count) throw new Error("FEC_BULK_MANIFEST_FILE_CHANGED");
      offset += count;
    }
    const openedAfter = fstatSync(descriptor);
    const namedAfter = lstatSync(path);
    if (
      openedAfter.dev !== openedBefore.dev ||
      openedAfter.ino !== openedBefore.ino ||
      openedAfter.size !== openedBefore.size ||
      namedAfter.dev !== openedBefore.dev ||
      namedAfter.ino !== openedBefore.ino ||
      !namedAfter.isFile()
    ) throw new Error("FEC_BULK_MANIFEST_FILE_CHANGED");
    return bytes;
  } catch (error) {
    if (error instanceof Error && /^FEC_BULK_MANIFEST_FILE_/.test(error.message)) throw error;
    throw new Error("FEC_BULK_MANIFEST_FILE_INVALID");
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

const placeholder = (value: string | null): boolean =>
  value !== null && /placeholder|operator[_ .-]?fill|example\.invalid/i.test(value);

export async function runBootstrapFecBulk(
  args: BootstrapFecBulkArgs,
  env: NodeJS.ProcessEnv,
  dependencies: BootstrapFecBulkDependencies = {},
): Promise<Record<string, unknown>> {
  const manifestBytes = (dependencies.readManifest ?? readFecBulkManifestFile)(args.manifest);
  const manifest = decodeFecBulkManifest(manifestBytes);
  if (
    manifest.entries.some((entry) =>
      placeholder(entry.finalUrl) || placeholder(entry.etag) || placeholder(entry.lastModified),
    )
  ) throw new Error("FEC_BULK_MANIFEST_PLACEHOLDER");
  if (env.NODE_ENV !== "production" && !env.RAW_OBJECT_ROOT && !dependencies.store)
    throw new Error("Nonproduction bootstrap requires explicit RAW_OBJECT_ROOT");

  const artifact = createFecBulkBootstrap(args.root, manifestBytes);
  const bytes = encodeFecBulkBootstrap(artifact);
  const artifactSha256 = fecBulkBootstrapSha256(bytes);
  const store = dependencies.store ?? createArtifactRawObjectStore(env);
  const receipt = await store.put({
    objectKey: args.outputKey,
    expectedSha256: artifactSha256,
    body: (async function* body() { yield bytes; })(),
  });
  if (
    receipt.objectKey !== args.outputKey ||
    receipt.sha256 !== artifactSha256 ||
    receipt.byteSize !== bytes.byteLength
  ) throw new Error("FEC_BULK_RECEIPT_INVALID");
  const replay = await store.read(receipt);
  if (!Buffer.from(replay).equals(Buffer.from(bytes)))
    throw new Error("FEC_BULK_RECEIPT_REPLAY_FAILED");

  return {
    receipt: {
      kind: receipt.storeKind,
      objectKey: receipt.objectKey,
      sha256: receipt.sha256,
      byteSize: receipt.byteSize,
      versionId: receipt.versionId ?? null,
      etag: receipt.etag ?? null,
    },
    artifactSha256,
    counts: {
      candidates: artifact.candidates.length,
      committees: artifact.committees.length,
      linkages: artifact.linkages.length,
      summaries: artifact.summaries.length,
    },
    coherence: {
      complete: artifact.coherence.complete,
      unsupportedLinkageRows: artifact.coherence.unsupportedLinkageRows,
      unresolvedPrincipalCommittees: artifact.coherence.unresolvedPrincipalCommittees.length,
      unresolvedLinkageCandidates: artifact.coherence.unresolvedLinkageCandidates.length,
      unresolvedLinkageCommittees: artifact.coherence.unresolvedLinkageCommittees.length,
      unresolvedSummaryCandidates: artifact.coherence.unresolvedSummaryCandidates.length,
    },
  };
}

export async function main(
  argv = process.argv.slice(2),
  env = process.env,
): Promise<void> {
  const result = await runBootstrapFecBulk(parseBootstrapFecBulkArgs(argv), env);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module)
  main().catch((error) => {
    const message = error instanceof Error && /^FEC_BULK_[A-Z_]+$/.test(error.message)
      ? error.message
      : "FEC_BULK_BOOTSTRAP_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
