import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { getSeatProfile, __sql } from "./get-seat-profile";
import { getSeatFacets, listSourceSnapshots, listSources } from "./list-sources";
import { coherentManifest } from "@/test/fixtures/prototype-manifest";

describe("direct SQL profile modules", () => {
  it("keeps profile SQL release-scoped and has a single recursive snapshot closure", () => {
    const moduleSource = readFileSync("src/repositories/sql/get-seat-profile.ts", "utf8");
    expect(moduleSource).not.toMatch(/\.replace\s*\(/);
    expect(moduleSource).not.toMatch(/\blet\s+(PROFILE_SQL|CLOSURE_SQL)\b/);
    expect(__sql.PROFILE_SQL).toContain("release_profile_seats");
    expect(__sql.PROFILE_SQL).toContain("ps.release_id = $1 AND ps.seat_cycle_id = $2");
    expect(__sql.CLOSURE_SQL).toContain("WITH RECURSIVE target");
    expect(__sql.CLOSURE_SQL).toContain("snapshot_derivation_inputs");
    expect(__sql.CLOSURE_SQL).not.toContain("input_snapshot_id, output_snapshot_id");
    expect(__sql.CLOSURE_SQL).toContain("entity_type='contests'");
    expect(__sql.CLOSURE_SQL).toContain("entity_type='candidacies'");
    expect(__sql.CLOSURE_SQL).toContain("entity_type='result_options'");
    expect(__sql.CLOSURE_SQL).toContain("cr.domain='finance'");
    expect(__sql.CLOSURE_SQL).toContain("cr.scope_kind='funding'");
    expect(__sql.CLOSURE_SQL).toContain("cr.domain='election_2024'");
    expect(__sql.CLOSURE_SQL).toContain("cr.scope_kind='election'");
    expect(__sql.CLOSURE_SQL).toContain("output_snapshot_id AS from_id, input_snapshot_id AS to_id");
    expect(__sql.PROFILE_SQL).toContain("EXISTS (SELECT 1 FROM fec_filing_summaries ff");
    expect(__sql.PROFILE_SQL).not.toContain("loadPrototypeManifest");
  });

  it("accepts v2-style empty factual arrays and drops unrelated closure rows", async () => {
    const manifest = coherentManifest();
    const cycle = manifest.seatCycles[0]!;
    const profile = {
      release: manifest.release, office: manifest.offices[0], seatCycle: cycle,
      geography: manifest.geographyVersions[0], officeTerm: manifest.officeTerms[0],
      membership: null, incumbent: null, contests: [], candidacies: [], resultOptions: [],
      electionResults: [], demographics: [], finance: [], committees: [], biographicalFacts: [], memberCoverage: null,
      committeeRelationships: [], sources: [], snapshots: [],
    };
    const snapshot = { id: "snap_1", releaseId: "rel_1", sourceId: "src_1", sourceUrl: "https://example.com/data", publishedAt: new Date("2024-01-01T00:00:00.000Z"), retrievedAt: new Date("2024-01-01T00:00:00.000Z"), checksumSha256: "a".repeat(64), parserVersion: "1", license: "public", usageStatus: "approved", source_id: "src_1", source_release_id: "rel_1", name: "Source", authority: "official", homepage_url: "https://example.com" };
    const pool = { query: async () => ({ rowCount: 1, rows: [{ profile }, { ...snapshot, id: "snap_other", releaseId: "rel_other", source_release_id: "rel_other" }] }) };
    // First query sees only profile; the second sees the two closure rows.
    let calls = 0; pool.query = async () => (++calls === 1 ? { rowCount: 1, rows: [{ profile }] } : { rowCount: 3, rows: [snapshot, { ...snapshot, id: "snap_2" }, { ...snapshot, id: "snap_other", releaseId: "rel_other", source_release_id: "rel_other" }] });
    const value = await getSeatProfile(pool as never, "rel_1" as never, cycle.id);
    expect(value?.contests).toEqual([]);
    expect(value?.snapshots.map((row) => row.id)).toEqual(["snap_1", "snap_2"]);
    expect(value?.sources).toHaveLength(1);
    expect(value?.snapshots[0]?.publishedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("excludes an unrelated committee relationship and its provenance from a profile candidacy", () => {
    const profileRelationship = "pr.entity_type='committee_relationships' AND pr.entity_id=cr.id";
    const closureRelationship = "p.entity_type='committee_relationships' AND p.entity_id=cr.id";
    const financeForProfileSeat = "ff.release_id=cr.release_id AND ff.committee_id=cr.committee_id AND ff.seat_cycle_id=root.seat_id";
    const financeForClosureSeat = "ff.release_id=cr.release_id AND ff.committee_id=cr.committee_id AND ff.seat_cycle_id=$2";

    expect(__sql.PROFILE_SQL).toContain(`${profileRelationship} WHERE cr.release_id=$1`);
    expect(__sql.PROFILE_SQL).toContain(`co.seat_cycle_id=root.seat_id AND EXISTS (SELECT 1 FROM fec_filing_summaries ff WHERE ${financeForProfileSeat})`);
    expect(__sql.CLOSURE_SQL).toContain(`${closureRelationship} JOIN candidacies ca`);
    expect(__sql.CLOSURE_SQL).toContain(`c.seat_cycle_id=$2 AND EXISTS (SELECT 1 FROM fec_filing_summaries ff WHERE ${financeForClosureSeat})`);
  });

  it("selects incumbent biography facts and release member coverage into closure", () => {
    expect(__sql.PROFILE_SQL).toContain("FROM biographical_facts bf");
    expect(__sql.PROFILE_SQL).toContain("bf.person_id=person.id");
    expect(__sql.PROFILE_SQL).toContain("cr.domain='member' AND cr.scope_kind='release'");
    expect(__sql.CLOSURE_SQL).toContain("FROM biographical_fact_provenance bfp");
  });

  it("lists only release-scoped sources in bytewise ID order", async () => {
    let sql = "";
    const pool = { query: async (text: string) => { sql = text; return { rows: [{ id: "src_a", releaseId: "rel_1", name: "A", authority: "official", homepageUrl: "https://example.com" }] }; } };
    await expect(listSources(pool as never, "rel_1" as never)).resolves.toHaveLength(1);
    expect(sql).toContain("WHERE release_id = $1");
    expect(sql).toContain('COLLATE "C"');
  });

  it("reads release-scoped facets and the full snapshot inventory directly", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const snapshot = { id: "snap_b", releaseId: "rel_1", sourceId: "src_1", sourceUrl: "https://example.com/data", publishedAt: new Date("2024-01-01T00:00:00.000Z"), retrievedAt: new Date("2024-01-02T00:00:00.000Z"), checksumSha256: "a".repeat(64), parserVersion: "1", license: "public", usageStatus: "approved" };
    const pool = { query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return calls.length === 1 ? { rows: [{ states: ["CA", "NY"], parties: ["democratic"], incumbencyStatuses: ["incumbent_running", "open"], electionYears: [2024, 2026] }] } : { rows: [snapshot] };
    } };
    await expect(getSeatFacets(pool as never, "rel_1" as never)).resolves.toEqual({ states: ["CA", "NY"], parties: ["democratic"], incumbencyStatuses: ["incumbent_running", "open"], electionYears: [2024, 2026] });
    await expect(listSourceSnapshots(pool as never, "rel_1" as never)).resolves.toEqual([{ ...snapshot, publishedAt: "2024-01-01T00:00:00.000Z", retrievedAt: "2024-01-02T00:00:00.000Z" }]);
    expect(calls).toHaveLength(2);
    for (const call of calls) { expect(call.values).toEqual(["rel_1"]); expect(call.text).toContain("release_id = $1"); }
    expect(calls[0]!.text).toContain("release_profile_seats");
    expect(calls[0]!.text).not.toMatch(/acs_|facts|contests|fec_/i);
    expect(calls[1]!.text).toContain("FROM source_snapshots");
    expect(calls[1]!.text).toContain('ORDER BY id COLLATE "C"');
  });
});
