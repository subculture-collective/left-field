import { describe, expect, it } from "vitest";
import {
  decodeFecV2RunDescriptor,
  encodeFecV2AcquisitionTranscript,
  encodeFecV2RunDescriptor,
  fecV2AcquisitionGraphSha256,
  fecV2AcquisitionTranscriptSha256,
  fecV2FailureSubjectSha256,
  fecV2RunDescriptorSha256,
  fecV2SnapshotId,
  fecV2TokenDigestSha256,
  type FecV2AcquisitionGraphProjection,
  type FecV2AcquisitionTranscriptV1,
} from "./run-descriptor";

const h = (character: string) => character.repeat(64);
const descriptor = { schemaVersion: 1 as const, originRunId: "run_a", originReleaseId: "release_a", acquisitionPlanSha256: h("a"), receiptCutoff: "2026-07-18" as const, artifactReceiptIds: ["receipt_a", "receipt_b"], sourceSnapshotId: "src_a", acquisitionOutcomes: [{ fileNumber: 12, entryIdentitySha256: h("b"), outcome: "source_unavailable" as const }], operationalFailures: [] as [], closureCandidates: [] as [] };

const graph = (): FecV2AcquisitionGraphProjection => ({
  snapshot: [{ planSha256: h("a"), id: "snap", sourceId: "src_fec", sourceUrl: "https://api.open.fec.gov/v1/filings/", publishedAt: null, retrievedAt: "2026-07-20T00:00:02.000Z", checksumSha256: h("b"), parserVersion: "fec-receipt-cutoff-v2", license: "public" }],
  snapshotMetadata: [{ snapshotId: "snap", planSha256: h("a"), originReleaseId: "release_a", receiptSetDigestSha256: h("b") }],
  artifacts: [
    { planSha256: h("a"), artifactSha256: h("4"), artifactKind: "enumeration_page", canonicalByteSize: BigInt(11), createdAt: "2026-07-20T00:00:00.000Z" },
    { planSha256: h("a"), artifactSha256: h("c"), artifactKind: "enumeration_page", canonicalByteSize: BigInt(10), createdAt: "2026-07-20T00:00:00.000Z" },
    { planSha256: h("a"), artifactSha256: h("d"), artifactKind: "filing_ledger", canonicalByteSize: BigInt(20), createdAt: "2026-07-20T00:00:01.000Z" },
    { planSha256: h("a"), artifactSha256: h("e"), artifactKind: "sanitized_filing", canonicalByteSize: BigInt(30), createdAt: "2026-07-20T00:00:02.000Z" },
  ],
  receipts: [
    { planSha256: h("a"), receiptId: "r1", artifactSha256: h("c"), artifactKind: "enumeration_page", canonicalByteSize: BigInt(10), upstreamEntitySha256: h("f"), objectKey: "fec/r1.json", versionId: "v1", etag: "e1", byteSize: BigInt(10), retrievedAt: "2026-07-20T00:00:00.000Z", snapshotId: "snap" },
    { planSha256: h("a"), receiptId: "r2", artifactSha256: h("4"), artifactKind: "enumeration_page", canonicalByteSize: BigInt(11), upstreamEntitySha256: h("3"), objectKey: "fec/r2.json", versionId: "v2", etag: "e2", byteSize: BigInt(11), retrievedAt: "2026-07-20T00:00:00.000Z", snapshotId: "snap" },
    { planSha256: h("a"), receiptId: "r3", artifactSha256: h("d"), artifactKind: "filing_ledger", canonicalByteSize: BigInt(20), upstreamEntitySha256: null, objectKey: "fec/r3.json", versionId: "v3", etag: "e3", byteSize: BigInt(20), retrievedAt: "2026-07-20T00:00:01.000Z", snapshotId: "snap" },
    { planSha256: h("a"), receiptId: "r4", artifactSha256: h("e"), artifactKind: "sanitized_filing", canonicalByteSize: BigInt(30), upstreamEntitySha256: h("1"), objectKey: "fec/r4.json", versionId: "v4", etag: "e4", byteSize: BigInt(30), retrievedAt: "2026-07-20T00:00:02.000Z", snapshotId: "snap" },
  ],
  enumerationPages: [
    { planSha256: h("a"), artifactSha256: h("4"), artifactKind: "enumeration_page", pass: 2, formType: "F3", receiptDate: "2026-07-18", requestedFileNumber: null, pageNumber: 1, terminal: false },
    { planSha256: h("a"), artifactSha256: h("c"), artifactKind: "enumeration_page", pass: 1, formType: "F3", receiptDate: "2026-07-18", requestedFileNumber: null, pageNumber: 1, terminal: false },
  ],
  ledgerHeader: [{ planSha256: h("a"), ledgerSha256: h("d"), artifactKind: "filing_ledger", stable: true }],
  ledgerEntries: [
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 1, entryIdentitySha256: h("2"), canonicalFormType: "F3", baseFormType: "F3", reportType: "Q1", reportDate: "2026-07-18", receiptDate: "2026-07-18", coverageStart: "2026-01-01", coverageEnd: "2026-06-30", amendmentIndicator: "N", filerId: "C12345678", committeeId: "C12345678", electronicStatus: "electronic", rawSourceAvailability: "available" },
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 2, entryIdentitySha256: h("8"), canonicalFormType: "F3", baseFormType: "F3", reportType: "Q1", reportDate: "2026-07-18", receiptDate: "2026-07-18", coverageStart: "2026-01-01", coverageEnd: "2026-06-30", amendmentIndicator: "A", filerId: "C12345678", committeeId: "C12345678", electronicStatus: "paper", rawSourceAvailability: "paper" },
  ],
  pageLineage: [
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 1, entryIdentitySha256: h("2"), pageSha256: h("c"), pass: 1, occurrenceIndex: 1 },
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 1, entryIdentitySha256: h("2"), pageSha256: h("4"), pass: 2, occurrenceIndex: 1 },
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 2, entryIdentitySha256: h("8"), pageSha256: h("c"), pass: 1, occurrenceIndex: 2 },
    { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 2, entryIdentitySha256: h("8"), pageSha256: h("4"), pass: 2, occurrenceIndex: 2 },
  ],
  amendmentLinks: [{ planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 2, entryIdentitySha256: h("8"), predecessorFileNumber: 1 }],
  sanitizedFilings: [{ planSha256: h("a"), artifactSha256: h("e"), artifactKind: "sanitized_filing", fileNumber: 1, ledgerSha256: h("d"), ledgerIdentitySha256: h("2"), reportDate: "2026-07-18" }],
  alternateScoping: [], acquisitionOutcomes: [{ planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 2, entryIdentitySha256: h("8"), outcome: "paper_filing_unreviewed" }], acquisitionReceiptIds: [{ receiptId: "r1" }, { receiptId: "r2" }, { receiptId: "r3" }, { receiptId: "r4" }],
});

const transcript: FecV2AcquisitionTranscriptV1 = { schemaVersion: 1, transcriptVersion: "fec-v2-acquisition-transcript-v1", receipts: [{ receiptId: "r1", artifactKind: "enumeration_page", artifactSha256: h("c"), replaySha256: h("c"), replayByteSize: "10", canonicalSchema: "fec-v2-enumeration-page-v1", canonicalDecodeVersion: "1", decodedEvidenceSha256: h("c") }] };

describe("FEC V2 canonical run commitments", () => {
  it("freezes descriptor bytes and hash", () => {
    expect(Buffer.from(encodeFecV2RunDescriptor(descriptor)).toString()).toBe('{"schemaVersion":1,"originRunId":"run_a","originReleaseId":"release_a","acquisitionPlanSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","receiptCutoff":"2026-07-18","artifactReceiptIds":["receipt_a","receipt_b"],"sourceSnapshotId":"src_a","acquisitionOutcomes":[{"fileNumber":12,"entryIdentitySha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","outcome":"source_unavailable"}],"operationalFailures":[],"closureCandidates":[]}\n');
    expect(fecV2RunDescriptorSha256(descriptor)).toBe("c990589a40d711c255dedcf3750323a0bb9041df115a83dc90797d96c351a2b0");
  });
  it("freezes snapshot identity", () => expect(fecV2SnapshotId("release_a", h("a"), "run_a")).toBe("fecv2snap_54bc5f73cd4a2f9922bd66ceab14039c"));
  it("freezes the complete graph hash", () => expect(fecV2AcquisitionGraphSha256(graph())).toBe("1d31941b019618e6a2a511a8c8dfd271316ec7b230fbac904695dc527c9514e3"));
  it("freezes transcript bytes and hash", () => {
    const expected = '{"schemaVersion":1,"transcriptVersion":"fec-v2-acquisition-transcript-v1","receipts":[{"receiptId":"r1","artifactKind":"enumeration_page","artifactSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","replaySha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","replayByteSize":"10","canonicalSchema":"fec-v2-enumeration-page-v1","canonicalDecodeVersion":"1","decodedEvidenceSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}]}\n';
    expect(Buffer.from(encodeFecV2AcquisitionTranscript(transcript)).toString()).toBe(expected);
    expect(fecV2AcquisitionTranscriptSha256(transcript)).toBe("b4b406e06a62a48ef2fc890daa8d1a8293bb737623870dda1778db3f49393b67");
  });
  it("accepts the mandatory ledger null upstream hash", () => expect(() => fecV2AcquisitionGraphSha256(graph())).not.toThrow());
  it("rejects snapshot digest mismatch", () => { const base = graph(); const value = { ...base, snapshotMetadata: [{ ...base.snapshotMetadata[0]!, receiptSetDigestSha256: h("9") }] }; expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("rejects missing or extra selected receipts", () => { const base = graph(); const value = { ...base, acquisitionReceiptIds: base.acquisitionReceiptIds.slice(0, -1) }; expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("rejects an entry with both sanitized data and an outcome", () => { const base = graph(); const value = { ...base, acquisitionOutcomes: [...base.acquisitionOutcomes, { planSha256: h("a"), ledgerSha256: h("d"), fileNumber: 1, entryIdentitySha256: h("2"), outcome: "malformed_filing" as const }] }; expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("allows unknown/available filings to be sanitized", () => { const base = graph(), ledgerEntries = [{ ...base.ledgerEntries[0]!, electronicStatus: "unknown" as const }, base.ledgerEntries[1]!]; expect(() => fecV2AcquisitionGraphSha256({ ...base, ledgerEntries })).not.toThrow(); });
  it("rejects impossible calendar dates and invalid enums", () => { const base = graph(); const value = { ...base, ledgerEntries: [{ ...base.ledgerEntries[0]!, receiptDate: "2026-02-30" }] }; expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("rejects a mixed-plan row in every graph family", () => { const base = graph(); const value = { ...base, amendmentLinks: [{ ...base.amendmentLinks[0]!, planSha256: h("9") }] }; expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("is invariant to input row order because natural ordering is canonical", () => { const base = graph(); const reversed = { ...base, artifacts: [...base.artifacts].reverse(), receipts: [...base.receipts].reverse(), enumerationPages: [...base.enumerationPages].reverse(), pageLineage: [...base.pageLineage].reverse(), acquisitionReceiptIds: [...base.acquisitionReceiptIds].reverse() }; expect(fecV2AcquisitionGraphSha256(reversed)).toBe(fecV2AcquisitionGraphSha256(base)); });
  it("rejects unknown fields and accessors", () => { const value = graph(); Object.defineProperty(value.snapshot[0]!, "sourceId", { enumerable: true, get: () => "src_fec" }); expect(() => fecV2AcquisitionGraphSha256(value)).toThrow("FEC_V2_GRAPH_INVALID"); });
  it("honors graph cancellation and deadlines", () => { const controller = new AbortController(); controller.abort(); expect(() => fecV2AcquisitionGraphSha256(graph(), { signal: controller.signal })).toThrow("FEC_V2_GRAPH_ABORTED"); expect(() => fecV2AcquisitionGraphSha256(graph(), { deadlineMs: 0 })).toThrow("FEC_V2_GRAPH_DEADLINE"); });
  it("requires canonical transcript tuple uniqueness", () => expect(() => encodeFecV2AcquisitionTranscript({ ...transcript, receipts: [transcript.receipts[0]!, transcript.receipts[0]!] })).toThrow("FEC_V2_TRANSCRIPT_INVALID"));
  it("rejects malformed descriptors and freezes decoded values", () => { expect(() => encodeFecV2RunDescriptor({ ...descriptor, artifactReceiptIds: ["receipt_b", "receipt_a"] })).toThrow(); const decoded = decodeFecV2RunDescriptor(encodeFecV2RunDescriptor(descriptor)); expect(Object.isFrozen(decoded.acquisitionOutcomes)).toBe(true); });
  it("freezes token and failure-subject vectors", () => { expect(fecV2TokenDigestSha256(new Uint8Array(32).fill(1))).toBe("fe9050baf6d110d474c28f47eed82d5b22373d243715ed8107c9731f8465b475"); expect(fecV2FailureSubjectSha256({ schemaVersion: 1, runId: "run_a", failureCode: "aborted", scopeSha256: h("b") })).toBe("e3b214745c0ccaf5e19c80b122cf52f8246376bfa1789ae1a7c3fbf8824c98b0"); for (const code of ["lease_expired", "enumeration_unstable", "store_failure", "connection_lost", "promotion_failed", "internal_failure"] as const) expect(() => fecV2FailureSubjectSha256({ schemaVersion: 1, runId: "run_a", failureCode: code, scopeSha256: h("b") })).not.toThrow(); for (const runId of ["", "-run", ".run", ":run", "run/1", "run space", "a".repeat(513)]) expect(() => fecV2FailureSubjectSha256({ schemaVersion: 1, runId, failureCode: "aborted", scopeSha256: h("b") })).toThrow("FEC_V2_FAILURE_SUBJECT_INVALID"); for (const code of ["invalid", "internal_error", "deadline_exceeded"]) expect(() => fecV2FailureSubjectSha256({ schemaVersion: 1, runId: "run_a", failureCode: code as never, scopeSha256: h("b") })).toThrow("FEC_V2_FAILURE_SUBJECT_INVALID"); expect(() => fecV2TokenDigestSha256(new Uint8Array(31))).toThrow("FEC_V2_TOKEN_INVALID"); });
  it("is clone-stable because destination release and mutable seal fields are not representable", () => { const value = graph() as unknown as Record<string, unknown>; expect(Object.prototype.hasOwnProperty.call(value, "releaseId")).toBe(false); expect(fecV2AcquisitionGraphSha256(graph())).toBe("1d31941b019618e6a2a511a8c8dfd271316ec7b230fbac904695dc527c9514e3"); });
});
