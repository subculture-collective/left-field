import { S3Client } from "@aws-sdk/client-s3";
import { LocalMapArtifactStore, S3MapArtifactStore, type MapArtifactStore } from "./map-artifact-store";

/** Server configuration only; database receipts never select a store or locator. */
export function configuredMapArtifactStore(env: NodeJS.ProcessEnv = process.env): MapArtifactStore {
  if (env.NODE_ENV === "production") {
    if (!env.MAP_ARTIFACT_BUCKET) throw new Error("Production map serving requires MAP_ARTIFACT_BUCKET");
    return new S3MapArtifactStore(new S3Client({ region: env.AWS_REGION, endpoint: env.MAP_ARTIFACT_ENDPOINT, forcePathStyle: env.MAP_ARTIFACT_FORCE_PATH_STYLE === "true" }), env.MAP_ARTIFACT_BUCKET);
  }
  if (env.MAP_ARTIFACT_BUCKET) return new S3MapArtifactStore(new S3Client({ region: env.AWS_REGION, endpoint: env.MAP_ARTIFACT_ENDPOINT, forcePathStyle: env.MAP_ARTIFACT_FORCE_PATH_STYLE === "true" }), env.MAP_ARTIFACT_BUCKET);
  if (env.MAP_ARTIFACT_ROOT) return new LocalMapArtifactStore(env.MAP_ARTIFACT_ROOT);
  throw new Error("Require MAP_ARTIFACT_ROOT or MAP_ARTIFACT_BUCKET");
}
