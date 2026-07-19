/** Synthetic query-shape evidence only. Never points at a non-disposable database. */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

import { seedNationwideCandidateManifest, type BoundaryBundle } from "@/db/manifest";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { buildSeatListStatement, listSeatPage } from "@/repositories/sql/list-seats";
import { __sql, getSeatProfile } from "@/repositories/sql/get-seat-profile";
import { nationwideSkeleton } from "@/test/fixtures/nationwide-skeleton";

const ROWS = 100_000;
const LIST_P95_MS = 2_000;
const PROFILE_P95_MS = 8_000;
const TIMEOUT_MS = 15_000;
const SEAT_CATALOG_SIZE = 541;

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
  const pool = new Pool({ connectionString: assertTestUrl(process.env.TEST_DATABASE_URL) });
  try {
    // Loading candidate-only synthetic evidence can legitimately invoke release guards
    // many times; the timeout is enforced for the measured read workload below.
    await pool.query("SET statement_timeout = 0");
    await pool.query("TRUNCATE data_releases CASCADE");
    const { manifest, boundaries } = boundaryFixture();
    await seedNationwideCandidateManifest(pool, manifest, boundaries);
    const releaseId = manifest.release.id;
    // Synthetic fact + provenance workload: 5k concentrated on one profile geography,
    // with the remaining rows distributed across every catalog seat.
    await pool.query("INSERT INTO acs_observations(release_id,geography_version_id,variable,label,estimate,estimate_missing_reason,margin_of_error,margin_of_error_missing_reason,unit,survey_period,universe,lineage_as_of,lineage_methodology,lineage_status) SELECT $1, CASE WHEN n <= 5000 THEN $2 ELSE (SELECT geography_version_id FROM seat_cycles WHERE release_id=$1 ORDER BY id OFFSET ((n - 5001) % 541) LIMIT 1) END, 'synthetic_q_' || n, 'Synthetic query evidence', n, NULL, 1, NULL, 'count', 'synthetic', 'all', DATE '2024-01-01', 'synthetic', 'reported' FROM generate_series(1,$3) n", [releaseId, manifest.seatCycles[0]!.geographyVersionId, ROWS]);
    await pool.query("INSERT INTO acs_observation_lineage(release_id,geography_version_id,variable,survey_period,snapshot_id,role) SELECT release_id,geography_version_id,variable,survey_period,$2,'derived_input' FROM acs_observations WHERE release_id=$1 AND variable LIKE 'synthetic_q_%'", [releaseId, "snap_input"]);
    const count = Number((await pool.query<{ count: string }>("SELECT count(*) AS count FROM acs_observations WHERE release_id=$1 AND variable LIKE 'synthetic_q_%'", [releaseId])).rows[0]!.count);
    if (count !== ROWS) throw new Error(`synthetic row count ${count}, expected ${ROWS}`);
    await pool.query(`SET statement_timeout = '${TIMEOUT_MS}ms'`);

    const cases: Array<{ name: string; text: string; values: readonly unknown[] }> = [];
    for (const sort of ["state", "district", "incumbent_name", "election_year", "cash_on_hand", "presidential_margin_2024"] as const) for (const direction of ["asc", "desc"] as const) { const q = buildSeatListStatement(releaseId, { limit: 50, sort, direction }); cases.push({ name: `${sort}-${direction}`, ...q }); }
    const first = await listSeatPage(pool, releaseId, { limit: 50, sort: "state", direction: "asc" });
    if (!first.nextCursor) throw new Error("synthetic browse page did not produce a next cursor");
    cases.push({ name: "next-cursor", ...buildSeatListStatement(releaseId, { limit: 50, sort: "state", direction: "asc", cursor: first.nextCursor }) });
    for (const [name, request] of Object.entries({ chamber: { chamber: "house" as const }, state: { stateCode: "CA" }, party: { party: "other" as const }, incumbency: { incumbencyStatus: "unknown" as const }, electionYear: { electionYear: 2024 }, literalIdentity: { identitySearch: "Synthetic 1%_\\" } })) { const q = buildSeatListStatement(releaseId, { limit: 50, sort: "state", direction: "asc", ...request }); cases.push({ name, ...q }); }
    const seatId = manifest.seatCycles[0]!.id;
    cases.push({ name: "dense-profile", text: __sql.PROFILE_SQL, values: [releaseId, seatId] }, { name: "dense-closure", text: __sql.CLOSURE_SQL, values: [releaseId, seatId] });
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
    const profile = await getSeatProfile(pool, releaseId as never, seatId as never);
    if (!profile || profile.demographics.length > 5_200 || first.items.length > 50) throw new Error("result cardinality budget exceeded");
    for (const [name, timing] of Object.entries(timings)) if (timing.p95Ms > (name.startsWith("dense-") ? PROFILE_P95_MS : LIST_P95_MS)) throw new Error(`${name} p95 ${timing.p95Ms}ms exceeds budget`);
    const version = (await pool.query<{ version: string }>("SELECT current_setting('server_version') AS version")).rows[0]!.version;
    const evidence = { label: "SYNTHETIC query-shape evidence; not semantic validation or production benchmarking.", generatedAt: new Date().toISOString(), postgresVersion: version, rowCounts: { acsObservations: count, acsObservationLineage: count, seats: manifest.seatCycles.length }, budgets: { statementTimeoutMs: TIMEOUT_MS, listP95Ms: LIST_P95_MS, profileP95Ms: PROFILE_P95_MS, browseMaxRows: 51, listJoinMaxRows: SEAT_CATALOG_SIZE, denseProfileMaxFacts: 5_200 }, plans, timings };
    await mkdir(resolve("docs/reviews"), { recursive: true }); await writeFile(resolve("docs/reviews/phase-1-r1-query-plans.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  } finally { await pool.query("TRUNCATE data_releases CASCADE").catch(() => undefined); await pool.end(); }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
