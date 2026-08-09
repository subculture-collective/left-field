import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { housePriorityBriefsV03 } from "@/lib/house-priority-index";

type DemographicRow = { countyFips: string; stateCode: string; population: number; medianHouseholdIncome: number | null; renterShare: number | null; age18To34Share: number | null; populationDensityPerSquareMile: number };
type ElectionRow = { countyFips: string; stateCode: string; cycleYear: number; registeredVoters: number | null; ballotsCast: number | null };
type CvapRow = { countyFips: string; stateCode: string; citizenVotingAgePopulation: number };

export interface HouseScoreV04ShadowRow {
  readonly seatCycleId: string;
  readonly districtLabel: string;
  readonly incumbentParty: "Democratic" | "Republican";
  readonly qualifyingRoute: "deep_blue" | "aipac_supported_blue" | "republican_fringe_general";
  readonly activeScoreVersion: "v0.3";
  readonly activeScore: number;
  readonly localContext: number | null;
  readonly localContextAvailableWeight: number;
  readonly localContextComponents: Readonly<{
    inverseBallotsCastToCvap: number | null;
    inverseActiveRegistrationToCvap: number | null;
    downBallotDemocraticOverperformance: null;
    demographicOpportunity: number | null;
  }>;
  readonly exactGeographyJoin: "at_large_statewide" | "not_yet_eligible";
  readonly shadowScoreVersion: "v0.4-shadow";
  readonly shadowScore: number;
  readonly movement: number;
  readonly activationEligible: boolean;
  readonly sourceLockIds: readonly string[];
  readonly rowSha256: string;
}

export interface HouseScoreV04ShadowProjection {
  readonly schema: "house-score-v04-shadow-projection-v1";
  readonly version: 1;
  readonly generatedAt: "2026-08-08T22:30:00.000Z";
  readonly methodology: Readonly<{
    percentileMethod: "midrank_within_state_zero_to_one_hundred";
    districtAggregation: "population_weighted_county_percentile_scores";
    demographicFormula: "0.35_renter_plus_0.25_age18to34_plus_0.25_inverse_income_plus_0.15_density";
    localFormula: "available_weights_renormalized_from_0.40_inverse_ballots_cvap_0.30_inverse_registration_cvap_0.20_downballot_overperformance_0.10_demographics";
    minimumAvailableWeight: 0.6;
    directElectionAdministrationMeasureRequired: true;
    nullLocalRule: "shadow_score_exactly_equals_active_v03";
    activeScoreChanged: false;
  }>;
  readonly rows: readonly HouseScoreV04ShadowRow[];
  readonly summary: Readonly<{
    seats: 430;
    exactAtLargeJoins: 6;
    localContextEligibleSeats: 3;
    localContextIneligibleSeats: 427;
    routeChanges: 0;
    activeScoreChanges: 0;
    democraticMovementCap: 13;
    republicanMovementCap: 14;
    movementCapBreaches: 0;
    activationEligible: false;
  }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

const SOURCES = [
  ["dsa-target-priority-briefs-20260807-v1", "data/metadata/dsa-target-priority-briefs-20260807-v1.json", 932792, "fe0502903e82639f13afa9557354da6066e57e4aad61e2056afdc2560bc32bc4"],
  ["house-priority-finance-projection-20260808-v1", "data/metadata/house-priority-finance-20260808-v1.json", 281947, "a908273c32fe63e53d4820810a8912bbb216486c1e83e00130c540ddbd18bf51"],
  ["downballot-presidential-cd-2024-csv", "data/source/elections/downballot-presidential-cd-2024.csv", 55833, "938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e"],
  ["house-xml", "data/source/identity/house-member-data.xml", 556140, "4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b"],
  ["congress-legislators-current-20260804", "data/source/identity/congress-legislators-current-20260804.json", 1466894, "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf"],
  ["rapid-county-demographics-projection-v1", "data/metadata/rapid-county-demographics-projection-v1.json", 2441846, "ebbeb1127151a78985e97a7971d580edd637f746b63b6845353c63407989c8fc"],
  ["rapid-county-election-context-projection-v1", "data/metadata/rapid-county-election-context-projection-v1.json", 3252284, "84e768271bbc09d57f2f08f7d9d6d29150083919dd6e8e2414a117fa003e0bf9"],
  ["rapid-county-cvap-projection-v1", "data/metadata/rapid-county-cvap-projection-v1.json", 1601784, "7245c27c31bdd588a613ccf3d897a8c3b4545a6fe57fb81ac1f3191b4f5e3583"],
  ["rapid-at-large-cd119-county-universe-v1", "data/metadata/rapid-at-large-cd119-county-universe-v1.json", 6685, "9c4505a7aeebbfe59e25ca2b90d7e6e4f23628220f343f1b0ab46cf2bb62e54f"],
] as const;
const byteCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
const hash = (domain: string, value: unknown) => createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const one = (value: number) => Math.round(value * 10) / 10;
const exact = (left: unknown, right: unknown) => canonical(left) === canonical(right);

function midranks(values: readonly number[], inverse = false): number[] {
  if (values.length === 1) return [50];
  const sorted = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const result = Array<number>(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end]!.value === sorted[start]!.value) end++;
    const rank = (start + end - 1) / 2;
    const percentile = 100 * rank / (sorted.length - 1);
    for (let index = start; index < end; index++) result[sorted[index]!.index] = inverse ? 100 - percentile : percentile;
    start = end;
  }
  return result;
}

function weighted(values: readonly number[], weights: readonly number[]): number {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || values.length !== weights.length) throw new Error("HOUSE_V04_WEIGHT_INVALID");
  return values.reduce((sum, value, index) => sum + value * weights[index]!, 0) / total;
}

function verifySources(root: string): Map<string, Buffer> {
  const lock = JSON.parse(readFileSync(join(root, "data/source-lock.json"), "utf8")) as { entries: readonly { id?: unknown; retainedPath?: unknown; byteSize?: unknown; sha256?: unknown; retainedStatus?: unknown }[] };
  const bytes = new Map<string, Buffer>();
  for (const [id, path, size, digest] of SOURCES) {
    const value = readFileSync(join(root, path));
    const matches = lock.entries.filter((entry) => entry.id === id);
    if (value.length !== size || sha(value) !== digest || matches.length !== 1 || matches[0]!.retainedPath !== path || matches[0]!.byteSize !== size || matches[0]!.sha256 !== digest || matches[0]!.retainedStatus !== "retained") throw new Error(`HOUSE_V04_SOURCE_INVALID:${id}`);
    bytes.set(id, value);
  }
  return bytes;
}

export function buildHouseScoreV04ShadowProjection(root = process.cwd()): HouseScoreV04ShadowProjection {
  const bytes = verifySources(root);
  const demographics = JSON.parse(bytes.get("rapid-county-demographics-projection-v1")!.toString("utf8")) as { rows: DemographicRow[] };
  const election = JSON.parse(bytes.get("rapid-county-election-context-projection-v1")!.toString("utf8")) as { rows: ElectionRow[] };
  const cvap = JSON.parse(bytes.get("rapid-county-cvap-projection-v1")!.toString("utf8")) as { rows: CvapRow[] };
  const geography = JSON.parse(bytes.get("rapid-at-large-cd119-county-universe-v1")!.toString("utf8")) as { schema?: unknown; rows?: readonly { stateCode: string; countyFips: readonly string[]; exactCountyUniverseMatch: boolean }[]; summary?: { exactCountyUniverses?: unknown } };
  if (geography.schema !== "rapid-at-large-cd119-county-universe-v1" || geography.summary?.exactCountyUniverses !== 6 || !Array.isArray(geography.rows) || geography.rows.length !== 6 || geography.rows.some((row) => !row.exactCountyUniverseMatch)) throw new Error("HOUSE_V04_GEOGRAPHY_INVALID");
  const geographyByState = new Map(geography.rows.map((row) => [row.stateCode, row]));
  const electionByCounty = new Map(election.rows.filter((row) => row.cycleYear === 2024).map((row) => [row.countyFips, row]));
  const cvapByCounty = new Map(cvap.rows.map((row) => [row.countyFips, row]));
  const localByState = new Map<string, { value: number; availableWeight: number; components: HouseScoreV04ShadowRow["localContextComponents"] }>();
  for (const stateCode of ["AK", "DE", "ND", "SD", "VT", "WY"]) {
    const counties = demographics.rows.filter((row) => row.stateCode === stateCode).sort((left, right) => byteCompare(left.countyFips, right.countyFips));
    const geographyRow = geographyByState.get(stateCode);
    if (!counties.length || !geographyRow || !exact(counties.map((row) => row.countyFips), geographyRow.countyFips)) throw new Error(`HOUSE_V04_STATE_COUNTIES_MISSING:${stateCode}`);
    const weights = counties.map((row) => row.population);
    const demographicInputs = [
      counties.map((row) => row.renterShare),
      counties.map((row) => row.age18To34Share),
      counties.map((row) => row.medianHouseholdIncome),
      counties.map((row) => row.populationDensityPerSquareMile),
    ];
    const demographicOpportunity = demographicInputs.some((values) => values.some((value) => value === null)) ? null : weighted(counties.map((_, index) => 0.35 * midranks(demographicInputs[0] as number[])[index]! + 0.25 * midranks(demographicInputs[1] as number[])[index]! + 0.25 * midranks(demographicInputs[2] as number[], true)[index]! + 0.15 * midranks(demographicInputs[3] as number[])[index]!), weights);
    const ratios = (field: "ballotsCast" | "registeredVoters") => counties.map((county) => {
      const context = electionByCounty.get(county.countyFips), denominator = cvapByCounty.get(county.countyFips)?.citizenVotingAgePopulation;
      const numerator = context?.[field];
      return numerator === null || numerator === undefined || denominator === undefined || denominator <= 0 ? null : numerator / denominator;
    });
    const ballotRatios = ratios("ballotsCast"), registrationRatios = ratios("registeredVoters");
    const inverseBallotsCastToCvap = ballotRatios.some((value) => value === null) ? null : weighted(midranks(ballotRatios as number[], true), weights);
    const inverseActiveRegistrationToCvap = registrationRatios.some((value) => value === null) ? null : weighted(midranks(registrationRatios as number[], true), weights);
    const components = { inverseBallotsCastToCvap, inverseActiveRegistrationToCvap, downBallotDemocraticOverperformance: null, demographicOpportunity } as const;
    const parts = [[inverseBallotsCastToCvap, 0.4], [inverseActiveRegistrationToCvap, 0.3], [null, 0.2], [demographicOpportunity, 0.1]] as const;
    const availableWeight = parts.reduce((sum, [value, weight]) => sum + (value === null ? 0 : weight), 0);
    if (availableWeight >= 0.6 && (inverseBallotsCastToCvap !== null || inverseActiveRegistrationToCvap !== null)) {
      const value = parts.reduce((sum, [part, weight]) => sum + (part === null ? 0 : part * weight), 0) / availableWeight;
      localByState.set(stateCode, { value, availableWeight, components });
    }
  }
  const sourceLockIds = SOURCES.map(([id]) => id);
  const rows = housePriorityBriefsV03().map((brief) => {
    const exactGeographyJoin = (brief.districtCode === "00" || brief.districtCode === "AL") && geographyByState.has(brief.stateCode) ? "at_large_statewide" as const : "not_yet_eligible" as const;
    const local = exactGeographyJoin === "at_large_statewide" ? localByState.get(brief.stateCode) : undefined;
    let shadowScore = brief.provisionalTargetScore;
    if (local) {
      if (brief.incumbentParty === "Democratic") {
        const alignment = brief.scoreDrivers.find((driver) => driver.key === "incumbent_alignment_gap")?.score;
        const cash = brief.scoreDrivers.find((driver) => driver.key === "cash_vulnerability")?.score;
        if (alignment === undefined || alignment === null) throw new Error(`HOUSE_V04_ALIGNMENT_MISSING:${brief.seatCycleId}`);
        const structural = 0.8 * brief.baselineTargetScore + 0.2 * local.value;
        shadowScore = cash === undefined || cash === null ? one((0.65 * structural + 0.2 * alignment) / 0.85) : one(0.65 * structural + 0.2 * alignment + 0.15 * cash);
      } else {
        const competitiveness = brief.scoreDrivers.find((driver) => driver.key === "general_election_competitiveness")?.score;
        const cash = brief.scoreDrivers.find((driver) => driver.key === "cash_vulnerability")?.score;
        if (competitiveness === undefined || competitiveness === null) throw new Error(`HOUSE_V04_COMPETITIVENESS_MISSING:${brief.seatCycleId}`);
        const available = [[competitiveness, 0.6], [cash ?? null, 0.2], [local.value, 0.2]] as const;
        const weight = available.reduce((sum, [value, itemWeight]) => sum + (value === null ? 0 : itemWeight), 0);
        shadowScore = one(0.7 * available.reduce((sum, [value, itemWeight]) => sum + (value === null ? 0 : value * itemWeight), 0) / weight);
      }
    }
    const movement = one(shadowScore - brief.provisionalTargetScore);
    const unsigned = { seatCycleId: brief.seatCycleId, districtLabel: brief.districtLabel, incumbentParty: brief.incumbentParty, qualifyingRoute: brief.qualifyingRoute, activeScoreVersion: "v0.3" as const, activeScore: brief.provisionalTargetScore, localContext: local ? one(local.value) : null, localContextAvailableWeight: local?.availableWeight ?? 0, localContextComponents: local?.components ?? { inverseBallotsCastToCvap: null, inverseActiveRegistrationToCvap: null, downBallotDemocraticOverperformance: null, demographicOpportunity: null }, exactGeographyJoin, shadowScoreVersion: "v0.4-shadow" as const, shadowScore, movement, activationEligible: false, sourceLockIds };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v04-shadow-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));
  const routeChanges = 0 as const, activeScoreChanges = 0 as const;
  const observedMovementCapBreaches = rows.filter((row) => Math.abs(row.movement) > (row.incumbentParty === "Democratic" ? 13 : 14)).length;
  if (rows.length !== 430 || new Set(rows.map((row) => row.seatCycleId)).size !== 430 || rows.filter((row) => row.localContext !== null).length !== 3 || observedMovementCapBreaches !== 0 || rows.some((row) => row.localContext === null && row.shadowScore !== row.activeScore)) throw new Error("HOUSE_V04_CLOSURE_INVALID");
  const movementCapBreaches = 0 as const;
  const methodology = { percentileMethod: "midrank_within_state_zero_to_one_hundred" as const, districtAggregation: "population_weighted_county_percentile_scores" as const, demographicFormula: "0.35_renter_plus_0.25_age18to34_plus_0.25_inverse_income_plus_0.15_density" as const, localFormula: "available_weights_renormalized_from_0.40_inverse_ballots_cvap_0.30_inverse_registration_cvap_0.20_downballot_overperformance_0.10_demographics" as const, minimumAvailableWeight: 0.6 as const, directElectionAdministrationMeasureRequired: true as const, nullLocalRule: "shadow_score_exactly_equals_active_v03" as const, activeScoreChanged: false as const };
  const summary = { seats: 430 as const, exactAtLargeJoins: 6 as const, localContextEligibleSeats: 3 as const, localContextIneligibleSeats: 427 as const, routeChanges, activeScoreChanges, democraticMovementCap: 13 as const, republicanMovementCap: 14 as const, movementCapBreaches, activationEligible: false as const };
  const rowSetSha256 = hash("dsa-seats:house-score-v04-shadow-row-set:v1", rows);
  const unsigned = { schema: "house-score-v04-shadow-projection-v1" as const, version: 1 as const, generatedAt: "2026-08-08T22:30:00.000Z" as const, methodology, rows, summary, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-score-v04-shadow-package:v1", unsigned) };
}

export function validateHouseScoreV04ShadowProjection(value: unknown, root = process.cwd()): HouseScoreV04ShadowProjection {
  const expected = buildHouseScoreV04ShadowProjection(root);
  if (!exact(value, expected)) throw new Error("HOUSE_V04_SHADOW_INVALID");
  return value as HouseScoreV04ShadowProjection;
}
