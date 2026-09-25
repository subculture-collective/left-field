import { Pool } from "pg";

import { buildNationwideSourceRegistry } from "@/office-universe/nationwide-intake";
import { seedSourceRegistry } from "@/office-universe/repository";

async function main(): Promise<void> {
  const connectionString = process.env.OFFICE_UNIVERSE_DATABASE_URL;
  if (!connectionString) throw new Error("OFFICE_UNIVERSE_DATABASE_URL is required; no database is selected implicitly");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
  try {
    const { inserted, existing } = await seedSourceRegistry(pool, buildNationwideSourceRegistry());
    process.stdout.write(`Office-universe source registry: inserted ${inserted}, existing ${existing} (insert-only; existing rows untouched).\n`);
  } finally {
    await pool.end();
  }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "OFFICE_UNIVERSE_REGISTRY_SEED_FAILED"}\n`); process.exitCode = 1; });
