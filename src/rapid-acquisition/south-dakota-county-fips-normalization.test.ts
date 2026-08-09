import { describe, expect, it } from "vitest";

import {
  buildSouthDakotaCountyFipsNormalization,
  validateSouthDakotaCountyFipsNormalization,
} from "./south-dakota-county-fips-normalization";

describe("South Dakota county FIPS normalization", () => {
  it("binds the official 46113 to 46102 change and all 18 affected House rows", () => {
    const value = buildSouthDakotaCountyFipsNormalization();
    expect(value.authority).toMatchObject({ oldCountyFips: "46113", newCountyFips: "46102", effectiveDate: "2015-05-01" });
    expect(value.summary).toEqual({ sourceRows: 18, normalizedCandidateRows: 2, candidateVotes: 3033, exactCurrentCountyKeysAdded: 1, formulaEligibleRows: 0 });
    expect(value.rows.map((row) => [row.candidateName, row.votes, row.sourceRowCount])).toEqual([
      ["DUSTY JOHNSON", 720, 9],
      ["SHERYL JOHNSON", 2313, 9],
    ]);
    expect(validateSouthDakotaCountyFipsNormalization(value)).toEqual(value);
  });

  it("rejects a normalized-key or lifecycle escalation", () => {
    const key = structuredClone(buildSouthDakotaCountyFipsNormalization()) as unknown as { rows: Array<{ currentCountyFips: string }> };
    key.rows[0]!.currentCountyFips = "46113";
    expect(() => validateSouthDakotaCountyFipsNormalization(key)).toThrow("SD_FIPS_NORMALIZATION_INVALID");

    const lifecycle = structuredClone(buildSouthDakotaCountyFipsNormalization()) as unknown as { rows: Array<{ formulaEligible: boolean }> };
    lifecycle.rows[0]!.formulaEligible = true;
    expect(() => validateSouthDakotaCountyFipsNormalization(lifecycle)).toThrow("SD_FIPS_NORMALIZATION_INVALID");
  });
});
