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

export const seatProfileSchema = z.object({
  release: dataReleaseSchema,
  office: officeSchema,
  seatCycle: seatCycleSchema,
  geography: geographyVersionSchema,
  officeTerm: officeTermSchema,
  membership: membershipSchema.nullable(),
  incumbent: personSchema.nullable(),
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
}).strict();

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
