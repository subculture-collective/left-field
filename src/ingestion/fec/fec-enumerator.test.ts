import { describe, expect, it } from "vitest";
import { encodeFecAcquisitionPlan, fecAcquisitionPlanSha256, fecTargetUniverseSha256, type FecAcquisitionPlanV2 } from "./acquisition-plan";
import { FecV2RunBudget } from "./fetch-client-v2";
import { enumerateFecPartitions, enumerateNationwideFecFilings } from "./fec-enumerator";
import { fecFilingIdentitySha256, fecPassMultiplicityDigestSha256, type FecFilingIdentityV1 } from "./filing-ledger";

const ids = Array.from({ length: 541 }, (_, i) => `seat_test_${String(i).padStart(3, "0")}`);
const plan = (): FecAcquisitionPlanV2 => ({ schemaVersion: 2, adapterVersion: "fec-receipt-cutoff-v2", releaseId: "rel_enumerator", receiptCutoff: "2026-07-18", campaignCycle: 2026, sourceLockSha256: "a".repeat(64), enumerationLowerBound: "2025-01-01", targetUniverseSha256: fecTargetUniverseSha256(ids), forms: ["F24", "F3", "F3X", "F5"], enumeration: { granularity: "day", serverOrderBy: "receipt_date", clientCanonicalOrderBy: "file_number", completePasses: 2 }, targets: ids.map(seatCycleId => ({ kind: "candidate_resolution_required", seatCycleId })) });
const options = (fetch: (url: URL) => Promise<Response>) => { const value = plan(); return { plan: value, planSha256: fecAcquisitionPlanSha256(encodeFecAcquisitionPlan(value)), apiKey: "key", budget: new FecV2RunBudget({ signal: new AbortController().signal }), dependencies: { fetch }, sinkPage: () => undefined }; };
const empty = async (url: URL) => { const response = new Response(JSON.stringify({ results: [] }), { headers: { "content-type": "application/json" } }); Object.defineProperty(response, "url", { value: url.toString() }); return response; };
const raw = (file: number, chain: number[], receiptDate = "2025-01-01", fecUrl: string | null = null) => ({ file_number: file, previous_file_number: chain.length === 1 ? file : chain.at(-2), receipt_date: receiptDate, form_type: "F24", amendment_indicator: "N", report_type: "M12", amendment_chain: chain, means_filed: "e-file", committee_id: "C00000001", fec_url: fecUrl });
const reply = async (url: URL, results: unknown[]) => { const response = new Response(JSON.stringify({ results }), { headers: { "content-type": "application/json" } }); Object.defineProperty(response, "url", { value: url.toString() }); return response; };
const isPrimary = (url: URL) => url.searchParams.get("form_type") === "F24" && url.searchParams.get("min_receipt_date") === "2025-01-01" && url.searchParams.get("page") === "1";

describe("FEC enumerator", () => {
  it("derives the pinned 2,256 partitions", () => { const ps = enumerateFecPartitions({ plan: plan() }); expect(ps).toHaveLength(2256); expect(ps[0]).toMatchObject({ formType: "F24", receiptDate: "2025-01-01" }); });
  it("rejects a wrong plan commitment before networking", async () => { let calls = 0; const input = options(async url => { calls++; return empty(url); }); await expect(enumerateNationwideFecFilings({ ...input, planSha256: "d".repeat(64) })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_INVALID" }); expect(calls).toBe(0); });
  it("uses dependency fetch and sinks each terminal artifact incrementally", async () => { const seen: string[] = [], input = options(empty); const got = await enumerateNationwideFecFilings({ ...input, sinkPage: artifact => { seen.push(artifact.artifactSha256); } }); expect(seen).toHaveLength(4512); expect(got.pageRefs).toHaveLength(4512); expect(got.counts).toMatchObject({ partitions: 2256, entries: 0 }); });
  it("isolates sink mutations from canonical refs and ledger", async () => { const clean = await enumerateNationwideFecFilings(options(empty)); const dirty = await enumerateNationwideFecFilings({ ...options(empty), sinkPage: a => { a.bytes[0] = 0; (a.page.records as unknown as unknown[]).push({}); (a.lineage as unknown as unknown[]).push({}); (a.upstreamReceipt as { upstreamBodySha256: string }).upstreamBodySha256 = "x"; } }); expect(dirty.ledgerSha256).toBe(clean.ledgerSha256); expect(dirty.pageRefs).toEqual(clean.pageRefs); });
  it("normalizes a throwing sink", async () => await expect(enumerateNationwideFecFilings({ ...options(empty), sinkPage: () => { throw new Error("sink"); } })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_INVALID" }));
  it("returns aborted when the sink aborts its run", async () => { const c = new AbortController(), input = options(empty); input.budget = new FecV2RunBudget({ signal: c.signal }); await expect(enumerateNationwideFecFilings({ ...input, sinkPage: () => c.abort() })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_ABORTED" }); });
  it("returns finite aborted for a never-settling sink", async () => { const c = new AbortController(), input = options(empty); input.budget = new FecV2RunBudget({ signal: c.signal }); const pending = enumerateNationwideFecFilings({ ...input, sinkPage: () => new Promise<void>(() => undefined) }); setTimeout(() => c.abort(), 0); await expect(pending).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_ABORTED" }); });
  it("rejects malformed plan schema before networking", async () => { let calls = 0; const input = options(async u => { calls++; return empty(u); }); await expect(enumerateNationwideFecFilings({ ...input, plan: { ...input.plan, forms: ["F3"] } })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_INVALID" }); expect(calls).toBe(0); });
  it("rejects an aborted run before networking", async () => { const c = new AbortController(); c.abort(); const input = options(empty); input.budget = new FecV2RunBudget({ signal: c.signal, deadline: Date.now() + 1000 }); await expect(enumerateNationwideFecFilings(input)).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_ABORTED" }); });
  it("maps admission deadline before networking", async () => { let calls = 0; const input = options(async u => { calls++; return empty(u); }); input.budget = new FecV2RunBudget({ signal: new AbortController().signal, deadline: Date.now() + 1000 }); await expect(enumerateNationwideFecFilings(input)).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_DEADLINE" }); expect(calls).toBe(0); });
  it("maps daily transport aborts", async () => { const input = options(async () => { throw new (await import("./fetch-client-v2")).FecV2TransportError("FEC_V2_ABORTED"); }); await expect(enumerateNationwideFecFilings(input)).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_ABORTED" }); });
  it("maps daily transport timeouts", async () => { const input = options(async () => { throw new (await import("./fetch-client-v2")).FecV2TransportError("FEC_V2_TIMEOUT"); }); await expect(enumerateNationwideFecFilings(input)).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_DEADLINE" }); });
  it("maps ordinary daily transport failures", async () => { const input = options(async () => { throw new Error("network"); }); await expect(enumerateNationwideFecFilings(input)).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_INVALID" }); });
  it("does not call the sink when plan validation fails", async () => { let sink = 0; const input = options(empty); await expect(enumerateNationwideFecFilings({ ...input, planSha256: "0".repeat(64), sinkPage: () => { sink++; } })).rejects.toBeDefined(); expect(sink).toBe(0); });
  it("keeps terminal artifacts empty and canonical", async () => { let terminal = 0; await enumerateNationwideFecFilings({ ...options(empty), sinkPage: a => { if (a.page.terminal) { terminal++; expect(a.page.records).toEqual([]); expect(a.page.recordMultiplicity).toEqual([]); } } }); expect(terminal).toBe(4512); });
  it("persists recursive prewindow lookup occurrences before committing equal pass digests", async () => {
    const artifacts: Array<{ page: { provenance: { kind: string }; records: readonly { identity: FecFilingIdentityV1 }[] }; lineage: readonly { fileNumber: number }[] }> = [];
    const fetch = async (url: URL) => {
      if (isPrimary(url)) return reply(url, [raw(2, [1, 2])]);
      if (url.searchParams.get("file_number") === "1" && url.searchParams.get("page") === "1") return reply(url, [raw(1, [1], "2024-12-31")]);
      return empty(url);
    };
    const got = await enumerateNationwideFecFilings({ ...options(fetch), sinkPage: a => { artifacts.push(a); } });
    const primary = artifacts.find(a => a.page.provenance.kind === "daily_partition" && a.page.records[0]?.identity.fileNumber === 2)!;
    const lookup = artifacts.filter(a => a.page.provenance.kind === "predecessor_lookup" && a.page.records[0]?.identity.fileNumber === 1);
    expect(primary.lineage).toEqual([{ fileNumber: 2, pageSha256: expect.any(String), pass: 1, occurrenceIndex: 1 }]);
    expect(lookup).toHaveLength(2); expect(lookup.every(a => a.lineage[0]?.fileNumber === 1)).toBe(true);
    const one = artifacts.find(a => a.page.records[0]?.identity.fileNumber === 1)!.page.records[0]!.identity, two = primary.page.records[0]!.identity;
    const digest = fecPassMultiplicityDigestSha256(new Map([[fecFilingIdentitySha256(one), 1], [fecFilingIdentitySha256(two), 1]]));
    expect(got.ledger.pass1DigestSha256).toBe(digest); expect(got.ledger.pass2DigestSha256).toBe(digest);
    expect(got.ledger.entries.map(e => e.identity.fileNumber)).toEqual([1, 2]); expect(got.counts).toMatchObject({ entries: 2, occurrences: 2 });
  });
  it("rejects a global predecessor fork", async () => {
    const fetch = (url: URL) => isPrimary(url) ? reply(url, [raw(1, [1]), raw(2, [1, 2]), raw(3, [1, 3])]) : empty(url);
    await expect(enumerateNationwideFecFilings({ ...options(fetch), sinkPage: () => undefined })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_CHAIN" });
  });
  it("rejects lookup pass instability", async () => {
    let lookupPageOne = 0;
    const fetch = (url: URL) => {
      if (isPrimary(url)) return reply(url, [raw(2, [1, 2])]);
      if (url.searchParams.get("file_number") === "1" && url.searchParams.get("page") === "1") return reply(url, [raw(1, [1], "2024-12-31", ++lookupPageOne === 2 ? "https://docquery.fec.gov/dcdev/posted/1.fec" : null)]);
      return empty(url);
    };
    await expect(enumerateNationwideFecFilings({ ...options(fetch), sinkPage: () => undefined })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_LOOKUP" });
  });
  it("rejects a predecessor lookup that remains in the enumeration window", async () => {
    const fetch = (url: URL) => {
      if (isPrimary(url)) return reply(url, [raw(2, [1, 2])]);
      if (url.searchParams.get("file_number") === "1" && url.searchParams.get("page") === "1") return reply(url, [raw(1, [1])]);
      return empty(url);
    };
    await expect(enumerateNationwideFecFilings({ ...options(fetch), sinkPage: () => undefined })).rejects.toMatchObject({ code: "FEC_V2_ENUMERATION_CHAIN" });
  });
});
