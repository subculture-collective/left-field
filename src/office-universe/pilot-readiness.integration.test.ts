import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { qualifiedSource, verifiedReceipt } from "./fixtures/qualified-source";
import type { RawIntakeRecord, RetainedObjectReceipt } from "./nationwide-intake";
import { buildNationwideSourceRegistry } from "./nationwide-intake";
import { verifyRetainedObject } from "./raw-store";
import { createIntakeRepository, seedSourceRegistry } from "./repository";
import { runReviewedSource, shadowRunIds } from "./run-source";

/**
 * Opt-in proof against an explicitly named disposable database. There is no
 * implicit target: without OFFICE_UNIVERSE_DATABASE_URL the suite skips, and a
 * URL that does not name a *_test database, or a production NODE_ENV, refuses.
 */
const databaseUrl = process.env.OFFICE_UNIVERSE_DATABASE_URL;
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : "";
if (databaseUrl && process.env.NODE_ENV === "production") throw new Error("OFFICE_UNIVERSE_PROOF_REFUSED: NODE_ENV=production is never a proof target");
if (databaseUrl && !/_test$/i.test(databaseName)) throw new Error(`OFFICE_UNIVERSE_PROOF_REFUSED: "${databaseName}" is not a disposable *_test database`);

/** Every office_universe table this proof writes; truncated before and after so the proof is rerunnable. */
const EVIDENCE_TABLES = ["snapshot_issues", "intake_snapshots", "intake_runs", "retained_object_receipts", "intake_issues", "raw_payloads", "source_definitions", "source_registrations"].map((t) => `office_universe.${t}`);
const APPEND_ONLY_TABLES = ["intake_runs", "intake_snapshots", "snapshot_issues", "retained_object_receipts"];
const CUTOFFS = { accepted: "2026-08-21T00:00:00Z", quarantined: "2026-08-22T00:00:00Z", ingest: "2026-08-23T00:00:00Z" } as const;

const record = (overrides: Partial<RawIntakeRecord> = {}): RawIntakeRecord => ({
  sourceKey: qualifiedSource().sourceKey, snapshotId: "caller_supplied", payloadSha256: "a".repeat(64), payloadLocator: "in/2024/HD01.json",
  sourceNaturalKey: "IN:2024:HD01", kind: "result", observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD01", winner: "synthetic", votes: 1 }, ...overrides,
});

async function federalCounts(pool: Pool): Promise<Record<string, string>> {
  const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  const counts: Record<string, string> = {};
  for (const { table_name } of tables.rows) counts[table_name] = (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM public."${table_name}"`)).rows[0]!.n;
  return counts;
}

describe.skipIf(!databaseUrl)("office-universe pilot readiness proof (skipped: set OFFICE_UNIVERSE_DATABASE_URL to a disposable *_test database)", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repository = createIntakeRepository(pool);
  const source = qualifiedSource();
  const ingestLogin = `dsa_ou_proof_ingest_${randomUUID().replace(/-/g, "")}`;
  let rawStoreRoot = "";
  let receipt: RetainedObjectReceipt;
  let federalBefore: Record<string, string> = {};

  beforeAll(async () => {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    await pool.query(`TRUNCATE ${EVIDENCE_TABLES.join(",")} CASCADE`);
    federalBefore = await federalCounts(pool);
    rawStoreRoot = await mkdtemp(join(tmpdir(), "ou-pilot-readiness-"));
  });

  afterAll(async () => {
    await pool.query(`TRUNCATE ${EVIDENCE_TABLES.join(",")} CASCADE`).catch(() => undefined);
    await pool.query(`DROP ROLE IF EXISTS "${ingestLogin}"`).catch(() => undefined);
    await pool.end();
    if (rawStoreRoot) await rm(rawStoreRoot, { recursive: true, force: true });
  });

  it("seeds the 250-slot registry insert-only", async () => {
    const entries = buildNationwideSourceRegistry();
    expect(await seedSourceRegistry(pool, entries)).toEqual({ inserted: 250, existing: 0 });
    expect(await seedSourceRegistry(pool, entries)).toEqual({ inserted: 0, existing: 250 });
    expect((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM office_universe.source_registrations")).rows[0]!.n).toBe("250");
  });

  it("stores one synthetic reviewed source and a verified retained-object receipt", async () => {
    await pool.query(
      `INSERT INTO office_universe.source_definitions(id,state_code,family,source_key,authority_tier,authority_scope,precedence,source_url,retention_basis,allowed_kinds,privacy_policy,status,reviewed_by,reviewed_at)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)`,
      [source.id, source.stateCode, source.family, source.sourceKey, source.authorityTier, JSON.stringify(source.authorityScope), source.precedence, source.sourceUrl, source.retentionBasis, JSON.stringify(source.allowedKinds), source.privacyPolicy, source.status, "pilot-readiness-proof", "2026-08-21T00:00:00Z"],
    );
    const fixture = verifiedReceipt();
    const bytes = Buffer.from(JSON.stringify({ contests: [{ contest: "HD01", winner: "synthetic" }] }));
    const target = join(rawStoreRoot, fixture.locator);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    const unverified: RetainedObjectReceipt = { ...fixture, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), verified: false };
    const verified = await verifyRetainedObject({ root: rawStoreRoot, locator: unverified.locator, expectedSha256: unverified.sha256, expectedBytes: unverified.byteSize });
    expect(verified).toEqual({ locator: unverified.locator, byteSize: bytes.length, sha256: unverified.sha256 });
    receipt = { ...unverified, verified: true };
  });

  it("records an accepted run and a quarantined run as terminal append-only evidence", async () => {
    const accepted = await runReviewedSource({ source, requestedCutoff: CUTOFFS.accepted, receipt, rawStoreRoot, loadRecords: async () => [record()], repository });
    expect(accepted).toEqual({ ...shadowRunIds(source.id, CUTOFFS.accepted, receipt.sha256), snapshotDisposition: "accepted", normalizedRecordCount: 0 });

    const drifted = { ...receipt, finalUrl: "https://mirror.other.example/results" };
    const quarantined = await runReviewedSource({ source, requestedCutoff: CUTOFFS.quarantined, receipt: drifted, rawStoreRoot, loadRecords: async () => [record({ snapshotId: "ignored" })], repository });
    expect(quarantined).toMatchObject({ snapshotDisposition: "quarantined", normalizedRecordCount: 0 });

    const runs = await pool.query<{ id: string; status: string; finished: boolean }>("SELECT id,status,finished_at IS NOT NULL AS finished FROM office_universe.intake_runs ORDER BY requested_cutoff");
    expect(runs.rows).toEqual([{ id: accepted.runId, status: "succeeded", finished: true }, { id: quarantined.runId, status: "failed", finished: true }]);
    const snapshots = await pool.query<{ id: string; disposition: string; row_count: number; accepted_row_count: number; quarantined_row_count: number }>("SELECT s.id,s.disposition,s.row_count,s.accepted_row_count,s.quarantined_row_count FROM office_universe.intake_snapshots s JOIN office_universe.intake_runs r ON r.id=s.run_id ORDER BY r.requested_cutoff");
    expect(snapshots.rows).toEqual([
      { id: accepted.snapshotId, disposition: "accepted", row_count: 1, accepted_row_count: 1, quarantined_row_count: 0 },
      { id: quarantined.snapshotId, disposition: "quarantined", row_count: 1, accepted_row_count: 0, quarantined_row_count: 1 },
    ]);
    const issues = await pool.query<{ snapshot_id: string; code: string; systemic: boolean }>("SELECT snapshot_id,code,systemic FROM office_universe.snapshot_issues");
    expect(issues.rows).toEqual([{ snapshot_id: quarantined.snapshotId, code: "SOURCE_AUTHORITY_MISMATCH", systemic: true }]);
    const receipts = await pool.query<{ source_definition_id: string; sha256: string; byte_size: string }>("SELECT source_definition_id,sha256,byte_size::text AS byte_size FROM office_universe.retained_object_receipts");
    expect(receipts.rows).toEqual([{ source_definition_id: source.id, sha256: receipt.sha256, byte_size: String(receipt.byteSize) }]);
    expect((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM office_universe.raw_payloads")).rows[0]!.n).toBe("2");
  });

  it("lets an ingest login append evidence but never update or delete it", async () => {
    expect((await pool.query<{ permitted: boolean }>("SELECT rolsuper OR rolcreaterole AS permitted FROM pg_roles WHERE rolname=current_user")).rows[0]?.permitted).toBe(true);
    const password = randomUUID();
    const url = new URL(databaseUrl!); url.username = ingestLogin; url.password = password;
    await pool.query(`CREATE ROLE "${ingestLogin}" LOGIN INHERIT PASSWORD '${password}'`);
    await pool.query(`GRANT dsa_seats_ingest TO "${ingestLogin}"`);
    const ingestPool = new Pool({ connectionString: url.toString(), max: 1 });
    try {
      const run = await runReviewedSource({ source, requestedCutoff: CUTOFFS.ingest, receipt, loadRecords: async () => [record()], repository: createIntakeRepository(ingestPool) });
      expect(run.snapshotDisposition).toBe("accepted");
      expect((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM office_universe.intake_runs WHERE id=$1 AND status='succeeded'", [run.runId])).rows[0]!.n).toBe("1");
      for (const table of APPEND_ONLY_TABLES) {
        await expect(ingestPool.query(`UPDATE office_universe.${table} SET id=id`)).rejects.toMatchObject({ code: "42501" });
        await expect(ingestPool.query(`DELETE FROM office_universe.${table}`)).rejects.toMatchObject({ code: "42501" });
      }
    } finally {
      await ingestPool.end();
      await pool.query(`DROP ROLE IF EXISTS "${ingestLogin}"`);
    }
    expect((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM office_universe.intake_runs")).rows[0]!.n).toBe("3");
  });

  it("writes nothing to any public-schema federal table", async () => {
    expect(Object.keys(federalBefore)).toEqual(expect.arrayContaining(["offices", "seat_cycles", "data_releases"]));
    expect(await federalCounts(pool)).toEqual(federalBefore);
  });
});
