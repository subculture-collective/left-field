import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateCountyDemographicsProjection } from "./county-demographics";
import { validateCountyElectionContextProjection } from "./county-election-context";
import { validateIndianaStateLegislativeResults } from "./indiana-state-legislative-results";

type Artifact = Readonly<{ id: string; label: string; scope: string; summary: Readonly<Record<string, number>>; packageSha256: string; formulaEligibleCount: 0 }>;
export interface RapidLocalContextCoverage {
  readonly schema: "rapid-local-context-coverage-v1";
  readonly version: 1;
  readonly releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score";
  readonly artifacts: readonly Artifact[];
  readonly artifactSetSha256: string;
  readonly packageSha256: string;
}

const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

/** Builds the small coverage receipt. Full source reconstruction happens only here, never in the web read model. */
export function buildRapidLocalContextCoverage(root = process.cwd()): RapidLocalContextCoverage {
  const demographics = validateCountyDemographicsProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-county-demographics-projection-v1.json"), "utf8")), root);
  const electionContext = validateCountyElectionContextProjection(JSON.parse(readFileSync(join(root, "data/metadata/rapid-county-election-context-projection-v1.json"), "utf8")), root);
  const indiana = validateIndianaStateLegislativeResults(JSON.parse(readFileSync(join(root, "data/metadata/rapid-indiana-state-legislative-primary-results-v1.json"), "utf8")), root);
  const artifacts: Artifact[] = [
    { id: "rapid-county-demographics-projection-v1", label: "Nationwide county demographics", scope: "3,222 Census county-equivalent rows", summary: { counties: demographics.summary.counties, populationPresent: demographics.summary.populationPresent, formulaEligibleRows: demographics.summary.formulaEligibleRows }, packageSha256: demographics.packageSha256, formulaEligibleCount: 0 },
    { id: "rapid-county-election-context-projection-v1", label: "County registration and turnout context", scope: "EAVS county rows for 2022 and 2024", summary: { countyCycleRows: electionContext.summary.countyCycleRows, exactCountyRows2022: electionContext.summary.exactCountyRows2022, exactCountyRows2024: electionContext.summary.exactCountyRows2024, formulaEligibleRows: electionContext.summary.formulaEligibleRows }, packageSha256: electionContext.packageSha256, formulaEligibleCount: 0 },
    { id: "rapid-indiana-state-legislative-primary-results-v1", label: "Indiana state-legislative primary pilot", scope: "Indiana 2022 and 2024 state House and Senate primaries", summary: { officeDistrictRows: indiana.summary.officeDistrictRows, partyContests: indiana.summary.partyContests, candidateRows: indiana.summary.candidateRows, formulaEligibleContests: indiana.summary.formulaEligibleContests }, packageSha256: indiana.packageSha256, formulaEligibleCount: 0 },
  ];
  const artifactSetSha256 = hash("dsa-seats:rapid-local-context-coverage-artifact-set:v1", artifacts);
  const unsigned = { schema: "rapid-local-context-coverage-v1" as const, version: 1 as const, releaseRelationship: "separate_rapid_acquisition_excluded_from_released_score" as const, artifacts, artifactSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-local-context-coverage-package:v1", unsigned) };
}
export function validateRapidLocalContextCoverage(value: unknown, root = process.cwd()): RapidLocalContextCoverage { const expected = buildRapidLocalContextCoverage(root); if (!exact(value, expected)) throw new Error("RAPID_LOCAL_CONTEXT_COVERAGE_INVALID"); return value as RapidLocalContextCoverage; }
