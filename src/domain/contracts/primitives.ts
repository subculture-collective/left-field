import { z } from "zod";

const prefixedId = (prefix: string) =>
  z.string().min(1).refine((value) => value.startsWith(`${prefix}_`), {
    message: `Expected ${prefix}_ identifier`,
  });

export const sourceIdSchema = prefixedId("src").brand<"SourceId">();
export const snapshotIdSchema = prefixedId("snap").brand<"SnapshotId">();
export const releaseIdSchema = prefixedId("rel").brand<"ReleaseId">();
export const districtPlanIdSchema = prefixedId("plan").brand<"DistrictPlanId">();
export const geographyVersionIdSchema = prefixedId("geo").brand<"GeographyVersionId">();
export const geometryArtifactIdSchema = prefixedId("artifact").brand<"GeometryArtifactId">();
export const officeIdSchema = prefixedId("office").brand<"OfficeId">();
export const officeTermIdSchema = prefixedId("term").brand<"OfficeTermId">();
export const membershipIdSchema = prefixedId("member").brand<"MembershipId">();
export const seatCycleIdSchema = prefixedId("seat").brand<"SeatCycleId">();
export const contestIdSchema = prefixedId("contest").brand<"ContestId">();
export const candidacyIdSchema = prefixedId("candidacy").brand<"CandidacyId">();
export const resultOptionIdSchema = prefixedId("option").brand<"ResultOptionId">();
export const committeeIdSchema = prefixedId("committee").brand<"CommitteeId">();
export const committeeRelationshipIdSchema = prefixedId("committee_rel").brand<"CommitteeRelationshipId">();
export const personIdSchema = prefixedId("person").brand<"PersonId">();
export const fecFilingIdSchema = prefixedId("fec").brand<"FecFilingId">();

export type SourceId = z.infer<typeof sourceIdSchema>;
export type SnapshotId = z.infer<typeof snapshotIdSchema>;
export type ReleaseId = z.infer<typeof releaseIdSchema>;
export type DistrictPlanId = z.infer<typeof districtPlanIdSchema>;
export type GeographyVersionId = z.infer<typeof geographyVersionIdSchema>;
export type GeometryArtifactId = z.infer<typeof geometryArtifactIdSchema>;
export type OfficeId = z.infer<typeof officeIdSchema>;
export type OfficeTermId = z.infer<typeof officeTermIdSchema>;
export type MembershipId = z.infer<typeof membershipIdSchema>;
export type SeatCycleId = z.infer<typeof seatCycleIdSchema>;
export type ContestId = z.infer<typeof contestIdSchema>;
export type CandidacyId = z.infer<typeof candidacyIdSchema>;
export type ResultOptionId = z.infer<typeof resultOptionIdSchema>;
export type CommitteeId = z.infer<typeof committeeIdSchema>;
export type PersonId = z.infer<typeof personIdSchema>;
export type FecFilingId = z.infer<typeof fecFilingIdSchema>;

export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const usStateCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);