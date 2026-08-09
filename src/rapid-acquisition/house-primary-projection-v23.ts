import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHawaiiPrimaryResults2026 } from "./house-primary-hawaii-results-2026";
import {
  type HousePrimaryCoverageLedgerV22,
  type HousePrimaryProjectionV22,
  validateHousePrimaryProjectionV22,
} from "./house-primary-projection-v22";

type ParentObservation = HousePrimaryProjectionV22["observations"][number];
export type HousePrimaryV23Observation = Omit<ParentObservation, "resultAuthorityStatus"> & Readonly<{ resultAuthorityStatus: ParentObservation["resultAuthorityStatus"] | "official_state_election_result_snapshot_retained_not_claimed_certified" }>;
export interface HousePrimaryProjectionV23 {
  readonly schema: "rapid-house-primary-projection-v23";
  readonly version: 23;
  readonly parentProjectionPackageSha256: string;
  readonly hawaiiResults2026PackageSha256: string;
  readonly observations: readonly HousePrimaryV23Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV22["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 42; sourceAbsent: 4; processedDistricts: 46; candidateRows: 114; retainedCandidateVotes: 2708176; sourceMarkedWinnerContests: 9; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV23 extends Omit<HousePrimaryCoverageLedgerV22, "schema" | "version" | "projectionSha256"> { readonly schema: "rapid-house-primary-coverage-ledger-v23"; readonly version: 23; readonly projectionSha256: string }

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV23(root = process.cwd()): HousePrimaryProjectionV23 {
  const parent = validateHousePrimaryProjectionV22(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v22.json"), "utf8")), root);
  const hawaii = validateHawaiiPrimaryResults2026(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-hawaii-results-2026-v1.json"), "utf8")), root);
  const results = new Map(hawaii.results.map((row) => [row.districtLabel, row]));
  const observations: HousePrimaryV23Observation[] = parent.observations.map((row) => {
    if (row.stateCode !== "HI" || row.cycleYear !== 2026) return row;
    const result = results.get(row.districtLabel as "HI-01" | "HI-02");
    if (!result || row.parseStatus !== "future_event" || row.sourceLockIds.length !== 0 || row.sourceContestId !== null || row.candidateCount !== null || row.votes !== null) throw new Error("HOUSE_PRIMARY_V23_HAWAII_PARENT_INVALID");
    return { ...row, parseStatus: "parsed", missingReason: null, sourceLockIds: [...result.sourceLockIds], sourceContestId: result.resultId, candidateCount: result.sourceCandidateNames.length, votes: result.totalVotes, sourceWinnerStatus: result.sourceWinnerStatus, resultAuthorityStatus: result.resultAuthorityStatus };
  });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "HI" || row.cycleYear !== 2026 ? row : { ...row, retainedArtifactCount: 1, parsedDistrictCount: 2, sourceAbsentDistrictCount: 0, status: "parsed" as const, missingByReason: [], artifactLockIds: ["hi-2026-primary-summary"] });
  const reported = observations.filter((row) => row.parseStatus === "parsed").length;
  const absent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const votes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const marked = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (reported !== 42 || absent !== 4 || votes !== 2_708_176 || marked !== 9 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V23_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v23-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v23-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 42 as const, sourceAbsent: 4 as const, processedDistricts: 46 as const, candidateRows: 114 as const, retainedCandidateVotes: 2708176 as const, sourceMarkedWinnerContests: 9 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v23" as const, version: 23 as const, parentProjectionPackageSha256: parent.packageSha256, hawaiiResults2026PackageSha256: hawaii.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v23-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV23(value: unknown, root = process.cwd()): HousePrimaryProjectionV23 {
  const expected = buildHousePrimaryProjectionV23(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V23_INVALID");
  return value as HousePrimaryProjectionV23;
}

export function buildHousePrimaryCoverageLedgerV23(projection = buildHousePrimaryProjectionV23()): HousePrimaryCoverageLedgerV23 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v23-ledger-row-set:v1", projection.coverageRows);
  const unsigned = { schema: "rapid-house-primary-coverage-ledger-v23" as const, version: 23 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v23-ledger-package:v1", unsigned) };
}
