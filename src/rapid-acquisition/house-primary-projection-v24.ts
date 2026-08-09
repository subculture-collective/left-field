import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHousePrimaryProjectionV23, type HousePrimaryCoverageLedgerV23, type HousePrimaryProjectionV23 } from "./house-primary-projection-v23";
import { validateWisconsinPrimaryResults } from "./house-primary-wisconsin-results";

type ParentObservation = HousePrimaryProjectionV23["observations"][number];
export type HousePrimaryV24Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{ resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_state_canvass_report_retained" }>;
export interface HousePrimaryProjectionV24 {
  readonly schema: "rapid-house-primary-projection-v24"; readonly version: 24;
  readonly parentProjectionPackageSha256: string; readonly wisconsinResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV24Observation[]; readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV23["coverageRows"]; readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 46; sourceAbsent: 4; processedDistricts: 50; candidateRows: 122; retainedCandidateVotes: 3123464; sourceMarkedWinnerContests: 9; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV24 extends Omit<HousePrimaryCoverageLedgerV23, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v24"; readonly version: 24; readonly projectionSha256: string }

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV24(root = process.cwd()): HousePrimaryProjectionV24 {
  const parent = validateHousePrimaryProjectionV23(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v23.json"), "utf8")), root);
  const wisconsin = validateWisconsinPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-wisconsin-results-v1.json"), "utf8")), root);
  const results = new Map(wisconsin.results.map((row) => [`${row.cycleYear}:${row.districtLabel}`, row]));
  const observations: HousePrimaryV24Observation[] = parent.observations.map((row) => {
    if (row.stateCode !== "WI" || row.cycleYear === 2026) return row;
    const result = results.get(`${row.cycleYear}:${row.districtLabel}`);
    if (!result || row.parseStatus !== "source_blocked" || row.sourceLockIds.length !== 0 || row.sourceContestId !== null || row.candidateCount !== null || row.votes !== null) throw new Error("HOUSE_PRIMARY_V24_WISCONSIN_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [...result.sourceLockIds], sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "WI" || row.cycleYear === 2026 ? row : { ...row, retainedArtifactCount: 2, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: wisconsin.sources.find((source) => source.cycleYear === row.cycleYear) ? [wisconsin.sources.find((source) => source.cycleYear === row.cycleYear)!.pdfSourceLockId, wisconsin.sources.find((source) => source.cycleYear === row.cycleYear)!.textSourceLockId] : [] });
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 46 as const, sourceAbsent: 4 as const, processedDistricts: 50 as const, candidateRows: 122 as const, retainedCandidateVotes: 3123464 as const, sourceMarkedWinnerContests: 9 as const, scoreEligibleDistricts: 0 as const };
  if (observations.filter((row) => row.parseStatus === "parsed").length !== summary.reportedContests || observations.filter((row) => row.parseStatus === "source_absent").length !== summary.sourceAbsent || observations.reduce((sum, row) => sum + (row.votes ?? 0), 0) !== summary.retainedCandidateVotes || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null) || observations.filter((row) => row.stateCode === "WI" && row.cycleYear === 2026).some((row) => row.parseStatus !== "future_event" || row.sourceLockIds.length !== 0 || row.votes !== null)) throw new Error("HOUSE_PRIMARY_V24_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v24-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v24-coverage-set:v1", coverageRows);
  const unsigned = { schema: "rapid-house-primary-projection-v24" as const, version: 24 as const, parentProjectionPackageSha256: parent.packageSha256, wisconsinResultsPackageSha256: wisconsin.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v24-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV24(value: unknown, root = process.cwd()): HousePrimaryProjectionV24 { const expected = buildHousePrimaryProjectionV24(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V24_INVALID"); return value as HousePrimaryProjectionV24; }
export function buildHousePrimaryCoverageLedgerV24(projection = buildHousePrimaryProjectionV24()): HousePrimaryCoverageLedgerV24 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v24-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v24" as const, version: 24 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v24-ledger-package:v1", unsigned) }; }
