/**
 * Chamber-agnostic seat scoring.
 *
 * Two routes, the same ones the House index uses. Every component is 0..100
 * and a missing component is omitted: the present weights are renormalized and
 * the result is scaled by (0.6 + 0.4 × available weight), so the penalty is for
 * missing evidence, never a zero.
 *
 * Democratic-caucus route
 *   blue baseline      clamp((margin − 5) × 4, 0, 100) from the jurisdiction's 2024 presidential margin
 *   structural         0.70 × blue baseline + 0.30 × primary feasibility (baseline alone when feasibility is missing)
 *   final              renormalized(0.65 × structural + 0.20 × alignment gap + 0.15 × cash vulnerability) × (0.6 + 0.4 W)
 *
 * Republican route
 *   competitiveness    clamp(100 − 4 × max(0, −margin), 0, 100)
 *   final              renormalized(0.45 × competitiveness + 0.20 × cash + 0.15 × local context + 0.20 × state contestation) × (0.6 + 0.4 W)
 */
export const SEAT_ROUTE_WEIGHTS = {
  democratic: { structural: 0.65, alignmentGap: 0.2, cashVulnerability: 0.15, structuralBlue: 0.7, structuralFeasibility: 0.3 },
  republican: { competitiveness: 0.45, cashVulnerability: 0.2, localContext: 0.15, stateContestation: 0.2 },
} as const;

export type SeatRoute = "democratic_incumbent_primary" | "republican_fringe_general";

export interface SeatScoreInput {
  readonly caucus: "Democratic" | "Republican";
  readonly presidentialDemocraticMargin2024: number;
  readonly primaryFeasibility: number | null;
  readonly alignmentGap: number | null;
  readonly cashOnHand: number | null;
  readonly localContext: number | null;
  readonly stateContestation: number | null;
}

export interface SeatScoreDriver {
  readonly key: string;
  readonly label: string;
  readonly score: number | null;
  readonly weight: number;
}

export interface SeatScore {
  readonly route: SeatRoute;
  readonly score: number;
  readonly blueBaseline: number | null;
  readonly competitiveness: number | null;
  readonly structuralBaseline: number | null;
  readonly cashVulnerability: number | null;
  readonly availableWeight: number;
  readonly coverageMultiplier: number;
  readonly drivers: readonly SeatScoreDriver[];
  readonly formula: string;
}

const one = (value: number): number => Math.round(value * 10) / 10;
const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function cashVulnerabilityScore(cashOnHand: number): number {
  if (!Number.isFinite(cashOnHand)) throw new Error("SEAT_SCORE_CASH_INVALID");
  if (cashOnHand <= 50_000) return 100;
  if (cashOnHand >= 5_000_000) return 0;
  return one(100 * (1 - Math.log(cashOnHand / 50_000) / Math.log(100)));
}

export const blueBaselineScore = (margin: number): number => one(clamp((margin - 5) * 4));
export const competitivenessScore = (margin: number): number => one(clamp(100 - 4 * Math.max(0, -margin)));

/** Renormalizes the present components and applies the coverage multiplier. */
export function coverageScaled(parts: readonly (readonly [weight: number, value: number | null])[]): { score: number; availableWeight: number; weightedMean: number; coverageMultiplier: number } {
  const present = parts.filter((part): part is readonly [number, number] => part[1] !== null);
  if (present.length === 0) throw new Error("SEAT_SCORE_NO_COMPONENTS");
  const availableWeight = Math.round(present.reduce((sum, [weight]) => sum + weight, 0) * 100) / 100;
  const weightedMean = one(present.reduce((sum, [weight, value]) => sum + weight * value, 0) / availableWeight);
  const coverageMultiplier = Math.round((0.6 + 0.4 * availableWeight) * 1000) / 1000;
  return { score: one(weightedMean * coverageMultiplier), availableWeight, weightedMean, coverageMultiplier };
}

export function scoreSeat(input: SeatScoreInput): SeatScore {
  const cash = input.cashOnHand === null ? null : cashVulnerabilityScore(input.cashOnHand);
  if (input.caucus === "Democratic") {
    const weights = SEAT_ROUTE_WEIGHTS.democratic;
    const blue = blueBaselineScore(input.presidentialDemocraticMargin2024);
    const structural = input.primaryFeasibility === null ? blue : one(weights.structuralBlue * blue + weights.structuralFeasibility * input.primaryFeasibility);
    const parts = [[weights.structural, structural], [weights.alignmentGap, input.alignmentGap], [weights.cashVulnerability, cash]] as const;
    const scaled = coverageScaled(parts);
    return {
      route: "democratic_incumbent_primary",
      score: scaled.score,
      blueBaseline: blue,
      competitiveness: null,
      structuralBaseline: structural,
      cashVulnerability: cash,
      availableWeight: scaled.availableWeight,
      coverageMultiplier: scaled.coverageMultiplier,
      drivers: [
        { key: "blue_baseline", label: "Blue baseline", score: blue, weight: weights.structural * weights.structuralBlue },
        { key: "primary_feasibility", label: "Primary feasibility", score: input.primaryFeasibility, weight: weights.structural * weights.structuralFeasibility },
        { key: "incumbent_alignment_gap", label: "Incumbent alignment gap", score: input.alignmentGap, weight: weights.alignmentGap },
        { key: "cash_vulnerability", label: "Cash vulnerability", score: cash, weight: weights.cashVulnerability },
      ],
      formula: `renormalized(0.65 × structural + 0.20 × alignment gap + 0.15 × cash vulnerability) × (0.6 + 0.4 × ${scaled.availableWeight})`,
    };
  }
  const weights = SEAT_ROUTE_WEIGHTS.republican;
  const competitiveness = competitivenessScore(input.presidentialDemocraticMargin2024);
  const parts = [[weights.competitiveness, competitiveness], [weights.cashVulnerability, cash], [weights.localContext, input.localContext], [weights.stateContestation, input.stateContestation]] as const;
  const scaled = coverageScaled(parts);
  return {
    route: "republican_fringe_general",
    score: scaled.score,
    blueBaseline: null,
    competitiveness,
    structuralBaseline: null,
    cashVulnerability: cash,
    availableWeight: scaled.availableWeight,
    coverageMultiplier: scaled.coverageMultiplier,
    drivers: [
      { key: "general_election_competitiveness", label: "General-election competitiveness", score: competitiveness, weight: weights.competitiveness },
      { key: "cash_vulnerability", label: "Cash vulnerability", score: cash, weight: weights.cashVulnerability },
      { key: "local_context", label: "Local context", score: input.localContext, weight: weights.localContext },
      { key: "state_primary_contestation", label: "State Democratic primary contestation", score: input.stateContestation, weight: weights.stateContestation },
    ],
    formula: `renormalized(0.45 × competitiveness + 0.20 × cash vulnerability + 0.15 × local context + 0.20 × state contestation) × (0.6 + 0.4 × ${scaled.availableWeight})`,
  };
}
