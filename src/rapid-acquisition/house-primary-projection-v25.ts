import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateNevadaPrimaryResults } from "./house-primary-nevada-results";
import { validateHousePrimaryProjectionV24, type HousePrimaryCoverageLedgerV24, type HousePrimaryProjectionV24 } from "./house-primary-projection-v24";

type ParentObservation = HousePrimaryProjectionV24["observations"][number];
export type HousePrimaryV25Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{ resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "archived_official_statewide_primary_results_page" }>;
export interface HousePrimaryProjectionV25 {
  readonly schema: "rapid-house-primary-projection-v25"; readonly version: 25;
  readonly parentProjectionPackageSha256: string; readonly nevadaResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV25Observation[]; readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV24["coverageRows"]; readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 50; sourceAbsent: 6; processedDistricts: 56; candidateRows: 130; retainedCandidateVotes: 3282727; sourceMarkedWinnerContests: 9; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV25 extends Omit<HousePrimaryCoverageLedgerV24, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v25"; readonly version: 25; readonly projectionSha256: string }

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV25(root = process.cwd()): HousePrimaryProjectionV25 {
  const parent = validateHousePrimaryProjectionV24(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v24.json"), "utf8")), root);
  const nevada = validateNevadaPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-nevada-results-v1.json"), "utf8")), root);
  const results = new Map(nevada.observations.map((row) => [`${row.cycleYear}:${row.districtLabel}`, row]));
  const observations: HousePrimaryV25Observation[] = parent.observations.map((row) => {
    if (row.stateCode !== "NV" || row.cycleYear === 2026) return row;
    const result = results.get(`${row.cycleYear}:${row.districtLabel}`);
    if (!result || row.parseStatus !== "source_blocked" || row.sourceLockIds.length !== 0 || row.sourceContestId !== null || row.candidateCount !== null || row.votes !== null) throw new Error("HOUSE_PRIMARY_V25_NEVADA_PARENT_INVALID");
    if (result.observationStatus !== "reported_contest") return { ...row, parseStatus: "source_absent", missingReason: result.observationStatus, sourceLockIds: [result.sourceLockId], sourceContestId: null, candidateCount: null, votes: null, sourceWinnerStatus: null, resultAuthorityStatus: null };
    if (result.sourceWinnerStatus !== "not_marked_by_source") throw new Error("HOUSE_PRIMARY_V25_NEVADA_WINNER_STATUS_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [result.sourceLockId], sourceContestId: result.observationId, candidateCount: result.sourceCandidateNames!.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "NV" || row.cycleYear === 2026 ? row : { ...row, retainedArtifactCount: 1, parsedDistrictCount: nevada.observations.filter((item) => item.cycleYear === row.cycleYear && item.observationStatus === "reported_contest").length, sourceAbsentDistrictCount: nevada.observations.filter((item) => item.cycleYear === row.cycleYear && item.observationStatus !== "reported_contest").length, status: "parsed" as const, missingByReason: [{ reason: "source_absent_complete_official_statewide_results_page", count: 1 }], artifactLockIds: [nevada.observations.find((item) => item.cycleYear === row.cycleYear)!.sourceLockId] });
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 50 as const, sourceAbsent: 6 as const, processedDistricts: 56 as const, candidateRows: 130 as const, retainedCandidateVotes: 3282727 as const, sourceMarkedWinnerContests: 9 as const, scoreEligibleDistricts: 0 as const };
  if (observations.filter((row) => row.parseStatus === "parsed").length !== summary.reportedContests || observations.filter((row) => row.parseStatus === "source_absent").length !== summary.sourceAbsent || observations.reduce((sum, row) => sum + (row.votes ?? 0), 0) !== summary.retainedCandidateVotes || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null) || observations.filter((row) => row.stateCode === "NV" && row.cycleYear === 2026).some((row) => row.parseStatus !== "source_blocked" || row.sourceLockIds.length !== 0 || row.votes !== null)) throw new Error("HOUSE_PRIMARY_V25_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v25-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v25-coverage-set:v1", coverageRows);
  const unsigned = { schema: "rapid-house-primary-projection-v25" as const, version: 25 as const, parentProjectionPackageSha256: parent.packageSha256, nevadaResultsPackageSha256: nevada.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v25-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV25(value: unknown, root = process.cwd()): HousePrimaryProjectionV25 { const expected = buildHousePrimaryProjectionV25(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V25_INVALID"); return value as HousePrimaryProjectionV25; }
export function buildHousePrimaryCoverageLedgerV25(projection = buildHousePrimaryProjectionV25()): HousePrimaryCoverageLedgerV25 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v25-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v25" as const, version: 25 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v25-ledger-package:v1", unsigned) }; }
