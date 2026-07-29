import { describe, expect, it } from "vitest";
import { canonicalFecV2ReceiptSet, fecV2ReceiptSetDigestSha256 } from "./snapshot-digest";

describe("FEC v2 receipt-set digest", () => {
  it("pins compact sorted UTC-millisecond bytes and hash", () => {
    const rows = [{ receiptId: "b", artifactKind: "filing_ledger", artifactSha256: "b".repeat(64), upstreamEntitySha256: null, objectKey: "fec/v2/a/filing_ledger/b.json", versionId: "v2", etag: "e2", byteSize: 2 as unknown as bigint, retrievedAt: new Date("2026-07-23T01:02:03.004Z") }, { receiptId: "a", artifactKind: "enumeration_page", artifactSha256: "a".repeat(64), upstreamEntitySha256: "c".repeat(64), objectKey: "fec/v2/a/enumeration_page/a.json", versionId: "v1", etag: "e1", byteSize: 1 as unknown as bigint, retrievedAt: new Date("2026-07-23T01:02:03.000Z") }];
    const bytes = canonicalFecV2ReceiptSet("d".repeat(64), "snap_1", rows);
    expect(bytes).toBe('{"schemaVersion":2,"acquisitionPlanSha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","snapshotId":"snap_1","receipts":[{"receiptId":"a","artifactKind":"enumeration_page","artifactSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","upstreamEntitySha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","objectKey":"fec/v2/a/enumeration_page/a.json","versionId":"v1","etag":"e1","byteSize":"1","retrievedAt":"2026-07-23T01:02:03.000Z"},{"receiptId":"b","artifactKind":"filing_ledger","artifactSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","upstreamEntitySha256":null,"objectKey":"fec/v2/a/filing_ledger/b.json","versionId":"v2","etag":"e2","byteSize":"2","retrievedAt":"2026-07-23T01:02:03.004Z"}]}\n');
    expect(fecV2ReceiptSetDigestSha256("d".repeat(64), "snap_1", rows)).toBe("0a4e713487ca5c0b72ea3e7136658374ebf969465429de130da053e93c447547");
  });
});
