import type { Pool, PoolClient } from "pg";
import { recheckNationwideValidationGateShared } from "@/db/catalog-release";
import { getSeatProfile } from "@/repositories/sql/get-seat-profile";
import { listSeatPage } from "@/repositories/sql/list-seats";
import { listReleaseCoverage, listSources } from "@/repositories/sql/list-sources";
import { isAuthenticReleaseDrillResult, type ReleaseDrillResult } from "./release-drill";

export type ReleaseHealthStatus = "pass" | "fail" | "blocked" | "not_run";
export type ReleaseHealthDatabaseClass = "test" | "nonproduction" | "unknown";
export interface ReleaseHealthCheck { readonly name: CheckName; readonly status: ReleaseHealthStatus; readonly evidence: Readonly<Record<string, number | ReleaseHealthStatus | "not_observed">>; }
type CheckName = "preflight_access" | "universe" | "geometry" | "source_provenance" | "coverage_quarantine" | "ingestion" | "validation_gate" | "repository_smokes" | "rollback_drill" | "production_telemetry" | "launch_blockers";
const checkNames: readonly CheckName[] = ["preflight_access", "universe", "geometry", "source_provenance", "coverage_quarantine", "ingestion", "validation_gate", "repository_smokes", "rollback_drill", "production_telemetry", "launch_blockers"];
const repositoryCheckNames = checkNames.slice(0, 8);
export type RollbackDrillEvidence = ReleaseDrillResult;
export interface ReleaseHealthOptions { readonly rollbackDrill?: RollbackDrillEvidence; }
export interface ReleaseHealthReport { readonly releaseId: string; readonly evidenceClass: "local-postgres"; readonly databaseClass: ReleaseHealthDatabaseClass; readonly status: ReleaseHealthStatus; readonly repositoryStatus: ReleaseHealthStatus; readonly productionReadinessStatus: ReleaseHealthStatus; readonly checks: readonly ReleaseHealthCheck[]; }
type CountRow = Record<string, number | string | null>;
const count = (value: number | string | null | undefined): number => { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0; };
const check = (name: CheckName, status: ReleaseHealthStatus, evidence: ReleaseHealthCheck["evidence"]): ReleaseHealthCheck => ({ name, status, evidence });
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const validStatus = (value: unknown): value is ReleaseHealthStatus => value === "pass" || value === "fail" || value === "blocked" || value === "not_run";

/** Empty and runtime-invalid input is unhealthy; callers must not silently ignore it. */
export function aggregateReleaseHealth(checks: readonly ReleaseHealthCheck[]): ReleaseHealthStatus {
  if (checks.length === 0 || checks.some(item => !item || !validStatus(item.status))) return "fail";
  if (checks.some(item => item.status === "fail")) return "fail";
  if (checks.some(item => item.status === "blocked")) return "blocked";
  if (checks.some(item => item.status === "not_run")) return "not_run";
  return "pass";
}

/** Strictly parse the v2 public contract, then require the unforgeable in-process provenance. */
export function isVerifiedRollbackDrillEvidence(value: unknown, releaseId?: string, now = Date.now()): value is RollbackDrillEvidence {
  if (!isAuthenticReleaseDrillResult(value) || !value || typeof value !== "object") return false;
  const drill = value as unknown as Record<string, unknown>;
  if (!exactKeys(drill, ["evidenceClass", "evidenceVersion", "verified", "durationMs", "completedAt", "publishedReleaseId", "domains", "publicSmokes", "operationalSignals", "checks"]) || drill.evidenceClass !== "local-synthetic" || drill.evidenceVersion !== 2 || drill.verified !== true || !Number.isSafeInteger(drill.durationMs) || (drill.durationMs as number) <= 0 || (drill.durationMs as number) > 120_000 || typeof drill.completedAt !== "string" || typeof drill.publishedReleaseId !== "string" || (releaseId !== undefined && drill.publishedReleaseId !== releaseId) || drill.domains !== 7 || drill.publicSmokes !== 3 || drill.operationalSignals !== 21 || !drill.checks || typeof drill.checks !== "object") return false;
  const completedAt = Date.parse(drill.completedAt); if (!Number.isFinite(completedAt) || new Date(completedAt).toISOString() !== drill.completedAt || completedAt > now || now - completedAt > 10 * 60_000) return false;
  const checks = drill.checks as Record<string, unknown>; const domains = ["member", "acs", "finance", "elections", "maps"];
  return exactKeys(checks, ["roleAttestations", "stalePromotionRejected", "writerFreezeRejected", "expiredProofRejected", "domainInvalidations", "immutableFingerprintPreserved", "rollbackPreserved", "rollForwardPreserved", "rollbackPublicSmoke", "rollForwardPublicSmoke", "operationalSignalsObserved", "consumedProofs", "ingestHistoryRows", "digestRows"])
    && checks.roleAttestations === true && checks.stalePromotionRejected === true && checks.writerFreezeRejected === true && checks.expiredProofRejected === true && Array.isArray(checks.domainInvalidations) && checks.domainInvalidations.length === 5 && checks.domainInvalidations.every((domain, index) => domain === domains[index]) && checks.immutableFingerprintPreserved === true && checks.rollbackPreserved === true && checks.rollForwardPreserved === true && checks.rollbackPublicSmoke === true && checks.rollForwardPublicSmoke === true && checks.operationalSignalsObserved === true && Number.isSafeInteger(checks.consumedProofs) && (checks.consumedProofs as number) >= 4 && checks.ingestHistoryRows === 1 && checks.digestRows === 21;
}

async function safely(name: CheckName, work: () => Promise<ReleaseHealthCheck>): Promise<ReleaseHealthCheck> { try { return await work(); } catch { return check(name, "fail", { durationMs: 0 }); } }
async function repositorySmoke(client: PoolClient, releaseId: string): Promise<ReleaseHealthCheck> { const page = await listSeatPage(client, releaseId as never, { limit: 1, sort: "state", direction: "asc" }); const seat = page.items[0]; if (!seat) return check("repository_smokes", "fail", { smokes: 0 }); const [profile, sources, coverage] = await Promise.all([getSeatProfile(client, releaseId as never, seat.id), listSources(client, releaseId as never), listReleaseCoverage(client, releaseId as never)]); const smokes = Number(profile !== null) + Number(sources.length > 0) + Number(coverage.length > 0) + 1; return check("repository_smokes", smokes === 4 ? "pass" : "fail", { smokes }); }

/** Runs database checks in one immutable snapshot and always returns the complete ordered checklist. */
export async function inspectReleaseHealth(pool: Pool, releaseId: string, options: ReleaseHealthOptions = {}): Promise<ReleaseHealthReport> {
  const checks = new Map<CheckName, ReleaseHealthCheck>(checkNames.map(name => [name, check(name, "not_run", { status: "not_run" })]));
  const replace = (item: ReleaseHealthCheck): void => { checks.set(item.name, item); };
  let databaseClass: ReleaseHealthDatabaseClass = "unknown"; let client: PoolClient | undefined; let commitAttempted = false;
  try {
    client = await pool.connect(); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); await client.query("SET LOCAL statement_timeout = '5000ms'");
    const restricted = (await client.query<{ restricted: boolean }>("SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper) AND session_user::text<>(SELECT pg_get_userbyid(datdba)::text FROM pg_database WHERE datname=current_database()) AND (SELECT count(*) FROM pg_auth_members membership JOIN pg_roles member ON member.oid=membership.member WHERE member.rolname=session_user)=1 AND EXISTS(SELECT 1 FROM pg_auth_members membership JOIN pg_roles member ON member.oid=membership.member JOIN pg_roles granted ON granted.oid=membership.roleid WHERE member.rolname=session_user AND granted.rolname='dsa_seats_release_preflight') AS restricted")).rows[0]?.restricted === true;
    replace(check("preflight_access", restricted ? "pass" : "fail", { restricted: Number(restricted) })); if (!restricted) throw new Error("restricted preflight session required");
    replace(await safely("universe", async () => { const row = (await client!.query<CountRow>("SELECT count(DISTINCT o.id) FILTER (WHERE o.chamber='house') offices_house,count(DISTINCT o.id) FILTER (WHERE o.chamber='senate') offices_senate,count(DISTINCT rps.seat_cycle_id) seats FROM data_releases r LEFT JOIN offices o ON o.release_id=r.id LEFT JOIN release_profile_seats rps ON rps.release_id=r.id WHERE r.id=$1", [releaseId])).rows[0]; const seats=count(row?.seats), house=count(row?.offices_house), senate=count(row?.offices_senate); return check("universe", seats===541 && house===441 && senate===100 ? "pass":"fail", { seats, house, senate }); }));
    replace(await safely("geometry", async () => { const row=(await client!.query<CountRow>("SELECT count(*) geometries,count(*) FILTER (WHERE boundary IS NULL OR NOT ST_IsValid(boundary) OR ST_SRID(boundary)<>4326) invalid FROM geography_versions WHERE release_id=$1",[releaseId])).rows[0]; const geometries=count(row?.geometries), invalid=count(row?.invalid); return check("geometry", geometries===497 && invalid===0 ? "pass":"fail",{geometries,invalid}); }));
    replace(await safely("source_provenance", async () => { const row=(await client!.query<CountRow>("SELECT count(*) sources,(SELECT count(*) FROM source_snapshots WHERE release_id=$1) snapshots,(SELECT count(*) FROM source_snapshots WHERE release_id=$1 AND usage_status='approved') approved,(SELECT count(*) FROM source_snapshots WHERE release_id=$1 AND usage_status='restricted') restricted,(SELECT count(*) FROM source_snapshots WHERE release_id=$1 AND usage_status='review_required') review_required FROM sources WHERE release_id=$1",[releaseId])).rows[0]; const sources=count(row?.sources),snapshots=count(row?.snapshots),approved=count(row?.approved),restrictedCount=count(row?.restricted),reviewRequired=count(row?.review_required); return check("source_provenance",sources>0&&snapshots>0&&reviewRequired===0?"pass":"fail",{sources,snapshots,approved,restricted:restrictedCount,reviewRequired}); }));
    replace(await safely("coverage_quarantine", async () => { const row=(await client!.query<CountRow>("SELECT count(*) coverage_records,coalesce(sum(quarantined_count),0) quarantined FROM coverage_records WHERE release_id=$1",[releaseId])).rows[0]; const coverageRecords=count(row?.coverage_records),quarantined=count(row?.quarantined); return check("coverage_quarantine",coverageRecords>0?"pass":"fail",{coverageRecords,quarantined}); }));
    replace(await safely("ingestion", async () => { const row=(await client!.query<CountRow>("WITH current_runs AS (SELECT DISTINCT ON (source_id,snapshot_id) status FROM ingest_runs WHERE release_id=$1 AND snapshot_id IS NOT NULL ORDER BY source_id,snapshot_id,started_at DESC,id DESC) SELECT count(*) FILTER (WHERE status='running') running,count(*) FILTER (WHERE status='failed') failed FROM current_runs",[releaseId])).rows[0]; const running=count(row?.running),failed=count(row?.failed); return check("ingestion",running===0&&failed===0?"pass":"fail",{running,failed}); }));
    replace(await safely("validation_gate", async () => { await recheckNationwideValidationGateShared(client!, releaseId); return check("validation_gate","pass",{domains:7}); })); replace(await safely("repository_smokes", () => repositorySmoke(client!, releaseId)));
    try { const database=await client.query<{database_class:string}>("SELECT CASE WHEN current_database() ~ '_test$' THEN 'test' WHEN current_database() ~ '(dev|local|staging|preview)' THEN 'nonproduction' ELSE 'unknown' END database_class"); if (database.rows[0]?.database_class === "test" || database.rows[0]?.database_class === "nonproduction") databaseClass=database.rows[0].database_class; } catch { /* classification is optional */ }
    commitAttempted = true;
    await client.query("COMMIT");
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (commitAttempted) for (const name of repositoryCheckNames) replace(check(name, "fail", { durationMs: 0 }));
  } finally { client?.release(); }
  const repositoryStatus=aggregateReleaseHealth(repositoryCheckNames.map(name => checks.get(name)!)); const drill=options.rollbackDrill; const verified=isVerifiedRollbackDrillEvidence(drill, releaseId); replace(check("rollback_drill", !drill ? "blocked" : verified ? "pass" : "fail", { verified:Number(verified), durationMs: verified ? drill!.durationMs : 0 })); replace(check("production_telemetry","not_run",{status:"not_observed"})); const blockers=[...checks.values()].filter(item => item.name !== "launch_blockers" && item.status !== "pass").length; replace(check("launch_blockers",blockers===0?"pass":"blocked",{blockers})); const ordered=checkNames.map(name => checks.get(name)!); const productionReadinessStatus=aggregateReleaseHealth(ordered); return { releaseId,evidenceClass:"local-postgres",databaseClass,status:productionReadinessStatus,repositoryStatus,productionReadinessStatus,checks:ordered };
}
