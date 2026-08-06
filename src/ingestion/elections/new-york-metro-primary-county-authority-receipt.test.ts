import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildNewYorkMetroPrimaryCountyAuthorityReceipt,
  validateNewYorkMetroPrimaryCountyAuthorityReceipt,
  type NewYorkMetroPrimaryCountyAuthorityInput,
} from "./new-york-metro-primary-county-authority-receipt";

const sourceLock = () => JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8"));
const input = (): NewYorkMetroPrimaryCountyAuthorityInput => ({
  dispositionV2Json: readFileSync(resolve("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"), "utf8"),
  cd119Bytes: readFileSync(resolve("data/source/elections/primary-results/geography/new-york/current/36_NY_CD119.txt")),
  countyCodesBytes: readFileSync(resolve("data/source/elections/primary-results/geography/new-york/current/census-county-codes.html")),
  indexBytes: readFileSync(resolve("data/source/elections/primary-results/new-york/suffolk/2024/election-results-index.html")),
  resultBytes: readFileSync(resolve("data/source/elections/primary-results/new-york/suffolk/2024/cd01-democratic-final-results.html")),
  sourceLock: sourceLock(),
});

describe("New York metro primary county authority receipt", () => {
  it("retains one whole-district Suffolk final-result candidate without claiming signed certification", () => {
    const receipt = validateNewYorkMetroPrimaryCountyAuthorityReceipt(buildNewYorkMetroPrimaryCountyAuthorityReceipt(input()), input());
    expect(receipt.summary).toEqual({ targetUnresolvedSeatCycles: 18, acceptedSeatCycles: 1, reportedContestCandidates: 1, certifiedUncontestedCandidates: 0, unresolvedSeatCyclesPreserved: 17, candidateVotes: 27_636, scoreEligibleRows: 0 });
    expect(receipt.authorities).toEqual([expect.objectContaining({ seatCycleId: "ny:2024:us-house:01:democratic", districtCountyFips: ["103"], resultScope: "single_county_whole_district", supportedDisposition: "reported_contest", resultStatus: "county_board_final_results_candidate", certificationStatus: "signed_certification_not_separately_retained", electionDistrictsReported: 561, electionDistrictsTotal: 561, candidates: [{ sourceCandidateName: "John P Avlon", votes: 19_383 }, { sourceCandidateName: "Nancy S Goroff", votes: 8_253 }], sourceWinnerStatus: "not_marked_by_source", scoreEligible: false })]);
  });

  it("derives exact Suffolk-only district coverage from the retained CD119 block file", () => {
    const row = buildNewYorkMetroPrimaryCountyAuthorityReceipt(input()).authorities[0]!;
    expect(row.districtCountyFips).toEqual(["103"]);
    expect(row.countyCompleteness).toBe("all_geographic_counties_covered");
    expect(row.countyCompositionMethod).toBe("2020_census_block_geoid_county_fips_from_retained_cd119_assignment");
    expect(row.countyNameAuthoritySourceLockId).toBe("census-new-york-county-codes-20260806");
  });

  it("rejects result drift, incomplete reporting, and a multi-county reinterpretation", () => {
    const drift = input(); drift.resultBytes = Buffer.from(drift.resultBytes.toString().replace("19,383", "19,384"));
    expect(() => buildNewYorkMetroPrimaryCountyAuthorityReceipt(drift)).toThrow();
    const incomplete = input(); incomplete.resultBytes = Buffer.from(incomplete.resultBytes.toString().replace("100.00%", "99.00%"));
    expect(() => buildNewYorkMetroPrimaryCountyAuthorityReceipt(incomplete)).toThrow();
    const geography = input(); geography.cd119Bytes = Buffer.from(geography.cd119Bytes.toString().replace("36103", "36059"));
    expect(() => buildNewYorkMetroPrimaryCountyAuthorityReceipt(geography)).toThrow();
    const labels = input(); labels.countyCodesBytes = Buffer.from(labels.countyCodesBytes.toString().replace("Suffolk County", "Wrong County"));
    expect(() => buildNewYorkMetroPrimaryCountyAuthorityReceipt(labels)).toThrow();
  });

  it("keeps every lifecycle gate closed", () => {
    const receipt = buildNewYorkMetroPrimaryCountyAuthorityReceipt(input());
    expect(receipt.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null, resolution: null });
    expect(receipt.reviewerOnly).toBe(true);
    expect(receipt.publicationEligible).toBe(false);
    expect(receipt.authorities.every((row) => !row.scoreEligible && Object.values(row.evaluatorValues).every((value) => value === null))).toBe(true);
  });
});
