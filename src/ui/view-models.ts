import type { AcsObservation, Contest, DataRelease, ElectionResult, FecFilingSummary, ResultOption, Source, SourceSnapshot } from "@/domain/contracts";
import type { SeatFacets, SeatListItem, SeatPage, SeatProfile, SeatQuery } from "@/domain/repository";

type Immutable<T> = T extends (...args: never[]) => unknown ? T : T extends readonly (infer Item)[] ? readonly Immutable<Item>[] : T extends object ? { readonly [Key in keyof T]: Immutable<T[Key]> } : T;
export type ReleaseViewModel = Immutable<Pick<DataRelease, "id" | "label" | "status" | "sourceCutoff" | "publishedAt">>;
export type BrowseRowViewModel = Immutable<SeatListItem>;
export type BrowsePageViewModel = Readonly<{
  release: ReleaseViewModel;
  disclosure: Readonly<{ coverage: string; rankings: string; demographicFilters: string }>;
  appliedQuery: Readonly<SeatQuery>;
  rows: readonly BrowseRowViewModel[];
  total: number;
  nextCursor: string | null;
  available: Readonly<{ states: readonly string[]; parties: readonly string[]; incumbencyStatuses: readonly string[]; electionYears: readonly number[] }>;
}>;
export type ElectionContextViewModel = Immutable<Pick<Contest, "id" | "kind" | "round" | "electionDate" | "certificationStatus" | "reportingCompletenessPercent" | "reportingUnit" | "allocationMethod" | "allocationCoveragePercent" | "denominatorVotes" | "lineage">>;
export type ElectionResultRowViewModel = Immutable<Pick<ElectionResult, "contestId" | "resultOptionId" | "votes" | "lineage"> & Pick<Contest, "kind" | "round" | "electionDate" | "certificationStatus" | "reportingCompletenessPercent" | "reportingUnit" | "allocationMethod" | "allocationCoveragePercent" | "denominatorVotes"> & Pick<ResultOption, "candidacyId" | "label" | "party" | "optionKind" | "provenance"> & { candidacyParty: string | null }>;
export type AcsObservationViewModel = Immutable<Pick<AcsObservation, "variable" | "label" | "estimate" | "marginOfError" | "unit" | "surveyPeriod" | "universe" | "lineage">>;
export type FinanceSummaryViewModel = Immutable<Pick<FecFilingSummary, "id" | "committeeId" | "reportType" | "reportingPeriodStart" | "reportingPeriodEnd" | "filedAt" | "amendmentNumber" | "amendmentStatus" | "amendsFilingId" | "cashOnHand" | "totalReceipts" | "totalDisbursements" | "lineage">>;
export type BiographyViewModel = Immutable<Readonly<{ bioguideId: SeatProfile["biographicalFacts"][number]["value"] | null; birthDate: SeatProfile["biographicalFacts"][number]["value"] | null; facts: SeatProfile["biographicalFacts"]; memberCoverage: SeatProfile["memberCoverage"]; committeeAssignmentsNote: string }>>;
export type ProfilePageViewModel = Readonly<{
  release: ReleaseViewModel;
  identity: Readonly<{ id: string; chamber: string; stateCode: string; districtCode: string | null; geographyLabel: string; geographyVintage: string; currentHolder: string | null; currentHolderParty: string | null; occupancyStatus: string; occupancyAsOf: string; incumbencyStatus: string }>;
  headlineFacts: Immutable<Pick<SeatListItem, "presidentialMargin2024" | "cashOnHand">>;
  elections: readonly ElectionContextViewModel[];
  electionResults: readonly ElectionResultRowViewModel[];
  demographics: readonly AcsObservationViewModel[];
  acsAvailability: Immutable<SeatProfile["acsAvailability"]>;
  finance: readonly FinanceSummaryViewModel[];
  biography: BiographyViewModel;
  sourceClosure: Readonly<{ sources: readonly Source[]; snapshots: readonly SourceSnapshot[] }>;
}>;
export type SourcesPageViewModel = Readonly<{ release: ReleaseViewModel; snapshotScope: string; sources: readonly Readonly<{ source: Immutable<Source>; snapshots: readonly Immutable<SourceSnapshot>[] }>[] }>;
export type MethodologyPageViewModel = Readonly<{ release: ReleaseViewModel; sections: readonly Readonly<{ topic: string; explanation: string }>[] }>;

const release = (value: DataRelease): ReleaseViewModel => ({ id: value.id, label: value.label, status: value.status, sourceCutoff: value.sourceCutoff, publishedAt: value.publishedAt });
const unique = <T>(values: readonly T[]): readonly T[] => [...new Set(values)].sort();
const byteCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sameSnapshot = (left: SourceSnapshot, right: SourceSnapshot): boolean => left.id === right.id && left.releaseId === right.releaseId && left.sourceId === right.sourceId && left.sourceUrl === right.sourceUrl && left.publishedAt === right.publishedAt && left.retrievedAt === right.retrievedAt && left.checksumSha256 === right.checksumSha256 && left.parserVersion === right.parserVersion && left.license === right.license && left.usageStatus === right.usageStatus;

/** Pure UI compiler: it preserves sourced values and never creates a score. */
export function compileBrowsePage(releaseValue: DataRelease, page: SeatPage, appliedQuery: SeatQuery, facets: SeatFacets): BrowsePageViewModel {
  return { release: release(releaseValue), appliedQuery: { ...appliedQuery }, rows: page.items.map((row) => ({ ...row })), total: page.total, nextCursor: page.nextCursor, available: { states: unique(facets.states), parties: unique(facets.parties), incumbencyStatuses: unique(facets.incumbencyStatuses), electionYears: unique(facets.electionYears) }, disclosure: { coverage: "Coverage is limited to the active release; missing values retain their stated reason.", rankings: "No rankings or scores are published in this release.", demographicFilters: "Demographics are display-only and cannot filter, order, subset, or rank seats." } };
}

function compileProfilePageBase(profile: SeatProfile, seat: SeatListItem): Omit<ProfilePageViewModel, "biography" | "acsAvailability"> {
  const contests = new Map(profile.contests.map((contest) => [contest.id, contest]));
  const options = new Map(profile.resultOptions.map((option) => [option.id, option]));
  const candidacies = new Map(profile.candidacies.map((candidacy) => [candidacy.id, candidacy]));
  return { release: release(profile.release), identity: { id: profile.seatCycle.id, chamber: profile.office.chamber, stateCode: profile.office.stateCode, districtCode: profile.office.districtCode, geographyLabel: profile.geography.label, geographyVintage: profile.geography.vintage, currentHolder: profile.incumbent?.displayName ?? null, currentHolderParty: profile.membership?.party ?? null, occupancyStatus: profile.seatCycle.occupancy.status, occupancyAsOf: profile.seatCycle.occupancy.asOf, incumbencyStatus: profile.seatCycle.incumbencyStatus }, headlineFacts: { presidentialMargin2024: seat.presidentialMargin2024, cashOnHand: seat.cashOnHand }, elections: profile.contests.map((contest) => ({ id: contest.id, kind: contest.kind, round: contest.round, electionDate: contest.electionDate, certificationStatus: contest.certificationStatus, reportingCompletenessPercent: contest.reportingCompletenessPercent, reportingUnit: contest.reportingUnit, allocationMethod: contest.allocationMethod, allocationCoveragePercent: contest.allocationCoveragePercent, denominatorVotes: contest.denominatorVotes, lineage: contest.lineage })), electionResults: profile.electionResults.flatMap((result) => { const contest = contests.get(result.contestId); const option = options.get(result.resultOptionId); if (!contest || !option) return []; const candidacy = option.candidacyId === null ? null : candidacies.get(option.candidacyId) ?? null; return [{ contestId: result.contestId, resultOptionId: result.resultOptionId, votes: result.votes, lineage: result.lineage, kind: contest.kind, round: contest.round, electionDate: contest.electionDate, certificationStatus: contest.certificationStatus, reportingCompletenessPercent: contest.reportingCompletenessPercent, reportingUnit: contest.reportingUnit, allocationMethod: contest.allocationMethod, allocationCoveragePercent: contest.allocationCoveragePercent, denominatorVotes: contest.denominatorVotes, candidacyId: option.candidacyId, label: option.label, party: option.party, optionKind: option.optionKind, provenance: option.provenance, candidacyParty: candidacy?.party ?? null }]; }), demographics: profile.demographics.map((observation) => ({ variable: observation.variable, label: observation.label, estimate: observation.estimate, marginOfError: observation.marginOfError, unit: observation.unit, surveyPeriod: observation.surveyPeriod, universe: observation.universe, lineage: observation.lineage })), finance: profile.finance.map((filing) => ({ id: filing.id, committeeId: filing.committeeId, reportType: filing.reportType, reportingPeriodStart: filing.reportingPeriodStart, reportingPeriodEnd: filing.reportingPeriodEnd, filedAt: filing.filedAt, amendmentNumber: filing.amendmentNumber, amendmentStatus: filing.amendmentStatus, amendsFilingId: filing.amendsFilingId, cashOnHand: filing.cashOnHand, totalReceipts: filing.totalReceipts, totalDisbursements: filing.totalDisbursements, lineage: filing.lineage })), sourceClosure: { sources: [...profile.sources], snapshots: [...profile.snapshots] } };
}

export function compileProfilePage(profile: SeatProfile, seat: SeatListItem): ProfilePageViewModel {
  const base = compileProfilePageBase(profile, seat);
  const fact = (name: "birth_date" | "bioguide_id") => profile.biographicalFacts.find((row) => row.fact === name)?.value ?? null;
  return { ...base, acsAvailability: profile.acsAvailability, biography: { bioguideId: fact("bioguide_id"), birthDate: fact("birth_date"), facts: profile.biographicalFacts, memberCoverage: profile.memberCoverage, committeeAssignmentsNote: "Committee assignments are not published because current official sources do not provide authoritative effective dates." } };
}

export function compileSourcesPage(releaseValue: DataRelease, sources: readonly Source[], snapshots: readonly SourceSnapshot[]): SourcesPageViewModel {
  const snapshotsById = new Map<string, SourceSnapshot>();
  for (const snapshot of snapshots) {
    const existing = snapshotsById.get(snapshot.id);
    if (existing && !sameSnapshot(existing, snapshot)) throw new Error(`Conflicting source snapshot id: ${snapshot.id}`);
    snapshotsById.set(snapshot.id, snapshot);
  }
  const uniqueSnapshots = [...snapshotsById.values()].sort((left, right) => byteCompare(left.id, right.id));
  return { release: release(releaseValue), snapshotScope: "Snapshots are the full active-release snapshot inventory; a source can have zero snapshots in this inventory.", sources: [...sources].sort((left, right) => byteCompare(left.id, right.id)).map((source) => ({ source, snapshots: uniqueSnapshots.filter((snapshot) => snapshot.sourceId === source.id) })) };
}

export function compileMethodologyPage(releaseValue: DataRelease): MethodologyPageViewModel {
  return { release: release(releaseValue), sections: [
    { topic: "Election status", explanation: "Certified results are distinct from unavailable results and from modeled results. Unavailable values are not defensibly modeled." },
    { topic: "ACS uncertainty", explanation: "ACS observations retain the variable, label, estimate, margin of error, unit, survey period, universe, and lineage." },
    { topic: "FEC filings", explanation: "FEC summaries preserve reporting periods, filing dates, and amendments and use the release source cutoff; not every profile has a filing, and summaries are not real-time balances." },
    { topic: "Release identity", explanation: "Each page identifies its release and source cutoff. Sources retain snapshots, retrieval metadata, licenses, and usage status." },
    { topic: "Demographics and rankings", explanation: "Demographics are display-only. They cannot filter, order, subset, export, or rank seats. No rankings or evidence publication are included in this release." },
    { topic: "Address privacy and deployment", explanation: "Addresses are not retained; the Census Geocoder is an external processor. Public deployment is gated by the product release boundary." },
  ] };
}
