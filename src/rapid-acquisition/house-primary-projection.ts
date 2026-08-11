import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHousePrimarySourceRegistry, type HousePrimaryFinalClosure } from "./source-registry";
import { byteCompare, canonical, hash, sha, exact } from "./shared";

export type HousePrimaryParseStatus = "ready_unparsed" | "source_blocked" | "authority_unavailable" | "future_event" | "not_held";
export interface HousePrimaryProjectedSource {
  readonly sourceId: string;
  readonly url: string;
  readonly retainedPath: string;
  readonly byteSize: number;
  readonly sha256: string;
}
export interface HousePrimaryObservation {
  readonly observationId: string;
  readonly stateCode: string;
  readonly cycleYear: number;
  readonly districtLabel: string;
  readonly parseStatus: HousePrimaryParseStatus;
  readonly missingReason: "parser_not_implemented" | "source_blocked" | "authority_unavailable" | "future_event" | "not_held";
  readonly sourceLockIds: readonly string[];
  readonly sourceContestId: null;
  readonly candidates: null;
  readonly votes: null;
  readonly winner: null;
  readonly identity: null;
  readonly scoreEligible: false;
}
export interface HousePrimaryCoverageRow {
  readonly coverageId: string;
  readonly stateCode: string;
  readonly cycleYear: number;
  readonly expectedTargetDistricts: readonly string[];
  readonly retainedArtifactCount: number;
  readonly parsedDistrictCount: 0;
  readonly parseStatus: HousePrimaryParseStatus;
  readonly missingReason: HousePrimaryObservation["missingReason"];
  readonly sourceLockIds: readonly string[];
}
export interface HousePrimaryProjection {
  readonly schema: "rapid-house-primary-projection-v1";
  readonly version: 1;
  readonly registrySha256: string;
  readonly sources: readonly HousePrimaryProjectedSource[];
  readonly sourceSetSha256: string;
  readonly observations: readonly HousePrimaryObservation[];
  readonly observationSetSha256: string;
  readonly coverageRows: readonly HousePrimaryCoverageRow[];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{
    stateCycles: 48;
    districtObservations: 78;
    retainedSources: number;
    parsedDistricts: 0;
    scoreEligibleDistricts: 0;
    byStatus: Readonly<Record<HousePrimaryParseStatus, number>>;
  }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedger {
  readonly schema: "rapid-house-primary-coverage-ledger-v1";
  readonly version: 1;
  readonly projectionSha256: string;
  readonly rows: readonly Readonly<{
    stateCode: string;
    cycleYear: number;
    expectedTargetDistricts: readonly string[];
    retainedArtifactCount: number;
    parsedDistrictCount: 0;
    status: HousePrimaryParseStatus;
    missingByReason: readonly Readonly<{ reason: HousePrimaryObservation["missingReason"]; count: number }>[];
    artifactLockIds: readonly string[];
  }>[];
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

type LockEntry = Readonly<{ id: string; url: string; retainedPath: string | null; retainedStatus: string; byteSize: number | null; sha256: string | null }>;
type Lock = Readonly<{ version: number; entries: readonly LockEntry[] }>;

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const domainHash = (domain: string, value: unknown) => sha256(`${domain}\0${canonical(value)}`);
const exactCanonical = (left: unknown, right: unknown) => canonical(left) === canonical(right);

const status = (closure: HousePrimaryFinalClosure | null, hasArtifacts: boolean): Readonly<{ parseStatus: HousePrimaryParseStatus; missingReason: HousePrimaryObservation["missingReason"] }> => {
  if (closure === "future_event") return { parseStatus: "future_event", missingReason: "future_event" };
  if (closure === "not_held") return { parseStatus: "not_held", missingReason: "not_held" };
  if (closure === "authority_unavailable") return { parseStatus: "authority_unavailable", missingReason: "authority_unavailable" };
  if (closure === "source_blocked" || !hasArtifacts) return { parseStatus: "source_blocked", missingReason: "source_blocked" };
  return { parseStatus: "ready_unparsed", missingReason: "parser_not_implemented" };
};

export function buildHousePrimaryProjection(root = process.cwd()): HousePrimaryProjection {
  const registryBytes = readFileSync(join(root, "data/rapid-acquisition/house-primary-source-registry-v1.json"));
  const registry = validateHousePrimarySourceRegistry(JSON.parse(registryBytes.toString("utf8")));
  const lock = JSON.parse(readFileSync(join(root, "data/source-lock.json"), "utf8")) as Lock;
  if (lock.version !== 1 || !Array.isArray(lock.entries)) throw new Error("HOUSE_PRIMARY_SOURCE_LOCK_INVALID");

  const sources: HousePrimaryProjectedSource[] = [];
  const observations: HousePrimaryObservation[] = [];
  const coverageRows: HousePrimaryCoverageRow[] = [];
  const seenSources = new Set<string>();

  for (const row of registry.rows) {
    const projectedSources = row.artifacts.map((artifact) => {
      const matching = lock.entries.filter((entry) => entry.id === artifact.sourceId);
      const retainedPath = `data/source/rapid/${artifact.outputPath}`;
      const expectedUrl = artifact.allowedFinalUrl ?? artifact.url;
      if (matching.length !== 1) throw new Error(`HOUSE_PRIMARY_ARTIFACT_LOCK_ID_INVALID:${artifact.sourceId}`);
      const entry = matching[0]!;
      if (entry.retainedStatus !== "retained" || entry.retainedPath !== retainedPath || entry.url !== expectedUrl || entry.byteSize !== artifact.expectedBytes || entry.sha256 !== artifact.expectedSha256) throw new Error(`HOUSE_PRIMARY_ARTIFACT_LOCK_MISMATCH:${artifact.sourceId}`);
      const bytes = readFileSync(join(root, retainedPath));
      if (bytes.length !== artifact.expectedBytes || sha256(bytes) !== artifact.expectedSha256) throw new Error(`HOUSE_PRIMARY_ARTIFACT_DRIFT:${artifact.sourceId}`);
      const projected = { sourceId: artifact.sourceId, url: expectedUrl, retainedPath, byteSize: artifact.expectedBytes!, sha256: artifact.expectedSha256! };
      if (!seenSources.has(projected.sourceId)) { seenSources.add(projected.sourceId); sources.push(projected); }
      return projected;
    }).sort((left, right) => byteCompare(left.sourceId, right.sourceId));
    const rowStatus = status(row.finalClosure, projectedSources.length > 0);
    const sourceLockIds = projectedSources.map((source) => source.sourceId);
    coverageRows.push({ coverageId: `${row.stateCode.toLowerCase()}:primary-coverage:${row.cycleYear}`, stateCode: row.stateCode, cycleYear: row.cycleYear, expectedTargetDistricts: [...row.targetDistricts], retainedArtifactCount: projectedSources.length, parsedDistrictCount: 0, ...rowStatus, sourceLockIds });
    for (const districtLabel of row.targetDistricts) {
      observations.push({ observationId: `${row.stateCode.toLowerCase()}:primary:${row.cycleYear}:${districtLabel.slice(3).toLowerCase()}`, stateCode: row.stateCode, cycleYear: row.cycleYear, districtLabel, ...rowStatus, sourceLockIds, sourceContestId: null, candidates: null, votes: null, winner: null, identity: null, scoreEligible: false });
    }
  }

  sources.sort((left, right) => byteCompare(left.sourceId, right.sourceId));
  observations.sort((left, right) => byteCompare(left.observationId, right.observationId));
  coverageRows.sort((left, right) => byteCompare(left.coverageId, right.coverageId));
  if (sources.length !== 16 || observations.length !== 78 || coverageRows.length !== 48) throw new Error("HOUSE_PRIMARY_PROJECTION_CLOSURE_INVALID");
  const byStatus = Object.fromEntries((["ready_unparsed", "source_blocked", "authority_unavailable", "future_event", "not_held"] as const).map((key) => [key, observations.filter((row) => row.parseStatus === key).length])) as Record<HousePrimaryParseStatus, number>;
  const sourceSetSha256 = domainHash("dsa-seats:rapid-house-primary-source-set:v1", sources);
  const observationSetSha256 = domainHash("dsa-seats:rapid-house-primary-observation-set:v1", observations);
  const coverageSetSha256 = domainHash("dsa-seats:rapid-house-primary-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, retainedSources: sources.length, parsedDistricts: 0 as const, scoreEligibleDistricts: 0 as const, byStatus };
  const unsigned = { schema: "rapid-house-primary-projection-v1" as const, version: 1 as const, registrySha256: sha256(registryBytes), sources, sourceSetSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: domainHash("dsa-seats:rapid-house-primary-package:v1", unsigned) };
}

export function validateHousePrimaryProjection(value: unknown, root = process.cwd()): HousePrimaryProjection {
  const expected = buildHousePrimaryProjection(root);
  if (!exactCanonical(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_INVALID");
  return value as HousePrimaryProjection;
}

export function buildHousePrimaryCoverageLedger(projection = buildHousePrimaryProjection()): HousePrimaryCoverageLedger {
  const rows = projection.coverageRows.map((row) => ({ stateCode: row.stateCode, cycleYear: row.cycleYear, expectedTargetDistricts: row.expectedTargetDistricts, retainedArtifactCount: row.retainedArtifactCount, parsedDistrictCount: 0 as const, status: row.parseStatus, missingByReason: [{ reason: row.missingReason, count: row.expectedTargetDistricts.length }], artifactLockIds: row.sourceLockIds }));
  const rowSetSha256 = domainHash("dsa-seats:rapid-house-primary-coverage-ledger-row-set:v1", rows);
  const unsigned = { schema: "rapid-house-primary-coverage-ledger-v1" as const, version: 1 as const, projectionSha256: projection.packageSha256, rows, rowSetSha256 };
  return { ...unsigned, packageSha256: domainHash("dsa-seats:rapid-house-primary-coverage-ledger-package:v1", unsigned) };
}

export function validateHousePrimaryCoverageLedger(value: unknown, projection = buildHousePrimaryProjection()): HousePrimaryCoverageLedger {
  const expected = buildHousePrimaryCoverageLedger(projection);
  if (!exactCanonical(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_INVALID");
  return value as HousePrimaryCoverageLedger;
}
