import { Pool } from "pg";

/** Bounded server-only readiness probe; never exposes connection details. */
export async function isolatedDatabaseReady(connectionString: string | undefined): Promise<boolean> {
  if (!connectionString) return false;
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 1_000, idleTimeoutMillis: 1_000 });
  try { await pool.query("SELECT 1"); return true; }
  catch { return false; }
  finally { await pool.end().catch(() => undefined); }
}
