import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

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

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
