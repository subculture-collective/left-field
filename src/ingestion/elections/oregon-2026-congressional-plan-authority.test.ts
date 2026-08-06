import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildOregon2026CongressionalPlanAuthorityReceipt, validateOregon2026CongressionalPlanAuthorityReceipt } from "./oregon-2026-congressional-plan-authority";

const input = () => {
  const base = "data/source/elections/primary-results/geography/oregon/2026";
  return {
    redistrictingPageBytes: readFileSync(`${base}/redistricting.html`),
    enrolledBillBytes: readFileSync(`${base}/sb881-enrolled.pdf`),
    enrolledBillTextBytes: readFileSync(`${base}/sb881-enrolled.txt`),
    mapGuideBytes: readFileSync(`${base}/interactive-map-data.pdf`),
    mapGuideTextBytes: readFileSync(`${base}/interactive-map-data.txt`),
    currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/oregon/current/41_OR_CD119.txt"),
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  };
};

describe("Oregon 2026 congressional plan authority", () => {
  it("retains the adopted six-district plan, current LPRO use evidence, and complete CD119 block inventory", () => {
    const value = buildOregon2026CongressionalPlanAuthorityReceipt(input());
    expect(value.authority).toMatchObject({ planLaw: "Enrolled Senate Bill 881 (SB 881-A)", adoptedOn: "2021-09-27", congressionalDistricts: 6, currentLproLayerUsesAdoptedPlan: true, censusCd120ProductClaimed: false });
    expect(value.blockInventory).toMatchObject({ stateFips: "41", uniqueBlocks: 130807, districts: ["01", "02", "03", "04", "05", "06"], districtBlockCounts: { "01": 15034, "02": 50388, "03": 12862, "04": 24209, "05": 16434, "06": 11880 } });
    expect(value.methodology).toMatchObject({ censusBlockRole: "complete_census_cd119_block_membership_inventory", sourcePlanToCd119ExactBlockConcordanceAssessed: false, rawGeometryEqualityAssessed: false, districtNumberContinuityAloneUsed: false, courtInvalidationAssessment: "current_legislature_page_states_plan_upheld_no_separate_court_docket_search_retained" });
    expect(value.lifecycle).toEqual({ geographyCandidateCreated: false, automaticallyApprovedRows: 0, scoreEligibleRows: 0, publicationEligible: false, deployed: false });
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/oregon-2026-congressional-plan-authority-receipt-v1.json"));
  });

  it("rejects source bytes, lineage drift, CD120 invention, lifecycle escalation, and unknown fields", () => {
    const bytes = input(); bytes.mapGuideTextBytes = Buffer.concat([bytes.mapGuideTextBytes, Buffer.from(" ")]); expect(() => buildOregon2026CongressionalPlanAuthorityReceipt(bytes)).toThrow("OREGON_2026_PLAN_AUTHORITY_INVALID:input_bytes");
    const sourceLock = input(); sourceLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "oregon-sb881-enrolled-congressional-plan").parentIds = []; expect(() => buildOregon2026CongressionalPlanAuthorityReceipt(sourceLock)).toThrow("OREGON_2026_PLAN_AUTHORITY_INVALID");
    const outputLock = input(); outputLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "oregon-2026-congressional-plan-authority-receipt-v1").parentIds = []; expect(() => buildOregon2026CongressionalPlanAuthorityReceipt(outputLock)).toThrow("OREGON_2026_PLAN_AUTHORITY_INVALID");
    const currentInput = input();
    const base = buildOregon2026CongressionalPlanAuthorityReceipt(currentInput);
    type Mutable = { authority: Record<string, unknown>; lifecycle: Record<string, unknown>; [key: string]: unknown };
    const mutations: Array<(value: Mutable) => void> = [
      (value) => { value.authority.censusCd120ProductClaimed = true; },
      (value) => { value.lifecycle.geographyCandidateCreated = true; },
      (value) => { value.lifecycle.automaticallyApprovedRows = 6; },
      (value) => { value.lifecycle.scoreEligibleRows = 6; },
      (value) => { value.lifecycle.publicationEligible = true; },
      (value) => { value.lifecycle.deployed = true; },
      (value) => { value.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base) as unknown as Mutable;
      mutate(value);
      expect(() => validateOregon2026CongressionalPlanAuthorityReceipt(value as never, currentInput)).toThrow("OREGON_2026_PLAN_AUTHORITY_INVALID:semantic_or_hash_drift");
    }
  });
});
