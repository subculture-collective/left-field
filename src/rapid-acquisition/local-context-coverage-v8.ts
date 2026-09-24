import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateAlabamaStateLegislativeResults } from "./alabama-state-legislative-results";
import { validateRapidLocalContextCoverageV7 } from "./local-context-coverage-v7";
import { canonical, hash } from "./shared";

type Artifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export interface RapidLocalContextCoverageV8 { readonly schema: "rapid-local-context-coverage-v8"; readonly version: 8; readonly releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score"; readonly artifacts: readonly Artifact[]; readonly artifactSetSha256: string; readonly packageSha256: string }

export function buildRapidLocalContextCoverageV8(root = process.cwd()): RapidLocalContextCoverageV8 {
  const prior = validateRapidLocalContextCoverageV7(JSON.parse(readFileSync(join(root, "data/metadata/rapid-local-context-coverage-v7.json"), "utf8")), root);
  const alabama = validateAlabamaStateLegislativeResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-alabama-state-legislative-primary-results-v1.json"), "utf8")), root);
  const artifacts: Artifact[] = [...prior.artifacts, { id: "rapid-alabama-state-legislative-primary-results-v1", label: "Alabama state-legislative primary context", scope: "Alabama 2022 candidate-bearing state House and Senate primary contests", summary: { reportedPartyContests: alabama.summary.reportedPartyContests, candidateRows: alabama.summary.candidateRows, candidateVotes: alabama.summary.candidateVotes, inferredNoContestRows: alabama.summary.inferredNoContestRows, formulaEligibleContests: alabama.summary.formulaEligibleContests }, packageSha256: alabama.packageSha256, formulaEligibleCount: 0 }];
  const artifactSetSha256 = hash("dsa-seats:rapid-local-context-coverage-artifact-set:v8", artifacts), unsigned = { schema: "rapid-local-context-coverage-v8" as const, version: 8 as const, releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score" as const, artifacts, artifactSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-local-context-coverage-package:v8", unsigned) };
}

export function validateRapidLocalContextCoverageV8(value: unknown, root = process.cwd()): RapidLocalContextCoverageV8 {
  const expected = buildRapidLocalContextCoverageV8(root);
  if (canonical(value) !== canonical(expected)) throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_V8_INVALID");
  return value as RapidLocalContextCoverageV8;
}
