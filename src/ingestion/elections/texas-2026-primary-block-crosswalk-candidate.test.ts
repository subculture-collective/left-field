import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildTexas2026PrimaryBlockCrosswalkCandidate, validateTexas2026PrimaryBlockCrosswalkCandidate } from "./texas-2026-primary-block-crosswalk-candidate";

const input = () => ({
  geographyJson: readFileSync("data/metadata/texas-primary-geography-compatibility-candidate-v1.json", "utf8"),
  currentStatusBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/texas-current-districts-status.html"),
  enrolledLawBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/hb4-enrolled.html"),
  datasetBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/planc2333-dataset.json"),
  planBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/2026/PLANC2333.csv"),
  currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/texas/current/48_TX_CD119.txt"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});
type MutableCandidate = { rows: Array<Record<string, unknown>>; methodology: Record<string, unknown>; publicationEligible: boolean; [key: string]: unknown };

describe("Texas 2026 primary block crosswalk candidate", () => {
  it("binds 26 event observations and retains every split relationship for review", () => {
    const value = buildTexas2026PrimaryBlockCrosswalkCandidate(input());
    expect(value.summary).toEqual({ targetObservations: 26, uniqueSourceDistricts: 13, exactBlockMembershipCandidates: 0, crosswalkReviewRequired: 26, sourceBlocks: 668757, targetBlocks: 668757, sharedBlocks: 668757, changedDistrictAssignments: 192131, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.map((row) => row.observationId)).toEqual([...value.rows.map((row) => row.observationId)].sort());
    expect(value.rows.filter((row) => row.electionStage === "regular")).toHaveLength(13);
    expect(value.rows.filter((row) => row.electionStage === "runoff")).toHaveLength(13);
    expect(value.rows.every((row) => row.compatibilityDisposition === "crosswalk_review_required" && !row.compatibilityCandidate && !row.compatibilityApproved && !row.scoreEligible)).toBe(true);
    expect(value.rows.every((row) => row.sourceToTargetSplits.reduce((sum, split) => sum + split.blockCount, 0) === row.sourceBlockCount && row.sourceToTargetSplits.reduce((sum, split) => sum + split.sourceSharePpm, 0) === 1_000_000)).toBe(true);
    expect(value.rows.find((row) => row.observationId === "tx:geography:2026:regular:07")).toMatchObject({ sourceBlockCount: 7070, sameDistrictBlockCount: 4913, sourceObservationStatus: "reported_contest" });
    expect(value.rows.find((row) => row.observationId === "tx:geography:2026:runoff:07")).toMatchObject({ sourceBlockCount: 7070, sameDistrictBlockCount: 4913, sourceObservationStatus: "not_observed_in_retained_official_canvass_report_disposition_unresolved", sourceContestId: null });
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/texas-2026-primary-block-crosswalk-candidate-v1.json"));
  });

  it("rejects parent, authority, block, and source-lock drift", () => {
    for (const mutate of [
      (value: ReturnType<typeof input>) => { value.geographyJson += " "; },
      (value: ReturnType<typeof input>) => { value.currentStatusBytes = Buffer.concat([value.currentStatusBytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.planBlocksBytes = Buffer.concat([value.planBlocksBytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.currentBlocksBytes = Buffer.concat([value.currentBlocksBytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.sourceLock.entries.find((row: { id: string }) => row.id === "tx-planc2333-block-equivalency-extract-20260806").parentIds = []; },
    ]) { const value = input(); mutate(value); expect(() => buildTexas2026PrimaryBlockCrosswalkCandidate(value)).toThrow("TX_2026_PRIMARY_BLOCK_CROSSWALK_INVALID"); }
  });

  it("rejects threshold promotion, approval, scoring, publication, event collapse, and unknown fields", () => {
    const currentInput = input();
    const mutations: Array<(value: MutableCandidate) => void> = [
      (value) => { value.rows[0].compatibilityDisposition = "exact_block_membership_candidate"; value.rows[0].compatibilityCandidate = true; },
      (value) => { value.methodology.overlapThresholdUsed = true; },
      (value) => { value.methodology.blockCountsArePopulationWeighted = true; },
      (value) => { value.rows[0].compatibilityApproved = true; },
      (value) => { value.rows[0].scoreEligible = true; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.rows[0].electionStage = "runoff"; },
      (value) => { value.unexpected = true; },
    ];
    for (const mutate of mutations) { const value = structuredClone(buildTexas2026PrimaryBlockCrosswalkCandidate(currentInput)) as unknown as MutableCandidate; mutate(value); expect(() => validateTexas2026PrimaryBlockCrosswalkCandidate(value as never, currentInput)).toThrow("TX_2026_PRIMARY_BLOCK_CROSSWALK_INVALID:semantic_or_hash_drift"); }
  }, 120_000);
});
