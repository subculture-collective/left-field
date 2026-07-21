import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;
let ingestPool: Pool | undefined;
let releasePreflightPool: Pool | undefined;
let releaseOperatorPool: Pool | undefined;

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

function configuredPool(variable: "INGEST_DATABASE_URL" | "RELEASE_PREFLIGHT_DATABASE_URL" | "RELEASE_OPERATOR_DATABASE_URL", slot: "ingest" | "preflight" | "operator"): Pool {
  const connectionString = process.env[variable];
  if (!connectionString) throw new Error(`${variable} is required for this privileged database operation`);
  if (slot === "ingest") return ingestPool ??= new Pool({ connectionString });
  if (slot === "preflight") return releasePreflightPool ??= new Pool({ connectionString });
  return releaseOperatorPool ??= new Pool({ connectionString });
}

/** These are intentionally separate from getPool(), which is safe for web use. */
export const getIngestPool = (): Pool => configuredPool("INGEST_DATABASE_URL", "ingest");
export const getReleasePreflightPool = (): Pool => configuredPool("RELEASE_PREFLIGHT_DATABASE_URL", "preflight");
export const getReleaseOperatorPool = (): Pool => configuredPool("RELEASE_OPERATOR_DATABASE_URL", "operator");

export async function closeDb(): Promise<void> {
  await pool?.end();
  await ingestPool?.end();
  await releasePreflightPool?.end();
  await releaseOperatorPool?.end();
  pool = undefined;
  ingestPool = undefined;
  releasePreflightPool = undefined;
  releaseOperatorPool = undefined;
  database = undefined;
}
