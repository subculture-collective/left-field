import { describe, expect, it, vi } from "vitest";
import {
  executeBaselineFactual,
  main,
  parseBaselineFactualArguments,
} from "./baseline-factual";

const argv = [
  "--source-release", "rel_member",
  "--candidate-release", "rel_acs",
  "--label", "Factual ACS 2026-07-18",
];
const source = {
  id: "rel_member",
  label: "Factual Member",
  status: "published",
  source_cutoff: "2026-07-18T00:00:00.000Z",
  published_at: "2026-07-28T00:00:00.000Z",
  previous_release_id: "rel_r1",
  schema_version: 2,
};
const candidate = {
  id: "rel_acs",
  label: "Factual ACS 2026-07-18",
  status: "candidate",
  source_cutoff: source.source_cutoff,
  published_at: null,
  previous_release_id: source.id,
  schema_version: 2,
};

function fakePool(options: { existing?: boolean; source?: object; candidate?: object; parity?: object; gate?: number } = {}) {
  let candidateExists = options.existing ?? false;
  const queries: Array<{ text: string; values?: readonly unknown[] }> = [];
  const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
    queries.push({ text, values });
    if (text.includes("JOIN release_manifests") && values?.[0] === source.id) {
      return { rowCount: 1, rows: [options.source ?? source] };
    }
    if (text.startsWith("SELECT id,EXISTS(SELECT 1 FROM release_manifests")) {
      return { rowCount: candidateExists ? 1 : 0, rows: candidateExists ? [{ id: candidate.id, has_manifest: true }] : [] };
    }
    if (text.startsWith("INSERT INTO data_releases")) {
      candidateExists = true;
      return { rowCount: 1, rows: [] };
    }
    if (text.includes("JOIN release_manifests") && values?.[0] === candidate.id) {
      return { rowCount: 1, rows: [options.candidate ?? candidate] };
    }
    if (text.includes("WITH source_digests")) {
      return { rowCount: 1, rows: [options.parity ?? { mismatch_count: 0, domain_count: 7 }] };
    }
    if (text.startsWith("SELECT 1 FROM nationwide_validation_gates")) {
      return { rowCount: options.gate ?? 1, rows: [{}] };
    }
    return { rowCount: 1, rows: [] };
  });
  return { query, queries };
}

describe("factual baseline operator CLI", () => {
  it("strictly parses distinct factual release arguments", () => {
    expect(parseBaselineFactualArguments([...argv, "--created-at", "2026-07-28T12:00:00Z"]))
      .toEqual({
        sourceReleaseId: "rel_member",
        candidateReleaseId: "rel_acs",
        label: "Factual ACS 2026-07-18",
        createdAt: "2026-07-28T12:00:00.000Z",
      });
    for (const bad of [
      [...argv, "--label", "again"],
      ["--source-release", "rel_member", "--candidate-release", "rel_member", "--label", "same"],
      [...argv, "--created-at", "not-a-date"],
      [...argv, "--unknown", "x"],
    ]) expect(() => parseBaselineFactualArguments(bad)).toThrow();
  });

  it("creates, baselines, and verifies a candidate without publication", async () => {
    const pool = fakePool();
    const baseline = vi.fn(async () => undefined);
    await expect(executeBaselineFactual(argv, {
      getPool: () => pool as never,
      baseline,
      now: () => new Date("2026-07-28T12:00:00Z"),
    })).resolves.toEqual({
      sourceReleaseId: "rel_member",
      candidateReleaseId: "rel_acs",
      status: "baselined_candidate",
      digestDomains: 7,
    });
    expect(baseline).toHaveBeenCalledWith(pool, "rel_member", "rel_acs");
    expect(pool.queries.find(({ text }) => text.startsWith("INSERT INTO data_releases"))?.values)
      .toEqual(["rel_acs", "Factual ACS 2026-07-18", source.source_cutoff, "2026-07-28T12:00:00.000Z", "rel_member"]);
    expect(pool.queries.some(({ text }) => /status='published'/.test(text))).toBe(false);
  });

  it("is restart-safe only for an exact validated seven-domain baseline", async () => {
    const baseline = vi.fn();
    await expect(executeBaselineFactual(argv, {
      getPool: () => fakePool({ existing: true }) as never,
      baseline,
    })).resolves.toMatchObject({ status: "already_baselined", digestDomains: 7 });
    expect(baseline).not.toHaveBeenCalled();
    await expect(executeBaselineFactual(argv, {
      getPool: () => fakePool({ existing: true, parity: { mismatch_count: 1, domain_count: 7 } }) as never,
      baseline,
    })).rejects.toThrow("partial or differs");
    await expect(executeBaselineFactual(argv, {
      getPool: () => fakePool({ existing: true, candidate: { ...candidate, previous_release_id: "rel_other" } }) as never,
      baseline,
    })).rejects.toThrow("does not match");
  });

  it("rejects nonpublished/non-v2 sources before creating a shell", async () => {
    const pool = fakePool({ source: { ...source, status: "candidate" } });
    await expect(executeBaselineFactual(argv, { getPool: () => pool as never }))
      .rejects.toThrow("published or retired schema-v2");
    expect(pool.queries.some(({ text }) => text.startsWith("INSERT INTO data_releases"))).toBe(false);
  });

  it("leaves only its exact empty shell for a least-privilege retry after failure", async () => {
    const pool = fakePool();
    await expect(executeBaselineFactual(argv, {
      getPool: () => pool as never,
      baseline: vi.fn(async () => { throw new Error("broken"); }),
    })).rejects.toThrow("broken");
    expect(pool.queries.some(({ text }) => text.startsWith("DELETE FROM data_releases"))).toBe(false);
  });

  it("writes stable non-secret success JSON", async () => {
    const stdout = { write: vi.fn() };
    await main(argv, {
      getPool: () => fakePool({ existing: true }) as never,
      stdout,
    });
    expect(stdout.write).toHaveBeenCalledWith(
      '{"sourceReleaseId":"rel_member","candidateReleaseId":"rel_acs","status":"already_baselined","digestDomains":7}\n',
    );
  });
});
