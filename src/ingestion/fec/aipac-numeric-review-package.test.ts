/* eslint-disable @typescript-eslint/no-explicit-any -- mutation test intentionally rewrites fixed literal hashes */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { validateAipacNumericReviewPackage } from "./aipac-numeric-review-package";
const load = (): unknown => JSON.parse(readFileSync(resolve("data/metadata/aipac-numeric-review-package-v1.json"), "utf8"));
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
describe("AIPAC numeric review package", () => {
  it("provides eight exact conflicts and four release-level decisions under a nonpublication default", () => {
    const value = validateAipacNumericReviewPackage(load());
    expect(value.summary).toEqual({ totalDecisions: 12, mappingConflicts: 8, methodologyDecisions: 3, promotionDecisions: 1, safeDefault: "retain_reviewer_candidate_exclude_from_publication" });
    expect(value.decisions.filter((row) => row.component === "mapping_conflict")).toHaveLength(8);
    expect(value.decisions.every((row) => row.blocksPublication && !row.blocksOtherWork && row.resolution === null && row.reviewer === null && row.reviewedAt === null)).toBe(true);
  });
  it("rejects a fully rehashed altered recommendation", () => {
    const value = load() as any;
    const row = value.decisions[0]!, changed = { ...row, recommendedDecision: "altered" };
    const { decisionSha256: _old, ...unsignedDecision } = changed; void _old;
    changed.decisionSha256 = hash("dsa-seats:aipac-numeric-review-decision:v1\0", unsignedDecision);
    value.decisions[0] = changed;
    value.decisionSetSha256 = hash("dsa-seats:aipac-numeric-review-decision-set:v1\0", value.decisions);
    const { packageSha256: _package, ...unsigned } = value; void _package;
    value.packageSha256 = hash("dsa-seats:aipac-numeric-review-package:v1\0", unsigned);
    expect(() => validateAipacNumericReviewPackage(value)).toThrow();
  });
});
