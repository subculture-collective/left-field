import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHousePrimaryProjection } from "./house-primary-projection";
import { validateStructuredPrimaryResults } from "./house-primary-structured-results";
import { byteCompare, hash, exact } from "./shared";

export type HousePrimaryV2Status = "parsed" | "source_absent" | "ready_unparsed" | "source_blocked" | "authority_unavailable" | "future_event" | "not_held";
export interface HousePrimaryV2Observation {
  readonly observationId: string;
  readonly stateCode: string;
  readonly cycleYear: number;
  readonly districtLabel: string;
  readonly parseStatus: HousePrimaryV2Status;
  readonly missingReason: string | null;
  readonly sourceLockIds: readonly string[];
  readonly sourceContestId: string | null;
  readonly candidateCount: number | null;
  readonly votes: number | null;
  readonly sourceWinnerStatus: "not_marked_by_source" | null;
  readonly resultAuthorityStatus: "official_result_bytes_retained_not_claimed_certified" | null;
  readonly winner: null;
  readonly identity: null;
  readonly scoreEligible: false;
}
export interface HousePrimaryProjectionV2 {
  readonly schema: "rapid-house-primary-projection-v2";
  readonly version: 2;
  readonly parentProjectionPackageSha256: string;
  readonly structuredResultsPackageSha256: string;
  readonly observations: readonly HousePrimaryV2Observation[];
  readonly observationSetSha256: string;
  readonly coverageRows: readonly Readonly<{ stateCode: string; cycleYear: number; expectedTargetDistricts: readonly string[]; retainedArtifactCount: number; parsedDistrictCount: number; sourceAbsentDistrictCount: number; status: HousePrimaryV2Status; missingByReason: readonly Readonly<{ reason: string; count: number }>[]; artifactLockIds: readonly string[] }>[];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{ stateCycles: 48; districtObservations: 78; reportedContests: 9; sourceAbsent: 1; processedDistricts: 10; candidateRows: 23; contestVotes: 643748; scoreEligibleDistricts: 0 }>;
  readonly packageSha256: string;
}
export interface HousePrimaryCoverageLedgerV2 {
  readonly schema: "rapid-house-primary-coverage-ledger-v2";
  readonly version: 2;
  readonly projectionSha256: string;
  readonly rows: HousePrimaryProjectionV2["coverageRows"];
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export function buildHousePrimaryProjectionV2(root = process.cwd()): HousePrimaryProjectionV2 {
  const parent = validateHousePrimaryProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-projection-v1.json"), "utf8")), root);
  const structured = validateStructuredPrimaryResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-house-primary-structured-results-v1.json"), "utf8")), root);
  const structuredByKey = new Map(structured.observations.map((row) => [`${row.stateCode}-${row.cycleYear}-${row.districtLabel}`, row]));
  const contests = new Map(structured.contests.map((row) => [row.contestId, row]));
  const observations: HousePrimaryV2Observation[] = parent.observations.map((row) => {
    const parsed = structuredByKey.get(`${row.stateCode}-${row.cycleYear}-${row.districtLabel}`);
    if (!parsed) return { observationId: row.observationId, stateCode: row.stateCode, cycleYear: row.cycleYear, districtLabel: row.districtLabel, parseStatus: row.parseStatus, missingReason: row.missingReason, sourceLockIds: row.sourceLockIds, sourceContestId: null, candidateCount: null, votes: null, sourceWinnerStatus: null, resultAuthorityStatus: null, winner: null, identity: null, scoreEligible: false };
    if (parsed.status === "source_absent_no_disposition_inference") return { observationId: row.observationId, stateCode: row.stateCode, cycleYear: row.cycleYear, districtLabel: row.districtLabel, parseStatus: "source_absent", missingReason: "source_absent_no_disposition_inference", sourceLockIds: [parsed.sourceLockId], sourceContestId: null, candidateCount: null, votes: null, sourceWinnerStatus: null, resultAuthorityStatus: null, winner: null, identity: null, scoreEligible: false };
    const contest = contests.get(parsed.contestId!); if (!contest) throw new Error("HOUSE_PRIMARY_V2_CONTEST_JOIN_INVALID");
    return { observationId: row.observationId, stateCode: row.stateCode, cycleYear: row.cycleYear, districtLabel: row.districtLabel, parseStatus: "parsed", missingReason: null, sourceLockIds: [parsed.sourceLockId], sourceContestId: contest.contestId, candidateCount: contest.candidates.length, votes: contest.totalVotes, sourceWinnerStatus: contest.sourceWinnerStatus, resultAuthorityStatus: contest.resultAuthorityStatus, winner: null, identity: null, scoreEligible: false };
  });
  const coverageRows = parent.coverageRows.map((row) => {
    const matches = observations.filter((item) => item.stateCode === row.stateCode && item.cycleYear === row.cycleYear);
    const parsed = matches.filter((item) => item.parseStatus === "parsed").length, absent = matches.filter((item) => item.parseStatus === "source_absent").length;
    if (parsed + absent === 0) return { stateCode: row.stateCode, cycleYear: row.cycleYear, expectedTargetDistricts: row.expectedTargetDistricts, retainedArtifactCount: row.retainedArtifactCount, parsedDistrictCount: 0, sourceAbsentDistrictCount: 0, status: row.parseStatus, missingByReason: [{ reason: row.missingReason, count: matches.length }], artifactLockIds: row.sourceLockIds };
    const status: HousePrimaryV2Status = parsed === matches.length ? "parsed" : absent === matches.length ? "source_absent" : "ready_unparsed";
    const missingByReason = absent ? [{ reason: "source_absent_no_disposition_inference", count: absent }] : [];
    return { stateCode: row.stateCode, cycleYear: row.cycleYear, expectedTargetDistricts: row.expectedTargetDistricts, retainedArtifactCount: row.retainedArtifactCount, parsedDistrictCount: parsed, sourceAbsentDistrictCount: absent, status, missingByReason, artifactLockIds: [...new Set(matches.flatMap((item) => item.sourceLockIds))].sort(byteCompare) };
  }).sort((left, right) => byteCompare(`${left.stateCode}-${left.cycleYear}`, `${right.stateCode}-${right.cycleYear}`));
  const reportedContests = observations.filter((row) => row.parseStatus === "parsed").length, sourceAbsent = observations.filter((row) => row.parseStatus === "source_absent").length;
  if (observations.length !== 78 || coverageRows.length !== 48 || reportedContests !== 9 || sourceAbsent !== 1 || observations.some((row) => row.scoreEligible || row.winner !== null || row.identity !== null)) throw new Error("HOUSE_PRIMARY_V2_CLOSURE_INVALID");
  const observationSetSha256 = hash("dsa-seats:rapid-house-primary-v2-observation-set:v1", observations), coverageSetSha256 = hash("dsa-seats:rapid-house-primary-v2-coverage-set:v1", coverageRows);
  const summary = { stateCycles: 48 as const, districtObservations: 78 as const, reportedContests: 9 as const, sourceAbsent: 1 as const, processedDistricts: 10 as const, candidateRows: 23 as const, contestVotes: 643748 as const, scoreEligibleDistricts: 0 as const };
  const unsigned = { schema: "rapid-house-primary-projection-v2" as const, version: 2 as const, parentProjectionPackageSha256: parent.packageSha256, structuredResultsPackageSha256: structured.packageSha256, observations, observationSetSha256, coverageRows, coverageSetSha256, summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v2-package:v1", unsigned) };
}

export function validateHousePrimaryProjectionV2(value: unknown, root = process.cwd()): HousePrimaryProjectionV2 { const expected = buildHousePrimaryProjectionV2(root); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_PROJECTION_V2_INVALID"); return value as HousePrimaryProjectionV2; }
export function buildHousePrimaryCoverageLedgerV2(projection = buildHousePrimaryProjectionV2()): HousePrimaryCoverageLedgerV2 { const rowSetSha256 = hash("dsa-seats:rapid-house-primary-v2-ledger-row-set:v1", projection.coverageRows); const unsigned = { schema: "rapid-house-primary-coverage-ledger-v2" as const, version: 2 as const, projectionSha256: projection.packageSha256, rows: projection.coverageRows, rowSetSha256 }; return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-v2-ledger-package:v1", unsigned) }; }
export function validateHousePrimaryCoverageLedgerV2(value: unknown, projection = buildHousePrimaryProjectionV2()): HousePrimaryCoverageLedgerV2 { const expected = buildHousePrimaryCoverageLedgerV2(projection); if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V2_INVALID"); return value as HousePrimaryCoverageLedgerV2; }
