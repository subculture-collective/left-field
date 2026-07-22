import { closeDb, getIngestPool } from "@/db/client";
import { contentTableRegistry, enrichCandidateMembersFromBaseline, verifyPersistedTask6MemberCandidate } from "@/db/catalog-release";
import { releaseIdSchema } from "@/domain/contracts";
import type { Pool } from "pg";

export interface EnrichMemberArguments { readonly sourceReleaseId: string; readonly candidateReleaseId: string; readonly label: string; readonly createdAt?: string; }
export interface EnrichMemberResult { readonly sourceReleaseId: string; readonly candidateReleaseId: string; readonly status: "validated_candidate"; readonly memberCoverage: { readonly observed: number; readonly expected: number }; readonly biographicalFactCount: number; readonly committeeAssignmentCount: number; }

const argumentError = "Require exactly --source-release, --candidate-release, and --label, with optional --created-at";
const contentEmptySql = contentTableRegistry.map((table) => `NOT EXISTS(SELECT 1 FROM ${table.name} WHERE release_id=$1)`).join(" AND ");

export function parseEnrichMemberArguments(argv: readonly string[]): EnrichMemberArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]!;
    if (!['--source-release', '--candidate-release', '--label', '--created-at'].includes(key) || values.has(key) || !argv[index + 1] || argv[index + 1]!.startsWith('--')) throw new Error(argumentError);
    values.set(key, argv[++index]!);
  }
  const sourceReleaseId = values.get('--source-release'); const candidateReleaseId = values.get('--candidate-release'); const label = values.get('--label'); const createdAt = values.get('--created-at');
  if (!sourceReleaseId || !candidateReleaseId || !label || sourceReleaseId === candidateReleaseId || !releaseIdSchema.safeParse(sourceReleaseId).success || !releaseIdSchema.safeParse(candidateReleaseId).success || (createdAt !== undefined && Number.isNaN(Date.parse(createdAt)))) throw new Error(argumentError);
  return { sourceReleaseId, candidateReleaseId, label, ...(createdAt === undefined ? {} : { createdAt: new Date(createdAt).toISOString() }) };
}

type ReleaseRow = { id: string; label: string; status: string; source_cutoff: Date | string; previous_release_id: string | null };
async function cleanupNewShell(pool: Pool, releaseId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [releaseId]);
    await client.query(`DELETE FROM data_releases WHERE id=$1 AND status='candidate' AND ${contentEmptySql}`, [releaseId]);
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK").catch(() => undefined); } finally { client.release(); }
}

export interface EnrichMemberDependencies { readonly getPool: () => Pool; readonly enrich?: typeof enrichCandidateMembersFromBaseline; readonly verify?: typeof verifyPersistedTask6MemberCandidate; readonly now?: () => Date; }

export async function executeEnrichMembers(argv: readonly string[], dependencies: EnrichMemberDependencies): Promise<EnrichMemberResult> {
  const args = parseEnrichMemberArguments(argv); const pool = dependencies.getPool();
  const sourceResult = await pool.query<Pick<ReleaseRow, "id" | "status" | "source_cutoff"> & { schema_version: number }>("SELECT r.id,r.status,r.source_cutoff,m.schema_version FROM data_releases r JOIN release_manifests m ON m.release_id=r.id WHERE r.id=$1", [args.sourceReleaseId]);
  if (sourceResult.rowCount !== 1 || sourceResult.rows[0]!.schema_version !== 2 || !["published", "retired"].includes(sourceResult.rows[0]!.status)) throw new Error("Source must be a published or retired schema v2 release");
  const cutoff = new Date(sourceResult.rows[0]!.source_cutoff).toISOString();
  const candidateResult = await pool.query<ReleaseRow>("SELECT id,label,status,source_cutoff,previous_release_id FROM data_releases WHERE id=$1", [args.candidateReleaseId]);
  let created = false;
  if (candidateResult.rowCount === 0) {
    await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,$2,'candidate',$3,$4,NULL,$5)", [args.candidateReleaseId, args.label, cutoff, args.createdAt ?? dependencies.now?.().toISOString() ?? new Date().toISOString(), args.sourceReleaseId]);
    created = true;
  } else {
    const candidate = candidateResult.rows[0]!;
    if (candidate.status !== "candidate" || candidate.label !== args.label || new Date(candidate.source_cutoff).toISOString() !== cutoff || candidate.previous_release_id !== args.sourceReleaseId) throw new Error("Existing candidate does not match the requested shell");
    try {
      const summary = await (dependencies.verify ?? verifyPersistedTask6MemberCandidate)(pool, args.candidateReleaseId, args.sourceReleaseId);
      return { sourceReleaseId: args.sourceReleaseId, candidateReleaseId: args.candidateReleaseId, status: "validated_candidate", memberCoverage: { observed: summary.observed, expected: summary.expected }, biographicalFactCount: summary.biographicalFactCount, committeeAssignmentCount: summary.committeeAssignmentCount };
    } catch { /* an existing non-empty candidate is only acceptable if exact verification succeeds */ }
    const empty = await pool.query<{ empty: boolean }>(`SELECT ${contentEmptySql} AS empty`, [args.candidateReleaseId]);
    if (!empty.rows[0]?.empty) throw new Error("Existing candidate is partial or does not have valid Task 6 enrichment");
  }
  try {
    await (dependencies.enrich ?? enrichCandidateMembersFromBaseline)(pool, args.sourceReleaseId, args.candidateReleaseId);
    const summary = await (dependencies.verify ?? verifyPersistedTask6MemberCandidate)(pool, args.candidateReleaseId, args.sourceReleaseId);
    return { sourceReleaseId: args.sourceReleaseId, candidateReleaseId: args.candidateReleaseId, status: "validated_candidate", memberCoverage: { observed: summary.observed, expected: summary.expected }, biographicalFactCount: summary.biographicalFactCount, committeeAssignmentCount: summary.committeeAssignmentCount };
  } catch (error) { if (created) await cleanupNewShell(pool, args.candidateReleaseId); throw error; }
}

export async function main(argv = process.argv.slice(2), dependencies: EnrichMemberDependencies & { readonly stdout?: Pick<NodeJS.WriteStream, "write"> } = { getPool: getIngestPool }): Promise<EnrichMemberResult> { const result = await executeEnrichMembers(argv, dependencies); (dependencies.stdout ?? process.stdout).write(`${JSON.stringify(result)}\n`); return result; }
if (require.main === module) main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Member enrichment failed"}\n`); process.exitCode = 1; }).finally(closeDb);
