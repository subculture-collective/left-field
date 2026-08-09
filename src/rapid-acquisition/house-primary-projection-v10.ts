import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type HousePrimaryCoverageLedgerV9, type HousePrimaryProjectionV9, validateHousePrimaryProjectionV9 } from "./house-primary-projection-v9";
import { validateTennesseePrimaryResults } from "./house-primary-tennessee-results";

type ParentObservation = HousePrimaryProjectionV9["observations"][number];
export type HousePrimaryV10Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{ resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_secretary_precinct_workbook_retained" }>;
export interface HousePrimaryProjectionV10 { readonly schema: "rapid-house-primary-projection-v10"; readonly version: 10; readonly parentProjectionPackageSha256: string; readonly tennesseeResultsPackageSha256: string; readonly observations: readonly HousePrimaryV10Observation[]; readonly observationSetSha256: string; readonly coverageRows: HousePrimaryProjectionV9["coverageRows"]; readonly coverageSetSha256: string; readonly summary: Readonly<{ stateCycles:48;districtObservations:78;reportedContests:26;sourceAbsent:2;processedDistricts:28;candidateRows:70;retainedCandidateVotes:1621068;sourceMarkedWinnerContests:5;scoreEligibleDistricts:0 }>; readonly packageSha256: string; }
export interface HousePrimaryCoverageLedgerV10 extends Omit<HousePrimaryCoverageLedgerV9, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v10"; readonly version: 10; readonly projectionSha256: string; }
const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV10(root = process.cwd()): HousePrimaryProjectionV10 {
  const parent = validateHousePrimaryProjectionV9(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v9.json"), "utf8")), root);
  const tennessee = validateTennesseePrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-tennessee-results-v1.json"), "utf8")), root);
  const byObservation = new Map(tennessee.results.map((row) => [`tn:primary:${row.cycleYear}:09`, row]));
  const observations: HousePrimaryV10Observation[] = parent.observations.map((row) => {
    if (row.stateCode !== "TN" || row.cycleYear === 2026) return row;
    const result = byObservation.get(row.observationId); if (!result) throw new Error("HOUSE_PRIMARY_V10_TENNESSEE_RESULT_MISSING");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: result.sourceLockIds, sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "TN" || row.cycleYear === 2026 ? row : { ...row, retainedArtifactCount: 1, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: [`tn-${row.cycleYear}-primary-precinct-results`] });
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length, sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length, retainedCandidateVotes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0), sourceMarkedWinnerContests = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 26 || sourceAbsent !== 2 || retainedCandidateVotes !== 1621068 || sourceMarkedWinnerContests !== 5 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V10_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v10-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v10-coverage-set:v1", coverageRows), summary = { stateCycles:48 as const,districtObservations:78 as const,reportedContests:26 as const,sourceAbsent:2 as const,processedDistricts:28 as const,candidateRows:70 as const,retainedCandidateVotes:1621068 as const,sourceMarkedWinnerContests:5 as const,scoreEligibleDistricts:0 as const }, unsigned = { schema:"rapid-house-primary-projection-v10" as const,version:10 as const,parentProjectionPackageSha256:parent.packageSha256,tennesseeResultsPackageSha256:tennessee.packageSha256,observations,observationSetSha256,coverageRows,coverageSetSha256,summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v10-package:v1", unsigned) };
}
export function validateHousePrimaryProjectionV10(value: unknown, root = process.cwd()): HousePrimaryProjectionV10 { const expected = buildHousePrimaryProjectionV10(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V10_INVALID"); return value as HousePrimaryProjectionV10; }
export function buildHousePrimaryCoverageLedgerV10(projection = buildHousePrimaryProjectionV10()): HousePrimaryCoverageLedgerV10 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v10-ledger-row-set:v1", projection.coverageRows), unsigned = { schema:"rapid-house-primary-coverage-ledger-v10" as const,version:10 as const,projectionSha256:projection.packageSha256,rows:projection.coverageRows,rowSetSha256 }; return { ...unsigned, packageSha256:hash("dsa-seats:rapid-house-primary-v10-ledger-package:v1",unsigned) }; }
export function validateHousePrimaryCoverageLedgerV10(value: unknown, projection=buildHousePrimaryProjectionV10()): HousePrimaryCoverageLedgerV10 { const expected=buildHousePrimaryCoverageLedgerV10(projection); if(!exact(value,expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V10_INVALID"); return value as HousePrimaryCoverageLedgerV10; }
