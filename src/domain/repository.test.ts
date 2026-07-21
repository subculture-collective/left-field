import { describe, expect, it } from "vitest";

import { canonicalManifest } from "@/data/canonical-manifest";
import { collectProfileSnapshotSeedIds, seatListItemSchema, seatQuerySchema, seatProfileSchema } from "@/domain/repository";
import { InMemorySeatResearchRepository } from "@/repositories/in-memory";
import { createManifestSeatProjection } from "@/repositories/manifest-projection";
import { assertSeatRepositoryContract } from "@/test/repository-contract";
import { adversarialRepositoryManifest, coherentManifest } from "@/test/fixtures/prototype-manifest";

describe("manifest seat projection", () => {
  const repository = new InMemorySeatResearchRepository(canonicalManifest);
  const releaseId = canonicalManifest.release.id;

  it("collects only allowlisted snapshot evidence in byte order", () => {
    expect(collectProfileSnapshotSeedIds({ snapshotId: "z", artifactSnapshotId: "a", inputSnapshotIds: ["b", "a", 1], derivationInputSnapshotIds: ["c"], snapshotIds: ["ignored"], filingId: "ignored", nested: [{ snapshotId: "b" }, { arbitrary: "snap_no" }] })).toEqual(["a", "b", "c", "z"]);
  });

  it("satisfies the reusable repository contract", async () => {
    await assertSeatRepositoryContract(repository, canonicalManifest);
  });

  it("satisfies the strengthened contract for an adversarial valid release", async () => {
    const manifest = adversarialRepositoryManifest();
    await assertSeatRepositoryContract(new InMemorySeatResearchRepository(manifest), manifest);
  });

  it("uses the ordered profile rather than every cycle and validates DTOs", async () => {
    const seats = await repository.listSeats(releaseId, seatQuerySchema.parse({}));
    expect(seats.map((seat) => seat.id)).toHaveLength(canonicalManifest.profileSeatCycleIds.length);
    expect(seats.map((seat) => seat.id)).not.toContain("seat_senate_ak_2_current");
    seats.forEach((seat) => seatListItemSchema.parse(seat));
  });

  it("searches identity fields only and preserves unavailable presidential facts", async () => {
    const all = await repository.listSeats(releaseId, seatQuerySchema.parse({}));
    const byIncumbent = await repository.listSeats(releaseId, seatQuerySchema.parse({ identitySearch: "shomari figures" }));
    const demographicTerm = await repository.listSeats(releaseId, seatQuerySchema.parse({ identitySearch: "median household income" }));
    expect(byIncumbent).toHaveLength(1);
    expect(demographicTerm).toEqual([]);
    const unavailable = all.find((seat) => seat.stateCode === "AL")!;
    expect(unavailable.presidentialMargin2024.value).toEqual({ kind: "missing", reason: "not_defensibly_modeled" });
  });

  it("pins profiles to the release and excludes non-profile cycles", async () => {
    const profile = await repository.getSeatProfile(releaseId, canonicalManifest.profileSeatCycleIds[0]!);
    expect(profile).not.toBeNull();
    seatProfileSchema.parse(profile);
    expect(await repository.getSeatProfile(releaseId, "seat_senate_ak_2_current" as never)).toBeNull();
    expect(await repository.getSeatProfile("rel_missing" as never, canonicalManifest.profileSeatCycleIds[0]!)).toBeNull();
  });

  it("defaults v1 profiles to no map and rejects map provenance contradictions", () => {
    const profile = createManifestSeatProjection(coherentManifest()).profile("seat_house_1" as never)!;
    expect(profile.map).toBeNull();
    const artifactSnapshot = { ...profile.snapshots[0]!, checksumSha256: "a".repeat(64), usageStatus: "approved" as const };
    const derivationSnapshot = { ...artifactSnapshot, id: "snap_original" as never };
    const artifactSource = { ...profile.sources.find((source) => source.id === artifactSnapshot.sourceId)!, authority: "derived" as const };
    const closedProfile = { ...profile, snapshots: [...profile.snapshots.map((snapshot) => snapshot.id === artifactSnapshot.id ? artifactSnapshot : snapshot), derivationSnapshot], sources: profile.sources.map((source) => source.id === artifactSource.id ? artifactSource : source) };
    const map = { releaseId: profile.release.id, geographyVersionId: profile.geography.id, artifactId: "artifact_1", artifactSnapshotId: artifactSnapshot.id, artifactChecksumSha256: "a".repeat(64), url: `/maps/${profile.release.id}/${profile.geography.id}`, inputSnapshotIds: [artifactSnapshot.id], derivationInputSnapshotIds: [derivationSnapshot.id] };
    expect(seatProfileSchema.parse({ ...closedProfile, map }).map).toEqual(map);
    expect(() => seatProfileSchema.parse({ ...closedProfile, map: { ...map, geographyVersionId: "geo_other" } })).toThrow(/pinned/);
    expect(() => seatProfileSchema.parse({ ...closedProfile, map: { ...map, inputSnapshotIds: ["snap_missing"] } })).toThrow(/sole output snapshot/);
    expect(() => seatProfileSchema.parse({ ...closedProfile, map: { ...map, derivationInputSnapshotIds: [artifactSnapshot.id] } })).toThrow(/original derivation input/);
    expect(() => seatProfileSchema.parse({ ...closedProfile, map: { ...map, derivationInputSnapshotIds: [derivationSnapshot.id, artifactSnapshot.id] } })).toThrow(/original derivation input/);
    for (const status of ["candidate", "retired"] as const) expect(() => seatProfileSchema.parse({ ...closedProfile, release: { ...profile.release, status, publishedAt: status === "candidate" ? null : profile.release.publishedAt }, map })).toThrow(/current published release/);
  });

  it("suppresses map-bearing candidate and retired manifest profiles", () => {
    const mapBearingManifest = () => {
      const manifest = structuredClone(coherentManifest());
      manifest.sources.push({ id: "src_derived", releaseId: manifest.release.id, name: "Derived", authority: "derived", homepageUrl: "https://example.com/derived" } as never);
      manifest.snapshots.push({ ...manifest.snapshots[0]!, id: "snap_map", sourceId: "src_derived" } as never);
      manifest.geometryArtifacts[0]!.snapshotId = "snap_map" as never;
      (manifest as unknown as { mapArtifacts: unknown[]; snapshotDerivations: unknown[] }).mapArtifacts = [{ id: "map_1", releaseId: manifest.release.id, geographyVersionId: manifest.seatCycles[0]!.geographyVersionId, artifactId: manifest.geometryArtifacts[0]!.id, inputSnapshotIds: ["snap_map"] }];
      (manifest as unknown as { snapshotDerivations: unknown[] }).snapshotDerivations = [{ outputSnapshotId: "snap_map", inputSnapshotIds: ["snap_1"] }];
      return manifest;
    };
    expect(createManifestSeatProjection(mapBearingManifest()).profile("seat_house_1" as never)?.map).toMatchObject({ artifactSnapshotId: "snap_map" });
    for (const status of ["candidate", "retired"] as const) {
      const manifest = mapBearingManifest();
      manifest.release = { ...manifest.release, status, publishedAt: status === "candidate" ? null : manifest.release.publishedAt } as never;
      expect(createManifestSeatProjection(manifest).profile(manifest.profileSeatCycleIds[0]!)?.map).toBeNull();
    }
  });

  it("rejects arbitrary and demographic query fields", () => {
    expect(() => seatQuerySchema.parse({ medianHouseholdIncome: 1 })).toThrow();
    expect(() => seatQuerySchema.parse({ arbitrary: "x" })).toThrow();
  });

  it("restores NODE_ENV after testing the production in-memory guard", () => {
    const environment = process.env as Record<string, string | undefined>; const original = environment.NODE_ENV;
    try { environment.NODE_ENV = "production"; expect(() => new InMemorySeatResearchRepository(canonicalManifest)).toThrow("unavailable in production"); }
    finally { if (original === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = original; }
  });

  it("is invariant to non-profile manifest collection ordering", () => {
    const permuted = structuredClone(canonicalManifest);
    for (const [key, value] of Object.entries(permuted) as [keyof typeof permuted, unknown][]) {
      if (key !== "profileSeatCycleIds" && Array.isArray(value)) (permuted[key] as unknown[]).reverse();
    }
    expect(permuted.profileSeatCycleIds).toEqual(canonicalManifest.profileSeatCycleIds);
    const canonical = createManifestSeatProjection(canonicalManifest);
    const reordered = createManifestSeatProjection(permuted);

    expect(reordered.list(seatQuerySchema.parse({}))).toEqual(canonical.list(seatQuerySchema.parse({})));
    for (const seatCycleId of canonicalManifest.profileSeatCycleIds) {
      expect(reordered.profile(seatCycleId)).toEqual(canonical.profile(seatCycleId));
    }
    expect(reordered.sources()).toEqual(canonical.sources());
  });

  it("projection branches handle adversarial election and finance facts", () => {
    // Pure projection fixtures intentionally bypass repository manifest validation.
    const manifest = structuredClone(coherentManifest());
    const contest = manifest.contests[0]!;
    contest.denominatorVotes = { kind: "value", value: 100 };
    contest.lineage = { ...contest.lineage, inputs: [{ snapshotId: "snap_contest", role: "derived_input" }] } as never;
    const democratic = manifest.resultOptions[0]!;
    democratic.provenance = [{ snapshotId: "snap_option_dem", role: "original_publisher" }] as never;
    const republicanOne = { ...democratic, id: "option_republican_1", party: "republican", provenance: [{ snapshotId: "snap_option_rep_1", role: "original_publisher" }] } as unknown as typeof democratic;
    const republicanTwo = { ...democratic, id: "option_republican_2", party: "republican", provenance: [{ snapshotId: "snap_option_rep_2", role: "original_publisher" }] } as unknown as typeof democratic;
    manifest.resultOptions.push(republicanOne, republicanTwo);
    manifest.electionResults[0] = { ...manifest.electionResults[0]!, votes: { kind: "value", value: 30 }, lineage: { ...contest.lineage, inputs: [{ snapshotId: "snap_result_dem", role: "derived_input" }] } } as never;
    manifest.electionResults.push({ ...manifest.electionResults[0]!, resultOptionId: republicanOne.id, votes: { kind: "value", value: 40 }, lineage: { ...contest.lineage, inputs: [{ snapshotId: "snap_result_rep_1", role: "derived_input" }] } } as never, { ...manifest.electionResults[0]!, resultOptionId: republicanTwo.id, votes: { kind: "value", value: 10 }, lineage: { ...contest.lineage, inputs: [{ snapshotId: "snap_result_rep_2", role: "derived_input" }] } } as never);
    const query = (input: unknown) => seatQuerySchema.parse(input);
    const target = (projection: ReturnType<typeof createManifestSeatProjection>) => projection.list(query({})).find((item) => item.id === manifest.profileSeatCycleIds[0])!;
    let seat = target(createManifestSeatProjection(manifest));
    expect(seat.presidentialMargin2024.value).toEqual({ kind: "value", value: 20 });
    expect(seat.presidentialMargin2024.inputSnapshotIds).toEqual(["snap_contest", "snap_option_dem", "snap_option_rep_1", "snap_option_rep_2", "snap_result_dem", "snap_result_rep_1", "snap_result_rep_2"]);
    contest.denominatorVotes = { kind: "value", value: 0 };
    expect(target(createManifestSeatProjection(manifest)).presidentialMargin2024.value).toEqual({ kind: "missing", reason: "not_applicable" });

    const filing = { id: "fec_filing_1", releaseId: "rel_1", seatCycleId: manifest.profileSeatCycleIds[0], committeeId: "committee_1", sourceFilingId: "filing_1", reportType: "quarterly", reportingPeriodStart: "2024-01-01", reportingPeriodEnd: "2024-03-31", filedAt: "2024-04-01T00:00:00.000Z", amendmentNumber: 0, amendmentStatus: "new", amendsFilingId: null, cashOnHand: { kind: "value", value: 123 }, totalReceipts: { kind: "value", value: 1 }, totalDisbursements: { kind: "value", value: 1 }, lineage: manifest.electionResults[0]!.lineage } as unknown as typeof manifest.fecFilingSummaries[number];
    manifest.fecFilingSummaries = [filing]; manifest.financeSummaries[0] = { kind: "value", releaseId: "rel_1", seatCycleId: manifest.profileSeatCycleIds[0], filingId: filing.id } as never;
    seat = target(createManifestSeatProjection(manifest));
    expect(seat.cashOnHand).toEqual(expect.objectContaining({ kind: "value", value: 123, filingId: "fec_filing_1" }));
    filing.cashOnHand = { kind: "missing", reason: "not_reported" };
    expect(target(createManifestSeatProjection(manifest)).cashOnHand).toEqual(expect.objectContaining({ kind: "missing", reason: "not_reported", asOf: "2024-03-31" }));
  });

  it("projects missing aggregate committees and their seat relationships into the profile closure", () => {
    const manifest = structuredClone(coherentManifest()); const seatCycleId = manifest.profileSeatCycleIds[0]!; const candidacy = manifest.candidacies[0]!;
    manifest.committees.push({ id: "committee_missing", releaseId: "rel_1", sourceCommitteeId: "missing", name: "Missing committee", committeeType: "authorized", provenance: [{ snapshotId: "snap_1", role: "original_publisher" }] } as never);
    manifest.committeeRelationships.push({ id: "committee_rel_missing", releaseId: "rel_1", committeeId: "committee_missing", candidacyId: candidacy.id, relationship: "authorized", effectiveFrom: "2024-01-01", effectiveTo: null, provenance: [{ snapshotId: "snap_1", role: "original_publisher" }] } as never);
    (manifest as unknown as { financeAggregates: unknown[] }).financeAggregates = [{ id: "aggregate_missing", releaseId: "rel_1", seatCycleId, asOf: "2024-04-01", reportingPeriodStart: "2024-01-01", coverageThrough: "2024-03-31", cashOnHand: { kind: "missing", reason: "not_reported" }, receipts: { kind: "missing", reason: "not_reported" }, disbursements: { kind: "missing", reason: "not_reported" }, methodologyVersion: "test", committeeInputs: [{ kind: "missing", committeeId: "committee_missing", reason: "not_reported" }] }];
    const profile = createManifestSeatProjection(manifest).profile(seatCycleId)!;
    expect(profile.committees.map((committee) => committee.id)).toContain("committee_missing");
    expect(profile.committeeRelationships.map((relationship) => relationship.id)).toContain("committee_rel_missing");
    expect(profile.snapshots.map((snapshot) => snapshot.id)).toContain("snap_1");
    expect(() => seatProfileSchema.parse({ ...profile, committees: [] })).toThrow("Aggregate input committee must be exposed");
    expect(() => seatProfileSchema.parse({ ...profile, committeeRelationships: [] })).toThrow("Aggregate input committee must be exposed");
  });

  it("is invariant to demographic mutations for every supported query and sort", () => {
    const mutated = structuredClone(canonicalManifest);
    mutated.acsObservations.forEach((observation, index) => { observation.label = `Candidate ${index + 1}`; observation.estimate = { kind: "value", value: index + 100 }; observation.marginOfError = { kind: "value", value: index + 10 }; });
    const canonical = createManifestSeatProjection(canonicalManifest); const changed = createManifestSeatProjection(mutated); const parse = (input: unknown) => seatQuerySchema.parse(input);
    const all = canonical.list(parse({}));
    const queries = [{}, ...(["state", "district", "incumbent_name", "election_year", "cash_on_hand", "presidential_margin_2024"] as const).flatMap((sort) => ([{ sort, direction: "asc" }, { sort, direction: "desc" }])), ...all.flatMap((seat) => [{ chamber: seat.chamber }, { stateCode: seat.stateCode }, ...(seat.incumbentParty ? [{ party: seat.incumbentParty }] : []), { incumbencyStatus: seat.incumbencyStatus }, { electionYear: seat.electionYear }, { identitySearch: seat.label }, { identitySearch: seat.stateCode }, ...(seat.districtCode ? [{ identitySearch: seat.districtCode }] : []), ...(seat.incumbentName ? [{ identitySearch: seat.incumbentName }] : [])])];
    for (const query of queries) expect(changed.list(parse(query)).map((seat) => seat.id)).toEqual(canonical.list(parse(query)).map((seat) => seat.id));
  });
});
