import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  canonicalRapidHash,
  canonicalizeReportingUnitJoin,
  normalizeRapidDataset,
  reportingUnitJoinEligibility,
} from "./validate";
import type { RapidDatasetInput } from "./contracts";

type MutableFixture = Omit<RapidDatasetInput, "sourceLockSha256" | "sources" | "jurisdictions" | "contests" | "candidateResults" | "countyMetrics" | "officeCatalog"> & {
  sourceLockSha256: string;
  sources: Array<{ lockId: string; authority: string; parserVersion: string; retrievedAt: string }>;
  jurisdictions: Array<{ id: string; level: string; stateCode: string; countyFips?: string; sourceIdentifiers: Record<string, string> }>;
  contests: Array<{ id: string; sourceNaturalKey: string; authoritativeSourceLockId: string; jurisdictionId: string; sourceLockIds: string[]; electionDate: string; electionGeographyVintage: string; electionType: string; governmentLevel: string; officeFamily: string; sourceOfficeTitle: string; normalizedOfficeTitle: string; electionMethod: string; districtMagnitude: number; resultStatus: string }>;
  candidateResults: Array<{ contestId: string; sourceCandidateKey: string; sourceCandidateName: string; party: string | null; votes: number; winnerStatus: string; sourceLockIds: string[] }>;
  countyMetrics: Array<{ countyFips: string; metric: string; value: unknown; periodStart: string; periodEnd: string; reportingUnitDefinition: string; sourceLockIds: string[] }>;
  officeCatalog: Array<{ id: string; jurisdictionId: string; sourceLockIds: string[]; governmentLevel: string; officeFamily: string; sourceOfficeTitle: string; normalizedOfficeTitle: string; electionMethod: string; districtMagnitude: number; currentStatus: string; currentStatusConfidence: string; currentStatusSourceLockIds: string[]; formulaEligibility: string }>;
};

const source = {
  lockId: "mn-results-2024",
  authority: "official_direct" as const,
  parserVersion: "delimited-v1",
  retrievedAt: "2026-08-08T12:00:00.000Z",
};
const joinContext = { sourceLockIds: [source.lockId], expectedCountyFipsByState: { VT: { countyFips: ["50001", "50003"], evidenceSourceLockIds: [source.lockId] } } };
const sourceLockBytes = (ids: readonly string[] = [source.lockId]) => Buffer.from(JSON.stringify({ version: 1, entries: ids.map((id) => ({ id })) }));
const sourceLockHash = () => createHash("sha256").update(sourceLockBytes()).digest("hex");

const fixture = (): RapidDatasetInput => ({
  schema: "rapid-acquisition-v1" as const,
  version: 1 as const,
  sourceLockSha256: sourceLockHash(),
  sources: [{ ...source }],
  jurisdictions: [{
    id: "county:MN:27053",
    level: "county" as const,
    stateCode: "MN",
    countyFips: "27053",
    sourceIdentifiers: { census: "27053" },
  }],
  contests: [{
    id: "contest:mn:2024:house:02",
    sourceNaturalKey: "MN-2024-US-HOUSE-02",
    authoritativeSourceLockId: source.lockId,
    jurisdictionId: "county:MN:27053",
    sourceLockIds: [source.lockId],
    electionDate: "2024-11-05",
    electionGeographyVintage: "cd119",
    electionType: "general" as const,
    governmentLevel: "federal" as const,
    officeFamily: "legislature" as const,
    sourceOfficeTitle: "United States Representative District 2",
    normalizedOfficeTitle: "U.S. House",
    electionMethod: "partisan_plurality" as const,
    districtMagnitude: 1,
    resultStatus: "certified" as const,
  }],
  candidateResults: [{
    contestId: "contest:mn:2024:house:02",
    sourceCandidateKey: "candidate:smith",
    sourceCandidateName: "Alex Smith",
    party: "DEM",
    votes: 120,
    winnerStatus: "source_marked_winner" as const,
    sourceLockIds: [source.lockId],
  }],
  countyMetrics: [{
    countyFips: "27053",
    metric: "active_registration",
    value: { kind: "value" as const, value: 200 },
    periodStart: "2024-11-05",
    periodEnd: "2024-11-05",
    reportingUnitDefinition: "county-equivalent",
    sourceLockIds: [source.lockId],
  }],
  officeCatalog: [{
    id: "office:mn:county-attorney:27053",
    jurisdictionId: "county:MN:27053",
    sourceLockIds: [source.lockId],
    governmentLevel: "county" as const,
    officeFamily: "prosecutor" as const,
    sourceOfficeTitle: "County Attorney",
    normalizedOfficeTitle: "County Attorney",
    electionMethod: "partisan_plurality" as const,
    districtMagnitude: 1,
    currentStatus: "occupied" as const,
    currentStatusConfidence: "official_direct" as const,
    currentStatusSourceLockIds: [source.lockId],
    formulaEligibility: "eligible" as const,
  }],
});
const mutableFixture = (): MutableFixture => structuredClone(fixture()) as unknown as MutableFixture;
const validateFixture = (value: MutableFixture, lockBytes = sourceLockBytes()) => normalizeRapidDataset(value as unknown as RapidDatasetInput, lockBytes);

describe("rapid acquisition dataset", () => {
  it("normalizes a source-bound county dataset deterministically", () => {
    const one = normalizeRapidDataset(fixture(), sourceLockBytes());
    const reordered = mutableFixture();
    reordered.sources = [...reordered.sources].reverse();
    expect(one.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(one.datasetSha256).toBe(validateFixture(reordered).datasetSha256);
    expect(one.counts).toEqual({ jurisdictions: 1, contests: 1, candidateResults: 1, countyMetrics: 1, officeCatalog: 1 });
    expect(canonicalRapidHash(one)).toBe(one.datasetSha256);
  });

  it("binds to the actual source-lock bytes and canonicalizes nested source references", () => {
    const value = mutableFixture(), lockIds = [source.lockId, "mn-canvass-2024"];
    value.sources.push({ ...source, lockId: "mn-canvass-2024" });
    value.contests[0]!.sourceLockIds = ["mn-canvass-2024", source.lockId];
    value.candidateResults[0]!.sourceLockIds = ["mn-canvass-2024", source.lockId];
    value.countyMetrics[0]!.sourceLockIds = ["mn-canvass-2024", source.lockId];
    value.officeCatalog[0]!.sourceLockIds = ["mn-canvass-2024", source.lockId];
    value.officeCatalog[0]!.currentStatusSourceLockIds = ["mn-canvass-2024", source.lockId];
    const bytes = sourceLockBytes(lockIds);
    value.sourceLockSha256 = createHash("sha256").update(bytes).digest("hex");
    const reversed = structuredClone(value);
    reversed.contests[0]!.sourceLockIds.reverse();
    reversed.candidateResults[0]!.sourceLockIds.reverse();
    reversed.countyMetrics[0]!.sourceLockIds.reverse();
    reversed.officeCatalog[0]!.sourceLockIds.reverse();
    reversed.officeCatalog[0]!.currentStatusSourceLockIds.reverse();
    expect(validateFixture(value, bytes).datasetSha256).toBe(validateFixture(reversed, bytes).datasetSha256);
    expect(() => validateFixture(value, sourceLockBytes())).toThrow("RAPID_SOURCE_LOCK_MISMATCH");
  });

  it("rejects invalid FIPS, duplicate candidate result keys, and impossible votes", () => {
    const invalidFips = mutableFixture();
    invalidFips.jurisdictions[0]!.countyFips = "2705";
    expect(() => validateFixture(invalidFips)).toThrow("RAPID_INVALID_COUNTY_FIPS");

    const duplicate = mutableFixture();
    duplicate.candidateResults.push({ ...duplicate.candidateResults[0]! });
    expect(() => validateFixture(duplicate)).toThrow("RAPID_DUPLICATE_CANDIDATE_RESULT");

    const impossibleVotes = mutableFixture();
    impossibleVotes.candidateResults[0]!.votes = -1;
    expect(() => validateFixture(impossibleVotes)).toThrow("RAPID_INVALID_VOTES");

    const duplicateContest = mutableFixture();
    duplicateContest.contests.push({ ...duplicateContest.contests[0]!, id: "contest:duplicate" });
    expect(() => validateFixture(duplicateContest)).toThrow("RAPID_DUPLICATE_SOURCE_CONTEST");

    const sameNaturalKeyFromAnotherAuthority = mutableFixture(), otherLock = "mn-canvass-2024";
    sameNaturalKeyFromAnotherAuthority.sources.push({ ...source, lockId: otherLock });
    sameNaturalKeyFromAnotherAuthority.contests.push({ ...sameNaturalKeyFromAnotherAuthority.contests[0]!, id: "contest:other-authority", authoritativeSourceLockId: otherLock, sourceLockIds: [otherLock] });
    const twoSourceBytes = sourceLockBytes([source.lockId, otherLock]);
    sameNaturalKeyFromAnotherAuthority.sourceLockSha256 = createHash("sha256").update(twoSourceBytes).digest("hex");
    expect(validateFixture(sameNaturalKeyFromAnotherAuthority, twoSourceBytes).contests).toHaveLength(2);
  });

  it("rejects raw imports that have an unknown source or omit an election geography vintage", () => {
    const unknownSource = mutableFixture();
    unknownSource.contests[0].sourceLockIds = ["not-in-manifest"];
    expect(() => validateFixture(unknownSource)).toThrow("RAPID_UNKNOWN_SOURCE");

    const missingVintage = mutableFixture();
    missingVintage.contests[0].electionGeographyVintage = "";
    expect(() => validateFixture(missingVintage)).toThrow("RAPID_INVALID_CONTEST");
  });

  it("rejects invalid runtime enum values instead of trusting TypeScript declarations", () => {
    const invalidAuthority = mutableFixture();
    invalidAuthority.sources[0].authority = "unverified";
    expect(() => validateFixture(invalidAuthority)).toThrow("RAPID_INVALID_SOURCE");

    const invalidMethod = mutableFixture();
    invalidMethod.officeCatalog[0].electionMethod = "whatever";
    invalidMethod.officeCatalog[0].formulaEligibility = "catalog_only";
    expect(() => validateFixture(invalidMethod)).toThrow("RAPID_INVALID_OFFICE");
  });

  it("keeps missing metrics explicit and refuses malformed missingness", () => {
    const missing = mutableFixture();
    missing.countyMetrics[0]!.value = { kind: "missing", reason: "not_reported" };
    expect(validateFixture(missing).countyMetrics[0]!.value).toEqual({ kind: "missing", reason: "not_reported" });

    const malformed = mutableFixture();
    malformed.countyMetrics[0].value = { kind: "value", value: null };
    expect(() => validateFixture(malformed)).toThrow("RAPID_INVALID_METRIC_VALUE");
  });

  it("enforces documented metric units and bounds", () => {
    const shareAtBounds = mutableFixture();
    shareAtBounds.countyMetrics[0]!.metric = "renter_share";
    shareAtBounds.countyMetrics[0]!.value = { kind: "value", value: 1 };
    expect(validateFixture(shareAtBounds).countyMetrics[0]!.value).toEqual({ kind: "value", value: 1 });
    const shareAboveOne = mutableFixture();
    shareAboveOne.countyMetrics[0]!.metric = "renter_share";
    shareAboveOne.countyMetrics[0]!.value = { kind: "value", value: 1.0001 };
    expect(() => validateFixture(shareAboveOne)).toThrow("RAPID_METRIC_VALUE_OUT_OF_RANGE");
    const fractionalCount = mutableFixture();
    fractionalCount.countyMetrics[0]!.value = { kind: "value", value: 1.5 };
    expect(() => validateFixture(fractionalCount)).toThrow("RAPID_METRIC_VALUE_OUT_OF_RANGE");
    const negativeIncome = mutableFixture();
    negativeIncome.countyMetrics[0]!.metric = "median_household_income";
    negativeIncome.countyMetrics[0]!.value = { kind: "value", value: -1 };
    expect(() => validateFixture(negativeIncome)).toThrow("RAPID_METRIC_VALUE_OUT_OF_RANGE");
  });

  it("requires explicit ordered metric date ranges, including election-day and ACS windows", () => {
    const acs = mutableFixture();
    acs.countyMetrics[0]!.metric = "median_household_income";
    acs.countyMetrics[0]!.periodStart = "2020-01-01";
    acs.countyMetrics[0]!.periodEnd = "2024-12-31";
    expect(validateFixture(acs).countyMetrics[0]).toMatchObject({ periodStart: "2020-01-01", periodEnd: "2024-12-31" });
    expect(validateFixture(acs).datasetSha256).not.toBe(normalizeRapidDataset(fixture(), sourceLockBytes()).datasetSha256);
    const reversed = mutableFixture();
    reversed.countyMetrics[0]!.periodStart = "2024-12-31";
    reversed.countyMetrics[0]!.periodEnd = "2020-01-01";
    expect(() => validateFixture(reversed)).toThrow("RAPID_INVALID_COUNTY_METRIC");
  });

  it("rejects invalid metric/reporting/winner shapes and results on an uncollected contest", () => {
    const badMetric = mutableFixture();
    badMetric.countyMetrics[0]!.metric = "not-a-metric";
    expect(() => validateFixture(badMetric)).toThrow("RAPID_INVALID_COUNTY_METRIC");
    const badWinner = mutableFixture();
    badWinner.candidateResults[0]!.winnerStatus = "declared";
    expect(() => validateFixture(badWinner)).toThrow("RAPID_INVALID_CANDIDATE_RESULT");
    const uncollected = mutableFixture();
    uncollected.contests[0]!.resultStatus = "not_collected";
    expect(() => validateFixture(uncollected)).toThrow("RAPID_NOT_COLLECTED_CONTEST_HAS_CANDIDATES");
    const missingIdentifiers = mutableFixture();
    missingIdentifiers.jurisdictions[0]!.sourceIdentifiers = {};
    expect(() => validateFixture(missingIdentifiers)).toThrow("RAPID_INVALID_JURISDICTION");
  });
});

describe("rapid House joins and office eligibility", () => {
  it("allows only exact county or explicit same-vintage congressional reporting-unit joins", () => {
    expect(reportingUnitJoinEligibility({ kind: "county_wholly_in_house_district", countyFips: "27053", houseDistrict: "MN-02", resultGeographyVintage: "cd119", houseGeographyVintage: "cd119", evidenceSourceLockIds: [source.lockId] }, joinContext)).toEqual({ eligible: true, reason: null });
    expect(reportingUnitJoinEligibility({ kind: "reporting_unit_with_house_district", reportingUnitKey: "27053:001", houseDistrict: "MN-02", resultGeographyVintage: "cd119", houseGeographyVintage: "cd119", evidenceSourceLockIds: [source.lockId] }, joinContext)).toEqual({ eligible: true, reason: null });
    expect(reportingUnitJoinEligibility({ kind: "reporting_unit_with_house_district", reportingUnitKey: "27053:001", houseDistrict: "MN-02", resultGeographyVintage: "cd118", houseGeographyVintage: "cd119", evidenceSourceLockIds: [source.lockId] }, joinContext)).toEqual({ eligible: false, reason: "geography_vintage_mismatch" });
    expect(reportingUnitJoinEligibility({ kind: "split_county_without_house_district", countyFips: "27053" }, joinContext)).toEqual({ eligible: false, reason: "split_county_without_direct_assignment" });
    expect(reportingUnitJoinEligibility({ kind: "county_wholly_in_house_district", countyFips: "27053", houseDistrict: "MN-02", resultGeographyVintage: "cd118", houseGeographyVintage: "cd119", evidenceSourceLockIds: [source.lockId] }, joinContext)).toEqual({ eligible: false, reason: "geography_vintage_mismatch" });
    const completeVermont = { kind: "at_large_statewide" as const, stateCode: "VT", houseDistrict: "VT-AL", resultGeographyVintage: "cd119", houseGeographyVintage: "cd119", countyUniverse: { status: "closed" as const, countyFips: ["50003", "50001"], evidenceSourceLockIds: [source.lockId] } };
    expect(reportingUnitJoinEligibility(completeVermont, joinContext)).toEqual({ eligible: true, reason: null });
    expect(canonicalizeReportingUnitJoin(completeVermont)).toMatchObject({ countyUniverse: { countyFips: ["50001", "50003"] } });
    expect(reportingUnitJoinEligibility({ ...completeVermont, countyUniverse: { ...completeVermont.countyUniverse, countyFips: ["50001"] } }, joinContext)).toEqual({ eligible: false, reason: "split_county_without_direct_assignment" });
    expect(reportingUnitJoinEligibility({ ...completeVermont, countyUniverse: { ...completeVermont.countyUniverse, countyFips: ["50001", "50003", "50005"] } }, joinContext)).toEqual({ eligible: false, reason: "split_county_without_direct_assignment" });
    expect(reportingUnitJoinEligibility({ kind: "county_wholly_in_house_district", countyFips: "27053", houseDistrict: "MN-02", resultGeographyVintage: "cd119", houseGeographyVintage: "cd119", evidenceSourceLockIds: ["not-locked"] }, joinContext)).toEqual({ eligible: false, reason: "split_county_without_direct_assignment" });
    expect(reportingUnitJoinEligibility(completeVermont, { ...joinContext, expectedCountyFipsByState: { VT: { countyFips: ["50001", "50003"], evidenceSourceLockIds: ["not-locked"] } } })).toEqual({ eligible: false, reason: "split_county_without_direct_assignment" });
  });

  it("rejects score eligibility for incompatible election systems", () => {
    const incompatible = mutableFixture();
    incompatible.officeCatalog[0]!.electionMethod = "ranked_choice";
    incompatible.officeCatalog[0]!.formulaEligibility = "eligible";
    expect(() => validateFixture(incompatible)).toThrow("RAPID_FORMULA_ELIGIBILITY_INVALID");
  });

  it("requires direct locked current-status evidence for score-eligible offices", () => {
    const missingStatusSource = mutableFixture();
    missingStatusSource.officeCatalog[0]!.currentStatusSourceLockIds = [];
    expect(() => validateFixture(missingStatusSource)).toThrow("RAPID_CURRENT_STATUS_SOURCE_REQUIRED");
    const unknown = mutableFixture();
    unknown.officeCatalog[0]!.currentStatus = "unknown";
    expect(() => validateFixture(unknown)).toThrow("RAPID_FORMULA_ELIGIBILITY_INVALID");
  });
});
