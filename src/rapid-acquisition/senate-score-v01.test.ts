import { describe, expect, it } from "vitest";

import { buildSenateScoreV01Projection, readSenateScoreV01Projection } from "./senate-score-v01";

describe("Senate score v0.1", () => {
  const value = buildSenateScoreV01Projection();

  it("closes over 100 seats with every input joined where retained", () => {
    expect(value.summary).toMatchObject({ seats: 100, democraticCaucus: 47, republicanCaucus: 53, upIn2026: 35, cashValues: 98, alignmentValues: 47, stateContestationValues: 8 });
    expect(value.rows.filter((row) => row.incumbentParty === "Independent").map((row) => [row.stateCode, row.caucus])).toEqual([["ME", "Democratic"], ["VT", "Democratic"]]);
    expect(value.rows.filter((row) => row.caucus === "Democratic").every((row) => row.alignmentGap !== null && row.route === "democratic_incumbent_primary")).toBe(true);
    expect(value.rows.filter((row) => row.caucus === "Republican").every((row) => row.alignmentGap === null && row.route === "republican_fringe_general")).toBe(true);
    expect(value.rows.filter((row) => row.cashOnHand === null).map((row) => row.stateCode).sort()).toEqual(["OK", "SC"]);
  });

  it("derives the next election from the term end and the appointment flag", () => {
    const ohio = value.rows.find((row) => row.seatId === "seat_senate_oh_3_current")!;
    expect(ohio).toMatchObject({ appointed: true, nextElectionYear: 2026, termEnd: "2026-11-03" });
    expect(value.rows.filter((row) => row.senateClass === 2).every((row) => row.nextElectionYear === 2026)).toBe(true);
  });

  it("matches the pinned projection and reads back through the lock", () => {
    expect(readSenateScoreV01Projection().packageSha256).toBe(value.packageSha256);
  });
});
