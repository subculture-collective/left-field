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

export const chamberSchema = z.enum(["house", "senate"]);
export const officeKindSchema = z.enum([
  "house_voting",
  "house_delegate",
  "resident_commissioner",
  "senate",
]);
export const partySchema = z.enum([
  "democratic",
  "republican",
  "independent",
  "other",
]);
export const incumbencyStatusSchema = z.enum([
  "incumbent_running",
  "incumbent_not_running",
  "open",
  "unknown",
]);
export const missingReasonSchema = z.enum([
  "not_applicable",
  "not_collected",
  "not_reported",
  "not_yet_reported",
  "suppressed",
  "unmatched",
  "source_unavailable",
  "not_defensibly_modeled",
]);
export const factStatusSchema = z.enum([
  "certified",
  "official",
  "reported",
  "modeled",
  "estimated",
  "superseded",
]);
export const provenanceRoleSchema = z.enum([
  "original_publisher",
  "intermediary",
  "geometry_source",
  "derived_input",
]);

export type Chamber = z.infer<typeof chamberSchema>;
export type Party = z.infer<typeof partySchema>;
export type MissingReason = z.infer<typeof missingReasonSchema>;

export const provenanceReferenceSchema = z.object({
  snapshotId: snapshotIdSchema,
  role: provenanceRoleSchema,
}).strict();

export const missingValueSchema = z.object({
  kind: z.literal("missing"),
  reason: missingReasonSchema,
}).strict();

export function factValueSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("value"), value: valueSchema }).strict(),
    missingValueSchema,
  ]);
}

export type FactValue<T> =
  | Readonly<{ kind: "value"; value: T }>
  | Readonly<{ kind: "missing"; reason: MissingReason }>;

export function deriveVoteShare(votes: number, denominatorVotes: number): number | null {
  return denominatorVotes === 0 ? null : (votes / denominatorVotes) * 100;
}

export const sourceSchema = z.object({
  id: sourceIdSchema,
  releaseId: releaseIdSchema,
  name: z.string().min(1),
  authority: z.enum(["official", "derived", "editorial"]),
  homepageUrl: z.url(),
}).strict();

export const sourceSnapshotSchema = z.object({
  id: snapshotIdSchema,
  releaseId: releaseIdSchema,
  sourceId: sourceIdSchema,
  sourceUrl: z.url(),
  publishedAt: isoDateTimeSchema.nullable(),
  retrievedAt: isoDateTimeSchema,
  checksumSha256: sha256Schema,
  parserVersion: z.string().min(1),
  license: z.string().min(1),
  usageStatus: z.enum(["approved", "restricted", "review_required"]),
}).strict();

export const dataReleaseSchema = z.object({
  id: releaseIdSchema,
  label: z.string().min(1),
  status: z.enum(["candidate", "published", "retired"]),
  sourceCutoff: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  publishedAt: isoDateTimeSchema.nullable(),
  previousReleaseId: releaseIdSchema.nullable(),
}).strict();

const sourcedRecord = {
  releaseId: releaseIdSchema,
  provenance: z.array(provenanceReferenceSchema).min(1),
};

export const districtPlanSchema = z.object({
  ...sourcedRecord,
  id: districtPlanIdSchema,
  name: z.string().min(1),
  congress: z.number().int().positive(),
  enactedAt: isoDateSchema.nullable(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  jurisdictionStateCode: usStateCodeSchema,
}).strict();

export const geometryArtifactSchema = z.object({
  releaseId: releaseIdSchema,
  id: geometryArtifactIdSchema,
  snapshotId: snapshotIdSchema,
  objectKey: z.string().min(1),
  format: z.enum(["geojson", "shapefile", "geopackage"]),
  srid: z.literal(4326),
  checksumSha256: sha256Schema,
}).strict();

export const geographyVersionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...sourcedRecord,
    id: geographyVersionIdSchema,
    kind: z.literal("house_district"),
    districtPlanId: districtPlanIdSchema,
    geometryArtifactId: geometryArtifactIdSchema,
    sourceGeoid: z.string().min(1),
    label: z.string().min(1),
    vintage: z.string().min(1),
    stateCode: usStateCodeSchema,
    districtCode: z.string().regex(/^(AL|[0-9]{2})$/),
  }).strict(),
  z.object({
    ...sourcedRecord,
    id: geographyVersionIdSchema,
    kind: z.literal("state"),
    geometryArtifactId: geometryArtifactIdSchema,
    sourceGeoid: z.string().min(1),
    label: z.string().min(1),
    vintage: z.string().min(1),
    stateCode: usStateCodeSchema,
  }).strict(),
]);

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
  status: factStatusSchema,
}).strict();

export const contestSchema = z.object({
  ...sourcedRecord,
  id: contestIdSchema,
  seatCycleId: seatCycleIdSchema,
  kind: z.enum([
    "president_general",
    "house_general",
    "senate_general",
    "democratic_presidential_primary",
  ]),
  round: z.enum(["primary", "runoff", "general"]),
  electionDate: isoDateSchema,
  geographyVersionId: geographyVersionIdSchema,
  certificationStatus: z.enum(["certified", "official_unfinalized", "unofficial", "modeled", "unavailable"]),
  reportingCompletenessPercent: z.number().min(0).max(100),
  denominatorVotes: factValueSchema(z.number().int().nonnegative()),
  reportingUnit: z.enum(["district", "precinct", "county", "state", "mixed"]),
  allocationMethod: z.enum(["none", "precinct_overlay", "population_crosswalk", "other"]),
  allocationCoveragePercent: factValueSchema(z.number().min(0).max(100)),
  lineage: lineageSchema,
}).strict();

export const candidacySchema = z.object({
  ...sourcedRecord,
  id: candidacyIdSchema,
  contestId: contestIdSchema,
  personId: personIdSchema.nullable(),
  party: partySchema,
  status: z.enum(["filed", "qualified", "withdrawn", "nominee", "write_in"]),
}).strict();

export const resultOptionSchema = z.object({
  ...sourcedRecord,
  id: resultOptionIdSchema,
  contestId: contestIdSchema,
  candidacyId: candidacyIdSchema.nullable(),
  label: z.string().min(1),
  party: partySchema.nullable(),
  optionKind: z.enum(["candidate", "write_in_total", "other"]),
}).strict();

export const electionResultSchema = z.object({
  releaseId: releaseIdSchema,
  contestId: contestIdSchema,
  resultOptionId: resultOptionIdSchema,
  votes: factValueSchema(z.number().int().nonnegative()),
  lineage: lineageSchema,
}).strict();

export const acsObservationSchema = z.object({
  releaseId: releaseIdSchema,
  geographyVersionId: geographyVersionIdSchema,
  variable: z.string().min(1),
  label: z.string().min(1),
  estimate: factValueSchema(z.number()),
  marginOfError: factValueSchema(z.number().nonnegative()),
  unit: z.enum(["count", "percent", "usd"]),
  surveyPeriod: z.string().min(1),
  universe: z.string().min(1),
  lineage: lineageSchema,
}).strict();

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

export type Source = z.infer<typeof sourceSchema>;
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type DataRelease = z.infer<typeof dataReleaseSchema>;
export type DistrictPlan = z.infer<typeof districtPlanSchema>;
export type GeometryArtifact = z.infer<typeof geometryArtifactSchema>;
export type GeographyVersion = z.infer<typeof geographyVersionSchema>;
export type Office = z.infer<typeof officeSchema>;
export type OfficeTerm = z.infer<typeof officeTermSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type SeatCycle = z.infer<typeof seatCycleSchema>;
export type Contest = z.infer<typeof contestSchema>;
export type Candidacy = z.infer<typeof candidacySchema>;
export type ResultOption = z.infer<typeof resultOptionSchema>;
export type Person = z.infer<typeof personSchema>;
export type ElectionResult = z.infer<typeof electionResultSchema>;
export type AcsObservation = z.infer<typeof acsObservationSchema>;
export type Committee = z.infer<typeof committeeSchema>;
export type CommitteeRelationship = z.infer<typeof committeeRelationshipSchema>;
export type FecFilingSummary = z.infer<typeof fecFilingSummarySchema>;
export type SeatFinanceSummary = z.infer<typeof seatFinanceSummarySchema>;

export const prototypeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  canonicalDataChecksumSha256: sha256Schema,
  profileSeatCycleIds: z.array(seatCycleIdSchema).min(10).max(12),
  release: dataReleaseSchema,
  sources: z.array(sourceSchema).min(1),
  snapshots: z.array(sourceSnapshotSchema).min(1),
  districtPlans: z.array(districtPlanSchema).min(1),
  geometryArtifacts: z.array(geometryArtifactSchema).min(1),
  geographyVersions: z.array(geographyVersionSchema).min(1),
  offices: z.array(officeSchema).min(1),
  people: z.array(personSchema),
  officeTerms: z.array(officeTermSchema).min(1),
  memberships: z.array(membershipSchema),
  seatCycles: z.array(seatCycleSchema).min(1),
  contests: z.array(contestSchema),
  candidacies: z.array(candidacySchema),
  resultOptions: z.array(resultOptionSchema),
  electionResults: z.array(electionResultSchema),
  acsObservations: z.array(acsObservationSchema),
  committees: z.array(committeeSchema),
  committeeRelationships: z.array(committeeRelationshipSchema),
  fecFilingSummaries: z.array(fecFilingSummarySchema),
  financeSummaries: z.array(seatFinanceSummarySchema),
}).strict();

export type PrototypeManifest = z.infer<typeof prototypeManifestSchema>;
