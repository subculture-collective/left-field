import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidLocalContextArtifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export type RapidLocalContextCoverageViewModel = Readonly<{ schema: "rapid-local-context-coverage-v1" | "rapid-local-context-coverage-v2" | "rapid-local-context-coverage-v3" | "rapid-local-context-coverage-v4" | "rapid-local-context-coverage-v5" | "rapid-local-context-coverage-v6" | "rapid-local-context-coverage-v7" | "rapid-local-context-coverage-v8" | "rapid-local-context-coverage-v9" | "rapid-local-context-coverage-v10" | "rapid-local-context-coverage-v11" | "rapid-local-context-coverage-v12" | "rapid-local-context-coverage-v13" | "rapid-local-context-coverage-v14"; version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; artifacts: readonly RapidLocalContextArtifact[] }>;
const coveragePaths = (root = process.cwd()) => [
  { schema: "rapid-local-context-coverage-v14" as const, version: 14 as const, id: "rapid-local-context-coverage-v14", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v14.json"), artifactCount: 16 },
  { schema: "rapid-local-context-coverage-v13" as const, version: 13 as const, id: "rapid-local-context-coverage-v13", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v13.json"), artifactCount: 15 },
  { schema: "rapid-local-context-coverage-v12" as const, version: 12 as const, id: "rapid-local-context-coverage-v12", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v12.json"), artifactCount: 14 },
  { schema: "rapid-local-context-coverage-v11" as const, version: 11 as const, id: "rapid-local-context-coverage-v11", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v11.json"), artifactCount: 13 },
  { schema: "rapid-local-context-coverage-v10" as const, version: 10 as const, id: "rapid-local-context-coverage-v10", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v10.json"), artifactCount: 12 },
  { schema: "rapid-local-context-coverage-v9" as const, version: 9 as const, id: "rapid-local-context-coverage-v9", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v9.json"), artifactCount: 11 },
  { schema: "rapid-local-context-coverage-v8" as const, version: 8 as const, id: "rapid-local-context-coverage-v8", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v8.json"), artifactCount: 10 },
  { schema: "rapid-local-context-coverage-v7" as const, version: 7 as const, id: "rapid-local-context-coverage-v7", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v7.json"), artifactCount: 9 },
  { schema: "rapid-local-context-coverage-v6" as const, version: 6 as const, id: "rapid-local-context-coverage-v6", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v6.json"), artifactCount: 8 },
  { schema: "rapid-local-context-coverage-v5" as const, version: 5 as const, id: "rapid-local-context-coverage-v5", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v5.json"), artifactCount: 7 },
  { schema: "rapid-local-context-coverage-v4" as const, version: 4 as const, id: "rapid-local-context-coverage-v4", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v4.json"), artifactCount: 6 },
  { schema: "rapid-local-context-coverage-v3" as const, version: 3 as const, id: "rapid-local-context-coverage-v3", path: join(/*turbopackIgnore: true*/ root, "data/metadata/rapid-local-context-coverage-v3.json"), artifactCount: 5 },
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
  "rapid-new-mexico-county-office-primary-results-v1": "data/metadata/rapid-new-mexico-county-office-primary-results-v1.json",
  "rapid-north-carolina-local-office-primary-results-v1": "data/metadata/rapid-north-carolina-local-office-primary-results-v1.json",
  "rapid-kentucky-state-legislative-primary-results-v1": "data/metadata/rapid-kentucky-state-legislative-primary-results-v1.json",
  "rapid-missouri-state-legislative-primary-results-v1": "data/metadata/rapid-missouri-state-legislative-primary-results-v1.json",
  "rapid-hawaii-state-legislative-primary-results-v1": "data/metadata/rapid-hawaii-state-legislative-primary-results-v1.json",
  "rapid-delaware-state-legislative-primary-results-v1": "data/metadata/rapid-delaware-state-legislative-primary-results-v1.json",
  "rapid-alabama-state-legislative-primary-results-v1": "data/metadata/rapid-alabama-state-legislative-primary-results-v1.json",
  "rapid-county-demographics-projection-v1": "data/metadata/rapid-county-demographics-projection-v1.json",
  "rapid-county-election-context-projection-v1": "data/metadata/rapid-county-election-context-projection-v1.json",
  "rapid-county-house-results-2022-projection-v1": "data/metadata/rapid-county-house-results-2022-projection-v1.json",
  "rapid-county-house-results-projection-v1": "data/metadata/rapid-county-house-results-projection-v1.json",
  "rapid-county-senate-results-projection-v1": "data/metadata/rapid-county-senate-results-projection-v1.json",
  "rapid-indiana-state-legislative-primary-results-v1": "data/metadata/rapid-indiana-state-legislative-primary-results-v1.json",
  "rapid-tennessee-state-legislative-primary-results-v1": "data/metadata/rapid-tennessee-state-legislative-primary-results-v1.json",
  "rapid-georgia-state-legislative-primary-results-v1": "data/metadata/rapid-georgia-state-legislative-primary-results-v1.json",
  "rapid-north-carolina-state-legislative-primary-results-v1": "data/metadata/rapid-north-carolina-state-legislative-primary-results-v1.json",
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
    // A newer retained receipt is authoritative: do not silently fall back from damaged current data.
    if (candidate.version >= 2) return null;
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
