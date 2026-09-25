import { describe, expect, it } from "vitest";

import { buildHouseIncumbentCandidacy, senateFilingMatch } from "./house-incumbent-candidacy";
import { buildHouseScoreV11ActiveProjection, readHouseScoreV11ActiveProjection } from "./house-score-v11-active";

const row = (candidateName: string) => ({ candidateId: "S6XX00001", candidateName, party: "DEM", electionYear: 2026, officeState: "XX", office: "S" as const, officeDistrict: "00", incumbentChallengerStatus: "O" as const, status: "C" as const, principalCommitteeId: null });

describe("house incumbent candidacy and v0.11 open seats", () => {
  it("gates Senate filings on last name plus a given-name token, initial, or unique last name", () => {
    const barry = { first: "Barry", middle: null, nickname: null, officialFull: "Barry Moore", last: "Moore" };
    expect(senateFilingMatch(row("MOORE, FELIX BARRY"), barry, false)).toBe("given_name_token");
    expect(senateFilingMatch(row("MOORE, JOHN"), barry, false)).toBeNull();
    const raja = { first: "Raja", middle: null, nickname: null, officialFull: "Raja Krishnamoorthi", last: "Krishnamoorthi" };
    expect(senateFilingMatch(row("KRISHNAMOORTHI, S"), raja, true)).toBe("unique_last_name_in_state");
    expect(senateFilingMatch(row("KRISHNAMOORTHI, S"), raja, false)).toBeNull();
    expect(senateFilingMatch(row("KRISHNAMOORTHI, R"), raja, false)).toBe("given_name_initial");
  });

  it("finds sixteen House incumbents filed for the 2026 Senate and nothing else", () => {
    const value = buildHouseIncumbentCandidacy();
    expect(value.summary).toMatchObject({ seats: 430, filedForSenate: 16, noHouseRow: 0 });
    expect(value.rows.filter((r) => r.openSeatSignal).map((r) => r.districtLabel).sort()).toEqual(["AL-01", "GA-01", "IL-02", "IL-08", "KY-06", "LA-05", "MA-06", "MI-11", "MN-02", "NH-01", "OK-01", "SC-05", "SC-07", "TX-30", "TX-38", "WY-AL"]);
  });

  it("omits incumbent components on open seats and leaves every other seat unchanged", () => {
    const value = buildHouseScoreV11ActiveProjection();
    expect(value.summary).toMatchObject({ seats: 430, openSeats: 16, democraticOpenSeats: 7, republicanOpenSeats: 9, changedSeats: 16, unchangedSeats: 414 });
    expect(value.rows.filter((r) => r.openSeatSignal === null).every((r) => r.movementFromV10 === 0 && r.omittedComponents.length === 0)).toBe(true);
    expect(value.rows.filter((r) => r.openSeatSignal && r.incumbentParty === "Democratic").every((r) => r.omittedComponents.join() === "incumbent_alignment_gap,cash_vulnerability")).toBe(true);
    expect(readHouseScoreV11ActiveProjection().packageSha256).toBe(value.packageSha256);
  });
});
