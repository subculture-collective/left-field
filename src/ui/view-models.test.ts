import { describe, expect, it } from "vitest";
import { canonicalManifest } from "@/data/canonical-manifest";
import { seatQuerySchema } from "@/domain/repository";
import type { SeatResearchRepository } from "@/domain/repository";
import { InMemorySeatResearchRepository } from "@/repositories/in-memory";
import { createManifestSeatProjection } from "@/repositories/manifest-projection";
import { encodeSeatCursor } from "@/repositories/pagination";
import { classifyProfileLookup, classifyProfileRequest, loadBrowsePage, loadProfilePage, loadSourcesPage, parseBrowseQuery } from "./server-data";
import { compileBrowsePage, compileMethodologyPage, compileProfilePage, compileSourcesPage } from "./view-models";

describe("UI data boundary", () => {
  const projection = createManifestSeatProjection(canonicalManifest);
  it("preserves list metric missingness and explicit no-ranking disclosure", () => {
    const rows = projection.list(seatQuerySchema.parse({})); const model = compileBrowsePage(canonicalManifest.release, { releaseId: canonicalManifest.release.id, items: [...rows], total: rows.length, nextCursor: null }, seatQuerySchema.parse({}), projection.facets());
    expect(model.rows.find((row) => row.stateCode === "AL")?.presidentialMargin2024.value).toEqual({ kind: "missing", reason: "not_defensibly_modeled" });
    expect(model.disclosure.rankings).toContain("No rankings");
  });
  it("keeps unavailable election status and complete profile source closure", () => {
    const profile = projection.profile(canonicalManifest.profileSeatCycleIds[1]!); const seat = projection.list(seatQuerySchema.parse({})).find((row) => row.id === profile?.seatCycle.id); if (!profile || !seat) throw new Error("fixture missing"); const model = compileProfilePage(profile, seat);
    expect(model.elections.some((election) => election.certificationStatus === "unavailable")).toBe(true);
    expect(model.sourceClosure.snapshots.length).toBeGreaterThan(0); expect(model.sourceClosure.sources.length).toBeGreaterThan(0);
  });
  it("preserves result options, values, contest context, and exact lineages", () => {
    const profile = canonicalManifest.profileSeatCycleIds.map((id) => projection.profile(id)).find((item) => item?.resultOptions.some((option) => option.candidacyId !== null)); if (!profile) throw new Error("fixture missing"); const seat = projection.list(seatQuerySchema.parse({})).find((row) => row.id === profile.seatCycle.id); const result = profile.electionResults.find((item) => profile.resultOptions.find((option) => option.id === item.resultOptionId)?.candidacyId !== null); if (!seat || !result) throw new Error("fixture missing"); const option = profile.resultOptions.find((item) => item.id === result.resultOptionId)!; const candidacy = profile.candidacies.find((item) => item.id === option.candidacyId)!; const contest = profile.contests.find((item) => item.id === result.contestId)!; const model = compileProfilePage(profile, seat); const row = model.electionResults.find((item) => item.resultOptionId === option.id)!;
    expect(row).toMatchObject({ label: option.label, party: option.party, votes: result.votes, denominatorVotes: contest.denominatorVotes, certificationStatus: contest.certificationStatus, reportingCompletenessPercent: contest.reportingCompletenessPercent, allocationMethod: contest.allocationMethod, lineage: result.lineage });
    expect(row.provenance).toEqual(option.provenance);
    expect(row.candidacyParty).toBe(candidacy.party);
  });
  it("preserves browse headline missing finance and presidential facts", () => {
    const seat = projection.list(seatQuerySchema.parse({})).find((row) => row.presidentialMargin2024.value.kind === "missing" && row.cashOnHand.kind === "missing"); const profile = seat ? projection.profile(seat.id) : null; if (!profile || !seat) throw new Error("fixture missing"); const model = compileProfilePage(profile, seat);
    expect(model.headlineFacts).toEqual({ presidentialMargin2024: seat.presidentialMargin2024, cashOnHand: seat.cashOnHand });
    expect(model.headlineFacts.presidentialMargin2024.value).toEqual({ kind: "missing", reason: "not_defensibly_modeled" });
    expect(model.headlineFacts.cashOnHand.kind).toBe("missing");
  });
  it("associates source snapshots without inventing a source", () => {
    const model = compileSourcesPage(canonicalManifest.release, canonicalManifest.sources, projection.snapshots());
    expect(model.sources.every(({ source, snapshots }) => snapshots.every((snapshot) => snapshot.sourceId === source.id))).toBe(true);
    expect(model.snapshotScope).toContain("full active-release snapshot inventory");
    expect(model.sources.flatMap(({ snapshots }) => snapshots)).toHaveLength(projection.snapshots().length);
  });
  it("deduplicates exact source snapshots and orders the sources closure bytewise", () => {
    const snapshots = projection.snapshots(); const snapshot = snapshots[0]!;
    const model = compileSourcesPage(canonicalManifest.release, [...canonicalManifest.sources].reverse(), [...snapshots, { ...snapshot }]);
    expect(model.sources.map(({ source }) => source.id)).toEqual([...canonicalManifest.sources.map((source) => source.id)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(model.sources.flatMap(({ snapshots }) => snapshots).filter((item) => item.id === snapshot.id)).toHaveLength(1);
    expect(model.sources.flatMap(({ snapshots }) => snapshots).map((item) => item.id)).toEqual([...new Set(snapshots.map((item) => item.id))].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
  });
  it("rejects conflicting source snapshots with the same id", () => {
    const snapshot = projection.snapshots()[0]!;
    expect(() => compileSourcesPage(canonicalManifest.release, canonicalManifest.sources, [snapshot, { ...snapshot, sourceUrl: "https://example.com/conflict" }])).toThrow(`Conflicting source snapshot id: ${snapshot.id}`);
  });
  it("rejects demographic and unknown URL query keys", () => {
    expect(parseBrowseQuery({ medianHouseholdIncome: "1" })).toEqual({ ok: false, code: "invalid_request" });
    expect(parseBrowseQuery({ nope: "x" })).toEqual({ ok: false, code: "invalid_request" });
    expect(parseBrowseQuery({ stateCode: ["AL", "CA"] })).toEqual({ ok: false, code: "invalid_request" });
    expect(parseBrowseQuery({ stateCode: "AL", electionYear: "2026" })).toEqual({ ok: true, value: expect.objectContaining({ stateCode: "AL", electionYear: 2026, limit: 50 }) });
  });
  it("normalizes empty values from partial and default browse form submissions", () => {
    expect(parseBrowseQuery({ identitySearch: "Ada", chamber: "", stateCode: "", party: "democratic", incumbencyStatus: "", electionYear: "", sort: "", direction: "" })).toEqual({ ok: true, value: { identitySearch: "Ada", party: "democratic", sort: "state", direction: "asc", limit: 50 } });
    expect(parseBrowseQuery({ identitySearch: "", chamber: "", stateCode: "", party: "", incumbencyStatus: "", electionYear: "", sort: "", direction: "" })).toEqual({ ok: true, value: { sort: "state", direction: "asc", limit: 50 } });
  });
  it("classifies malformed and absent profile requests with finite public errors", () => {
    expect(classifyProfileRequest(canonicalManifest.release.id, { id: "bad" })).toEqual({ ok: false, code: "invalid_request" });
    expect(classifyProfileRequest(canonicalManifest.release.id, { id: "seat_missing" })).toEqual({ ok: true, value: { id: "seat_missing" } });
    expect(classifyProfileLookup(null)).toEqual({ ok: false, code: "not_found" });
  });
  it("uses methodology wording supported by the ACS and finance contracts", () => {
    const methodology = compileMethodologyPage(canonicalManifest.release);
    expect(methodology.sections.find((section) => section.topic === "ACS uncertainty")?.explanation).not.toContain("methodology, status");
    expect(methodology.sections.find((section) => section.topic === "FEC filings")?.explanation).toContain("not every profile has a filing");
  });
  it("loads browse with one page and facet request, never legacy listSeats", async () => {
    const { repo, calls } = recordingRepository(); const result = await loadBrowsePage({ stateCode: "AL" }, repo);
    expect(result).toMatchObject({ ok: true, value: { total: 3, nextCursor: null, appliedQuery: { stateCode: "AL", sort: "state", direction: "asc" }, available: { states: projection.facets().states } } });
    expect(calls).toEqual(["getActiveRelease", "listSeatPage", "getSeatFacets"]);
  });
  it("accepts opaque cursors and leaves cursor mismatch validation to the repository", async () => {
    const { repo, calls } = recordingRepository(); const cursor = encodeSeatCursor({ v: 1, releaseId: canonicalManifest.release.id, query: seatQuerySchema.parse({ stateCode: "CA" }), missing: false, sortValue: "CA", id: "seat_ca_sen_2026" });
    expect(parseBrowseQuery({ cursor })).toMatchObject({ ok: true, value: { cursor, limit: 50 } });
    await expect(loadBrowsePage({ stateCode: "AL", cursor }, repo)).resolves.toEqual({ ok: false, code: "unavailable" });
    expect(calls).toEqual(["getActiveRelease", "listSeatPage", "getSeatFacets"]);
  });
  it("loads a profile by direct profile and list-item lookup", async () => {
    const { repo, calls } = recordingRepository(); const id = canonicalManifest.profileSeatCycleIds[0]!;
    await expect(loadProfilePage({ id }, repo)).resolves.toMatchObject({ ok: true, value: { identity: { id } } });
    expect(calls).toEqual(["getActiveRelease", "getSeatProfile", "getSeatListItem"]);
  });
  it("loads the full active-release source snapshot inventory without seat fanout", async () => {
    const { repo, calls } = recordingRepository(); const result = await loadSourcesPage(repo);
    expect(result).toMatchObject({ ok: true, value: { snapshotScope: expect.stringContaining("full active-release snapshot inventory") } });
    expect(calls).toEqual(["getActiveRelease", "listSources", "listSourceSnapshots"]);
  });
});

function recordingRepository(): { repo: SeatResearchRepository; calls: string[] } {
  const memory = new InMemorySeatResearchRepository(canonicalManifest); const calls: string[] = [];
  const repo: SeatResearchRepository = {
    getActiveRelease: async () => { calls.push("getActiveRelease"); return memory.getActiveRelease(); },
    getRelease: async (id) => memory.getRelease(id),
    listSeats: async (id, query) => { calls.push("listSeats"); return memory.listSeats(id, query); },
    listSeatPage: async (id, request) => { calls.push("listSeatPage"); return memory.listSeatPage(id, request); },
    getSeatListItem: async (id, seatId) => { calls.push("getSeatListItem"); return memory.getSeatListItem(id, seatId); },
    getSeatProfile: async (id, seatId) => { calls.push("getSeatProfile"); return memory.getSeatProfile(id, seatId); },
    getSeatFacets: async (id) => { calls.push("getSeatFacets"); return memory.getSeatFacets(id); },
    listSources: async (id) => { calls.push("listSources"); return memory.listSources(id); },
    listSourceSnapshots: async (id) => { calls.push("listSourceSnapshots"); return memory.listSourceSnapshots(id); },
  };
  return { repo, calls };
}
