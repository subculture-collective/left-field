import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateKansasPrimaryResults } from "./house-primary-kansas-results";
import { type HousePrimaryV2Observation, type HousePrimaryV2Status, validateHousePrimaryProjectionV2 } from "./house-primary-projection-v2";

export type HousePrimaryV3Observation = Omit<HousePrimaryV2Observation, "resultAuthorityStatus"> & Readonly<{
  resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified" | "official_precinct_workbook_retained_not_claimed_certified" | null;
}>;

export interface HousePrimaryProjectionV3 {
  readonly schema: "rapid-house-primary-projection-v3";
  readonly version: 3;
  readonly parentProjectionPackageSha256: string;
  readonly kansasResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV3Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: readonly Readonly<{ stateCode: string; cycleYear: number; expectedTargetDistricts: readonly string[]; retainedArtifactCount: number; parsedDistrictCount: number; sourceAbsentDistrictCount: number; status: HousePrimaryV2Status; missingByReason: readonly Readonly<{ reason: string; count: number }>[]; artifactLockIds: readonly string[] }>[];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 11; sourceAbsent: 1; processedDistricts: 12; candidateRows: 25; retainedCandidateVotes: 785530; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}

export interface HousePrimaryCoverageLedgerV3 {
  readonly schema: "rapid-house-primary-coverage-ledger-v3";
  readonly version: 3;
  readonly projectionSha256: string;
  readonly rows: HousePrimaryProjectionV3["coverageRows"];
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV3(root = process.cwd()): HousePrimaryProjectionV3 {
  const parent = validateHousePrimaryProjectionV2(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v2.json"), "utf8")), root);
  const kansas = validateKansasPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-kansas-results-v1.json"), "utf8")), root);
  const kansasByKey = new Map(kansas.results.map((row) => [`KS-${row.cycleYear}-${row.districtLabel}`, row]));
  const observations: HousePrimaryV3Observation[] = parent.observations.map((row) => {
    const result = kansasByKey.get(`${row.stateCode}-${row.cycleYear}-${row.districtLabel}`);
    if (!result) return row;
    if (row.parseStatus !== "ready_unparsed" || row.sourceLockIds.length !== 1 || row.sourceLockIds[0] !== result.sourceLockId) throw new Error("HOUSE_PRIMARY_V3_KANSAS_PARENT_INVALID");
    return {
      ...row,
      parseStatus: "parsed",
      missingReason: null,
      sourceLockIds: [result.sourceLockId],
      sourceContestId: result.resultId,
      candidateCount: 1,
      votes: result.candidateVotes,
      sourceWinnerStatus: result.sourceWinnerStatus,
      resultAuthorityStatus: result.resultAuthorityStatus,
    };
  });
  const coverageRows = parent.coverageRows.map((row) => {
    if (row.stateCode !== "KS" || (row.cycleYear !== 2022 && row.cycleYear !== 2024)) return row;
    const matches = observations.filter((item) => item.stateCode === row.stateCode && item.cycleYear === row.cycleYear);
    if (matches.length !== 1 || matches[0]!.parseStatus !== "parsed") throw new Error("HOUSE_PRIMARY_V3_KANSAS_COVERAGE_INVALID");
    return { ...row, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [] };
  });
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length;
  const sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 11 || sourceAbsent !== 1 || retainedCandidateVotes !== 785530 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V3_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v3-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v3-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 11 as const, sourceAbsent: 1 as const, processedDistricts: 12 as const, candidateRows: 25 as const, retainedCandidateVotes: 785530 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v3" as const, version: 3 as const, parentProjectionPackageSha256: parent.packageSha256, kansasResultsPackageSha256: kansas.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v3-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV3(value: unknown, root = process.cwd()): HousePrimaryProjectionV3 {
  const expected = buildHousePrimaryProjectionV3(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V3_INVALID");
  return value as HousePrimaryProjectionV3;
}

export function buildHousePrimaryCoverageLedgerV3(projection = buildHousePrimaryProjectionV3()): HousePrimaryCoverageLedgerV3 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v3-ledger-row-set:v1", projection.coverageRows);
  const unsigned = { schema: "rapid-house-primary-coverage-ledger-v3" as const, version: 3 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v3-ledger-package:v1", unsigned) };
}

export function validateHousePrimaryCoverageLedgerV3(value: unknown, projection = buildHousePrimaryProjectionV3()): HousePrimaryCoverageLedgerV3 {
  const expected = buildHousePrimaryCoverageLedgerV3(projection);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V3_INVALID");
  return value as HousePrimaryCoverageLedgerV3;
}
