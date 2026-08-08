import { describe, expect, it } from "vitest";

import { buildHousePrimaryCoverageLedgerV4, buildHousePrimaryProjectionV4, validateHousePrimaryProjectionV4 } from "./house-primary-projection-v4";

describe("rapid House-primary Kentucky composition", () => {
  it("advances only Kentucky 2024 and preserves all exclusion gates", () => {
    const value = buildHousePrimaryProjectionV4();
    expect(value.summary).toEqual({ stateCycles: 48, districtObservations: 78, reportedContests: 12, sourceAbsent: 1, processedDistricts: 13, candidateRows: 28, retainedCandidateVotes: 838171, scoreEligibleDistricts: 0 });
    expect(value.observations.filter((row) => row.parseStatus === "parsed")).toHaveLength(12);
    expect(value.observations.find((row) => row.observationId === "ky:primary:2024:03")).toMatchObject({ parseStatus: "parsed", candidateCount: 3, votes: 52641, sourceWinnerStatus: "not_marked_by_source", resultAuthorityStatus: "official_primary_result_pdf_retained_no_separate_certification_instrument" });
    expect(value.observations.find((row) => row.observationId === "ky:primary:2022:03")).toMatchObject({ parseStatus: "source_blocked", votes: null });
    expect(value.coverageRows.find((row) => row.stateCode === "KY" && row.cycleYear === 2024)).toMatchObject({ parsedDistrictCount: 1, status: "parsed" });
    expect(value.observations.every((row) => !row.scoreEligible && row.winner === null && row.identity === null)).toBe(true);
    expect(buildHousePrimaryCoverageLedgerV4(value).rows).toHaveLength(48);
    expect(validateHousePrimaryProjectionV4(value)).toEqual(value);
  });

  it.each([["scoreEligible", true], ["winner", "fabricated"], ["votes", 0], ["resultAuthorityStatus", "certified"]])("rejects coherent %s escalation", (field, replacement) => {
    const value = structuredClone(buildHousePrimaryProjectionV4()) as unknown as Record<string, unknown>;
    (value.observations as Record<string, unknown>[]).find((row) => row.observationId === "ky:primary:2024:03")![field] = replacement;
    value.packageSha256 = "0".repeat(64);
    expect(() => validateHousePrimaryProjectionV4(value)).toThrow("HOUSE_PRIMARY_PROJECTION_V4_INVALID");
  });
});
