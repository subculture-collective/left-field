import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;
let ingestPool: Pool | undefined;
let releasePreflightPool: Pool | undefined;
let releaseOperatorPool: Pool | undefined;
let correctionPool: Pool | undefined;
let addressPool: Pool | undefined;

/** Returns one process-wide pool; DATABASE_URL is read only when first requested. */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required to connect to PostgreSQL");
    pool ??= new Pool({ connectionString });
    database = drizzle(pool, { schema });
  }
  return database;
}

export function getPool(): Pool {
  getDb();
  return pool!;
}

function configuredPool(variable: "INGEST_DATABASE_URL" | "RELEASE_PREFLIGHT_DATABASE_URL" | "RELEASE_OPERATOR_DATABASE_URL" | "CORRECTION_DATABASE_URL", slot: "ingest" | "preflight" | "operator" | "correction"): Pool {
  const connectionString = process.env[variable];
  if (!connectionString) throw new Error(`${variable} is required for this privileged database operation`);
  if (slot === "ingest") return ingestPool ??= new Pool({ connectionString });
  if (slot === "preflight") return releasePreflightPool ??= new Pool({ connectionString });
  if (slot === "correction") return correctionPool ??= new Pool({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: 5_000, lock_timeout: 1_000, query_timeout: 5_000 });
  return releaseOperatorPool ??= new Pool({ connectionString });
}

/** These are intentionally separate from getPool(), which is safe for web use. */
export const getIngestPool = (): Pool => configuredPool("INGEST_DATABASE_URL", "ingest");
export const getReleasePreflightPool = (): Pool => configuredPool("RELEASE_PREFLIGHT_DATABASE_URL", "preflight");
export const getReleaseOperatorPool = (): Pool => configuredPool("RELEASE_OPERATOR_DATABASE_URL", "operator");
/** Separate constrained connection for correction intake/review/maintenance roles. */
export const getCorrectionPool = (): Pool => configuredPool("CORRECTION_DATABASE_URL", "correction");
/** Separate, bounded runtime connection which only has the address lookup role. */
export function getAddressPool(): Pool {
  const connectionString = process.env.ADDRESS_DATABASE_URL;
  if (!connectionString) throw new Error("ADDRESS_DATABASE_URL is required for address admission");
  return addressPool ??= new Pool({ connectionString, max: 8, connectionTimeoutMillis: 5_000, statement_timeout: 5_000, lock_timeout: 1_000, query_timeout: 5_000, idleTimeoutMillis: 30_000 });
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  await ingestPool?.end();
  await releasePreflightPool?.end();
  await releaseOperatorPool?.end();
  await correctionPool?.end();
  await addressPool?.end();
  pool = undefined;
  ingestPool = undefined;
  releasePreflightPool = undefined;
  releaseOperatorPool = undefined;
  correctionPool = undefined;
  addressPool = undefined;
  database = undefined;
}
