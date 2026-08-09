import { Pool, type PoolConfig } from "pg";
import { CorrectionMaintenanceRepository } from "@/corrections/repository";

export type CorrectionMaintenanceArguments = Readonly<{ operation: "cleanup" }>;
type MaintenanceRepository = Pick<CorrectionMaintenanceRepository, "cleanup">;

export function parseCorrectionMaintenanceArguments(argv: readonly string[]): CorrectionMaintenanceArguments {
  if (argv.length !== 1 || argv[0] !== "cleanup") throw new Error("Require cleanup operation");
  return { operation: "cleanup" };
}

export function correctionMaintenancePoolConfig(env: Readonly<Record<string, string | undefined>>): PoolConfig {
  const connectionString = env.CORRECTION_MAINTENANCE_DATABASE_URL;
  if (!connectionString) throw new Error("CORRECTION_MAINTENANCE_DATABASE_URL is required");
  const url = new URL(connectionString);
  if (!(url.protocol === "postgres:" || url.protocol === "postgresql:") || !url.username) throw new Error("CORRECTION_MAINTENANCE_DATABASE_URL must be a PostgreSQL URL with a LOGIN username");
  return { connectionString, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 15_000, lock_timeout: 1_000, query_timeout: 15_000 };
}

export async function executeCorrectionMaintenance(
  args: CorrectionMaintenanceArguments,
  repository: MaintenanceRepository,
): Promise<Readonly<{ operation: "cleanup"; idempotencyDeleted: number; rateBucketsDeleted: number }>> {
  if (args.operation !== "cleanup") throw new Error("Require cleanup operation");
  const result = await repository.cleanup();
  if (![result.idempotencyDeleted, result.rateBucketsDeleted].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("Invalid correction maintenance result");
  return { operation: "cleanup", ...result };
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> {
  const args = parseCorrectionMaintenanceArguments(argv);
  const pool = new Pool(correctionMaintenancePoolConfig(env));
  try {
    const result = await executeCorrectionMaintenance(args, new CorrectionMaintenanceRepository(pool));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("maintain-corrections.ts")) void main().catch(() => {
  process.stderr.write("Correction maintenance failed\n");
  process.exitCode = 1;
});
