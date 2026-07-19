import { expect } from "vitest";
import type { PrototypeManifest } from "@/domain/contracts";
import { seatListItemSchema, seatPageSchema, seatPageRequestSchema, seatProfileSchema, seatQuerySchema } from "@/domain/repository";
import type { SeatListItem, SeatResearchRepository } from "@/domain/repository";
import { decodeSeatCursor, normalizedSeatQuery } from "@/repositories/pagination";

const byteCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const snapshotIdsFor = (rows: readonly unknown[]): string[] => [...new Set(rows.flatMap((row) => {
  const record = row as { provenance?: readonly { snapshotId: string }[]; lineage?: { inputs: readonly { snapshotId: string }[] } };
  return [...(record.provenance ?? []), ...(record.lineage?.inputs ?? [])].map((input) => String(input.snapshotId));
}))].sort(byteCompare);

/** Shared adapter assertions: callers supply a repository pinned to this manifest. */
export async function assertSeatRepositoryContract(repository: SeatResearchRepository, manifest: PrototypeManifest): Promise<void> {
  const releaseId = manifest.release.id;
  const cycles = new Map(manifest.seatCycles.map((row) => [String(row.id), row]));
  const offices = new Map(manifest.offices.map((row) => [String(row.id), row]));
  const people = new Map(manifest.people.map((row) => [String(row.id), row]));
  const membershipFor = (id: string) => { const cycle = cycles.get(id)!; return cycle.occupancy.status === "occupied" ? manifest.memberships.find((row) => row.officeTermId === cycle.officeTermId && row.startsAt <= cycle.occupancy.asOf && (row.endsAt === null || cycle.occupancy.asOf < row.endsAt)) ?? null : null; };
  const expectedIds = (predicate: (id: string) => boolean) => manifest.profileSeatCycleIds.map(String).filter(predicate).sort((left, right) => byteCompare(String(offices.get(String(cycles.get(left)!.officeId))!.stateCode), String(offices.get(String(cycles.get(right)!.officeId))!.stateCode)) || byteCompare(left, right));
  const expected = (id: string) => { const cycle = cycles.get(id)!; const office = offices.get(String(cycle.officeId))!; const membership = membershipFor(id); return { cycle, office, membership, incumbent: membership ? people.get(String(membership.personId))! : null }; };
  expect(await repository.getRelease("rel_missing" as never)).toBeNull();
  expect(await repository.getActiveRelease()).toEqual(await repository.getRelease(releaseId));
  const all = await repository.listSeats(releaseId, seatQuerySchema.parse({}));
  expect(all.map((seat) => seat.id)).toEqual(expectedIds(() => true));
  all.forEach((seat) => seatListItemSchema.parse(seat));

  expect(repository.listSeatPage).toBeTypeOf("function"); expect(repository.getSeatListItem).toBeTypeOf("function");
  if (!repository.listSeatPage || !repository.getSeatListItem) throw new Error("Repository lacks the required paged v2 methods");
  const first = await repository.listSeatPage(releaseId, seatPageRequestSchema.parse({ limit: 2 }));
  seatPageSchema.parse(first); expect(first.total).toBe(all.length); expect(first.items.map((seat) => seat.id)).toEqual(all.slice(0, 2).map((seat) => seat.id));
  const pagedIds = [...first.items.map((seat) => seat.id)]; let cursor = first.nextCursor;
  while (cursor) { const next = await repository.listSeatPage(releaseId, seatPageRequestSchema.parse({ limit: 2, cursor })); pagedIds.push(...next.items.map((seat) => seat.id)); cursor = next.nextCursor; }
  expect(pagedIds).toEqual(all.map((seat) => seat.id));
  await expect(repository.listSeatPage(releaseId, seatPageRequestSchema.parse({ limit: 2, cursor: "not-a-cursor" }))).rejects.toThrow();
  if (first.nextCursor) {
    expect(() => decodeSeatCursor(first.nextCursor!, "rel_missing" as never, normalizedSeatQuery(seatPageRequestSchema.parse({ limit: 2 })))).toThrow();
    await expect(repository.listSeatPage("rel_missing" as never, seatPageRequestSchema.parse({ limit: 2, cursor: first.nextCursor }))).rejects.toThrow();
    await expect(repository.listSeatPage(releaseId, seatPageRequestSchema.parse({ limit: 2, stateCode: "CA", cursor: first.nextCursor }))).rejects.toThrow();
  }
  for (const query of [{ chamber: "house" }, { stateCode: "CA" }, { party: "democratic" }, { incumbencyStatus: "open" }, { electionYear: 2024 }, { identitySearch: "CA" }, ...(["state", "district", "incumbent_name", "election_year", "cash_on_hand", "presidential_margin_2024"] as const).flatMap((sort) => [{ sort, direction: "asc" as const }, { sort, direction: "desc" as const }])]) {
    const expectedPage = await repository.listSeats(releaseId, seatQuerySchema.parse(query));
    const page = await repository.listSeatPage(releaseId, seatPageRequestSchema.parse({ ...query, limit: 100 }));
    expect(page.items.map((seat) => seat.id)).toEqual(expectedPage.map((seat) => seat.id));
  }
  expect(await repository.getSeatListItem(releaseId, manifest.profileSeatCycleIds[0]!)).toEqual(all.find((seat) => seat.id === manifest.profileSeatCycleIds[0])!);
  expect(await repository.getSeatListItem("rel_missing" as never, manifest.profileSeatCycleIds[0]!)).toBeNull();
  const facets = await repository.getSeatFacets(releaseId);
  const facetCycles = manifest.profileSeatCycleIds.map((id) => cycles.get(String(id))!);
  expect(facets).toEqual({
    states: [...new Set(facetCycles.map((cycle) => offices.get(String(cycle.officeId))!.stateCode))].sort(byteCompare),
    parties: [...new Set(facetCycles.flatMap((cycle) => membershipFor(String(cycle.id))?.party ?? []))].sort(byteCompare),
    incumbencyStatuses: [...new Set(facetCycles.map((cycle) => cycle.incumbencyStatus))].sort(byteCompare),
    electionYears: [...new Set(facetCycles.map((cycle) => cycle.cycleYear))].sort((left, right) => left - right),
  });
  expect(await repository.getSeatFacets("rel_missing" as never)).toEqual({ states: [], parties: [], incumbencyStatuses: [], electionYears: [] });
  expect((await repository.listSourceSnapshots(releaseId)).map((snapshot) => snapshot.id)).toEqual([...manifest.snapshots.map((snapshot) => String(snapshot.id))].sort(byteCompare));
  expect(await repository.listSourceSnapshots("rel_missing" as never)).toEqual([]);

  const filterCases = [
    ["chamber", "house", (row: ReturnType<typeof expected>) => row.office.chamber === "house"], ["chamber", "senate", (row: ReturnType<typeof expected>) => row.office.chamber === "senate"],
    ["stateCode", expected(String(manifest.profileSeatCycleIds[0])).office.stateCode, (row: ReturnType<typeof expected>, value: string) => row.office.stateCode === value],
    ["party", "democratic", (row: ReturnType<typeof expected>) => row.membership?.party === "democratic"], ["party", "republican", (row: ReturnType<typeof expected>) => row.membership?.party === "republican"],
    ["incumbencyStatus", "incumbent_running", (row: ReturnType<typeof expected>) => row.cycle.incumbencyStatus === "incumbent_running"], ["incumbencyStatus", "open", (row: ReturnType<typeof expected>) => row.cycle.incumbencyStatus === "open"],
    ["electionYear", 2024, (row: ReturnType<typeof expected>) => row.cycle.cycleYear === 2024], ["electionYear", 2025, (row: ReturnType<typeof expected>) => row.cycle.cycleYear === 2025],
  ] as const;
  for (const [filter, value, matches] of filterCases) expect((await repository.listSeats(releaseId, seatQuerySchema.parse({ [filter]: value }))).map((seat) => seat.id)).toEqual(expectedIds((id) => matches(expected(id), value as never)));

  const searchValues = ["CA-01", expected(String(manifest.profileSeatCycleIds[0])).office.stateCode, expected(String(manifest.profileSeatCycleIds[0])).office.districtCode!, expected(String(manifest.profileSeatCycleIds[0])).incumbent?.displayName].filter((value): value is string => Boolean(value));
  for (const value of searchValues) expect((await repository.listSeats(releaseId, seatQuerySchema.parse({ identitySearch: value }))).map((seat) => seat.id)).toEqual(expectedIds((id) => { const row = expected(id); return [`${row.office.stateCode}-${row.office.districtCode ?? "Senate"}`, row.office.stateCode, row.office.districtCode, row.incumbent?.displayName].some((field) => field?.toLowerCase().includes(value.toLowerCase())); }));
  const demographicText = manifest.acsObservations[0]?.label;
  if (demographicText) expect(await repository.listSeats(releaseId, seatQuerySchema.parse({ identitySearch: demographicText }))).toEqual([]);

  const metric = (seat: SeatListItem, sort: string): string | number | null => ({ state: seat.stateCode, district: seat.districtCode === "AL" ? "00" : seat.districtCode, incumbent_name: seat.incumbentName, election_year: seat.electionYear, cash_on_hand: seat.cashOnHand.kind === "value" ? seat.cashOnHand.value : null, presidential_margin_2024: seat.presidentialMargin2024.value.kind === "value" ? seat.presidentialMargin2024.value.value : null })[sort]!;
  for (const sort of ["state", "district", "incumbent_name", "election_year", "cash_on_hand", "presidential_margin_2024"] as const) for (const direction of ["asc", "desc"] as const) {
    const seats = await repository.listSeats(releaseId, seatQuerySchema.parse({ sort, direction }));
    let missing = false;
    for (let index = 1; index < seats.length; index += 1) {
      const previous = metric(seats[index - 1]!, sort); const current = metric(seats[index]!, sort);
      if (previous === null) missing = true;
      expect(!(missing && current !== null)).toBe(true);
      if (previous !== null && current !== null) {
        const order = typeof previous === "number" && typeof current === "number" ? previous - current : byteCompare(String(previous), String(current));
        expect(direction === "asc" ? order <= 0 : order >= 0).toBe(true);
        if (order === 0) expect(byteCompare(String(seats[index - 1]!.id), String(seats[index]!.id))).toBeLessThan(0);
      }
    }
  }

  for (const contest of manifest.contests.filter((contest) => contest.kind === "president_general" && contest.denominatorVotes.kind === "missing")) {
    const seat = all.find((item) => item.id === contest.seatCycleId)!;
    expect(seat.presidentialMargin2024).toEqual(expect.objectContaining({ value: contest.denominatorVotes, asOf: contest.lineage.asOf, inputSnapshotIds: snapshotIdsFor([contest]) }));
  }
  for (const summary of manifest.financeSummaries.filter((summary): summary is Extract<typeof summary, { kind: "missing" }> => summary.kind === "missing" && all.some((seat) => seat.id === summary.seatCycleId))) {
    const seat = all.find((item) => item.id === summary.seatCycleId)!;
    expect(seat.cashOnHand).toEqual({ kind: "missing", reason: summary.reason, asOf: summary.asOf, inputSnapshotIds: [...summary.inputs.map((input) => String(input.snapshotId))].sort(byteCompare) });
  }

  const values = all.flatMap((seat) => seat.cashOnHand.kind === "value" ? [seat.cashOnHand.value] : []);
  if (values.length >= 2) expect(new Set(values).size).toBeGreaterThan(1);
  const reasons = all.flatMap((seat) => seat.cashOnHand.kind === "missing" ? [seat.cashOnHand.reason] : []);
  if (values.length >= 2 && reasons.length >= 2) expect(new Set(reasons).size).toBeGreaterThan(1);

  const profile = await repository.getSeatProfile(releaseId, manifest.profileSeatCycleIds[0]!);
  expect(profile).not.toBeNull(); seatProfileSchema.parse(profile);
  const profileId = String(manifest.profileSeatCycleIds[0]); const profileCycle = cycles.get(profileId)!; const profileOffice = offices.get(String(profileCycle.officeId))!; const profileMembership = membershipFor(profileId); const profileIncumbent = profileMembership ? people.get(String(profileMembership.personId)) : null;
  const profileContests = manifest.contests.filter((row) => row.seatCycleId === profileCycle.id); const contestIds = new Set(profileContests.map((row) => row.id)); const profileCandidacies = manifest.candidacies.filter((row) => contestIds.has(row.contestId)); const candidacyIds = new Set(profileCandidacies.map((row) => row.id)); const profileOptions = manifest.resultOptions.filter((row) => contestIds.has(row.contestId)); const optionIds = new Set(profileOptions.map((row) => row.id)); const profileFinance = manifest.fecFilingSummaries.filter((row) => row.seatCycleId === profileCycle.id); const committeeIds = new Set(profileFinance.map((row) => row.committeeId));
  const missingFinance = manifest.financeSummaries.filter((summary): summary is Extract<typeof summary, { kind: "missing" }> => summary.seatCycleId === profileCycle.id && summary.kind === "missing");
  const profileRows = [profileOffice, profileCycle, manifest.geographyVersions.find((row) => row.id === profileCycle.geographyVersionId)!, manifest.officeTerms.find((row) => row.id === profileCycle.officeTermId)!, ...(profileMembership ? [profileMembership] : []), ...(profileIncumbent ? [profileIncumbent] : []), ...profileContests, ...profileCandidacies, ...profileOptions, ...manifest.electionResults.filter((row) => contestIds.has(row.contestId) && optionIds.has(row.resultOptionId)), ...manifest.acsObservations.filter((row) => row.geographyVersionId === profileCycle.geographyVersionId), ...profileFinance, ...manifest.committees.filter((row) => committeeIds.has(row.id)), ...manifest.committeeRelationships.filter((row) => committeeIds.has(row.committeeId) && candidacyIds.has(row.candidacyId))];
  const expectedSnapshotIds = [...new Set([...snapshotIdsFor(profileRows), ...missingFinance.flatMap((summary) => summary.inputs.map((input) => String(input.snapshotId)))])].sort(byteCompare);
  expect(profile!.snapshots.map((snapshot) => snapshot.id)).toEqual(expectedSnapshotIds);
  expect(profile!.sources.map((source) => source.id)).toEqual([...new Set(profile!.snapshots.map((snapshot) => snapshot.sourceId))].sort(byteCompare));
  expect(await repository.getSeatProfile(releaseId, "seat_senate_ak_2_current" as never)).toBeNull();
  expect(await repository.listSeats("rel_missing" as never, seatQuerySchema.parse({}))).toEqual([]);
}
