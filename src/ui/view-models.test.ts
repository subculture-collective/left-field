import { describe, expect, it } from "vitest";
import { canonicalManifest } from "@/data/canonical-manifest";
import { seatQuerySchema } from "@/domain/repository";
import { createManifestSeatProjection } from "@/repositories/manifest-projection";
import { classifyProfileLookup, classifyProfileRequest, parseBrowseQuery } from "./server-data";
import { compileBrowsePage, compileMethodologyPage, compileProfilePage, compileSourcesPage } from "./view-models";

describe("UI data boundary", () => {
  const projection = createManifestSeatProjection(canonicalManifest);
  it("preserves list metric missingness and explicit no-ranking disclosure", () => {
    const rows = projection.list(seatQuerySchema.parse({})); const model = compileBrowsePage(canonicalManifest.release, rows, seatQuerySchema.parse({}));
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
    const profile = projection.profile(canonicalManifest.profileSeatCycleIds[0]!); if (!profile) throw new Error("fixture missing"); const model = compileSourcesPage(canonicalManifest.release, canonicalManifest.sources, profile.snapshots);
    expect(model.sources.every(({ source, snapshots }) => snapshots.every((snapshot) => snapshot.sourceId === source.id))).toBe(true);
    expect(model.snapshotScope).toContain("union used by displayed profile records"); expect(model.snapshotScope).toContain("not the full release snapshot inventory");
    expect(model.sources.some(({ snapshots }) => snapshots.length === 0)).toBe(true);
  });
  it("deduplicates exact source snapshots and orders the sources closure bytewise", () => {
    const profile = projection.profile(canonicalManifest.profileSeatCycleIds[0]!); if (!profile) throw new Error("fixture missing"); const snapshot = profile.snapshots[0]!;
    const model = compileSourcesPage(canonicalManifest.release, [...canonicalManifest.sources].reverse(), [...profile.snapshots, { ...snapshot }]);
    expect(model.sources.map(({ source }) => source.id)).toEqual([...canonicalManifest.sources.map((source) => source.id)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(model.sources.flatMap(({ snapshots }) => snapshots).filter((item) => item.id === snapshot.id)).toHaveLength(1);
    expect(model.sources.flatMap(({ snapshots }) => snapshots).map((item) => item.id)).toEqual([...new Set(profile.snapshots.map((item) => item.id))].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
  });
  it("rejects conflicting source snapshots with the same id", () => {
    const profile = projection.profile(canonicalManifest.profileSeatCycleIds[0]!); if (!profile) throw new Error("fixture missing"); const snapshot = profile.snapshots[0]!;
    expect(() => compileSourcesPage(canonicalManifest.release, canonicalManifest.sources, [snapshot, { ...snapshot, sourceUrl: "https://example.com/conflict" }])).toThrow(`Conflicting source snapshot id: ${snapshot.id}`);
  });
  it("rejects demographic and unknown URL query keys", () => {
    expect(parseBrowseQuery({ medianHouseholdIncome: "1" })).toEqual({ ok: false, code: "invalid_request" });
    expect(parseBrowseQuery({ nope: "x" })).toEqual({ ok: false, code: "invalid_request" });
    expect(parseBrowseQuery({ stateCode: "AL", electionYear: "2026" })).toEqual({ ok: true, value: expect.objectContaining({ stateCode: "AL", electionYear: 2026 }) });
  });
  it("normalizes empty values from partial and default browse form submissions", () => {
    expect(parseBrowseQuery({ identitySearch: "Ada", chamber: "", stateCode: "", party: "democratic", incumbencyStatus: "", electionYear: "", sort: "", direction: "" })).toEqual({ ok: true, value: { identitySearch: "Ada", party: "democratic", sort: "state", direction: "asc" } });
    expect(parseBrowseQuery({ identitySearch: "", chamber: "", stateCode: "", party: "", incumbencyStatus: "", electionYear: "", sort: "", direction: "" })).toEqual({ ok: true, value: { sort: "state", direction: "asc" } });
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
});
