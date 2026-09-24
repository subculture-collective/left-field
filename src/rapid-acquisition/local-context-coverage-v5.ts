import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateRapidLocalContextCoverageV4 } from "./local-context-coverage-v4";
import { validateTennesseeStateLegislativeResults } from "./tennessee-state-legislative-results";
import { canonical, hash } from "./shared";

type Artifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export interface RapidLocalContextCoverageV5 { readonly schema: "rapid-local-context-coverage-v5"; readonly version: 5; readonly releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score"; readonly artifacts: readonly Artifact[]; readonly artifactSetSha256: string; readonly packageSha256: string }

export function buildRapidLocalContextCoverageV5(root = process.cwd()): RapidLocalContextCoverageV5 {
  const prior = validateRapidLocalContextCoverageV4(JSON.parse(readFileSync(join(root, "data/metadata/rapid-local-context-coverage-v4.json"), "utf8")), root);
  const tennessee = validateTennesseeStateLegislativeResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-tennessee-state-legislative-primary-results-v1.json"), "utf8")), root);
  const artifacts: Artifact[] = [...prior.artifacts, { id: "rapid-tennessee-state-legislative-primary-results-v1", label: "Tennessee state-legislative primary context", scope: "Tennessee 2022 and 2024 state House and Senate primaries", summary: { officeDistrictRows: tennessee.summary.officeDistrictRows, partyContests: tennessee.summary.partyContests, sourceObservationRows: tennessee.summary.sourceObservationRows, candidateVotes: tennessee.summary.candidateVotes, formulaEligibleContests: tennessee.summary.formulaEligibleContests }, packageSha256: tennessee.packageSha256, formulaEligibleCount: 0 }];
  const artifactSetSha256 = hash("dsa-seats:rapid-local-context-coverage-artifact-set:v5", artifacts), unsigned = { schema: "rapid-local-context-coverage-v5" as const, version: 5 as const, releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score" as const, artifacts, artifactSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-local-context-coverage-package:v5", unsigned) };
}
export function validateRapidLocalContextCoverageV5(value: unknown, root = process.cwd()): RapidLocalContextCoverageV5 { const expected = buildRapidLocalContextCoverageV5(root); if (canonical(value) !== canonical(expected)) throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_V5_INVALID"); return value as RapidLocalContextCoverageV5; }
