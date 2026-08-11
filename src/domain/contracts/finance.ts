import { z } from "zod";
import { releaseIdSchema, seatCycleIdSchema, committeeIdSchema, committeeRelationshipIdSchema, candidacyIdSchema, fecFilingIdSchema, isoDateSchema, isoDateTimeSchema, snapshotIdSchema, sha256Schema, usStateCodeSchema } from "./primitives";
import { missingReasonSchema, provenanceReferenceSchema, factValueSchema } from "./shared";
import { lineageSchema } from "./identity";

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const committeeSchema = z.object({
  ...sourcedRecord,
  id: committeeIdSchema,
  sourceCommitteeId: z.string().min(1),
  name: z.string().min(1),
  committeeType: z.string().min(1),
}).strict();

export const committeeRelationshipSchema = z.object({
  ...sourcedRecord,
  id: committeeRelationshipIdSchema,
  committeeId: committeeIdSchema,
  candidacyId: candidacyIdSchema,
  relationship: z.enum(["principal_campaign_committee", "authorized"]),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
}).strict();

export const CANONICAL_FEC_AMENDMENT_RULE =
  "For each committee, report type, and reporting period, select the non-superseded filing with the highest amendment number; reject branching or cyclic amendment chains." as const;

export const fecFilingSummarySchema = z.object({
  releaseId: releaseIdSchema,
  id: fecFilingIdSchema,
  seatCycleId: seatCycleIdSchema,
  committeeId: committeeIdSchema,
  sourceFilingId: z.string().min(1),
  reportType: z.string().min(1),
  reportingPeriodStart: isoDateSchema,
  reportingPeriodEnd: isoDateSchema,
  filedAt: isoDateTimeSchema,
  amendmentNumber: z.number().int().nonnegative(),
  amendmentStatus: z.enum(["new", "amended", "superseded"]),
  amendsFilingId: fecFilingIdSchema.nullable(),
  cashOnHand: factValueSchema(z.number().nonnegative()),
  totalReceipts: factValueSchema(z.number().nonnegative()),
  totalDisbursements: factValueSchema(z.number().nonnegative()),
  lineage: lineageSchema,
}).strict();

export const seatFinanceSummarySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("value"),
    releaseId: releaseIdSchema,
    seatCycleId: seatCycleIdSchema,
    filingId: fecFilingIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("missing"),
    releaseId: releaseIdSchema,
    seatCycleId: seatCycleIdSchema,
    reason: missingReasonSchema,
    asOf: isoDateSchema,
    inputs: z.array(provenanceReferenceSchema).min(1),
  }).strict(),
]);

export const financeCommitteeInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("included"), committeeId: committeeIdSchema, filingId: fecFilingIdSchema }),
  z.strictObject({ kind: z.literal("missing"), committeeId: committeeIdSchema, reason: missingReasonSchema }),
]);
const strictFinanceAggregateSchema = z.strictObject({
  id: z.string().min(1), releaseId: releaseIdSchema, seatCycleId: seatCycleIdSchema, asOf: isoDateSchema, coverageThrough: isoDateSchema, reportingPeriodStart: isoDateSchema,
  cashOnHand: factValueSchema(z.number().nonnegative()), receipts: factValueSchema(z.number().nonnegative()), disbursements: factValueSchema(z.number().nonnegative()),
  methodologyVersion: z.string().min(1), committeeInputs: z.array(financeCommitteeInputSchema).min(1),
});
export const financeAggregateSchema = strictFinanceAggregateSchema;
export const fundingCategoryAggregateSchema = z.strictObject({
  releaseId: releaseIdSchema, seatCycleId: seatCycleIdSchema, category: z.string().min(1), amount: factValueSchema(z.number().nonnegative()),
  coverageThrough: isoDateSchema, methodologyVersion: z.string().min(1), inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});
/** Licensed organization-level funding is distinct from a reporting category. */
export const fundingOrganizationAggregateSchema = z.strictObject({
  id: z.string().min(1), releaseId: releaseIdSchema, seatCycleId: seatCycleIdSchema,
  organizationName: z.string().min(1), organizationExternalId: z.string().min(1).nullable(),
  amount: factValueSchema(z.number().nonnegative()), coverageThrough: isoDateSchema,
  methodologyVersion: z.string().min(1), inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});
export const outsideSpendingAggregateSchema = z.strictObject({
  releaseId: releaseIdSchema, seatCycleId: seatCycleIdSchema, supportAmount: factValueSchema(z.number().nonnegative()), opposeAmount: factValueSchema(z.number().nonnegative()),
  coverageThrough: isoDateSchema, methodologyVersion: z.string().min(1), inputSnapshotIds: z.array(snapshotIdSchema).min(1),
});
export const electionDecisionSchema = z.strictObject({
  id: z.string().min(1), releaseId: releaseIdSchema, jurisdictionCode: usStateCodeSchema, electionYear: z.number().int(),
  status: z.enum(["unassessed", "approved", "unavailable"]), inputSnapshotIds: z.array(snapshotIdSchema),
}).superRefine((value, context) => { if (value.status === "unassessed" && value.inputSnapshotIds.length !== 0) context.addIssue({ code: "custom", path: ["inputSnapshotIds"], message: "Unassessed decisions have no input snapshots" }); if (value.status !== "unassessed" && value.inputSnapshotIds.length !== 1) context.addIssue({ code: "custom", path: ["inputSnapshotIds"], message: "Reviewed decisions require exactly one decision snapshot" }); });

export type Committee = z.infer<typeof committeeSchema>;
export type CommitteeRelationship = z.infer<typeof committeeRelationshipSchema>;
export type FecFilingSummary = z.infer<typeof fecFilingSummarySchema>;
export type SeatFinanceSummary = z.infer<typeof seatFinanceSummarySchema>;

/** V2-only coverage vocabulary; legacy missing_reason remains unchanged. */
export const financeCoverageOutcomeSchema = z.enum([
  "complete_zero", "complete_nonzero", "source_unavailable", "paper_filing_unreviewed",
  "unsupported_layout", "malformed_filing", "enumeration_unstable", "unscoped_global_block",
  "ambiguous_notice_pair", "unresolved_election_mapping",
]);
export type FinanceCoverageOutcome = z.infer<typeof financeCoverageOutcomeSchema>;