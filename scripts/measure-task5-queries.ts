/** Synthetic query-shape evidence only. Never points at a non-disposable database. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type QueryResultRow } from "pg";

import { seedNationwideCandidateManifest, type BoundaryBundle } from "@/db/manifest";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { collectProfileSnapshotSeedIds } from "@/domain/repository";
import { buildSeatListStatement, listSeatPage } from "@/repositories/sql/list-seats";
import { __sql, getSeatProfile } from "@/repositories/sql/get-seat-profile";
import { nationwideSkeleton } from "@/test/fixtures/nationwide-skeleton";

// Keep the profile hot set at 5,000 rows while bounding trigger-protected
// background fixture creation so this evidence remains suitable for CI.
const ROWS = 100_000;
const LIST_P95_MS = 2_000;
const PROFILE_P95_MS = 8_000;
// Measurement includes a deliberately extreme 5k-fact profile. Public profile
// transactions retain their stricter independent 10-second runtime deadline.
const TIMEOUT_MS = 15_000;
const SEAT_CATALOG_SIZE = 541;
const EVIDENCE_SCHEMA_VERSION = 1;
const EVIDENCE_LABEL = "SYNTHETIC query-shape evidence; not semantic validation or production benchmarking.";
const EVIDENCE_PATH = resolve("docs/reviews/phase-1-r1-query-plans.json");

export type QueryEvidenceMode = "write" | "verify";
type EvidenceContract = {
  schemaVersion: number;
  label: string;
  rowCounts: { acsObservations: number; acsObservationLineage: number; seats: number };
  budgets: { statementTimeoutMs: number; listP95Ms: number; profileP95Ms: number; browseMaxRows: number; listJoinMaxRows: number; denseProfileMaxFacts: number };
  sourceHashes: { profileSqlSha256: string; closureSqlSha256: string };
  statementCounts: { getSeatProfile: number };
  closureSeedCount: number;
};

type PlanNode = Record<string, unknown>;
type PlanNodeSummary = {
  nodeType: string;
  relation?: string;
  index?: string;
  joinType?: string;
  planRows: number;
  actualRows: number;
  loops: number;
  filter?: string;
  joinFilter?: string;
  hashCond?: string;
  mergeCond?: string;
  indexCond?: string;
};
type PlanNodeStringKey = "relation" | "index" | "joinType" | "filter" | "joinFilter" | "hashCond" | "mergeCond" | "indexCond";

/** CLOSURE_SQL deliberately receives only the complete profile's snapshot-id array. */
export function closureMeasurementValues(releaseId: string, completeProfile: unknown): readonly [string, readonly string[]] {
  const seedIds = collectProfileSnapshotSeedIds(completeProfile);
  if (seedIds.length === 0) throw new Error("complete profile did not provide closure snapshot seeds");
  return [releaseId, seedIds];
}

export function queryEvidenceMode(value?: string): QueryEvidenceMode {
  if (value === undefined || value === "write") return "write";
  if (value === "verify") return value;
  throw new Error("QUERY_EVIDENCE_MODE must be write or verify");
}

export function assertEvidenceContract(artifact: unknown, expected: EvidenceContract): void {
  if (typeof artifact !== "object" || artifact === null) throw new Error("query evidence artifact must be an object");
  const actual = artifact as Record<string, unknown>;
  for (const key of ["schemaVersion", "label", "rowCounts", "budgets", "sourceHashes", "statementCounts", "closureSeedCount"] as const) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) throw new Error(`query evidence ${key} does not match the current measurement contract`);
  }
}

export async function writeOrVerifyEvidence(mode: QueryEvidenceMode, evidence: EvidenceContract & Record<string, unknown>, path = EVIDENCE_PATH): Promise<void> {
  if (mode === "verify") {
    assertEvidenceContract(JSON.parse(await readFile(path, "utf8")), evidence);
    return;
  }
  await mkdir(resolve("docs/reviews"), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function measureFullProfile(pool: Pool, releaseId: string, seatId: string): Promise<{ profile: Awaited<ReturnType<typeof getSeatProfile>>; statementCount: number }> {
  const client = await pool.connect();
  let statementCount = 0;
  try {
    const query = <T extends QueryResultRow>(text: string, values?: readonly unknown[]) => {
      statementCount += 1;
      return client.query<T>(text, values as unknown[] | undefined);
    };
    const profile = await getSeatProfile({ query } as Parameters<typeof getSeatProfile>[0], releaseId as never, seatId as never);
    return { profile, statementCount };
  } finally {
    client.release();
  }
}

function assertTestUrl(value: string | undefined): string {
  if (!value) throw new Error("TEST_DATABASE_URL is required and must name a disposable *_test database");
  const name = new URL(value).pathname.slice(1);
  if (!/(?:_test|_test_[a-z0-9_]+)$/i.test(name)) throw new Error("TEST_DATABASE_URL must name a disposable *_test database");
  return value;
}
function p95(samples: readonly number[]): number { return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * .95) - 1]!; }
function boundaryFixture() {
  const manifest = structuredClone(nationwideSkeleton());
  const features = manifest.geographyVersions.map((g, index) => ({ type: "Feature", properties: { sourceGeoid: g.sourceGeoid, stateCode: g.stateCode, districtCode: g.kind === "house_district" ? g.districtCode : null }, geometry: { type: "MultiPolygon", coordinates: [[[[(-1800 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10], [(-1799 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10], [(-1799 + index % 3600) / 10, (-899 + Math.floor(index / 3600)) / 10], [(-1800 + index % 3600) / 10, (-899 + Math.floor(index / 3600)) / 10], [(-1800 + index % 3600) / 10, (-900 + Math.floor(index / 3600)) / 10]]]] } }));
  const bytes = JSON.stringify({ type: "FeatureCollection", features });
  manifest.geometryArtifacts[0]!.checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  return { manifest, boundaries: [{ artifactId: manifest.geometryArtifacts[0]!.id, objectKey: manifest.geometryArtifacts[0]!.objectKey, bytes }] satisfies BoundaryBundle };
}
function sanitizedCondition(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Plans are collected only against the synthetic fixture. Redact literal values so
  // the review artifact cannot become a channel for connection or source data.
  return value.replace(/'(?:[^']|'')*'/g, "'<literal>'").replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "<uuid>");
}

function nodeSummary(node: PlanNode): PlanNodeSummary {
  const summary: PlanNodeSummary = {
    nodeType: String(node["Node Type"] ?? "Unknown"),
    planRows: Number(node["Plan Rows"] ?? 0),
    actualRows: Number(node["Actual Rows"] ?? 0),
    loops: Number(node["Actual Loops"] ?? 0),
  };
  const optionalFields: Array<[PlanNodeStringKey, string]> = [["relation", "Relation Name"], ["index", "Index Name"], ["joinType", "Join Type"], ["filter", "Filter"], ["joinFilter", "Join Filter"], ["hashCond", "Hash Cond"], ["mergeCond", "Merge Cond"], ["indexCond", "Index Cond"]];
  for (const [key, field] of optionalFields) {
    const value = ["filter", "joinFilter", "hashCond", "mergeCond", "indexCond"].includes(key) ? sanitizedCondition(node[field]) : node[field];
    if (typeof value === "string") summary[key] = value;
  }
  return summary;
}

function isJoinNode(node: PlanNode): boolean {
  return node["Join Type"] !== undefined || /(?:^| )Join$|^Nested Loop$/.test(String(node["Node Type"] ?? ""));
}

function summarize(plan: unknown) {
  const root = (plan as Array<Record<string, unknown>>)[0]!.Plan;
  let maxPlanRows = 0, maxActualRows = 0, sharedHit = 0, sharedRead = 0;
  const nodes: PlanNodeSummary[] = [];
  const joinActualRows: number[] = [];
  const walk = (node: PlanNode): void => { maxPlanRows = Math.max(maxPlanRows, Number(node["Plan Rows"] ?? 0)); maxActualRows = Math.max(maxActualRows, Number(node["Actual Rows"] ?? 0)); sharedHit += Number(node["Shared Hit Blocks"] ?? 0); sharedRead += Number(node["Shared Read Blocks"] ?? 0); nodes.push(nodeSummary(node)); if (isJoinNode(node)) joinActualRows.push(Number(node["Actual Rows"] ?? 0)); for (const child of (node.Plans as PlanNode[] | undefined) ?? []) walk(child); };
  walk(root as Record<string, unknown>);
  return { planningMs: (plan as Array<Record<string, number>>)[0]!["Planning Time"], executionMs: (plan as Array<Record<string, number>>)[0]!["Execution Time"], maxPlanRows, maxActualRows, rootActualRows: Number((root as PlanNode)["Actual Rows"] ?? 0), maxJoinActualRows: Math.max(0, ...joinActualRows), nodes, buffers: { sharedHit, sharedRead }, sha256: createHash("sha256").update(JSON.stringify(plan)).digest("hex") };
}

async function main(): Promise<void> {
  const mode = queryEvidenceMode(process.env.QUERY_EVIDENCE_MODE);
  const pool = new Pool({ connectionString: assertTestUrl(process.env.TEST_DATABASE_URL), max: 1 });
  try {
    // Loading candidate-only synthetic evidence can legitimately invoke release guards
    // many times; the timeout is enforced for the measured read workload below.
    await pool.query("SET statement_timeout = 0");
    await pool.query("TRUNCATE data_releases CASCADE");
    const { manifest, boundaries } = boundaryFixture();
    await seedNationwideCandidateManifest(pool, manifest, boundaries);
    const releaseId = manifest.release.id;
    // Synthetic fact + provenance workload: 5k concentrated on one profile geography,
    // with the remaining rows distributed across every catalog seat. User triggers
    // invalidate release digests once per row, which is irrelevant to this read-only
    // candidate benchmark and would make 100k fixture loading unsuitable for CI.
    // Constraints remain active; only user triggers are disabled and restored here.
    await pool.query("ALTER TABLE acs_observations DISABLE TRIGGER USER; ALTER TABLE acs_observation_lineage DISABLE TRIGGER USER");
    try {
      await pool.query("INSERT INTO acs_observations(release_id,geography_version_id,variable,label,estimate,estimate_missing_reason,margin_of_error,margin_of_error_missing_reason,unit,survey_period,universe,lineage_as_of,lineage_methodology,lineage_status) SELECT $1, CASE WHEN n <= 5000 THEN $2 ELSE (SELECT geography_version_id FROM seat_cycles WHERE release_id=$1 ORDER BY id OFFSET ((n - 5001) % 541) LIMIT 1) END, 'synthetic_q_' || n, 'Synthetic query evidence', n, NULL, 1, NULL, 'count', 'synthetic', 'all', DATE '2024-01-01', 'synthetic', 'reported' FROM generate_series(1,$3) n", [releaseId, manifest.seatCycles[0]!.geographyVersionId, ROWS]);
      await pool.query("INSERT INTO acs_observation_lineage(release_id,geography_version_id,variable,survey_period,snapshot_id,role) SELECT release_id,geography_version_id,variable,survey_period,$2,'derived_input' FROM acs_observations WHERE release_id=$1 AND variable LIKE 'synthetic_q_%'", [releaseId, "snap_input"]);
    } finally {
      await pool.query("ALTER TABLE acs_observation_lineage ENABLE TRIGGER USER; ALTER TABLE acs_observations ENABLE TRIGGER USER");
    }
    const count = Number((await pool.query<{ count: string }>("SELECT count(*) AS count FROM acs_observations WHERE release_id=$1 AND variable LIKE 'synthetic_q_%'", [releaseId])).rows[0]!.count);
    if (count !== ROWS) throw new Error(`synthetic row count ${count}, expected ${ROWS}`);
    // A fresh acceptance database has no planner statistics yet. Normalize the
    // disposable fixture before collecting plans so first-run and repeat evidence agree.
    await pool.query("ANALYZE");
    const cases: Array<{ name: string; text: string; values: readonly unknown[] }> = [];
    for (const sort of ["state", "district", "incumbent_name", "election_year", "cash_on_hand", "presidential_margin_2024"] as const) for (const direction of ["asc", "desc"] as const) { const q = buildSeatListStatement(releaseId, { limit: 50, sort, direction }); cases.push({ name: `${sort}-${direction}`, ...q }); }
    const first = await listSeatPage(pool, releaseId, { limit: 50, sort: "state", direction: "asc" });
    if (!first.nextCursor) throw new Error("synthetic browse page did not produce a next cursor");
    cases.push({ name: "next-cursor", ...buildSeatListStatement(releaseId, { limit: 50, sort: "state", direction: "asc", cursor: first.nextCursor }) });
    for (const [name, request] of Object.entries({ chamber: { chamber: "house" as const }, state: { stateCode: "CA" }, party: { party: "other" as const }, incumbency: { incumbencyStatus: "unknown" as const }, electionYear: { electionYear: 2024 }, literalIdentity: { identitySearch: "Synthetic 1%_\\" } })) { const q = buildSeatListStatement(releaseId, { limit: 50, sort: "state", direction: "asc", ...request }); cases.push({ name, ...q }); }
    const seatId = manifest.seatCycles[0]!.id;
    // The evidence contract is warm p95. Prime PostgreSQL planning/JIT and the
    // 5k-fact synthetic JSON assembly before enforcing the measured deadline.
    if (!await getSeatProfile(pool, releaseId as never, seatId as never)) throw new Error("synthetic dense profile warm-up failed");
    await pool.query(`SET statement_timeout = '${TIMEOUT_MS}ms'`);
    // Count one complete call on a checked-out client. This counts SQL statements,
    // not the ten warm repetitions measured below.
    const measuredProfile = await measureFullProfile(pool, releaseId, seatId);
    const completeProfile = measuredProfile.profile;
    if (!completeProfile) throw new Error("synthetic dense profile was not assembled");
    if (measuredProfile.statementCount !== 10) throw new Error(`getSeatProfile issued ${measuredProfile.statementCount} statements, expected 10`);
    // This includes closure-derived IDs and legacy finance-summary lineage surfaced by
    // getSeatProfile; never substitute a seat-cycle scalar for CLOSURE_SQL's text[].
    const closureValues = closureMeasurementValues(releaseId, completeProfile);
    cases.push({ name: "dense-profile", text: __sql.PROFILE_SQL, values: [releaseId, seatId] }, { name: "dense-closure", text: __sql.CLOSURE_SQL, values: closureValues });
    const plans: Record<string, ReturnType<typeof summarize>> = {};
    for (const item of cases) {
      try { await pool.query(item.text, [...item.values]); const result = await pool.query<{ "QUERY PLAN": unknown }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${item.text}`, [...item.values]); plans[item.name] = summarize(result.rows[0]!["QUERY PLAN"]); }
      catch (error) { throw new Error(`query-plan case failed: ${item.name}: ${error instanceof Error ? error.message : "unknown error"}`); }
    }
    for (const item of cases.filter(({ name }) => !name.startsWith("dense-"))) {
      const plan = plans[item.name]!;
      if (plan.rootActualRows > 51) throw new Error(`${item.name} root output ${plan.rootActualRows}, exceeds browse budget 51`);
      if (plan.maxJoinActualRows > SEAT_CATALOG_SIZE) throw new Error(`${item.name} maximum join output ${plan.maxJoinActualRows}, exceeds ${SEAT_CATALOG_SIZE}-seat catalog`);
    }
    const timings: Record<string, { p95Ms: number; repetitions: number }> = {};
    for (const item of cases) { const samples: number[] = []; for (let i = 0; i < 10; i++) { const start = performance.now(); await pool.query(item.text, [...item.values]); samples.push(performance.now() - start); } timings[item.name] = { p95Ms: p95(samples), repetitions: 10 }; }
    const fullProfileSamples: number[] = [];
    for (let i = 0; i < 10; i++) { const start = performance.now(); await getSeatProfile(pool, releaseId as never, seatId as never); fullProfileSamples.push(performance.now() - start); }
    const profile = completeProfile;
    if (!profile || profile.demographics.length > 5_200 || first.items.length > 50) throw new Error("result cardinality budget exceeded");
    for (const [name, timing] of Object.entries(timings)) if (timing.p95Ms > (name.startsWith("dense-") ? PROFILE_P95_MS : LIST_P95_MS)) throw new Error(`${name} p95 ${timing.p95Ms}ms exceeds budget`);
    const fullProfileWarmP95Ms = p95(fullProfileSamples);
    if (fullProfileWarmP95Ms > PROFILE_P95_MS) throw new Error(`full profile warm p95 ${fullProfileWarmP95Ms}ms exceeds budget`);
    const version = (await pool.query<{ version: string }>("SELECT current_setting('server_version') AS version")).rows[0]!.version;
    const sourceHashes = { profileSqlSha256: createHash("sha256").update(__sql.PROFILE_SQL).digest("hex"), closureSqlSha256: createHash("sha256").update(__sql.CLOSURE_SQL).digest("hex") };
    const contract: EvidenceContract = { schemaVersion: EVIDENCE_SCHEMA_VERSION, label: EVIDENCE_LABEL, rowCounts: { acsObservations: count, acsObservationLineage: count, seats: manifest.seatCycles.length }, budgets: { statementTimeoutMs: TIMEOUT_MS, listP95Ms: LIST_P95_MS, profileP95Ms: PROFILE_P95_MS, browseMaxRows: 51, listJoinMaxRows: SEAT_CATALOG_SIZE, denseProfileMaxFacts: 5_200 }, sourceHashes, statementCounts: { getSeatProfile: measuredProfile.statementCount }, closureSeedCount: closureValues[1].length };
    const evidence = { ...contract, generatedAt: new Date().toISOString(), postgresVersion: version, resultLimits: { browseRootRows: 51, denseProfileFacts: 5_200 }, fullProfileWarm: { p95Ms: fullProfileWarmP95Ms, repetitions: 10 }, plans, timings };
    await writeOrVerifyEvidence(mode, evidence);
  } finally { await pool.query("TRUNCATE data_releases CASCADE").catch(() => undefined); await pool.end(); }
}
if (process.argv[1]?.endsWith("measure-task5-queries.ts")) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
