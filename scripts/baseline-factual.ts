import { closeDb, getNationwideFinalizerPool } from "@/db/client";
import { baselineCandidateRelease, contentDomains, validateNationwideCandidateReleaseWithClient } from "@/db/catalog-release";
import { releaseIdSchema } from "@/domain/contracts";
import type { Pool, PoolClient } from "pg";

const argumentError =
  "Require exactly --source-release rel_..., --candidate-release rel_..., and --label TEXT";

export interface BaselineFactualArguments {
  readonly sourceReleaseId: string;
  readonly candidateReleaseId: string;
  readonly label: string;
  readonly createdAt?: string;
}

export interface BaselineFactualResult {
  readonly sourceReleaseId: string;
  readonly candidateReleaseId: string;
  readonly status: "baselined_candidate" | "already_baselined";
  readonly digestDomains: number;
}

interface ReleaseRow {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly source_cutoff: Date | string;
  readonly published_at: Date | string | null;
  readonly previous_release_id: string | null;
  readonly schema_version: number;
}

type Queryable = Pick<PoolClient, "query">;

export function parseBaselineFactualArguments(argv: readonly string[]): BaselineFactualArguments {
  const values = new Map<string, string>();
  const allowed = new Set(["--source-release", "--candidate-release", "--label", "--created-at"]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!key || !allowed.has(key) || values.has(key) || !value || value.startsWith("--")) {
      throw new Error(argumentError);
    }
    values.set(key, value);
  }
  const sourceReleaseId = values.get("--source-release");
  const candidateReleaseId = values.get("--candidate-release");
  const label = values.get("--label");
  const rawCreatedAt = values.get("--created-at");
  const parsedCreatedAt = rawCreatedAt === undefined ? undefined : Date.parse(rawCreatedAt);
  if (
    !sourceReleaseId
    || !candidateReleaseId
    || !releaseIdSchema.safeParse(sourceReleaseId).success
    || !releaseIdSchema.safeParse(candidateReleaseId).success
    || sourceReleaseId === candidateReleaseId
    || !label
    || label !== label.trim()
    || label.length > 200
    || (parsedCreatedAt !== undefined && Number.isNaN(parsedCreatedAt))
  ) {
    throw new Error(argumentError);
  }
  const createdAt = parsedCreatedAt === undefined ? undefined : new Date(parsedCreatedAt).toISOString();
  return {
    sourceReleaseId,
    candidateReleaseId,
    label,
    ...(createdAt ? { createdAt } : {}),
  };
}

const iso = (value: Date | string): string => new Date(value).toISOString();

async function loadSource(pool: Queryable, releaseId: string): Promise<ReleaseRow> {
  const result = await pool.query<ReleaseRow>(
    `SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,r.previous_release_id,m.schema_version
       FROM data_releases r
       JOIN release_manifests m ON m.release_id=r.id
      WHERE r.id=$1`,
    [releaseId],
  );
  const source = result.rows[0];
  if (
    result.rowCount !== 1
    || !source
    || !["published", "retired"].includes(source.status)
    || source.schema_version !== 2
  ) {
    throw new Error("Factual baseline requires a published or retired schema-v2 source release");
  }
  return source;
}

async function verifyCandidateIdentity(
  pool: Queryable,
  args: BaselineFactualArguments,
  source: ReleaseRow,
): Promise<void> {
  const result = await pool.query<ReleaseRow>(
    `SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,r.previous_release_id,m.schema_version
       FROM data_releases r
       JOIN release_manifests m ON m.release_id=r.id
      WHERE r.id=$1`,
    [args.candidateReleaseId],
  );
  const candidate = result.rows[0];
  if (
    result.rowCount !== 1
    || !candidate
    || candidate.label !== args.label
    || candidate.status !== "candidate"
    || candidate.published_at !== null
    || candidate.previous_release_id !== source.id
    || candidate.schema_version !== 2
    || iso(candidate.source_cutoff) !== iso(source.source_cutoff)
  ) {
    throw new Error("Existing factual candidate does not match the requested immutable baseline");
  }
}

async function verifyExistingCandidate(
  pool: Queryable,
  args: BaselineFactualArguments,
  source: ReleaseRow,
): Promise<void> {
  await verifyCandidateIdentity(pool, args, source);
  const parity = await pool.query<{ mismatch_count: number | string; domain_count: number | string }>(
    `WITH source_digests AS (
       SELECT domain,row_count,sha256 FROM release_content_digests WHERE release_id=$1
     ), candidate_digests AS (
       SELECT domain,row_count,sha256 FROM release_content_digests WHERE release_id=$2
     ), mismatches AS (
       (SELECT * FROM source_digests EXCEPT SELECT * FROM candidate_digests)
       UNION ALL
       (SELECT * FROM candidate_digests EXCEPT SELECT * FROM source_digests)
     )
     SELECT
       (SELECT count(*) FROM mismatches) mismatch_count,
       (SELECT count(*) FROM candidate_digests) domain_count`,
    [source.id, args.candidateReleaseId],
  );
  const gate = await pool.query(
    "SELECT 1 FROM nationwide_validation_gates WHERE release_id=$1 AND schema_version=2",
    [args.candidateReleaseId],
  );
  if (
    Number(parity.rows[0]?.mismatch_count) !== 0
    || Number(parity.rows[0]?.domain_count) !== Object.keys(contentDomains).length
    || gate.rowCount !== 1
  ) {
    throw new Error("Existing factual candidate is partial or differs from its predecessor");
  }
}

async function validateAndVerifyCandidate(pool: Pool, args: BaselineFactualArguments, source: ReleaseRow): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await validateNationwideCandidateReleaseWithClient(client, args.candidateReleaseId);
    await verifyExistingCandidate(client, args, source);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyExactEmptyShell(
  pool: Queryable,
  args: BaselineFactualArguments,
  source: ReleaseRow,
): Promise<void> {
  const result = await pool.query<ReleaseRow & { has_manifest: boolean; has_runs: boolean; has_sources: boolean }>(
    `SELECT r.id,r.label,r.status,r.source_cutoff,r.published_at,r.previous_release_id,
            0 schema_version,
            EXISTS(SELECT 1 FROM release_manifests m WHERE m.release_id=r.id) has_manifest,
            EXISTS(SELECT 1 FROM ingest_runs i WHERE i.release_id=r.id) has_runs,
            EXISTS(SELECT 1 FROM sources s WHERE s.release_id=r.id) has_sources
       FROM data_releases r
      WHERE r.id=$1`,
    [args.candidateReleaseId],
  );
  const shell = result.rows[0];
  if (
    result.rowCount !== 1
    || !shell
    || shell.label !== args.label
    || shell.status !== "candidate"
    || shell.published_at !== null
    || shell.previous_release_id !== source.id
    || iso(shell.source_cutoff) !== iso(source.source_cutoff)
    || shell.has_manifest
    || shell.has_runs
    || shell.has_sources
  ) {
    throw new Error("Existing factual candidate does not match an exact restart-safe empty shell");
  }
}

export async function executeBaselineFactual(
  argv: readonly string[],
  dependencies: {
    readonly getPool: () => Pool;
    readonly baseline?: typeof baselineCandidateRelease;
    readonly validate?: (pool: Pool, releaseId: string) => Promise<void>;
    readonly now?: () => Date;
  },
): Promise<BaselineFactualResult> {
  const args = parseBaselineFactualArguments(argv);
  const pool = dependencies.getPool();
  const source = await loadSource(pool, args.sourceReleaseId);
  const existing = await pool.query<{ id: string; has_manifest: boolean }>(
    "SELECT id,EXISTS(SELECT 1 FROM release_manifests m WHERE m.release_id=data_releases.id) has_manifest FROM data_releases WHERE id=$1",
    [args.candidateReleaseId],
  );
  if (existing.rowCount) {
    if (existing.rows[0]!.has_manifest) {
      await verifyCandidateIdentity(pool, args, source);
      if (dependencies.validate) {
        await dependencies.validate(pool, args.candidateReleaseId);
        await verifyExistingCandidate(pool, args, source);
      } else {
        await validateAndVerifyCandidate(pool, args, source);
      }
      return {
        sourceReleaseId: source.id,
        candidateReleaseId: args.candidateReleaseId,
        status: "already_baselined",
        digestDomains: Object.keys(contentDomains).length,
      };
    }
    await verifyExactEmptyShell(pool, args, source);
  } else {
    await pool.query(
      `INSERT INTO data_releases(id,label,status,source_cutoff,created_at,previous_release_id)
       VALUES($1,$2,'candidate',$3,$4,$5)`,
      [
        args.candidateReleaseId,
        args.label,
        source.source_cutoff,
        args.createdAt ?? dependencies.now?.().toISOString() ?? new Date().toISOString(),
        source.id,
      ],
    );
  }

  // A failed clone rolls back its own transaction and deliberately leaves the
  // exact empty shell for a safe retry. The finalizer never receives DELETE or
  // lifecycle UPDATE authority on data_releases.
  await (dependencies.baseline ?? baselineCandidateRelease)(
    pool,
    source.id,
    args.candidateReleaseId,
  );
  if (dependencies.validate) {
    await dependencies.validate(pool, args.candidateReleaseId);
    await verifyExistingCandidate(pool, args, source);
  } else {
    await validateAndVerifyCandidate(pool, args, source);
  }
  return {
    sourceReleaseId: source.id,
    candidateReleaseId: args.candidateReleaseId,
    status: "baselined_candidate",
    digestDomains: Object.keys(contentDomains).length,
  };
}

export async function main(
  argv = process.argv.slice(2),
  dependencies: Parameters<typeof executeBaselineFactual>[1] & {
    readonly stdout?: Pick<NodeJS.WriteStream, "write">;
  } = { getPool: getNationwideFinalizerPool },
): Promise<BaselineFactualResult> {
  const result = await executeBaselineFactual(argv, dependencies);
  (dependencies.stdout ?? process.stdout).write(`${JSON.stringify(result)}\n`);
  return result;
}

if (require.main === module) {
  main()
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Factual baseline failed"}\n`);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
