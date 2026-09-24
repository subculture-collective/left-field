import { describe, expect, it } from "vitest";

import { buildStateLegislativePrimaryContext, contestationScore, validateStateLegislativePrimaryContext } from "./state-legislative-primary-context";

describe("state-legislative Democratic primary contestation context", () => {
  const value = buildStateLegislativePrimaryContext();

  it("counts Democratic contests, contested contests, and votes from every retained catalog", () => {
    const row = (state: string, cycleYear: number, scope = "state_legislative") => value.rows.find((item) => item.state === state && item.cycleYear === cycleYear && item.officeScope === scope)!;
    expect(value.summary.catalogs).toBe(12);
    expect(row("OH", 2026)).toMatchObject({ democraticContests: 113, contestedDemocraticContests: 23, democraticVotes: 1_011_657, formulaEligible: true });
    expect(row("TN", 2024)).toMatchObject({ democraticContests: 87, contestedDemocraticContests: 14, democraticVotes: 238_338 });
    expect(row("GA", 2026)).toMatchObject({ democraticContests: 205, contestedDemocraticContests: 65, democraticVotes: 1_808_464 });
    expect(row("KY", 2026)).toMatchObject({ democraticContests: 15, contestedDemocraticContests: 15, formulaEligible: false, ineligibleReason: "source_retains_contested_primaries_only", contestationScore: null });
    expect(row("NM", 2026, "county_office")).toMatchObject({ democraticContests: 99, formulaEligible: false, ineligibleReason: "office_scope_not_state_legislative" });
  });

  it("selects one comparable state-legislative cycle per state", () => {
    expect(value.stateContext.map((row) => `${row.state}:${row.cycleYear}`)).toEqual(["GA:2026", "HI:2024", "IN:2024", "MO:2024", "OH:2026", "TN:2024"]);
    const ohio = value.stateContext.find((row) => row.state === "OH")!;
    expect(ohio.contestedShare).toBe(20.4);
    expect(ohio.contestationScore).toBe(contestationScore(20.4));
    expect(value.summary.statesWithContext).toBe(6);
  });

  it("bounds the contestation scale and never infers winners or holders", () => {
    expect(contestationScore(0)).toBe(0);
    expect(contestationScore(20)).toBe(50);
    expect(contestationScore(40)).toBe(100);
    expect(contestationScore(75)).toBe(100);
    expect(value.methodology.winnerInference).toBe(false);
    expect(value.methodology.holderIdentity).toBe("not_collected");
  });

  it("rejects a tampered artifact", () => {
    const tampered = structuredClone(value) as unknown as { stateContext: { contestationScore: number }[] };
    tampered.stateContext[0]!.contestationScore = 100;
    expect(() => validateStateLegislativePrimaryContext(tampered)).toThrow("STATE_LEGISLATIVE_PRIMARY_CONTEXT_INVALID");
  });
});
