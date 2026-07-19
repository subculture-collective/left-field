import { createHash } from "node:crypto";
import type { z } from "zod";

import type { BoundaryBundle } from "@/db/manifest";
import { createNationalTigerManifest, parseNationalTigerArtifacts } from "@/ingestion/tiger/national";
import type { TigerEnvelopeV1 } from "@/ingestion/tiger/adapter";
import { compiledFactsSha256, replayIdentityFacts, type IdentityEnvelopeV1 } from "@/ingestion/identity/adapter";
import { sourceSchema, sourceSnapshotSchema } from "@/domain/contracts";
import { nationwideManifestSchema, type NationwideManifest } from "@/domain/manifest";
import { computeCanonicalDataChecksum, NATIONWIDE_SEAT_POLICY, validateReleaseManifest } from "@/domain/validate-manifest";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const text = (value: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(value);
const stable = (prefix: string, value: string) => `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
const party = (value: string | null) => value === "D" || value === "Democrat" ? "democratic" as const : value === "R" || value === "Republican" ? "republican" as const : value === "I" || value === "Independent" ? "independent" as const : "other" as const;
const noSenate = new Set(["DC", "PR", "AS", "GU", "MP", "VI"]);
const fipsByState = { AL:"01", AK:"02", AZ:"04", AR:"05", CA:"06", CO:"08", CT:"09", DE:"10", DC:"11", FL:"12", GA:"13", HI:"15", ID:"16", IL:"17", IN:"18", IA:"19", KS:"20", KY:"21", LA:"22", ME:"23", MD:"24", MA:"25", MI:"26", MN:"27", MS:"28", MO:"29", MT:"30", NE:"31", NV:"32", NH:"33", NJ:"34", NM:"35", NY:"36", NC:"37", ND:"38", OH:"39", OK:"40", OR:"41", PA:"42", RI:"44", SC:"45", SD:"46", TN:"47", TX:"48", UT:"49", VT:"50", VA:"51", WA:"53", WV:"54", WI:"55", WY:"56", AS:"60", GU:"66", MP:"69", PR:"72", VI:"78" } as const;
type State = keyof typeof fipsByState;
type NationwideManifestInput = z.input<typeof nationwideManifestSchema>;
type NationwideManifestDraft = Omit<NationwideManifestInput, "canonicalDataChecksumSha256">;
const compareBytewise = (left: string, right: string) => Buffer.compare(Buffer.from(left), Buffer.from(right));

export interface NationwideCandidateOptions {
  readonly release: { readonly id: string; readonly label: string; readonly sourceCutoff: string; readonly createdAt: string };
  readonly sourceLockSha256: string;
  readonly identity: IdentityEnvelopeV1;
  readonly tiger: TigerEnvelopeV1;
  readonly tigerComponents: { readonly cd119Bytes: Uint8Array; readonly statesBytes: Uint8Array };
  readonly sources: readonly [z.input<typeof sourceSchema>, z.input<typeof sourceSchema>];
  readonly snapshots: readonly [z.input<typeof sourceSnapshotSchema>, z.input<typeof sourceSnapshotSchema>];
}
export interface NationwideCandidateCompilation { readonly manifest: NationwideManifest; readonly boundaryBundle: BoundaryBundle; }

/** Pure compilation seam: callers supply every retained byte and every output object key. */
export function compileNationwideCandidate(options: NationwideCandidateOptions): NationwideCandidateCompilation {
  if (!/^[a-f0-9]{64}$/.test(options.sourceLockSha256) || options.identity.sourceLockSha256 !== options.sourceLockSha256 || options.tiger.sourceLockSha256 !== options.sourceLockSha256 || options.identity.components.house.lockId !== "house-xml" || options.identity.components.senate.lockId !== "senate-xml" || options.identity.components.senateServiceStarts.lockId !== "senate-service-starts" || options.tiger.lockIds.cd119 !== "geo-national-cd119" || options.tiger.lockIds.states !== "geo-national-states" || options.tiger.lockIds.manifest !== "geo-national-manifest" || options.tiger.lockIds.bundle !== "geo-national-bundle") throw new Error("NATIONWIDE_CANDIDATE_SOURCE_LOCK_MISMATCH");
  const cutoff = options.release.sourceCutoff.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error("NATIONWIDE_CANDIDATE_INVALID_CUTOFF");
  if (options.identity.releaseCutoff !== cutoff) throw new Error("NATIONWIDE_CANDIDATE_CUTOFF_MISMATCH");
  const sources = options.sources.map(source => sourceSchema.parse(source)); const snapshots = options.snapshots.map(snapshot => sourceSnapshotSchema.parse(snapshot));
  if (new Set(sources.map(source => source.id)).size !== 2 || new Set(snapshots.map(snapshot => snapshot.id)).size !== 2 || sources.some(source => source.releaseId !== options.release.id || source.authority !== "derived") || new Set(sources.map(source => source.name)).size !== 2 || !["identity", "tiger"].every(name => sources.some(source => source.name === name)) || snapshots.some(snapshot => snapshot.releaseId !== options.release.id || snapshot.usageStatus !== "approved") || snapshots.some(snapshot => !sources.some(source => source.id === snapshot.sourceId))) throw new Error("NATIONWIDE_CANDIDATE_METADATA_INVALID");
  const identitySnapshot = snapshots.find(snapshot => snapshot.parserVersion === options.identity.parserVersion); const tigerSnapshot = snapshots.find(snapshot => snapshot.parserVersion === options.tiger.parserVersion);
  if (!identitySnapshot || !tigerSnapshot || identitySnapshot === tigerSnapshot) throw new Error("NATIONWIDE_CANDIDATE_PARSER_MISMATCH");
  const { cd119Bytes, statesBytes } = options.tigerComponents;
  const identityRows = replayIdentityFacts(options.identity);
  if (!options.identity.compiledFactsSha256 || compiledFactsSha256(options.identity, identityRows) !== options.identity.compiledFactsSha256) throw new Error("NATIONWIDE_CANDIDATE_IDENTITY_DIGEST_MISMATCH");
  const tiger = parseNationalTigerArtifacts(JSON.parse(text(cd119Bytes)), JSON.parse(text(statesBytes)));
  if (cd119Bytes.byteLength !== options.tiger.components.cd119.byteSize || statesBytes.byteLength !== options.tiger.components.states.byteSize || sha256(cd119Bytes) !== options.tiger.components.cd119.sha256 || sha256(statesBytes) !== options.tiger.components.states.sha256 || sha256(cd119Bytes) !== options.tiger.manifest.artifacts.cd119Sha256 || sha256(statesBytes) !== options.tiger.manifest.artifacts.statesSha256) throw new Error("NATIONWIDE_CANDIDATE_TIGER_RECEIPT_MISMATCH");
  createNationalTigerManifest(options.tiger.manifest.sourceArchives, options.tiger.manifest.artifacts.cd119Sha256, options.tiger.manifest.artifacts.statesSha256, tiger);
  const releaseId = options.release.id; const identitySnap = identitySnapshot.id; const tigerSnap = tigerSnapshot.id;
  const geographies = [...tiger.cd119.map((x) => ({ ...x, kind: "house_district" as const })), ...tiger.states.map((x) => ({ ...x, kind: "state" as const }))].sort((a, b) => compareBytewise(a.sourceGeoid, b.sourceGeoid));
  const records = identityRows.map((row) => {
    const key = row.office.chamber === "house" ? `house_${row.office.stateCode}_${row.office.districtCode}` : `senate_${row.office.stateCode}_${row.office.senateClass}`;
    const seats = row.office.chamber === "house" ? options.identity.houseUniverse.filter(seat => seat.stateCode === row.office.stateCode && seat.districtCode === row.office.districtCode && seat.kind === row.office.kind) : options.identity.senateUniverse.filter(seat => seat.stateCode === row.office.stateCode && seat.senateClass === row.office.senateClass);
    if (seats.length !== 1) throw new Error("NATIONWIDE_CANDIDATE_UNIVERSE_MATCH_INVALID");
    const universeSeat = seats[0]!;
    const termStartsAt = row.person ? row.membership?.termStartsAt : universeSeat.termStartsAt;
    const termEndsAt = row.person ? row.membership?.termEndsAt : universeSeat.termEndsAt;
    if (!termStartsAt || !termEndsAt) throw new Error("NATIONWIDE_CANDIDATE_TERM_MISSING");
    const officeId = stable("office", key); const termId = stable("term", `${key}_${termEndsAt}`);
    const geo = row.office.chamber === "house" ? geographies.find((x) => x.kind === "house_district" && x.stateCode === row.office.stateCode && x.districtCode === row.office.districtCode)! : geographies.find((x) => x.kind === "state" && x.stateCode === row.office.stateCode)!;
    return { row, key, officeId, termId, termStartsAt, termEndsAt, geoId: stable("geo", `${geo.kind}_${geo.sourceGeoid}`), geo };
  });
  const provenance = (snapshotId: string) => [{ snapshotId, role: "derived_input" as const }];
  const identitySnapshotIds = [identitySnap];
  const catalogSeatCycleIds: NationwideManifestInput["catalogSeatCycleIds"] = records.map((r) => stable("seat", `${r.key}_current`));
  const coverageRecords: NationwideManifestInput["coverageRecords"] = [];
  const electionDecisions: NationwideManifestInput["electionDecisions"] = [];
  const geographyVersions: NationwideManifestInput["geographyVersions"] = geographies.map((g) => {
    if (g.kind === "house_district") {
      if (g.districtCode === null || g.label === undefined) throw new Error("NATIONWIDE_CANDIDATE_INVALID_TIGER_GEOGRAPHY");
      return { id: stable("geo", `house_district_${g.sourceGeoid}`), releaseId, kind: g.kind, districtPlanId: stable("plan", `${g.stateCode}_cd119`), geometryArtifactId: "artifact_tiger_national_cd119", sourceGeoid: g.sourceGeoid, label: g.label, vintage: "2025", stateCode: g.stateCode, districtCode: g.districtCode, provenance: provenance(tigerSnap) };
    }
    return { id: stable("geo", `state_${g.sourceGeoid}`), releaseId, kind: g.kind, geometryArtifactId: "artifact_tiger_national_states", sourceGeoid: g.sourceGeoid, label: g.stateCode, vintage: "2025", stateCode: g.stateCode, provenance: provenance(tigerSnap) };
  });
  const coverage = (
    domain: NationwideManifestInput["coverageRecords"][number]["domain"],
    scope: NationwideManifestInput["coverageRecords"][number]["scope"],
    status: NationwideManifestInput["coverageRecords"][number]["status"],
    expectedCount: number,
    observedCount: number,
    missing: number,
    inputSnapshotIds: NationwideManifestInput["coverageRecords"][number]["inputSnapshotIds"],
  ) => coverageRecords.push({ releaseId, domain, scope, status, expectedCount, observedCount, missingByReason: missing ? [{ reason: "not_collected", count: missing }] : [], quarantinedCount: 0, incompatibleCount: 0, inputSnapshotIds });
  coverage("identity", { kind: "release" }, "complete", 541, 541, 0, identitySnapshotIds); coverage("geography", { kind: "release" }, "complete", 491, 491, 0, [tigerSnap]); coverage("member", { kind: "release" }, "not_collected", 537, 0, 537, identitySnapshotIds); coverage("acs", { kind: "release" }, "not_collected", 1, 0, 1, [tigerSnap]); coverage("maps", { kind: "release" }, "not_collected", 497, 0, 497, [tigerSnap]);
  for (const seatCycleId of catalogSeatCycleIds) for (const fundingKind of ["summary", "category", "organization", "outside_spending"] as const) coverage("finance", { kind: "funding", seatCycleId, fundingKind }, "not_collected", 1, 0, 1, identitySnapshotIds);
  for (const state of Object.keys(NATIONWIDE_SEAT_POLICY)) for (const electionYear of [2020, 2022, 2024] as const) { electionDecisions.push({ id: stable("election_decision", `${state}_${electionYear}`), releaseId, jurisdictionCode: state, electionYear, status: "unavailable", inputSnapshotIds: identitySnapshotIds }); coverage(`election_${electionYear}`, { kind: "election", jurisdictionCode: state, electionYear }, "not_collected", 1, 0, 1, identitySnapshotIds); }
  const manifestDraft: NationwideManifestDraft = {
    schemaVersion: 2, catalogSeatCycleIds,
    release: { ...options.release, status: "candidate", publishedAt: null, previousReleaseId: null },
    sources, snapshots,
    districtPlans: (Object.keys(fipsByState) as State[]).map((state) => ({ id:stable("plan",`${state}_cd119`),releaseId,name:`${state} congressional districts, 119th Congress`,congress:119,enactedAt:null,effectiveFrom:"2025-01-03",effectiveTo:null,jurisdictionStateCode:state,provenance:provenance(tigerSnap) })),
    geometryArtifacts: [{id:"artifact_tiger_national_cd119",releaseId,snapshotId:tigerSnap,objectKey:options.tiger.components.cd119.objectKey,format:"geojson",srid:4326,checksumSha256:sha256(cd119Bytes)},{id:"artifact_tiger_national_states",releaseId,snapshotId:tigerSnap,objectKey:options.tiger.components.states.objectKey,format:"geojson",srid:4326,checksumSha256:sha256(statesBytes)}],
    geographyVersions,
    offices: records.map((r) => ({id:r.officeId,releaseId,chamber:r.row.office.chamber,kind:r.row.office.kind === "representative" ? "house_voting" : r.row.office.kind === "senator" ? "senate" : r.row.office.kind === "delegate" ? "house_delegate" : "resident_commissioner",districtCode:r.row.office.districtCode,senateClass:r.row.office.senateClass,stateCode:r.row.office.stateCode,provenance:provenance(identitySnap)})),
    people: records.filter((r) => r.row.person).map((r) => ({id:stable("person",r.row.person!.bioguideId),releaseId,displayName:r.row.person!.displayName,birthDate:null,bioguideId:r.row.person!.bioguideId,provenance:provenance(identitySnap)})),
    officeTerms: records.map((r) => ({id:r.termId,releaseId,officeId:r.officeId,startsAt:r.termStartsAt,endsAt:r.termEndsAt,provenance:provenance(identitySnap)})),
    memberships: records.filter((r) => r.row.person && r.row.membership).map((r) => ({id:stable("member",r.key),releaseId,officeTermId:r.termId,personId:stable("person",r.row.person!.bioguideId),party:party(r.row.membership!.party),startsAt:r.row.membership!.termStartsAt!,endsAt:r.row.membership!.termEndsAt!,provenance:provenance(identitySnap)})),
    seatCycles: records.map((r) => ({id:stable("seat",`${r.key}_current`),releaseId,officeId:r.officeId,officeTermId:r.termId,geographyVersionId:r.geoId,cycleYear:r.row.office.chamber === "house" ? 2024 : Number(r.termEndsAt.slice(0,4))-1,electionDate:null,electionKind:"regular",incumbencyStatus:"unknown",occupancy:{status:r.row.person ? "occupied" : "vacant",asOf:cutoff},provenance:provenance(identitySnap)})),
    contests:[],candidacies:[],resultOptions:[],electionResults:[],acsObservations:[],committees:[],committeeRelationships:[],fecFilingSummaries:[],financeSummaries:[],biographicalFacts:[],committeeAssignments:[],acsVariables:[],financeAggregates:[],fundingCategoryAggregates:[],fundingOrganizationAggregates:[],outsideSpendingAggregates:[],mapArtifacts:[],snapshotDerivations:[],
    jurisdictions: (Object.keys(fipsByState) as State[]).map((state) => ({jurisdictionCode:state,houseRepresentation:["DC","AS","GU","MP","VI"].includes(state)?"delegate":state==="PR"?"resident_commissioner":"voting",senateRepresentation:noSenate.has(state)?"none":"two_seats"})), coverageRecords, electionDecisions,
  };
  const typedDraft = nationwideManifestSchema.parse({ ...manifestDraft, canonicalDataChecksumSha256: "0".repeat(64) });
  const manifest: NationwideManifest = { ...typedDraft, canonicalDataChecksumSha256: computeCanonicalDataChecksum(typedDraft) };
  const parsed = validateReleaseManifest(manifest); if (!parsed.success || parsed.data.schemaVersion !== 2) throw new Error(`NATIONWIDE_CANDIDATE_INVALID:${parsed.success ? "version" : parsed.issues.map((x) => x.message).join(";")}`);
  return { manifest: parsed.data, boundaryBundle:[{artifactId:"artifact_tiger_national_cd119",objectKey:options.tiger.components.cd119.objectKey,bytes:Buffer.from(cd119Bytes)},{artifactId:"artifact_tiger_national_states",objectKey:options.tiger.components.states.objectKey,bytes:Buffer.from(statesBytes)}] };
}
