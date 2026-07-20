import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { canonicalManifest } from "@/data/canonical-manifest";
import { loadCanonicalBoundaries as loadCanonicalBoundaryBundle } from "@/data/boundary-loader";
import { adversarialRepositoryManifest, coherentBoundaryBundle, coherentManifest } from "@/test/fixtures/prototype-manifest";
import type { PrototypeManifest } from "@/domain/contracts";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { compileBoundaryBundle, loadPrototypeManifest, seedPrototypeManifest } from "./manifest";
import { promoteCandidateRelease, rollbackPublishedRelease, rollForwardRetiredRelease } from "./releases";
import {
  baselineCandidateRelease,
  assertPersistedTask6MemberInvariant,
  verifyPersistedTask6MemberCandidate,
  enrichCandidateMembersFromBaseline,
  computeReleaseDigest,
  contentTableRegistry,
  contentDomains,
  recheckNationwideValidationGate,
  validateNationwideCandidateRelease,
  validateNationwideCandidateReleaseWithClient,
} from "./catalog-release";
import { failExpiredRun, heartbeat, markFailed, markLoaded, markValidated, recordQuarantineBatch, recordStageBatch, startIngestRun } from "./ingestion";
import { nationwideSkeleton } from "@/test/fixtures/nationwide-skeleton";
import { PostgresSeatResearchRepository } from "@/repositories/postgres";
import { InMemorySeatResearchRepository } from "@/repositories/in-memory";
import { assertSeatRepositoryContract } from "@/test/repository-contract";
import { PostgresAddressResolver, PostgresSeatLocator } from "@/address/postgres-resolver";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { runSource } from "@/ingestion/core/run-source";
import type { RawObject, SourceAdapter } from "@/ingestion/core/types";
import { canonicalCoverageScopeKey, loadNationwideManifest, seedNationwideCandidateManifest, type BoundaryBundle } from "./manifest";
import { LocalRawObjectStore } from "@/ingestion/core/raw-object-store";
import { createIdentityAdapter } from "@/ingestion/identity/adapter";
import type { HouseSeat } from "@/ingestion/identity/house";
import { parseSenateRoster, parseSenateServiceStartsArtifact, type SenateSeat } from "@/ingestion/identity/senate";
import { createTigerAdapter } from "@/ingestion/tiger/adapter";
import type { NationalTigerArtifactManifest } from "@/ingestion/tiger/national";
import { finalizeNationwideCandidate, locateNationwideCandidatePoint } from "@/ingestion/catalog/finalize-nationwide";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseName = testDatabaseUrl ? new URL(testDatabaseUrl).pathname.slice(1) : "";
if (testDatabaseUrl && !/(?:_test|_test_[a-z0-9_]+)$/i.test(testDatabaseName)) throw new Error("TEST_DATABASE_URL must name a disposable *_test database");
const integration = testDatabaseUrl ? describe : describe.skip;
const strictRun = (id: string, releaseId: string, sourceId: string, extractedCount: number, snapshotId = "snap_1", rawObjectSha256 = "a".repeat(64), upstreamRelease = "contract") => ({ id, releaseId, sourceId, snapshotId, adapterVersion: "contract", upstreamRelease, rawStoreKind: "local" as const, rawStoreLocator: "/tmp/contract", rawObjectKey: "contract/fixture.json", rawObjectSha256, rawObjectByteSize: 0, leaseToken: randomUUID(), leaseDurationMs: 60_000, extractedCount });

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

function persistedNationwideSkeleton() {
  const manifest = structuredClone(nationwideSkeleton());
  // Keep the synthetic release structurally nationwide while exercising the
  // repository's vacant-seat path.  The selection is derived from its own
  // house universe rather than from production seat ids.
  const houseOfficeIds = new Set(manifest.offices.filter((office) => office.chamber === "house").slice(0, 4).map((office) => office.id));
  const vacantTerms = new Set(manifest.seatCycles.filter((cycle) => houseOfficeIds.has(cycle.officeId)).map((cycle) => cycle.officeTermId));
  manifest.seatCycles = manifest.seatCycles.map((cycle) => vacantTerms.has(cycle.officeTermId) ? { ...cycle, occupancy: { ...cycle.occupancy, status: "vacant" } } : cycle);
  manifest.memberships = manifest.memberships.filter((membership) => !vacantTerms.has(membership.officeTermId));
  const memberCoverage = manifest.coverageRecords.find((record) => record.domain === "member" && record.scope.kind === "release");
  if (!memberCoverage) throw new Error("Synthetic nationwide fixture is missing release member coverage");
  memberCoverage.expectedCount = manifest.memberships.length;
  memberCoverage.observedCount = manifest.memberships.length;
  const featureCollection = {
    type: "FeatureCollection",
    features: manifest.geographyVersions.map((geography, index) => ({
      type: "Feature",
      properties: { sourceGeoid: geography.sourceGeoid, stateCode: geography.stateCode, districtCode: geography.kind === "house_district" ? geography.districtCode : null },
      geometry: { type: "MultiPolygon", coordinates: [[[[(-1800 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10], [(-1799 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10], [(-1799 + index % 3600) / 10, (-899 + Math.floor(index / 3600)) / 10], [(-1800 + index % 3600) / 10, (-899 + Math.floor(index / 3600)) / 10], [(-1800 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10]]]] },
    })),
  };
  const bytes = JSON.stringify(featureCollection);
  manifest.geometryArtifacts[0]!.checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  manifest.biographicalFacts.find((fact) => fact.fact === "birth_date")!.value = { kind: "value", value: "1970-01-02" };
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  return { manifest, bundle: [{ artifactId: manifest.geometryArtifacts[0]!.id, objectKey: manifest.geometryArtifacts[0]!.objectKey, bytes }] satisfies BoundaryBundle };
}

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
  type IdentityRow = { key: string; entity: string; name?: string };
  const task3Adapter = (raw: RawObject<null>, rows: readonly IdentityRow[], options: { quarantines?: boolean; issue?: boolean; stageError?: boolean; loadError?: boolean } = {}): SourceAdapter<null, IdentityRow> => ({
    sourceName: "task3", adapterVersion: "task3-v1",
    async *extract() { yield raw; },
    async *parse() { for (const row of rows) yield options.quarantines ? { kind: "quarantine" as const, sourceNaturalKey: row.key, payloadChecksum: "b".repeat(64), errorCode: "opaque parser detail" } : { kind: "row" as const, row }; },
    naturalKey: row => row.key,
    async stage(client: PoolClient, runId, staged) { if (options.stageError) throw new Error("stage failure"); for (const row of staged) await client.query("INSERT INTO stg_identity(run_id,release_id,source_natural_key,snapshot_id,entity_id,source_entity_id,display_name) VALUES($1,$2,$3,$4,$5,$6,$7)", [runId, task3ReleaseId, row.key, raw.snapshot.id, row.entity, row.entity, row.name ?? "Fixture"]); },
    async validateStaged() { return options.issue ? [{ code: "fixture_invalid", message: "fixture invalid" }] : []; },
    async loadFromStage(client, runId, releaseId) { await client.query("INSERT INTO people(id,release_id,display_name) SELECT 'task3_' || entity_id,$2,display_name FROM stg_identity WHERE run_id=$1", [runId, releaseId]); if (options.loadError) throw new Error("load failure"); },
  });
  const task3ReleaseId = "rel_task3_ingestion";
  const task3Raw = (snapshotId = "snap_task3", checksum = "a".repeat(64), count = 1): RawObject<null> => ({ value: null, expectedRecordCount: count, receipt: { storeKind: "local", storeLocator: "/tmp/task3", objectKey: "task3/fixture.json", sha256: checksum, byteSize: 0 }, snapshot: { id: snapshotId as never, sourceUrl: "https://example.test/task3", checksumSha256: checksum, upstreamRelease: "task3-release", publishedAt: null, license: "public", usageStatus: "approved" } });
  const seedTask3 = async (pool: Pool): Promise<string> => { const manifest = candidate(task3ReleaseId); await seedPrototypeManifest(pool, manifest, boundariesFor(manifest)); return manifest.sources[0]!.id; };
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
       const firstPage = await postgres.listSeatPage(loaded.release.id, { limit: 2, sort: "cash_on_hand", direction: "asc" });
       expect(firstPage.nextCursor).not.toBeNull();
       expect(firstPage.items.filter((seat) => seat.cashOnHand.kind === "value" || seat.cashOnHand.kind === "aggregate")).toHaveLength(2);
       const secondPage = await postgres.listSeatPage(loaded.release.id, { limit: 2, sort: "cash_on_hand", direction: "asc", cursor: firstPage.nextCursor! });
       const pageIds = [...firstPage.items, ...secondPage.items].map((seat) => seat.id);
       expect(new Set(pageIds).size).toBe(pageIds.length);
       const cashSeatIds = [...firstPage.items, ...secondPage.items]
         .filter((seat) => seat.cashOnHand.kind === "value" || seat.cashOnHand.kind === "aggregate")
         .map((seat) => seat.id);
       const expectedCashSeatIds = (await memory.listSeats(loaded.release.id, { sort: "cash_on_hand", direction: "asc" }))
         .filter((seat) => seat.cashOnHand.kind === "value" || seat.cashOnHand.kind === "aggregate")
         .map((seat) => seat.id);
       expect(cashSeatIds).toEqual(expectedCashSeatIds);
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
      for (const { name } of contentTableRegistry) {
        const guard = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=$1::regclass AND NOT t.tgisinternal AND p.proname IN ('guard_candidate_release_content','guard_nationwide_content')", [name]);
        expect(guard.rows[0]!.count).toBeGreaterThan(0);
      }
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

  it("persists supported manifest and ACS units while rejecting unsupported versions and units", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const releaseId = "rel_contract_units";
    try {
      const manifest = candidate(releaseId);
      await seedPrototypeManifest(pool, manifest, boundariesFor(manifest));
      expect((await pool.query("SELECT 'license_unavailable'::missing_reason AS reason")).rows[0]?.reason).toBe("license_unavailable");
      await pool.query("INSERT INTO acs_variables(release_id,id,variable,label,unit,survey_period,universe,definition_kind,census_variable,published_moe_method) VALUES($1,'acs_source_contract','source_contract','Source','count','contract','all','source','B01001','published')", [releaseId]);
      await pool.query("INSERT INTO acs_variables(release_id,id,variable,label,unit,survey_period,universe,definition_kind,derivation_formula_version,moe_propagation_method) VALUES($1,'acs_ratio_contract','ratio_contract','Ratio','percent','contract','all','derived_ratio','v1','delta_method')", [releaseId]);
      await expect(pool.query("INSERT INTO acs_variables(release_id,id,variable,label,unit,survey_period,universe,definition_kind,derivation_formula_version,moe_propagation_method) VALUES($1,'acs_invalid_contract','invalid_contract','Invalid','percent','contract','all','derived','v1','delta_method')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      expect((await pool.query("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId])).rows[0]?.schema_version).toBe(1);
      await pool.query("INSERT INTO release_manifests(release_id,schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256) VALUES($1,2,$2,$2,$2) ON CONFLICT (release_id) DO UPDATE SET schema_version=2", [releaseId, "a".repeat(64)]);
      expect((await pool.query("SELECT schema_version FROM release_manifests WHERE release_id=$1", [releaseId])).rows[0]?.schema_version).toBe(2);
      await expect(pool.query("UPDATE release_manifests SET schema_version=3 WHERE release_id=$1", [releaseId])).rejects.toMatchObject({ code: "23514" });

      const geographyId = manifest.geographyVersions[0]!.id;
      const values = [releaseId, geographyId, "contract_years", "Contract years", "years"];
      await pool.query("INSERT INTO acs_observations(release_id,geography_version_id,variable,label,estimate,estimate_missing_reason,margin_of_error,margin_of_error_missing_reason,unit,survey_period,universe,lineage_as_of,lineage_methodology,lineage_status) VALUES($1,$2,$3,$4,42,NULL,1,NULL,$5,'contract','all','2024-01-01','contract','reported')", values);
      expect((await pool.query<{ unit: string }>("SELECT unit FROM acs_observations WHERE release_id=$1 AND variable='contract_years'", [releaseId])).rows[0]?.unit).toBe("years");
      await expect(pool.query("UPDATE acs_observations SET unit='furlongs' WHERE release_id=$1 AND variable='contract_years'", [releaseId])).rejects.toMatchObject({ code: "23514" });
    } finally { await pool.end(); }
  });

  it("has exact final 0002 snapshot catalog signatures after migration", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const task2Tables = ["acs_variable_dependencies", "acs_variable_inputs", "acs_variables", "biographical_fact_provenance", "biographical_facts", "committee_assignment_provenance", "committee_assignments", "coverage_input_snapshots", "coverage_missing_reasons", "coverage_records", "election_decision_inputs", "election_decisions", "finance_aggregate_inputs", "finance_aggregates", "funding_category_aggregates", "funding_category_input_snapshots", "funding_organization_aggregates", "funding_organization_input_snapshots", "ingest_runs", "jurisdictions", "map_artifact_inputs", "map_artifacts", "nationwide_validation_gates", "outside_spending_aggregates", "outside_spending_input_snapshots", "quarantined_records", "release_content_digests", "snapshot_derivation_inputs", "snapshot_derivations", "stg_identity", "stg_tiger", "stg_acs", "stg_fec", "stg_elections", "seat_cycles", "people", "contests", "result_options", "election_results"];
    try {
      const snapshot = JSON.parse(await readFile(resolve(process.cwd(), "drizzle/meta/0002_snapshot.json"), "utf8")) as { tables: Record<string, { columns: Record<string, { name: string; type: string; notNull: boolean; primaryKey: boolean }>; compositePrimaryKeys: Record<string, { columns: string[] }>; foreignKeys: Record<string, { columnsFrom: string[]; columnsTo: string[]; tableTo: string; onDelete: string; onUpdate: string }>; checkConstraints: Record<string, { value: string }>; indexes: Record<string, { isUnique: boolean; method: string; columns: Array<{ expression: string; asc: boolean; nulls: string }>; where?: string }> }> };
      const normalize = (value: string) => {
        let normalized = value.toLowerCase().replace(/"/g, "").replace(/\s+/g, "").replace(/public\./g, "").replace(new RegExp(`(?:${task2Tables.join("|")})\\.`, "g"), "").replace(/::[a-z_]+/g, "").replace(/=any\(array\[/g, "in(").replace(/\]\)/g, ")").replace(/ondelete(?:noaction)?onupdate(?:noaction)?/g, "").replace(/(\w+)between(\w+)and(\w+)/g, "$1>=$2and$1<=$3").replace(/}$/, "");
        let simplified: string;
        do {
          simplified = normalized;
          normalized = normalized.replace(/\((?![^()]*(?:\band\b|\bor\b))([^()]*)\)/g, "$1");
        } while (normalized !== simplified);
        while (normalized.startsWith("check((") && normalized.endsWith("))")) normalized = `check(${normalized.slice(7, -1)}`;
        return normalized.replace(/}$/, "").replace(/checkallocation_coverage_percentisnullorallocation_coverage_percent>=0andallocation_coverage_percentisnullorallocation_coverage_percent<=100$/, "checkallocation_coverage_percentisnullorallocation_coverage_percent>=0andallocation_coverage_percent<=100");
      };
      const physicalNames: Record<string, string> = {
        seat_cycles_release_id_id_pk: "seat_cycles_pkey",
        people_release_id_id_pk: "people_pkey",
        contests_release_id_id_pk: "contests_pkey",
        result_options_release_id_id_pk: "result_options_pkey",
        election_results_release_id_contest_id_result_option_id_pk: "election_results_pkey",
        seat_cycles_release_id_data_releases_id_fk: "seat_cycles_release_id_fkey",
        seat_cycles_release_id_office_id_offices_release_id_id_fk: "seat_cycles_release_id_office_id_fkey",
        seat_cycles_release_id_office_term_id_office_terms_release_id_id_fk: "seat_cycles_release_id_office_term_id_fkey",
        seat_cycles_release_id_geography_version_id_geography_versions_release_id_id_fk: "seat_cycles_release_id_geography_version_id_fkey",
        people_release_id_data_releases_id_fk: "people_release_id_fkey",
        contests_release_id_data_releases_id_fk: "contests_release_id_fkey",
        contests_release_id_seat_cycle_id_seat_cycles_release_id_id_fk: "contests_release_id_seat_cycle_id_fkey",
        contests_release_id_geography_version_id_geography_versions_release_id_id_fk: "contests_release_id_geography_version_id_fkey",
        result_options_release_id_data_releases_id_fk: "result_options_release_id_fkey",
        result_options_release_id_contest_id_contests_release_id_id_fk: "result_options_release_id_contest_id_fkey",
        result_options_release_id_candidacy_id_contest_id_candidacies_release_id_id_contest_id_fk: "result_options_release_id_candidacy_id_contest_id_fkey",
        election_results_release_id_data_releases_id_fk: "election_results_release_id_fkey",
        election_results_release_id_contest_id_contests_release_id_id_fk: "election_results_release_id_contest_id_fkey",
        election_results_release_id_result_option_id_contest_id_result_options_release_id_id_contest_id_fk: "election_results_release_id_result_option_id_contest_id_fkey",
        seat_cycles_natural_uq: "seat_cycles_release_id_office_id_cycle_year_election_kind_key",
        result_options_contest_id_uq: "result_options_release_id_contest_id_id_key",
        contests_denominator_ck: "contests_check",
        contests_allocation_ck: "contests_check1",
        election_results_votes_ck: "election_results_check",
        biographical_fact_provenance_release_id_person_id_fact_effective_at_biographical_facts_release_id_person_id_fact_effective_at_fk: "biographical_fact_provenance_fact_fk",
        committee_assignment_provenance_release_id_person_id_committee_id_role_name_effective_from_committee_assignments_release_id_person_id_committee_id_role_effective_from_fk: "committee_assignment_provenance_assignment_fk",
        funding_category_input_snapshots_release_id_seat_cycle_id_category_coverage_through_methodology_version_funding_category_aggregates_release_id_seat_cycle_id_category_coverage_through_methodology_version_fk: "funding_category_input_snapshots_aggregate_fk",
        outside_spending_input_snapshots_release_id_seat_cycle_id_coverage_through_methodology_version_outside_spending_aggregates_release_id_seat_cycle_id_coverage_through_methodology_version_fk: "outside_spending_input_snapshots_aggregate_fk",
      };
      const physicalName = (name: string) => physicalNames[name] ?? name.slice(0, 63);
      const catalog = await pool.query<{ table_name: string; object_name: string; object_type: string; definition: string }>("SELECT c.relname table_name, con.conname object_name, con.contype::text object_type, pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' UNION ALL SELECT c.relname, i.relname, 'i', pg_get_indexdef(i.oid) FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT x.indisprimary");
      const actual = new Map(catalog.rows.map((row) => [`${row.table_name}:${row.object_name}`, row]));
      const expected = task2Tables.flatMap((table) => { const d = snapshot.tables[`public.${table}`]!; const inlinePrimaryKeys = Object.values(d.columns).filter((column) => column.primaryKey).map((column) => column.name); return [...(inlinePrimaryKeys.length ? [[table, `${table}_pkey`, `PRIMARY KEY (${inlinePrimaryKeys.join(",")})`]] : []), ...Object.entries(d.compositePrimaryKeys).map(([name, v]) => [table, name, `PRIMARY KEY (${v.columns.join(",")})`]), ...Object.entries(d.foreignKeys).map(([name, v]) => [table, name, `FOREIGN KEY (${v.columnsFrom.join(",")}) REFERENCES ${v.tableTo}(${v.columnsTo.join(",")}) ON DELETE ${v.onDelete} ON UPDATE ${v.onUpdate}`]), ...Object.entries(d.checkConstraints).map(([name, v]) => [table, name, `CHECK (${v.value})`]), ...Object.entries(d.indexes).map(([name, v]) => [table, name, `CREATE ${v.isUnique ? "UNIQUE " : ""}INDEX ${physicalName(name)} ON ${table} USING ${v.method} (${v.columns.map((c) => `${c.expression}${c.asc ? "" : " DESC"}${c.nulls === (c.asc ? "last" : "first") ? "" : ` NULLS ${c.nulls.toUpperCase()}`}`).join(",")})${v.where ? ` WHERE ${v.where}` : ""}`])]; });
      expect(new Set(expected.map(([table, name]) => `${table}:${physicalName(name as string)}`)).size).toBe(expected.length);
      for (const [table, name, signature] of expected) expect(normalize(actual.get(`${table}:${physicalName(name as string)}`)?.definition ?? ""), `${table}:${name}`).toBe(normalize(signature));
      expect(expected.length).toBeGreaterThan(0);
    } finally { await pool.end(); }
  });

  it("enforces the ingest-run lifecycle and candidate-only operational rows", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const releaseId = "rel_contract_ingest";
    try {
      const manifest = candidate(releaseId);
      await seedPrototypeManifest(pool, manifest, boundariesFor(manifest));
      await expect(pool.query("INSERT INTO jurisdictions(release_id,jurisdiction_code,house_representation,senate_representation) VALUES($1,'XX','invalid','two_seats')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO jurisdictions(release_id,jurisdiction_code,house_representation,senate_representation) VALUES($1,'XY','voting','invalid')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      const insertRun = "INSERT INTO ingest_runs(id,release_id,source_id,adapter_version,started_at,completed_at,status,extracted_count,staged_count,quarantined_count) VALUES($1,$2,$3,'contract',now(),now(),$4,1,0,0)";
      for (const status of ["validated", "loaded", "failed"]) await expect(pool.query(insertRun, [`run_direct_${status}`, releaseId, manifest.sources[0]!.id, status])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO ingest_runs(id,release_id,source_id,adapter_version,started_at,completed_at,status,extracted_count,staged_count,quarantined_count) VALUES($1,$2,$3,'contract',now(),NULL,'running',1,1,0)", ["run_direct_staged", releaseId, manifest.sources[0]!.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO ingest_runs(id,release_id,source_id,adapter_version,started_at,completed_at,status,extracted_count,staged_count,quarantined_count) VALUES($1,$2,$3,'contract',now(),NULL,'running',1,0,1)", ["run_direct_quarantined", releaseId, manifest.sources[0]!.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO ingest_runs(id,release_id,source_id,adapter_version,started_at,completed_at,status,extracted_count,staged_count,quarantined_count) VALUES($1,$2,$3,'contract',now(),NULL,'running',1,0,0)", ["run_direct_running", releaseId, manifest.sources[0]!.id])).rejects.toMatchObject({ code: "23514" });
      const contractRun = strictRun("run_contract", releaseId, manifest.sources[0]!.id, 3);
      await startIngestRun(pool, contractRun);
      await expect(heartbeat(pool, "run_contract", contractRun.leaseToken, contractRun.leaseDurationMs)).resolves.toBeUndefined();
      await expect(failExpiredRun(pool, "run_contract", contractRun.leaseToken)).rejects.toThrow();
      expect((await pool.query<{ staged_count: number; quarantined_count: number }>("SELECT staged_count,quarantined_count FROM ingest_runs WHERE id='run_contract'")).rows[0]).toEqual({ staged_count: 0, quarantined_count: 0 });
      await recordStageBatch(pool, "run_contract", contractRun.leaseToken, 2, contractRun.leaseDurationMs);
      await recordQuarantineBatch(pool, "run_contract", contractRun.leaseToken, 1, contractRun.leaseDurationMs);
      await expect(recordStageBatch(pool, "run_contract", contractRun.leaseToken, 1, contractRun.leaseDurationMs)).rejects.toThrow();
      await expect(pool.query("UPDATE ingest_runs SET staged_count=1 WHERE id='run_contract'")).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE ingest_runs SET extracted_count=2 WHERE id='run_contract'")).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO quarantined_records(run_id,release_id,source_natural_key,snapshot_id,payload_checksum,parser_error_code,redacted_diagnostic) VALUES('run_contract',$1,'secret','snap_1',$2,'parse','contributor@example.test')", [releaseId, "b".repeat(64)])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO quarantined_records(run_id,release_id,source_natural_key,snapshot_id,payload_checksum,parser_error_code,redacted_diagnostic) VALUES('run_contract',$1,'address','snap_1',$2,'parse','street address omitted')", [releaseId, "c".repeat(64)])).rejects.toMatchObject({ code: "23514" });
      await expect(markValidated(pool, "run_contract", contractRun.leaseToken)).resolves.toBeUndefined();
      await expect(markLoaded(pool, "run_contract", contractRun.leaseToken)).resolves.toBeUndefined();
      await expect(pool.query("INSERT INTO stg_identity(run_id,release_id,source_natural_key,snapshot_id,entity_id,source_entity_id,display_name) VALUES('run_contract',$1,'loaded-write','snap_1','entity','source','Name')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO quarantined_records(run_id,release_id,source_natural_key,snapshot_id,payload_checksum,parser_error_code,redacted_diagnostic) VALUES('run_contract',$1,'loaded-write','snap_1',$2,'parse','redacted')", [releaseId, "e".repeat(64)])).rejects.toMatchObject({ code: "23514" });
      await expect(markFailed(pool, "run_contract", contractRun.leaseToken)).rejects.toThrow();
      await expect(pool.query("UPDATE ingest_runs SET status='loaded' WHERE id='run_contract'")).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE ingest_runs SET source_id='rewritten' WHERE id='run_contract'")).rejects.toMatchObject({ code: "23514" });
      await expect(startIngestRun(pool, strictRun("run_wrong_source", releaseId, "not_this_release", 0))).rejects.toThrow();

      const failedRun = { ...strictRun("run_failed", releaseId, manifest.sources[0]!.id, 1), adapterVersion: "contract-failed" };
      await startIngestRun(pool, failedRun);
      await expect(markFailed(pool, "run_failed", failedRun.leaseToken)).resolves.toBeUndefined();
      await expect(pool.query("INSERT INTO stg_acs(run_id,release_id,source_natural_key,snapshot_id,geography,variable,survey_period,unit) VALUES('run_failed',$1,'failed-write','snap_1','geo','var','2024','count')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      await expect(recordQuarantineBatch(pool, "run_failed", failedRun.leaseToken, 1, failedRun.leaseDurationMs)).rejects.toThrow();
      await promoteCandidateRelease(pool, releaseId);
      await expect(pool.query("INSERT INTO stg_identity(run_id,release_id,source_natural_key,snapshot_id,entity_id,source_entity_id,display_name) VALUES('run_contract',$1,'published-write','snap_1','entity','source','Name')", [releaseId])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("INSERT INTO quarantined_records(run_id,release_id,source_natural_key,snapshot_id,payload_checksum,parser_error_code,redacted_diagnostic) VALUES('run_contract',$1,'published-write','snap_1',$2,'parse','redacted')", [releaseId, "d".repeat(64)])).rejects.toMatchObject({ code: "23514" });
    } finally { await pool.end(); }
  });

  it("baselines every registered v1 row with release-independent canonical domain digests", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const sourceId = "rel_contract_baseline_source";
    const targetId = "rel_contract_baseline_target";
    try {
      const source = candidate(sourceId);
      const target = candidate(targetId);
      target.release = { ...target.release, label: "Baselined v1 candidate", sourceCutoff: source.release.sourceCutoff, createdAt: "2025-01-02T00:00:00.000Z" };
      await seedPrototypeManifest(pool, source, boundariesFor(source));
      await promoteCandidateRelease(pool, sourceId);
      await pool.query("INSERT INTO data_releases (id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [target.release.id, target.release.label, target.release.status, target.release.sourceCutoff, target.release.createdAt, target.release.publishedAt, target.release.previousReleaseId]);
      await baselineCandidateRelease(pool, sourceId, targetId);
      const loaded = await loadPrototypeManifest(pool, targetId);
      expect(loaded.release).toMatchObject({ id: targetId, label: target.release.label, status: "candidate" });
      expect(computeCanonicalDataChecksum(loaded)).toBe((await pool.query<{ canonical_data_checksum_sha256: string }>("SELECT canonical_data_checksum_sha256 FROM release_manifests WHERE release_id=$1", [targetId])).rows[0]!.canonical_data_checksum_sha256);
      for (const table of Object.values(contentDomains).flat()) {
        const sourceCount = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table} WHERE release_id=$1`, [sourceId]);
        const targetCount = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table} WHERE release_id=$1`, [targetId]);
        expect(targetCount.rows[0]!.count).toBe(sourceCount.rows[0]!.count);
      }
      await pool.query("SET TIME ZONE 'America/Los_Angeles'");
      for (const domain of Object.keys(contentDomains) as Array<keyof typeof contentDomains>) {
        expect(await computeReleaseDigest(pool, targetId, domain)).toEqual(await computeReleaseDigest(pool, sourceId, domain));
      }
      expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM sources WHERE release_id=$1", [targetId])).rows[0]!.count).toBeGreaterThan(0);
      await expect(baselineCandidateRelease(pool, sourceId, targetId)).rejects.toThrow();
    } finally { await pool.end(); }
  });

  it("rejects a v1 baseline with a different cutoff before copying content", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const sourceId = "rel_contract_baseline_cutoff_source";
    const targetId = "rel_contract_baseline_cutoff_target";
    try {
      const source = candidate(sourceId);
      const target = candidate(targetId);
      target.release = { ...target.release, label: "Mismatched v1 candidate", sourceCutoff: "2025-01-01T00:00:00.000Z" };
      await seedPrototypeManifest(pool, source, boundariesFor(source));
      await promoteCandidateRelease(pool, sourceId);
      await pool.query("INSERT INTO data_releases (id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES ($1,$2,$3,$4,$5,$6,$7)", [target.release.id, target.release.label, target.release.status, target.release.sourceCutoff, target.release.createdAt, target.release.publishedAt, target.release.previousReleaseId]);
      await expect(baselineCandidateRelease(pool, sourceId, targetId)).rejects.toThrow("candidate source cutoff to equal the source release cutoff");
      expect((await pool.query("SELECT 1 FROM release_manifests WHERE release_id=$1", [targetId])).rowCount).toBe(0);
      for (const table of contentTableRegistry) expect((await pool.query(`SELECT 1 FROM ${table.name} WHERE release_id=$1 LIMIT 1`, [targetId])).rowCount).toBe(0);
    } finally { await pool.end(); }
  });

  it("requires a complete, content-bound nationwide validation gate before v2 can promote", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const { manifest, bundle } = persistedNationwideSkeleton();
      await seedNationwideCandidateManifest(pool, manifest, bundle);
      expect((await loadNationwideManifest(pool, manifest.release.id)).biographicalFacts.find((fact) => fact.fact === "birth_date")?.value).toEqual({ kind: "value", value: "1970-01-02" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await validateNationwideCandidateReleaseWithClient(client, manifest.release.id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { client.release(); }
      const before = await pool.query("SELECT row_to_json(g) gate, (SELECT jsonb_agg(row_to_json(d) ORDER BY d.domain) FROM release_content_digests d WHERE d.release_id=$1) digests FROM nationwide_validation_gates g WHERE g.release_id=$1", [manifest.release.id]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).resolves.toBeUndefined();
      const after = await pool.query("SELECT row_to_json(g) gate, (SELECT jsonb_agg(row_to_json(d) ORDER BY d.domain) FROM release_content_digests d WHERE d.release_id=$1) digests FROM nationwide_validation_gates g WHERE g.release_id=$1", [manifest.release.id]);
      expect(after.rows).toEqual(before.rows);

      await pool.query("DELETE FROM nationwide_validation_gates WHERE release_id=$1", [manifest.release.id]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await pool.query("UPDATE nationwide_validation_gates SET domain_checksum_sha256=$2 WHERE release_id=$1", [manifest.release.id, "f".repeat(64)]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await pool.query("DELETE FROM release_content_digests WHERE release_id=$1 AND domain='maps'", [manifest.release.id]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await expect(pool.query("INSERT INTO release_content_digests(release_id,domain,row_count,sha256,validated_at) VALUES($1,'forged',0,$2,now())", [manifest.release.id, "a".repeat(64)])).rejects.toMatchObject({ code: "23514" });
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).resolves.toBeUndefined();
      await pool.query("UPDATE release_content_digests SET sha256=$2 WHERE release_id=$1 AND domain='maps'", [manifest.release.id, "b".repeat(64)]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await pool.query("UPDATE sources SET name='semantic corruption' WHERE release_id=$1", [manifest.release.id]);
      await expect(recheckNationwideValidationGate(pool, manifest.release.id)).rejects.toThrow();
      await expect(promoteCandidateRelease(pool, manifest.release.id)).rejects.toThrow();
    } finally { await pool.end(); }
  }, 60_000);

  it("publishes, rolls back, and rolls forward a validated nationwide release through the repository page", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const v1 = candidate("rel_task5_v1");
      const { manifest: v2, bundle } = persistedNationwideSkeleton();
      await seedPrototypeManifest(pool, v1, boundariesFor(v1));
      await promoteCandidateRelease(pool, v1.release.id);
      await seedNationwideCandidateManifest(pool, v2, bundle);
      await expect(promoteCandidateRelease(pool, v2.release.id)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, v2.release.id);
      await promoteCandidateRelease(pool, v2.release.id);

      const repository = new PostgresSeatResearchRepository(pool);
      expect(await repository.getActiveRelease()).toMatchObject({ id: v2.release.id, status: "published" });
      const expectedSeatIds = new Set(v2.seatCycles.map((cycle) => cycle.id));
      const expectedVacancies = v2.seatCycles.filter((cycle) => cycle.occupancy.status === "vacant");
      expect(expectedSeatIds.size).toBe(541);
      expect(expectedVacancies).toHaveLength(4);

      // A non-dividing page size makes both the final page and each keyset hand-off
      // observable against the real nationwide SQL projection.
      const pageAll = async (sort: "state" | "cash_on_hand" | "presidential_margin_2024", direction: "asc" | "desc", request: Record<string, unknown> = {}) => {
        const items = []; let cursor: string | undefined;
        for (;;) {
          const page = await repository.listSeatPage(v2.release.id, { sort, direction, limit: 100, ...request, ...(cursor ? { cursor } : {}) } as never);
          expect(page).toMatchObject({ releaseId: v2.release.id, total: expectedSeatIds.size });
          items.push(...page.items);
          if (page.nextCursor === null) return items;
          cursor = page.nextCursor;
        }
      };
      const stateItems = await pageAll("state", "asc");
      expect(stateItems).toHaveLength(expectedSeatIds.size);
      expect(new Set(stateItems.map((item) => item.id))).toEqual(expectedSeatIds);
      expect(stateItems.filter((item) => expectedVacancies.some((cycle) => cycle.id === item.id)).every((item) => item.incumbentName === null && item.incumbentParty === null)).toBe(true);

      // There are no presidential data rows in this manifest and no usable cash
      // values.  Every null sort key must retain the bytewise ascending seat-id tie
      // regardless of direction.
      for (const sort of ["presidential_margin_2024", "cash_on_hand"] as const) for (const direction of ["asc", "desc"] as const) {
        const items = await pageAll(sort, direction);
        expect(items.map((item) => item.id)).toEqual([...items.map((item) => item.id)].sort());
      }
      for (const item of stateItems) {
        expect(item.presidentialMargin2024).toMatchObject({ kind: "coverage_missing", value: { kind: "missing", reason: "not_collected" }, reason: "not_collected", methodology: "coverage_missing", status: "reported" });
        expect(item.cashOnHand.kind).toBe("missing");
        if (item.cashOnHand.kind === "missing") expect(item.cashOnHand.reason).toBe("not_collected");
      }

      const delegate = v2.seatCycles.find((cycle) => v2.offices.find((office) => office.id === cycle.officeId)?.kind === "house_delegate")!;
      const residentCommissioner = v2.seatCycles.find((cycle) => v2.offices.find((office) => office.id === cycle.officeId)?.kind === "resident_commissioner")!;
      const senate = v2.seatCycles.find((cycle) => v2.offices.find((office) => office.id === cycle.officeId)?.chamber === "senate")!;
      const identity = stateItems.find((item) => item.id === delegate.id)!;
      for (const [field, value] of [["identitySearch", identity.label], ["identitySearch", identity.stateCode], ["identitySearch", identity.districtCode], ["identitySearch", identity.incumbentName]] as const) {
        const page = await repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 100, [field]: value! });
        expect(page.items.map((item) => item.id)).toContain(delegate.id);
      }
      const expectedFilterTotals = [
        [{ chamber: "house" }, v2.offices.filter((office) => office.chamber === "house").length],
        [{ chamber: "senate" }, v2.offices.filter((office) => office.chamber === "senate").length],
        [{ stateCode: identity.stateCode }, v2.offices.filter((office) => office.stateCode === identity.stateCode).length],
        [{ party: "other" }, v2.memberships.length],
        [{ incumbencyStatus: "unknown" }, v2.seatCycles.filter((cycle) => cycle.incumbencyStatus === "unknown").length],
        [{ electionYear: 2024 }, v2.seatCycles.filter((cycle) => cycle.cycleYear === 2024).length],
      ] as const;
      for (const [request, total] of expectedFilterTotals) expect((await repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 100, ...request })).total).toBe(total);
      expect((await repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 100, identitySearch: "synthetic demographic only" })).total).toBe(0);
      expect(stateItems.map((item) => item.id)).toContain(senate.id);
      expect(stateItems.map((item) => item.id)).toContain(residentCommissioner.id);

      expect(await repository.getSeatListItem(v2.release.id, delegate.id)).toMatchObject({ id: delegate.id, chamber: "house" });
      expect(await repository.getSeatListItem(v2.release.id, "seat_missing" as never)).toBeNull();
      const delegateProfile = await repository.getSeatProfile(v2.release.id, delegate.id);
      const vacancyProfile = await repository.getSeatProfile(v2.release.id, expectedVacancies[0]!.id);
      const expectedClosure = [...new Set([...(delegate.provenance ?? []).map((ref) => ref.snapshotId), ...(v2.offices.find((office) => office.id === delegate.officeId)!.provenance ?? []).map((ref) => ref.snapshotId), ...v2.coverageRecords.filter((record) => record.domain === "election_2024" || (record.domain === "finance" && record.scope.kind === "funding" && record.scope.seatCycleId === delegate.id)).flatMap((record) => record.inputSnapshotIds)])].sort();
      expect(delegateProfile).toMatchObject({ office: { id: delegate.officeId, kind: "house_delegate" }, seatCycle: { id: delegate.id }, contests: [], demographics: [], finance: [] });
      expect(delegateProfile?.snapshots.map((snapshot) => snapshot.id)).toEqual(expectedClosure);
      expect(delegateProfile?.sources).toEqual(v2.sources);
      const vacancy = expectedVacancies[0]!;
      // Vacancy suppresses only the incumbent identity. Its independently sourced
      // contest and finance facts remain visible, exactly as in the manifest projection.
      expect(vacancyProfile).toMatchObject({ membership: null, incumbent: null, contests: v2.contests.filter((contest) => contest.seatCycleId === vacancy.id), demographics: v2.acsObservations.filter((observation) => observation.geographyVersionId === vacancy.geographyVersionId), finance: v2.fecFilingSummaries.filter((summary) => summary.seatCycleId === vacancy.id) });
      expect(await repository.listSources(v2.release.id)).toEqual(v2.sources);
      expect(await repository.listSourceSnapshots(v2.release.id)).toEqual([...v2.snapshots].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      expect(await repository.getSeatFacets(v2.release.id)).toEqual({ states: [...new Set(v2.offices.map((office) => office.stateCode))].sort(), parties: ["other"], incumbencyStatuses: ["unknown"], electionYears: [2024] });

      const first = await repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 37 });
      await expect(repository.listSeatPage(v1.release.id, { sort: "state", direction: "asc", limit: 37, cursor: first.nextCursor! })).rejects.toThrow("does not match");
      await expect(repository.listSeatPage(v2.release.id, { sort: "state", direction: "desc", limit: 37, cursor: first.nextCursor! })).rejects.toThrow("does not match");
      await expect(repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 37, cursor: "not-a-cursor" })).rejects.toThrow();
      expect(await repository.listSeatPage("rel_missing" as never, { sort: "state", direction: "asc", limit: 37 })).toMatchObject({ total: 0, items: [], nextCursor: null });
      await expect(rollbackPublishedRelease(pool)).resolves.toEqual({ publishedReleaseId: v1.release.id, retiredReleaseId: v2.release.id });
      await expect(rollForwardRetiredRelease(pool, v2.release.id)).resolves.toEqual({ publishedReleaseId: v2.release.id, retiredReleaseId: v1.release.id });
      expect(await repository.getActiveRelease()).toMatchObject({ id: v2.release.id, status: "published" });
      expect((await repository.listSeatPage(v2.release.id, { sort: "state", direction: "asc", limit: 25 })).total).toBe(541);

      const unrelated = candidate("rel_task5_unrelated");
      await seedPrototypeManifest(pool, unrelated, boundariesFor(unrelated));
      await promoteCandidateRelease(pool, unrelated.release.id);
      await expect(rollForwardRetiredRelease(pool, v1.release.id)).rejects.toThrow(/direct successor/);
    } finally { await pool.end(); }
  }, 60_000);

  it("baselines a validated v2 candidate with rewritten release metadata and a fresh gate", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const { manifest, bundle } = persistedNationwideSkeleton();
      const targetId = "rel_synthetic_baseline";
      await seedNationwideCandidateManifest(pool, manifest, bundle);
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,'Baselined nationwide candidate','candidate',$2,$3,NULL,NULL)", [targetId, manifest.release.sourceCutoff, "2024-01-03T00:00:00.000Z"]);
      await baselineCandidateRelease(pool, manifest.release.id, targetId);
      const loaded = await loadNationwideManifest(pool, targetId);
      expect(loaded.release).toMatchObject({ id: targetId, label: "Baselined nationwide candidate", status: "candidate", sourceCutoff: manifest.release.sourceCutoff, createdAt: "2024-01-03T00:00:00.000Z" });
      expect(loaded.biographicalFacts.find((fact) => fact.fact === "birth_date")!.value).toEqual({ kind: "value", value: "1970-01-02" });
      for (const domain of Object.keys(contentDomains) as Array<keyof typeof contentDomains>) expect(await computeReleaseDigest(pool, targetId, domain)).toEqual(await computeReleaseDigest(pool, manifest.release.id, domain));
      await expect(recheckNationwideValidationGate(pool, targetId)).rejects.toThrow();
      await validateNationwideCandidateRelease(pool, targetId);
      await expect(recheckNationwideValidationGate(pool, targetId)).resolves.toBeUndefined();
    } finally { await pool.end(); }
  }, 60_000);

  it("atomically enriches a same-cutoff v2 baseline from locked member identities", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const { manifest, bundle } = persistedNationwideSkeleton();
      manifest.biographicalFacts = [];
      manifest.committeeAssignments = [];
      Object.assign(manifest.coverageRecords.find((record) => record.domain === "member")!, { status: "not_collected", expectedCount: 537, observedCount: 0, missingByReason: [{ reason: "not_collected", count: 537 }] });
      manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
      await seedNationwideCandidateManifest(pool, manifest, bundle);
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await promoteCandidateRelease(pool, manifest.release.id);
      const targetId = "rel_member_enrichment";
      await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,'Member enrichment','candidate',$2,$3,NULL,$4)", [targetId, manifest.release.sourceCutoff, "2024-01-03T00:00:00.000Z", manifest.release.id]);
      await enrichCandidateMembersFromBaseline(pool, manifest.release.id, targetId);
      const loaded = await loadNationwideManifest(pool, targetId);
      expect(loaded.release.status).toBe("candidate");
      expect(loaded.biographicalFacts).toHaveLength(1074);
      expect(loaded.committeeAssignments).toHaveLength(0);
      expect(loaded.coverageRecords.find((record) => record.domain === "member" && record.scope.kind === "release")).toMatchObject({ status: "complete", expectedCount: 537, observedCount: 537, missingByReason: [], quarantinedCount: 0, incompatibleCount: 0 });
      expect((await pool.query("SELECT domain FROM release_content_digests WHERE release_id=$1", [targetId])).rowCount).toBe(7);
      await expect(recheckNationwideValidationGate(pool, targetId)).resolves.toBeUndefined();
      expect((await loadNationwideManifest(pool, manifest.release.id)).biographicalFacts).toHaveLength(0);
      await expect(verifyPersistedTask6MemberCandidate(pool, targetId, manifest.release.id)).resolves.toEqual({ observed: 537, expected: 537, biographicalFactCount: 1074, committeeAssignmentCount: 0 });
      // Queue the verifier ahead of a writer on the release row.  Releasing the
      // holder lets PostgreSQL grant the verifier's lock first; the writer cannot
      // interleave between its gate recheck and invariant read.
      const holder = await pool.connect();
      await holder.query("BEGIN");
      await holder.query("SELECT 1 FROM data_releases WHERE id=$1 FOR UPDATE", [targetId]);
      let verified = false;
      const verification = verifyPersistedTask6MemberCandidate(pool, targetId, manifest.release.id).then((value) => { verified = true; return value; });
      const mutation = pool.query("UPDATE data_releases SET label=label WHERE id=$1", [targetId]);
      await Promise.resolve();
      expect(verified).toBe(false);
      await holder.query("COMMIT");
      holder.release();
      await expect(verification).resolves.toMatchObject({ observed: 537 });
      await expect(mutation).resolves.toMatchObject({ rowCount: 1 });
      const tampered = async (id: string): Promise<void> => {
        await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,$2,'candidate',$3,$4,NULL,$5)", [id, id, manifest.release.sourceCutoff, "2024-01-03T00:00:00.000Z", manifest.release.id]);
        await enrichCandidateMembersFromBaseline(pool, manifest.release.id, id);
      };
      const exactDobId = "rel_member_enrichment_exact_dob";
      await tampered(exactDobId);
      await pool.query("UPDATE biographical_facts SET value='1970-01-02',value_missing_reason=NULL WHERE ctid IN (SELECT ctid FROM biographical_facts WHERE release_id=$1 AND fact='birth_date' LIMIT 1)", [exactDobId]);
      await expect(assertPersistedTask6MemberInvariant(pool, exactDobId, manifest.release.id)).rejects.toThrow("Persisted Task 6");
      const provenanceMismatchId = "rel_member_enrichment_provenance_mismatch";
      await tampered(provenanceMismatchId);
      await pool.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain='member'", [provenanceMismatchId]);
      await expect(assertPersistedTask6MemberInvariant(pool, provenanceMismatchId, manifest.release.id)).rejects.toThrow("Persisted Task 6");
      const unrelatedSnapshotId = "snap_task6_unrelated";
      const unrelatedProvenanceId = "rel_member_enrichment_unrelated_provenance";
      await tampered(unrelatedProvenanceId);
      await pool.query("INSERT INTO source_snapshots(release_id,id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) SELECT $1,$2,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,'approved' FROM source_snapshots WHERE release_id=$1 LIMIT 1", [unrelatedProvenanceId, unrelatedSnapshotId]);
      await pool.query("INSERT INTO biographical_fact_provenance(release_id,person_id,fact,effective_at,snapshot_id,role) SELECT release_id,person_id,fact,effective_at,$2,role FROM biographical_fact_provenance WHERE release_id=$1 LIMIT 1", [unrelatedProvenanceId, unrelatedSnapshotId]);
      await pool.query("INSERT INTO coverage_input_snapshots(release_id,domain,scope_key,snapshot_id) SELECT release_id,domain,scope_key,$2 FROM coverage_records WHERE release_id=$1 AND domain='member' AND scope_kind='release'", [unrelatedProvenanceId, unrelatedSnapshotId]);
      await expect(assertPersistedTask6MemberInvariant(pool, unrelatedProvenanceId, manifest.release.id)).rejects.toThrow("Persisted Task 6");
      const bioguideMismatchId = "rel_member_enrichment_bioguide_mismatch";
      await tampered(bioguideMismatchId);
      const mismatchedPerson = (await pool.query<{ person_id: string }>("SELECT person_id FROM biographical_facts WHERE release_id=$1 AND fact='bioguide_id' LIMIT 1", [bioguideMismatchId])).rows[0]!.person_id;
      await pool.query("UPDATE people SET bioguide_id='B999999' WHERE release_id=$1 AND id=$2", [bioguideMismatchId, mismatchedPerson]);
      await pool.query("UPDATE biographical_facts SET value='B999999' WHERE release_id=$1 AND person_id=$2 AND fact='bioguide_id'", [bioguideMismatchId, mismatchedPerson]);
      await expect(assertPersistedTask6MemberInvariant(pool, bioguideMismatchId, manifest.release.id)).rejects.toThrow("Persisted Task 6");
      expect((await loadNationwideManifest(pool, manifest.release.id)).biographicalFacts).toHaveLength(0);
      await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES('rel_member_enrichment_bad','Bad','candidate',$1,$2,NULL,NULL)", ["2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"]);
      await expect(enrichCandidateMembersFromBaseline(pool, manifest.release.id, "rel_member_enrichment_bad")).rejects.toThrow();
      expect((await pool.query("SELECT 1 FROM sources WHERE release_id='rel_member_enrichment_bad' LIMIT 1")).rowCount).toBe(0);
    } finally { await pool.end(); }
  }, 60_000);

  it("rejects a nationwide baseline with a different cutoff before copying content", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const { manifest, bundle } = persistedNationwideSkeleton();
      const targetId = "rel_synthetic_baseline_cutoff_mismatch";
      await seedNationwideCandidateManifest(pool, manifest, bundle);
      await validateNationwideCandidateRelease(pool, manifest.release.id);
      await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,'Mismatched nationwide candidate','candidate',$2,$3,NULL,NULL)", [targetId, "2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"]);
      await expect(baselineCandidateRelease(pool, manifest.release.id, targetId)).rejects.toThrow("candidate source cutoff to equal the source release cutoff");
      expect((await pool.query("SELECT 1 FROM release_manifests WHERE release_id=$1", [targetId])).rowCount).toBe(0);
      for (const table of contentTableRegistry) expect((await pool.query(`SELECT 1 FROM ${table.name} WHERE release_id=$1 LIMIT 1`, [targetId])).rowCount).toBe(0);
    } finally { await pool.end(); }
  }, 60_000);

  it("persists canonical coverage scope keys and rejects tampering", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const { manifest, bundle } = persistedNationwideSkeleton();
      await seedNationwideCandidateManifest(pool, manifest, bundle);
      const stored = await pool.query<{ domain: string; scope_key: string }>("SELECT domain,scope_key FROM coverage_records WHERE release_id=$1", [manifest.release.id]);
      expect(stored.rows).toHaveLength(manifest.coverageRecords.length);
      for (const record of manifest.coverageRecords) expect(stored.rows).toContainEqual({ domain: record.domain, scope_key: canonicalCoverageScopeKey(record.scope) });
      await expect(pool.query("UPDATE coverage_records SET scope_key='' WHERE ctid=(SELECT ctid FROM coverage_records WHERE release_id=$1 LIMIT 1)", [manifest.release.id])).rejects.toMatchObject({ code: "23514" });
      const record = manifest.coverageRecords[0]!;
      const scopeKey = canonicalCoverageScopeKey(record.scope);
      await pool.query("DELETE FROM coverage_input_snapshots WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [manifest.release.id, record.domain, scopeKey]);
      await pool.query("DELETE FROM coverage_missing_reasons WHERE release_id=$1 AND domain=$2 AND scope_key=$3", [manifest.release.id, record.domain, scopeKey]);
      await pool.query("UPDATE coverage_records SET scope_key='tampered' WHERE release_id=$1 AND domain=$2", [manifest.release.id, record.domain]);
      await expect(loadNationwideManifest(pool, manifest.release.id)).rejects.toThrow("coverage scope key mismatch");
    } finally { await pool.end(); }
  });

  it("Task 3 persists successful staged facts and resumes a dry run", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw(); const adapter = task3Adapter(raw, [{ key: "identity-1", entity: "entity-1" }]);
      const first = await runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") });
      expect(first.runIds).toHaveLength(1);
      expect((await pool.query("SELECT status,staged_count,quarantined_count FROM ingest_runs WHERE id=$1", [first.runIds[0]])).rows[0]).toEqual({ status: "loaded", staged_count: 1, quarantined_count: 0 });
      expect((await pool.query("SELECT entity_id FROM stg_identity WHERE run_id=$1", [first.runIds[0]])).rows).toEqual([{ entity_id: "entity-1" }]);
      expect((await pool.query("SELECT id,display_name FROM people WHERE release_id=$1 AND id='task3_entity-1'", [task3ReleaseId])).rows).toEqual([{ id: "task3_entity-1", display_name: "Fixture" }]);
    } finally { await pool.end(); }
  });

  it("Task 3 dry-run validates then real rerun resumes without parsing or staging", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw(); let parsed = 0; let staged = 0; const base = task3Adapter(raw, [{ key: "identity-1", entity: "entity-1" }]);
      const adapter = { ...base, async *parse(value: RawObject<null>) { parsed += 1; yield* base.parse(value); }, async stage(client: PoolClient, id: string, rows: readonly IdentityRow[]) { staged += 1; await base.stage(client, id, rows); } };
      const dry = await runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z"), dryRun: true });
      expect((await pool.query("SELECT status FROM ingest_runs WHERE id=$1", [dry.runIds[0]])).rows[0]).toEqual({ status: "validated" });
      await runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") });
      expect({ parsed, staged }).toEqual({ parsed: 1, staged: 1 });
      expect((await pool.query("SELECT status FROM ingest_runs WHERE id=$1", [dry.runIds[0]])).rows[0]).toEqual({ status: "loaded" });
    } finally { await pool.end(); }
  });

  it("Task 3 rolls back content and validation when loading fails", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw("snap_load_failure", "9".repeat(64));
      await expect(runSource(task3Adapter(raw, [{ key: "identity-load", entity: "load" }], { loadError: true }), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("Ingestion failed");
      expect((await pool.query("SELECT status FROM ingest_runs")).rows).toEqual([{ status: "failed" }]);
      expect((await pool.query("SELECT id FROM people WHERE release_id=$1 AND id='task3_load'", [task3ReleaseId])).rows).toEqual([]);
    } finally { await pool.end(); }
  });

  it("Task 3 loaded reuse is read-only and rejects conflicting snapshots", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw(); const adapter = task3Adapter(raw, [{ key: "identity-1", entity: "entity-1" }]); const first = await runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") });
      const before = await pool.query("SELECT (SELECT count(*) FROM source_snapshots WHERE release_id=$1) snapshots,(SELECT count(*) FROM stg_identity WHERE run_id=$2) facts", [task3ReleaseId, first.runIds[0]]);
      await expect(runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).resolves.toEqual({ runIds: [], reusedRunIds: first.runIds });
      expect(await pool.query("SELECT (SELECT count(*) FROM source_snapshots WHERE release_id=$1) snapshots,(SELECT count(*) FROM stg_identity WHERE run_id=$2) facts", [task3ReleaseId, first.runIds[0]])).toEqual(before);
      const conflicting = { ...raw, snapshot: { ...raw.snapshot, license: "restricted" } };
      await expect(runSource(task3Adapter(conflicting, [{ key: "identity-1", entity: "entity-1" }]), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("SNAPSHOT_CONFLICT");
    } finally { await pool.end(); }
  });

  it("Task 3 commits opaque quarantine evidence before a later parse failure", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw("snap_quarantine", "d".repeat(64), 2); const base = task3Adapter(raw, []);
      const adapter = { ...base, async *parse() { yield { kind: "quarantine" as const, sourceNaturalKey: "opaque natural key", payloadChecksum: "e".repeat(64), errorCode: "parser text" }; throw new Error("parse failure"); } };
      await expect(runSource(adapter, { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z"), maxBatchSize: 1 })).rejects.toThrow("Ingestion failed");
      const evidence = await pool.query<{ source_natural_key: string; parser_error_code: string; redacted_diagnostic: string }>("SELECT q.source_natural_key,q.parser_error_code,q.redacted_diagnostic FROM quarantined_records q");
      expect(evidence.rows[0]).toMatchObject({ source_natural_key: /^[a-f0-9]{64}$/, parser_error_code: /^parse_[a-f0-9]{16}$/, redacted_diagnostic: "parser failure" });
      expect((await pool.query("SELECT status FROM ingest_runs")).rows[0]).toEqual({ status: "failed" });
    } finally { await pool.end(); }
  });

  it("Task 3 fails duplicate cross-batch staging and real staged validation", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const duplicateRaw = task3Raw("snap_duplicate", "f".repeat(64), 2);
      await expect(runSource(task3Adapter(duplicateRaw, [{ key: "same", entity: "one" }, { key: "same", entity: "two" }]), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z"), maxBatchSize: 1 })).rejects.toThrow("Ingestion failed");
      expect((await pool.query("SELECT status FROM ingest_runs")).rows[0]).toEqual({ status: "failed" });
      const invalidRaw = task3Raw("snap_invalid", "1".repeat(64));
      await expect(runSource(task3Adapter(invalidRaw, [{ key: "invalid", entity: "invalid" }], { issue: true }), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("Staged validation failed");
      expect((await pool.query("SELECT status FROM ingest_runs ORDER BY started_at DESC LIMIT 1")).rows[0]).toEqual({ status: "failed" });
    } finally { await pool.end(); }
  });

  it("Task 3 failure with a max-one pool finishes and a loaded run is reused after a failed retry", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw();
      await expect(runSource(task3Adapter(raw, [{ key: "bad", entity: "bad" }], { stageError: true }), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).rejects.toThrow("Ingestion failed");
      const good = await runSource(task3Adapter(raw, [{ key: "good", entity: "good" }]), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") });
      await expect(runSource(task3Adapter(raw, [{ key: "ignored", entity: "ignored" }]), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") })).resolves.toEqual({ runIds: [], reusedRunIds: good.runIds });
    } finally { await pool.end(); }
  }, 5_000);
  it("Task 3 blocks publication while a lease runs and allows validated runs", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const run = strictRun("run_task3_publication", task3ReleaseId, sourceId, 0);
      await startIngestRun(pool, run);
      await expect(promoteCandidateRelease(pool, task3ReleaseId)).rejects.toThrow();
      await markValidated(pool, run.id, run.leaseToken);
      await expect(promoteCandidateRelease(pool, task3ReleaseId)).resolves.toBeUndefined();
    } finally { await pool.end(); }
  });

  it("Task 3 fences expired owners, recovers the persisted receipt, and loads a distinct retry", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      const sourceId = await seedTask3(pool); const raw = task3Raw("snap_expired", "7".repeat(64), 0);
      await pool.query("INSERT INTO source_snapshots(id,release_id,source_id,source_url,published_at,retrieved_at,checksum_sha256,parser_version,license,usage_status) VALUES($1,$2,$3,$4,NULL,clock_timestamp(),$5,$6,'public','approved')", [raw.snapshot.id, task3ReleaseId, sourceId, raw.snapshot.sourceUrl, raw.snapshot.checksumSha256, "task3-v1"]);
      const expired = { ...strictRun("run_task3_expired", task3ReleaseId, sourceId, 0, raw.snapshot.id, raw.receipt.sha256, raw.snapshot.upstreamRelease), adapterVersion: "task3-v1", rawStoreLocator: raw.receipt.storeLocator, rawObjectKey: raw.receipt.objectKey };
      await pool.query("INSERT INTO ingest_runs(id,release_id,source_id,snapshot_id,adapter_version,upstream_release,raw_store_kind,raw_store_locator,raw_object_key,raw_object_sha256,raw_object_byte_size,lease_token,heartbeat_at,lease_expires_at,started_at,status,extracted_count,staged_count,quarantined_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute',clock_timestamp()-interval '2 minutes','running',$13,0,0)", [expired.id, expired.releaseId, expired.sourceId, expired.snapshotId, expired.adapterVersion, expired.upstreamRelease, expired.rawStoreKind, expired.rawStoreLocator, expired.rawObjectKey, expired.rawObjectSha256, expired.rawObjectByteSize, expired.leaseToken, expired.extractedCount]);
      await expect(pool.query("UPDATE ingest_runs SET heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '1 minute' WHERE id=$1", [expired.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE ingest_runs SET staged_count=staged_count WHERE id=$1", [expired.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE ingest_runs SET status='validated',completed_at=clock_timestamp(),lease_expires_at=NULL WHERE id=$1", [expired.id])).rejects.toMatchObject({ code: "23514" });
      await expect(pool.query("UPDATE ingest_runs SET status='failed',completed_at=clock_timestamp(),lease_expires_at=NULL,failure_code='ingest_error' WHERE id=$1", [expired.id])).rejects.toMatchObject({ code: "23514" });
      const recovered = await runSource(task3Adapter(raw, []), { pool, releaseId: task3ReleaseId as never, sourceId: sourceId as never, cutoff: new Date("2025-01-01Z") });
      expect(recovered.runIds).toHaveLength(1); expect(recovered.runIds[0]).not.toBe(expired.id);
      expect((await pool.query("SELECT status,failure_code,lease_expires_at FROM ingest_runs WHERE id=$1", [expired.id])).rows[0]).toEqual({ status: "failed", failure_code: "lease_expired", lease_expires_at: null });
      expect((await pool.query("SELECT status FROM ingest_runs WHERE id=$1", [recovered.runIds[0]])).rows[0]).toEqual({ status: "loaded" });
      await expect(recordStageBatch(pool, expired.id, expired.leaseToken, 0, expired.leaseDurationMs)).rejects.toThrow();
      await expect(recordQuarantineBatch(pool, expired.id, expired.leaseToken, 0, expired.leaseDurationMs)).rejects.toThrow();
      await expect(heartbeat(pool, expired.id, expired.leaseToken, expired.leaseDurationMs)).rejects.toThrow();
      await expect(markValidated(pool, expired.id, expired.leaseToken)).rejects.toThrow();
      await expect(markFailed(pool, expired.id, expired.leaseToken)).rejects.toThrow();
      await expect(failExpiredRun(pool, expired.id, expired.leaseToken)).rejects.toThrow();
    } finally { await pool.end(); }
  });

  it("Task 4 finalizes retained nationwide identity and TIGER runs atomically", async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl });
    const releaseId = "rel_task4_nationwide";
    const rawRoot = resolve(process.cwd(), ".test-raw-task4-nationwide");
    const sourceIds = { identity: "src_task4_identity", tiger: "src_task4_tiger" };
    try {
      await rm(rawRoot, { recursive: true, force: true });
      await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,'Task 4 nationwide candidate','candidate',$2,$2,NULL,NULL)", [releaseId, "2026-07-18T00:00:00.000Z"]);
      await pool.query("INSERT INTO sources(id,release_id,name,authority,homepage_url) VALUES($1,$2,'identity','derived','https://clerk.house.gov/'),($3,$2,'tiger','derived','https://www.census.gov/')", [sourceIds.identity, releaseId, sourceIds.tiger]);

      const identityRoot = resolve(process.cwd(), "data/source/identity");
      const geometryRoot = resolve(process.cwd(), "data/geometry/versions/9a5e76fc39867c92b0c816e4b23ca9c467d070c1eafbef6d0988b24e480c4871");
      const [house, senate, senateServiceStarts, cd119, states, tigerManifestBytes] = await Promise.all([
        readFile(resolve(identityRoot, "house-member-data.xml")), readFile(resolve(identityRoot, "senate-members.xml")), readFile(resolve(identityRoot, "senate-service-starts.json")),
        readFile(resolve(geometryRoot, "tiger2025-national-cd119.geojson")), readFile(resolve(geometryRoot, "tiger2025-national-states.geojson")), readFile(resolve(geometryRoot, "tiger2025-national-manifest.json")),
      ]);
      const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
      const sourceLockSha256 = checksum(await readFile(resolve(process.cwd(), "data/source-lock.json")));
      const houseCounts: Record<string, number> = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };
      const houseUniverse: HouseSeat[] = [...Object.entries(houseCounts).flatMap(([stateCode, count]) => Array.from({ length: count }, (_, index) => ({ stateCode, districtCode: (count === 1 ? "AL" : String(index + 1).padStart(2, "0")) as HouseSeat["districtCode"], kind: "representative" as const, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" }))), ...(["DC", "AS", "GU", "MP", "VI"] as const).map(stateCode => ({ stateCode, districtCode: "AL" as const, kind: "delegate" as const, termStartsAt: "2025-01-03", termEndsAt: "2027-01-03" })), { stateCode: "PR", districtCode: "AL", kind: "resident_commissioner", termStartsAt: "2025-01-03", termEndsAt: "2029-01-03" }];
      const senateUniverse: SenateSeat[] = parseSenateRoster(senate.toString(), parseSenateServiceStartsArtifact(senateServiceStarts.toString())).records.map(row => ({ stateCode: row.office.stateCode, senateClass: row.office.senateClass!, ...(row.office.senateClass === 1 ? { termStartsAt: "2025-01-03", termEndsAt: "2031-01-03" } : row.office.senateClass === 2 ? { termStartsAt: "2021-01-03", termEndsAt: "2027-01-03" } : { termStartsAt: "2023-01-03", termEndsAt: "2029-01-03" }) }));
      const rawStore = new LocalRawObjectStore(rawRoot);
      const identity = createIdentityAdapter({ rawStore, snapshotId: "snap_task4_identity" as never, upstreamRelease: "2025", parserVersion: "identity-v1", releaseCutoff: "2026-07-18", sourceLockSha256, house: { bytes: house, url: "https://clerk.house.gov/xml/lists/MemberData.xml", checksumSha256: checksum(house), lockId: "house-xml" }, senate: { bytes: senate, url: "https://www.senate.gov/general/contact_information/senators_cfm.xml", checksumSha256: checksum(senate), lockId: "senate-xml" }, senateServiceStarts: { bytes: senateServiceStarts, url: "urn:dsa-seats:senate-service-starts:v1", checksumSha256: checksum(senateServiceStarts), lockId: "senate-service-starts" }, houseUniverse, senateUniverse, senatePolicy: { noSenateJurisdictions: new Set(["DC", "PR", "AS", "GU", "MP", "VI"]) } });
      const tiger = createTigerAdapter({ rawStore, snapshotId: "snap_task4_tiger" as never, upstreamRelease: "2025", parserVersion: "tiger-v1", sourceLockSha256, lockIds: { cd119: "geo-national-cd119", states: "geo-national-states", manifest: "geo-national-manifest", bundle: "geo-national-bundle" }, manifest: JSON.parse(tigerManifestBytes.toString()) as NationalTigerArtifactManifest, cd119Bytes: cd119, statesBytes: states, sourceUrl: "urn:dsa-seats:tiger2025:national-manifest" });
      const identityRun = await runSource(identity, { pool, releaseId: releaseId as never, sourceId: sourceIds.identity as never, cutoff: new Date("2026-07-18T00:00:00.000Z"), dryRun: true });
      const tigerRun = await runSource(tiger, { pool, releaseId: releaseId as never, sourceId: sourceIds.tiger as never, cutoff: new Date("2026-07-18T00:00:00.000Z"), dryRun: true });
      expect(identityRun.runIds).toHaveLength(1); expect(tigerRun.runIds).toHaveLength(1);
      await expect(finalizeNationwideCandidate({ pool, rawStore, releaseId, identityRunId: identityRun.runIds[0]!, tigerRunId: tigerRun.runIds[0]!, sourceLockSha256: "0".repeat(64) })).rejects.toThrow("NATIONWIDE_FINALIZE_SOURCE_LOCK_MISMATCH");
      await expect(finalizeNationwideCandidate({ pool, rawStore, releaseId, identityRunId: identityRun.runIds[0]!, tigerRunId: "run_task4_missing", sourceLockSha256 })).rejects.toThrow("NATIONWIDE_FINALIZE_CANDIDATE_INVALID");
      expect((await pool.query("SELECT status FROM ingest_runs WHERE id = ANY($1) ORDER BY source_id", [[identityRun.runIds[0], tigerRun.runIds[0]]])).rows).toEqual([{ status: "validated" }, { status: "validated" }]);
      expect((await pool.query("SELECT 1 FROM release_manifests WHERE release_id=$1", [releaseId])).rowCount).toBe(0);
      for (const table of contentTableRegistry.filter(({ name }) => name !== "sources" && name !== "source_snapshots")) expect((await pool.query(`SELECT 1 FROM ${table.name} WHERE release_id=$1 LIMIT 1`, [releaseId])).rowCount).toBe(0);

      await finalizeNationwideCandidate({ pool, rawStore, releaseId, identityRunId: identityRun.runIds[0]!, tigerRunId: tigerRun.runIds[0]!, sourceLockSha256 });
      expect((await pool.query("SELECT status,published_at FROM data_releases WHERE id=$1", [releaseId])).rows).toEqual([{ status: "candidate", published_at: null }]);
      expect((await pool.query("SELECT status FROM ingest_runs WHERE id = ANY($1) ORDER BY source_id", [[identityRun.runIds[0], tigerRun.runIds[0]]])).rows).toEqual([{ status: "loaded" }, { status: "loaded" }]);
      expect((await pool.query("SELECT 1 FROM nationwide_validation_gates WHERE release_id=$1", [releaseId])).rowCount).toBe(1);
      await expect(recheckNationwideValidationGate(pool, releaseId)).resolves.toBeUndefined();
      const contentCounts = async () => Object.fromEntries(await Promise.all(contentTableRegistry.map(async ({ name }) => [name, (await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${name} WHERE release_id=$1`, [releaseId])).rows[0]!.count])));
      const beforeRetryContentCounts = await contentCounts();
      await expect(finalizeNationwideCandidate({ pool, rawStore, releaseId, identityRunId: identityRun.runIds[0]!, tigerRunId: tigerRun.runIds[0]!, sourceLockSha256 })).resolves.toBeUndefined();
      expect(await contentCounts()).toEqual(beforeRetryContentCounts);
      await expect(recheckNationwideValidationGate(pool, releaseId)).resolves.toBeUndefined();
      const loaded = await loadNationwideManifest(pool, releaseId);
      expect(computeCanonicalDataChecksum(loaded)).toBe(loaded.canonicalDataChecksumSha256);
      expect(loaded.sources).toEqual([{ id: sourceIds.identity, releaseId, name: "identity", authority: "derived", homepageUrl: "https://clerk.house.gov/" }, { id: sourceIds.tiger, releaseId, name: "tiger", authority: "derived", homepageUrl: "https://www.census.gov/" }]);
      expect(loaded.snapshots.map(snapshot => ({ id: snapshot.id, sourceId: snapshot.sourceId, sourceUrl: snapshot.sourceUrl, parserVersion: snapshot.parserVersion, usageStatus: snapshot.usageStatus }))).toEqual([{ id: "snap_task4_identity", sourceId: sourceIds.identity, sourceUrl: "identity-envelope:https://clerk.house.gov/xml/lists/MemberData.xml|https://www.senate.gov/general/contact_information/senators_cfm.xml|urn:dsa-seats:senate-service-starts:v1", parserVersion: "identity-v1", usageStatus: "approved" }, { id: "snap_task4_tiger", sourceId: sourceIds.tiger, sourceUrl: "urn:dsa-seats:tiger2025:national-manifest", parserVersion: "tiger-v1", usageStatus: "approved" }]);
      expect({ house: loaded.offices.filter(row => row.chamber === "house").length, senate: loaded.offices.filter(row => row.chamber === "senate").length, cycles: loaded.seatCycles.length, geographies: loaded.geographyVersions.length, memberships: loaded.memberships.length, vacantHouseCycles: loaded.seatCycles.filter(row => row.occupancy.status === "vacant" && loaded.offices.find(office => office.id === row.officeId)?.chamber === "house").length, jurisdictions: loaded.jurisdictions.length }).toEqual({ house: 441, senate: 100, cycles: 541, geographies: 497, memberships: 537, vacantHouseCycles: 4, jurisdictions: 56 });
      expect(loaded.seatCycles.filter(row => row.occupancy.status === "vacant").every(row => !loaded.memberships.some(membership => membership.officeTermId === row.officeTermId))).toBe(true);
      const prOffice = loaded.offices.find(row => row.kind === "resident_commissioner")!;
      const prTerm = loaded.officeTerms.find(row => row.officeId === prOffice.id)!;
      expect(prTerm).toMatchObject({ id: "term_house_pr_al_2029_01_03", startsAt: "2025-01-03", endsAt: "2029-01-03" });
      expect(loaded.memberships.find(row => row.officeTermId === prTerm.id)).toMatchObject({ startsAt: "2025-01-03", endsAt: "2029-01-03" });
      const alRepresentativeTerm = loaded.officeTerms.find(row => row.officeId === loaded.offices.find(office => office.stateCode === "AL" && office.kind === "house_voting")!.id)!;
      expect(alRepresentativeTerm).toMatchObject({ startsAt: "2025-01-03", endsAt: "2027-01-03" });
      expect(loaded.memberships.find(row => row.officeTermId === alRepresentativeTerm.id)).toMatchObject({ startsAt: "2025-01-03", endsAt: "2027-01-03" });
      const boundaries = await pool.query<{ srid: number; type: string; nonempty: boolean; valid: boolean }>("SELECT ST_SRID(boundary) srid,ST_GeometryType(boundary) type,NOT ST_IsEmpty(boundary) nonempty,ST_IsValid(boundary) valid FROM geography_versions WHERE release_id=$1", [releaseId]);
      expect(boundaries.rows).toHaveLength(loaded.geographyVersions.length);
      expect(boundaries.rows.every(boundary => boundary.srid === 4326 && boundary.type === "ST_MultiPolygon" && boundary.nonempty && boundary.valid)).toBe(true);
      expect(JSON.stringify(loaded)).not.toContain("original_publisher");
      expect({ contests: loaded.contests, acs: loaded.acsObservations, finance: [loaded.financeSummaries, loaded.financeAggregates, loaded.fundingCategoryAggregates, loaded.fundingOrganizationAggregates, loaded.outsideSpendingAggregates], maps: loaded.mapArtifacts }).toEqual({ contests: [], acs: [], finance: [[], [], [], [], []], maps: [] });
      const client = await pool.connect();
      try {
        const point = async (stateCode: string) => (await client.query<{ longitude: number; latitude: number }>("SELECT ST_X(ST_PointOnSurface(boundary)) longitude,ST_Y(ST_PointOnSurface(boundary)) latitude FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND state_code=$2 ORDER BY district_code LIMIT 1", [releaseId, stateCode])).rows[0]!;
        const zeroSenatePoints = await client.query<{ state_code: string; longitude: number; latitude: number }>("SELECT state_code,ST_X(ST_PointOnSurface(boundary)) longitude,ST_Y(ST_PointOnSurface(boundary)) latitude FROM geography_versions WHERE release_id=$1 AND kind='house_district' AND state_code = ANY($2) ORDER BY state_code", [releaseId, ["DC", "PR", "AS", "GU", "MP", "VI"]]);
        const zeroSenateHouseCycles = { AS: "seat_house_as_al_current", DC: "seat_house_dc_al_current", GU: "seat_house_gu_al_current", MP: "seat_house_mp_al_current", PR: "seat_house_pr_al_current", VI: "seat_house_vi_al_current" };
        expect(zeroSenatePoints.rows).toHaveLength(6);
        for (const { state_code, longitude, latitude } of zeroSenatePoints.rows) await expect(locateNationwideCandidatePoint(client, releaseId, longitude, latitude)).resolves.toEqual({ kind: "matched", houseSeatCycleId: zeroSenateHouseCycles[state_code as keyof typeof zeroSenateHouseCycles], senateSeatCycleIds: [] });
        const al = await point("AL");
        await expect(locateNationwideCandidatePoint(client, releaseId, al.longitude, al.latitude)).resolves.toEqual({ kind: "matched", houseSeatCycleId: "seat_house_al_01_current", senateSeatCycleIds: ["seat_senate_al_2_current", "seat_senate_al_3_current"] });
      } finally { client.release(); }
    } finally { await pool.end(); await rm(rawRoot, { recursive: true, force: true }); }
  }, 300_000);

});
