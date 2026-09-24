import { describe, expect, it } from "vitest";

import { buildHousePrimaryIncumbentEvidenceV2, readHousePrimaryIncumbentEvidenceV2, validateHousePrimaryIncumbentEvidenceV2 } from "./house-primary-incumbent-evidence-v2";

describe("incumbent primary evidence v2 with reviewed aliases", () => {
  const value = buildHousePrimaryIncumbentEvidenceV2();

  it("resolves RI-01 through the reviewed alias and carries every other v1 row unchanged", () => {
    expect(value.summary).toEqual({ observations: 22, exactIdentityLinks: 19, derivedIdentityLinks: 2, reviewedAliasLinks: 1, unresolvedIdentityRows: 0, formulaEligibleRows: 22, linkedCandidateVotes: 1_167_905, eligibleContestVotes: 1_347_122, winnerInferences: 0 });
    const rhodeIsland = value.rows.find((row) => row.districtLabel === "RI-01")!;
    expect(rhodeIsland).toMatchObject({ identityStatus: "reviewed_alias_relationship", identityMethod: "reviewed_alias_table_given_name", aliasId: "alias:A000380:ri-01:gabriel-amo", formulaEligible: true, incumbentVotes: 26_696, incumbentVoteShare: 100, primaryVulnerability: 0, winnerInference: null });
    expect(value.rows.filter((row) => row.aliasId === null)).toHaveLength(21);
    expect(value.rows.every((row) => /^[a-f0-9]{64}$/.test(row.parentV1RowSha256))).toBe(true);
  });

  it("matches the retained artifact and rejects tampering", () => {
    expect(readHousePrimaryIncumbentEvidenceV2().packageSha256).toBe(value.packageSha256);
    const tampered = structuredClone(value) as unknown as { rows: { winnerInference: unknown }[] };
    tampered.rows[0]!.winnerInference = "someone";
    expect(() => validateHousePrimaryIncumbentEvidenceV2(tampered)).toThrow("HOUSE_PRIMARY_INCUMBENT_EVIDENCE_V2_INVALID");
  });
});
