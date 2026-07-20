import { describe, expect, it } from "vitest";
import { verifyPersistedTask8FecCandidate } from "./finalize-fec";

describe("FEC finalizer contract", () => {
  it("rejects finalization without the independently pinned source, snapshot, mapping, and scope", async () => {
    await expect(verifyPersistedTask8FecCandidate({ pool: {} as never, rawStore: {} as never, candidateReleaseId: "candidate", sourceReleaseId: "source", runIds: ["run"], sourceLockSha256: "bad", source: { id: "fec", name: "fec", authority: "official", homepageUrl: "https://api.open.fec.gov" }, snapshot: { id: "snapshot", sourceId: "fec", sourceUrl: "urn:fec", checksumSha256: "a".repeat(64), publishedAt: null, retrievedAt: "2024-01-01T00:00:00.000Z", parserVersion: "openfec-sanitized-v1", license: "restricted", usageStatus: "restricted" }, mappingSource: { id: "mapping-source", name: "mapping", authority: "official", homepageUrl: "https://example.test" }, mappingSnapshot: { id: "mapping", sourceId: "mapping-source", sourceUrl: "urn:mapping", checksumSha256: "b".repeat(64), publishedAt: null, retrievedAt: "2024-01-01T00:00:00.000Z", parserVersion: "openfec-sanitized-v1", license: "synthetic", usageStatus: "approved" }, mapping: { candidateId: "H00000001", electionCycle: 2024, candidacyId: "candidacy", seatCycleId: "seat", snapshotId: "mapping", committees: [] }, financeScope: { reportForm: "F3", reportType: "YE", coverageStartDate: "2024-01-01", coverageEndDate: "2024-12-31", asOf: "2024-12-31", cutoff: "2024-12-31" } })).rejects.toThrow("FEC_FINALIZE_IMMUTABLE_CONTRACT");
  });
});
