import { readFileSync } from "node:fs";
import { join } from "node:path";

import { exact, hash, sha } from "../shared";
import { registeredArtifacts, type RegisteredArtifact } from "./registry";
import {
  findSourceLockEntry,
  readSourceLock,
  type SourceLock,
} from "./source-lock";

/**
 * Registry-driven local-context coverage receipt (v16).
 *
 * Versions 1 through 15 each re-imported the previous version and rebuilt every
 * artifact from raw sources, so validating the newest receipt re-ran all 17
 * parsers. This receipt trusts the source lock instead: each artifact file is
 * checked byte-for-byte against its lock entry, then its own `packageSha256`
 * and summary are lifted into the receipt. Per-artifact rebuild validation
 * stays in each artifact's own test and in `rapid:intake check`.
 *
 * The receipt is regenerated in place when an artifact is added, so there is
 * no v17; the artifact list is the registry.
 */
export type CoverageArtifact = Readonly<{
  id: string;
  label: string;
  scope: string;
  summary: Readonly<Record<string, number>>;
  packageSha256: string;
  formulaEligibleCount: 0;
}>;

export interface RapidLocalContextCoverageV16 {
  readonly schema: "rapid-local-context-coverage-v16";
  readonly version: 16;
  readonly releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score";
  readonly artifacts: readonly CoverageArtifact[];
  readonly artifactSetSha256: string;
  readonly packageSha256: string;
}

export const COVERAGE_ID = "rapid-local-context-coverage-v16";
export const COVERAGE_PATH = `data/metadata/${COVERAGE_ID}.json`;
export const COVERAGE_URL = "urn:dsa-seats:rapid-local-context-coverage:v16";

const fail = (code: string): never => {
  throw new Error(`RAPID_LOCAL_CONTEXT_COVERAGE_V16_${code}`);
};

const FORMULA_KEYS = ["formulaEligibleContests", "formulaEligibleRows"];

function coverageArtifact(
  registered: RegisteredArtifact,
  lock: SourceLock,
  root: string,
): CoverageArtifact {
  const entry = findSourceLockEntry(lock, registered.id) ?? fail(`LOCK_ENTRY_MISSING:${registered.id}`);
  if (entry.retainedStatus !== "retained" || entry.retainedPath !== registered.path)
    fail(`LOCK_ENTRY_INVALID:${registered.id}`);
  const raw = readFileSync(join(root, registered.path));
  if (raw.length !== entry.byteSize || sha(raw) !== entry.sha256)
    fail(`ARTIFACT_BYTES_INVALID:${registered.id}`);
  const value = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  const summary = value.summary as Record<string, unknown> | undefined;
  if (!summary || typeof summary !== "object") fail(`SUMMARY_MISSING:${registered.id}`);
  const packageSha256 = value.packageSha256;
  if (typeof packageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(packageSha256))
    fail(`PACKAGE_SHA_INVALID:${registered.id}`);
  const picked: Record<string, number> = {};
  for (const key of registered.summaryKeys) {
    const count = summary![key];
    if (!Number.isSafeInteger(count) || (count as number) < 0)
      fail(`SUMMARY_KEY_INVALID:${registered.id}:${key}`);
    picked[key] = count as number;
  }
  for (const key of FORMULA_KEYS)
    if (key in summary! && summary![key] !== 0) fail(`FORMULA_ACTIVATED:${registered.id}`);
  return {
    id: registered.id,
    label: registered.label,
    scope: registered.scope,
    summary: picked,
    packageSha256: packageSha256 as string,
    formulaEligibleCount: 0,
  };
}

export function buildRapidLocalContextCoverageV16(
  root = process.cwd(),
  lock: SourceLock = readSourceLock(root),
): RapidLocalContextCoverageV16 {
  const artifacts = registeredArtifacts().map((registered) =>
    coverageArtifact(registered, lock, root),
  );
  const artifactSetSha256 = hash(
    "dsa-seats:rapid-local-context-coverage-artifact-set:v16",
    artifacts,
  );
  const unsigned = {
    schema: "rapid-local-context-coverage-v16" as const,
    version: 16 as const,
    releaseRelationship:
      "separate_rapid_acquisition_excluded_from_released_score" as const,
    artifacts,
    artifactSetSha256,
  };
  return {
    ...unsigned,
    packageSha256: hash("dsa-seats:rapid-local-context-coverage-package:v16", unsigned),
  };
}

export function validateRapidLocalContextCoverageV16(
  value: unknown,
  root = process.cwd(),
): RapidLocalContextCoverageV16 {
  const expected = buildRapidLocalContextCoverageV16(root);
  if (!exact(value, expected)) fail("INVALID");
  return value as RapidLocalContextCoverageV16;
}

export const serializeCoverage = (value: RapidLocalContextCoverageV16): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
