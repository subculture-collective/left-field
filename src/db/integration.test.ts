import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { canonicalManifest } from "@/data/canonical-manifest";
import { loadCanonicalBoundaries as loadCanonicalBoundaryBundle } from "@/data/boundary-loader";
import { adversarialRepositoryManifest, coherentBoundaryBundle, coherentManifest } from "@/test/fixtures/prototype-manifest";
import type { PrototypeManifest } from "@/domain/contracts";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { compileBoundaryBundle, loadPrototypeManifest, seedPrototypeManifest } from "./manifest";
import { promoteCandidateRelease, rollbackPublishedRelease } from "./releases";
import { PostgresSeatResearchRepository } from "@/repositories/postgres";
import { InMemorySeatResearchRepository } from "@/repositories/in-memory";
import { assertSeatRepositoryContract } from "@/test/repository-contract";
import { PostgresAddressResolver, PostgresSeatLocator } from "@/address/postgres-resolver";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseName = testDatabaseUrl ? new URL(testDatabaseUrl).pathname.slice(1) : "";
if (testDatabaseUrl && !/(?:_test|_test_[a-z0-9_]+)$/i.test(testDatabaseName)) throw new Error("TEST_DATABASE_URL must name a disposable *_test database");
const integration = testDatabaseUrl ? describe : describe.skip;

function candidate(id: string, base: PrototypeManifest = coherentManifest()): PrototypeManifest {
  const manifest = structuredClone(base) as PrototypeManifest;
  const replaceRelease = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(replaceRelease);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (record.releaseId === "rel_1") record.releaseId = id;
      Object.values(record).forEach(replaceRelease);
    }
  };
  replaceRelease(manifest);
  manifest.release = { ...manifest.release, id: id as never, status: "candidate", publishedAt: null, previousReleaseId: null };
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  return manifest;
}

function boundariesFor(manifest: PrototypeManifest) { return coherentBoundaryBundle(manifest); }

async function waitForPromotionToBlock(pool: Pool, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const waiting = await pool.query<{ waiting: boolean }>("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS waiting");
    if (waiting.rows[0]?.waiting) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Promotion did not block on the candidate content lock");
}

integration("PostgreSQL integration", () => {
  beforeEach(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try { await pool.query("TRUNCATE data_releases CASCADE"); } finally { await pool.end(); }
  });

  afterEach(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try { await pool.query("TRUNCATE data_releases CASCADE"); } finally { await pool.end(); }
  });

  it("round-trips the canonical candidate with artifact and geometry identity", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query("SELECT PostGIS_Version()");
      const bundle = await loadCanonicalBoundaryBundle(canonicalManifest);
      const expectedBoundaries = compileBoundaryBundle(canonicalManifest, bundle);

      await seedPrototypeManifest(pool, canonicalManifest, bundle);
      const loaded = await loadPrototypeManifest(pool, canonicalManifest.release.id);

      expect(computeCanonicalDataChecksum(loaded)).toBe(canonicalManifest.canonicalDataChecksumSha256);
      expect(loaded.profileSeatCycleIds).toEqual(canonicalManifest.profileSeatCycleIds);
      expect(loaded.geometryArtifacts).toEqual(canonicalManifest.geometryArtifacts);

      for (const [geographyId, boundary] of expectedBoundaries) {
        const result = await pool.query<{ expected: Buffer; actual: Buffer }>(
          "SELECT ST_AsEWKB(ST_Normalize(ST_SetSRID(ST_GeomFromGeoJSON($2),4326))) AS expected, ST_AsEWKB(ST_Normalize(boundary)) AS actual FROM geography_versions WHERE release_id=$1 AND id=$3",
          [canonicalManifest.release.id, JSON.stringify(boundary), geographyId],
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]!.actual.equals(result.rows[0]!.expected)).toBe(true);
      }
    } finally {
      await pool.end();
    }
  });

  it("matches the in-memory repository contract for the promoted canonical release", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const bundle = await loadCanonicalBoundaryBundle(canonicalManifest);
      await seedPrototypeManifest(pool, canonicalManifest, bundle);
      await promoteCandidateRelease(pool, canonicalManifest.release.id);
      const postgres = new PostgresSeatResearchRepository(pool);
      const publishedManifest = await loadPrototypeManifest(pool, canonicalManifest.release.id);
      const publishedMemory = new InMemorySeatResearchRepository(publishedManifest);
      const canonicalMemory = new InMemorySeatResearchRepository(canonicalManifest);
      await assertSeatRepositoryContract(postgres, publishedManifest);
      await assertSeatRepositoryContract(publishedMemory, publishedManifest);
      expect(await postgres.listSeats(canonicalManifest.release.id, { sort: "state", direction: "asc" })).toEqual(await canonicalMemory.listSeats(canonicalManifest.release.id, { sort: "state", direction: "asc" }));
      expect(await postgres.getSeatProfile(canonicalManifest.release.id, canonicalManifest.profileSeatCycleIds[0]!)).toEqual(await publishedMemory.getSeatProfile(canonicalManifest.release.id, canonicalManifest.profileSeatCycleIds[0]!));
      expect(await postgres.listSources(canonicalManifest.release.id)).toEqual(await publishedMemory.listSources(canonicalManifest.release.id));
      expect(await postgres.getActiveRelease()).toEqual(await publishedMemory.getActiveRelease());
      expect(await postgres.getRelease(canonicalManifest.release.id)).toEqual(await publishedMemory.getRelease(canonicalManifest.release.id));
    } finally { await pool.end(); }
  });

  it("resolves the promoted pinned address geometry without retaining a residential address", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const bundle = await loadCanonicalBoundaryBundle(canonicalManifest);
      await seedPrototypeManifest(pool, canonicalManifest, bundle); await promoteCandidateRelease(pool, canonicalManifest.release.id);
      const point = async (geographyId: string) => (await pool.query<{ longitude: number; latitude: number }>("SELECT ST_X(ST_PointOnSurface(boundary)) longitude, ST_Y(ST_PointOnSurface(boundary)) latitude FROM geography_versions WHERE release_id=$1 AND id=$2", [canonicalManifest.release.id, geographyId])).rows[0]!;
      const ak = await point("geo_house_ak_al"); const al = await point("geo_state_al");
      let census = { longitude: ak.longitude, latitude: ak.latitude, stateGeoid: "02", congressionalDistrictGeoid: "0200" };
      const geocoder = { geocode: vi.fn(async () => ({ benchmark: { id: "4", name: "Public_AR_Current" }, vintage: { id: "4", name: "Current_Current" }, candidates: [census] })) };
      const resolver = new PostgresAddressResolver({ releaseId: canonicalManifest.release.id, productVintage: "2025", enabled: true }, geocoder, new PostgresSeatLocator(pool), { tryAcquire: () => true });
      const result = await resolver.resolve({ address: "Fictional Plaza 7" });
      expect(result).toMatchObject({ status: "matched", houseSeat: { officeTermId: "term_house_ak_al_2025", seatCycleId: "seat_house_ak_al_2024_regular", geographyVersionId: "geo_house_ak_al" }, senateSeats: [{ senateClass: 2, officeTermId: "term_senate_ak_2", seatCycleId: "seat_senate_ak_2_current" }, { senateClass: 3, officeTermId: "term_senate_ak_3", seatCycleId: "seat_senate_ak_3_current" }] });
      const wrong = new PostgresAddressResolver({ releaseId: canonicalManifest.release.id, productVintage: "wrong", enabled: true }, geocoder, new PostgresSeatLocator(pool), { tryAcquire: () => true });
      await expect(wrong.resolve({ address: "Fictional Plaza 7" })).resolves.toMatchObject({ status: "resolver_failure" }); expect(geocoder.geocode).toHaveBeenCalledTimes(1);
      census = { longitude: al.longitude, latitude: al.latitude, stateGeoid: "01", congressionalDistrictGeoid: "0101" };
      await expect(resolver.resolve({ address: "Fictional Plaza 7" })).resolves.toMatchObject({ status: "unsupported_prototype_coverage" });
      census = { longitude: ak.longitude, latitude: ak.latitude, stateGeoid: "01", congressionalDistrictGeoid: "0102" };
      await expect(resolver.resolve({ address: "Fictional Plaza 7" })).resolves.toMatchObject({ status: "vintage_mismatch" });
    } finally { await pool.end(); }
  });

  it("uses the exact selected profile cycles for every canonical geography", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const bundle = await loadCanonicalBoundaryBundle(canonicalManifest);
      await seedPrototypeManifest(pool, canonicalManifest, bundle); await promoteCandidateRelease(pool, canonicalManifest.release.id);
      const locator = new PostgresSeatLocator(pool);
      for (const seatCycleId of canonicalManifest.profileSeatCycleIds) {
        const cycle = canonicalManifest.seatCycles.find((value) => value.id === seatCycleId)!;
        const geography = canonicalManifest.geographyVersions.find((value) => value.id === cycle.geographyVersionId)!;
        const state = canonicalManifest.geographyVersions.find((value) => value.kind === "state" && value.stateCode === geography.stateCode)!;
        const point = (await pool.query<{ longitude: number; latitude: number }>("SELECT ST_X(ST_PointOnSurface(boundary)) longitude, ST_Y(ST_PointOnSurface(boundary)) latitude FROM geography_versions WHERE release_id=$1 AND id=$2", [canonicalManifest.release.id, geography.id])).rows[0]!;
        const result = await locator.locate(canonicalManifest.release.id, "2025", state.sourceGeoid!, geography.sourceGeoid!, point.longitude, point.latitude);
        const senate = canonicalManifest.seatCycles.filter((value) => { const term = canonicalManifest.officeTerms.find((item) => item.id === value.officeTermId)!; const office = canonicalManifest.offices.find((item) => item.id === term.officeId)!; return office.chamber === "senate" && office.stateCode === geography.stateCode; }).sort((a, b) => { const ao = canonicalManifest.offices.find((o) => o.id === canonicalManifest.officeTerms.find((t) => t.id === a.officeTermId)!.officeId)!; const bo = canonicalManifest.offices.find((o) => o.id === canonicalManifest.officeTerms.find((t) => t.id === b.officeTermId)!.officeId)!; return ao.senateClass! - bo.senateClass!; });
        expect(result).toMatchObject({ kind: "matched", houseSeat: { seatCycleId, officeTermId: cycle.officeTermId, geographyVersionId: geography.id }, senateSeats: senate.map((value) => ({ seatCycleId: value.id, officeTermId: value.officeTermId })) });
      }
    } finally { await pool.end(); }
  });

  it("uses UTC for seat-term cutoff comparisons", async () => {
    const source = await readFile(resolve(process.cwd(), "src/address/postgres-resolver.ts"), "utf8");
    expect(source).toContain("(r.source_cutoff AT TIME ZONE 'UTC')::date");
    expect(source).not.toContain("r.source_cutoff::date");
  });

  it("matches the strengthened contract for a promoted adversarial release", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query("SELECT PostGIS_Version()");
      const manifest = candidate(`rel_adversarial_${Date.now()}_${Math.random().toString(36).slice(2)}`, adversarialRepositoryManifest());
      await seedPrototypeManifest(pool, manifest, boundariesFor(manifest)); await promoteCandidateRelease(pool, manifest.release.id);
      const loaded = await loadPrototypeManifest(pool, manifest.release.id); const postgres = new PostgresSeatResearchRepository(pool); const memory = new InMemorySeatResearchRepository(loaded);
      await assertSeatRepositoryContract(postgres, loaded); await assertSeatRepositoryContract(memory, loaded);
      expect(await postgres.listSeats(loaded.release.id, { sort: "cash_on_hand", direction: "asc" })).toEqual(await memory.listSeats(loaded.release.id, { sort: "cash_on_hand", direction: "asc" }));
    } finally { await pool.end(); }
  });

  it("keeps published metadata immutable and rejects checksum, provenance, and promotion races", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const first = candidate(`rel_integration_first_${suffix}`);
    const second = candidate(`rel_integration_second_${suffix}`);
    const tampered = candidate(`rel_integration_tampered_${suffix}`);
    const orphaned = candidate(`rel_integration_orphaned_${suffix}`);
    const racing = candidate(`rel_integration_racing_${suffix}`);
    const guarded = candidate(`rel_integration_guarded_${suffix}`);
    try {
      await pool.query("SELECT PostGIS_Version()");
      await seedPrototypeManifest(pool, first, boundariesFor(first));
      const loaded = await loadPrototypeManifest(pool, first.release.id);
      expect(computeCanonicalDataChecksum(loaded)).toBe(computeCanonicalDataChecksum(first));
      expect(loaded.profileSeatCycleIds).toEqual(first.profileSeatCycleIds);
      await promoteCandidateRelease(pool, first.release.id);
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, first.release.id))).toBe(first.canonicalDataChecksumSha256);
      await seedPrototypeManifest(pool, second, boundariesFor(second));
      const checksums = await pool.query<{ release_id: string; content_checksum_sha256: string }>("SELECT release_id,content_checksum_sha256 FROM release_manifests WHERE release_id = ANY($1)", [[first.release.id, second.release.id]]);
      expect(new Set(checksums.rows.map((row) => row.content_checksum_sha256)).size).toBe(2);
      await promoteCandidateRelease(pool, second.release.id);
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, first.release.id))).toBe(first.canonicalDataChecksumSha256);
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, second.release.id))).toBe(second.canonicalDataChecksumSha256);
      await expect(rollbackPublishedRelease(pool)).resolves.toEqual({ publishedReleaseId: first.release.id, retiredReleaseId: second.release.id });
      expect((await pool.query("SELECT count(*)::int AS count FROM data_releases WHERE status='published'")).rows[0]?.count).toBe(1);
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, first.release.id))).toBe(first.canonicalDataChecksumSha256);
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, second.release.id))).toBe(second.canonicalDataChecksumSha256);
      await expect(pool.query("UPDATE release_manifests SET validated_at=now() WHERE release_id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE geography_versions SET label='mutated' WHERE release_id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET status='candidate', published_at=NULL WHERE id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET label='rewritten' WHERE id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET source_cutoff=source_cutoff + interval '1 day' WHERE id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET created_at=created_at + interval '1 day' WHERE id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });

      await expect(pool.query("UPDATE data_releases SET published_at=published_at + interval '1 day' WHERE id=$1", [first.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET previous_release_id=NULL WHERE id=$1", [second.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE data_releases SET status='published', previous_release_id=NULL WHERE id=$1", [second.release.id])).rejects.toMatchObject({ code: "23514" });

      await seedPrototypeManifest(pool, guarded, boundariesFor(guarded));
      // A candidate destination must not let a published row evade its source lock.
      await pool.query("DELETE FROM provenance WHERE release_id=$1 AND entity_type='people' AND entity_id='person_1'", [guarded.release.id]);
      await expect(pool.query("UPDATE provenance SET release_id=$2 WHERE release_id=$1 AND entity_type='people' AND entity_id='person_1'", [first.release.id, guarded.release.id])).rejects.toMatchObject({ code: "23514" });
      await pool.query("DELETE FROM contest_lineage WHERE release_id=$1 AND contest_id='contest_president_1'", [guarded.release.id]);
      await expect(pool.query("UPDATE contest_lineage SET release_id=$2 WHERE release_id=$1 AND contest_id='contest_president_1'", [first.release.id, guarded.release.id])).rejects.toMatchObject({ code: "23514" });
      expect(computeCanonicalDataChecksum(await loadPrototypeManifest(pool, first.release.id))).toBe(first.canonicalDataChecksumSha256);

      // Finance-summary lineage explains a missing summary, never a selected filing.
      await pool.query("INSERT INTO committees (release_id,id,source_committee_id,name,committee_type) VALUES ($1,'committee_finance','committee_finance','Finance committee','authorized')", [guarded.release.id]);
      await pool.query("INSERT INTO fec_filing_summaries (release_id,id,seat_cycle_id,committee_id,source_filing_id,report_type,reporting_period_start,reporting_period_end,filed_at,amendment_number,amendment_status,amends_filing_id,cash_on_hand,cash_on_hand_missing_reason,total_receipts,total_receipts_missing_reason,total_disbursements,total_disbursements_missing_reason,lineage_as_of,lineage_methodology,lineage_status) VALUES ($1,'filing_finance','seat_house_1','committee_finance','filing_finance','quarterly','2024-01-01','2024-03-31','2024-04-01T00:00:00Z',0,'new',NULL,1,NULL,1,NULL,1,NULL,'2024-04-01','reported','reported')", [guarded.release.id]);
      await expect(pool.query("UPDATE seat_finance_summaries SET filing_id='filing_finance', missing_reason=NULL, as_of=NULL WHERE release_id=$1 AND seat_cycle_id='seat_house_1'", [guarded.release.id])).rejects.toMatchObject({ code: "23514" });
      await pool.query("DELETE FROM seat_finance_summary_lineage WHERE release_id=$1 AND seat_cycle_id='seat_house_1'", [guarded.release.id]);
      await pool.query("UPDATE seat_finance_summaries SET filing_id='filing_finance', missing_reason=NULL, as_of=NULL WHERE release_id=$1 AND seat_cycle_id='seat_house_1'", [guarded.release.id]);
      await expect(pool.query("INSERT INTO seat_finance_summary_lineage (release_id,seat_cycle_id,snapshot_id,role) VALUES ($1,'seat_house_1','snap_1','derived_input')", [guarded.release.id])).rejects.toMatchObject({ code: "23514" });

      await seedPrototypeManifest(pool, tampered, boundariesFor(tampered));
      await pool.query("UPDATE geography_versions SET boundary=ST_Translate(boundary, 1, 0) WHERE release_id=$1", [tampered.release.id]);
      await expect(loadPrototypeManifest(pool, tampered.release.id)).rejects.toThrow("geometry boundary checksum mismatch");
      await expect(promoteCandidateRelease(pool, tampered.release.id)).rejects.toThrow("geometry boundary checksum mismatch");
      expect((await pool.query("SELECT status FROM data_releases WHERE id=$1", [tampered.release.id])).rows[0]?.status).toBe("candidate");

      await seedPrototypeManifest(pool, orphaned, boundariesFor(orphaned));
      await expect(pool.query("INSERT INTO provenance (release_id,entity_type,entity_id,snapshot_id,role) VALUES ($1,'unsupported','x','snap_1','original_publisher')", [orphaned.release.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO provenance (release_id,entity_type,entity_id,snapshot_id,role) VALUES ($1,'people','missing','snap_1','original_publisher')", [orphaned.release.id])).rejects.toMatchObject({ code: "23503" });
      await pool.query("DELETE FROM election_result_lineage WHERE release_id=$1 AND result_option_id='option_1'", [orphaned.release.id]);
      await pool.query("DELETE FROM election_results WHERE release_id=$1 AND result_option_id='option_1'", [orphaned.release.id]);
      await pool.query("DELETE FROM result_options WHERE release_id=$1 AND id='option_1'", [orphaned.release.id]);
      await pool.query("DELETE FROM candidacies WHERE release_id=$1 AND id='candidacy_1'", [orphaned.release.id]);
      await pool.query("DELETE FROM people WHERE release_id=$1 AND id='person_1'", [orphaned.release.id]);
      await expect(loadPrototypeManifest(pool, orphaned.release.id)).rejects.toThrow();
      await expect(promoteCandidateRelease(pool, orphaned.release.id)).rejects.toThrow();

      await seedPrototypeManifest(pool, racing, boundariesFor(racing));
      const writer = await pool.connect();
      try {
        await writer.query("BEGIN");
        await writer.query("UPDATE sources SET name='race mutation' WHERE release_id=$1", [racing.release.id]);
        const promotion = promoteCandidateRelease(pool, racing.release.id);
        await waitForPromotionToBlock(pool);
        await writer.query("COMMIT");
        await expect(promotion).rejects.toThrow(/canonical data checksum does not match manifest content/i);
      } finally {
        await writer.query("ROLLBACK").catch(() => undefined);
        writer.release();
      }
      expect((await pool.query("SELECT status FROM data_releases WHERE id=$1", [racing.release.id])).rows[0]?.status).toBe("candidate");
    } finally {
      await pool.end();
    }
  });
});
