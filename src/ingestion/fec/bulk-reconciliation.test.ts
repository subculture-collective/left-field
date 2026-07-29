import { describe, expect, it, vi } from "vitest";
import { encodeFecBulkBootstrap, type FecBulkBootstrap } from "./bulk-bootstrap";
import { createFecBulkReconciliation, decodeFecBulkReconciliation, encodeFecBulkReconciliation, fecBulkReconciliationRequestSha256, type OpenFecReconciliationFetch } from "./bulk-reconciliation";

const hash = "a".repeat(64);
const receipt = (archive: string, member: string) => ({ archive, archiveOfficialUrl: `https://www.fec.gov/files/bulk-downloads/2026/${archive}`, archiveSha256: hash, archiveByteSize: 1, member, memberSha256: hash, memberByteSize: 1, memberRows: 1, projectedRows: 1, memberFieldCount: archive === "ccl26.zip" ? 7 : archive === "weball26.zip" ? 30 : 15, retrievedAt: "2026-07-18T00:00:00.000Z", finalUrl: `https://www.fec.gov/files/bulk-downloads/2026/${archive}`, etag: null, lastModified: null });
type Link = { linkageId: string; candidateId: string; candidateElectionYear: string; fecElectionYear: 2026; committeeId: string | null; committeeType: string | null; designation: string | null };
const bootstrap = (rows: Link[] = [{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: "C00000001", committeeType: null, designation: null }]): Uint8Array => {
  const linkages = [...rows].sort((a, b) => Buffer.compare(Buffer.from(a.linkageId), Buffer.from(b.linkageId)));
  const value: FecBulkBootstrap = { schemaVersion: 1, adapterVersion: "fec-bulk-bootstrap-v1", cycle: 2026, cutoff: "2026-07-18", acquisitionManifestSha256: hash, publicationEligible: false, reviewStatus: "unreviewed", sourceReceipts: [{ ...receipt("ccl26.zip", "ccl.txt"), memberRows: linkages.length, projectedRows: linkages.length }, receipt("cm26.zip", "cm.txt"), receipt("cn26.zip", "cn.txt"), receipt("weball26.zip", "weball26.txt")], candidates: [{ candidateId: "P00000502", candidateElectionYear: "2026", office: "H", officeState: "CA", officeDistrict: "01", status: "C", principalCommitteeId: null }], committees: [{ committeeId: "C00000502", committeeType: "H", designation: "P" }], linkages, summaries: [{ candidateId: "P00000502", totalReceipts: "1.00", totalDisbursements: "1.00", cashOnHandCloseOfPeriod: "1.00", coverageEndDate: "2026-07-18" }], coherence: { complete: false, unsupportedLinkageRows: 0, unresolvedPrincipalCommittees: [], unresolvedLinkageCandidates: linkages.map(x => ({ linkageId: x.linkageId, candidateId: x.candidateId })), unresolvedLinkageCommittees: linkages.filter(x => x.committeeId).map(x => ({ linkageId: x.linkageId, committeeId: x.committeeId! })), unresolvedSummaryCandidates: [] }, limitations: ["Local hashes do not prove official origin or cutoff eligibility.", "Bulk summaries are reconciliation hints, not filing or amendment closure.", "Signed review is required before publication or downstream use."] };
  return encodeFecBulkBootstrap(value);
};
const response = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const page = (results: unknown[], per_page = 20) => ({ results, pagination: { count: results.length, pages: results.length ? 1 : 0, per_page, is_count_exact: true }, secret_name: "ROOT CANARY" });
const options = (fetcher: OpenFecReconciliationFetch) => ({ apiKey: "key", retrievedAt: "2026-07-18T00:00:00.000Z", fetcher });

describe("FEC bulk reconciliation", () => {
  it("looks up projected candidate and committee data with pinned credential-free requests", async () => {
    const calls: RequestInit[] = [];
    const artifact = await createFecBulkReconciliation(bootstrap(), options(async (url, init) => {
      calls.push(init); const path = new URL(url as string | URL).pathname;
      return path.includes("candidate") ? response(page([{ candidate_id: "P00000001", cycles: [2026], office: "H", candidate_name: "PII" }])) : response(page([{ committee_id: "C00000001", cycles: [2024], committee_type: "Q", designation: "P", treasurer_name: "PII" }]));
    }));
    expect(artifact.candidates[0]).toEqual({ candidateId: "P00000001", status: "cycle_aligned", office: "H" });
    expect(artifact.committees[0]).toEqual({ committeeId: "C00000001", status: "cycle_mismatch", committeeType: "Q", designation: "P" });
    expect(artifact.receipts.map(x => x.perPage)).toEqual([20, 20]);
    expect(artifact.receipts.map(x => x.kind)).toEqual(["candidate", "committee"]);
    expect(calls.every(x => x.method === "GET" && x.redirect === "error" && x.cache === "no-store" && (x.headers as Record<string, string>)["X-Api-Key"] === "key")).toBe(true);
    expect(encodeFecBulkReconciliation(decodeFecBulkReconciliation(encodeFecBulkReconciliation(artifact)))).toEqual(encodeFecBulkReconciliation(artifact));
    expect(JSON.stringify(artifact)).not.toMatch(/PII|secret_name|candidate_name|treasurer/i);
  });

  it("rejects malformed classifications, cycles, ID mismatches, and invalid pagination", async () => {
    for (const row of [{ candidate_id: "P00000001", cycles: [2026], office: [] }, { candidate_id: "P00000001", cycles: [2025] }, { candidate_id: "P00000001", cycles: [2026, 2026] }, { candidate_id: "P00000002", cycles: [2026] }])
      await expect(createFecBulkReconciliation(bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]), options(async () => response(page([row]))))).rejects.toThrow(row.candidate_id === "P00000002" ? "FEC_RECONCILIATION_ID_MISMATCH" : "FEC_RECONCILIATION_RESPONSE_INVALID");
    await expect(createFecBulkReconciliation(bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]), options(async () => response({ results: [], pagination: { count: 0, pages: 0, per_page: "1", is_count_exact: true } })))).rejects.toThrow("FEC_RECONCILIATION_PAGINATION_INVALID");
  });

  it("handles valid empty results, deduplicates references, and rejects the cap before fetch", async () => {
    const one = bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }, { linkageId: "2", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]);
    const fetcher = vi.fn(async () => response(page([])));
    await expect(createFecBulkReconciliation(one, options(fetcher))).resolves.toMatchObject({ candidates: [{ status: "not_returned" }] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const rows = Array.from({ length: 501 }, (_, i) => ({ linkageId: String(i + 1), candidateId: `P${(i + 1).toString(36).padStart(8, "0").toUpperCase()}`, candidateElectionYear: "2026", fecElectionYear: 2026 as const, committeeId: null, committeeType: null, designation: null }));
    await expect(createFecBulkReconciliation(bootstrap(rows), options(fetcher))).rejects.toThrow("FEC_RECONCILIATION_ID_LIMIT_EXCEEDED");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries transient HTTP failures exactly once, cancels their bodies, and does not retry 403", async () => {
    let cancelled = 0; const bad = new Response(new ReadableStream({ cancel() { cancelled += 1; } }), { status: 500 });
    const retry = vi.fn(async () => retry.mock.calls.length === 1 ? bad : response(page([])));
    await createFecBulkReconciliation(bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]), options(retry));
    expect(retry).toHaveBeenCalledTimes(2); expect(cancelled).toBe(1);
    const forbidden = vi.fn(async () => response({}, 403));
    await expect(createFecBulkReconciliation(bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]), options(forbidden))).rejects.toThrow("FEC_RECONCILIATION_HTTP_ERROR");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it("bounds ignored fetches and body reads per attempt, global sleeps, and caller aborts", async () => {
    vi.useFakeTimers();
    const input = bootstrap([{ linkageId: "1", candidateId: "P00000001", candidateElectionYear: "2026", fecElectionYear: 2026, committeeId: null, committeeType: null, designation: null }]);
    try {
      const hanging = vi.fn(() => new Promise<Response>(() => {}));
      const finite = createFecBulkReconciliation(input, options(hanging));
      const finiteExpected = expect(finite).rejects.toThrow("FEC_RECONCILIATION_FETCH_FAILED");
      await vi.advanceTimersByTimeAsync(30_500);
      await finiteExpected; expect(hanging).toHaveBeenCalledTimes(2);
      let cancelled = 0;
      const bodyHang = vi.fn(async () => new Response(new ReadableStream({ pull: () => new Promise<void>(() => {}), cancel: () => { cancelled += 1; } })));
      const bodyFinite = createFecBulkReconciliation(input, options(bodyHang));
      const bodyExpected = expect(bodyFinite).rejects.toThrow("FEC_RECONCILIATION_ATTEMPT_TIMEOUT");
      await vi.advanceTimersByTimeAsync(30_500);
      await bodyExpected; expect(cancelled).toBeGreaterThan(0);
      const global = createFecBulkReconciliation(input, { ...options(async () => response({}, 500)), sleep: () => new Promise<void>(() => {}) });
      const globalExpected = expect(global).rejects.toThrow("FEC_RECONCILIATION_GLOBAL_LIMIT_EXCEEDED");
      await vi.advanceTimersByTimeAsync(300_000);
      await globalExpected;
      const controller = new AbortController(); const aborted = createFecBulkReconciliation(input, { ...options(hanging), signal: controller.signal }); controller.abort();
      await expect(aborted).rejects.toThrow("FEC_RECONCILIATION_ABORTED");
    } finally { vi.useRealTimers(); }
  });

  it("rejects noncanonical, forged, private, coerced, and oversized artifacts", async () => {
    const artifact = await createFecBulkReconciliation(bootstrap(), options(async url =>
      new URL(url as string | URL).pathname.includes("candidate")
        ? response(page([{ candidate_id: "P00000001", cycles: [2026] }]))
        : response(page([{ committee_id: "C00000001", cycles: [2026] }])),
    ));
    const bytes = encodeFecBulkReconciliation(artifact), parsed = JSON.parse(Buffer.from(bytes).toString());
    const rootReordered = { cycle: parsed.cycle, ...parsed }; const nestedReordered = { ...parsed, candidates: [{ status: parsed.candidates[0].status, candidateId: parsed.candidates[0].candidateId, office: parsed.candidates[0].office }] };
    for (const value of [rootReordered, nestedReordered, { ...parsed, candidates: [] }, { ...parsed, receipts: [{ ...parsed.receipts[0], requestSha256: "b".repeat(64) }] }, { ...parsed, pii_name: "no" }]) expect(() => decodeFecBulkReconciliation(Buffer.from(JSON.stringify(value)))).toThrow();
    expect(() => decodeFecBulkReconciliation(new Uint8Array(1024 * 1024 + 1))).toThrow("FEC_RECONCILIATION_INPUT_TOO_LARGE");
    expect(fecBulkReconciliationRequestSha256("/v1/candidate/P00000001/")).not.toEqual(fecBulkReconciliationRequestSha256("/v1/candidate/P00000002/"));
  });

  it("rejects forged receipt, status, and projected metadata contradictions", async () => {
    const artifact = await createFecBulkReconciliation(bootstrap(), options(async url =>
      new URL(url as string | URL).pathname.includes("candidate")
        ? response(page([{ candidate_id: "P00000001", cycles: [2026], office: "H" }]))
        : response(page([{ committee_id: "C00000001", cycles: [2026], committee_type: "Q", designation: "P" }])),
    ));
    const parsed = JSON.parse(Buffer.from(encodeFecBulkReconciliation(artifact)).toString());
    const candidate = structuredClone(parsed); candidate.candidates[0].status = "not_returned";
    const committee = structuredClone(parsed); committee.committees[0].status = "not_returned";
    const zeroBytes = structuredClone(parsed); zeroBytes.receipts[0].responseByteSize = 0;
    const missingCandidateMetadata = structuredClone(parsed); missingCandidateMetadata.receipts[0].resultCount = 0; missingCandidateMetadata.receipts[0].reportedCount = 0; missingCandidateMetadata.receipts[0].reportedPages = 0;
    for (const value of [candidate, committee, zeroBytes, missingCandidateMetadata]) expect(() => decodeFecBulkReconciliation(Buffer.from(JSON.stringify(value)))).toThrow("FEC_RECONCILIATION_INVALID");
  });
});
