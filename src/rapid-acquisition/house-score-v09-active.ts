import { housePriorityBriefsV03 } from "@/lib/house-priority-index";

import { readHousePrimaryIncumbentEvidenceV2, INCUMBENT_EVIDENCE_V2 } from "./house-primary-incumbent-evidence-v2";
import { validateHouseScoreV08ActiveProjection, type HouseScoreV08ActiveRow } from "./house-score-v08-active";
import { readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { byteCompare, exact, hash } from "./shared";
import { readStateLegislativePrimaryContext, STATE_LEGISLATIVE_PRIMARY_CONTEXT } from "./state-legislative-primary-context";

/**
 * House score v0.9: the Republican-held route becomes a coverage-scaled
 * calculation instead of a flat 0.70 multiplier, and the reviewed alias table
 * activates direct 2024 primary evidence for RI-01.
 *
 * Republican route components and weights:
 *   general-election competitiveness 0.45, cash vulnerability 0.20,
 *   exact at-large local context 0.15, state Democratic primary contestation 0.20.
 * Available components are renormalised by their weight sum W, then multiplied
 * by (0.6 + 0.4 W), the same partial-coverage rule the Democratic route applies
 * to primary feasibility. The penalty is now for missing evidence, not party.
 *
 * Democratic seats reproduce v0.8 exactly except RI-01, whose direct primary
 * evidence is now resolvable and is applied with the v0.8 structural formula.
 */
export const REPUBLICAN_ROUTE_WEIGHTS = { competitiveness: 0.45, cashVulnerability: 0.2, localContext: 0.15, stateContestation: 0.2 } as const;

export interface RepublicanRouteV09 {
  readonly competitiveness: number;
  readonly cashVulnerability: number | null;
  readonly localContext: number | null;
  readonly stateContestation: number | null;
  readonly stateContestationCycleYear: number | null;
  readonly stateContestationSourceArtifactId: string | null;
  readonly availableWeight: number;
  readonly weightedMean: number;
  readonly coverageMultiplier: number;
}

export interface HouseScoreV09ActiveRow {
  readonly seatCycleId: string;
  readonly districtLabel: string;
  readonly incumbentParty: "Democratic" | "Republican";
  readonly qualifyingRoute: "deep_blue" | "aipac_supported_blue" | "republican_fringe_general";
  readonly previousScoreVersion: "v0.8";
  readonly previousScore: number;
  readonly activeScoreVersion: "v0.9";
  readonly activeScore: number;
  readonly republicanRoute: RepublicanRouteV09 | null;
  readonly directPrimaryEvidence: boolean;
  readonly newlyResolvedPrimaryEvidence: boolean;
  readonly primaryEvidenceId: string | null;
  readonly primaryIdentityStatus: string | null;
  readonly activePrimaryFeasibility: number | null;
  readonly incumbentPrimaryVotes: number | null;
  readonly primaryContestVotes: number | null;
  readonly incumbentPrimaryVoteShare: number | null;
  readonly structuralBaseline: number | null;
  readonly localContext: number | null;
  readonly localContextAvailableWeight: number;
  readonly movementFromV08: number;
  readonly parentV08RowSha256: string;
  readonly sourceLockIds: readonly string[];
  readonly rowSha256: string;
}

export interface HouseScoreV09ActiveProjection {
  readonly schema: "house-score-v09-active-projection-v1";
  readonly version: 1;
  readonly methodology: Readonly<{
    status: "active";
    republicanRouteFormula: "renormalized(0.45_competitiveness+0.20_cash_vulnerability+0.15_local_context+0.20_state_contestation)_times_(0.6+0.4_available_weight)";
    republicanRouteCap: "removed";
    stateContestationSource: "rapid-state-legislative-primary-context-v1_latest_comparable_state_legislative_cycle";
    democraticRoute: "v0.8_reproduced_except_reviewed_alias_activation";
    movementCap: "not_enforced_recorded_only";
    sourceWinnerInference: false;
  }>;
  readonly parents: readonly Readonly<{ id: string; packageSha256: string }>[];
  readonly rows: readonly HouseScoreV09ActiveRow[];
  readonly summary: Readonly<{ seats: 430; republicanSeats: 218; republicanSeatsWithStateContestation: number; republicanSeatsWithLocalContext: number; newlyResolvedPrimarySeats: number; changedSeats: number; unchangedSeats: number; routeChanges: 0; maxAbsoluteMovement: number; movementsOver13: number; republicanMaxScore: number }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const HOUSE_SCORE_V09 = {
  id: "house-score-v09-active-projection-v1",
  path: "data/metadata/house-score-v09-active-projection-v1.json",
  url: "urn:dsa-seats:house-score-v09-active-projection:v1",
  parentIds: ["house-score-v08-active-projection-v1", INCUMBENT_EVIDENCE_V2.id, STATE_LEGISLATIVE_PRIMARY_CONTEXT.id],
} as const;

const one = (value: number) => Math.round(value * 10) / 10;
const fail = (code: string): never => { throw new Error(`HOUSE_V09_${code}`); };

export function republicanRouteScore(input: Readonly<{ competitiveness: number; cashVulnerability: number | null; localContext: number | null; stateContestation: number | null }>): { score: number; availableWeight: number; weightedMean: number; coverageMultiplier: number } {
  const parts: [number, number | null][] = [
    [REPUBLICAN_ROUTE_WEIGHTS.competitiveness, input.competitiveness],
    [REPUBLICAN_ROUTE_WEIGHTS.cashVulnerability, input.cashVulnerability],
    [REPUBLICAN_ROUTE_WEIGHTS.localContext, input.localContext],
    [REPUBLICAN_ROUTE_WEIGHTS.stateContestation, input.stateContestation],
  ];
  const available = parts.filter((part): part is [number, number] => part[1] !== null);
  const availableWeight = Math.round(available.reduce((sum, [weight]) => sum + weight, 0) * 100) / 100;
  const weightedMean = one(available.reduce((sum, [weight, value]) => sum + weight * value, 0) / availableWeight);
  const coverageMultiplier = Math.round((0.6 + 0.4 * availableWeight) * 1000) / 1000;
  return { score: one(weightedMean * coverageMultiplier), availableWeight, weightedMean, coverageMultiplier };
}

function driver(brief: ReturnType<typeof housePriorityBriefsV03>[number], key: string): number | null {
  const value = brief.scoreDrivers.find((item) => item.key === key)?.score;
  if (value === undefined) fail(`DRIVER_MISSING:${brief.districtLabel}:${key}`);
  return value as number | null;
}

export function buildHouseScoreV09ActiveProjection(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseScoreV09ActiveProjection {
  const v08 = validateHouseScoreV08ActiveProjection(JSON.parse(readRetainedSource(lock, "house-score-v08-active-projection-v1", root).bytes.toString("utf8")), root);
  const evidence = readHousePrimaryIncumbentEvidenceV2(root, lock);
  const context = readStateLegislativePrimaryContext(root, lock);
  const parentById = new Map(v08.rows.map((row) => [row.seatCycleId, row]));
  const evidenceBySeat = new Map(evidence.rows.map((row) => [row.targetSeatId, row]));
  const contextByState = new Map(context.stateContext.map((row) => [row.state, row]));

  const rows = housePriorityBriefsV03().map((brief): HouseScoreV09ActiveRow => {
    const parent: HouseScoreV08ActiveRow = parentById.get(brief.seatCycleId) ?? fail(`PARENT_MISSING:${brief.seatCycleId}`);
    if (parent.districtLabel !== brief.districtLabel || parent.activeScoreVersion !== "v0.8" || parent.incumbentParty !== brief.incumbentParty) fail(`PARENT_JOIN_INVALID:${brief.seatCycleId}`);
    const primary = evidenceBySeat.get(brief.seatCycleId);
    const carried = {
      seatCycleId: brief.seatCycleId, districtLabel: brief.districtLabel, incumbentParty: brief.incumbentParty, qualifyingRoute: brief.qualifyingRoute,
      previousScoreVersion: "v0.8" as const, previousScore: parent.activeScore, activeScoreVersion: "v0.9" as const,
      localContext: parent.localContext, localContextAvailableWeight: parent.localContextAvailableWeight, parentV08RowSha256: parent.rowSha256,
    };
    if (brief.incumbentParty === "Republican") {
      const competitiveness = driver(brief, "general_election_competitiveness");
      if (competitiveness === null) fail(`COMPETITIVENESS_MISSING:${brief.seatCycleId}`);
      const cashVulnerability = driver(brief, "cash_vulnerability");
      const state = contextByState.get(brief.stateCode) ?? null;
      const route = republicanRouteScore({ competitiveness: competitiveness as number, cashVulnerability, localContext: parent.localContext, stateContestation: state?.contestationScore ?? null });
      const unsigned = {
        ...carried, activeScore: route.score,
        republicanRoute: { competitiveness: competitiveness as number, cashVulnerability, localContext: parent.localContext, stateContestation: state?.contestationScore ?? null, stateContestationCycleYear: state?.cycleYear ?? null, stateContestationSourceArtifactId: state?.sourceArtifactId ?? null, availableWeight: route.availableWeight, weightedMean: route.weightedMean, coverageMultiplier: route.coverageMultiplier },
        directPrimaryEvidence: false, newlyResolvedPrimaryEvidence: false, primaryEvidenceId: null, primaryIdentityStatus: null, activePrimaryFeasibility: null, incumbentPrimaryVotes: null, primaryContestVotes: null, incumbentPrimaryVoteShare: null, structuralBaseline: null,
        movementFromV08: one(route.score - parent.activeScore),
        sourceLockIds: [...new Set([...parent.sourceLockIds, ...(state ? [STATE_LEGISLATIVE_PRIMARY_CONTEXT.id, state.sourceArtifactId] : [])])],
      };
      return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v09-active-row:v1", unsigned) };
    }
    const newlyResolved = primary?.formulaEligible === true && !parent.directPrimaryEvidence;
    let activeScore = parent.activeScore, structuralBaseline = parent.structuralBaseline, activePrimaryFeasibility = parent.activePrimaryFeasibility;
    if (newlyResolved) {
      const vulnerability = primary!.primaryVulnerability;
      if (vulnerability === null || primary!.winnerInference !== null) fail(`PRIMARY_INVALID:${brief.seatCycleId}`);
      const blue = driver(brief, "blue_baseline") ?? fail(`STRUCTURAL_INPUT_INVALID:${brief.seatCycleId}`), aipac = driver(brief, "aipac_support"), alignment = driver(brief, "incumbent_alignment_gap") ?? fail(`STRUCTURAL_INPUT_INVALID:${brief.seatCycleId}`), cash = driver(brief, "cash_vulnerability");
      const recomputed = brief.qualifyingRoute === "deep_blue" ? 0.7 * blue + 0.3 * (vulnerability as number) : brief.qualifyingRoute === "aipac_supported_blue" && aipac !== null ? 0.6 * aipac + 0.25 * blue + 0.15 * (vulnerability as number) : fail(`ROUTE_INVALID:${brief.seatCycleId}`);
      structuralBaseline = parent.localContext === null ? one(recomputed) : one(0.8 * recomputed + 0.2 * parent.localContext);
      activeScore = cash === null ? one((0.65 * structuralBaseline + 0.2 * alignment) / 0.85) : one(0.65 * structuralBaseline + 0.2 * alignment + 0.15 * cash);
      activePrimaryFeasibility = primary!.primaryVulnerability;
    }
    const direct = parent.directPrimaryEvidence || newlyResolved;
    const unsigned = {
      ...carried, activeScore, republicanRoute: null,
      directPrimaryEvidence: direct, newlyResolvedPrimaryEvidence: newlyResolved,
      primaryEvidenceId: direct ? primary!.evidenceId : null, primaryIdentityStatus: primary?.identityStatus ?? null,
      activePrimaryFeasibility, incumbentPrimaryVotes: direct ? primary!.incumbentVotes : null, primaryContestVotes: direct ? primary!.contestVotes : null, incumbentPrimaryVoteShare: direct ? primary!.incumbentVoteShare : null, structuralBaseline,
      movementFromV08: one(activeScore - parent.activeScore),
      sourceLockIds: newlyResolved ? [INCUMBENT_EVIDENCE_V2.id, "house-identity-aliases-v1"] : parent.sourceLockIds,
    };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v09-active-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));

  const republicans = rows.filter((row) => row.incumbentParty === "Republican"), changed = rows.filter((row) => row.movementFromV08 !== 0);
  if (rows.length !== 430 || republicans.length !== 218 || new Set(rows.map((row) => row.seatCycleId)).size !== 430) fail("CLOSURE_INVALID");
  if (rows.some((row) => row.incumbentParty === "Democratic" && !row.newlyResolvedPrimaryEvidence && row.movementFromV08 !== 0)) fail("DEMOCRATIC_DRIFT");
  const summary = {
    seats: 430 as const, republicanSeats: 218 as const,
    republicanSeatsWithStateContestation: republicans.filter((row) => row.republicanRoute!.stateContestation !== null).length,
    republicanSeatsWithLocalContext: republicans.filter((row) => row.republicanRoute!.localContext !== null).length,
    newlyResolvedPrimarySeats: rows.filter((row) => row.newlyResolvedPrimaryEvidence).length,
    changedSeats: changed.length, unchangedSeats: rows.length - changed.length, routeChanges: 0 as const,
    maxAbsoluteMovement: one(Math.max(...rows.map((row) => Math.abs(row.movementFromV08)))),
    movementsOver13: rows.filter((row) => Math.abs(row.movementFromV08) > 13).length,
    republicanMaxScore: one(Math.max(...republicans.map((row) => row.activeScore))),
  };
  const methodology = {
    status: "active" as const,
    republicanRouteFormula: "renormalized(0.45_competitiveness+0.20_cash_vulnerability+0.15_local_context+0.20_state_contestation)_times_(0.6+0.4_available_weight)" as const,
    republicanRouteCap: "removed" as const,
    stateContestationSource: "rapid-state-legislative-primary-context-v1_latest_comparable_state_legislative_cycle" as const,
    democraticRoute: "v0.8_reproduced_except_reviewed_alias_activation" as const,
    movementCap: "not_enforced_recorded_only" as const,
    sourceWinnerInference: false as const,
  };
  const parents = [{ id: "house-score-v08-active-projection-v1", packageSha256: v08.packageSha256 }, { id: INCUMBENT_EVIDENCE_V2.id, packageSha256: evidence.packageSha256 }, { id: STATE_LEGISLATIVE_PRIMARY_CONTEXT.id, packageSha256: context.packageSha256 }];
  const unsigned = { schema: "house-score-v09-active-projection-v1" as const, version: 1 as const, methodology, parents, rows, summary, rowSetSha256: hash("dsa-seats:house-score-v09-active-row-set:v1", rows) };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-score-v09-active-package:v1", unsigned) };
}

export function validateHouseScoreV09ActiveProjection(value: unknown, root = process.cwd()): HouseScoreV09ActiveProjection {
  const expected = buildHouseScoreV09ActiveProjection(root);
  if (!exact(value, expected)) fail("ACTIVE_INVALID");
  return value as HouseScoreV09ActiveProjection;
}
