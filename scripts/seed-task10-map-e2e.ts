/**
 * Disposable Playwright seed only.  It creates synthetic UI evidence, never
 * production data or publishable lifecycle evidence.
 */
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { Pool } from "pg";

import { baselineCandidateRelease, validateNationwideCandidateRelease } from "@/db/catalog-release";
import { seedNationwideCandidateManifest, type BoundaryBundle } from "@/db/manifest";
import { promoteCandidateRelease } from "@/db/releases";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { finalizeCandidateMaps } from "@/ingestion/tiger/finalize-maps";
import { TIGER_2025_JURISDICTIONS } from "@/ingestion/tiger/national";
import { simplifyNationalTigerDistrictLayer } from "@/ingestion/tiger/simplify";
import { LocalMapArtifactStore } from "@/maps/map-artifact-store";
import { nationwideSkeleton } from "@/test/fixtures/nationwide-skeleton";

const SOURCE_RELEASE = "rel_task10_e2e_source";
const MAP_RELEASE = "rel_task10_e2e_maps";
const PROFILE_PATH = "/seats/seat_0";

export function assertTask10E2eSeedEnvironment(env: Readonly<Record<string, string | undefined>>): { databaseUrl: string; mapRoot: string } {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable Task10 E2E seed");
  let url: URL;
  try { url = new URL(databaseUrl); } catch { throw new Error("DATABASE_URL must be a valid URL"); }
  const database = decodeURIComponent(url.pathname).replace(/^\//, "");
  if (!database.endsWith("_test")) throw new Error("DATABASE_URL must name a disposable database ending in _test");
  if (env.NODE_ENV?.toLowerCase() === "production" || /(^|[.-])prod(uction)?([.-]|$)/i.test(url.hostname)) throw new Error("Task10 E2E seed refuses production");
  const configuredRoot = env.MAP_ARTIFACT_ROOT;
  if (!configuredRoot || !isAbsolute(configuredRoot)) throw new Error("MAP_ARTIFACT_ROOT must be an absolute local temp/test path");
  const mapRoot = resolve(configuredRoot);
  const temporary = resolve(tmpdir());
  const relativeToTemporary = relative(temporary, mapRoot);
  const underTemporary = relativeToTemporary.length > 0 && relativeToTemporary !== ".." && !relativeToTemporary.startsWith(`..${sep}`) && !isAbsolute(relativeToTemporary);
  const testPath = /(?:^|\/|\\)(?:test|tests|tmp|temp)(?:\/|\\|$)/i.test(mapRoot);
  if ((!underTemporary && !testPath) || !/^task10(?:[-_][a-z0-9]+)*$/i.test(basename(mapRoot))) throw new Error("MAP_ARTIFACT_ROOT must be a dedicated Task10 directory under a local temp/test path");
  return { databaseUrl, mapRoot };
}

function task10Fixture() {
  const manifest = structuredClone(nationwideSkeleton());
  const rewriteRelease = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(rewriteRelease);
    else if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      if (row.releaseId === "rel_synthetic") row.releaseId = SOURCE_RELEASE;
      Object.values(row).forEach(rewriteRelease);
    }
  };
  rewriteRelease(manifest);
  const snapshot = manifest.snapshots.find((item) => item.id === manifest.geometryArtifacts[0]!.snapshotId)!;
  const source = manifest.sources.find((item) => item.id === snapshot.sourceId)!;
  snapshot.license = "public-domain"; snapshot.usageStatus = "approved"; source.authority = "derived";
  const fipsByState = new Map<string, string>(Object.entries(TIGER_2025_JURISDICTIONS).map(([fips, state]) => [state, fips]));
  const nonVoting = new Set(["DC", "AS", "GU", "MP", "PR", "VI"]);
  const ring = (index: number): number[][] => {
    const x = -179 + (index % 60) * .2, y = -80 + Math.floor(index / 60) * .2;
    const edge = (ax: number, ay: number, bx: number, by: number) => Array.from({ length: 5 }, (_, n) => [ax + (bx - ax) * n / 4, ay + (by - ay) * n / 4]);
    return [...edge(x, y, x + .1, y), ...edge(x + .1, y, x + .1, y + .1).slice(1), ...edge(x + .1, y + .1, x, y + .1).slice(1), ...edge(x, y + .1, x, y).slice(1)];
  };
  const districts = manifest.geographyVersions.filter((item) => item.kind === "house_district");
  const states = manifest.geographyVersions.filter((item) => item.kind === "state");
  const stateFeatures = new Map(manifest.geographyVersions.map((geography, index) => [geography.sourceGeoid, { type: "Feature", properties: { sourceGeoid: geography.sourceGeoid, stateCode: geography.stateCode, districtCode: geography.kind === "house_district" ? geography.districtCode : null }, geometry: { type: "MultiPolygon", coordinates: [[ring(index)]] } }]));
  const districtFeatures = districts.map((geography, index) => {
    const fips = fipsByState.get(geography.stateCode); if (!fips) throw new Error(`Missing TIGER FIPS for ${geography.stateCode}`);
    const district = nonVoting.has(geography.stateCode) ? "98" : geography.districtCode === "AL" ? "00" : geography.districtCode!.padStart(2, "0");
    const geoid = `${fips}${district}`;
    Object.assign(geography, { sourceGeoid: geoid, vintage: "2025", geometryArtifactId: "artifact_task10_districts" as never });
    return { type: "Feature", properties: { GEOID: geoid, sourceGeoid: geoid, stateCode: geography.stateCode, districtCode: geography.districtCode }, geometry: { type: "MultiPolygon", coordinates: [[ring(index)]] } };
  }).sort((a, b) => a.properties.GEOID.localeCompare(b.properties.GEOID));
  if (districtFeatures.length !== 441) throw new Error("Synthetic Task10 layer must contain exactly 441 districts");
  for (const geography of states) Object.assign(geography, { geometryArtifactId: "artifact_task10_states" as never });
  const districtBytes = JSON.stringify({ type: "FeatureCollection", features: districtFeatures });
  const stateBytes = JSON.stringify({ type: "FeatureCollection", features: states.map((item) => stateFeatures.get(item.sourceGeoid)!) });
  manifest.release = { ...manifest.release, id: SOURCE_RELEASE as never, status: "candidate", publishedAt: null, previousReleaseId: null };
  manifest.geometryArtifacts = [
    { ...manifest.geometryArtifacts[0]!, id: "artifact_task10_districts" as never, objectKey: "task10-e2e-districts.geojson", checksumSha256: createHash("sha256").update(districtBytes).digest("hex") },
    { ...manifest.geometryArtifacts[0]!, id: "artifact_task10_states" as never, objectKey: "task10-e2e-states.geojson", checksumSha256: createHash("sha256").update(stateBytes).digest("hex") },
  ];
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  return { manifest, districtBytes, bundle: manifest.geometryArtifacts.map((artifact) => ({ artifactId: artifact.id, objectKey: artifact.objectKey, bytes: artifact.id === "artifact_task10_districts" ? districtBytes : stateBytes })) satisfies BoundaryBundle };
}

/** Bypasses lifecycle triggers only in this disposable test database after finalization. */
async function publishForBrowserOnly(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // This requires the migration owner/superuser and is deliberately not a production lifecycle path.
    await client.query("SET LOCAL session_replication_role = replica");
    await client.query("UPDATE data_releases SET status='retired' WHERE id=$1", [SOURCE_RELEASE]);
    await client.query("UPDATE data_releases SET status='published',published_at=clock_timestamp() WHERE id=$1", [MAP_RELEASE]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
}

async function main(): Promise<void> {
  const { databaseUrl, mapRoot } = assertTask10E2eSeedEnvironment(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    // Safe only after the database-name guard above: remove all prior disposable releases and evidence.
    await pool.query("TRUNCATE data_releases CASCADE");
    await rm(mapRoot, { recursive: true, force: true });
    const { manifest, districtBytes, bundle } = task10Fixture();
    await seedNationwideCandidateManifest(pool, manifest, bundle);
    await validateNationwideCandidateRelease(pool, SOURCE_RELEASE);
    await promoteCandidateRelease(pool, SOURCE_RELEASE);
    await pool.query("INSERT INTO data_releases(id,label,status,source_cutoff,created_at,published_at,previous_release_id) VALUES($1,'Synthetic Task10 browser maps','candidate',$2,clock_timestamp(),NULL,$3)", [MAP_RELEASE, manifest.release.sourceCutoff, SOURCE_RELEASE]);
    await baselineCandidateRelease(pool, SOURCE_RELEASE, MAP_RELEASE);
    // Baselining clears the candidate gate and digests; validation restores them before maps are finalized.
    await validateNationwideCandidateRelease(pool, MAP_RELEASE);
    const layer = await simplifyNationalTigerDistrictLayer(districtBytes, { expectedSourceSha256: manifest.geometryArtifacts[0]!.checksumSha256 });
    await finalizeCandidateMaps({ pool, store: new LocalMapArtifactStore(mapRoot), candidateReleaseId: MAP_RELEASE, sourceReleaseId: SOURCE_RELEASE, layer });
    await publishForBrowserOnly(pool);
    console.log("SYNTHETIC UI EVIDENCE ONLY — not production data or lifecycle proof.");
    console.log(`Profile path: ${PROFILE_PATH}`);
    console.log(`Map release ID: ${MAP_RELEASE}`);
    console.log(`Map root: ${mapRoot}`);
  } finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
