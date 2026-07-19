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
import type { DataRelease, ReleaseId, SeatCycleId, Source } from "@/domain/contracts";

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

export const electionMetricSummarySchema = z.object({
  value: factValueSchema(z.number()),
  geographyVersionId: geographyVersionIdSchema,
  status: factStatusSchema,
  asOf: isoDateSchema,
  methodology: z.string().min(1),
  inputSnapshotIds: z.array(snapshotIdSchema).min(1),
}).strict();

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

export interface SeatResearchRepository {
  getActiveRelease(): Promise<DataRelease>;
  getRelease(id: ReleaseId): Promise<DataRelease | null>;
  listSeats(releaseId: ReleaseId, query: SeatQuery): Promise<readonly SeatListItem[]>;
  getSeatProfile(releaseId: ReleaseId, id: SeatCycleId): Promise<SeatProfile | null>;
  listSources(releaseId: ReleaseId): Promise<readonly Source[]>;
}

export const seatRouteParamsSchema = z.object({
  releaseId: releaseIdSchema,
  id: seatCycleIdSchema,
}).strict();
