import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateIndianaLocalOfficeResults } from "./indiana-local-office-results";
import { validateRapidLocalContextCoverageV15 } from "./local-context-coverage-v15";

type Artifact = Readonly<{
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
  readonly artifacts: readonly Artifact[];
  readonly artifactSetSha256: string;
  readonly packageSha256: string;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const canonical = (value: unknown): string =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(",")}]`
      : `{${Object.keys(value as object)
          .sort(cmp)
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
          )
          .join(",")}}`;
const hash = (domain: string, value: unknown) =>
  createHash("sha256")
    .update(`${domain}\0${canonical(value)}`)
    .digest("hex");

/**
 * v16 reconciles the source-locked Indiana local-office receipt that was
 * intentionally kept separate from the historical v15 receipt.  It remains
 * rapid context and formula-ineligible; no House score input is added.
 */
export function buildRapidLocalContextCoverageV16(
  root = process.cwd(),
): RapidLocalContextCoverageV16 {
  const prior = validateRapidLocalContextCoverageV15(
    JSON.parse(
      readFileSync(
        join(root, "data/metadata/rapid-local-context-coverage-v15.json"),
        "utf8",
      ),
    ),
    root,
  );
  const indiana = validateIndianaLocalOfficeResults(
    JSON.parse(
      readFileSync(
        join(
          root,
          "data/metadata/rapid-indiana-local-office-primary-results-v1.json",
        ),
        "utf8",
      ),
    ),
    root,
  );
  const artifacts: Artifact[] = [
    ...prior.artifacts,
    {
      id: "rapid-indiana-local-office-primary-results-v1",
      label: "Indiana local-office primary context",
      scope:
        "Indiana 2024 certified local primary contests across 12 source-defined office categories",
      summary: {
        officeCategories: indiana.summary.officeCategories,
        officeRows: indiana.summary.officeRows,
        partyContests: indiana.summary.partyContests,
        candidateRows: indiana.summary.candidateRows,
        candidateVotes: indiana.summary.candidateVotes,
        sourceMarkedWinnerCandidates:
          indiana.summary.sourceMarkedWinnerCandidates,
        formulaEligibleContests: indiana.summary.formulaEligibleContests,
      },
      packageSha256: indiana.packageSha256,
      formulaEligibleCount: 0,
    },
  ];
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
    packageSha256: hash(
      "dsa-seats:rapid-local-context-coverage-package:v16",
      unsigned,
    ),
  };
}

export function validateRapidLocalContextCoverageV16(
  value: unknown,
  root = process.cwd(),
): RapidLocalContextCoverageV16 {
  const expected = buildRapidLocalContextCoverageV16(root);
  if (canonical(value) !== canonical(expected))
    throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_V16_INVALID");
  return value as RapidLocalContextCoverageV16;
}
