import type { CoverageRecord, PrototypeManifest, SeatCycleId } from "@/domain/contracts";
import { sourceSchema, sourceSnapshotSchema } from "@/domain/contracts";
import { electionMetricSummarySchema, financeMetricSummarySchema, seatFacetsSchema, seatListItemSchema, seatProfileSchema, seatQuerySchema } from "@/domain/repository";
import type { ElectionMetricSummary, FinanceMetricSummary, SeatFacets, SeatListItem, SeatProfile, SeatQuery } from "@/domain/repository";

const byteCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const asciiLower = (value: string): string => value.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
const uniqueSorted = (ids: Iterable<string>): string[] => [...new Set(ids)].sort(byteCompare);
const sortedBy = <T>(rows: readonly T[], key: (row: T) => readonly string[]): T[] => [...rows].sort((left, right) => {
  const leftKey = key(left); const rightKey = key(right);
  for (let index = 0; index < Math.min(leftKey.length, rightKey.length); index += 1) {
    const comparison = byteCompare(leftKey[index]!, rightKey[index]!);
    if (comparison !== 0) return comparison;
  }
  return leftKey.length - rightKey.length;
});

/** The sole manifest-to-DTO compiler; both storage adapters use this projection. */
export function createManifestSeatProjection(manifest: PrototypeManifest) {
  const coverageRecords = (manifest as PrototypeManifest & { coverageRecords?: readonly CoverageRecord[] }).coverageRecords ?? [];
  const byId = <T extends { id: string }>(rows: readonly T[]) => new Map(rows.map((row) => [String(row.id), row]));
  const offices = byId(manifest.offices); const terms = byId(manifest.officeTerms); const geographies = byId(manifest.geographyVersions);
  const people = byId(manifest.people); const cycles = byId(manifest.seatCycles); const options = byId(manifest.resultOptions);
  const membershipFor = (cycle: PrototypeManifest["seatCycles"][number]) => cycle.occupancy.status === "occupied"
    ? manifest.memberships.find((member) => member.officeTermId === cycle.officeTermId && member.startsAt <= cycle.occupancy.asOf && (member.endsAt === null || cycle.occupancy.asOf < member.endsAt)) ?? null : null;
  const presidentMetric = (cycleId: string): ElectionMetricSummary => {
    const contest = manifest.contests.find((row) => row.seatCycleId === cycleId && row.kind === "president_general" && row.round === "general" && row.electionDate.startsWith("2024-"));
    if (!contest) throw new Error(`Profile seat ${cycleId} lacks a 2024 presidential contest`);
    const results = manifest.electionResults.filter((result) => result.contestId === contest.id);
    const partyResults = (party: "republican" | "democratic") => results.filter((result) => options.get(String(result.resultOptionId))?.party === party);
    const republicanResults = partyResults("republican"); const democraticResults = partyResults("democratic");
    const republican = republicanResults.filter((result) => result.votes.kind === "value"); const democratic = democraticResults.filter((result) => result.votes.kind === "value");
    const missing = contest.denominatorVotes.kind === "missing" ? contest.denominatorVotes : (republican.length === 0 ? republicanResults.find((result) => result.votes.kind === "missing")?.votes : democratic.length === 0 ? democraticResults.find((result) => result.votes.kind === "missing")?.votes : null);
    const value = missing ?? (contest.denominatorVotes.kind === "value" && contest.denominatorVotes.value === 0
      ? { kind: "missing" as const, reason: "not_applicable" as const }
      : contest.denominatorVotes.kind === "value" && republican.length > 0 && democratic.length > 0
      ? { kind: "value" as const, value: ((republican.reduce((sum, result) => sum + (result.votes as { value: number }).value, 0) - democratic.reduce((sum, result) => sum + (result.votes as { value: number }).value, 0)) / contest.denominatorVotes.value) * 100 }
      : { kind: "missing" as const, reason: "not_reported" as const });
    const relevantResults = [...republicanResults, ...democraticResults];
    return electionMetricSummarySchema.parse({ value, geographyVersionId: contest.geographyVersionId, status: contest.lineage.status, asOf: contest.lineage.asOf, methodology: contest.lineage.methodology, inputSnapshotIds: uniqueSorted([...contest.lineage.inputs.map((input) => String(input.snapshotId)), ...relevantResults.flatMap((result) => result.lineage.inputs.map((input) => String(input.snapshotId))), ...relevantResults.flatMap((result) => options.get(String(result.resultOptionId))?.provenance.map((input) => String(input.snapshotId)) ?? [])]) });
  };
  const financeMetric = (cycleId: string): FinanceMetricSummary => {
    const summary = manifest.financeSummaries.find((row) => row.seatCycleId === cycleId);
    if (!summary) throw new Error(`Profile seat ${cycleId} lacks a finance summary`);
    if (summary.kind === "missing") return financeMetricSummarySchema.parse({ kind: "missing", reason: summary.reason, asOf: summary.asOf, inputSnapshotIds: uniqueSorted(summary.inputs.map((input) => String(input.snapshotId))) });
    const filing = manifest.fecFilingSummaries.find((row) => row.id === summary.filingId);
    if (!filing) throw new Error(`Finance summary ${cycleId} references an unknown canonical filing`);
    if (filing.cashOnHand.kind === "missing") return financeMetricSummarySchema.parse({ kind: "missing", reason: filing.cashOnHand.reason, asOf: filing.reportingPeriodEnd, inputSnapshotIds: uniqueSorted(filing.lineage.inputs.map((input) => String(input.snapshotId))) });
    return financeMetricSummarySchema.parse({ kind: "value", value: filing.cashOnHand.value, filingId: filing.id, committeeId: filing.committeeId, coverageThrough: filing.reportingPeriodEnd, filedAt: filing.filedAt, inputSnapshotIds: uniqueSorted(filing.lineage.inputs.map((input) => String(input.snapshotId))) });
  };
  const itemFor = (cycleId: string): SeatListItem => {
    const cycle = cycles.get(cycleId); if (!cycle) throw new Error(`Unknown profile seat ${cycleId}`);
    const office = offices.get(String(cycle.officeId)); const geography = geographies.get(String(cycle.geographyVersionId));
    if (!office || !geography) throw new Error(`Profile seat ${cycleId} lacks office or geography`);
    const membership = membershipFor(cycle); const incumbent = membership ? people.get(String(membership.personId)) ?? null : null;
    return seatListItemSchema.parse({ id: cycle.id, releaseId: manifest.release.id, chamber: office.chamber, stateCode: office.stateCode, districtCode: office.districtCode, label: `${office.stateCode}-${office.districtCode ?? "Senate"}`, incumbentName: incumbent?.displayName ?? null, incumbentParty: membership?.party ?? null, incumbencyStatus: cycle.incumbencyStatus, electionYear: cycle.cycleYear, presidentialMargin2024: presidentMetric(cycleId), cashOnHand: financeMetric(cycleId), coverageLabel: geography.label });
  };
  const list = (input: SeatQuery): readonly SeatListItem[] => {
    const query = seatQuerySchema.parse(input); const normalized = query.identitySearch && asciiLower(query.identitySearch);
    const metric = (item: SeatListItem): string | number | null => ({ state: item.stateCode, district: item.districtCode === "AL" ? "00" : item.districtCode, incumbent_name: item.incumbentName, election_year: item.electionYear, cash_on_hand: item.cashOnHand.kind === "value" ? item.cashOnHand.value : null, presidential_margin_2024: item.presidentialMargin2024.value.kind === "value" ? item.presidentialMargin2024.value.value : null })[query.sort];
    return manifest.profileSeatCycleIds.map((id) => itemFor(String(id))).filter((item) => !query.chamber || item.chamber === query.chamber).filter((item) => !query.stateCode || item.stateCode === query.stateCode).filter((item) => !query.party || item.incumbentParty === query.party).filter((item) => !query.incumbencyStatus || item.incumbencyStatus === query.incumbencyStatus).filter((item) => !query.electionYear || item.electionYear === query.electionYear).filter((item) => !normalized || [item.label, item.stateCode, item.districtCode, item.incumbentName].some((value) => value !== null && asciiLower(value).includes(normalized))).sort((a, b) => { const left = metric(a); const right = metric(b); if (left === null) return right === null ? byteCompare(String(a.id), String(b.id)) : 1; if (right === null) return -1; const order = typeof left === "number" && typeof right === "number" ? left - right : byteCompare(String(left), String(right)); return order === 0 ? byteCompare(String(a.id), String(b.id)) : query.direction === "asc" ? order : -order; });
  };
  const item = (id: SeatCycleId): SeatListItem | null => manifest.profileSeatCycleIds.some((profileId) => profileId === id) ? itemFor(String(id)) : null;
  const profile = (id: SeatCycleId): SeatProfile | null => {
    if (!manifest.profileSeatCycleIds.some((profileId) => profileId === id)) return null;
    const cycle = cycles.get(String(id)); if (!cycle) return null; const office = offices.get(String(cycle.officeId)); const geography = geographies.get(String(cycle.geographyVersionId)); const term = terms.get(String(cycle.officeTermId)); if (!office || !geography || !term) return null;
    const membership = membershipFor(cycle); const incumbent = membership ? people.get(String(membership.personId)) ?? null : null; const contests = manifest.contests.filter((row) => row.seatCycleId === id); const contestIds = new Set(contests.map((row) => row.id)); const candidacies = manifest.candidacies.filter((row) => contestIds.has(row.contestId)); const candidacyIds = new Set(candidacies.map((row) => row.id)); const resultOptions = manifest.resultOptions.filter((row) => contestIds.has(row.contestId)); const optionIds = new Set(resultOptions.map((row) => row.id)); const electionResults = manifest.electionResults.filter((row) => contestIds.has(row.contestId) && optionIds.has(row.resultOptionId)); const demographics = manifest.acsObservations.filter((row) => row.geographyVersionId === cycle.geographyVersionId); const finance = manifest.fecFilingSummaries.filter((row) => row.seatCycleId === id); const financeAggregates: SeatProfile["financeAggregates"] = ((manifest as unknown as { financeAggregates?: SeatProfile["financeAggregates"] }).financeAggregates ?? []).filter((row) => row.seatCycleId === id); const committeeIds = new Set([...finance.map((row) => row.committeeId), ...financeAggregates.flatMap((aggregate) => aggregate.committeeInputs.map((input) => input.committeeId))]); const committeeRelationships = manifest.committeeRelationships.filter((row) => committeeIds.has(row.committeeId) && candidacyIds.has(row.candidacyId)); const committees = manifest.committees.filter((row) => committeeIds.has(row.id));
    const snapshotIds = new Set<string>(); const collect = (rows: readonly unknown[]) => rows.forEach((row) => { const item = row as { provenance?: readonly { snapshotId: string }[]; lineage?: { inputs: readonly { snapshotId: string }[] } }; item.provenance?.forEach((ref) => snapshotIds.add(ref.snapshotId)); item.lineage?.inputs.forEach((ref) => snapshotIds.add(ref.snapshotId)); });
    const financeCoverage = coverageRecords.find((record) => record.domain === "finance" && record.scope.kind === "funding" && record.scope.seatCycleId === id && record.scope.fundingKind === "summary") ?? null;
    const electionDecisions = ((manifest as PrototypeManifest & { electionDecisions?: readonly SeatProfile["electionDecisions"][number][] }).electionDecisions ?? []).filter((decision) => decision.jurisdictionCode === office.stateCode);
    const electionCoverage = coverageRecords.filter((record) => record.scope.kind === "election" && record.scope.jurisdictionCode === office.stateCode && electionDecisions.some((decision) => decision.electionYear === (record.scope.kind === "election" ? record.scope.electionYear : -1)));
    collect([cycle, office, geography, term, ...(membership ? [membership] : []), ...(incumbent ? [incumbent] : []), ...contests, ...candidacies, ...resultOptions, ...electionResults, ...demographics, ...finance, ...committees, ...committeeRelationships]); manifest.financeSummaries.forEach((summary) => { if (summary.seatCycleId === id && summary.kind === "missing") summary.inputs.forEach((input) => snapshotIds.add(input.snapshotId)); }); financeCoverage?.inputSnapshotIds.forEach((snapshotId) => snapshotIds.add(snapshotId)); electionDecisions.forEach((decision) => decision.inputSnapshotIds.forEach((snapshotId) => snapshotIds.add(snapshotId))); electionCoverage.forEach((coverage) => coverage.inputSnapshotIds.forEach((snapshotId) => snapshotIds.add(snapshotId)));
    const mapArtifact = ((manifest as PrototypeManifest & { mapArtifacts?: readonly { geographyVersionId: string; artifactId: string; inputSnapshotIds: readonly string[] }[] }).mapArtifacts ?? []).find((row) => row.geographyVersionId === cycle.geographyVersionId) ?? null;
    const geometryArtifact = mapArtifact ? manifest.geometryArtifacts.find((row) => row.id === mapArtifact.artifactId) ?? null : null;
    const derivations = (manifest as PrototypeManifest & { snapshotDerivations?: readonly { outputSnapshotId: string; inputSnapshotIds: readonly string[] }[] }).snapshotDerivations ?? [];
    const derivationInputs = geometryArtifact ? uniqueSorted(derivations.filter((row) => row.outputSnapshotId === geometryArtifact.snapshotId).flatMap((row) => row.inputSnapshotIds)) : [];
    const map = manifest.release.status === "published" && mapArtifact && geometryArtifact ? { releaseId: manifest.release.id, geographyVersionId: geography.id, artifactId: geometryArtifact.id, artifactSnapshotId: geometryArtifact.snapshotId, artifactChecksumSha256: geometryArtifact.checksumSha256, url: `/maps/${manifest.release.id}/${geography.id}`, inputSnapshotIds: uniqueSorted(mapArtifact.inputSnapshotIds.map(String)), derivationInputSnapshotIds: derivationInputs } : null;
    if (map && geometryArtifact) {
      map.inputSnapshotIds.forEach((snapshotId) => snapshotIds.add(snapshotId)); snapshotIds.add(String(geometryArtifact.snapshotId));
      const closeDerivation = (outputId: string): void => derivations.filter((row) => row.outputSnapshotId === outputId).forEach((row) => row.inputSnapshotIds.forEach((inputId) => { if (!snapshotIds.has(inputId)) { snapshotIds.add(inputId); closeDerivation(inputId); } }));
      closeDerivation(String(geometryArtifact.snapshotId));
    }
    const snapshots = sortedBy(manifest.snapshots.filter((row) => snapshotIds.has(row.id)), (row) => [String(row.id)]);
    const sourceIds = new Set(snapshots.map((row) => row.sourceId));
    return seatProfileSchema.parse({
      release: manifest.release, office, seatCycle: cycle, geography, officeTerm: term, membership, incumbent, map,
      biographicalFacts: [], memberCoverage: null, financeCoverage, financeAggregates: sortedBy(financeAggregates, (row) => [row.asOf, String(row.id)]), acsAvailability: demographics.length > 0 ? { kind: "observations" } : { kind: "no_observations" }, acsCoverage: [], electionDecisions: sortedBy(electionDecisions, (row) => [String(row.electionYear)]), electionCoverage: sortedBy(electionCoverage, (row) => [String(row.scope.kind === "election" ? row.scope.electionYear : 0)]),
      contests: sortedBy(contests, (row) => [String(row.id)]),
      candidacies: sortedBy(candidacies, (row) => [String(row.id)]),
      resultOptions: sortedBy(resultOptions, (row) => [String(row.id)]),
      electionResults: sortedBy(electionResults, (row) => [String(row.contestId), String(row.resultOptionId)]),
      demographics: sortedBy(demographics, (row) => [String(row.geographyVersionId), row.variable, row.surveyPeriod]),
      finance: sortedBy(finance, (row) => [String(row.id)]),
      committees: sortedBy(committees, (row) => [String(row.id)]),
      committeeRelationships: sortedBy(committeeRelationships, (row) => [String(row.id)]),
      sources: sortedBy(manifest.sources.filter((row) => sourceIds.has(row.id)), (row) => [String(row.id)]),
      snapshots,
    });
  };
  const profileCycles = () => manifest.profileSeatCycleIds.map((id) => cycles.get(String(id))!).filter(Boolean);
  const facets = (): SeatFacets => seatFacetsSchema.parse({
    states: uniqueSorted(profileCycles().map((cycle) => offices.get(String(cycle.officeId))!.stateCode)),
    parties: uniqueSorted(profileCycles().flatMap((cycle) => membershipFor(cycle)?.party ?? [])),
    incumbencyStatuses: uniqueSorted(profileCycles().map((cycle) => cycle.incumbencyStatus)),
    electionYears: [...new Set(profileCycles().map((cycle) => cycle.cycleYear))].sort((left, right) => left - right),
  });
  return {
    list, item, profile, facets,
    sources: () => sortedBy(manifest.sources, (source) => [String(source.id)]).map((source) => sourceSchema.parse(source)),
    snapshots: () => sortedBy(manifest.snapshots, (snapshot) => [String(snapshot.id)]).map((snapshot) => sourceSnapshotSchema.parse(snapshot)),
  };
}
