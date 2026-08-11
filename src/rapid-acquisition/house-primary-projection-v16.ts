import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateMissouriPrimaryResultsV2 } from "./house-primary-missouri-results-v2";
import { type HousePrimaryCoverageLedgerV15, type HousePrimaryProjectionV15, validateHousePrimaryProjectionV15 } from "./house-primary-projection-v15";
import { byteCompare, canonical, hash, sha, exact } from "./shared";

export interface HousePrimaryProjectionV16 { readonly schema: "rapid-house-primary-projection-v16"; readonly version: 16; readonly parentProjectionPackageSha256: string; readonly missouriResultsV2PackageSha256: string; readonly observations: HousePrimaryProjectionV15["observations"]; readonly observationSetSha256: string; readonly coverageRows: HousePrimaryProjectionV15["coverageRows"]; readonly coverageSetSha256: string; readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 34; sourceAbsent: 3; processedDistricts: 37; candidateRows: 88; retainedCandidateVotes: 2139039; sourceMarkedWinnerContests: 6; scoreEligibleDistricts: 0 }>; readonly packageSha256: string }
export interface HousePrimaryCoverageLedgerV16 extends Omit<HousePrimaryCoverageLedgerV15, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v16"; readonly version: 16; readonly projectionSha256: string }

export function buildHousePrimaryProjectionV16(root = process.cwd()): HousePrimaryProjectionV16 {
  const parent = validateHousePrimaryProjectionV15(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v15.json"), "utf8")), root);
  const missouri = validateMissouriPrimaryResultsV2(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-missouri-results-v2.json"), "utf8")), root);
  const byDistrict = new Map(missouri.results.filter((row) => row.cycleYear === 2022).map((row) => [row.districtLabel, row]));
  const observations: HousePrimaryProjectionV15["observations"] = parent.observations.map((row) => {
    if (row.stateCode !== "MO" || row.cycleYear !== 2022) return row;
    const result = byDistrict.get(row.districtLabel as "MO-01" | "MO-05");
    if (!result) throw new Error("HOUSE_PRIMARY_V16_MISSOURI_RESULT_MISSING");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [...result.sourceLockIds], sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus, winner: null, identity: null, scoreEligible: false };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "MO" || row.cycleYear !== 2022 ? row : { ...row, retainedArtifactCount: 2, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: ["mo-2022-primary-results-archived", "mo-2022-primary-results-layout-text"] });
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length;
  const sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const sourceMarkedWinnerContests = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 34 || sourceAbsent !== 3 || retainedCandidateVotes !== 2_139_039 || sourceMarkedWinnerContests !== 6 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V16_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v16-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v16-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 34 as const, sourceAbsent: 3 as const, processedDistricts: 37 as const, candidateRows: 88 as const, retainedCandidateVotes: 2_139_039 as const, sourceMarkedWinnerContests: 6 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v16" as const, version: 16 as const, parentProjectionPackageSha256: parent.packageSha256, missouriResultsV2PackageSha256: missouri.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v16-package:v1", unsigned) };
}
export function validateHousePrimaryProjectionV16(value: unknown, root = process.cwd()): HousePrimaryProjectionV16 { const expected = buildHousePrimaryProjectionV16(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V16_INVALID"); return value as HousePrimaryProjectionV16; }
export function buildHousePrimaryCoverageLedgerV16(projection = buildHousePrimaryProjectionV16()): HousePrimaryCoverageLedgerV16 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v16-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v16" as const, version: 16 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v16-ledger-package:v1", unsigned) }; }
export function validateHousePrimaryCoverageLedgerV16(value: unknown, projection = buildHousePrimaryProjectionV16()): HousePrimaryCoverageLedgerV16 { const expected = buildHousePrimaryCoverageLedgerV16(projection); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V16_INVALID"); return value as HousePrimaryCoverageLedgerV16; }
