import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";
import { encodeFecBulkManifest, type BulkManifest, type BulkKind } from "@/ingestion/fec/bulk-bootstrap";
import { parseBootstrapFecBulkArgs, readFecBulkManifestFile, runBootstrapFecBulk } from "./bootstrap-fec-bulk";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const crc32 = (bytes: Buffer) => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
};
const zip = (member: string, text: string): Buffer => {
  const name = Buffer.from(member);
  const body = Buffer.from(text);
  const crc = crc32(body);
  const local = Buffer.alloc(30);
  const central = Buffer.alloc(46);
  const end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(0x800, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(body.length, 24);
  central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(30 + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "fec-run-"));
  const definitions: readonly [BulkKind, string, string, string][] = [
    ["candidate_master", "cn26.zip", "cn.txt", ["P00000001", "private-name", "", "2024", "CA", "P", "01", "", "C", "C00000001", "", "", "", "", ""].join("|") + "\n"],
    ["committee_master", "cm26.zip", "cm.txt", ["C00000001", "private-name", "private-treasurer", "", "", "", "", "private-zip", "D", "H", "", "", "", "", ""].join("|") + "\n"],
    ["candidate_committee_linkage", "ccl26.zip", "ccl.txt", ["P00000001", "2024", "2026", "C00000001", "H", "D", "1"].join("|") + "\n"],
    ["candidate_summary", "weball26.zip", "weball26.txt", ["P00000001", "private-name", "", "", "", "1", "", "2", "", "", "3", ...Array(16).fill(""), "07/18/2026", "", ""].join("|") + "\n"],
  ];
  const archives = definitions.map(([, fileName, member, row]) => ({ fileName, bytes: zip(member, row) }));
  await Promise.all(archives.map(({ fileName, bytes }) => writeFile(join(root, fileName), bytes)));
  const manifest: BulkManifest = {
    version: 1,
    cycle: 2026,
    cutoff: "2026-07-18",
    publicationEligible: false,
    reviewStatus: "unreviewed",
    entries: definitions.map(([kind, fileName], index) => ({
      kind,
      fileName,
      officialUrl: `https://www.fec.gov/files/bulk-downloads/2026/${fileName}`,
      finalUrl: `https://www.fec.gov/files/bulk-downloads/2026/${fileName}`,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      byteSize: archives[index]!.bytes.length,
      sha256: hash(archives[index]!.bytes),
      etag: null,
      lastModified: null,
    })),
  };
  return { root, manifest };
}

describe("bootstrap FEC bulk CLI", () => {
  it("requires constrained complete arguments", () => {
    expect(() => parseBootstrapFecBulkArgs(["--root", "x", "--manifest", "m", "--output-key", "raw.zip"])).toThrow("Require --root");
    expect(parseBootstrapFecBulkArgs(["--root", "x", "--manifest", "m", "--output-key", "fec/bootstrap/2026/a.json"])).toMatchObject({ outputKey: "fec/bootstrap/2026/a.json" });
  });

  it("rejects manifest symlinks and oversized files", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-manifest-"));
    try {
      const file = join(root, "m.json");
      await writeFile(file, "{}");
      await symlink(file, join(root, "link.json"));
      expect(() => readFecBulkManifestFile(join(root, "link.json"))).toThrow("FEC_BULK_MANIFEST_FILE_INVALID");
      await writeFile(join(root, "large.json"), "x".repeat(65_537));
      expect(() => readFecBulkManifestFile(join(root, "large.json"))).toThrow("FEC_BULK_MANIFEST_FILE_INVALID");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("puts one sanitized artifact, hides locator, and rejects replay mismatch", async () => {
    const input = await fixture();
    try {
      let puts = 0;
      let stored = Buffer.alloc(0);
      let replayMismatch = false;
      let receiptMismatch = false;
      const store: RawObjectStore = {
        put: async (request) => {
          puts += 1;
          const chunks: Buffer[] = [];
          for await (const chunk of request.body) chunks.push(Buffer.from(chunk));
          stored = Buffer.concat(chunks);
          return { storeKind: "local", storeLocator: "/private/raw", objectKey: request.objectKey, sha256: receiptMismatch ? "0".repeat(64) : hash(stored), byteSize: stored.length };
        },
        read: async () => replayMismatch ? Buffer.from("mismatch") : stored,
      };
      const args = { root: input.root, manifest: "ignored", outputKey: "fec/bootstrap/2026/a.json" };
      const dependencies = { store, readManifest: () => Buffer.from(encodeFecBulkManifest(input.manifest)) };
      const result = await runBootstrapFecBulk(args, { NODE_ENV: "production" }, dependencies);
      expect(puts).toBe(1);
      expect(JSON.stringify(result)).not.toContain("/private/raw");
      expect(stored.toString()).not.toContain("private-");
      receiptMismatch = true;
      await expect(runBootstrapFecBulk(args, { NODE_ENV: "production" }, dependencies)).rejects.toThrow("FEC_BULK_RECEIPT_INVALID");
      receiptMismatch = false;
      replayMismatch = true;
      await expect(runBootstrapFecBulk(args, { NODE_ENV: "production" }, dependencies)).rejects.toThrow("FEC_BULK_RECEIPT_REPLAY_FAILED");
    } finally {
      await rm(input.root, { recursive: true, force: true });
    }
  });
});
