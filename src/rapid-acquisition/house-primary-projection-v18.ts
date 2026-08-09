import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateMississippiPrimaryResultsV3 } from "./house-primary-mississippi-results-v3";
import {
  type HousePrimaryCoverageLedgerV17,
  type HousePrimaryProjectionV17,
  validateHousePrimaryProjectionV17,
} from "./house-primary-projection-v17";

export interface HousePrimaryProjectionV18 {
  readonly schema: "rapid-house-primary-projection-v18";
  readonly version: 18;
  readonly parentProjectionPackageSha256: string;
  readonly mississippiResultsV3PackageSha256: string;
  readonly observations: HousePrimaryProjectionV17["observations"];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV17["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{
    stateCycles: 48;
    districtObservations: 78;
    reportedContests: 36;
    sourceAbsent: 3;
    processedDistricts: 39;
    candidateRows: 93;
    retainedCandidateVotes: 2265373;
    sourceMarkedWinnerContests: 6;
    scoreEligibleDistricts: 0;
  }>;
  readonly packageSha256: string;
}

export interface HousePrimaryCoverageLedgerV18 extends Omit<HousePrimaryCoverageLedgerV17, "schema" | "version" | "projectionSha256"> {
  readonly schema: "rapid-house-primary-coverage-ledger-v18";
  readonly version: 18;
  readonly projectionSha256: string;
}

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object"
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value as object).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

export function buildHousePrimaryProjectionV18(root = process.cwd()): HousePrimaryProjectionV18 {
  const parent = validateHousePrimaryProjectionV17(
    JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v17.json"), "utf8")),
    root,
  );
  const mississippi = validateMississippiPrimaryResultsV3(
    JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-mississippi-results-v3.json"), "utf8")),
    root,
  );
  const result = mississippi.results[2];
  const observations: HousePrimaryProjectionV17["observations"] = parent.observations.map((row) => row.observationId !== "ms:primary:2026:02"
    ? row
    : {
      ...row,
      parseStatus: "parsed",
      missingReason: null,
      sourceLockIds: [...result.sourceLockIds],
      sourceContestId: result.resultId,
      candidateCount: result.sourceCandidateNames.length,
      votes: result.totalVotes,
      sourceWinnerStatus: result.sourceWinnerStatus,
      resultAuthorityStatus: result.resultAuthorityStatus,
      winner: null,
      identity: null,
      scoreEligible: false,
    });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "MS" || row.cycleYear !== 2026
    ? row
    : {
      ...row,
      retainedArtifactCount: 2,
      parsedDistrictCount: 1,
      sourceAbsentDistrictCount: 0,
      status: "parsed" as const,
      missingByReason: [],
      artifactLockIds: [...result.sourceLockIds],
    });
  const reported = observations.filter((row) => row.parseStatus === "parsed").length;
  const absent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const votes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const marked = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (
    reported !== 36
    || absent !== 3
    || votes !== 2265373
    || marked !== 6
    || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)
  ) throw new Error("HOUSE_PRIMARY_V18_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v18-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v18-coverage-set:v1", coverageRows);
  const summary = {
    stateCycles: 48 as const,
    districtObservations: 78 as const,
    reportedContests: 36 as const,
    sourceAbsent: 3 as const,
    processedDistricts: 39 as const,
    candidateRows: 93 as const,
    retainedCandidateVotes: 2265373 as const,
    sourceMarkedWinnerContests: 6 as const,
    scoreEligibleDistricts: 0 as const,
  };
  const unsigned = {
    schema: "rapid-house-primary-projection-v18" as const,
    version: 18 as const,
    parentProjectionPackageSha256: parent.packageSha256,
    mississippiResultsV3PackageSha256: mississippi.packageSha256,
    observations,
    observationSetSha256,
    coverageRows,
    coverageSetSha256,
    summary,
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v18-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV18(value: unknown, root = process.cwd()): HousePrimaryProjectionV18 {
  const expected = buildHousePrimaryProjectionV18(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V18_INVALID");
  return value as HousePrimaryProjectionV18;
}

export function buildHousePrimaryCoverageLedgerV18(projection = buildHousePrimaryProjectionV18()): HousePrimaryCoverageLedgerV18 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v18-ledger-row-set:v1", projection.coverageRows);
  const unsigned = {
    schema: "rapid-house-primary-coverage-ledger-v18" as const,
    version: 18 as const,
    projectionSha256: projection.packageSha256,
    rows: projection.coverageRows,
    rowSetSha256,
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v18-ledger-package:v1", unsigned) };
}
