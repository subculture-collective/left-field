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
  electionResultSchema,
  factStatusSchema,
  factValueSchema,
  fecFilingIdSchema,
  fecFilingSummarySchema,
  financeAggregateSchema,
  geographyVersionIdSchema,
  geographyVersionSchema,
  incumbencyStatusSchema,
  isoDateSchema,
  isoDateTimeSchema,
  membershipSchema,
  missingReasonSchema,
  officeSchema,
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
export const profileAcsAvailabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("observations") }).strict(),
  z.object({ kind: z.literal("no_observations") }).strict(),
  z.object({ kind: z.literal("incompatible_geography") }).strict(),
]);

export const seatProfileSchema = z.object({
  release: dataReleaseSchema,
  office: officeSchema,
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
  const visitReferences = (value: unknown, path: (string | number)[]): void => {
    if (Array.isArray(value)) { value.forEach((item, index) => visitReferences(item, [...path, index])); return; }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.snapshotId === "string" && !snapshotIds.has(record.snapshotId)) addIssue([...path, "snapshotId"], "Profile references a snapshot outside the profile closure");
    if (Array.isArray(record.inputSnapshotIds)) record.inputSnapshotIds.forEach((id, index) => {
      if (typeof id === "string" && !snapshotIds.has(id)) addIssue([...path, "inputSnapshotIds", index], "Profile references a snapshot outside the profile closure");
    });
    Object.entries(record).forEach(([key, item]) => {
      if (key !== "snapshotId" && key !== "inputSnapshotIds") visitReferences(item, [...path, key]);
    });
  };
  visitReferences(profile, []);
});

export type ElectionMetricSummary = z.infer<typeof electionMetricSummarySchema>;
export type FinanceMetricSummary = z.infer<typeof financeMetricSummarySchema>;
export type SeatListItem = z.infer<typeof seatListItemSchema>;
export type SeatProfile = z.infer<typeof seatProfileSchema>;

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
}

export const seatRouteParamsSchema = z.object({
  releaseId: releaseIdSchema,
  id: seatCycleIdSchema,
}).strict();
