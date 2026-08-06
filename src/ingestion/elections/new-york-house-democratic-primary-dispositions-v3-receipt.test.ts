import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { NewYorkMetroPrimaryCountyAuthorityReceipt } from "./new-york-metro-primary-county-authority-receipt";
import type { NewYorkPrimaryDispositionsV2Receipt } from "./new-york-house-democratic-primary-dispositions-v2-receipt";
import { buildNewYorkPrimaryDispositionsV3Receipt, validateNewYorkPrimaryDispositionsV3Receipt, type NewYorkPrimaryDispositionsV3Receipt } from "./new-york-house-democratic-primary-dispositions-v3-receipt";

const v2 = () => JSON.parse(readFileSync(resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"), "utf8")) as NewYorkPrimaryDispositionsV2Receipt;
const authority = () => JSON.parse(readFileSync(resolve("data/metadata/new-york-metro-house-democratic-primary-county-authority-receipt-v1.json"), "utf8")) as NewYorkMetroPrimaryCountyAuthorityReceipt;
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v3.json"), "utf8")) as NewYorkPrimaryDispositionsV3Receipt;

describe("New York Democratic House primary disposition matrix v3", () => {
  it("replaces only 2024 NY-01 with a county final-result candidate", () => {
    const receipt = validateNewYorkPrimaryDispositionsV3Receipt(buildNewYorkPrimaryDispositionsV3Receipt({ dispositionV2: v2(), countyAuthority: authority() }));
    expect(receipt.summary).toEqual(expect.objectContaining({ seatCycles: 52, reportedContests: 20, certifiedUncontested: 15, unresolved: 17, existingNycOverridesPreserved: 8, newCountyAuthorityOverrides: 1, reportedByCycle: { "2022": 15, "2024": 5 }, unresolvedByCycle: { "2022": 7, "2024": 10 }, evaluatorNumericValues: 0, scoreEligibleRows: 0 }));
    const row = receipt.rows.find((item) => item.seatCycleId === "ny:2024:us-house:01:democratic")!;
    expect(row).toEqual(expect.objectContaining({ disposition: "reported_contest", countyAuthority: expect.objectContaining({ authoritySeatCycleId: row.seatCycleId, resultStatus: "county_board_final_results_candidate", certificationStatus: "signed_certification_not_separately_retained", resultScope: "single_county_whole_district" }), voteValues: null, scoreEligible: false }));
  });

  it("preserves every v2 parent field and all eight NYC authority objects", () => {
    const parent = new Map(v2().rows.map((row) => [row.seatCycleId, row]));
    for (const row of stored().rows) {
      const prior = parent.get(row.seatCycleId)!;
      expect(row.dispositionV2ParentRowSha256).toBe(prior.rowSha256);
      expect(row.ballotCertificationSourceLockId).toBe(prior.ballotCertificationSourceLockId);
      expect(row.ballotCertificationPage).toBe(prior.ballotCertificationPage);
      expect(row.reportedContestId).toBe(prior.reportedContestId);
      expect(row.localAuthority).toEqual(prior.localAuthority);
      if (row.seatCycleId !== "ny:2024:us-house:01:democratic") expect(row.disposition).toBe(prior.disposition);
    }
    expect(stored().rows.filter((row) => row.localAuthority !== null)).toHaveLength(8);
  });

  it("rejects authority collapse or lifecycle promotion", () => {
    const collapsed = structuredClone(stored());
    const row = collapsed.rows.find((item) => item.countyAuthority !== null)!;
    (row as unknown as { reportedContestId: string }).reportedContestId = row.countyAuthority!.sourceContestId;
    expect(() => validateNewYorkPrimaryDispositionsV3Receipt(collapsed)).toThrow();
    const promoted = structuredClone(stored());
    (promoted.rows[0] as unknown as { scoreEligible: boolean }).scoreEligible = true;
    expect(() => validateNewYorkPrimaryDispositionsV3Receipt(promoted)).toThrow();
  });

  it("matches the checked-in canonical artifact byte-for-byte", () => {
    expect(buildNewYorkPrimaryDispositionsV3Receipt({ dispositionV2: v2(), countyAuthority: authority() })).toEqual(stored());
  });
});
