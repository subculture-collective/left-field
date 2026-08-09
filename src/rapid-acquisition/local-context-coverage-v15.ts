import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateRapidLocalContextCoverageV14 } from "./local-context-coverage-v14";
import { validateOhioStateLegislativeResults } from "./ohio-state-legislative-results";

type Artifact = Readonly<{
  id: string;
  label: string;
  scope: string;
  summary: Readonly<Record<string, number>>;
  packageSha256: string;
  formulaEligibleCount: 0;
}>;
export interface RapidLocalContextCoverageV15 {
  readonly schema: "rapid-local-context-coverage-v15";
  readonly version: 15;
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

export function buildRapidLocalContextCoverageV15(
  root = process.cwd(),
): RapidLocalContextCoverageV15 {
  const prior = validateRapidLocalContextCoverageV14(
    JSON.parse(
      readFileSync(
        join(root, "data/metadata/rapid-local-context-coverage-v14.json"),
        "utf8",
      ),
    ),
    root,
  );
  const ohio = validateOhioStateLegislativeResults(
    JSON.parse(
      readFileSync(
        join(
          root,
          "data/metadata/rapid-ohio-state-legislative-democratic-primary-results-v1.json",
        ),
        "utf8",
      ),
    ),
    root,
  );
  const artifacts: Artifact[] = [
    ...prior.artifacts,
    {
      id: "rapid-ohio-state-legislative-democratic-primary-results-v1",
      label: "Ohio Democratic state-legislative primary context",
      scope:
        "Ohio 2024 and 2026 Democratic state House and Senate official-canvass contests",
      summary: {
        reportedPartyContests: ohio.summary.reportedPartyContests,
        candidateRows: ohio.summary.candidateRows,
        candidateVotes: ohio.summary.candidateVotes,
        republicanCyclesRetained: ohio.summary.republicanCyclesRetained,
        formulaEligibleContests: ohio.summary.formulaEligibleContests,
      },
      packageSha256: ohio.packageSha256,
      formulaEligibleCount: 0,
    },
  ];
  const artifactSetSha256 = hash(
    "dsa-seats:rapid-local-context-coverage-artifact-set:v15",
    artifacts,
  );
  const unsigned = {
    schema: "rapid-local-context-coverage-v15" as const,
    version: 15 as const,
    releaseRelationship:
      "separate_rapid_acquisition_excluded_from_released_score" as const,
    artifacts,
    artifactSetSha256,
  };
  return {
    ...unsigned,
    packageSha256: hash(
      "dsa-seats:rapid-local-context-coverage-package:v15",
      unsigned,
    ),
  };
}

export function validateRapidLocalContextCoverageV15(
  value: unknown,
  root = process.cwd(),
): RapidLocalContextCoverageV15 {
  const expected = buildRapidLocalContextCoverageV15(root);
  if (canonical(value) !== canonical(expected))
    throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_V15_INVALID");
  return value as RapidLocalContextCoverageV15;
}
