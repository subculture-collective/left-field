import type { PrototypeManifest } from "@/domain/contracts";
import { computeCanonicalDataChecksum } from "@/domain/validate-manifest";
import { createHash } from "node:crypto";
import type { BoundaryBundle } from "@/db/manifest";

export const checksum = "a".repeat(64);
export const timestamp = "2024-01-01T00:00:00.000Z";
export const provenance = [{ snapshotId: "snap_1", role: "original_publisher" }] as const;
export const lineage = { inputs: provenance, asOf: "2024-11-05", methodology: "reported", status: "certified" } as const;
export const states = ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "MI", "AZ"] as const;

function withChecksum<T extends { canonicalDataChecksumSha256: string }>(manifest: T): T {
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest as never);
  return manifest;
}

export function coherentManifest(): PrototypeManifest {
  const houseProfiles = states.map((state, index) => {
    const suffix = index + 1;
    return { state, suffix, officeId: `office_house_${suffix}`, termId: `term_house_${suffix}`, cycleId: `seat_house_${suffix}`, geographyId: `geo_house_${suffix}`, personId: `person_${suffix}`, contestId: `contest_president_${suffix}`, candidacyId: `candidacy_${suffix}`, optionId: `option_${suffix}` };
  });
  const senateCycles = states.flatMap((state, stateIndex) => [1, 2].map((senateClass) => {
    const suffix = `${stateIndex + 1}_${senateClass}`;
    return { state, senateClass, officeId: `office_senate_${suffix}`, termId: `term_senate_${suffix}`, cycleId: `seat_senate_${suffix}`, geographyId: `geo_state_${stateIndex + 1}` };
  }));
  return withChecksum({
    schemaVersion: 1, canonicalDataChecksumSha256: checksum, profileSeatCycleIds: houseProfiles.map(({ cycleId }) => cycleId),
    release: { id: "rel_1", label: "Release", status: "published", sourceCutoff: timestamp, createdAt: timestamp, publishedAt: timestamp, previousReleaseId: null },
    sources: [{ id: "src_1", releaseId: "rel_1", name: "Source", authority: "official", homepageUrl: "https://example.com" }],
    snapshots: [{ id: "snap_1", releaseId: "rel_1", sourceId: "src_1", sourceUrl: "https://example.com/data", publishedAt: timestamp, retrievedAt: timestamp, checksumSha256: checksum, parserVersion: "1", license: "public", usageStatus: "approved" }],
    districtPlans: states.map((state, index) => ({ id: `plan_${index + 1}`, releaseId: "rel_1", provenance, name: `${state} Plan`, congress: 118, enactedAt: null, effectiveFrom: "2023-01-01", effectiveTo: null, jurisdictionStateCode: state })),
    geometryArtifacts: [{ id: "artifact_1", releaseId: "rel_1", snapshotId: "snap_1", objectKey: "states.geojson", format: "geojson", srid: 4326, checksumSha256: checksum }],
    geographyVersions: [...houseProfiles.map(({ state, suffix, geographyId }) => ({ id: geographyId, releaseId: "rel_1", provenance, kind: "house_district", districtPlanId: `plan_${suffix}`, geometryArtifactId: "artifact_1", sourceGeoid: `h${suffix}`, label: `${state}-01`, vintage: "2024", stateCode: state, districtCode: "01" })), ...states.map((state, index) => ({ id: `geo_state_${index + 1}`, releaseId: "rel_1", provenance, kind: "state", geometryArtifactId: "artifact_1", sourceGeoid: `s${index + 1}`, label: state, vintage: "2024", stateCode: state }))],
    offices: [...houseProfiles.map(({ state, officeId }) => ({ id: officeId, releaseId: "rel_1", provenance, chamber: "house", kind: "house_voting", stateCode: state, districtCode: "01", senateClass: null })), ...senateCycles.map(({ state, senateClass, officeId }) => ({ id: officeId, releaseId: "rel_1", provenance, chamber: "senate", kind: "senate", stateCode: state, districtCode: null, senateClass }))],
    people: houseProfiles.map(({ suffix, personId }) => ({ id: personId, releaseId: "rel_1", provenance, displayName: `Candidate ${suffix}`, birthDate: null, bioguideId: null })),
    officeTerms: [...houseProfiles.map(({ officeId, termId }) => ({ id: termId, releaseId: "rel_1", provenance, officeId, startsAt: "2023-01-03", endsAt: "2025-01-03" })), ...senateCycles.map(({ officeId, termId }) => ({ id: termId, releaseId: "rel_1", provenance, officeId, startsAt: "2021-01-03", endsAt: "2027-01-03" }))],
    memberships: [],
    seatCycles: [
      ...houseProfiles.map(({ officeId, termId, cycleId, geographyId }) => ({
        id: cycleId, releaseId: "rel_1", provenance, officeId, officeTermId: termId, geographyVersionId: geographyId,
        cycleYear: 2024, electionDate: "2024-11-05", electionKind: "regular", incumbencyStatus: "open", occupancy: { status: "vacant", asOf: "2024-01-01" },
      })),
      ...senateCycles.map(({ officeId, termId, cycleId, geographyId }) => ({
        id: cycleId, releaseId: "rel_1", provenance, officeId, officeTermId: termId, geographyVersionId: geographyId,
        cycleYear: 2024, electionDate: "2024-11-05", electionKind: "regular", incumbencyStatus: "open", occupancy: { status: "vacant", asOf: "2024-01-01" },
      })),
    ],
    contests: houseProfiles.map(({ cycleId, geographyId, contestId }) => ({ id: contestId, releaseId: "rel_1", provenance, seatCycleId: cycleId, kind: "president_general", round: "general", electionDate: "2024-11-05", geographyVersionId: geographyId, certificationStatus: "certified", reportingCompletenessPercent: 100, denominatorVotes: { kind: "value", value: 1 }, reportingUnit: "district", allocationMethod: "none", allocationCoveragePercent: { kind: "missing", reason: "not_applicable" }, lineage })),
    candidacies: houseProfiles.map(({ contestId, personId, candidacyId }) => ({ id: candidacyId, releaseId: "rel_1", provenance, contestId, personId, party: "democratic", status: "nominee" })),
    resultOptions: houseProfiles.map(({ contestId, candidacyId, optionId, suffix }) => ({ id: optionId, releaseId: "rel_1", provenance, contestId, candidacyId, label: `Candidate ${suffix}`, party: "democratic", optionKind: "candidate" })),
    electionResults: houseProfiles.map(({ contestId, optionId }) => ({ releaseId: "rel_1", contestId, resultOptionId: optionId, votes: { kind: "value", value: 1 }, lineage })),
    acsObservations: houseProfiles.map(({ geographyId }) => ({ releaseId: "rel_1", geographyVersionId: geographyId, variable: "B01001_001E", label: "Population", estimate: { kind: "value", value: 1 }, marginOfError: { kind: "value", value: 0 }, unit: "count", surveyPeriod: "2024", universe: "People", lineage })),
    committees: [], committeeRelationships: [], fecFilingSummaries: [],
    financeSummaries: houseProfiles.map(({ cycleId }) => ({ kind: "missing", releaseId: "rel_1", seatCycleId: cycleId, reason: "not_reported", asOf: "2024-11-05", inputs: provenance })),
  } as unknown as PrototypeManifest);
}

/** A valid, deliberately uneven release for adapter contract tests. */
export function adversarialRepositoryManifest(): PrototypeManifest {
  const manifest = structuredClone(coherentManifest());
  const profiles = manifest.profileSeatCycleIds;
  const names = ["Ada North", "Bea South", "Cy West"];
  for (let index = 0; index < 3; index += 1) {
    manifest.people[index]!.displayName = names[index]!;
    manifest.memberships.push({ id: `member_${index + 1}` as never, releaseId: "rel_1" as never, provenance: [...provenance], officeTermId: manifest.seatCycles[index]!.officeTermId, personId: manifest.people[index]!.id, party: (["democratic", "republican", "independent"] as const)[index]!, startsAt: "2023-01-03", endsAt: null } as never);
    manifest.seatCycles[index]!.occupancy = { status: "occupied", asOf: "2024-01-01" };
  }
  const statuses = ["incumbent_running", "incumbent_not_running", "unknown", "open", "open", "unknown", "open", "open", "open", "open"] as const;
  manifest.seatCycles.slice(0, 10).forEach((cycle, index) => { cycle.incumbencyStatus = statuses[index]!; });

  // Eight reconciled two-party contests provide distinct margins (including ties);
  // the remaining two are explicitly unavailable rather than silently absent.
  const democraticVotes = [50, 60, 40, 55, 45, 50, 70, 30];
  for (let index = 0; index < 10; index += 1) {
    const contest = manifest.contests[index]!;
    if (index >= 8) {
      contest.certificationStatus = "unavailable"; contest.reportingCompletenessPercent = 0;
      contest.denominatorVotes = { kind: "missing", reason: "not_defensibly_modeled" };
      contest.lineage = { ...contest.lineage, status: "reported" };
      manifest.electionResults[index]!.votes = { kind: "missing", reason: "not_defensibly_modeled" };
      manifest.electionResults[index]!.lineage = { ...manifest.electionResults[index]!.lineage, status: "reported" };
      continue;
    }
    contest.denominatorVotes = { kind: "value", value: 100 };
    manifest.electionResults[index]!.votes = { kind: "value", value: democraticVotes[index]! };
    const candidacy = { ...manifest.candidacies[index]!, id: `candidacy_rep_${index + 1}`, party: "republican" as const };
    const option = { ...manifest.resultOptions[index]!, id: `option_rep_${index + 1}`, candidacyId: candidacy.id, label: `Republican ${index + 1}`, party: "republican" as const };
    manifest.candidacies.push(candidacy as never); manifest.resultOptions.push(option as never);
    manifest.electionResults.push({ ...manifest.electionResults[index]!, resultOptionId: option.id, votes: { kind: "value", value: 100 - democraticVotes[index]! } } as never);
  }

  manifest.acsObservations.forEach((observation, index) => { observation.label = `ACS-only demographic ${index + 1}`; observation.estimate = { kind: "value", value: 1000 + index }; });
  const filing = (index: number, cash: number) => ({ id: `fec_${index + 1}`, releaseId: "rel_1", seatCycleId: profiles[index]!, committeeId: `committee_${index + 1}`, sourceFilingId: `source_filing_${index + 1}`, reportType: "quarterly", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: `2024-04-0${index + 1}T00:00:00.000Z`, amendmentNumber: 0, amendmentStatus: "new" as const, amendsFilingId: null, cashOnHand: { kind: "value" as const, value: cash }, totalReceipts: { kind: "value" as const, value: cash }, totalDisbursements: { kind: "value" as const, value: 0 }, lineage: { ...lineage, inputs: [...provenance] } });
  for (const [index, cash] of [[0, 200], [1, 100], [2, 100]] as const) {
    const candidacy = manifest.candidacies.find((row) => row.contestId === manifest.contests[index]!.id)!;
    const committee = { id: `committee_${index + 1}`, releaseId: "rel_1", provenance: [...provenance], sourceCommitteeId: `C${index + 1}`, name: `Committee ${index + 1}`, committeeType: "authorized" };
    manifest.committees.push(committee as never);
    manifest.committeeRelationships.push({ id: `committee_rel_${index + 1}` as never, releaseId: "rel_1" as never, provenance: [...provenance], committeeId: committee.id as never, candidacyId: candidacy.id, relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null } as never);
    const row = filing(index, cash); manifest.fecFilingSummaries.push(row as never);
    manifest.financeSummaries[index] = { kind: "value", releaseId: "rel_1" as never, seatCycleId: profiles[index]!, filingId: row.id as never };
  }
  manifest.financeSummaries[3] = { kind: "missing", releaseId: "rel_1" as never, seatCycleId: profiles[3]!, reason: "not_yet_reported", asOf: "2024-11-05", inputs: [...provenance] } as never;
  manifest.financeSummaries[4] = { kind: "missing", releaseId: "rel_1" as never, seatCycleId: profiles[4]!, reason: "source_unavailable", asOf: "2024-11-05", inputs: [...provenance] } as never;
  return withChecksum(manifest);
}

/** Creates artifact bytes first, then binds their digest into a valid synthetic manifest. */
export function coherentBoundaryBundle(manifest: PrototypeManifest): BoundaryBundle {
  const artifact = manifest.geometryArtifacts[0]!;
  const features = manifest.geographyVersions.map((geography, index) => ({
    type: "Feature" as const,
    properties: { sourceGeoid: geography.sourceGeoid, stateCode: geography.stateCode, districtCode: geography.kind === "house_district" ? geography.districtCode : null },
    geometry: { type: "MultiPolygon" as const, coordinates: [[[[index, 0], [index, 1], [index + .5, 1], [index, 0]]]] },
  }));
  const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
  (artifact as { checksumSha256: string }).checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  manifest.canonicalDataChecksumSha256 = computeCanonicalDataChecksum(manifest);
  return [{ artifactId: String(artifact.id), objectKey: artifact.objectKey, bytes }];
}
