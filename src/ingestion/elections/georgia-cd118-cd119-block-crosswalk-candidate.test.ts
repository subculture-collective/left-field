import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildGeorgiaCd118Cd119BlockCrosswalkCandidate,
  validateGeorgiaCd118Cd119BlockCrosswalkCandidate,
} from "./georgia-cd118-cd119-block-crosswalk-candidate";

const input = () => ({
  authorityBytes: readFileSync("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
  cd118Bytes: readFileSync("data/source/elections/primary-results/geography/georgia/historical/13_GA_CD118.txt"),
  cd119Bytes: readFileSync("data/source/elections/primary-results/geography/georgia/current/13_GA_CD119.txt"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});

describe("Georgia CD118 to CD119 block crosswalk candidate", () => {
  it("closes all fourteen districts and promotes only exact block memberships", () => {
    const value = buildGeorgiaCd118Cd119BlockCrosswalkCandidate(input());

    expect(value.summary).toEqual({
      sourceDistricts: 14,
      targetDistricts: 14,
      exactBlockMembershipCandidates: 5,
      crosswalkReviewRequired: 9,
      sourceBlocks: 232717,
      targetBlocks: 232717,
      sharedBlocks: 232717,
      changedDistrictAssignments: 34108,
      automaticallyApprovedRows: 0,
      scoreEligibleRows: 0,
    });
    expect(value.rows.filter((row) => row.compatibilityCandidate).map((row) => row.sourceDistrictCode)).toEqual(["01", "02", "03", "08", "12"]);
    expect(value.rows.find((row) => row.sourceDistrictCode === "04")).toMatchObject({ sourceBlockCount: 7267, targetSameNumberBlockCount: 5850, sameDistrictBlockCount: 3752, sourceRetentionPpm: 516307, targetCoveragePpm: 641368, compatibilityDisposition: "crosswalk_review_required" });
    expect(value.rows.find((row) => row.sourceDistrictCode === "07")).toMatchObject({ sourceBlockCount: 5187, sourceToTargetSplits: expect.arrayContaining([{ targetDistrictCode: "06", blockCount: 0, sourceSharePpm: 0 }]) });
    expect(value.rows.every((row) => !row.compatibilityApproved && !row.scoreEligible)).toBe(true);
    expect(value.rows.every((row) => row.sourceToTargetSplits.reduce((sum, split) => sum + split.blockCount, 0) === row.sourceBlockCount && row.sourceToTargetSplits.reduce((sum, split) => sum + split.sourceSharePpm, 0) === 1_000_000)).toBe(true);
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/georgia-cd118-cd119-block-crosswalk-candidate-v1.json"));
  });

  it("rejects source, lock, approval, scoring, weighting, and publication drift", () => {
    for (const mutate of [
      (value: ReturnType<typeof input>) => { value.authorityBytes = Buffer.concat([value.authorityBytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.cd118Bytes = Buffer.concat([value.cd118Bytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.cd119Bytes = Buffer.concat([value.cd119Bytes, Buffer.from(" ")]); },
      (value: ReturnType<typeof input>) => { value.sourceLock.entries.find((entry: { id: string }) => entry.id === "census-cd118-georgia-block-equivalency-extract-20260807").url = "urn:drift"; },
      (value: ReturnType<typeof input>) => { value.sourceLock.entries.find((entry: { id: string }) => entry.id === "census-cd119-georgia-block-equivalency-extract-20260807").parentIds = []; },
      (value: ReturnType<typeof input>) => { value.sourceLock.entries.find((entry: { id: string }) => entry.id === "georgia-cd118-cd119-block-crosswalk-candidate-v1").parentIds.reverse(); },
    ]) {
      const value = input();
      mutate(value);
      expect(() => buildGeorgiaCd118Cd119BlockCrosswalkCandidate(value)).toThrow("GA_CD118_CD119_BLOCK_CROSSWALK_INVALID");
    }

    type MutableCandidate = { rows: Array<Record<string, unknown>>; methodology: Record<string, unknown>; review: Record<string, unknown>; publicationEligible: boolean; [key: string]: unknown };
    const current = input();
    for (const mutate of [
      (value: MutableCandidate) => { value.rows.find((row) => row.sourceDistrictCode === "04")!.compatibilityCandidate = true; },
      (value: MutableCandidate) => { value.rows.find((row) => row.sourceDistrictCode === "07")!.sourceToTargetSplits = [{ targetDistrictCode: "06", blockCount: 5187, sourceSharePpm: 1_000_000 }]; },
      (value: MutableCandidate) => { value.rows[0]!.compatibilityApproved = true; },
      (value: MutableCandidate) => { value.rows[0]!.scoreEligible = true; },
      (value: MutableCandidate) => { value.methodology.overlapThresholdUsed = true; },
      (value: MutableCandidate) => { value.methodology.blockCountsArePopulationWeighted = true; },
      (value: MutableCandidate) => { value.publicationEligible = true; },
      (value: MutableCandidate) => { value.review.reviewer = "fabricated-reviewer"; },
      (value: MutableCandidate) => { value.unexpected = true; },
    ]) {
      const value = structuredClone(buildGeorgiaCd118Cd119BlockCrosswalkCandidate(current)) as unknown as MutableCandidate;
      mutate(value);
      expect(() => validateGeorgiaCd118Cd119BlockCrosswalkCandidate(value as never, current)).toThrow("GA_CD118_CD119_BLOCK_CROSSWALK_INVALID:semantic_or_hash_drift");
    }
  }, 30_000);
});
