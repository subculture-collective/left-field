/* eslint-disable @typescript-eslint/no-explicit-any -- mutation tests intentionally alter sealed artifacts */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { validateAipacNumericReviewPackageV3 } from "./aipac-numeric-review-package-v3";

const load = (): any => JSON.parse(readFileSync(resolve("data/metadata/aipac-numeric-review-package-v3.json"), "utf8"));
const digest = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");

describe("AIPAC numeric review package v3", () => {
  it("reduces the current queue to one precedence decision, three methodology choices, and promotion", () => {
    const value = validateAipacNumericReviewPackageV3(load());
    expect(value.summary).toEqual({ totalDecisions: 5, mappingPrecedenceDecisions: 1, methodologyDecisions: 3, promotionDecisions: 1, automaticallyResolvedIncumbentCases: 5, safeDefault: "retain_reviewer_candidate_exclude_from_publication" });
    expect(value.decisions.filter((row) => row.component === "candidate_committee_source_precedence")).toHaveLength(1);
    expect(value.decisions.filter((row) => row.component === "publication_promotion")).toHaveLength(1);
    expect(value.decisions.every((row) => row.resolution === null && row.reviewer === null && row.reviewedAt === null)).toBe(true);
  });

  it("keeps CA-31 2024 narrowly pending with its required terminal-chain evidence", () => {
    const value = validateAipacNumericReviewPackageV3(load());
    expect(value.decisions.find((row) => row.component === "candidate_committee_source_precedence")).toMatchObject({ decisionId: "aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174", affectedSeatCycleId: "seat_house_ca_31_current", affectedCycleYear: 2024, defaultReversibleAssumption: "exclude_only_ca31_2024_relationship", confidence: "high_but_insufficiently_closed", requiredEvidence: ["cutoff_bounded_terminal_form2_amendment_chain_receipt"] });
  });

  it("keeps the v0.1 weights and denominator explicit and requires a new version to change either", () => {
    const value = validateAipacNumericReviewPackageV3(load());
    const decision = value.decisions.find((row) => row.decisionId === "aipac-numeric:accept-v01-score-contract-v3");
    expect(decision?.question).toContain("60% AIPAC support, 25% blue baseline, 15% primary feasibility");
    expect(decision?.consequences.join(" ")).toContain("MA-06 and NH-01 AIPAC components null");
  });

  it("rejects a fully rehashed attempt to reintroduce a resolved mapping decision", () => {
    const value = load();
    value.decisions[0].component = "candidate_committee_source_precedence";
    value.decisions[0].affectedSeatCycleId = "seat_house_md_04_current";
    const { decisionSha256: _old, ...decisionUnsigned } = value.decisions[0];
    void _old;
    value.decisions[0].decisionSha256 = digest("dsa-seats:aipac-numeric-review-decision:v3\0", decisionUnsigned);
    value.decisions.sort((a: any, b: any) => Buffer.compare(Buffer.from(a.decisionId), Buffer.from(b.decisionId)));
    value.decisionSetSha256 = digest("dsa-seats:aipac-numeric-review-decision-set:v3\0", value.decisions);
    const { packageSha256: _package, ...unsigned } = value;
    void _package;
    value.packageSha256 = digest("dsa-seats:aipac-numeric-review-package:v3\0", unsigned);
    expect(() => validateAipacNumericReviewPackageV3(value)).toThrow();
  });
});
