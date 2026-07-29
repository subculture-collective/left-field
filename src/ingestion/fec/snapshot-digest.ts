import { createHash } from "node:crypto";

export type FecV2ReceiptDigestRow = Readonly<{
  receiptId: string; artifactKind: string; artifactSha256: string;
  upstreamEntitySha256: string | null; objectKey: string; versionId: string;
  etag: string; byteSize: bigint; retrievedAt: Date;
}>;

/** Canonical bytes used by seal_fec_v2_snapshot: compact JSON, C-order receipt IDs, LF. */
export function canonicalFecV2ReceiptSet(releasePlanSha256: string, snapshotId: string, receipts: readonly FecV2ReceiptDigestRow[]): string {
  const canonical = [...receipts].sort((a, b) => Buffer.from(a.receiptId).compare(Buffer.from(b.receiptId))).map((receipt) => ({
    receiptId: receipt.receiptId, artifactKind: receipt.artifactKind, artifactSha256: receipt.artifactSha256,
    upstreamEntitySha256: receipt.upstreamEntitySha256, objectKey: receipt.objectKey, versionId: receipt.versionId,
    etag: receipt.etag, byteSize: receipt.byteSize.toString(), retrievedAt: receipt.retrievedAt.toISOString(),
  }));
  return `${JSON.stringify({ schemaVersion: 2, acquisitionPlanSha256: releasePlanSha256, snapshotId, receipts: canonical })}\n`;
}

export function fecV2ReceiptSetDigestSha256(planSha256: string, snapshotId: string, receipts: readonly FecV2ReceiptDigestRow[]): string {
  return createHash("sha256").update(canonicalFecV2ReceiptSet(planSha256, snapshotId, receipts), "utf8").digest("hex");
}
