import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildTexasPrimaryGeographyCandidateV2, validateTexasPrimaryGeographyCandidateV2 } from "./texas-primary-geography-compatibility-candidate-v2";

const input = () => ({
  geographyV1Json: readFileSync("data/metadata/texas-primary-geography-compatibility-candidate-v1.json", "utf8"),
  crosswalkJson: readFileSync("data/metadata/texas-2026-primary-block-crosswalk-candidate-v1.json", "utf8"),
  currentStatusBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/texas-current-districts-status.html"),
  enrolledLawBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/hb4-enrolled.html"),
  datasetBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/planc2333-dataset.json"),
  planBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/PLANC2333.csv"),
  currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/current/48_TX_CD119.txt"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});
type MutablePackage = { methodology: Record<string, unknown>; rows: Array<Record<string, unknown>>; publicationEligible: boolean; review: Record<string, unknown> };

describe("Texas primary geography compatibility candidate v2", () => {
  it("replaces 26 collection-pending rows with evidence-backed split-review rows without creating candidates", () => {
    const value = buildTexasPrimaryGeographyCandidateV2(input());
    expect(value.summary).toEqual({ eventObservations: 78, regularEventObservations: 39, runoffEventObservations: 39, reportedContestObservations: 44, sourceUnobservedEventObservations: 34, cd118ToCd119PlanContinuityCandidates: 26, exactCd119SessionKeyCandidates: 26, cd120ExactBlockMembershipCandidates: 0, cd120CrosswalkReviewRequired: 26, compatibilityCandidates: 52, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    const historical = value.rows.filter((row) => row.cycleYear !== 2026), current = value.rows.filter((row) => row.cycleYear === 2026);
    expect(historical).toHaveLength(52);
    expect(historical.every((row) => row.planBlockCrosswalk === null && row.compatibilityCandidate)).toBe(true);
    expect(current).toHaveLength(26);
    expect(current.every((row) => row.compatibilityDisposition === "crosswalk_review_required" && row.evidenceClass === "derived_split_2020_block_crosswalk_review_required" && !row.compatibilityCandidate && row.planBlockCrosswalk !== null)).toBe(true);
    expect(value.rows.every((row) => !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible && row.resultDispositionPreserved)).toBe(true);
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/texas-primary-geography-compatibility-candidate-v2.json"));
  }, 30_000);

  it("rejects parent drift, threshold promotion, approval, scoring, publication, and fabricated review", () => {
    const parent = input(); parent.crosswalkJson += " "; expect(() => buildTexasPrimaryGeographyCandidateV2(parent)).toThrow("TX_PRIMARY_GEOGRAPHY_V2_INVALID");
    const currentInput = input(), base = buildTexasPrimaryGeographyCandidateV2(currentInput);
    const mutations: Array<(value: MutablePackage) => void> = [
      (value) => { value.methodology.overlapThresholdUsed = true; },
      (value) => { const row = value.rows.find((candidate) => candidate.cycleYear === 2026); if (!row) throw new Error("missing fixture row"); row.compatibilityCandidate = true; },
      (value) => { value.rows[0].compatibilityApproved = true; },
      (value) => { value.rows[0].scoreEligible = true; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.review.reviewer = "fabricated"; },
    ];
    for (const mutate of mutations) { const value = structuredClone(base) as unknown as MutablePackage; mutate(value); expect(() => validateTexasPrimaryGeographyCandidateV2(value as never, currentInput)).toThrow("TX_PRIMARY_GEOGRAPHY_V2_INVALID:semantic_or_hash_drift"); }
  }, 60_000);
});
