import { z } from "zod";

import {
  acsVariableSchema, committeeAssignmentSchema, coverageRecordSchema,
  electionDecisionSchema, financeAggregateSchema, fundingCategoryAggregateSchema, mapArtifactSchema,
  outsideSpendingAggregateSchema, personBiographicalFactSchema, prototypeManifestSchema, fundingOrganizationAggregateSchema,
  seatCycleIdSchema, snapshotDerivationSchema, usStateCodeSchema,
} from "./contracts";

export const jurisdictionRepresentationSchema = z.strictObject({
  jurisdictionCode: usStateCodeSchema,
  houseRepresentation: z.enum(["voting", "delegate", "resident_commissioner"]),
  senateRepresentation: z.enum(["two_seats", "none"]),
});

export const nationwideManifestSchema = prototypeManifestSchema.omit({ schemaVersion: true, profileSeatCycleIds: true }).extend({
  schemaVersion: z.literal(2), catalogSeatCycleIds: z.array(seatCycleIdSchema).min(1),
  jurisdictions: z.array(jurisdictionRepresentationSchema).min(1), coverageRecords: z.array(coverageRecordSchema),
  biographicalFacts: z.array(personBiographicalFactSchema), committeeAssignments: z.array(committeeAssignmentSchema),
  acsVariables: z.array(acsVariableSchema), financeAggregates: z.array(financeAggregateSchema),
  fundingCategoryAggregates: z.array(fundingCategoryAggregateSchema), fundingOrganizationAggregates: z.array(fundingOrganizationAggregateSchema), outsideSpendingAggregates: z.array(outsideSpendingAggregateSchema),
  electionDecisions: z.array(electionDecisionSchema), mapArtifacts: z.array(mapArtifactSchema), snapshotDerivations: z.array(snapshotDerivationSchema),
}).strict();

export const releaseManifestSchema = z.discriminatedUnion("schemaVersion", [prototypeManifestSchema, nationwideManifestSchema]);
export type NationwideManifest = z.infer<typeof nationwideManifestSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export function parseReleaseManifest(input: unknown): ReleaseManifest { return releaseManifestSchema.parse(input); }
