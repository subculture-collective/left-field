import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PostgresSeatResearchRepository } from "./postgres";
import { coherentManifest } from "@/test/fixtures/prototype-manifest";

const releaseId = "rel_1" as never;
const seatId = "seat_1" as never;
const release = { id: releaseId, label: "Release", status: "published", sourceCutoff: new Date("2026-01-01T00:00:00.000Z"), createdAt: new Date("2026-01-02T00:00:00.000Z"), publishedAt: null, previousReleaseId: null };

describe("PostgresSeatResearchRepository nationwide reads", () => {
  it("uses direct release SQL, normalizes timestamps, and has no manifest dependency", async () => {
    const calls: string[] = [];
    const pool = { query: async (text: string) => { calls.push(text); return { rowCount: 1, rows: [release] }; } };
    const repository = new PostgresSeatResearchRepository(pool as never);
    await expect(repository.getActiveRelease()).resolves.toMatchObject({ sourceCutoff: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-02T00:00:00.000Z" });
    await expect(repository.getRelease(releaseId)).resolves.toMatchObject({ status: "published", publishedAt: null });
    expect(calls.every((text) => text.includes("data_releases"))).toBe(true);
    const source = readFileSync("src/repositories/postgres.ts", "utf8");
    expect(source).not.toMatch(/loadPrototypeManifest|createManifestSeatProjection|loadNationwideManifest/);
  });

  it("dispatches list and item reads to their direct release-scoped SQL helpers", async () => {
    const item = { id: seatId, releaseId, chamber: "house", stateCode: "NY", districtCode: "01", label: "NY-01", incumbentName: null, incumbentParty: null, incumbencyStatus: "open", electionYear: 2026, coverageLabel: "New York 1", presidentialMargin2024: { kind: "coverage_missing", value: { kind: "missing", reason: "not_collected" }, reason: "not_collected", asOf: "2026-01-01", methodology: "coverage_missing", inputSnapshotIds: ["snap_1"], geographyVersionId: "geo_1", status: "reported" }, cashOnHand: { kind: "missing", reason: "source_unavailable", asOf: "2026-01-01", inputSnapshotIds: ["snap_1"] } };
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const pool = { query: async (text: string, values: unknown[] = []) => { calls.push({ text, values }); return { rows: [{ item, sort_value: "NY", total: "1" }] }; } };
    const repository = new PostgresSeatResearchRepository(pool as never);
    await repository.listSeatPage(releaseId, { limit: 1, sort: "state", direction: "asc" });
    await expect(repository.getSeatListItem(releaseId, seatId)).resolves.toMatchObject({ id: seatId });
    expect(calls[1]!.text).toContain("rps.seat_cycle_id = $12");
    expect(calls[1]!.values[11]).toBe(seatId);
  });

  it("dispatches sources directly without hydrating a release manifest", async () => {
    let call = "";
    const pool = { query: async (text: string) => { call = text; return { rows: [{ id: "src_1", releaseId, name: "Source", authority: "official", homepageUrl: "https://example.com" }] }; } };
    await expect(new PostgresSeatResearchRepository(pool as never).listSources(releaseId)).resolves.toHaveLength(1);
    expect(call).toContain("FROM sources"); expect(call).toContain("WHERE release_id = $1");
  });

  it("dispatches facets and snapshots as bounded direct release reads", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const pool = { query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return calls.length === 1
        ? { rows: [{ states: [], parties: [], incumbencyStatuses: [], electionYears: [] }] }
        : { rows: [] };
    } };
    const repository = new PostgresSeatResearchRepository(pool as never);
    await expect(repository.getSeatFacets(releaseId)).resolves.toEqual({ states: [], parties: [], incumbencyStatuses: [], electionYears: [] });
    await expect(repository.listSourceSnapshots(releaseId)).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
    for (const call of calls) { expect(call.values).toEqual([releaseId]); expect(call.text).toContain("release_id = $1"); }
  });

  it("uses one read-only repeatable-read client transaction and releases it on success and failure", async () => {
    const manifest = coherentManifest(); const profile = { release: manifest.release, office: manifest.offices[0], seatCycle: manifest.seatCycles[0], geography: manifest.geographyVersions[0], officeTerm: manifest.officeTerms[0], membership: null, incumbent: null, contests: [], candidacies: [], resultOptions: [], electionResults: [], demographics: [], finance: [], committees: [], committeeRelationships: [], sources: [], snapshots: [] };
    const calls: string[] = []; let released = 0; let reads = 0; let fail = false;
    const client = { query: async (text: string) => { calls.push(text); if (!/^(BEGIN|COMMIT|ROLLBACK)/.test(text)) { if (fail) throw new Error("read failed"); return ++reads === 1 ? { rowCount: 1, rows: [{ profile }] } : { rowCount: 0, rows: [] }; } return { rowCount: 0, rows: [] }; }, release: () => { released += 1; } };
    const repository = new PostgresSeatResearchRepository({ connect: async () => client } as never);
    await expect(repository.getSeatProfile("rel_1" as never, manifest.seatCycles[0]!.id)).resolves.not.toBeNull();
    expect(calls).toEqual(expect.arrayContaining(["BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY", "COMMIT"])); expect(released).toBe(1);
    fail = true;
    await expect(repository.getSeatProfile("rel_1" as never, manifest.seatCycles[0]!.id)).rejects.toThrow("read failed");
    expect(calls).toContain("ROLLBACK"); expect(released).toBe(2);
  });

  it("keeps legacy listSeats paged and rejects a non-advancing cursor", async () => {
    const repository = new PostgresSeatResearchRepository({} as never);
    let pages = 0; const requests: unknown[] = [];
    (repository as { listSeatPage: typeof repository.listSeatPage }).listSeatPage = async (_releaseId, request) => { requests.push(request); return { releaseId, items: [], total: 0, nextCursor: pages++ === 0 ? "same" : "same" }; };
    await expect(repository.listSeats(releaseId, { sort: "state", direction: "asc" })).rejects.toThrow("did not advance");
    expect(pages).toBe(2); expect(requests).toEqual(expect.arrayContaining([expect.objectContaining({ limit: 100 })]));
  });
});
