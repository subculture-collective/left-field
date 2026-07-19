import type { Pool, PoolClient } from "pg";

export type IngestStatus = "running" | "validated" | "failed" | "loaded";
export type IngestFailureCode = "ingest_error" | "lease_expired";
type Runner = Pool | PoolClient;
export interface StartIngestRunInput {
  id: string; releaseId: string; sourceId: string; snapshotId: string; adapterVersion: string;
  upstreamRelease: string; rawStoreKind: "local" | "s3"; rawStoreLocator: string; rawObjectKey: string;
  rawObjectSha256: string; rawObjectByteSize: number; rawObjectVersionId?: string; rawObjectEtag?: string;
  leaseToken: string; leaseDurationMs: number; extractedCount: number;
}
const nonNegative = (value: number, name: string): void => { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer`); };
const uuid = (value: string): void => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("leaseToken must be a UUID"); };
const receipt = (input: StartIngestRunInput): void => { nonNegative(input.extractedCount, "extractedCount"); nonNegative(input.rawObjectByteSize, "rawObjectByteSize"); uuid(input.leaseToken); if (!input.snapshotId || !input.upstreamRelease || !input.rawStoreLocator || !input.rawObjectKey || input.rawObjectKey.startsWith("/") || input.rawObjectKey.includes("\\") || input.rawObjectKey.split("/").includes("..") || !/^[a-f0-9]{64}$/.test(input.rawObjectSha256) || (input.rawStoreKind === "s3" && !input.rawObjectVersionId) || (input.rawStoreKind === "local" && input.rawObjectVersionId)) throw new Error("Invalid immutable raw receipt"); };
const leaseMs = (value: number): number => { if (!Number.isSafeInteger(value) || value < 1) throw new Error("leaseDurationMs must be a positive integer"); return value; };

export async function startIngestRun(db: Runner, input: StartIngestRunInput): Promise<void> {
  receipt(input); const duration = leaseMs(input.leaseDurationMs);
  const q = `INSERT INTO ingest_runs(id,release_id,source_id,snapshot_id,adapter_version,upstream_release,raw_store_kind,raw_store_locator,raw_object_key,raw_object_sha256,raw_object_byte_size,raw_object_version_id,raw_object_etag,lease_token,heartbeat_at,lease_expires_at,started_at,status,extracted_count,staged_count,quarantined_count) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now()+($15::bigint * interval '1 millisecond'),now(),'running',$16,0,0 WHERE EXISTS(SELECT 1 FROM data_releases WHERE id=$2 AND status='candidate') AND EXISTS(SELECT 1 FROM sources WHERE release_id=$2 AND id=$3) AND EXISTS(SELECT 1 FROM source_snapshots WHERE release_id=$2 AND id=$4 AND source_id=$3 AND checksum_sha256=$10)`;
  const r = await db.query(q, [input.id,input.releaseId,input.sourceId,input.snapshotId,input.adapterVersion,input.upstreamRelease,input.rawStoreKind,input.rawStoreLocator,input.rawObjectKey,input.rawObjectSha256,input.rawObjectByteSize,input.rawObjectVersionId ?? null,input.rawObjectEtag ?? null,input.leaseToken,duration,input.extractedCount]);
  if (r.rowCount !== 1) throw new Error("Ingest runs require a candidate release and matching snapshot");
}
async function batch(db: Runner, id: string, token: string, column: "staged_count" | "quarantined_count", count: number, duration: number): Promise<void> { nonNegative(count,"count"); uuid(token); const r=await db.query(`UPDATE ingest_runs SET ${column}=${column}+$3,heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+($4::bigint * interval '1 millisecond') WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>clock_timestamp() AND staged_count+quarantined_count+$3<=extracted_count`,[id,token,count,leaseMs(duration)]); if(r.rowCount!==1) throw new Error(`Cannot record ${column} for ingest run ${id}`); }
export const recordStageBatch=(db:Runner,id:string,leaseToken:string,count:number,leaseDurationMs:number):Promise<void>=>batch(db,id,leaseToken,"staged_count",count,leaseDurationMs);
export const recordQuarantineBatch=(db:Runner,id:string,leaseToken:string,count:number,leaseDurationMs:number):Promise<void>=>batch(db,id,leaseToken,"quarantined_count",count,leaseDurationMs);
export async function heartbeat(db: Runner,id:string,leaseToken:string,leaseDurationMs:number):Promise<void>{ uuid(leaseToken); const r=await db.query("UPDATE ingest_runs SET heartbeat_at=clock_timestamp(),lease_expires_at=clock_timestamp()+($3::bigint * interval '1 millisecond') WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at>clock_timestamp()",[id,leaseToken,leaseMs(leaseDurationMs)]);if(r.rowCount!==1)throw new Error(`Cannot heartbeat ingest run ${id}`); }
async function transition(db:Runner,id:string,token:string,from:IngestStatus,to:IngestStatus,reconcile:boolean,failureCode?:IngestFailureCode):Promise<void>{uuid(token);const r=await db.query("UPDATE ingest_runs SET status=$3,completed_at=clock_timestamp(),lease_expires_at=NULL,failure_code=$4 WHERE id=$1 AND lease_token=$2 AND status=$5"+(from==="running"?" AND lease_expires_at>clock_timestamp()":"")+(reconcile?" AND staged_count+quarantined_count=extracted_count":""),[id,token,to,failureCode??null,from]);if(r.rowCount!==1)throw new Error(`Illegal or unreconciled ingest-run transition for ${id}`);}
export const markValidated=(db:Runner,id:string,token:string):Promise<void>=>transition(db,id,token,"running","validated",true);
export const markLoaded=(db:Runner,id:string,token:string):Promise<void>=>transition(db,id,token,"validated","loaded",false);
export const markFailed=(db:Runner,id:string,token:string):Promise<void>=>transition(db,id,token,"running","failed",false,"ingest_error");
export async function failExpiredRun(db:Runner,id:string,token:string):Promise<void>{uuid(token);const r=await db.query("UPDATE ingest_runs SET status='failed',completed_at=clock_timestamp(),lease_expires_at=NULL,failure_code='lease_expired' WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_expires_at<=clock_timestamp()",[id,token]);if(r.rowCount!==1)throw new Error(`Ingest run ${id} is not an expired lease`);}
