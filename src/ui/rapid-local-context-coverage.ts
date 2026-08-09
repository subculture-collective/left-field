import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidLocalContextArtifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export type RapidLocalContextCoverageViewModel = Readonly<{ schema: "rapid-local-context-coverage-v1" | "rapid-local-context-coverage-v2"; version: 1 | 2; artifacts: readonly RapidLocalContextArtifact[] }>;
const coveragePaths = (root = process.cwd()) => [
  { schema: "rapid-local-context-coverage-v2" as const, version: 2 as const, id: "rapid-local-context-coverage-v2", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v2.json"), artifactCount: 4 },
  { schema: "rapid-local-context-coverage-v1" as const, version: 1 as const, id: "rapid-local-context-coverage-v1", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v1.json"), artifactCount: 3 },
] as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
// Paths are an exact allowlist below. Ignore dynamic tracing because `root` exists only for fixture isolation.
const readAllowlistedBytes = (path: string) => readFile(/*turbopackIgnore: true*/ path);
const readAllowlistedText = (path: string) => readFile(/*turbopackIgnore: true*/ path, "utf8");
const isArtifact = (value: unknown): value is RapidLocalContextArtifact => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.label === "string" && typeof row.scope === "string" && typeof row.packageSha256 === "string" && /^[a-f0-9]{64}$/.test(row.packageSha256) && row.formulaEligibleCount === 0 && !!row.summary && typeof row.summary === "object" && !Array.isArray(row.summary) && Object.values(row.summary).every((value) => Number.isSafeInteger(value) && value >= 0);
};
type Lock = Readonly<{ entries: readonly Readonly<{ id: string; retainedPath?: string; retainedStatus: string; byteSize?: number; sha256?: string; parentIds: readonly string[] }>[] }>;
const childPaths: Readonly<Record<string, string>> = {
  "rapid-county-demographics-projection-v1": "data/metadata/rapid-county-demographics-projection-v1.json",
  "rapid-county-election-context-projection-v1": "data/metadata/rapid-county-election-context-projection-v1.json",
  "rapid-county-senate-results-projection-v1": "data/metadata/rapid-county-senate-results-projection-v1.json",
  "rapid-indiana-state-legislative-primary-results-v1": "data/metadata/rapid-indiana-state-legislative-primary-results-v1.json",
};

/** Lightweight server read model: validates retained artifact bytes and source-lock topology, without rebuilding raw Census/EAVS inputs. */
export async function loadRapidLocalContextCoverage(root = process.cwd()): Promise<RapidLocalContextCoverageViewModel | null> {
  let lockRaw: string;
  try { lockRaw = await readAllowlistedText(join(/*turbopackIgnore: true*/ root, "data/source-lock.json")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  let lock: Lock;
  try { lock = JSON.parse(lockRaw) as Lock; } catch { return null; }
  for (const candidate of coveragePaths(root)) {
    let raw: Buffer, value: unknown;
    try { raw = await readAllowlistedBytes(candidate.path); value = JSON.parse(raw.toString("utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; return null; }
    const loaded = await loadCandidate(value, raw, lock, candidate, root);
    if (loaded) return loaded;
    // A retained v2 receipt is authoritative: do not silently fall back from a damaged v2.
    if (candidate.version === 2) return null;
  }
  return null;
}

async function loadCandidate(value: unknown, raw: Buffer, lock: Lock, candidate: ReturnType<typeof coveragePaths>[number], root: string): Promise<RapidLocalContextCoverageViewModel | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const receipt = value as Record<string, unknown>;
  if (receipt.schema !== candidate.schema || receipt.version !== candidate.version || receipt.releaseRelationship !== "separate_rapid_acquisition_excluded_from_released_score" || !Array.isArray(receipt.artifacts) || !receipt.artifacts.every(isArtifact)) return null;
  const artifactIds = receipt.artifacts.map((artifact) => artifact.id);
  if (new Set(artifactIds).size !== candidate.artifactCount || artifactIds.some((id) => !childPaths[id])) return null;
  const entries = new Map(lock.entries.map((entry) => [entry.id, entry]));
  const coverage = entries.get(candidate.id);
  if (!coverage || coverage.retainedStatus !== "retained" || coverage.retainedPath !== `data/metadata/${candidate.id}.json` || coverage.byteSize !== raw.length || coverage.sha256 !== sha(raw) || coverage.parentIds.length !== artifactIds.length || coverage.parentIds.some((id) => !artifactIds.includes(id))) return null;
  try {
    await Promise.all((receipt.artifacts as RapidLocalContextArtifact[]).map(async (artifact) => {
      const entry = entries.get(artifact.id), path = childPaths[artifact.id]!;
      if (!entry || entry.retainedStatus !== "retained" || entry.retainedPath !== path) throw new Error("LOCAL_CONTEXT_LOCK_INVALID");
      const bytes = await readAllowlistedBytes(join(/*turbopackIgnore: true*/ root, path));
      if (entry.byteSize !== bytes.length || entry.sha256 !== sha(bytes)) throw new Error("LOCAL_CONTEXT_CHILD_BYTES_INVALID");
      const child = JSON.parse(bytes.toString("utf8")) as { packageSha256?: unknown };
      if (child.packageSha256 !== artifact.packageSha256) throw new Error("LOCAL_CONTEXT_CHILD_PACKAGE_INVALID");
    }));
  } catch { return null; }
  return { schema: candidate.schema, version: candidate.version, artifacts: [...receipt.artifacts as RapidLocalContextArtifact[]].sort((left, right) => left.label.localeCompare(right.label)) };
}
