import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateKentuckyPrimaryResults } from "./house-primary-kentucky-results";
import { type HousePrimaryCoverageLedgerV3, type HousePrimaryProjectionV3, type HousePrimaryV3Observation, validateHousePrimaryProjectionV3 } from "./house-primary-projection-v3";
import { hash, exact } from "./shared";

export type HousePrimaryV4Observation = Omit<HousePrimaryV3Observation, "resultAuthorityStatus"> & Readonly<{
  resultAuthorityStatus: HousePrimaryV3Observation["resultAuthorityStatus"] | "official_primary_result_pdf_retained_no_separate_certification_instrument";
}>;
export interface HousePrimaryProjectionV4 {
  readonly schema: "rapid-house-primary-projection-v4";
  readonly version: 4;
  readonly parentProjectionPackageSha256: string;
  readonly kentuckyResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV4Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV3["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 12; sourceAbsent: 1; processedDistricts: 13; candidateRows: 28; retainedCandidateVotes: 838171; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV4 extends Omit<HousePrimaryCoverageLedgerV3, "schema" | "version" | "projectionSha256"> {
  readonly schema: "rapid-house-primary-coverage-ledger-v4";
  readonly version: 4;
  readonly projectionSha256: string;
}

export function buildHousePrimaryProjectionV4(root = process.cwd()): HousePrimaryProjectionV4 {
  const parent = validateHousePrimaryProjectionV3(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v3.json"), "utf8")), root);
  const kentucky = validateKentuckyPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-kentucky-results-v1.json"), "utf8")), root);
  const result = kentucky.results[0];
  const observations: HousePrimaryV4Observation[] = parent.observations.map((row) => {
    if (row.observationId !== "ky:primary:2024:03") return row;
    if (row.parseStatus !== "ready_unparsed" || !exact(row.sourceLockIds, ["ky-2024-primary-results"])) throw new Error("HOUSE_PRIMARY_V4_KENTUCKY_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: result.sourceLockIds, sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode === "KY" && row.cycleYear === 2024 ? { ...row, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: [...result.sourceLockIds] } : row);
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length, sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length, retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 12 || sourceAbsent !== 1 || retainedCandidateVotes !== 838171 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V4_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v4-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v4-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 12 as const, sourceAbsent: 1 as const, processedDistricts: 13 as const, candidateRows: 28 as const, retainedCandidateVotes: 838171 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v4" as const, version: 4 as const, parentProjectionPackageSha256: parent.packageSha256, kentuckyResultsPackageSha256: kentucky.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v4-package:v1", unsigned) };
}
export function validateHousePrimaryProjectionV4(value: unknown, root = process.cwd()): HousePrimaryProjectionV4 { const expected = buildHousePrimaryProjectionV4(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V4_INVALID"); return value as HousePrimaryProjectionV4; }
export function buildHousePrimaryCoverageLedgerV4(projection = buildHousePrimaryProjectionV4()): HousePrimaryCoverageLedgerV4 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v4-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v4" as const, version: 4 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v4-ledger-package:v1", unsigned) }; }
export function validateHousePrimaryCoverageLedgerV4(value: unknown, projection = buildHousePrimaryProjectionV4()): HousePrimaryCoverageLedgerV4 { const expected = buildHousePrimaryCoverageLedgerV4(projection); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V4_INVALID"); return value as HousePrimaryCoverageLedgerV4; }
