import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateKentuckyPrimaryResultsV3 } from "./house-primary-kentucky-results-v3";
import {
  type HousePrimaryCoverageLedgerV18,
  type HousePrimaryProjectionV18,
  validateHousePrimaryProjectionV18,
} from "./house-primary-projection-v18";

export interface HousePrimaryProjectionV19 {
  readonly schema: "rapid-house-primary-projection-v19";
  readonly version: 19;
  readonly parentProjectionPackageSha256: string;
  readonly kentuckyResultsV3PackageSha256: string;
  readonly observations: HousePrimaryProjectionV18["observations"];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV18["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{
    stateCycles: 48;
    districtObservations: 78;
    reportedContests: 36;
    sourceAbsent: 4;
    processedDistricts: 40;
    candidateRows: 93;
    retainedCandidateVotes: 2265373;
    sourceMarkedWinnerContests: 6;
    scoreEligibleDistricts: 0;
  }>;
  readonly packageSha256: string;
}

export interface HousePrimaryCoverageLedgerV19 extends Omit<HousePrimaryCoverageLedgerV18, "schema" | "version" | "projectionSha256"> {
  readonly schema: "rapid-house-primary-coverage-ledger-v19";
  readonly version: 19;
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

export function buildHousePrimaryProjectionV19(root = process.cwd()): HousePrimaryProjectionV19 {
  const parent = validateHousePrimaryProjectionV18(
    JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v18.json"), "utf8")),
    root,
  );
  const kentucky = validateKentuckyPrimaryResultsV3(
    JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-kentucky-results-v3.json"), "utf8")),
    root,
  );
  const absence = kentucky.sourceAbsent[0];
  const observations: HousePrimaryProjectionV18["observations"] = parent.observations.map((row) => row.observationId !== "ky:primary:2026:03"
    ? row
    : {
      ...row,
      parseStatus: "source_absent",
      missingReason: absence.status,
      sourceLockIds: [...absence.sourceLockIds],
      sourceContestId: null,
      candidateCount: null,
      votes: null,
      sourceWinnerStatus: null,
      resultAuthorityStatus: null,
      winner: null,
      identity: null,
      scoreEligible: false,
    });
  const coverageRows = parent.coverageRows.map((row) => row.stateCode !== "KY" || row.cycleYear !== 2026
    ? row
    : {
      ...row,
      retainedArtifactCount: 2,
      parsedDistrictCount: 0,
      sourceAbsentDistrictCount: 1,
      status: "source_absent" as const,
      missingByReason: [{ reason: absence.status, count: 1 }],
      artifactLockIds: [...absence.sourceLockIds],
    });
  const reported = observations.filter((row) => row.parseStatus === "parsed").length;
  const absent = observations.filter((row) => row.parseStatus === "source_absent").length;
  const votes = observations.reduce((sum, row) => sum + (row.votes ?? 0), 0);
  const marked = observations.filter((row) => row.sourceWinnerStatus === "marked_by_source").length;
  if (
    reported !== 36
    || absent !== 4
    || votes !== 2265373
    || marked !== 6
    || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)
  ) throw new Error("HOUSE_PRIMARY_V19_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v19-observation-set:v1", observations);
  const coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v19-coverage-set:v1", coverageRows);
  const summary = {
    stateCycles: 48 as const,
    districtObservations: 78 as const,
    reportedContests: 36 as const,
    sourceAbsent: 4 as const,
    processedDistricts: 40 as const,
    candidateRows: 93 as const,
    retainedCandidateVotes: 2265373 as const,
    sourceMarkedWinnerContests: 6 as const,
    scoreEligibleDistricts: 0 as const,
  };
  const unsigned = {
    schema: "rapid-house-primary-projection-v19" as const,
    version: 19 as const,
    parentProjectionPackageSha256: parent.packageSha256,
    kentuckyResultsV3PackageSha256: kentucky.packageSha256,
    observations,
    observationSetSha256,
    coverageRows,
    coverageSetSha256,
    summary,
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v19-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV19(value: unknown, root = process.cwd()): HousePrimaryProjectionV19 {
  const expected = buildHousePrimaryProjectionV19(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V19_INVALID");
  return value as HousePrimaryProjectionV19;
}

export function buildHousePrimaryCoverageLedgerV19(projection = buildHousePrimaryProjectionV19()): HousePrimaryCoverageLedgerV19 {
  const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v19-ledger-row-set:v1", projection.coverageRows);
  const unsigned = {
    schema: "rapid-house-primary-coverage-ledger-v19" as const,
    version: 19 as const,
    projectionSha256: projection.packageSha256,
    rows: projection.coverageRows,
    rowSetSha256,
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v19-ledger-package:v1", unsigned) };
}
