import { describe, expect, it } from "vitest";

import { buildHousePrimaryIncumbentEvidence, validateHousePrimaryIncumbentEvidence } from "./house-primary-incumbent-evidence";

describe("2024 current-incumbent primary evidence", () => {
  it("closes 21 score-eligible identities and preserves the RI-01 ambiguity", () => {
    const value = buildHousePrimaryIncumbentEvidence();
    expect(value.summary).toEqual({ observations: 22, exactIdentityLinks: 19, derivedIdentityLinks: 2, unresolvedIdentityRows: 1, formulaEligibleRows: 21, linkedCandidateVotes: 1_141_209, eligibleContestVotes: 1_320_426, winnerInferences: 0 });
    expect(value.rows.find((row) => row.districtLabel === "AL-02")).toMatchObject({ incumbentVotes: 24_979, contestVotes: 57_518, primaryVulnerability: 56.6, identityStatus: "exact_name_observation", formulaEligible: true });
    expect(value.rows.find((row) => row.districtLabel === "MO-05")).toMatchObject({ identityStatus: "derived_name_relationship", identityMethod: "congress_legislators_suffix_matches_source", primaryVulnerability: 0, formulaEligible: true });
    expect(value.rows.find((row) => row.districtLabel === "RI-01")).toMatchObject({ identityStatus: "unresolved_no_retained_given_name_bridge", incumbentVotes: null, primaryVulnerability: null, formulaEligible: false });
    expect(value.rows.every((row) => ["not_marked_by_source", "marked_by_source"].includes(row.sourceWinnerStatus) && row.winnerInference === null && row.historicalGeographyStatus === "exact_cd119_session_and_district_key")).toBe(true);
    expect(validateHousePrimaryIncumbentEvidence(value)).toEqual(value);
  }, 180_000);

  it("rejects identity, geography, winner, and score escalation", () => {
    for (const [district, field, replacement] of [["RI-01", "formulaEligible", true], ["AL-02", "historicalGeographyStatus", "assumed"], ["AL-02", "winnerInference", "winner"], ["AL-02", "incumbentVotes", 0]] as const) {
      const value = structuredClone(buildHousePrimaryIncumbentEvidence()) as unknown as { rows: Record<string, unknown>[] };
      value.rows.find((row) => row.districtLabel === district)![field] = replacement;
      expect(() => validateHousePrimaryIncumbentEvidence(value)).toThrow("HOUSE_PRIMARY_INCUMBENT_EVIDENCE_INVALID");
    }
  }, 180_000);
});
