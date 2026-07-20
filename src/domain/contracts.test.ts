import { describe, expect, it } from "vitest";
import { z } from "zod";

import { addressResolutionSchema } from "./address";
import { dataReleaseSchema, factValueSchema, sourceSchema, sourceSnapshotSchema } from "./contracts";
import { seatListItemSchema, seatProfileSchema, seatQuerySchema } from "./repository";

describe("seatQuerySchema", () => {
  it("accepts the supported identity, state, and party filters", () => {
    const result = seatQuerySchema.safeParse({
      identitySearch: "Rep. Example",
      chamber: "house",
      stateCode: "CA",
      party: "democratic",
      incumbencyStatus: "incumbent_running",
      electionYear: 2024,
      sort: "incumbent_name",
      direction: "desc",
    });

    expect(result).toMatchObject({ success: true });
  });

  it.each(["race", "ethnicity", "age", "income", "education", "religion"])(
    "rejects the unsupported demographic filter %s",
    (key) => {
      expect(seatQuerySchema.safeParse({ [key]: "value" }).success).toBe(false);
    },
  );

  it.each(["race", "ethnicity", "age", "income", "education", "religion"])(
    "rejects the unsupported demographic sort %s",
    (sort) => {
      expect(seatQuerySchema.safeParse({ sort }).success).toBe(false);
    },
  );

  it("rejects arbitrary unknown query keys", () => {
    expect(seatQuerySchema.safeParse({ madeUpFilter: true }).success).toBe(false);
  });
});

describe("addressResolutionSchema", () => {
  const geocoderContext = {
    releaseId: "rel_1",
    productVintage: "2024",
    geocoderBenchmark: { id: "Public_AR_Current", name: "Current benchmark" },
    geocoderVintage: { id: "Current_Current", name: "Current vintage" },
  };
  const oneCandidateContext = { ...geocoderContext, matchQuality: "single_candidate" as const };
  const matched = {
    ...oneCandidateContext, status: "matched" as const,
    houseSeat: { officeTermId: "term_house", seatCycleId: "seat_house", geographyVersionId: "geo_house" },
    senateSeats: [
      { senateClass: 1 as const, officeTermId: "term_senate_1", seatCycleId: "seat_senate_1" },
      { senateClass: 2 as const, officeTermId: "term_senate_2", seatCycleId: "seat_senate_2" },
    ],
  };

  it.each([
    matched,
    { ...geocoderContext, status: "ambiguous", matchQuality: "ambiguous", errorCode: "MULTIPLE_CANDIDATES" },
    { ...geocoderContext, status: "no_match", matchQuality: "none", errorCode: "ADDRESS_NOT_FOUND" },
    { ...oneCandidateContext, status: "vintage_mismatch", errorCode: "GEOGRAPHY_VINTAGE_MISMATCH" },
    { ...oneCandidateContext, status: "geography_ambiguous", errorCode: "GEOGRAPHY_AMBIGUOUS" },
    { ...oneCandidateContext, status: "unsupported_prototype_coverage", errorCode: "OUTSIDE_PROTOTYPE_COVERAGE" },
    { releaseId: "rel_1", productVintage: "2024", status: "disabled", errorCode: "LOOKUP_DISABLED" },
    { releaseId: "rel_1", productVintage: "2024", status: "rate_limited", errorCode: "RATE_LIMITED" },
    { releaseId: "rel_1", productVintage: "2024", status: "upstream_failure", errorCode: "GEOCODER_UNAVAILABLE" },
    { releaseId: "rel_1", productVintage: "2024", status: "resolver_failure", errorCode: "RELEASE_INVARIANT_FAILURE" },
  ])("accepts valid %s resolutions", (resolution) => {
    expect(addressResolutionSchema.safeParse(resolution).success).toBe(true);
  });

  it.each(["address", "normalizedAddress", "matchedAddress", "coordinates", "message"])("rejects forbidden %s metadata", (extraField) => {
    expect(addressResolutionSchema.safeParse({ ...matched, [extraField]: extraField === "coordinates" ? [1, 2] : "123 Main St" }).success).toBe(false);
  });

  it.each([
    [{ ...matched.senateSeats[0], officeTermId: "term_senate_2" }, matched.senateSeats[1]],
    [matched.senateSeats[0], { ...matched.senateSeats[1], seatCycleId: "seat_senate_1" }],
    [matched.senateSeats[1], matched.senateSeats[0]],
  ])("rejects duplicate or unordered Senate pairings", (senateSeats) => {
    expect(addressResolutionSchema.safeParse({ ...matched, senateSeats }).success).toBe(false);
  });
});

describe("factValueSchema", () => {
  const schema = factValueSchema(z.string());

  it.each([
    { kind: "value" },
    { kind: "missing" },
    { kind: "value", value: "reported", reason: "not_reported" },
    { kind: "missing", reason: "not_reported", value: "reported" },
  ])("rejects incomplete or contradictory fact-value shapes", (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("persisted schemas and runtime DTOs", () => {
  const release = { id: "rel_1", label: "Release", status: "published", sourceCutoff: "2024-01-01T00:00:00.000Z", createdAt: "2024-01-01T00:00:00.000Z", publishedAt: "2024-01-01T00:00:00.000Z", previousReleaseId: null };
  const source = { id: "src_1", releaseId: "rel_1", name: "Source", authority: "official", homepageUrl: "https://example.com" };
  const snapshot = { id: "snap_1", releaseId: "rel_1", sourceId: "src_1", sourceUrl: "https://example.com/data", publishedAt: null, retrievedAt: "2024-01-01T00:00:00.000Z", checksumSha256: "a".repeat(64), parserVersion: "1", license: "public", usageStatus: "approved" };

  it.each([
    [dataReleaseSchema, release], [sourceSchema, source], [sourceSnapshotSchema, snapshot],
  ])("rejects unknown fields in persisted records", (schema, record) => {
    expect(schema.safeParse({ ...record, unexpected: true }).success).toBe(false);
  });

  it("strictly validates the SeatListItem runtime DTO", () => {
    const item = {
      id: "seat_1", releaseId: "rel_1", chamber: "house", stateCode: "CA", districtCode: "01", label: "CA-01",
      incumbentName: null, incumbentParty: null, incumbencyStatus: "open", electionYear: 2024,
      presidentialMargin2024: { value: { kind: "value", value: 1 }, geographyVersionId: "geo_1", status: "certified", asOf: "2024-11-05", methodology: "reported", inputSnapshotIds: ["snap_1"] },
      cashOnHand: { kind: "value", value: 1, filingId: "fec_1", committeeId: "committee_1", coverageThrough: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", inputSnapshotIds: ["snap_1"] }, coverageLabel: "Reported",
    };
    expect(seatListItemSchema.safeParse(item).success).toBe(true);
    expect(seatListItemSchema.safeParse({ ...item, unexpected: true }).success).toBe(false);
    expect(seatListItemSchema.safeParse({ ...item, cashOnHand: { kind: "missing", reason: "not_reported", asOf: "2024-11-05", inputSnapshotIds: ["snap_1"] } }).success).toBe(true);
  });

  it("strictly validates the SeatProfile runtime DTO", () => {
    const provenance = [{ snapshotId: "snap_1", role: "original_publisher" }];
    const lineage = { inputs: provenance, asOf: "2024-11-05", methodology: "reported", status: "certified" };
    const office = { id: "office_1", releaseId: "rel_1", provenance, chamber: "house", kind: "house_voting", stateCode: "CA", districtCode: "01", senateClass: null };
    const term = { id: "term_1", releaseId: "rel_1", provenance, officeId: "office_1", startsAt: "2023-01-03", endsAt: "2025-01-03" };
    const cycle = { id: "seat_1", releaseId: "rel_1", provenance, officeId: "office_1", officeTermId: "term_1", geographyVersionId: "geo_1", cycleYear: 2024, electionDate: "2024-11-05", electionKind: "regular", incumbencyStatus: "open", occupancy: { status: "vacant", asOf: "2024-01-01" } };
    const geography = { id: "geo_1", releaseId: "rel_1", provenance, kind: "house_district", districtPlanId: "plan_1", geometryArtifactId: "artifact_1", sourceGeoid: "001", label: "CA-01", vintage: "2024", stateCode: "CA", districtCode: "01" };
    const contest = { id: "contest_1", releaseId: "rel_1", provenance, seatCycleId: "seat_1", kind: "house_general", round: "general", electionDate: "2024-11-05", geographyVersionId: "geo_1", certificationStatus: "certified", reportingCompletenessPercent: 100, denominatorVotes: { kind: "value", value: 1 }, reportingUnit: "district", allocationMethod: "none", allocationCoveragePercent: { kind: "value", value: 100 }, lineage };
    const candidacy = { id: "candidacy_1", releaseId: "rel_1", provenance, contestId: "contest_1", personId: "person_1", party: "democratic", status: "nominee" };
    const option = { id: "option_1", releaseId: "rel_1", provenance, contestId: "contest_1", candidacyId: "candidacy_1", label: "Candidate", party: "democratic", optionKind: "candidate" };
    const committee = { id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C00000001", name: "Committee", committeeType: "principal" };
    const profile = {
      release, office, seatCycle: cycle, geography, officeTerm: term, membership: null, incumbent: null,
      contests: [contest], candidacies: [candidacy], resultOptions: [option], biographicalFacts: [], memberCoverage: null,
      electionResults: [{ releaseId: "rel_1", contestId: "contest_1", resultOptionId: "option_1", votes: { kind: "value", value: 1 }, lineage }],
      demographics: [], finance: [{ id: "fec_1", releaseId: "rel_1", seatCycleId: "seat_1", committeeId: "committee_1", sourceFilingId: "F1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage }],
      committees: [committee], committeeRelationships: [{ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_1", relationship: "principal_campaign_committee", effectiveFrom: "2024-01-01", effectiveTo: null }], sources: [source], snapshots: [snapshot],
    };
    expect(seatProfileSchema.safeParse(profile).success).toBe(true);
    expect(seatProfileSchema.safeParse({ ...profile, unexpected: true }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, biographicalFacts: [{}] }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, memberCoverage: {} }).success).toBe(false);
    const acsCoverage = ["B01003_001E", "B01002_001E", "B19013_001E"].map((variable) => ({ releaseId: "rel_1", domain: "acs", scope: { kind: "acs_indicator" as const, variable, surveyPeriod: "2020-2024" }, status: "partial" as const, expectedCount: 441, observedCount: 437, missingByReason: [], quarantinedCount: 0, incompatibleCount: 4, inputSnapshotIds: ["snap_1"] }));
    expect(seatProfileSchema.parse({ ...profile, acsAvailability: { kind: "incompatible_geography" }, acsCoverage }).acsAvailability).toEqual({ kind: "incompatible_geography" });
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "incompatible_geography" }, acsCoverage: acsCoverage.slice(0, 2) }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "incompatible_geography" }, acsCoverage, demographics: [{ releaseId: "rel_1", geographyVersionId: "geo_1", variable: "B01003_001E", label: "Population", estimate: { kind: "value", value: 1 }, marginOfError: { kind: "value", value: 0 }, unit: "count", surveyPeriod: "2020-2024", universe: "total population", lineage }] }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "observations" }, acsCoverage }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "observations" } }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "no_observations" }, acsCoverage }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "incompatible_geography" }, acsCoverage: [{ ...acsCoverage[0]!, scope: { kind: "acs_indicator", variable: "B01003_001E", surveyPeriod: "2023" } }, ...acsCoverage.slice(1)] }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, acsAvailability: { kind: "incompatible_geography" }, acsCoverage: acsCoverage.map((coverage) => ({ ...coverage, inputSnapshotIds: ["snap_missing"] })) }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, snapshots: [] }).success).toBe(false);
    expect(seatProfileSchema.safeParse({ ...profile, sources: [] }).success).toBe(false);
    const financeCoverage = { releaseId: "rel_1", domain: "finance" as const, scope: { kind: "funding" as const, seatCycleId: "seat_1", fundingKind: "summary" as const }, status: "complete" as const, expectedCount: 1, observedCount: 1, missingByReason: [], quarantinedCount: 0, incompatibleCount: 0, inputSnapshotIds: ["snap_1"] };
    expect(seatProfileSchema.parse({ ...profile, financeCoverage }).financeCoverage).toEqual(financeCoverage);
    expect(seatProfileSchema.safeParse({ ...profile, financeCoverage: { ...financeCoverage, status: "not_collected", observedCount: 0, missingByReason: [{ reason: "not_collected", count: 1 }] } }).success).toBe(false);
  });
});
