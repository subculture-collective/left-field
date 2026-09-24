import { describe, expect, it } from "vitest";

import { buildStatewidePresidential2024, parseClerkPresidentialElectors, readStatewidePresidential2024Pinned } from "./statewide-presidential-2024";

describe("statewide 2024 presidential result from the Clerk statistics", () => {
  it("parses a jurisdiction block and skips page furniture", () => {
    const text = ["", "        DELAWARE", "   FOR PRESIDENTIAL ELECTORS", "Republican ..... 214,351", "Democratic ..... 289,758", "Libertarian .... 2,038", "                14", "", "DELAWARE—Continued", "FOR UNITED STATES SENATOR", "Someone, Republican .... 1"].join("\n");
    expect(parseClerkPresidentialElectors(text)).toEqual([{ stateCode: "DE", stateName: "Delaware", republicanVotes: 214_351, democraticVotes: 289_758, otherVotes: 2_038, totalVotes: 506_147, democraticMarginPercentagePoints: 14.9 }]);
  });

  it("closes over 51 jurisdictions and matches the pinned package", () => {
    const value = buildStatewidePresidential2024();
    expect(value.summary).toEqual({ jurisdictions: 51, states: 50, democraticWins: 20, republicanWins: 31, totalVotes: 155_408_991 });
    expect(value.rows.find((row) => row.stateCode === "VT")?.democraticMarginPercentagePoints).toBe(31.21);
    expect(readStatewidePresidential2024Pinned().packageSha256).toBe(value.packageSha256);
  });
});
