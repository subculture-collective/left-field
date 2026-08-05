import { createHash } from "node:crypto";

import { z } from "zod";

import { validateDsaTargetFactualProjection } from "../../domain/dsa-target-review-report";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetIncumbentRoster } from "../identity/incumbent-tenure-factual-candidate";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

const CUTOFF = "2026-08-04" as const;
const CYCLES = [2022, 2024, 2026] as const;
const PROJECTION_LOCK = "dsa-target-factual-projection-20260804-v1" as const;
const PROJECTION_FILE_SHA = "e1c2ab02cafb2ee438ec1a1c936f903e38cc19553d187b6b2d1dca55dc99d3ec" as const;
const ROSTER_LOCK = "dsa-target-incumbent-roster-20260804-v1" as const;
const ROSTER_FILE_SHA = "8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1" as const;
const FEC_LOCK = "fec-2026-congressional-primary-dates" as const;
const FEC_FILE_SHA = "9a5d4ec0ba2b69daf2f510ef79bca0ca381ab699255ac5adb971b9672d517251" as const;
const GEOMETRY_LOCK = "geo-national-cd119" as const;
const GEOMETRY_FILE_SHA = "66a71a6b18689748f53acbc8c3e51eae41a10558cf7a8aebebe4cdeaba973cf6" as const;
const PROJECTION_SHA = "5ff3416817d062bafff21a8ad7e7ff2c87e39b627638f55646de8a540af80edd" as const;
const ROSTER_SHA = "cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee" as const;
const TARGET_UNIVERSE_SHA = "48dbd88aa49c6e12cc7c3e69cfd64a714758cd7aafcea65a94917bfb660acd54" as const;

const sourceClass = z.strictObject({
  id: z.enum([
    "official_state_election_authority_result_and_certification",
    "official_state_election_authority_historical_district_or_crosswalk",
    "production_incumbent_identity_receipt",
    "official_federal_primary_calendar_discovery",
    "official_current_target_geometry_reference",
    "reviewed_progressive_candidate_classification",
  ]),
  retainedStatus: z.enum(["retained", "not_retained"]),
  role: z.string().min(1),
});

const stateCycle = z.strictObject({
  stateCode: z.string().length(2),
  cycleYear: z.union([z.literal(2022), z.literal(2024), z.literal(2026)]),
  targetSeatCount: z.number().int().positive(),
  resultAuthorityStatus: z.literal("not_retained"),
  certificationStatus: z.literal("unassessed"),
  partisanPrimarySystemStatus: z.literal("unassessed"),
  resultSnapshotIds: z.array(z.string()).length(0),
  historicalGeometryStatus: z.literal("not_retained_or_not_assessed"),
  stateCycleSha256: sha256,
});

const missingPrimaryResult = z.strictObject({ kind: z.literal("missing"), reason: z.literal("primary_result_authority_not_retained") });
const missingProgressive = z.strictObject({ kind: z.literal("missing"), reason: z.literal("progressive_candidate_classification_not_retained") });
const seat = z.strictObject({
  seatCycleId: z.string().min(1), stateCode: z.string().length(2), districtCode: z.string().min(1), bioguideId: z.string().regex(/^[A-Z]\d{6}$/),
  stateCycleRowSha256s: z.tuple([sha256, sha256, sha256]),
  incumbentIdentity: z.strictObject({ kind: z.literal("production_roster_bioguide"), bioguideId: z.string().regex(/^[A-Z]\d{6}$/) }),
  selection: z.strictObject({
    candidateCycles: z.tuple([z.literal(2026), z.literal(2024), z.literal(2022)]),
    rule: z.literal("latest_completed_certified_regular_democratic_house_primary_containing_current_incumbent_at_or_before_source_cutoff"),
    selectedCycle: z.null(), selectedContestId: z.null(), incumbentCandidateIdentity: z.null(), disposition: z.null(),
  }),
  geography: z.strictObject({ targetCdSession: z.literal("119"), compatibilityStatus: z.literal("unassessed"), historicalDistrict: z.null(), crosswalkSnapshotIds: z.array(z.string()).length(0) }),
  evaluatorValues: z.strictObject({ priorPrimaryMargin: missingPrimaryResult, priorDemocraticPrimaryVotes: missingPrimaryResult, priorProgressivePrimaryShare: missingProgressive }),
  scoreEligible: z.literal(false),
  seatRowSha256: sha256,
});

const decision = z.strictObject({
  decisionId: z.enum([
    "approve-regular-democratic-primary-selection-rule-v1",
    "collect-official-state-primary-results-and-certification-v1",
    "approve-historic-primary-candidate-identity-resolution-v1",
    "approve-historical-district-cd119-compatibility-v1",
    "decide-nonstandard-primary-disposition-treatment-v1",
    "approve-progressive-candidate-classification-method-v1",
  ]),
  question: z.string().min(1), recommendedDecision: z.string().min(1),
  defaultReversibleAssumption: z.literal("retain_plan_exclude_from_evaluator_and_publication"),
  blocksPublication: z.literal(true), blocksOtherWork: z.literal(false), resolution: z.null(),
});

export const houseDemocraticPrimarySourceSelectionProposalSchema = z.strictObject({
  schema: z.literal("house-democratic-primary-source-selection-proposal-v1"), version: z.literal(1),
  generatedAt: z.literal("2026-08-04T18:20:00.000Z"), sourceCutoff: z.literal(CUTOFF), reviewerOnly: z.literal(true), publicationEligible: z.literal(false),
  review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  scope: z.strictObject({ releaseId: z.literal("rel_full_20260804_v2"), universeDefinition: z.literal("occupied regular Democratic voting U.S. House seats"), targetSeats: z.literal(212), targetStates: z.literal(38), targetUniverseSha256: z.literal(TARGET_UNIVERSE_SHA), cycles: z.tuple([z.literal(2022), z.literal(2024), z.literal(2026)]) }),
  inputs: z.strictObject({
    projection: z.strictObject({ sourceLockId: z.literal(PROJECTION_LOCK), fileSha256: z.literal(PROJECTION_FILE_SHA), projectionSha256: z.literal(PROJECTION_SHA) }),
    roster: z.strictObject({ sourceLockId: z.literal(ROSTER_LOCK), fileSha256: z.literal(ROSTER_FILE_SHA), rosterSha256: z.literal(ROSTER_SHA) }),
    fecDiscovery: z.strictObject({ sourceLockId: z.literal(FEC_LOCK), fileSha256: z.literal(FEC_FILE_SHA), byteSize: z.literal(226820), authorityRole: z.literal("nationwide_discovery_and_drift_detection_not_state_result_authority") }),
    currentGeometry: z.strictObject({ sourceLockId: z.literal(GEOMETRY_LOCK), fileSha256: z.literal(GEOMETRY_FILE_SHA), authorityRole: z.literal("current_target_reference_only_not_historical_result_geography") }),
  }),
  methodology: z.strictObject({
    contestSelectionRule: z.literal("latest_completed_certified_regular_democratic_house_primary_containing_current_incumbent_at_or_before_source_cutoff"),
    candidateCyclesDescending: z.tuple([z.literal(2026), z.literal(2024), z.literal(2022)]),
    generalAndSpecialGeneralExcluded: z.literal(true), nonpartisanAndTopTwoPendingDecision: z.literal(true),
    currentIncumbentAbsenceNeverSubstitutesPriorOfficeholder: z.literal(true), unknownOrNoEligibleContestNeverMeansZero: z.literal(true),
    historicalDistrictCompatibilityRequiresExactMatchOrReviewedCrosswalk: z.literal(true), progressiveShareRequiresSeparateReviewedClassification: z.literal(true),
  }),
  sourceClasses: z.array(sourceClass).length(6), stateCycles: z.array(stateCycle).length(114), seats: z.array(seat).length(212), decisions: z.array(decision).length(6), packageSha256: sha256,
});
export type HouseDemocraticPrimarySourceSelectionProposal = z.infer<typeof houseDemocraticPrimarySourceSelectionProposalSchema>;

const stateCycleKey = (stateCode: string, cycleYear: number): string => `${stateCode}:${cycleYear}`;

function sourceClasses(): z.infer<typeof sourceClass>[] {
  return [
    { id: "official_state_election_authority_result_and_certification", retainedStatus: "not_retained", role: "required official result, candidate, contest, and final-certification authority" },
    { id: "official_state_election_authority_historical_district_or_crosswalk", retainedStatus: "not_retained", role: "required when historical result geography is not an exact CD119 key match" },
    { id: "production_incumbent_identity_receipt", retainedStatus: "retained", role: "current target incumbent BioGuide binding only; not historic candidacy evidence" },
    { id: "official_federal_primary_calendar_discovery", retainedStatus: "retained", role: "nationwide discovery and drift detection only; never state result or certification authority" },
    { id: "official_current_target_geometry_reference", retainedStatus: "retained", role: "current CD119 target reference only; never historic result reallocation" },
    { id: "reviewed_progressive_candidate_classification", retainedStatus: "not_retained", role: "separate reviewer-approved contest-effective progressive classification evidence" },
  ];
}

export function buildHouseDemocraticPrimarySourceSelectionProposal(input: Readonly<{ projection: unknown; projectionFileSha256: string; roster: unknown; rosterFileSha256: string }>): HouseDemocraticPrimarySourceSelectionProposal {
  const projection = validateDsaTargetFactualProjection(input.projection);
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  if (input.projectionFileSha256 !== PROJECTION_FILE_SHA || input.rosterFileSha256 !== ROSTER_FILE_SHA || projection.projectionSha256 !== PROJECTION_SHA || roster.rosterSha256 !== ROSTER_SHA || projection.release.id !== roster.release.id || projection.release.sourceCutoff !== CUTOFF || roster.release.sourceCutoff !== CUTOFF || roster.productionReleaseClosure.manifest.canonicalDataChecksumSha256 !== projection.productionReleaseClosure.manifest.canonicalDataChecksumSha256 || roster.rows.length !== 212) throw new Error("PRIMARY_SOURCE_SELECTION_INPUT_CLOSURE_INVALID");
  const rosterBySeat = new Map(roster.rows.map((row) => [row.seatCycleId, row.bioguideId]));
  if (rosterBySeat.size !== 212 || projection.seats.some((row) => !rosterBySeat.has(row.seatCycleId))) throw new Error("PRIMARY_SOURCE_SELECTION_ROSTER_CLOSURE_INVALID");
  const counts = new Map<string, number>();
  for (const row of projection.seats) counts.set(row.stateCode, (counts.get(row.stateCode) ?? 0) + 1);
  if (counts.size !== 38) throw new Error("PRIMARY_SOURCE_SELECTION_STATE_CLOSURE_INVALID");
  const stateCycles = [...counts.entries()].flatMap(([stateCode, targetSeatCount]) => CYCLES.map((cycleYear) => {
    const unsigned = { stateCode, cycleYear, targetSeatCount, resultAuthorityStatus: "not_retained" as const, certificationStatus: "unassessed" as const, partisanPrimarySystemStatus: "unassessed" as const, resultSnapshotIds: [] as string[], historicalGeometryStatus: "not_retained_or_not_assessed" as const };
    return { ...unsigned, stateCycleSha256: hash("dsa-seats:house-democratic-primary-state-cycle:v1\0", unsigned) };
  })).sort((left, right) => bytewise(stateCycleKey(left.stateCode, left.cycleYear), stateCycleKey(right.stateCode, right.cycleYear)));
  const cycleByKey = new Map(stateCycles.map((row) => [stateCycleKey(row.stateCode, row.cycleYear), row]));
  const targetUniverse = projection.seats.map((row) => ({ seatCycleId: row.seatCycleId, stateCode: row.stateCode, districtCode: row.districtCode, bioguideId: rosterBySeat.get(row.seatCycleId)! })).sort((left, right) => bytewise(left.seatCycleId, right.seatCycleId));
  if (hash("dsa-seats:house-democratic-primary-target-universe:v1\0", targetUniverse) !== TARGET_UNIVERSE_SHA) throw new Error("PRIMARY_SOURCE_SELECTION_TARGET_UNIVERSE_INVALID");
  const seats = projection.seats.map((row) => {
    const bioguideId = rosterBySeat.get(row.seatCycleId)!;
    const unsigned = {
      seatCycleId: row.seatCycleId, stateCode: row.stateCode, districtCode: row.districtCode, bioguideId,
      stateCycleRowSha256s: CYCLES.map((cycle) => cycleByKey.get(stateCycleKey(row.stateCode, cycle))!.stateCycleSha256) as [string, string, string],
      incumbentIdentity: { kind: "production_roster_bioguide" as const, bioguideId },
      selection: { candidateCycles: [2026, 2024, 2022] as [2026, 2024, 2022], rule: "latest_completed_certified_regular_democratic_house_primary_containing_current_incumbent_at_or_before_source_cutoff" as const, selectedCycle: null, selectedContestId: null, incumbentCandidateIdentity: null, disposition: null },
      geography: { targetCdSession: "119" as const, compatibilityStatus: "unassessed" as const, historicalDistrict: null, crosswalkSnapshotIds: [] as string[] },
      evaluatorValues: { priorPrimaryMargin: { kind: "missing" as const, reason: "primary_result_authority_not_retained" as const }, priorDemocraticPrimaryVotes: { kind: "missing" as const, reason: "primary_result_authority_not_retained" as const }, priorProgressivePrimaryShare: { kind: "missing" as const, reason: "progressive_candidate_classification_not_retained" as const } },
      scoreEligible: false as const,
    };
    return { ...unsigned, seatRowSha256: hash("dsa-seats:house-democratic-primary-seat:v1\0", unsigned) };
  }).sort((left, right) => bytewise(left.seatCycleId, right.seatCycleId));
  const decisions = [
    ["approve-regular-democratic-primary-selection-rule-v1", "Should the proposal select only the latest completed certified regular Democratic House primary containing the current incumbent at or before the cutoff?", "Approve the rule while retaining no-contest and nonparticipation dispositions rather than imputing a value."],
    ["collect-official-state-primary-results-and-certification-v1", "Should official state result and certification authority be retained for every target state-cycle before primary facts are used?", "Require a complete 114 state-cycle authority closure before any numerical primary fact is evaluated."],
    ["approve-historic-primary-candidate-identity-resolution-v1", "Should historic candidate identity require authoritative identifiers or documented review rather than name-only matching?", "Require an exact or reviewed identity mapping to the current incumbent BioGuide."],
    ["approve-historical-district-cd119-compatibility-v1", "Should historic result geography require an exact key match or a separately reviewed crosswalk before scoring?", "Reject automatic current-boundary assumptions and require retained compatibility evidence."],
    ["decide-nonstandard-primary-disposition-treatment-v1", "How should uncontested, no-primary, special-primary, runoff, top-two, and open-primary dispositions be handled?", "Keep them unselected and non-score-bearing until a formula-specific disposition decision is approved."],
    ["approve-progressive-candidate-classification-method-v1", "Should progressive primary share require separate reviewed, contest-effective candidate classification evidence?", "Require a versioned classification decision; result votes alone never establish progressive share."],
  ].map(([decisionId, question, recommendedDecision]) => ({ decisionId, question, recommendedDecision, defaultReversibleAssumption: "retain_plan_exclude_from_evaluator_and_publication" as const, blocksPublication: true as const, blocksOtherWork: false as const, resolution: null }));
  const unsigned = {
    schema: "house-democratic-primary-source-selection-proposal-v1" as const, version: 1 as const, generatedAt: "2026-08-04T18:20:00.000Z" as const, sourceCutoff: CUTOFF,
    reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null },
    scope: { releaseId: "rel_full_20260804_v2" as const, universeDefinition: "occupied regular Democratic voting U.S. House seats" as const, targetSeats: 212 as const, targetStates: 38 as const, targetUniverseSha256: TARGET_UNIVERSE_SHA, cycles: [2022, 2024, 2026] as [2022, 2024, 2026] },
    inputs: { projection: { sourceLockId: PROJECTION_LOCK, fileSha256: PROJECTION_FILE_SHA, projectionSha256: projection.projectionSha256 }, roster: { sourceLockId: ROSTER_LOCK, fileSha256: ROSTER_FILE_SHA, rosterSha256: roster.rosterSha256 }, fecDiscovery: { sourceLockId: FEC_LOCK, fileSha256: FEC_FILE_SHA, byteSize: 226820 as const, authorityRole: "nationwide_discovery_and_drift_detection_not_state_result_authority" as const }, currentGeometry: { sourceLockId: GEOMETRY_LOCK, fileSha256: GEOMETRY_FILE_SHA, authorityRole: "current_target_reference_only_not_historical_result_geography" as const } },
    methodology: { contestSelectionRule: "latest_completed_certified_regular_democratic_house_primary_containing_current_incumbent_at_or_before_source_cutoff" as const, candidateCyclesDescending: [2026, 2024, 2022] as [2026, 2024, 2022], generalAndSpecialGeneralExcluded: true as const, nonpartisanAndTopTwoPendingDecision: true as const, currentIncumbentAbsenceNeverSubstitutesPriorOfficeholder: true as const, unknownOrNoEligibleContestNeverMeansZero: true as const, historicalDistrictCompatibilityRequiresExactMatchOrReviewedCrosswalk: true as const, progressiveShareRequiresSeparateReviewedClassification: true as const },
    sourceClasses: sourceClasses(), stateCycles, seats, decisions,
  };
  return houseDemocraticPrimarySourceSelectionProposalSchema.parse({ ...unsigned, packageSha256: hash("dsa-seats:house-democratic-primary-source-selection-proposal:v1\0", unsigned) });
}

export function validateHouseDemocraticPrimarySourceSelectionProposal(value: unknown): HouseDemocraticPrimarySourceSelectionProposal {
  const parsed = houseDemocraticPrimarySourceSelectionProposalSchema.parse(value);
  const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:house-democratic-primary-source-selection-proposal:v1\0", unsigned)) throw new Error("PRIMARY_SOURCE_SELECTION_PACKAGE_HASH_MISMATCH");
  const stateByKey = new Map(parsed.stateCycles.map((row) => [stateCycleKey(row.stateCode, row.cycleYear), row]));
  const invalidState = parsed.stateCycles.some((row) => {
    const { stateCycleSha256, ...stateUnsigned } = row;
    return stateCycleSha256 !== hash("dsa-seats:house-democratic-primary-state-cycle:v1\0", stateUnsigned);
  });
  const invalidSeat = parsed.seats.some((row) => {
    const { seatRowSha256, ...seatUnsigned } = row;
    const expectedHashes = CYCLES.map((cycle) => stateByKey.get(stateCycleKey(row.stateCode, cycle))?.stateCycleSha256);
    return seatRowSha256 !== hash("dsa-seats:house-democratic-primary-seat:v1\0", seatUnsigned)
      || row.bioguideId !== row.incumbentIdentity.bioguideId
      || canonicalJson(row.stateCycleRowSha256s) !== canonicalJson(expectedHashes)
      || row.selection.selectedCycle !== null || row.selection.selectedContestId !== null || row.selection.incumbentCandidateIdentity !== null || row.selection.disposition !== null
      || row.geography.historicalDistrict !== null || row.geography.crosswalkSnapshotIds.length !== 0
      || row.scoreEligible;
  });
  const counts = new Map<string, number>(); for (const row of parsed.seats) counts.set(row.stateCode, (counts.get(row.stateCode) ?? 0) + 1);
  const targetUniverse = parsed.seats.map((row) => ({ seatCycleId: row.seatCycleId, stateCode: row.stateCode, districtCode: row.districtCode, bioguideId: row.bioguideId })).sort((left, right) => bytewise(left.seatCycleId, right.seatCycleId));
  const invalidStateCounts = parsed.stateCycles.some((row) => row.targetSeatCount !== counts.get(row.stateCode)) || [...counts].some(([stateCode]) => CYCLES.some((cycle) => !stateByKey.has(stateCycleKey(stateCode, cycle))));
  const expectedClasses = sourceClasses().map((row) => row.id).sort(bytewise);
  if (invalidState || invalidStateCounts || invalidSeat || hash("dsa-seats:house-democratic-primary-target-universe:v1\0", targetUniverse) !== TARGET_UNIVERSE_SHA || parsed.stateCycles.length !== 114 || stateByKey.size !== 114 || counts.size !== 38 || parsed.seats.length !== 212 || new Set(parsed.seats.map((row) => row.seatCycleId)).size !== 212 || new Set(parsed.seats.map((row) => row.bioguideId)).size !== 212 || canonicalJson(parsed.sourceClasses.map((row) => row.id).sort(bytewise)) !== canonicalJson(expectedClasses) || canonicalJson(parsed.sourceClasses) !== canonicalJson(sourceClasses()) || new Set(parsed.decisions.map((row) => row.decisionId)).size !== 6) throw new Error("PRIMARY_SOURCE_SELECTION_INVARIANT_FAILED");
  return parsed;
}
