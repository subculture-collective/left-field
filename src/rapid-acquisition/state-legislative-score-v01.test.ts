import { describe, expect, it } from "vitest";

import { buildStateLegislativeScoreV01Projection, readStateLegislativeScoreV01Projection, stateSeatLabel, termYearsFor } from "./state-legislative-score-v01";

describe("state-legislative score v0.1", () => {
  it("uses chamber term defaults", () => {
    expect(termYearsFor("GA", "lower")).toBe(2);
    expect(termYearsFor("GA", "upper")).toBe(2);
    expect(termYearsFor("VA", "upper")).toBe(4);
    expect(termYearsFor("AL", "lower")).toBe(4);
    expect(termYearsFor("NE", "unicameral")).toBe(4);
    expect(stateSeatLabel("VA", "lower", "12")).toBe("VA House 12");
  });

  it("scores every seat in a covered state and carries the rest unscored with a reason", () => {
    const value = buildStateLegislativeScoreV01Projection();
    expect(value.coveredStates).toEqual(["CA", "GA", "NY", "VA"]);
    expect(value.summary).toMatchObject({ seats: value.rows.length, coveredStates: 4, scored: 704, noContestForDistrict: 0, holderPartyNotScored: 0, democraticScored: 419, republicanScored: 285 });
    expect(value.summary.stateNotCovered + value.summary.scored).toBe(value.summary.seats);
    const ga = value.rows.filter((row) => row.stateCode === "GA");
    expect(ga.every((row) => row.status === "scored" && row.nextElectionYear === 2026 && row.baselineCycleYear === 2024)).toBe(true);
    const vaHouse = value.rows.filter((row) => row.stateCode === "VA" && row.chamber === "lower");
    expect(vaHouse.every((row) => row.baselineCycleYear === 2025 && row.nextElectionYear === 2027)).toBe(true);
    const vaSenate = value.rows.filter((row) => row.stateCode === "VA" && row.chamber === "upper");
    expect(vaSenate.every((row) => row.baselineCycleYear === 2023 && row.nextElectionYear === 2027)).toBe(true);
    const caSenate = value.rows.filter((row) => row.stateCode === "CA" && row.chamber === "upper");
    expect(new Set(caSenate.map((row) => `${row.baselineCycleYear}->${row.nextElectionYear}`))).toEqual(new Set(["2024->2028", "2022->2026"]));
    expect(caSenate.every((row) => (Number(row.district) % 2 === 1) === (row.baselineCycleYear === 2024))).toBe(true);
    expect(value.rows.filter((row) => row.stateCode === "NY").every((row) => row.status === "scored" && row.nextElectionYear === 2026)).toBe(true);
    const other = value.rows.find((row) => row.stateCode === "TX");
    expect(other).toMatchObject({ status: "state_not_covered", score: null, route: null, drivers: [] });
  });

  it("applies the shared routes: uncontested Democratic seats top out at the blue-only ceiling", () => {
    const value = buildStateLegislativeScoreV01Projection();
    const uncontestedDemocrat = value.rows.find((row) => row.status === "scored" && row.caucus === "Democratic" && row.baselineContested === false && row.primaryFeasibility === null);
    expect(uncontestedDemocrat).toMatchObject({ blueBaseline: 100, availableWeight: 0.65, score: 86, route: "democratic_incumbent_primary" });
    expect(uncontestedDemocrat?.ownRaceDemocraticMargin).toBeGreaterThan(95);
    const republican = value.rows.find((row) => row.status === "scored" && row.caucus === "Republican" && row.baselineContested);
    expect(republican?.route).toBe("republican_fringe_general");
    expect(republican?.competitiveness).toBeGreaterThanOrEqual(0);
    expect(republican?.drivers.map((driver) => driver.key)).toEqual(["general_election_competitiveness", "cash_vulnerability", "local_context", "state_primary_contestation"]);
  });

  it("matches the pinned artifact", () => {
    expect(readStateLegislativeScoreV01Projection().packageSha256).toBe(buildStateLegislativeScoreV01Projection().packageSha256);
  });
});
