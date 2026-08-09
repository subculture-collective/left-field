import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateIndianaPrimaryResultsV2 } from "./house-primary-indiana-results-v2";
import {
  type HousePrimaryCoverageLedgerV19,
  type HousePrimaryProjectionV19,
  validateHousePrimaryProjectionV19,
} from "./house-primary-projection-v19";

type ParentObservation = HousePrimaryProjectionV19["observations"][number];
export type HousePrimaryV20Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{
  resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_current_house_json_retained";
}>;

export interface HousePrimaryProjectionV20 {
  readonly schema: "rapid-house-primary-projection-v20";
  readonly version: 20;
  readonly parentProjectionPackageSha256: string;
  readonly indianaResultsV2PackageSha256: string;
  readonly observations: readonly HousePrimaryV20Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV19["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 38; sourceAbsent: 4; processedDistricts: 42; candidateRows: 99; retainedCandidateVotes: 2390223; sourceMarkedWinnerContests: 8; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}

export interface HousePrimaryCoverageLedgerV20 extends Omit<HousePrimaryCoverageLedgerV19, "schema" | "version" | "projectionSha256"> {
  readonly schema: "rapid-house-primary-coverage-ledger-v20";
  readonly version: 20;
  readonly projectionSha256: string;
}

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV20(root = process.cwd()): HousePrimaryProjectionV20 {
  const parent = validateHousePrimaryProjectionV19(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v19.json"), "utf8")), root);
  const indiana = validateIndianaPrimaryResultsV2(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-indiana-results-v2.json"), "utf8")), root);
  const additions = new Map(indiana.results.filter((row) => row.cycleYear === 2026).map((row) => [row.districtLabel, row]));
  const observations: HousePrimaryV20Observation[] = parent.observations.map((row) => {
    const result = row.stateCode === "IN" && row.cycleYear === 2026 ? additions.get(row.districtLabel as "IN-01" | "IN-07") : undefined;
    if (!result) return row;
    if (row.parseStatus !== "source_blocked" || row.sourceLockIds.length !== 0) throw new Error("HOUSE_PRIMARY_V20_INDIANA_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [...result.sourceLockIds], sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "IN" || row.cycleYear !== 2026 ? row : { ...row, retainedArtifactCount: 2, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: ["in-2026-primary-settings", "in-2026-primary-us-house-results"] });
  const reported = observations.filter((row) => row.parseStatus === "parsed").length;
  const absent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const votes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const marked = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (reported !== 38 || absent !== 4 || votes !== 2390223 || marked !== 8 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V20_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v20-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v20-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 38 as const, sourceAbsent: 4 as const, processedDistricts: 42 as const, candidateRows: 99 as const, retainedCandidateVotes: 2390223 as const, sourceMarkedWinnerContests: 8 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v20" as const, version: 20 as const, parentProjectionPackageSha256: parent.packageSha256, indianaResultsV2PackageSha256: indiana.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v20-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV20(value: unknown, root = process.cwd()): HousePrimaryProjectionV20 {
  const expected = buildHousePrimaryProjectionV20(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V20_INVALID");
  return value as HousePrimaryProjectionV20;
}

export function buildHousePrimaryCoverageLedgerV20(projection = buildHousePrimaryProjectionV20()): HousePrimaryCoverageLedgerV20 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v20-ledger-row-set:v1", projection.coverageRows);
  const unsigned = { schema: "rapid-house-primary-coverage-ledger-v20" as const, version: 20 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v20-ledger-package:v1", unsigned) };
}
