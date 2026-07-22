import { S3Client } from "@aws-sdk/client-s3";
import type { Pool } from "pg";

import { closeDb, getIngestPool } from "@/db/client";
import { releaseIdSchema } from "@/domain/contracts";
import { finalizeCandidateMaps } from "@/ingestion/tiger/finalize-maps";
import { simplifyNationalTigerDistrictLayer } from "@/ingestion/tiger/simplify";
import { LocalMapArtifactStore, S3MapArtifactStore, type MapArtifactStore } from "@/maps/map-artifact-store";
import { loadLockedArtifact } from "./ingestion-config";

export interface FinalizeMapsArguments { readonly candidateRelease: string; readonly sourceRelease: string; }
export function parseFinalizeMapsArguments(argv: readonly string[]): FinalizeMapsArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) { const key = argv[index]!; if (!['--candidate-release', '--source-release'].includes(key) || values.has(key) || !argv[index + 1] || argv[index + 1]!.startsWith('--')) throw new Error('Require exactly --candidate-release and --source-release'); values.set(key, argv[++index]!); }
  const candidateRelease = values.get('--candidate-release'), sourceRelease = values.get('--source-release');
  if (!candidateRelease || !sourceRelease || candidateRelease === sourceRelease || !releaseIdSchema.safeParse(candidateRelease).success || !releaseIdSchema.safeParse(sourceRelease).success) throw new Error('Require exactly --candidate-release and --source-release');
  return { candidateRelease, sourceRelease };
}
export function createMapStore(env: NodeJS.ProcessEnv): MapArtifactStore {
  if (env.MAP_ARTIFACT_BUCKET) return new S3MapArtifactStore(new S3Client({ region: env.AWS_REGION, endpoint: env.MAP_ARTIFACT_ENDPOINT, forcePathStyle: env.MAP_ARTIFACT_FORCE_PATH_STYLE === 'true' }), env.MAP_ARTIFACT_BUCKET);
  if (env.MAP_ARTIFACT_ROOT) return new LocalMapArtifactStore(env.MAP_ARTIFACT_ROOT);
  throw new Error('Require MAP_ARTIFACT_ROOT or MAP_ARTIFACT_BUCKET');
}
export async function executeFinalizeMaps(argv: readonly string[], dependencies: { env: NodeJS.ProcessEnv; getPool: () => Pool; store?: MapArtifactStore; finalize?: typeof finalizeCandidateMaps; loadSource?: typeof loadLockedArtifact }): Promise<{ readonly status: 'finalized'; readonly candidateRelease: string }> {
  const args = parseFinalizeMapsArguments(argv);
  if (dependencies.env.NODE_ENV === 'production' && (!dependencies.env.INGEST_DATABASE_URL || !dependencies.env.MAP_ARTIFACT_BUCKET)) throw new Error('Production map finalization requires INGEST_DATABASE_URL and MAP_ARTIFACT_BUCKET');
  const source = await (dependencies.loadSource ?? loadLockedArtifact)(dependencies.env, 'geo-national-cd119');
  const layer = await simplifyNationalTigerDistrictLayer(source.bytes, { expectedSourceSha256: source.sha256 });
  await (dependencies.finalize ?? finalizeCandidateMaps)({ pool: dependencies.getPool(), store: dependencies.store ?? createMapStore(dependencies.env), candidateReleaseId: args.candidateRelease, sourceReleaseId: args.sourceRelease, layer });
  return { status: 'finalized', candidateRelease: args.candidateRelease };
}
export async function main(argv = process.argv.slice(2), env = process.env, dependencies: Omit<Parameters<typeof executeFinalizeMaps>[1], 'env'> = { getPool: getIngestPool }): Promise<void> { process.stdout.write(`${JSON.stringify(await executeFinalizeMaps(argv, { env, ...dependencies }))}\n`); }
if (require.main === module) main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Map finalization failed'}\n`); process.exitCode = 1; }).finally(closeDb);
