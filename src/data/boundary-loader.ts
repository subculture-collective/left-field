"use server";

import { readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { BoundaryBundle } from "@/db/manifest";
import type { PrototypeManifest } from "@/domain/contracts";

/** Reads exactly the manifest-declared artifacts, confined to <cwd>/data. */
export async function loadBoundaryBundle(manifest: Pick<PrototypeManifest, "geometryArtifacts">): Promise<BoundaryBundle> {
  const root = await realpath(resolve(process.cwd(), "data"));
  const ids = new Set<string>();
  const keys = new Set<string>();
  return Promise.all(manifest.geometryArtifacts.map(async (artifact) => {
    if (ids.has(String(artifact.id)) || keys.has(artifact.objectKey)) throw new Error("Manifest has duplicate geometry artifact IDs or object keys");
    ids.add(String(artifact.id)); keys.add(artifact.objectKey);
    // object keys are repository-relative, never a user-controlled filesystem path.
    const candidate = resolve(process.cwd(), artifact.objectKey);
    const candidateRel = relative(root, candidate);
    if (candidateRel === "" || candidateRel === ".." || candidateRel.startsWith(`..${sep}`) || !candidateRel || candidate === root) throw new Error(`Geometry object key escapes data root: ${artifact.objectKey}`);
    const target = await realpath(candidate);
    const rel = relative(root, target);
    if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || !rel || target === root) throw new Error(`Geometry object key escapes data root: ${artifact.objectKey}`);
    if (!(await stat(target)).isFile()) throw new Error(`Geometry object key is not a file: ${artifact.objectKey}`);
    return { artifactId: String(artifact.id), objectKey: artifact.objectKey, bytes: await readFile(target) };
  }));
}

/** Canonical convenience name retained for server callers. */
export const loadCanonicalBoundaries = loadBoundaryBundle;
