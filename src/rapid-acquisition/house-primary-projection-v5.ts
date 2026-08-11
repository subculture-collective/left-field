import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateMissouriPrimaryResults } from "./house-primary-missouri-results";
import { type HousePrimaryCoverageLedgerV4, type HousePrimaryProjectionV4, type HousePrimaryV4Observation, validateHousePrimaryProjectionV4 } from "./house-primary-projection-v4";
import { byteCompare, canonical, hash, sha, exact } from "./shared";

export interface HousePrimaryProjectionV5 {
  readonly schema: "rapid-house-primary-projection-v5";
  readonly version: 5;
  readonly parentProjectionPackageSha256: string;
  readonly missouriResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV4Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV4["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 14; sourceAbsent: 1; processedDistricts: 15; candidateRows: 33; retainedCandidateVotes: 1027677; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV5 extends Omit<HousePrimaryCoverageLedgerV4, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v5"; readonly version: 5; readonly projectionSha256: string; }

export function buildHousePrimaryProjectionV5(root = process.cwd()): HousePrimaryProjectionV5 {
  const parent = validateHousePrimaryProjectionV4(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v4.json"), "utf8")), root);
  const missouri = validateMissouriPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-missouri-results-v1.json"), "utf8")), root);
  const byDistrict = new Map(missouri.results.map((row) => [row.districtLabel, row]));
  const observations = parent.observations.map((row) => {
    const result = row.stateCode === "MO" && row.cycleYear === 2024 ? byDistrict.get(row.districtLabel as "MO-01" | "MO-05") : undefined;
    if (!result) return row;
    if (row.parseStatus !== "ready_unparsed" || !exact(row.sourceLockIds, ["mo-2024-primary-results"])) throw new Error("HOUSE_PRIMARY_V5_MISSOURI_PARENT_INVALID");
    return { ...row, parseStatus: "parsed" as const, missingReason: null, sourceLockIds: result.sourceLockIds, sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode === "MO" && row.cycleYear === 2024 ? { ...row, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: [...missouri.results[0]!.sourceLockIds] } : row);
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length, sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length, retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 14 || sourceAbsent !== 1 || retainedCandidateVotes !== 1027677 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V5_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v5-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v5-coverage-set:v1", coverageRows), summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 14 as const, sourceAbsent: 1 as const, processedDistricts: 15 as const, candidateRows: 33 as const, retainedCandidateVotes: 1027677 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v5" as const, version: 5 as const, parentProjectionPackageSha256: parent.packageSha256, missouriResultsPackageSha256: missouri.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v5-package:v1", unsigned) };
}
export function validateHousePrimaryProjectionV5(value: unknown, root = process.cwd()): HousePrimaryProjectionV5 { const expected = buildHousePrimaryProjectionV5(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V5_INVALID"); return value as HousePrimaryProjectionV5; }
export function buildHousePrimaryCoverageLedgerV5(projection = buildHousePrimaryProjectionV5()): HousePrimaryCoverageLedgerV5 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v5-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v5" as const, version: 5 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v5-ledger-package:v1", unsigned) }; }
export function validateHousePrimaryCoverageLedgerV5(value: unknown, projection = buildHousePrimaryProjectionV5()): HousePrimaryCoverageLedgerV5 { const expected = buildHousePrimaryCoverageLedgerV5(projection); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V5_INVALID"); return value as HousePrimaryCoverageLedgerV5; }
