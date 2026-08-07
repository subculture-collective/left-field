/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial immutable-receipt mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildMainePrimaryGeographyAuthoritySourceReceipt,
  validateMainePrimaryGeographyAuthoritySourceReceipt,
  type MainePrimaryGeographyAuthoritySourceReceiptInput,
} from "./maine-primary-geography-authority-source-receipt";

const file = (path: string) => readFileSync(resolve(path));
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
const stored = () => JSON.parse(file("data/metadata/maine-primary-geography-authority-source-receipt-v1.json").toString("utf8")) as any;
const rehash = (value: any) => { for (const row of value.cycleDispositionRows) { const unsigned = { ...row }; delete unsigned.rowSha256; row.rowSha256 = digest("dsa-seats:maine-primary-geography-authority-row:v1\0", unsigned); } value.cycleDispositionRowSetSha256 = digest("dsa-seats:maine-primary-geography-authority-row-set:v1\0", value.cycleDispositionRows); const unsigned = { ...value }; delete unsigned.packageSha256; value.packageSha256 = digest("dsa-seats:maine-primary-geography-authority-source-receipt:v1\0", unsigned); return value; };
const input = (): MainePrimaryGeographyAuthoritySourceReceiptInput => ({
  ld1739StatusBytes: file("data/source/elections/primary-results/geography/maine/authority/ld1739-status.html"),
  planLawPdfBytes: file("data/source/elections/primary-results/geography/maine/authority/pl-2021-c487-congressional-plan.pdf"),
  planLawTextBytes: file("data/source/elections/primary-results/geography/maine/authority/pl-2021-c487-congressional-plan.txt"),
  currentDistrictStatuteBytes: file("data/source/elections/primary-results/geography/maine/authority/mrsa-title21a-section1205-a.html"),
  reapportionmentStatuteBytes: file("data/source/elections/primary-results/geography/maine/authority/mrsa-title21a-section1206.html"),
  cd118MaineAssignmentsBytes: file("data/source/elections/primary-results/geography/maine/historical/23_ME_CD118.txt"),
  cd119MaineAssignmentsBytes: file("data/source/elections/primary-results/geography/maine/current/23_ME_CD119.txt"),
  censusPlanChangeAuthorityBytes: file("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
  tigerCd119ZipBytes: file("data/source/tiger2025/tl_2025_23_cd119.zip"),
  sourceLock: JSON.parse(file("data/source-lock.json").toString("utf8")),
});

describe("Maine primary geography authority source receipt", () => {
  it("binds enacted Maine authority and the complete matching CD118/CD119 assignments without treating it as an approval", () => {
    const receipt = validateMainePrimaryGeographyAuthoritySourceReceipt(buildMainePrimaryGeographyAuthoritySourceReceipt(input()));

    expect(receipt).toMatchObject({
      schema: "maine-primary-geography-authority-source-receipt-v1",
      reviewerOnly: true,
      publicationEligible: false,
      review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null },
      authority: {
        planLaw: "Maine Public Law 2021, chapter 487",
        enactedOn: "2021-09-29",
        appliesBeginning: 2022,
        currentDistrictStatute: "21-A MRSA §1205-A",
        reapportionmentStatute: "21-A MRSA §1206",
      },
      blockAssignments: {
        stateFips: "23",
        cd118Rows: 47_138,
        cd119Rows: 47_138,
        identicalNormalizedAssignments: true,
        districtCounts: { "01": 15_307, "02": 31_831 },
      },
      tigerCd119Inventory: { stateFips: "23", districts: ["01", "02"], districtCount: 2 },
      censusPlanChangeAuthority: { statesExplicitlyNamedAsRedrawn: ["AL", "GA", "LA", "NY", "NC"], maineExplicitlyExcluded: true },
      methodology: expect.objectContaining({
        rawGeometryEqualityAssessed: false,
        sourcePlanToCd119ExactBlockConcordanceAssessed: false,
        stateLawPlanContinuityAssessed: true,
        cd120CensusGeometryAssessed: false,
        automaticDecisionClosure: false,
        evaluatorNumericValues: 0,
      }),
      summary: { cycleRows: 6, cd118Cd119SupportableRows: 2, cd119SameSessionSupportableRows: 2, stateLawPlanContinuitySupportableRows: 2, compatibilityCandidateRows: 6, cd120CensusGeometryRows: 0, approvedRows: 0, scoreEligibleRows: 0 },
    });
    expect(receipt.cycleDispositionRows.map((row) => [row.cycleYear, row.districtCode, row.disposition, row.approved, row.scoreEligible])).toEqual([
      [2022, "01", "official_enacted_plan_and_identical_cd118_cd119_assignment_candidate", false, false],
      [2022, "02", "official_enacted_plan_and_identical_cd118_cd119_assignment_candidate", false, false],
      [2024, "01", "same_cd119_session_assignment_candidate", false, false],
      [2024, "02", "same_cd119_session_assignment_candidate", false, false],
      [2026, "01", "state_law_continuing_plan_candidate_without_cd120_census_geometry", false, false],
      [2026, "02", "state_law_continuing_plan_candidate_without_cd120_census_geometry", false, false],
    ]);
    expect(receipt.sources.map((entry) => entry.id)).toEqual([
      "maine-legislature-ld1739-status-20260807",
      "maine-pl-2021-c487-congressional-plan",
      "maine-pl-2021-c487-congressional-plan-text",
      "maine-mrsa-21a-1205a-congressional-districts-20260807",
      "maine-mrsa-21a-1206-reapportionment-20260807",
      "census-cd118-block-equivalency-bundle-20260806",
      "census-cd118-maine-block-equivalency-extract-20260807",
      "census-cd119-block-equivalency-bundle-20260805",
      "census-cd119-maine-block-equivalency-extract-20260807",
      "census-cd119-plan-change-authority-20260805",
      "tiger-cd119-23",
    ]);
  });

  it("rejects an authority text, assignment, Census-redraw-scope, or TIGER-inventory mutation", () => {
    const base = input();
    const plan = { ...base, planLawTextBytes: Buffer.from(base.planLawTextBytes.toString("utf8").replace("first occurring in 2022 and thereafter", "first occurring in 2024 and thereafter")) };
    expect(() => buildMainePrimaryGeographyAuthoritySourceReceipt(plan)).toThrow("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_INVALID");

    const assignmentsBase = input();
    const assignments = { ...assignmentsBase, cd119MaineAssignmentsBytes: Buffer.from(assignmentsBase.cd119MaineAssignmentsBytes.toString("utf8").replace("230010101001000,02", "230010101001000,01")) };
    expect(() => buildMainePrimaryGeographyAuthoritySourceReceipt(assignments)).toThrow("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_INVALID");

    const censusBase = input();
    const census = { ...censusBase, censusPlanChangeAuthorityBytes: Buffer.from(censusBase.censusPlanChangeAuthorityBytes.toString("utf8").replace("five states (Alabama, Georgia, Louisiana, New York, and North Carolina)", "five states (Alabama, Georgia, Louisiana, Maine, and North Carolina)")) };
    expect(() => buildMainePrimaryGeographyAuthoritySourceReceipt(census)).toThrow("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_INVALID");

    const tigerBase = input();
    const tiger = { ...tigerBase, tigerCd119ZipBytes: Buffer.from(tigerBase.tigerCd119ZipBytes.subarray(0, -1)) };
    expect(() => buildMainePrimaryGeographyAuthoritySourceReceipt(tiger)).toThrow("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_INVALID");
  });

  it("rejects coherent lifecycle, CD120, source, row-shape, and authority escalation", () => {
    for (const mutate of [
      (value: any) => { value.publicationEligible = true; },
      (value: any) => { value.review.reviewer = "fabricated"; value.review.resolution = "approved"; },
      (value: any) => { value.cycleDispositionRows[0].approved = true; },
      (value: any) => { value.cycleDispositionRows[0].scoreEligible = true; },
      (value: any) => { value.cycleDispositionRows[4].cd120CensusGeometryRetained = true; },
      (value: any) => { value.cycleDispositionRows[4].disposition = "exact_cd120_census_geometry"; },
      (value: any) => { value.cycleDispositionRows[0].rawGeometryEqualityAssessed = true; },
      (value: any) => { value.cycleDispositionRows[0].evaluatorValues.fabricatedScore = null; },
      (value: any) => { value.cycleDispositionRows[0].unknownField = null; },
      (value: any) => { value.authority.planStatus = "certified_cd120_geometry"; },
      (value: any) => { value.methodology.cycleTreatment = "assume_cd120_geometry"; },
      (value: any) => { value.sources[0].parentIds = ["fabricated-parent"]; },
      (value: any) => { value.unknownField = null; },
    ]) { const value = stored(); mutate(value); expect(() => validateMainePrimaryGeographyAuthoritySourceReceipt(rehash(value))).toThrow("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_INVALID"); }
  });

  it("rebuilds the canonical checked-in authority receipt exactly", () => {
    expect(validateMainePrimaryGeographyAuthoritySourceReceipt(buildMainePrimaryGeographyAuthoritySourceReceipt(input()))).toEqual(stored());
  });
});
