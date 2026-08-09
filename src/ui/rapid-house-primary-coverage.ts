import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RapidHousePrimaryCoverageStatus = "ready_unparsed" | "parsed" | "source_absent" | "future_event" | "not_held" | "source_blocked" | "authority_unavailable";
export type RapidHousePrimaryCoverageRow = Readonly<{ stateCode: string; cycleYear: number; expectedTargetDistricts: readonly string[]; retainedArtifactCount: number; parsedDistrictCount: number; sourceAbsentDistrictCount: number; status: RapidHousePrimaryCoverageStatus; missingByReason?: readonly Readonly<{ reason: string; count: number }>[]; artifactLockIds?: readonly string[] }>;
export type RapidHousePrimaryCoverageViewModel = Readonly<{ schema: "rapid-house-primary-coverage-ledger-v12"; version: 12; rows: readonly RapidHousePrimaryCoverageRow[] }>;

const files = {
  ledger: { id: "rapid-house-primary-coverage-ledger-v12", path: "data/metadata/rapid-house-primary-coverage-ledger-v12.json", bytes: 20059, sha256: "7c5e2a7f857c1d97a3112c1bccf94fe9e3385fb7915ae81ae18585ffcb56e620", parentIds: ["rapid-house-primary-projection-v12"] },
  projection: { id: "rapid-house-primary-projection-v12", path: "data/metadata/rapid-house-primary-projection-v12.json", bytes: 61526, sha256: "1c22bb643106fd82dcf3b39f0113853ac3529fd98ce2f79e5f00c8c41bfa540c", parentIds: ["rapid-house-primary-projection-v11", "rapid-house-primary-south-carolina-results-v2"] },
} as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
// Paths are an exact allowlist above. Ignore dynamic tracing because `root` exists only for fixture isolation.
const readAllowlisted = (path: string) => readFile(/*turbopackIgnore: true*/ path);
const isRow = (value: unknown): value is RapidHousePrimaryCoverageRow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const retainedArtifactCount = row.retainedArtifactCount, parsedDistrictCount = row.parsedDistrictCount, sourceAbsentDistrictCount = row.sourceAbsentDistrictCount;
  return typeof row.stateCode === "string" && Number.isSafeInteger(row.cycleYear) && Array.isArray(row.expectedTargetDistricts) && row.expectedTargetDistricts.every((district) => typeof district === "string") && typeof retainedArtifactCount === "number" && Number.isSafeInteger(retainedArtifactCount) && retainedArtifactCount >= 0 && typeof parsedDistrictCount === "number" && Number.isSafeInteger(parsedDistrictCount) && parsedDistrictCount >= 0 && typeof sourceAbsentDistrictCount === "number" && Number.isSafeInteger(sourceAbsentDistrictCount) && sourceAbsentDistrictCount >= 0 && ["ready_unparsed", "parsed", "source_absent", "future_event", "not_held", "source_blocked", "authority_unavailable"].includes(String(row.status));
};

/** Optional, file-backed acquisition read model. It is deliberately not release coverage or score input. */
export async function loadRapidHousePrimaryCoverage(root?: string): Promise<RapidHousePrimaryCoverageViewModel | null> {
  const base = root ?? process.cwd();
  let raw: Buffer, projectionRaw: Buffer, lockRaw: Buffer;
  try { [raw, projectionRaw, lockRaw] = await Promise.all([readAllowlisted(join(/*turbopackIgnore: true*/ base, files.ledger.path)), readAllowlisted(join(/*turbopackIgnore: true*/ base, files.projection.path)), readAllowlisted(join(/*turbopackIgnore: true*/ base, "data/source-lock.json"))]); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  let value: unknown, projection: Record<string, unknown>, lock: { entries?: readonly Record<string, unknown>[] };
  try { value = JSON.parse(raw.toString("utf8")); projection = JSON.parse(projectionRaw.toString("utf8")) as Record<string, unknown>; lock = JSON.parse(lockRaw.toString("utf8")) as { entries?: readonly Record<string, unknown>[] }; } catch { return null; }
  for (const [key, bytes] of [["ledger", raw], ["projection", projectionRaw]] as const) {
    const file = files[key], matches = lock.entries?.filter((entry) => entry.id === file.id) ?? [];
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256 || matches.length !== 1 || matches[0]!.retainedPath !== file.path || matches[0]!.retainedStatus !== "retained" || matches[0]!.byteSize !== file.bytes || matches[0]!.sha256 !== file.sha256 || JSON.stringify(matches[0]!.parentIds) !== JSON.stringify(file.parentIds)) return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ledger = value as Record<string, unknown>;
  if (ledger.schema !== "rapid-house-primary-coverage-ledger-v12" || ledger.version !== 12 || !Array.isArray(ledger.rows) || !ledger.rows.every(isRow)) return null;
  if (projection.schema !== "rapid-house-primary-projection-v12" || projection.packageSha256 !== ledger.projectionSha256 || !Array.isArray(projection.coverageRows) || JSON.stringify(projection.coverageRows) !== JSON.stringify(ledger.rows)) return null;
  const rows = ledger.rows as RapidHousePrimaryCoverageRow[];
  if (rows.length !== 48 || rows.flatMap((row) => row.expectedTargetDistricts).length !== 78 || rows.reduce((sum, row) => sum + row.parsedDistrictCount, 0) !== 27 || rows.reduce((sum, row) => sum + row.sourceAbsentDistrictCount, 0) !== 3) return null;
  return { schema: "rapid-house-primary-coverage-ledger-v12", version: 12, rows: [...rows].sort((left, right) => left.stateCode.localeCompare(right.stateCode) || left.cycleYear - right.cycleYear) };
}
