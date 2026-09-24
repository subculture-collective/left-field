import { describe, expect, it } from "vitest";
import { cashVulnerabilityScore, housePriorityBriefs, housePriorityBriefsV03 } from "./house-priority-index";

describe("house priority index", () => {
  it("scores every retained Republican voting member through the coverage-scaled flip route without a flat cap", () => {
    const rows = housePriorityBriefs(), republicans = rows.filter((row) => row.incumbentParty === "Republican");
    expect(rows).toHaveLength(430);
    expect(republicans).toHaveLength(218);
    expect(Math.max(...republicans.map((row) => row.provisionalTargetScore))).toBe(78.6);
    expect(republicans.every((row) => row.provisionalTargetScore >= 0 && row.provisionalTargetScore <= 100)).toBe(true);
    expect(republicans.every((row) => row.qualifyingRoute === "republican_fringe_general")).toBe(true);
    expect(republicans.every((row) => row.scoreDrivers.slice(1, 4).every((driver) => driver.score === null))).toBe(true);
    expect(republicans.every((row) => row.scoreDrivers.some((driver) => driver.key === "state_primary_contestation"))).toBe(true);
    expect(republicans.filter((row) => row.scoreDrivers.find((driver) => driver.key === "state_primary_contestation")!.score !== null)).toHaveLength(40);
    expect(republicans.every((row) => row.formula.includes("coverage multiplier") && !row.formula.includes("0.70 ×"))).toBe(true);
    expect(republicans.filter((row) => row.incumbentCashOnHand !== null)).toHaveLength(217);
  });

  it("interleaves the strongest Republican-held flip seats with Democratic primary targets", () => {
    const rows = housePriorityBriefs();
    const arizona = rows.find((row) => row.districtLabel === "AZ-01")!, nebraska = rows.find((row) => row.districtLabel === "NE-02")!;
    expect(arizona.provisionalTargetScore).toBe(78.6);
    expect(nebraska.provisionalTargetScore).toBe(78.1);
    expect(arizona.rank).toBeLessThan(15);
    expect(rows.slice(0, 8).every((row) => row.incumbentParty === "Democratic")).toBe(true);
    const ohio = rows.find((row) => row.districtLabel === "OH-10")!;
    expect(ohio.scoreDrivers.find((driver) => driver.key === "state_primary_contestation")).toMatchObject({ score: 51, coverage: 1, inferred: false });
    expect(ohio.formula).toContain("85% of component weight available");
  });

  it("ranks deterministically and exposes competitive Republican-held districts", () => {
    const rows = housePriorityBriefs();
    expect(rows.map((row) => row.rank)).toEqual(rows.map((_, index) => index + 1));
    const fringe = rows.find((row) => row.seatCycleId === "seat_house_ca_22_current");
    expect(fringe).toMatchObject({ incumbentParty: "Republican", qualifyingRoute: "republican_fringe_general" });
    expect(fringe!.scoreDrivers[0]!.score).toBeGreaterThan(0);
  });

  it("uses the documented inverse-log cash scale across both parties", () => {
    expect(cashVulnerabilityScore(50_000)).toBe(100);
    expect(cashVulnerabilityScore(500_000)).toBe(50);
    expect(cashVulnerabilityScore(5_000_000)).toBe(0);
    const rows = housePriorityBriefs();
    expect(rows.filter((row) => row.incumbentCashOnHand !== null)).toHaveLength(427);
    expect(rows.every((row) => row.scoreDrivers.some((driver) => driver.key === "cash_vulnerability"))).toBe(true);
  });

  it("activates exact local context and direct primary evidence without changing unsupported seats", () => {
    const active = housePriorityBriefs();
    const previous = new Map(housePriorityBriefsV03().map((row) => [row.seatCycleId, row]));
    const changed = active.filter((row) => row.provisionalTargetScore !== previous.get(row.seatCycleId)?.provisionalTargetScore);

    // 21 Democratic scores change versus v0.3 (20 of the 21 v0.8 direct-primary activations moved a score, plus the RI-01 alias resolution); 216 Republican seats move off the removed cap.
    expect(changed).toHaveLength(237);
    expect(changed.filter((row) => row.incumbentParty === "Democratic")).toHaveLength(21);
    expect(active.find((row) => row.districtLabel === "AL-02")?.provisionalTargetScore).toBe(34.3);
    expect(active.find((row) => row.districtLabel === "ND-AL")?.provisionalTargetScore).toBe(18.7);
    expect(active.find((row) => row.districtLabel === "RI-01")?.provisionalTargetScore).toBe(55.9);
    expect(active.find((row) => row.districtLabel === "RI-01")?.scoreDrivers.find((driver) => driver.key === "primary_feasibility")).toMatchObject({ score: 0, coverage: 1, inferred: false });
    expect(active.filter((row) => row.scoreDrivers.some((driver) => driver.key === "primary_feasibility" && driver.inferred === false && driver.score !== null))).toHaveLength(22);
    expect(active.filter((row) => row.scoreDrivers.some((driver) => driver.key === "local_context")).map((row) => row.districtLabel).sort()).toEqual(["DE-AL", "ND-AL", "SD-AL", "WY-AL"]);
    expect(active.filter((row) => !changed.includes(row)).every((row) => row.provisionalTargetScore === previous.get(row.seatCycleId)?.provisionalTargetScore)).toBe(true);
  });
});
