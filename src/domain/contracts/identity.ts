import { z } from "zod";
import { releaseIdSchema, officeIdSchema, officeTermIdSchema, membershipIdSchema, personIdSchema, seatCycleIdSchema, geographyVersionIdSchema, isoDateSchema, usStateCodeSchema } from "./primitives";
import { chamberSchema, officeKindSchema, partySchema, incumbencyStatusSchema, provenanceReferenceSchema } from "./shared";

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const officeSchema = z.object({
  ...sourcedRecord,
  id: officeIdSchema,
  chamber: chamberSchema,
  kind: officeKindSchema,
  stateCode: usStateCodeSchema,
  districtCode: z.string().regex(/^(AL|[0-9]{2})$/).nullable(),
  senateClass: z.number().int().min(1).max(3).nullable(),
}).strict();

export const personSchema = z.object({
  ...sourcedRecord,
  id: personIdSchema,
  displayName: z.string().min(1),
  birthDate: isoDateSchema.nullable(),
  bioguideId: z.string().min(1).nullable(),
}).strict();

export const officeTermSchema = z.object({
  ...sourcedRecord,
  id: officeTermIdSchema,
  officeId: officeIdSchema,
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
}).strict();

export const membershipSchema = z.object({
  ...sourcedRecord,
  id: membershipIdSchema,
  officeTermId: officeTermIdSchema,
  personId: personIdSchema,
  party: partySchema,
  startsAt: isoDateSchema,
  endsAt: isoDateSchema.nullable(),
}).strict();

export const seatCycleSchema = z.object({
  ...sourcedRecord,
  id: seatCycleIdSchema,
  officeId: officeIdSchema,
  officeTermId: officeTermIdSchema,
  geographyVersionId: geographyVersionIdSchema,
  cycleYear: z.number().int().min(1788).max(2200),
  electionDate: isoDateSchema.nullable(),
  electionKind: z.enum(["regular", "special"]),
  incumbencyStatus: incumbencyStatusSchema,
  occupancy: z.object({
    status: z.enum(["occupied", "vacant", "unknown"]),
    asOf: isoDateSchema,
  }).strict(),
}).strict();

export const lineageSchema = z.object({
  inputs: z.array(provenanceReferenceSchema).min(1),
  asOf: isoDateSchema,
  methodology: z.string().min(1),
  status: z.enum(["certified", "official", "reported", "modeled", "estimated", "superseded"]),
}).strict();

export type Office = z.infer<typeof officeSchema>;
export type OfficeTerm = z.infer<typeof officeTermSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type SeatCycle = z.infer<typeof seatCycleSchema>;
export type Person = z.infer<typeof personSchema>;