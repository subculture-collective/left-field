import { describe, expect, it } from "vitest";

import { computeCanonicalDataChecksum, validatePrototypeManifest } from "./validate-manifest";
import { checksum, coherentManifest, lineage, provenance } from "@/test/fixtures/prototype-manifest";

function withChecksum<T extends { canonicalDataChecksumSha256: string }>(manifest: T): T {
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest as never);
  return manifest;
}


function expectIssue(input: ReturnType<typeof coherentManifest>, message: string, recompute = true) {
  if (recompute) withChecksum(input);
  const result = validatePrototypeManifest(input);
  expect(result.success).toBe(false);
  if (!result.success) expect(result.issues.some((issue) => issue.message === message)).toBe(true);
}

describe("validatePrototypeManifest", () => {
  it("accepts a generated coherent manifest with ten House profiles and Senate pairs", () => {
    const manifest = coherentManifest();
    expect(manifest.canonicalDataChecksumSha256).toBe(computeCanonicalDataChecksum(manifest as never));
    expect(validatePrototypeManifest(manifest).success).toBe(true);
  });

  it("canonicalizes set-like collections, provenance, and lineage independently of order", () => {
    const manifest = coherentManifest();
    manifest.contests[0].provenance.push({ snapshotId: "snap_1" as never, role: "derived_input" });
    manifest.contests[0].lineage.inputs.push({ snapshotId: "snap_1" as never, role: "derived_input" });
    const checksumBefore = computeCanonicalDataChecksum(manifest);
    manifest.sources.reverse();
    manifest.districtPlans.reverse();
    manifest.contests[0].provenance = [...manifest.contests[0].provenance].reverse();
    manifest.contests[0].lineage.inputs = [...manifest.contests[0].lineage.inputs].reverse();
    expect(computeCanonicalDataChecksum(manifest)).toBe(checksumBefore);
  });

  it("preserves profile seat order in the canonical checksum", () => {
    const manifest = coherentManifest();
    const checksumBefore = computeCanonicalDataChecksum(manifest);
    [manifest.profileSeatCycleIds[0], manifest.profileSeatCycleIds[1]] = [manifest.profileSeatCycleIds[1]!, manifest.profileSeatCycleIds[0]!];
    expect(computeCanonicalDataChecksum(manifest)).not.toBe(checksumBefore);
  });

  it("excludes release lifecycle fields and normalizes timestamp offsets", () => {
    const manifest = coherentManifest();
    const checksumBefore = computeCanonicalDataChecksum(manifest);
    manifest.release.status = "published";
    manifest.release.publishedAt = "2025-01-01T00:00:00.000Z";
    manifest.release.previousReleaseId = "previous" as never;
    expect(computeCanonicalDataChecksum(manifest)).toBe(checksumBefore);
    const offset = coherentManifest();
    offset.release.createdAt = "2024-01-01T01:00:00+01:00";
    const utc = coherentManifest();
    utc.release.createdAt = "2024-01-01T00:00:00.000Z";
    expect(computeCanonicalDataChecksum(offset)).toBe(computeCanonicalDataChecksum(utc));
  });

  it("requires ten unique House profile cycles, a Senate pair, and profile facts", () => {
    const short = coherentManifest(); short.profileSeatCycleIds.pop(); expectIssue(short, "Too small: expected array to have >=10 items");
    const duplicate = coherentManifest(); duplicate.profileSeatCycleIds[9] = duplicate.profileSeatCycleIds[0]; expectIssue(duplicate, "Profile seat-cycle IDs must be unique");
    const senate = coherentManifest(); senate.seatCycles.pop(); expectIssue(senate, "State AZ requires two distinct current Senate classes");
    const election = coherentManifest(); election.electionResults = election.electionResults.slice(1); expectIssue(election, "Profile requires one explicit 2024 presidential result");
    const acs = coherentManifest(); acs.acsObservations = acs.acsObservations.slice(1); expectIssue(acs, "Profile requires an ACS observation or explicit missing observation");
    const finance = coherentManifest(); finance.financeSummaries.pop(); expectIssue(finance, "Profile requires exactly one finance summary");
  });

  it("enforces deterministic address-selection geography and profile-term invariants", () => {
    const duplicateProfileGeography = coherentManifest(); duplicateProfileGeography.seatCycles[1].geographyVersionId = duplicateProfileGeography.seatCycles[0].geographyVersionId; expectIssue(duplicateProfileGeography, "Profile cycles must have unique House geographies");
    const nonCoveringProfileTerm = coherentManifest(); nonCoveringProfileTerm.officeTerms[0].endsAt = "2024-01-01"; expectIssue(nonCoveringProfileTerm, "Profile office term must cover the release source cutoff");
    const mixedProfileVintages = coherentManifest(); mixedProfileVintages.geographyVersions[0].vintage = "2023"; expectIssue(mixedProfileVintages, "Profile House geographies must share one nonempty vintage");
    const missingStateGeography = coherentManifest(); missingStateGeography.geographyVersions = missingStateGeography.geographyVersions.filter((geography) => geography.id !== "geo_state_1"); expectIssue(missingStateGeography, "State CA requires exactly one state geography at the product vintage");
    const duplicateStateGeography = coherentManifest(); duplicateStateGeography.geographyVersions.push({ ...duplicateStateGeography.geographyVersions[10], id: "geo_state_duplicate" } as never); expectIssue(duplicateStateGeography, "State CA requires exactly one state geography at the product vintage");
    const wrongVintageStateGeography = coherentManifest(); wrongVintageStateGeography.geographyVersions[10].vintage = "2023"; expectIssue(wrongVintageStateGeography, "State CA requires exactly one state geography at the product vintage");
  });

  it("selects exactly two cutoff-covering Senate candidates while allowing non-covering cycles", () => {
    const oneActive = coherentManifest(); oneActive.seatCycles = oneActive.seatCycles.filter((cycle) => cycle.id !== "seat_senate_1_2"); expectIssue(oneActive, "State CA requires two distinct current Senate classes");
    const threeActive = coherentManifest();
    threeActive.offices.push({ ...threeActive.offices[10], id: "office_senate_extra", senateClass: 3 } as never);
    threeActive.officeTerms.push({ ...threeActive.officeTerms[10], id: "term_senate_extra", officeId: "office_senate_extra" } as never);
    threeActive.seatCycles.push({ ...threeActive.seatCycles[10], id: "seat_senate_extra", officeId: "office_senate_extra", officeTermId: "term_senate_extra", cycleYear: 2025 } as never);
    expectIssue(threeActive, "State CA requires two distinct current Senate classes");
    const duplicateActive = coherentManifest(); duplicateActive.seatCycles.push({ ...duplicateActive.seatCycles[10], id: "seat_senate_duplicate", cycleYear: 2025 } as never); expectIssue(duplicateActive, "State CA requires two distinct current Senate classes");

    const nonCovering = coherentManifest();
    nonCovering.offices.push({ ...nonCovering.offices[10], id: "office_senate_historical", senateClass: 3 } as never);
    nonCovering.officeTerms.push({ ...nonCovering.officeTerms[10], id: "term_senate_historical", officeId: "office_senate_historical", startsAt: "2015-01-03", endsAt: "2017-01-03" } as never);
    nonCovering.seatCycles.push({ ...nonCovering.seatCycles[10], id: "seat_senate_historical", officeId: "office_senate_historical", officeTermId: "term_senate_historical", cycleYear: 2016, electionDate: "2016-11-08", occupancy: { status: "unknown", asOf: "2016-01-01" } } as never);
    nonCovering.officeTerms.push({ ...nonCovering.officeTerms[10], id: "term_senate_future", officeId: "office_senate_historical", startsAt: "2025-01-03", endsAt: "2027-01-03" } as never);
    nonCovering.seatCycles.push({ ...nonCovering.seatCycles[10], id: "seat_senate_future", officeId: "office_senate_historical", officeTermId: "term_senate_future", cycleYear: 2026, electionDate: "2026-11-03", occupancy: { status: "unknown", asOf: "2024-01-01" } } as never);
    expect(validatePrototypeManifest(withChecksum(nonCovering)).success).toBe(true);
  });

  it("validates relational identity, occupancy, and finance-summary references", () => {
    const nonHouse = coherentManifest(); nonHouse.profileSeatCycleIds[0] = "seat_senate_1_1" as never; expectIssue(nonHouse, "Profile must reference a House seat cycle");
    const bioguide = coherentManifest(); bioguide.people[0].bioguideId = "X1"; bioguide.people[1].bioguideId = "X1"; expectIssue(bioguide, "Duplicate Bioguide ID");
    const terms = coherentManifest(); terms.officeTerms.push({ ...terms.officeTerms[0], id: "term_overlap", endsAt: "2024-01-04" } as never); expectIssue(terms, "Overlapping office terms");
    const memberships = coherentManifest(); memberships.memberships.push({ id: "member_1", releaseId: "rel_1", provenance, officeTermId: "term_house_1", personId: "person_1", party: "democratic", startsAt: "2023-01-03", endsAt: "2024-01-03" } as never, { id: "member_2", releaseId: "rel_1", provenance, officeTermId: "term_house_1", personId: "person_2", party: "democratic", startsAt: "2023-06-01", endsAt: "2024-01-03" } as never); expectIssue(memberships, "Overlapping memberships");
    const occupancy = coherentManifest(); occupancy.seatCycles[0].occupancy.status = "occupied"; expectIssue(occupancy, "Occupied seat must have exactly one active membership");
    const postCutoff = coherentManifest(); postCutoff.seatCycles[0].occupancy.asOf = "2024-01-02"; expectIssue(postCutoff, "Occupancy date is after release source cutoff");
    const outsideOccupiedTerm = coherentManifest(); outsideOccupiedTerm.seatCycles[0].occupancy = { status: "vacant", asOf: "2025-01-03" }; expectIssue(outsideOccupiedTerm, "Occupancy date falls outside office term");
    const unknownOutsideTerm = coherentManifest(); unknownOutsideTerm.seatCycles[0].occupancy = { status: "unknown", asOf: "2023-01-02" }; expect(validatePrototypeManifest(withChecksum(unknownOutsideTerm)).success).toBe(true);
    const finance = coherentManifest(); finance.financeSummaries[0] = { kind: "value", releaseId: "rel_1", seatCycleId: "seat_house_1", filingId: "fec_missing" } as never; expectIssue(finance, "Unknown finance filing");
  });

  it("rejects value finance summaries that reference another cycle or a superseded filing", () => {
    const anotherCycle = coherentManifest(); anotherCycle.committees.push({ id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C1", name: "Committee", committeeType: "principal" } as never); anotherCycle.committeeRelationships.push({ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_2", relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never); anotherCycle.fecFilingSummaries.push({ id: "fec_1", releaseId: "rel_1", seatCycleId: "seat_house_2", committeeId: "committee_1", sourceFilingId: "F1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never); anotherCycle.financeSummaries[0] = { kind: "value", releaseId: "rel_1", seatCycleId: "seat_house_1", filingId: "fec_1" } as never; expectIssue(anotherCycle, "Finance summary must reference the canonical filing for its seat cycle");

    const superseded = coherentManifest(); superseded.committees.push({ id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C1", name: "Committee", committeeType: "principal" } as never); superseded.committeeRelationships.push({ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_1", relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never); superseded.fecFilingSummaries.push({ id: "fec_1", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "F1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "superseded", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never, { id: "fec_2", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "F2", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-02T00:00:00.000Z", amendmentNumber: 1, amendmentStatus: "amended", amendsFilingId: "fec_1", cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never); superseded.financeSummaries[0] = { kind: "value", releaseId: "rel_1", seatCycleId: "seat_house_1", filingId: "fec_1" } as never; expectIssue(superseded, "Finance summary must reference the canonical filing for its seat cycle");
  });

  it("validates FEC seat attribution and amendment scope, time, and status", () => {
    const wrongSeat = coherentManifest(); wrongSeat.committees.push({ id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C1", name: "Committee", committeeType: "principal" } as never); wrongSeat.committeeRelationships.push({ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_1", relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never); wrongSeat.fecFilingSummaries.push({ id: "fec_1", releaseId: "rel_1", seatCycleId: "seat_house_2", committeeId: "committee_1", sourceFilingId: "F1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never); expectIssue(wrongSeat, "Committee is not attributable to filing seat cycle");
    const amendment = coherentManifest(); amendment.committees.push({ id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C1", name: "Committee", committeeType: "principal" } as never); amendment.committeeRelationships.push({ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_1", relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never); amendment.fecFilingSummaries.push({ id: "fec_1", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "F1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-02T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never, { id: "fec_2", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "F2", reportType: "Q2", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 1, amendmentStatus: "amended", amendsFilingId: "fec_1", cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never); expectIssue(amendment, "Invalid amendment sequence or reporting scope"); expectIssue(amendment, "Amended predecessor must be superseded");
  });

  it("rejects independent FEC roots tied to one amendment sequence", () => {
    const duplicateRoots = coherentManifest();
    duplicateRoots.committees.push({ id: "committee_1", releaseId: "rel_1", provenance, sourceCommitteeId: "C1", name: "Committee", committeeType: "principal" } as never);
    duplicateRoots.committeeRelationships.push({ id: "committee_rel_1", releaseId: "rel_1", provenance, committeeId: "committee_1", candidacyId: "candidacy_1", relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never);
    duplicateRoots.fecFilingSummaries.push(
      { id: "fec_root_1", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "source_filing_1", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never,
      { id: "fec_root_2", releaseId: "rel_1", seatCycleId: "seat_house_1", committeeId: "committee_1", sourceFilingId: "source_filing_2", reportType: "Q1", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-02T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 1 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage } as never,
    );
    expectIssue(duplicateRoots, "Duplicate filing amendment sequence within reporting scope");
  });

  it("rejects incompatible election result totals and contest coherence", () => {
    const overflow = coherentManifest(); if (overflow.electionResults[0].votes.kind === "value") overflow.electionResults[0].votes.value = 2; expectIssue(overflow, "Result votes exceed contest denominator");
    const reconcile = coherentManifest(); if (reconcile.electionResults[0].votes.kind === "value") reconcile.electionResults[0].votes.value = 0; expectIssue(reconcile, "Complete contest results do not reconcile to denominator");
    const modeled = coherentManifest(); modeled.contests[0].certificationStatus = "modeled"; expectIssue(modeled, "Modeled contest requires modeled lineage and an allocation method");
    const certified = coherentManifest(); certified.contests[0].lineage = { ...lineage, status: "official" } as never; expectIssue(certified, "Certified contest requires certified lineage");
  });

  it("accepts explicit unavailable contests and rejects pseudo-modeled and invalid unavailable variants", () => {
    const unavailable = coherentManifest();
    unavailable.contests[0] = {
      ...unavailable.contests[0], certificationStatus: "unavailable", reportingCompletenessPercent: 0,
      denominatorVotes: { kind: "missing", reason: "not_defensibly_modeled" }, allocationMethod: "none",
      allocationCoveragePercent: { kind: "missing", reason: "not_applicable" }, lineage: { ...unavailable.contests[0].lineage, status: "reported" },
    };
    unavailable.electionResults[0] = { ...unavailable.electionResults[0], votes: { kind: "missing", reason: "not_defensibly_modeled" }, lineage: { ...unavailable.electionResults[0].lineage, status: "reported" } };
    expect(validatePrototypeManifest(withChecksum(unavailable)).success).toBe(true);

    const pseudoModeled = coherentManifest();
    pseudoModeled.contests[0] = {
      ...pseudoModeled.contests[0], certificationStatus: "modeled", reportingCompletenessPercent: 0,
      denominatorVotes: { kind: "missing", reason: "not_defensibly_modeled" }, allocationMethod: "other",
      allocationCoveragePercent: { kind: "missing", reason: "not_defensibly_modeled" }, lineage: { ...pseudoModeled.contests[0].lineage, status: "modeled" },
    };
    pseudoModeled.electionResults[0] = { ...pseudoModeled.electionResults[0], votes: { kind: "missing", reason: "not_defensibly_modeled" }, lineage: { ...pseudoModeled.electionResults[0].lineage, status: "modeled" } };
    expectIssue(pseudoModeled, "Modeled contest requires positive numeric allocation coverage");
    expectIssue(pseudoModeled, "Modeled contest requires at least one numeric result");

    const wrongCompleteness = structuredClone(unavailable); wrongCompleteness.contests[0].reportingCompletenessPercent = 1; expectIssue(wrongCompleteness, "Unavailable contest must use the explicit unavailable facts and results");
    const wrongAllocation = structuredClone(unavailable); wrongAllocation.contests[0].allocationMethod = "other"; expectIssue(wrongAllocation, "Unavailable contest must use the explicit unavailable facts and results");
    const numericResult = structuredClone(unavailable); numericResult.electionResults[0].votes = { kind: "value", value: 1 }; expectIssue(numericResult, "Unavailable contest must use the explicit unavailable facts and results");
  });

  it("rejects an otherwise valid manifest with a stale checksum", () => {
    const manifest = coherentManifest(); manifest.canonicalDataChecksumSha256 = checksum;
    expectIssue(manifest, "Canonical data checksum does not match manifest content", false);
  });
});
