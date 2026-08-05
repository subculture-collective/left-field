/* eslint-disable @typescript-eslint/no-explicit-any -- mutation test intentionally rewrites fixed literal hashes */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { validateAipacNumericReviewPackageV2 } from "./aipac-numeric-review-package-v2";
const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/aipac-numeric-review-package-v2.json"), "utf8"));
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
describe("AIPAC numeric review package v2", () => {
  it("reduces the live queue to six mappings and four release-level decisions", () => {
    const value = validateAipacNumericReviewPackageV2(load());
    expect(value.summary).toEqual({ totalDecisions: 10, mappingResolutions: 6, methodologyDecisions: 3, promotionDecisions: 1, automaticallyAcceptedRelationships: 1, automaticallyRejectedInvalidOrigins: 1, safeDefault: "retain_reviewer_candidate_exclude_from_publication" });
    expect(value.decisions.filter((row) => row.component === "mapping_resolution")).toHaveLength(6);
    expect(value.decisions.every((row) => row.blocksPublication && !row.blocksOtherWork && row.resolution === null && row.reviewer === null && row.reviewedAt === null)).toBe(true);
  });
  it("contains no obsolete challenger ambiguity decision", () => {
    const value = validateAipacNumericReviewPackageV2(load());
    expect(value.decisions.some((row) => row.decisionId.includes("challenger:seat_house_ca_47") || row.decisionId.includes("challenger:seat_house_il_07"))).toBe(false);
    expect(value.decisions.filter((row) => row.affectedSeatCycleId !== null).map((row) => row.affectedSeatCycleId)).toEqual(["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_nh_01_current", "seat_house_ny_04_current"]);
  });
  it("rejects a fully rehashed fabricated approval", () => {
    const value = load(), row = value.decisions[0]!, changed = { ...row, resolution: "approved", reviewer: "fabricated", reviewedAt: "2026-08-05T20:01:00.000Z" };
    const { decisionSha256: _old, ...unsignedDecision } = changed; void _old;
    changed.decisionSha256 = hash("dsa-seats:aipac-numeric-review-decision:v2\0", unsignedDecision);
    value.decisions[0] = changed;
    value.decisionSetSha256 = hash("dsa-seats:aipac-numeric-review-decision-set:v2\0", value.decisions);
    const { packageSha256: _package, ...unsigned } = value; void _package;
    value.packageSha256 = hash("dsa-seats:aipac-numeric-review-package:v2\0", unsigned);
    expect(() => validateAipacNumericReviewPackageV2(value)).toThrow();
  });
});
