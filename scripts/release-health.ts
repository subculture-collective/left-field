import { Pool, type PoolConfig } from "pg";
import { releaseIdSchema } from "@/domain/contracts";
import { inspectReleaseHealth, type ReleaseHealthReport } from "@/operations/release-health";

export interface ReleaseHealthCliDependencies { readonly createPool: (config: PoolConfig) => Pick<Pool, "end" | "connect">; }
export interface ReleaseHealthEnvironment { readonly RELEASE_PREFLIGHT_DATABASE_URL?: string; readonly [name: string]: string | undefined; }

export function parseReleaseHealthArguments(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--release" || !releaseIdSchema.safeParse(argv[1]).success || !/^rel_[A-Za-z0-9_-]+$/.test(argv[1]!)) throw new Error("Require exactly --release rel_...");
  return argv[1]!;
}

/** This CLI deliberately accepts only the restricted preflight connection. */
export function releaseHealthPoolConfig(env: ReleaseHealthEnvironment): PoolConfig {
  const value = env.RELEASE_PREFLIGHT_DATABASE_URL;
  if (!value) throw new Error("RELEASE_PREFLIGHT_DATABASE_URL is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("RELEASE_PREFLIGHT_DATABASE_URL must be a PostgreSQL URL"); }
  if (!(["postgres:", "postgresql:"] as const).includes(url.protocol as "postgres:" | "postgresql:") || !url.username) throw new Error("RELEASE_PREFLIGHT_DATABASE_URL must be a PostgreSQL URL with a LOGIN username");
  return { connectionString: value };
}

export async function executeReleaseHealth(argv: readonly string[], env: ReleaseHealthEnvironment, dependencies: ReleaseHealthCliDependencies = { createPool: config => new Pool(config) }): Promise<ReleaseHealthReport> {
  const releaseId = parseReleaseHealthArguments(argv);
  const pool = dependencies.createPool(releaseHealthPoolConfig(env));
  try { return await inspectReleaseHealth(pool as Pool, releaseId); } finally { await pool.end(); }
}

export function releaseHealthExitCode(report: Pick<ReleaseHealthReport, "repositoryStatus">): 0 | 1 { return report.repositoryStatus === "pass" ? 0 : 1; }

export async function main(argv = process.argv.slice(2), env: ReleaseHealthEnvironment = process.env as ReleaseHealthEnvironment, dependencies?: ReleaseHealthCliDependencies): Promise<ReleaseHealthReport> {
  const report = await executeReleaseHealth(argv, env, dependencies);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (releaseHealthExitCode(report) === 1) process.exitCode = 1;
  return report;
}

if (process.argv[1]?.endsWith("release-health.ts")) void main().catch(() => { process.stderr.write("Release health check failed\n"); process.exitCode = 1; });
