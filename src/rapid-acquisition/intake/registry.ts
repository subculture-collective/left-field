import { INTAKE_SUMMARY_KEYS, intakeArtifactPath, type IntakeSpec } from "./package";
import { INTAKE_SPECS } from "./specs";

/**
 * The single list of local-context artifacts the coverage receipt reports.
 *
 * Legacy artifacts were produced by bespoke per-state modules and remain
 * frozen; they are listed as data so the coverage build no longer has to
 * import and re-run every parser. New states register an `IntakeSpec` in
 * `./specs` and appear here automatically.
 */
export interface RegisteredArtifact {
  readonly id: string;
  readonly label: string;
  readonly scope: string;
  readonly path: string;
  readonly summaryKeys: readonly string[];
  readonly spec: IntakeSpec | null;
}

const legacy = (
  id: string,
  label: string,
  scope: string,
  summaryKeys: readonly string[],
): RegisteredArtifact => ({
  id,
  label,
  scope,
  path: `data/metadata/${id}.json`,
  summaryKeys,
  spec: null,
});

export const LEGACY_ARTIFACTS: readonly RegisteredArtifact[] = [
  legacy("rapid-county-demographics-projection-v1", "Nationwide county demographics", "3,222 Census county-equivalent rows", ["counties", "populationPresent", "formulaEligibleRows"]),
  legacy("rapid-county-election-context-projection-v1", "County registration and turnout context", "EAVS county rows for 2022 and 2024", ["countyCycleRows", "exactCountyRows2022", "exactCountyRows2024", "formulaEligibleRows"]),
  legacy("rapid-county-house-results-2022-projection-v1", "2022 county House context (research fallback)", "2022 House county aggregates; strict TOTAL rows in 41 state archives", ["aggregateRows", "exactCountyCount", "stateCount", "formulaEligibleRows"]),
  legacy("rapid-county-house-results-projection-v1", "County House context (research fallback)", "2024 House county aggregates; strict TOTAL rows in 41 state archives", ["aggregateRows", "exactCountyCount", "stateCount", "formulaEligibleRows"]),
  legacy("rapid-county-senate-results-projection-v1", "County Senate context (research fallback)", "2024 Senate county results; incomplete 29-state context", ["candidateRows", "exactCountyCount", "stateCount", "formulaEligibleRows"]),
  legacy("rapid-indiana-state-legislative-primary-results-v1", "Indiana state-legislative primary pilot", "Indiana 2022 and 2024 state House and Senate primaries", ["officeDistrictRows", "partyContests", "candidateRows", "formulaEligibleContests"]),
  legacy("rapid-tennessee-state-legislative-primary-results-v1", "Tennessee state-legislative primary context", "Tennessee 2022 and 2024 state House and Senate primaries", ["officeDistrictRows", "partyContests", "sourceObservationRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-georgia-state-legislative-primary-results-v1", "Georgia state-legislative primary context", "Georgia 2022, 2024, and 2026 state House and Senate regular primaries", ["officeDistrictRows", "partyContests", "candidateRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-north-carolina-state-legislative-primary-results-v1", "North Carolina state-legislative primary context", "North Carolina 2022, 2024, and 2026 state House and Senate primaries", ["officeDistrictRows", "partyContests", "candidateRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-alabama-state-legislative-primary-results-v1", "Alabama state-legislative primary context", "Alabama 2022 candidate-bearing state House and Senate primary contests", ["reportedPartyContests", "candidateRows", "candidateVotes", "inferredNoContestRows", "formulaEligibleContests"]),
  legacy("rapid-delaware-state-legislative-primary-results-v1", "Delaware state-legislative primary context", "Delaware 2022 and 2024 candidate-bearing state House and Senate primary contests", ["reportedPartyContests", "candidateRows", "candidateVotes", "inferredNoContestRows", "formulaEligibleContests"]),
  legacy("rapid-hawaii-state-legislative-primary-results-v1", "Hawaii state-legislative primary context", "Hawaii 2022 and 2024 reported Democratic and Republican state House and Senate primary contests", ["reportedPartyContests", "candidateRows", "candidateVotes", "inferredNoContestRows", "formulaEligibleContests"]),
  legacy("rapid-missouri-state-legislative-primary-results-v1", "Missouri state-legislative primary context", "Missouri 2022 and 2024 reported Democratic and Republican state House and Senate primary contests", ["partyContests", "candidateRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-kentucky-state-legislative-primary-results-v1", "Kentucky state-legislative primary context", "Kentucky 2022, 2024, and 2026 reported Democratic and Republican state House and Senate primary contests", ["reportedPartyContests", "candidateRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-north-carolina-local-office-primary-results-v1", "North Carolina local-office primary context", "North Carolina 2022, 2024, and 2026 county, school-board, sheriff, court-clerk, register-of-deeds, and municipal primary contests", ["officeFamilies", "officeContests", "candidateRows", "candidateVotes", "formulaEligibleContests"]),
  legacy("rapid-new-mexico-county-office-primary-results-v1", "New Mexico county-office primary context", "New Mexico 2022, 2024, and 2026 assessor, clerk, commissioner, sheriff, treasurer, and probate-judge primary contests", ["officeFamilies", "officeContests", "candidateRows", "candidateVotes", "quarantinedContests", "formulaEligibleContests"]),
  legacy("rapid-ohio-state-legislative-democratic-primary-results-v1", "Ohio Democratic state-legislative primary context", "Ohio 2024 and 2026 Democratic state House and Senate official-canvass contests", ["reportedPartyContests", "candidateRows", "candidateVotes", "republicanCyclesRetained", "formulaEligibleContests"]),
];

export const registeredArtifacts = (): readonly RegisteredArtifact[] => {
  const artifacts = [
    ...LEGACY_ARTIFACTS,
    ...INTAKE_SPECS.map(
      (spec): RegisteredArtifact => ({
        id: spec.id,
        label: spec.label,
        scope: spec.scope,
        path: intakeArtifactPath(spec),
        summaryKeys: INTAKE_SUMMARY_KEYS,
        spec,
      }),
    ),
  ];
  const ids = new Set(artifacts.map((artifact) => artifact.id));
  if (ids.size !== artifacts.length)
    throw new Error("INTAKE_REGISTRY_DUPLICATE_ARTIFACT_ID");
  return artifacts;
};

export const findIntakeSpec = (id: string): IntakeSpec | undefined =>
  INTAKE_SPECS.find((spec) => spec.id === id);
