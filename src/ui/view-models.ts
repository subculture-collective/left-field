import type { AcsObservation, Contest, DataRelease, ElectionResult, FecFilingSummary, ResultOption, Source, SourceSnapshot } from "@/domain/contracts";
import type { ReleaseCoverageAggregate, SeatListItem, SeatProfile, SeatQuery } from "@/domain/repository";

export type ReleaseViewModel = Readonly<Pick<DataRelease, "id" | "label" | "status" | "sourceCutoff" | "publishedAt">>;
export type BrowseRowViewModel = Readonly<SeatListItem>;
export type BrowsePageViewModel = Readonly<{
  release: ReleaseViewModel;
  disclosure: Readonly<{ coverage: string; rankings: string; demographicFilters: string }>;
  appliedQuery: Readonly<SeatQuery>;
  rows: readonly BrowseRowViewModel[];
  total: number;
  nextCursor: string | null;
  available: Readonly<{ states: readonly string[]; parties: readonly string[]; incumbencyStatuses: readonly string[]; electionYears: readonly number[] }>;
}>;
export type ElectionContextViewModel = Readonly<Pick<Contest, "id" | "kind" | "round" | "electionDate" | "certificationStatus" | "reportingCompletenessPercent" | "reportingUnit" | "allocationMethod" | "allocationCoveragePercent" | "denominatorVotes" | "lineage">>;
export type ElectionResultRowViewModel = Readonly<Pick<ElectionResult, "contestId" | "resultOptionId" | "votes" | "lineage"> & Pick<Contest, "kind" | "round" | "electionDate" | "certificationStatus" | "reportingCompletenessPercent" | "reportingUnit" | "allocationMethod" | "allocationCoveragePercent" | "denominatorVotes"> & Pick<ResultOption, "candidacyId" | "label" | "party" | "optionKind" | "provenance"> & { candidacyParty: string | null }>;
export type AcsObservationViewModel = Readonly<Pick<AcsObservation, "variable" | "label" | "estimate" | "marginOfError" | "unit" | "surveyPeriod" | "universe" | "lineage">>;
export type FinanceSummaryViewModel = Readonly<Pick<FecFilingSummary, "id" | "committeeId" | "reportType" | "reportingPeriodStart" | "reportingPeriodEnd" | "filedAt" | "amendmentNumber" | "amendmentStatus" | "amendsFilingId" | "cashOnHand" | "totalReceipts" | "totalDisbursements" | "lineage">>;
export type FinanceAggregateViewModel = Readonly<Pick<SeatProfile["financeAggregates"][number], "id" | "asOf" | "coverageThrough" | "cashOnHand" | "receipts" | "disbursements" | "methodologyVersion" | "committeeInputs"> & { includedCommitteeCount: number; missingCommitteeCount: number }>;
export type PublishedEvidenceViewModel = Readonly<{ id: string; sourceUrl: string; sourceName: string; retrievedAt: string }>;
export type ElectionEvidenceViewModel = PublishedEvidenceViewModel;
export type ElectionDecisionViewModel = Readonly<Pick<SeatProfile["electionDecisions"][number], "jurisdictionCode" | "electionYear" | "status" | "inputSnapshotIds"> & {
  coverage: SeatProfile["electionCoverage"][number] | null;
  evidence: readonly ElectionEvidenceViewModel[];
}>;
export type FinanceAvailabilityViewModel = Readonly<NonNullable<SeatProfile["financeCoverage"]>> & Readonly<{ evidence: readonly PublishedEvidenceViewModel[] }>;
export type BiographyViewModel = Readonly<{ bioguideId: SeatProfile["biographicalFacts"][number]["value"] | null; birthDate: SeatProfile["biographicalFacts"][number]["value"] | null; facts: SeatProfile["biographicalFacts"]; memberCoverage: SeatProfile["memberCoverage"]; committeeAssignmentsNote: string }>;
export type ProfilePageViewModel = Readonly<{
  release: ReleaseViewModel;
  identity: Readonly<{ id: string; chamber: string; stateCode: string; districtCode: string | null; geographyLabel: string; geographyVintage: string; currentHolder: string | null; currentHolderParty: string | null; occupancyStatus: string; occupancyAsOf: string; incumbencyStatus: string; officeKind: "house_voting" | "house_delegate" | "resident_commissioner" | "senate"; jurisdictionPolicy: Readonly<{ senateRepresentation: "two_seats" | "none"; source: "persisted" | "legacy_fallback" }> }>;
  map: SeatProfile["map"];
  headlineFacts: Readonly<Pick<SeatListItem, "presidentialMargin2024" | "cashOnHand">>;
  elections: readonly ElectionContextViewModel[];
  electionDecisions: readonly ElectionDecisionViewModel[];
  electionResults: readonly ElectionResultRowViewModel[];
  demographics: readonly AcsObservationViewModel[];
  acsAvailability: SeatProfile["acsAvailability"];
  financeAvailability: FinanceAvailabilityViewModel | null;
  financeAggregates: readonly FinanceAggregateViewModel[];
  fundingCategoryAggregates: SeatProfile["fundingCategoryAggregates"];
  fundingOrganizationAggregates: SeatProfile["fundingOrganizationAggregates"];
  outsideSpendingAggregates: SeatProfile["outsideSpendingAggregates"];
  committeeAssignments: readonly Readonly<{ committeeId: string; committeeName: string; role: string; effectiveFrom: string; effectiveTo: string | null; inputSnapshotIds: readonly string[] }>[];
  finance: readonly FinanceSummaryViewModel[];
  biography: BiographyViewModel;
  sourceClosure: Readonly<{ sources: readonly Source[]; snapshots: readonly SourceSnapshot[] }>;
}>;
export type SourcesPageViewModel = Readonly<{ release: ReleaseViewModel; snapshotScope: string; coverage: readonly ReleaseCoverageAggregate[]; sources: readonly Readonly<{ source: Source; snapshots: readonly SourceSnapshot[] }>[] }>;
export type MethodologyPageViewModel = Readonly<{ release: ReleaseViewModel; sections: readonly Readonly<{ topic: string; explanation: string }>[] }>;