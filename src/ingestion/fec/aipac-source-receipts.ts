import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const sourceReceiptSchema = z.strictObject({
  id: z.string().min(1),
  cycleYear: z.number().int().refine((year) => year % 2 === 0),
  channel: z.enum(["aipac_pac_pas2", "udp_bulk_ie_reconciliation"]),
  sourceUrl: z.url().refine((url) => url.startsWith("https://www.fec.gov/files/bulk-downloads/")),
  filename: z.string().regex(/^[a-z0-9_]+(?:\.csv|\.zip)$/),
  byteSize: z.number().int().positive(),
  sha256,
  retrievedAt: z.iso.datetime({ offset: true }),
  matchedCommitteeRows: z.number().int().nonnegative(),
  primaryCodedRows: z.number().int().nonnegative().nullable(),
  uniqueFileNumbers: z.number().int().nonnegative().nullable(),
  coverageClaim: z.literal(false),
  closureGap: z.enum(["cutoff_filing_ledger_missing", "reconciliation_source_not_complete_authority"]),
});

export const aipacSourceReceiptPackageSchema = z.strictObject({
  packageVersion: z.literal("aipac-source-receipts-v1"),
  sourceCutoff: z.iso.date(),
  acquiredAt: z.iso.datetime({ offset: true }),
  sources: z.array(sourceReceiptSchema).length(6),
}).superRefine((value, ctx) => {
  const identities = new Set(value.sources.map((source) => `${source.channel}:${source.cycleYear}`));
  for (const cycle of [2022, 2024, 2026]) {
    for (const channel of ["aipac_pac_pas2", "udp_bulk_ie_reconciliation"]) {
      if (!identities.has(`${channel}:${cycle}`)) ctx.addIssue({ code: "custom", message: `Missing ${channel} receipt for ${cycle}` });
    }
  }
  if (identities.size !== value.sources.length) ctx.addIssue({ code: "custom", message: "Source receipt identities must be unique" });
});

export type AipacSourceReceiptPackage = Readonly<z.infer<typeof aipacSourceReceiptPackageSchema>>;

/** Verifies exact local source objects without opening ZIP contents or retaining raw rows. */
export async function verifyAipacSourceReceipts(root: string, rawPackage: unknown): Promise<AipacSourceReceiptPackage> {
  const sourcePackage = aipacSourceReceiptPackageSchema.parse(rawPackage);
  const realRoot = await realpath(root);
  const rootBefore = await stat(realRoot);
  if (!rootBefore.isDirectory()) throw new Error("FEC_AIPAC_RECEIPT_ROOT_INVALID");

  for (const receipt of sourcePackage.sources) {
    if (basename(receipt.filename) !== receipt.filename) throw new Error("FEC_AIPAC_RECEIPT_FILENAME_INVALID");
    const path = join(realRoot, receipt.filename);
    if (relative(realRoot, path) !== receipt.filename) throw new Error("FEC_AIPAC_RECEIPT_FILENAME_INVALID");
    const namedBefore = await lstat(path);
    if (!namedBefore.isFile() || namedBefore.isSymbolicLink()) throw new Error("FEC_AIPAC_RECEIPT_FILE_INVALID");
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const openedBefore = await handle.stat();
      if (!openedBefore.isFile() || openedBefore.dev !== namedBefore.dev || openedBefore.ino !== namedBefore.ino || openedBefore.size !== receipt.byteSize) throw new Error("FEC_AIPAC_RECEIPT_MISMATCH");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path, { fd: handle.fd, autoClose: false })) hash.update(chunk);
      const openedAfter = await handle.stat();
      const namedAfter = await lstat(path);
      const rootAfter = await stat(realRoot);
      if (openedAfter.dev !== openedBefore.dev || openedAfter.ino !== openedBefore.ino || openedAfter.size !== openedBefore.size || namedAfter.dev !== openedBefore.dev || namedAfter.ino !== openedBefore.ino || rootAfter.dev !== rootBefore.dev || rootAfter.ino !== rootBefore.ino || hash.digest("hex") !== receipt.sha256) throw new Error("FEC_AIPAC_RECEIPT_MISMATCH");
    } finally {
      await handle.close();
    }
  }
  return sourcePackage;
}
