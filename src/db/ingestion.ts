import type { Pool, PoolClient } from "pg";

export type IngestStatus = "running" | "validated" | "failed" | "loaded";
type Runner = Pool | PoolClient;
export interface StartIngestRunInput { id: string; releaseId: string; sourceId: string; adapterVersion: string; extractedCount: number; }
const nonNegative = (count: number, name: string): void => { if (!Number.isInteger(count) || count < 0) throw new Error(`${name} must be a non-negative integer`); };

export async function startIngestRun(db: Runner, input: StartIngestRunInput): Promise<void> {
  nonNegative(input.extractedCount, "extractedCount");
  const result = await db.query("INSERT INTO ingest_runs(id,release_id,source_id,adapter_version,started_at,status,extracted_count,staged_count,quarantined_count) SELECT $1,$2,$3,$4,now(),'running',$5,0,0 WHERE EXISTS(SELECT 1 FROM data_releases WHERE id=$2 AND status='candidate') AND EXISTS(SELECT 1 FROM sources WHERE release_id=$2 AND id=$3)", [input.id, input.releaseId, input.sourceId, input.adapterVersion, input.extractedCount]);
  if (result.rowCount !== 1) throw new Error("Ingest runs require a candidate release and same-release source");
}
async function batch(db: Runner, id: string, column: "staged_count" | "quarantined_count", count: number): Promise<void> { nonNegative(count, "count"); const result = await db.query(`UPDATE ingest_runs SET ${column}=${column}+$2 WHERE id=$1 AND status='running' AND staged_count+quarantined_count+$2<=extracted_count`, [id, count]); if (result.rowCount !== 1) throw new Error(`Cannot record ${column} for ingest run ${id}`); }
export const recordStageBatch = (db: Runner, id: string, count: number): Promise<void> => batch(db, id, "staged_count", count);
export const recordQuarantineBatch = (db: Runner, id: string, count: number): Promise<void> => batch(db, id, "quarantined_count", count);
async function transition(db: Runner, id: string, from: IngestStatus, to: IngestStatus, reconcile: boolean): Promise<void> { const result = await db.query("UPDATE ingest_runs SET status=$2,completed_at=CASE WHEN $2='failed' THEN now() WHEN $2 IN ('validated','loaded') THEN now() ELSE NULL END WHERE id=$1 AND status=$3" + (reconcile ? " AND staged_count+quarantined_count=extracted_count" : ""), [id, to, from]); if (result.rowCount !== 1) throw new Error(`Illegal or unreconciled ingest-run transition for ${id}`); }
export const markValidated = (db: Runner, id: string): Promise<void> => transition(db, id, "running", "validated", true);
export const markLoaded = (db: Runner, id: string): Promise<void> => transition(db, id, "validated", "loaded", false);
export const markFailed = (db: Runner, id: string): Promise<void> => transition(db, id, "running", "failed", false);
