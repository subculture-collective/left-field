import { describe, expect, it, vi } from "vitest";
import { executeEnrichMembers, main, parseEnrichMemberArguments } from "./enrich-member-facts";

type Query = { text: string; values?: readonly unknown[] };
const source = { id: "rel_source", status: "published", source_cutoff: "2026-07-18T00:00:00.000Z", schema_version: 2 };
const candidate = { id: "rel_candidate", label: "R2", status: "candidate", source_cutoff: source.source_cutoff, previous_release_id: "rel_source" };
const summary = { observed: 2, expected: 2, biographicalFactCount: 4, committeeAssignmentCount: 0 };

function fakePool(options: { source?: object | null; candidate?: object | null; counts?: object | null; empty?: boolean } = {}) {
  const queries: Query[] = [];
  const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
    queries.push({ text, values });
    if (text.includes("JOIN release_manifests")) return { rowCount: options.source === null ? 0 : 1, rows: [options.source ?? source] };
    if (text.startsWith("SELECT id,label,status")) return { rowCount: options.candidate === null ? 0 : 1, rows: options.candidate === null ? [] : [options.candidate ?? candidate] };
    if (text.includes(" AS empty")) return { rowCount: 1, rows: [{ empty: options.empty ?? true }] };
    return { rowCount: 1, rows: [] };
  });
  const client = { query, release: vi.fn() };
  return { query, connect: vi.fn(async () => client), queries };
}

const argv = ["--source-release", "rel_source", "--candidate-release", "rel_candidate", "--label", "R2"];

describe("member enrichment operator CLI", () => {
  it("strictly parses finite, distinct arguments", () => {
    expect(parseEnrichMemberArguments([...argv, "--created-at", "2026-07-19T00:00:00Z"])).toEqual({ sourceReleaseId: "rel_source", candidateReleaseId: "rel_candidate", label: "R2", createdAt: "2026-07-19T00:00:00.000Z" });
    for (const bad of [[...argv, "--label", "again"], [...argv, "--nope", "x"], ["--source-release", "rel_source", "--candidate-release", "rel_source", "--label", "R2"], [...argv, "--created-at", "not-a-date"]]) expect(() => parseEnrichMemberArguments(bad)).toThrow();
  });

  it("rejects a non-v2 or non-published source before creating a shell", async () => {
    for (const invalid of [{ ...source, status: "candidate" }, { ...source, schema_version: 1 }]) {
      const pool = fakePool({ source: invalid });
      await expect(executeEnrichMembers(argv, { getPool: () => pool as never })).rejects.toThrow("published or retired schema v2");
      expect(pool.queries.some(({ text }) => text.startsWith("INSERT INTO data_releases"))).toBe(false);
    }
  });

  it("creates the exact shell, atomically verifies, and never promotes", async () => {
    const pool = fakePool({ candidate: null }); const enrich = vi.fn(); const verify = vi.fn(async () => summary);
    await expect(executeEnrichMembers(argv, { getPool: () => pool as never, enrich, verify, now: () => new Date("2026-07-19T00:00:00Z") })).resolves.toMatchObject({ status: "validated_candidate", memberCoverage: { observed: 2, expected: 2 }, biographicalFactCount: 4, committeeAssignmentCount: 0 });
    expect(pool.queries.find(({ text }) => text.startsWith("INSERT INTO data_releases"))?.values).toEqual(["rel_candidate", "R2", source.source_cutoff, "2026-07-19T00:00:00.000Z", "rel_source"]);
    expect(enrich).toHaveBeenCalledWith(pool, "rel_source", "rel_candidate"); expect(verify).toHaveBeenCalledWith(pool, "rel_candidate", "rel_source");
    expect(pool.queries.some(({ text }) => /UPDATE data_releases.*published|status='published'/.test(text))).toBe(false);
  });

  it("restarts a valid candidate without mutation", async () => {
    const pool = fakePool(); const enrich = vi.fn(); const verify = vi.fn(async () => summary);
    await executeEnrichMembers(argv, { getPool: () => pool as never, enrich, verify });
    expect(enrich).not.toHaveBeenCalled(); expect(verify).toHaveBeenCalledWith(pool, "rel_candidate", "rel_source");
    expect(pool.queries.some(({ text }) => /INSERT|DELETE|UPDATE/.test(text))).toBe(false);
  });

  it("rejects mismatched and partial existing candidates even when a count-only fake looks valid", async () => {
    await expect(executeEnrichMembers(argv, { getPool: () => fakePool({ candidate: { ...candidate, label: "other" } }) as never })).rejects.toThrow("does not match");
    const countOnlyFake = fakePool({ counts: { coverage_status: "complete", expected_count: 2, observed_count: 2, biographical_fact_count: 4, committee_assignment_count: 0 }, empty: false });
    const verify = vi.fn(async () => { throw new Error("exact failure"); });
    await expect(executeEnrichMembers(argv, { getPool: () => countOnlyFake as never, verify })).rejects.toThrow("partial");
    expect(verify).toHaveBeenCalledWith(countOnlyFake, "rel_candidate", "rel_source");
  });

  it("removes only its newly-created empty shell when enrichment fails", async () => {
    const pool = fakePool({ candidate: null }); const enrich = vi.fn().mockRejectedValue(new Error("broken"));
    await expect(executeEnrichMembers(argv, { getPool: () => pool as never, enrich })).rejects.toThrow("broken");
    expect(pool.queries.some(({ text }) => text.startsWith("DELETE FROM data_releases"))).toBe(true);
    const existing = fakePool({ empty: false });
    await expect(executeEnrichMembers(argv, { getPool: () => existing as never, enrich: vi.fn(), verify: vi.fn(async () => { throw new Error("exact failure"); }) })).rejects.toThrow("partial");
    expect(existing.queries.some(({ text }) => text.startsWith("DELETE FROM data_releases"))).toBe(false);
  });

  it("writes stable, non-secret success JSON", async () => {
    const stdout = { write: vi.fn() };
    await main(argv, { getPool: () => fakePool() as never, verify: vi.fn(async () => summary), stdout });
    expect(stdout.write).toHaveBeenCalledWith('{"sourceReleaseId":"rel_source","candidateReleaseId":"rel_candidate","status":"validated_candidate","memberCoverage":{"observed":2,"expected":2},"biographicalFactCount":4,"committeeAssignmentCount":0}\n');
  });
});
