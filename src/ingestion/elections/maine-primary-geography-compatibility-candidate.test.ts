/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-candidate mutations */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildMainePrimaryGeographyCompatibilityCandidate,
  validateMainePrimaryGeographyCompatibilityCandidate,
} from "./maine-primary-geography-compatibility-candidate";

const input = () => ({
  proposalJson: readFileSync("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json", "utf8"),
  resultsReceiptJson: readFileSync("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json", "utf8"),
  identityCandidateJson: readFileSync("data/metadata/maine-current-incumbent-primary-linkage-candidate-v1.json", "utf8"),
  authorityReceiptJson: readFileSync("data/metadata/maine-primary-geography-authority-source-receipt-v1.json", "utf8"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});

describe("Maine primary geography compatibility candidate", () => {
  it("joins every identity observation to the authority row while retaining only candidate-level geography conclusions", () => {
    const value = validateMainePrimaryGeographyCompatibilityCandidate(buildMainePrimaryGeographyCompatibilityCandidate(input()), input());
    expect(value.summary).toEqual({ identityObservations: 6, geographyAuthorityObservations: 6, joinedRows: 6, cd118Cd119Candidates: 2, sameCd119SessionCandidates: 2, stateLawContinuingPlanCandidatesWithoutCd120Geometry: 2, compatibilityCandidates: 6, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    expect(value.rows.map((row) => [row.cycleYear, row.districtCode, row.historicalCongressSession, row.historicalGeoid, row.compatibilityDisposition, row.compatibilityCandidate])).toEqual([
      [2022, "01", "118", "2301", "official_enacted_plan_and_identical_cd118_cd119_assignment_candidate", true],
      [2022, "02", "118", "2302", "official_enacted_plan_and_identical_cd118_cd119_assignment_candidate", true],
      [2024, "01", "119", "2301", "same_cd119_session_assignment_candidate", true],
      [2024, "02", "119", "2302", "same_cd119_session_assignment_candidate", true],
      [2026, "01", "120", null, "state_law_continuing_plan_candidate_without_cd120_census_geometry", true],
      [2026, "02", "120", null, "state_law_continuing_plan_candidate_without_cd120_census_geometry", true],
    ]);
    const me02 = value.rows.find((row) => row.geographyObservationId === "me:geography:2026:02")!;
    expect(me02).toMatchObject({
      identityStatus: "current_incumbent_not_observed_in_source_candidate_set",
      sourceCandidateName: null,
      sourceWinnerStatus: "explicit_rcv_summary_winner",
      winnerSourceCandidateName: "Dunlap, Matthew G.",
      rcvFirstChoiceNamedCandidateDelta: 81,
      historicalGeoid: null,
      cd120CensusGeometryRetained: false,
      identityApproved: false,
      compatibilityApproved: false,
      scoreEligible: false,
    });
    expect(value.rows.every((row) => !row.identityApproved && !row.compatibilityApproved && !row.scoreEligible && Object.values(row.evaluatorValues).every((entry) => entry === null))).toBe(true);
    expect(value.parents).toMatchObject({
      proposal: { sourceLockId: "house-democratic-primary-source-selection-proposal-20260804-v1" },
      resultsReceipt: { sourceLockId: "maine-house-democratic-primary-results-2022-2026-v1" },
      identityCandidate: { sourceLockId: "maine-current-incumbent-primary-linkage-candidate-v1" },
      geographyAuthorityReceipt: { sourceLockId: "maine-primary-geography-authority-source-receipt-v1" },
    });
  });

  it("rejects parent lineage, source-lock, CD120, reviewer, approval, score, and rehash drift", () => {
    const parent = input(); parent.identityCandidateJson += " ";
    expect(() => buildMainePrimaryGeographyCompatibilityCandidate(parent)).toThrow("MAINE_PRIMARY_GEOGRAPHY_COMPATIBILITY_INVALID:INPUT_BYTES");
    const lock = input(); lock.sourceLock.entries.find((entry: { id: string }) => entry.id === "maine-primary-geography-authority-source-receipt-v1").parentIds = [];
    expect(() => buildMainePrimaryGeographyCompatibilityCandidate(lock)).toThrow("MAINE_PRIMARY_GEOGRAPHY_COMPATIBILITY_INVALID:SOURCE_LOCK");

    const baseInput = input(), base = buildMainePrimaryGeographyCompatibilityCandidate(baseInput);
    const mutations: Array<(value: any) => void> = [
      (value) => { value.rows[0].parentIdentityRowSha256 = "0".repeat(64); },
      (value) => { value.rows[4].historicalGeoid = "2301"; },
      (value) => { value.rows[5].cd120CensusGeometryRetained = true; },
      (value) => { value.rows[5].winnerSourceCandidateName = "Jared F. Golden"; },
      (value) => { value.rows[0].compatibilityApproved = true; },
      (value) => { value.rows[0].scoreEligible = true; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.review.reviewer = "fabricated"; },
      (value) => { value.rows[0].rowSha256 = "0".repeat(64); },
      (value) => { value.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base); mutate(value);
      expect(() => validateMainePrimaryGeographyCompatibilityCandidate(value, baseInput)).toThrow("MAINE_PRIMARY_GEOGRAPHY_COMPATIBILITY_INVALID:SEMANTIC_OR_HASH_DRIFT");
    }
  });
});
