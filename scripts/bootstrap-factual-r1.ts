import { Pool, type PoolClient } from "pg";
import { isoDateSchema, releaseIdSchema } from "@/domain/contracts";

const fixedCutoff = "2026-07-18";
const argumentError = `Require exactly --release rel_..., --label TEXT, and --cutoff ${fixedCutoff}`;

export interface BootstrapFactualR1Arguments {
  readonly release: string;
  readonly label: string;
  readonly cutoff: typeof fixedCutoff;
}

export interface BootstrapFactualR1Result extends BootstrapFactualR1Arguments {
  readonly status: "created" | "already_prepared";
  readonly sources: readonly ["identity", "tiger"];
}

interface ReleaseRow {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly source_cutoff: Date | string;
  readonly published_at: Date | string | null;
  readonly previous_release_id: string | null;
}

interface SourceRow {
  readonly id: string;
  readonly name: string;
  readonly authority: string;
  readonly homepage_url: string;
}

const expectedSources: readonly SourceRow[] = [
  { id: "src_identity", name: "identity", authority: "derived", homepage_url: "https://clerk.house.gov/" },
  { id: "src_tiger", name: "tiger", authority: "derived", homepage_url: "https://www.census.gov/" },
];

function getBootstrapPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for factual R1 bootstrap");
  return new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
    lock_timeout: 1_000,
  });
}

export function parseBootstrapFactualR1Arguments(argv: readonly string[]): BootstrapFactualR1Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !["--release", "--label", "--cutoff"].includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error(argumentError);
    values.set(key, value);
  }
  const release = values.get("--release"), label = values.get("--label"), cutoff = values.get("--cutoff");
  if (!release || !releaseIdSchema.safeParse(release).success || !label?.trim() || label !== label.trim() || !cutoff || !isoDateSchema.safeParse(cutoff).success || cutoff !== fixedCutoff) throw new Error(argumentError);
  return { release, label, cutoff };
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function sourcesMatch(rows: readonly SourceRow[]): boolean {
  const canonical = (values: readonly SourceRow[]) => JSON.stringify([...values].sort((left, right) => left.name.localeCompare(right.name)));
  return canonical(rows) === canonical(expectedSources);
}

async function assertEmptyCandidate(client: PoolClient, release: string): Promise<void> {
  const residue = await client.query<{ found: boolean }>(`
    SELECT (
      EXISTS(SELECT 1 FROM source_snapshots WHERE release_id=$1)
      OR EXISTS(SELECT 1 FROM ingest_runs WHERE release_id=$1)
      OR EXISTS(SELECT 1 FROM release_manifests WHERE release_id=$1)
      OR EXISTS(SELECT 1 FROM offices WHERE release_id=$1)
      OR EXISTS(SELECT 1 FROM geography_versions WHERE release_id=$1)
      OR EXISTS(SELECT 1 FROM nationwide_validation_gates WHERE release_id=$1)
    ) AS found
  `, [release]);
  if (residue.rows[0]?.found) throw new Error("Existing factual R1 candidate contains staged or finalized data");
}

export async function bootstrapFactualR1(
  args: BootstrapFactualR1Arguments,
  dependencies: { readonly pool: Pool; readonly now?: () => Date },
): Promise<BootstrapFactualR1Result> {
  const client = await dependencies.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [args.release]);
    const releaseResult = await client.query<ReleaseRow>(
      "SELECT id,label,status,source_cutoff,published_at,previous_release_id FROM data_releases WHERE id=$1",
      [args.release],
    );
    if (releaseResult.rowCount === 0) {
      await client.query(
        "INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,$2,'candidate',$3,$4,NULL,NULL)",
        [args.release, args.label, `${args.cutoff}T00:00:00.000Z`, (dependencies.now ?? (() => new Date()))().toISOString()],
      );
      await client.query(
        "INSERT INTO sources(id,release_id,name,authority,homepage_url) VALUES('src_identity',$1,'identity','derived','https://clerk.house.gov/'),('src_tiger',$1,'tiger','derived','https://www.census.gov/')",
        [args.release],
      );
      await client.query("COMMIT");
      return { ...args, status: "created", sources: ["identity", "tiger"] };
    }

    const release = releaseResult.rows[0]!;
    if (
      release.id !== args.release
      || release.label !== args.label
      || release.status !== "candidate"
      || iso(release.source_cutoff) !== `${args.cutoff}T00:00:00.000Z`
      || release.published_at !== null
      || release.previous_release_id !== null
    ) throw new Error("Existing factual R1 release does not match the requested empty candidate");

    const sourceResult = await client.query<SourceRow>(
      "SELECT id,name,authority,homepage_url FROM sources WHERE release_id=$1 ORDER BY name",
      [args.release],
    );
    if (!sourcesMatch(sourceResult.rows)) throw new Error("Existing factual R1 sources do not match the required identity and TIGER registrations");
    await assertEmptyCandidate(client, args.release);
    await client.query("COMMIT");
    return { ...args, status: "already_prepared", sources: ["identity", "tiger"] };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function executeBootstrapFactualR1(
  argv: readonly string[],
  dependencies: { readonly getPool: () => Pool; readonly now?: () => Date } = { getPool: getBootstrapPool },
): Promise<BootstrapFactualR1Result> {
  return bootstrapFactualR1(parseBootstrapFactualR1Arguments(argv), { pool: dependencies.getPool(), now: dependencies.now });
}

export async function main(
  argv = process.argv.slice(2),
  dependencies: {
    readonly getPool: () => Pool;
    readonly now?: () => Date;
    readonly stdout?: Pick<NodeJS.WriteStream, "write">;
    readonly closePool?: (pool: Pool) => Promise<void>;
  } = { getPool: getBootstrapPool, closePool: (pool) => pool.end() },
): Promise<void> {
  const pool = dependencies.getPool();
  try {
    const result = await bootstrapFactualR1(parseBootstrapFactualR1Arguments(argv), { pool, now: dependencies.now });
    (dependencies.stdout ?? process.stdout).write(`${JSON.stringify(result)}\n`);
  } finally {
    await dependencies.closePool?.(pool);
  }
}

if (process.argv[1]?.endsWith("bootstrap-factual-r1.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Factual R1 bootstrap failed"}\n`);
    process.exitCode = 1;
  });
}
