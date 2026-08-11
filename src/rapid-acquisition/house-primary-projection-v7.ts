import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateIndianaPrimaryResults } from "./house-primary-indiana-results";
import { type HousePrimaryCoverageLedgerV6, type HousePrimaryProjectionV6, validateHousePrimaryProjectionV6 } from "./house-primary-projection-v6";
import { byteCompare, canonical, hash, sha, exact } from "./shared";

type ParentObservation = HousePrimaryProjectionV6["observations"][number];
export type HousePrimaryV7Observation = Omit<ParentObservation, "sourceWinnerStatus" | "resultAuthorityStatus"> & Readonly<{
  sourceWinnerStatus: ParentObservation["sourceWinnerStatus"] | "marked_by_source";
  resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_archive_house_json_retained";
}>;
export interface HousePrimaryProjectionV7 {
  readonly schema: "rapid-house-primary-projection-v7";
  readonly version: 7;
  readonly parentProjectionPackageSha256: string;
  readonly indianaResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV7Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV6["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 19; sourceAbsent: 1; processedDistricts: 20; candidateRows: 43; retainedCandidateVotes: 1215518; sourceMarkedWinnerContests: 4; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV7 extends Omit<HousePrimaryCoverageLedgerV6, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v7"; readonly version: 7; readonly projectionSha256: string; }

export function buildHousePrimaryProjectionV7(root = process.cwd()): HousePrimaryProjectionV7 {
  const parent = validateHousePrimaryProjectionV6(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v6.json"), "utf8")), root);
  const indiana = validateIndianaPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-indiana-results-v1.json"), "utf8")), root);
  const byCoordinate = new Map(indiana.results.map((row) => [`${row.cycleYear}:${row.districtLabel}`, row]));
  const observations: HousePrimaryV7Observation[] = parent.observations.map((row) => {
    const result = row.stateCode === "IN" ? byCoordinate.get(`${row.cycleYear}:${row.districtLabel}`) : undefined;
    if (!result) return row;
    const expectedParentSources = [result.sourceLockIds[0]];
    if (row.parseStatus !== "ready_unparsed" || !exact(row.sourceLockIds, expectedParentSources)) throw new Error("HOUSE_PRIMARY_V7_INDIANA_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: result.sourceLockIds, sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => {
    const results = indiana.results.filter((result) => result.cycleYear === row.cycleYear);
    if (row.stateCode !== "IN" || results.length === 0) return row;
    return { ...row, retainedArtifactCount: 2, parsedDistrictCount: results.length, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: [...new Set(results.flatMap((result) => result.sourceLockIds))] };
  });
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length;
  const sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const sourceMarkedWinnerContests = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 19 || sourceAbsent !== 1 || retainedCandidateVotes !== 1215518 || sourceMarkedWinnerContests !== 4 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V7_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v7-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v7-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 19 as const, sourceAbsent: 1 as const, processedDistricts: 20 as const, candidateRows: 43 as const, retainedCandidateVotes: 1215518 as const, sourceMarkedWinnerContests: 4 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v7" as const, version: 7 as const, parentProjectionPackageSha256: parent.packageSha256, indianaResultsPackageSha256: indiana.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v7-package:v1", unsigned) };
}
export function validateHousePrimaryProjectionV7(value: unknown, root = process.cwd()): HousePrimaryProjectionV7 { const expected = buildHousePrimaryProjectionV7(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V7_INVALID"); return value as HousePrimaryProjectionV7; }
export function buildHousePrimaryCoverageLedgerV7(projection = buildHousePrimaryProjectionV7()): HousePrimaryCoverageLedgerV7 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v7-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v7" as const, version: 7 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v7-ledger-package:v1", unsigned) }; }
export function validateHousePrimaryCoverageLedgerV7(value: unknown, projection = buildHousePrimaryProjectionV7()): HousePrimaryCoverageLedgerV7 { const expected = buildHousePrimaryCoverageLedgerV7(projection); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V7_INVALID"); return value as HousePrimaryCoverageLedgerV7; }
