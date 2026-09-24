import { describe, expect, it } from "vitest";

import { blueBaselineScore, cashVulnerabilityScore, competitivenessScore, coverageScaled, scoreSeat } from "./seat-score";

describe("chamber-agnostic seat score", () => {
  it("reproduces the House component formulas", () => {
    expect(cashVulnerabilityScore(50_000)).toBe(100);
    expect(cashVulnerabilityScore(500_000)).toBe(50);
    expect(cashVulnerabilityScore(5_000_000)).toBe(0);
    expect(blueBaselineScore(30)).toBe(100);
    expect(blueBaselineScore(5)).toBe(0);
    expect(competitivenessScore(-10)).toBe(60);
    expect(competitivenessScore(3)).toBe(100);
  });

  it("scales by available weight instead of imputing zeros", () => {
    expect(coverageScaled([[0.45, 100], [0.2, null], [0.15, null], [0.2, null]])).toEqual({ score: 78, availableWeight: 0.45, weightedMean: 100, coverageMultiplier: 0.78 });
    expect(scoreSeat({ caucus: "Republican", presidentialDemocraticMargin2024: -5, primaryFeasibility: null, alignmentGap: null, cashOnHand: 500_000, localContext: null, stateContestation: null }).score).toBe(60.9);
  });

  it("scores a Democratic-caucus seat with full and partial evidence", () => {
    const full = scoreSeat({ caucus: "Democratic", presidentialDemocraticMargin2024: 30, primaryFeasibility: 40, alignmentGap: 60, cashOnHand: 50_000, localContext: null, stateContestation: null });
    expect(full).toMatchObject({ route: "democratic_incumbent_primary", blueBaseline: 100, structuralBaseline: 82, availableWeight: 1, coverageMultiplier: 1, score: one(0.65 * 82 + 0.2 * 60 + 0.15 * 100) });
    const partial = scoreSeat({ caucus: "Democratic", presidentialDemocraticMargin2024: 30, primaryFeasibility: null, alignmentGap: null, cashOnHand: null, localContext: null, stateContestation: null });
    expect(partial).toMatchObject({ structuralBaseline: 100, availableWeight: 0.65, coverageMultiplier: 0.86, score: 86 });
  });
});

const one = (value: number) => Math.round(value * 10) / 10;
