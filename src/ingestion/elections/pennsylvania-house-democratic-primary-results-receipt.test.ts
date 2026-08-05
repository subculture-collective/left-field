/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally alter stored JSON */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validatePennsylvaniaPrimaryResultsReceipt } from "./pennsylvania-house-democratic-primary-results-receipt";
const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/pennsylvania-house-democratic-primary-results-2022-2024-v1.json"), "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
describe("Pennsylvania Democratic House primary results receipt", () => {
  it("closes the retained statewide extracts without making them score eligible", () => {
    const value = validatePennsylvaniaPrimaryResultsReceipt(load());
    expect(value.summary).toEqual({ sourceRows2022: 353742, sourceRows2024: 368555, mechanicallyRepairedSourceRows2024: 35, acceptedPrecinctRows2022: 14088, acceptedPrecinctRows2024: 13285, contests: 31, contests2022: 14, contests2024: 17, candidateGroups: 48, candidateVotes: 2107473, unresolvedNoRowDistricts: 3, contestSetSha256: "82e392e32a1520bb58f74603f64ccb24af1edf89914554c4559a58f56dcc96b1", evaluatorNumericValues: 0, scoreEligibleContests: 0 });
    expect(value.contests.every((row) => !row.scoreEligible && row.winnerSourceCandidateNumber === null && Object.values(row.evaluatorValues).every((item) => item === null))).toBe(true);
  });
  it("keeps the three absent 2022 districts unresolved rather than zero", () => {
    const value = validatePennsylvaniaPrimaryResultsReceipt(load());
    expect(value.unresolvedDistricts).toEqual(["13", "14", "15"].map((districtCode) => ({ cycleYear: 2022, districtCode, disposition: "no_reported_democratic_us_house_rows_in_department_extract", numericUse: "unresolved_not_zero" })));
    expect(value.contests.filter((row) => row.cycleYear === 2024)).toHaveLength(17);
  });
  it("rejects a fully rehashed invented winner", () => {
    const value = load(), row = value.contests[0]; row.winnerSourceCandidateNumber = row.candidates[0].sourceCandidateNumber; const { contestSha256: _old, ...unsignedRow } = row; void _old; row.contestSha256 = digest("dsa-seats:pa-house-democratic-primary-result:v1\0", unsignedRow); value.summary.contestSetSha256 = digest("dsa-seats:pa-house-democratic-primary-result-set:v1\0", value.contests.map(({ contestId, contestSha256 }: any) => ({ contestId, contestSha256 }))); const { packageSha256: _package, ...unsigned } = value; void _package; value.packageSha256 = digest("dsa-seats:pa-house-democratic-primary-result-package:v1\0", unsigned); expect(() => validatePennsylvaniaPrimaryResultsReceipt(value)).toThrow();
  });
});
