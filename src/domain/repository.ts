import { z } from "zod";

import {
  acsObservationSchema,
  candidacySchema,
  chamberSchema,
  committeeIdSchema,
  committeeRelationshipSchema,
  committeeSchema,
  contestSchema,
  dataReleaseSchema,
  electionDecisionSchema,
  electionResultSchema,
  factStatusSchema,
  factValueSchema,
  fecFilingIdSchema,
  fecFilingSummarySchema,
  financeAggregateSchema,
  geographyVersionIdSchema,
  geometryArtifactIdSchema,
  geographyVersionSchema,
  incumbencyStatusSchema,
  isoDateSchema,
  isoDateTimeSchema,
  membershipSchema,
  missingReasonSchema,
  officeSchema,
  officeKindSchema,
  officeTermSchema,
  partySchema,
  personSchema,
  personBiographicalFactSchema,
  coverageRecordSchema,
  releaseIdSchema,
  resultOptionSchema,
  seatCycleSchema,
  seatCycleIdSchema,
  snapshotIdSchema,
  sourceSchema,
  sourceSnapshotSchema,
  usStateCodeSchema,
} from "@/domain/contracts";
import type { DataRelease, ReleaseId, SeatCycleId, Source, SourceSnapshot } from "@/domain/contracts";

export const seatSortKeySchema = z.enum([
  "state",
  "district",
  "incumbent_name",
  "election_year",
  "cash_on_hand",
  "presidential_margin_2024",
]);

export const seatQuerySchema = z.object({
  identitySearch: z.string().trim().max(100).optional(),
  chamber: chamberSchema.optional(),
  stateCode: usStateCodeSchema.optional(),
  party: partySchema.optional(),
  incumbencyStatus: incumbencyStatusSchema.optional(),
  electionYear: z.number().int().min(2024).max(2200).optional(),
  sort: seatSortKeySchema.default("state"),
  direction: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export const IDENTITY_SEARCH_FIELDS = [
  "office_label",
  "state_code",
  "district_code",
  "incumbent_name",
] as const;

export type SeatQuery = z.infer<typeof seatQuerySchema>;
export type SeatSortKey = z.infer<typeof seatSortKeySchema>;

/** The only snapshot-reference vocabulary carried by profile facts. */
export function collectProfileSnapshotSeedIds(value: unknown): string[] {
  const ids = new Set<string>();
  const compare = (left: string, right: string): number => {
    const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right);
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return a.length - b.length;
  };
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (item === null || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    for (const key of ["snapshotId", "artifactSnapshotId"] as const) if (typeof record[key] === "string") ids.add(record[key]);
    for (const key of ["inputSnapshotIds", "derivationInputSnapshotIds"] as const) if (Array.isArray(record[key])) record[key].forEach((id) => { if (typeof id === "string") ids.add(id); });
    Object.values(record).forEach(visit);
  };
  visit(value);
  return [...ids].sort(compare);
}

export const seatFacetsSchema = z.object({
  states: z.array(usStateCodeSchema),
  parties: z.array(partySchema),
  incumbencyStatuses: z.array(incumbencyStatusSchema),
  electionYears: z.array(z.number().int().min(1788).max(2200)),
}).strict();
export type SeatFacets = z.infer<typeof seatFacetsSchema>;

const electionMetricSummaryV1Schema = z.object({
  value: factValueSchema(z.number()),
  geographyVersionId: geographyVersionIdSchema,
  status: factStatusSchema,
  asOf: isoDateSchema,
  methodology: z.string().min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
}).strict();

/** V2 makes a release-level coverage absence explicit without changing v1 DTOs. */
const electionCoverageMissingSummarySchema = z.object({
  kind: z.literal("coverage_missing"),
  value: z.object({ kind: z.literal("missing"), reason: missingReasonSchema }).strict(),
  reason: missingReasonSchema,
  asOf: isoDateSchema,
  methodology: z.literal("coverage_missing"),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
  geographyVersionId: geographyVersionIdSchema.nullable(),
  // Coverage itself is reported even though the metric is unavailable.
  status: z.literal("reported"),
}).strict();

export const electionMetricSummarySchema = z.union([electionMetricSummaryV1Schema, electionCoverageMissingSummarySchema]);

export const financeMetricSummarySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("value"),
    value: z.number().nonnegative(),
    filingId: fecFilingIdSchema,
    committeeId: committeeIdSchema,
    coverageThrough: isoDateSchema,
    filedAt: isoDateTimeSchema,
    inputSnapshotIds: z.array(snapshotIdSchema).min(1),
  }).strict(),
  z.object({
    kind: z.literal("missing"),
    reason: missingReasonSchema,
    asOf: isoDateSchema,
    inputSnapshotIds: z.array(snapshotIdSchema).min(1),
  }).strict(),
  z.object({
    kind: z.literal("aggregate"),
    value: z.number().nonnegative(),
    aggregateId: z.string().min(1),
    asOf: isoDateSchema,
    coverageThrough: isoDateSchema,
    methodologyVersion: z.string().min(1),
    inputSnapshotIds: z.array(snapshotIdSchema).min(1),
    // A kind label, not a fabricated filing or missing-data claim.
    reason: z.literal("aggregate"),
  }).strict(),
]);

export const seatListItemSchema = z.object({
  id: seatCycleIdSchema,
  releaseId: releaseIdSchema,
  chamber: chamberSchema,
  officeKind: officeKindSchema,
  stateCode: usStateCodeSchema,
  districtCode: z.string().regex(/^(AL|[0-9]{2})$/).nullable(),
  label: z.string().min(1),
  incumbentName: z.string().min(1).nullable(),
  incumbentParty: partySchema.nullable(),
  incumbencyStatus: incumbencyStatusSchema,
  electionYear: z.number().int().min(1788).max(2200),
  presidentialMargin2024: electionMetricSummarySchema,
  cashOnHand: financeMetricSummarySchema,
  coverageLabel: z.string().min(1),
}).strict();

export const jurisdictionPolicySchema = z.object({
  jurisdictionCode: usStateCodeSchema,
  houseRepresentation: z.enum(["voting", "delegate", "resident_commissioner"]),
  senateRepresentation: z.enum(["two_seats", "none"]),
  source: z.enum(["persisted", "legacy_fallback"]),
}).strict();

export const releaseCoverageAggregateSchema = z.object({
  releaseId: releaseIdSchema,
  domain: z.enum(["identity", "geography", "member", "acs", "finance", "election_2020", "election_2022", "election_2024", "maps"]),
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("release") }).strict(),
    z.object({ kind: z.literal("jurisdiction") }).strict(),
    z.object({ kind: z.literal("seat_cycle") }).strict(),
    z.object({ kind: z.literal("acs_indicator"), variable: z.string().min(1), surveyPeriod: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("election"), electionYear: z.number().int() }).strict(),
    z.object({ kind: z.literal("funding"), fundingKind: z.enum(["summary", "category", "organization", "outside_spending"]) }).strict(),
  ]),
  status: z.enum(["complete", "partial", "not_collected", "unavailable"]),
  recordCount: z.number().int().positive(), expectedCount: z.number().int().nonnegative(), observedCount: z.number().int().nonnegative(),
  quarantinedCount: z.number().int().nonnegative(), incompatibleCount: z.number().int().nonnegative(),
  missingByReason: z.array(z.object({ reason: missingReasonSchema, count: z.number().int().positive() }).strict()),
  inputSnapshotCount: z.number().int().nonnegative(),
}).strict();

const profileBiographicalFactsSchema = z.array(personBiographicalFactSchema).superRefine((facts, context) => {
  const keys = new Set<string>();
  facts.forEach((fact, index) => {
    const key = `${fact.personId}:${fact.fact}:${fact.effectiveAt}`;
    if (keys.has(key)) context.addIssue({ code: "custom", path: [index], message: "Duplicate biographical fact" });
    keys.add(key);
  });
});

const ACS_PROFILE_INDICATORS = new Set(["B01003_001E", "B01002_001E", "B19013_001E"]);
const profileAcsCoverageSchema = coverageRecordSchema.refine((coverage) => coverage.domain === "acs" && coverage.scope.kind === "acs_indicator" && ACS_PROFILE_INDICATORS.has(coverage.scope.variable) && coverage.scope.surveyPeriod === "2020-2024", "Expected an authorized 2020-2024 ACS indicator coverage record");
const profileFinanceCoverageSchema = coverageRecordSchema.refine((coverage) => coverage.domain === "finance" && coverage.scope.kind === "funding" && coverage.scope.fundingKind === "summary", "Expected seat-scoped finance summary coverage");
const profileElectionCoverageSchema = coverageRecordSchema.refine((coverage) => coverage.scope.kind === "election" && coverage.domain === `election_${coverage.scope.electionYear}`, "Expected matching election coverage");
export const profileAcsAvailabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("observations") }).strict(),
  z.object({ kind: z.literal("no_observations") }).strict(),
  z.object({ kind: z.literal("incompatible_geography") }).strict(),
]);

export const profileMapSchema = z.object({
  releaseId: releaseIdSchema,
  geographyVersionId: geographyVersionIdSchema,
  artifactId: geometryArtifactIdSchema,
  artifactSnapshotId: snapshotIdSchema,
  artifactChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.string().regex(/^\/maps\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
  /** The original TIGER snapshot used to derive this published artifact. */
  derivationInputSnapshotIds: z.array(snapshotIdSchema).min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
}).strict();

export const seatProfileSchema = z.object({
  release: dataReleaseSchema,
  office: officeSchema,
  // V2 projections persist this relation; v1 projections explicitly label their fallback.
  jurisdiction: jurisdictionPolicySchema,
  seatCycle: seatCycleSchema,
  geography: geographyVersionSchema,
  officeTerm: officeTermSchema,
  membership: membershipSchema.nullable(),
  incumbent: personSchema.nullable(),
  biographicalFacts: profileBiographicalFactsSchema,
  memberCoverage: coverageRecordSchema.refine((coverage) => coverage.domain === "member" && coverage.scope.kind === "release", "Expected release-scope member coverage").nullable(),
  // Defaults keep v1 DTOs safe: missing coverage never implies observed finance.
  financeCoverage: profileFinanceCoverageSchema.nullable().default(null),
  financeAggregates: z.array(financeAggregateSchema).default([]),
  // Defaults keep v1 DTOs safe: an omitted field never implies compatibility.
  acsAvailability: profileAcsAvailabilitySchema.default({ kind: "no_observations" }),
  acsCoverage: z.array(profileAcsCoverageSchema).default([]),
  electionDecisions: z.array(electionDecisionSchema).default([]),
  electionCoverage: z.array(profileElectionCoverageSchema).default([]),
  map: profileMapSchema.nullable().default(null),
  contests: z.array(contestSchema),
  candidacies: z.array(candidacySchema),
  resultOptions: z.array(resultOptionSchema),
  electionResults: z.array(electionResultSchema),
  demographics: z.array(acsObservationSchema),
  finance: z.array(fecFilingSummarySchema),
  committees: z.array(committeeSchema),
  committeeRelationships: z.array(committeeRelationshipSchema),
  sources: z.array(sourceSchema),
  snapshots: z.array(sourceSnapshotSchema),
}).strict().superRefine((profile, context) => {
  const addIssue = (path: (string | number)[], message: string): void => context.addIssue({ code: "custom", path, message });
  const coverageVariables = new Set(profile.acsCoverage.flatMap((coverage) => coverage.scope.kind === "acs_indicator" ? [coverage.scope.variable] : []));
  if (profile.acsAvailability.kind === "incompatible_geography") {
    if (profile.demographics.length !== 0) addIssue(["demographics"], "Incompatible geography profiles cannot include ACS observations");
    if (profile.acsCoverage.length !== 3 || coverageVariables.size !== 3 || [...ACS_PROFILE_INDICATORS].some((variable) => !coverageVariables.has(variable))) addIssue(["acsCoverage"], "Incompatible geography profiles require exactly the three authorized ACS coverage records");
  } else if (profile.acsAvailability.kind === "observations") {
    if (profile.demographics.length === 0) addIssue(["demographics"], "Observed ACS availability requires observations");
    if (profile.acsCoverage.length !== 0) addIssue(["acsCoverage"], "Observed ACS availability cannot include incompatible-geography coverage");
  } else {
    if (profile.demographics.length !== 0) addIssue(["demographics"], "No-observations availability cannot include ACS observations");
    if (profile.acsCoverage.length !== 0) addIssue(["acsCoverage"], "No-observations availability cannot include ACS coverage");
  }
  const aggregatePresent = profile.financeAggregates.length > 0;
  if (profile.financeCoverage && (aggregatePresent || profile.finance.length > 0) && (!["complete", "partial"].includes(profile.financeCoverage.status) || profile.financeCoverage.observedCount === 0)) addIssue(["financeCoverage"], "Finance coverage must agree with aggregate presence");
  profile.financeAggregates.forEach((aggregate, aggregateIndex) => {
    const missingInput = aggregate.committeeInputs.some((input) => input.kind === "missing");
    if (aggregate.releaseId !== profile.release.id || aggregate.seatCycleId !== profile.seatCycle.id || new Set(aggregate.committeeInputs.map((input) => String(input.committeeId))).size !== aggregate.committeeInputs.length || (missingInput && [aggregate.cashOnHand, aggregate.receipts, aggregate.disbursements].some((value) => value.kind === "value"))) addIssue(["financeAggregates", aggregateIndex], "Invalid aggregate finance closure");
    aggregate.committeeInputs.forEach((input, inputIndex) => {
      const relationship = profile.committeeRelationships.some((candidate) => candidate.committeeId === input.committeeId && profile.candidacies.some((candidacy) => candidacy.id === candidate.candidacyId && profile.contests.some((contest) => contest.id === candidacy.contestId && contest.seatCycleId === profile.seatCycle.id)) && candidate.effectiveFrom <= aggregate.coverageThrough && (candidate.effectiveTo === null || aggregate.reportingPeriodStart < candidate.effectiveTo));
      if (!profile.committees.some((committee) => committee.id === input.committeeId) || !relationship) addIssue(["financeAggregates", aggregateIndex, "committeeInputs", inputIndex], "Aggregate input committee must be exposed with an effective relationship for this seat");
      if (input.kind === "missing") return;
      const filing = profile.finance.find((candidate) => candidate.id === input.filingId);
      if (!filing || filing.committeeId !== input.committeeId || filing.seatCycleId !== aggregate.seatCycleId || filing.reportingPeriodStart !== aggregate.reportingPeriodStart || filing.reportingPeriodEnd !== aggregate.coverageThrough || filing.amendmentStatus === "superseded" || profile.finance.some((candidate) => candidate.amendsFilingId === filing.id) || filing.filedAt.slice(0, 10) > aggregate.asOf) addIssue(["financeAggregates", aggregateIndex, "committeeInputs", inputIndex], "Included aggregate input must reference an exposed non-superseded leaf filing in scope");
    });
  });

  const snapshotIds = new Set(profile.snapshots.map((snapshot) => String(snapshot.id)));
  const sourceIds = new Set(profile.sources.map((source) => String(source.id)));
  profile.snapshots.forEach((snapshot, index) => {
    if (!sourceIds.has(String(snapshot.sourceId))) addIssue(["snapshots", index, "sourceId"], "Profile snapshot references a source outside the profile closure");
  });
  collectProfileSnapshotSeedIds(profile).forEach((id) => {
    if (!snapshotIds.has(id)) addIssue([], "Profile references a snapshot outside the profile closure");
  });
  if (profile.map) {
    if (profile.release.status !== "published") addIssue(["map"], "Map descriptor is available only for the current published release");
    if (profile.map.releaseId !== profile.release.id || profile.map.geographyVersionId !== profile.geography.id || profile.map.url !== `/maps/${profile.release.id}/${profile.geography.id}`) addIssue(["map"], "Map descriptor must be pinned to this profile geography and release");
    if (profile.map.inputSnapshotIds.length !== 1 || profile.map.inputSnapshotIds[0] !== profile.map.artifactSnapshotId) addIssue(["map", "inputSnapshotIds"], "Map artifact requires its sole output snapshot input");
    if (profile.map.derivationInputSnapshotIds.length !== 1 || profile.map.derivationInputSnapshotIds[0] === profile.map.artifactSnapshotId) addIssue(["map", "derivationInputSnapshotIds"], "Map artifact requires exactly one original derivation input distinct from its output");
    const artifactSnapshot = profile.snapshots.find((snapshot) => snapshot.id === profile.map!.artifactSnapshotId);
    const artifactSource = artifactSnapshot && profile.sources.find((source) => source.id === artifactSnapshot.sourceId);
    if (!artifactSnapshot || artifactSnapshot.checksumSha256 !== profile.map.artifactChecksumSha256 || artifactSnapshot.usageStatus !== "approved" || artifactSource?.authority !== "derived") addIssue(["map", "artifactSnapshotId"], "Map artifact snapshot must close to the approved derived artifact checksum");
    const derivationSnapshot = profile.snapshots.find((snapshot) => snapshot.id === profile.map!.derivationInputSnapshotIds[0]);
    const derivationSource = derivationSnapshot && profile.sources.find((source) => source.id === derivationSnapshot.sourceId);
    if (!derivationSnapshot || derivationSnapshot.usageStatus !== "approved" || !derivationSource) addIssue(["map", "derivationInputSnapshotIds"], "Map derivation input must close to an approved source snapshot");
  }
  const decisionYears = new Set(profile.electionDecisions.map((decision) => decision.electionYear));
  const coverageYears = new Set(profile.electionCoverage.map((coverage) => coverage.scope.kind === "election" ? coverage.scope.electionYear : -1));
  if (decisionYears.size !== profile.electionDecisions.length || coverageYears.size !== profile.electionCoverage.length || [...decisionYears].some((year) => !coverageYears.has(year)) || [...coverageYears].some((year) => !decisionYears.has(year))) addIssue(["electionCoverage"], "Election decisions and coverage must close over the same years");
  profile.electionDecisions.forEach((decision, index) => {
    const coverage = profile.electionCoverage.find((candidate) => candidate.scope.kind === "election" && candidate.scope.electionYear === decision.electionYear);
    if (decision.jurisdictionCode !== profile.office.stateCode || !coverage || coverage.scope.kind !== "election" || coverage.scope.jurisdictionCode !== decision.jurisdictionCode) addIssue(["electionDecisions", index], "Election decision and coverage must match the office jurisdiction");
    else {
      const onlyReason = (reason: string): boolean => coverage.missingByReason.length === 1 && coverage.missingByReason[0]?.reason === reason && coverage.missingByReason[0]?.count === 1;
      const coherent = decision.status === "unassessed" ? coverage.status === "not_collected" && coverage.expectedCount === 1 && coverage.observedCount === 0 && coverage.quarantinedCount === 0 && coverage.incompatibleCount === 0 && onlyReason("not_collected") : decision.status === "unavailable" ? coverage.status === "unavailable" && coverage.expectedCount === 1 && coverage.observedCount === 0 && coverage.quarantinedCount === 0 && coverage.incompatibleCount === 0 && onlyReason("not_defensibly_modeled") : coverage.status === "complete" && coverage.expectedCount === 1 && coverage.observedCount === 1 && coverage.quarantinedCount === 0 && coverage.incompatibleCount === 0 && coverage.missingByReason.length === 0;
      if (!coherent) addIssue(["electionCoverage"], "Election coverage must agree with the decision status");
    }
  });
});

export type ElectionMetricSummary = z.infer<typeof electionMetricSummarySchema>;
export type FinanceMetricSummary = z.infer<typeof financeMetricSummarySchema>;
export type SeatListItem = z.infer<typeof seatListItemSchema>;
export type SeatProfile = z.infer<typeof seatProfileSchema>;
export type ReleaseCoverageAggregate = z.infer<typeof releaseCoverageAggregateSchema>;

export const seatPageRequestSchema = seatQuerySchema.extend({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional(),
}).strict();
export const seatPageSchema = z.object({
  releaseId: releaseIdSchema,
  items: z.array(seatListItemSchema),
  nextCursor: z.string().max(500).nullable(),
  total: z.number().int().nonnegative(),
}).strict();
export type SeatPageRequest = z.infer<typeof seatPageRequestSchema>;
export type SeatPage = z.infer<typeof seatPageSchema>;

export interface SeatResearchRepository {
  getActiveRelease(): Promise<DataRelease>;
  getRelease(id: ReleaseId): Promise<DataRelease | null>;
  listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]>;
  listSeatPage(releaseId: ReleaseId, request: SeatPageRequest): Promise<SeatPage>;
  getSeatListItem(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatListItem | null>;
  getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null>;
  getSeatFacets(releaseId: ReleaseId): Promise<SeatFacets>;
  listSources(releaseId: ReleaseId): Promise<readonly Source[]>;
  listSourceSnapshots(releaseId: ReleaseId): Promise<readonly SourceSnapshot[]>;
  listReleaseCoverage(releaseId: ReleaseId): Promise<readonly ReleaseCoverageAggregate[]>;
}

export const seatRouteParamsSchema = z.object({
  releaseId: releaseIdSchema,
  id: seatCycleIdSchema,
}).strict();
