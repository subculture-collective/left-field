import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, type BigIntStats } from "node:fs";
import { MAX_FEC_BULK_BOOTSTRAP_BYTES } from "@/ingestion/fec/bulk-bootstrap";
import { createFecBulkReconciliationFromEnv, encodeFecBulkReconciliation, fecBulkReconciliationSha256 } from "@/ingestion/fec/bulk-reconciliation";
import { createArtifactRawObjectStore } from "./ingestion-config";

export type ReconcileFecBulkArgs = Readonly<{ inputFile: string; outputKey: string; retrievedAt: string }>;
export type FecBulkBootstrapFileMetadata = Readonly<{ dev: bigint; ino: bigint; size: bigint; ctimeNs: bigint; mtimeNs: bigint; isFile: boolean }>;
export const sameFecBulkBootstrapFileMetadata = (left: FecBulkBootstrapFileMetadata, right: FecBulkBootstrapFileMetadata): boolean =>
  left.isFile && right.isFile && left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs;
const fileMetadata = (value: BigIntStats): FecBulkBootstrapFileMetadata => ({ dev: value.dev, ino: value.ino, size: value.size, ctimeNs: value.ctimeNs, mtimeNs: value.mtimeNs, isFile: value.isFile() });
export function parseReconcileFecBulkArgs(argv: readonly string[]): ReconcileFecBulkArgs {
  const values = new Map<string, string>(), known = new Set(["--input-file", "--output-key", "--retrieved-at"]);
  for (let i = 0; i < argv.length; i += 2) { const key = argv[i], value = argv[i + 1]; if (!key || !value || !known.has(key) || value.startsWith("--") || values.has(key)) throw new Error("FEC_RECONCILIATION_ARGS_INVALID"); values.set(key, value); }
  const inputFile = values.get("--input-file"), outputKey = values.get("--output-key"), retrievedAt = values.get("--retrieved-at");
  const parsed = retrievedAt ? new Date(retrievedAt) : new Date(NaN);
  if (!inputFile || !outputKey || !retrievedAt || !/^fec\/reconciliation\/2026\/[a-z0-9][a-z0-9._-]{0,180}\.json$/.test(outputKey) || !Number.isFinite(parsed.getTime()) || parsed.toISOString() !== retrievedAt) throw new Error("FEC_RECONCILIATION_ARGS_INVALID");
  return { inputFile, outputKey, retrievedAt };
}
/** Reads a canonical bootstrap without following a swapped symlink or a changing file. */
export function readFecBulkBootstrapFile(path: string): Buffer {
  let descriptor = -1;
  try {
    const namedBefore = fileMetadata(lstatSync(path, { bigint: true }));
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedBefore = fileMetadata(fstatSync(descriptor, { bigint: true }));
    if (!sameFecBulkBootstrapFileMetadata(namedBefore, openedBefore) || openedBefore.size < BigInt(1) || openedBefore.size > BigInt(MAX_FEC_BULK_BOOTSTRAP_BYTES)) throw new Error("FEC_RECONCILIATION_INPUT_FILE_INVALID");
    const bytes = Buffer.alloc(Number(openedBefore.size));
    for (let offset = 0; offset < bytes.length;) { const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error("FEC_RECONCILIATION_INPUT_FILE_CHANGED"); offset += count; }
    const openedAfter = fileMetadata(fstatSync(descriptor, { bigint: true })); const namedAfter = fileMetadata(lstatSync(path, { bigint: true }));
    if (!sameFecBulkBootstrapFileMetadata(openedBefore, openedAfter) || !sameFecBulkBootstrapFileMetadata(openedBefore, namedAfter)) throw new Error("FEC_RECONCILIATION_INPUT_FILE_CHANGED");
    return bytes;
  } catch (error) {
    if (error instanceof Error && /^FEC_RECONCILIATION_INPUT_FILE_/.test(error.message)) throw error;
    throw new Error("FEC_RECONCILIATION_INPUT_FILE_INVALID");
  } finally { if (descriptor >= 0) closeSync(descriptor); }
}
export async function runReconcileFecBulk(args: ReconcileFecBulkArgs, env: NodeJS.ProcessEnv, dependencies: { store?: RawObjectStore; readInput?: (path: string) => Buffer; reconcile?: typeof createFecBulkReconciliationFromEnv } = {}): Promise<Record<string, unknown>> {
  if (env.NODE_ENV !== "production" && !env.RAW_OBJECT_ROOT && !dependencies.store) throw new Error("FEC_RECONCILIATION_RAW_OBJECT_ROOT_REQUIRED");
  const input = (dependencies.readInput ?? readFecBulkBootstrapFile)(args.inputFile);
  const artifact = await (dependencies.reconcile ?? createFecBulkReconciliationFromEnv)(input, { retrievedAt: args.retrievedAt }, env), bytes = encodeFecBulkReconciliation(artifact), hash = fecBulkReconciliationSha256(bytes), store = dependencies.store ?? createArtifactRawObjectStore(env);
  const receipt = await store.put({ objectKey: args.outputKey, expectedSha256: hash, body: (async function* () { yield bytes; })() });
  const expectedKey = receipt.storeKind === "s3" ? `${args.outputKey}.${hash}` : args.outputKey;
  if (receipt.objectKey !== expectedKey || receipt.sha256 !== hash || receipt.byteSize !== bytes.byteLength) throw new Error("FEC_RECONCILIATION_RECEIPT_INVALID");
  if (!Buffer.from(await store.read(receipt)).equals(Buffer.from(bytes))) throw new Error("FEC_RECONCILIATION_RECEIPT_REPLAY_FAILED");
  return { receipt: { kind: receipt.storeKind, objectKey: receipt.objectKey, sha256: receipt.sha256, byteSize: receipt.byteSize, versionId: receipt.versionId ?? null, etag: receipt.etag ?? null }, artifactSha256: hash, counts: { candidates: artifact.candidates.length, committees: artifact.committees.length, receipts: artifact.receipts.length }, statuses: { cycleAligned: [...artifact.candidates, ...artifact.committees].filter(x => x.status === "cycle_aligned").length, cycleMismatch: [...artifact.candidates, ...artifact.committees].filter(x => x.status === "cycle_mismatch").length, notReturned: [...artifact.candidates, ...artifact.committees].filter(x => x.status === "not_returned").length } };
}
export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> { process.stdout.write(`${JSON.stringify(await runReconcileFecBulk(parseReconcileFecBulkArgs(argv), env))}\n`); }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error && /^FEC_[A-Z_]+$/.test(error.message) ? error.message : "FEC_RECONCILIATION_FAILED"}\n`); process.exitCode = 1; });
