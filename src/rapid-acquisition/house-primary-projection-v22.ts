import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateTennesseePrimaryResultsV2 } from "./house-primary-tennessee-results-v2";
import {
  type HousePrimaryCoverageLedgerV21,
  type HousePrimaryProjectionV21,
  validateHousePrimaryProjectionV21,
} from "./house-primary-projection-v21";

type ParentObservation = HousePrimaryProjectionV21["observations"][number];
export type HousePrimaryV22Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{ resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_state_enr_final_unofficial_result_snapshot_retained" }>;
export interface HousePrimaryProjectionV22 {
  readonly schema: "rapid-house-primary-projection-v22";
  readonly version: 22;
  readonly parentProjectionPackageSha256: string;
  readonly tennesseeResultsV2PackageSha256: string;
  readonly observations: readonly HousePrimaryV22Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV21["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 40; sourceAbsent: 4; processedDistricts: 44; candidateRows: 105; retainedCandidateVotes: 2522590; sourceMarkedWinnerContests: 9; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV22 extends Omit<HousePrimaryCoverageLedgerV21, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v22"; readonly version: 22; readonly projectionSha256: string }

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV22(root = process.cwd()): HousePrimaryProjectionV22 {
  const parent = validateHousePrimaryProjectionV21(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v21.json"), "utf8")), root);
  const tennessee = validateTennesseePrimaryResultsV2(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-tennessee-results-v2.json"), "utf8")), root);
  const result = tennessee.results.find((row) => row.cycleYear === 2026);
  if (!result) throw new Error("HOUSE_PRIMARY_V22_TENNESSEE_RESULT_MISSING");
  const observations: HousePrimaryV22Observation[] = parent.observations.map((row) => {
    if (row.observationId !== "tn:primary:2026:09") return row;
    if (row.parseStatus !== "source_blocked" || row.sourceLockIds.length !== 0 || row.districtLabel !== result.districtLabel) throw new Error("HOUSE_PRIMARY_V22_TENNESSEE_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [...result.sourceLockIds], sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "TN" || row.cycleYear !== 2026 ? row : { ...row, retainedArtifactCount: 1, parsedDistrictCount: 1, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: ["tn-2026-congressional-primary-enr"] });
  const reported = observations.filter((row) => row.parseStatus === "parsed").length;
  const absent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const votes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const marked = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (reported !== 40 || absent !== 4 || votes !== 2_522_590 || marked !== 9 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V22_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v22-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v22-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 40 as const, sourceAbsent: 4 as const, processedDistricts: 44 as const, candidateRows: 105 as const, retainedCandidateVotes: 2522590 as const, sourceMarkedWinnerContests: 9 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v22" as const, version: 22 as const, parentProjectionPackageSha256: parent.packageSha256, tennesseeResultsV2PackageSha256: tennessee.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v22-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV22(value: unknown, root = process.cwd()): HousePrimaryProjectionV22 {
  const expected = buildHousePrimaryProjectionV22(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V22_INVALID");
  return value as HousePrimaryProjectionV22;
}

export function buildHousePrimaryCoverageLedgerV22(projection = buildHousePrimaryProjectionV22()): HousePrimaryCoverageLedgerV22 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v22-ledger-row-set:v1", projection.coverageRows);
  const unsigned = { schema: "rapid-house-primary-coverage-ledger-v22" as const, version: 22 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v22-ledger-package:v1", unsigned) };
}
