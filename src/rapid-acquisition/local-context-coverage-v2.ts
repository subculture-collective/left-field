import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateCountyDemographicsProjection } from "./county-demographics";
import { validateCountyElectionContextProjection } from "./county-election-context";
import { validateCountySenateResultsProjection } from "./county-senate-results";
import { validateIndianaStateLegislativeResults } from "./indiana-state-legislative-results";
import { hash, exact } from "./shared";

type Artifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export interface RapidLocalContextCoverageV2 {
  readonly schema: "rapid-local-context-coverage-v2";
  readonly version: 2;
  readonly releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score";
  readonly artifacts: readonly Artifact[];
  readonly artifactSetSha256: string;
  readonly packageSha256: string;
}

/**
 * Builds the v2 local-context receipt. It deliberately remains outside the
 * released score: the Senate rows are a research fallback with incomplete
 * state coverage, and no local-context artifact is formula eligible.
 */
export function buildRapidLocalContextCoverageV2(root = process.cwd()): RapidLocalContextCoverageV2 {
  const demographics = validateCountyDemographicsProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-county-demographics-projection-v1.json"), "utf8")), root);
  const electionContext = validateCountyElectionContextProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-county-election-context-projection-v1.json"), "utf8")), root);
  const indiana = validateIndianaStateLegislativeResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-indiana-state-legislative-primary-results-v1.json"), "utf8")), root);
  const senate = validateCountySenateResultsProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-county-senate-results-projection-v1.json"), "utf8")), root);
  const artifacts: Artifact[] = [
    { id: "rapid-county-demographics-projection-v1", label: "Nationwide county demographics", scope: "3,222 Census county-equivalent rows", summary: { counties: demographics.summary.counties, populationPresent: demographics.summary.populationPresent, formulaEligibleRows: demographics.summary.formulaEligibleRows }, packageSha256: demographics.packageSha256, formulaEligibleCount: 0 },
    { id: "rapid-county-election-context-projection-v1", label: "County registration and turnout context", scope: "EAVS county rows for 2022 and 2024", summary: { countyCycleRows: electionContext.summary.countyCycleRows, exactCountyRows2022: electionContext.summary.exactCountyRows2022, exactCountyRows2024: electionContext.summary.exactCountyRows2024, formulaEligibleRows: electionContext.summary.formulaEligibleRows }, packageSha256: electionContext.packageSha256, formulaEligibleCount: 0 },
    { id: "rapid-county-senate-results-projection-v1", label: "County Senate context (research fallback)", scope: "2024 Senate county results; incomplete 29-state context", summary: { candidateRows: senate.summary.candidateRows, exactCountyCount: senate.summary.exactCountyCount, stateCount: senate.summary.stateCount, formulaEligibleRows: senate.summary.formulaEligibleRows }, packageSha256: senate.packageSha256, formulaEligibleCount: 0 },
    { id: "rapid-indiana-state-legislative-primary-results-v1", label: "Indiana state-legislative primary pilot", scope: "Indiana 2022 and 2024 state House and Senate primaries", summary: { officeDistrictRows: indiana.summary.officeDistrictRows, partyContests: indiana.summary.partyContests, candidateRows: indiana.summary.candidateRows, formulaEligibleContests: indiana.summary.formulaEligibleContests }, packageSha256: indiana.packageSha256, formulaEligibleCount: 0 },
  ];
  const artifactSetSha256 = hash("dsa-seats:rapid-local-context-coverage-artifact-set:v2", artifacts);
  const unsigned = { schema: "rapid-local-context-coverage-v2" as const, version: 2 as const, releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score" as const, artifacts, artifactSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-local-context-coverage-package:v2", unsigned) };
}

export function validateRapidLocalContextCoverageV2(value: unknown, root = process.cwd()): RapidLocalContextCoverageV2 {
  const expected = buildRapidLocalContextCoverageV2(root);
  if (!exact(value, expected)) throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_V2_INVALID");
  return value as RapidLocalContextCoverageV2;
}
