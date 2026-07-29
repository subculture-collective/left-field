import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RawObjectResult, RawObjectStore } from "@/ingestion/core/raw-object-store";
import { encodeFecBulkReconciliation, fecBulkReconciliationRequestSha256 } from "@/ingestion/fec/bulk-reconciliation";
import { parseReconcileFecBulkArgs, readFecBulkBootstrapFile, runReconcileFecBulk, sameFecBulkBootstrapFileMetadata } from "./reconcile-fec-bulk";

const artifact = () => ({ schemaVersion: 1 as const, cycle: 2026 as const, cutoff: "2026-07-18" as const, retrievedAt: "2026-07-18T00:00:00.000Z", bulkBootstrapSha256: "a".repeat(64), publicationEligible: false as const, reviewStatus: "unreviewed" as const, limitations: ["Current or nightly OpenFEC API metadata is reconciliation evidence only and does not prove the bulk cutoff or publication eligibility."], candidates: [{ candidateId: "P00000001", status: "cycle_aligned" as const, office: "H" as const }], committees: [], receipts: [{ kind: "candidate" as const, id: "P00000001", path: "/v1/candidate/P00000001/", requestSha256: fecBulkReconciliationRequestSha256("/v1/candidate/P00000001/"), responseSha256: "b".repeat(64), responseByteSize: 1, reportedCount: 1, reportedPages: 1, countExact: true, resultCount: 1, perPage: 20 }] });
const args = { inputFile: "fixture.json", outputKey: "fec/reconciliation/2026/run.json", retrievedAt: "2026-07-18T00:00:00.000Z" };

describe("reconcile FEC bulk CLI", () => {
  it("accepts only the reconciliation output namespace", () => {
    expect(parseReconcileFecBulkArgs(["--input-file", "in.json", "--output-key", "fec/reconciliation/2026/check.json", "--retrieved-at", "2026-01-01T00:00:00.000Z"])).toMatchObject({ outputKey: "fec/reconciliation/2026/check.json" });
    expect(() => parseReconcileFecBulkArgs(["--input-file", "in", "--output-key", "bad", "--retrieved-at", "nope"])).toThrow("FEC_RECONCILIATION_ARGS_INVALID");
  });
  it("does not follow bootstrap input symlinks", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-reconcile-"));
    try { const target = join(root, "target.json"); const link = join(root, "input.json"); await writeFile(target, "{}"); await symlink(target, link); expect(() => readFecBulkBootstrapFile(link)).toThrow("FEC_RECONCILIATION_INPUT_FILE_INVALID"); } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects oversized bootstrap files before reconciliation", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-reconcile-"));
    try { const input = join(root, "large.json"); await writeFile(input, Buffer.alloc(32 * 1024 * 1024 + 1)); expect(() => readFecBulkBootstrapFile(input)).toThrow("FEC_RECONCILIATION_INPUT_FILE_INVALID"); } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("detects same-inode, same-size mutation metadata changes", () => {
    const before = { dev: BigInt(1), ino: BigInt(2), size: BigInt(3), ctimeNs: BigInt(4), mtimeNs: BigInt(5), isFile: true };
    expect(sameFecBulkBootstrapFileMetadata(before, { ...before, mtimeNs: BigInt(6) })).toBe(false);
    expect(sameFecBulkBootstrapFileMetadata(before, before)).toBe(true);
  });

  it("writes and replays a sanitized local-shaped reconciliation artifact", async () => {
    let stored = Buffer.alloc(0); let put: RawObjectResult | undefined;
    const store: RawObjectStore = {
      put: async input => { stored = Buffer.concat(await (async () => { const chunks: Buffer[] = []; for await (const part of input.body) chunks.push(Buffer.from(part)); return chunks; })()); put = { storeKind: "local", storeLocator: "/raw", objectKey: input.objectKey, sha256: input.expectedSha256!, byteSize: stored.length }; return put; },
      read: async value => { expect(value).toEqual(put); return stored; },
    };
    const result = await runReconcileFecBulk(args, { NODE_ENV: "production", FEC_API_CREDENTIAL: "secret" }, { readInput: () => Buffer.from("canonical bootstrap"), store, reconcile: async () => artifact() });
    expect(put).toMatchObject({ objectKey: args.outputKey, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(result).toMatchObject({ counts: { candidates: 1, committees: 0, receipts: 1 }, statuses: { cycleAligned: 1 } });
    expect(JSON.stringify(result)).not.toContain("secret"); expect(stored.toString()).not.toMatch(/name|address|email|treasurer/i);
    expect(stored).toEqual(encodeFecBulkReconciliation(artifact()));
  });

  it("accepts S3 content-addressed receipts and rejects bad receipt/replay data", async () => {
    const bytes = encodeFecBulkReconciliation(artifact()); const hash = createHash("sha256").update(bytes).digest("hex");
    const good: RawObjectStore = { put: async () => ({ storeKind: "s3", storeLocator: "bucket", objectKey: `${args.outputKey}.${hash}`, sha256: hash, byteSize: bytes.length, versionId: "v1", etag: "etag" }), read: async () => bytes };
    await expect(runReconcileFecBulk(args, { NODE_ENV: "production" }, { readInput: () => Buffer.from("x"), store: good, reconcile: async () => artifact() })).resolves.toMatchObject({ receipt: { kind: "s3", versionId: "v1" } });
    for (const wrong of [{ objectKey: "wrong" }, { sha256: "0".repeat(64) }, { byteSize: bytes.length + 1 }]) {
      const bad: RawObjectStore = { put: async () => ({ storeKind: "local", storeLocator: "x", objectKey: args.outputKey, sha256: hash, byteSize: bytes.length, ...wrong }), read: async () => bytes };
      await expect(runReconcileFecBulk(args, { NODE_ENV: "production" }, { readInput: () => Buffer.from("x"), store: bad, reconcile: async () => artifact() })).rejects.toThrow("FEC_RECONCILIATION_RECEIPT_INVALID");
    }
    const replay: RawObjectStore = { ...good, read: async () => Buffer.from("wrong") };
    await expect(runReconcileFecBulk(args, { NODE_ENV: "production" }, { readInput: () => Buffer.from("x"), store: replay, reconcile: async () => artifact() })).rejects.toThrow("FEC_RECONCILIATION_RECEIPT_REPLAY_FAILED");
  });

  it("rejects credential conflicts before reconciliation or storage without leaking secrets", async () => {
    const store = { put: vi.fn(), read: vi.fn() } as unknown as RawObjectStore;
    const error = await runReconcileFecBulk(args, { NODE_ENV: "production", FEC_API_CREDENTIAL: "secret-one", FEC_API_KEY: "secret-two" }, { readInput: () => Buffer.from("x"), store }).catch(x => x as Error);
    expect(error.message).toBe("FEC_API_CREDENTIAL_CONFLICT"); expect(error.message).not.toMatch(/secret/); expect(store.put).not.toHaveBeenCalled();
  });
});
