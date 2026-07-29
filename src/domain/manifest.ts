import { z } from "zod";

import {
  acsVariableSchema, committeeAssignmentSchema, coverageRecordSchema,
  electionDecisionSchema, financeAggregateSchema, fundingCategoryAggregateSchema, mapArtifactSchema,
  outsideSpendingAggregateSchema, personBiographicalFactSchema, prototypeManifestSchema, fundingOrganizationAggregateSchema,
  seatCycleIdSchema, snapshotDerivationSchema, usStateCodeSchema, fecV2ExactElectionAggregateSchema, fecV2AcquisitionOutcomeManifestSchema,
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
  // Optional preserves canonical legacy manifest bytes when V2 is absent. A
  // persisted V2 plan is checked by the seeder/loader, where that evidence is
  // available, and then requires this field even when no outcomes occurred.
  fecV2ExactElectionAggregates: z.array(fecV2ExactElectionAggregateSchema).optional(),
  fecV2AcquisitionOutcomes: z.array(fecV2AcquisitionOutcomeManifestSchema).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const key = `${row.fileNumber}:${row.entryIdentitySha256}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "FEC V2 acquisition outcomes must be unique" });
      seen.add(key);
      if (i > 0) {
        const previous = rows[i - 1]!;
        if (previous.fileNumber > row.fileNumber || (previous.fileNumber === row.fileNumber && previous.entryIdentitySha256 >= row.entryIdentitySha256)) ctx.addIssue({ code: "custom", path: [i], message: "FEC V2 acquisition outcomes must be numeric/C-sorted" });
      }
    }
  }).optional(),
}).strict();

export const releaseManifestSchema = z.discriminatedUnion("schemaVersion", [prototypeManifestSchema, nationwideManifestSchema]);
export type NationwideManifest = z.infer<typeof nationwideManifestSchema>;
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export function parseReleaseManifest(input: unknown): ReleaseManifest { return releaseManifestSchema.parse(input); }
