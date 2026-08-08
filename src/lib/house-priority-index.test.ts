import { describe, expect, it } from "vitest";
import { housePriorityBriefs } from "./house-priority-index";

describe("house priority index", () => {
  it("adds every retained Republican voting member through the capped fringe route", () => {
    const rows = housePriorityBriefs(), republicans = rows.filter((row) => row.incumbentParty === "Republican");
    expect(rows).toHaveLength(430);
    expect(republicans).toHaveLength(218);
    expect(Math.max(...republicans.map((row) => row.provisionalTargetScore))).toBeLessThanOrEqual(65);
    expect(republicans.every((row) => row.qualifyingRoute === "republican_fringe_general")).toBe(true);
    expect(republicans.every((row) => row.scoreDrivers.slice(1).every((driver) => driver.score === null))).toBe(true);
  });

  it("ranks deterministically and exposes competitive Republican-held districts", () => {
    const rows = housePriorityBriefs();
    expect(rows.map((row) => row.rank)).toEqual(rows.map((_, index) => index + 1));
    const fringe = rows.find((row) => row.seatCycleId === "seat_house_ca_22_current");
    expect(fringe).toMatchObject({ incumbentParty: "Republican", qualifyingRoute: "republican_fringe_general" });
    expect(fringe!.scoreDrivers[0]!.score).toBeGreaterThan(0);
  });
});
