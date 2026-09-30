import { describe, expect, it } from "vitest";

import { readSourceLock } from "./intake/source-lock";
import { buildStateLegislativeGeneralResults, generalPartyOf, readStateLegislativeGeneralResults, type StateGeneralAdapter } from "./state-legislative-general-results";
import { CALIFORNIA_GENERAL } from "./state-general/california";
import { GEORGIA_GENERAL } from "./state-general/georgia";
import { NEW_YORK_GENERAL } from "./state-general/new-york";
import { VIRGINIA_GENERAL } from "./state-general/virginia";

describe("state-legislative general results", () => {
  it("maps source party labels to caucus families", () => {
    expect(["D", "DEM", "Dem", "Democratic", "DFL", "Democratic-Farmer-Labor"].map(generalPartyOf)).toEqual(Array(6).fill("Democratic"));
    expect(["R", "REP", "Rep", "Republican", "GOP"].map(generalPartyOf)).toEqual(Array(5).fill("Republican"));
    expect(["", "I", "IND", "Independent", "NPA", "Nonpartisan"].map(generalPartyOf)).toEqual(Array(6).fill("Independent"));
    expect(["L", "Lib", "Grn", "Working Families", "Conservative"].map(generalPartyOf)).toEqual(Array(5).fill("Other"));
  });

  it("normalizes a synthetic adapter: margins, uncontested flags, multi-member totals", () => {
    const lock = readSourceLock();
    // Borrow a retained file so readRetainedSource succeeds; the parser ignores its bytes.
    const source = { ...GEORGIA_GENERAL.sources[0]!, cycleYear: 2024, electionDate: "2024-11-05" };
    const adapter: StateGeneralAdapter = {
      stateCode: "ZZ", authority: "synthetic", sources: [source], expectedContests: { [source.id]: 4 },
      parse: () => [
        { chamber: "lower", district: "1", candidates: [{ name: "A", rawParty: "D", votes: 600 }, { name: "B", rawParty: "R", votes: 400 }] },
        { chamber: "lower", district: "2", candidates: [{ name: "C", rawParty: "R", votes: 900 }, { name: "Write-In", rawParty: "", votes: 10, writeIn: true }] },
        { chamber: "upper", district: "3", seats: 2, candidates: [{ name: "D1", rawParty: "D", votes: 500 }, { name: "D2", rawParty: "D", votes: 450 }, { name: "R1", rawParty: "R", votes: 300 }, { name: "R2", rawParty: "R", votes: 250 }] },
        { chamber: "lower", district: "Rockingham 13", candidates: [{ name: "E", rawParty: "D", votes: 0 }] },
      ],
    };
    const value = buildStateLegislativeGeneralResults(process.cwd(), lock, [adapter]);
    const byKey = new Map(value.contests.map((contest) => [`${contest.chamber}|${contest.districtKey}`, contest]));
    expect(byKey.get("lower|1")).toMatchObject({ democraticMarginPercentagePoints: 20, contested: true, totalVotes: 1000 });
    expect(byKey.get("lower|2")).toMatchObject({ democraticMarginPercentagePoints: -98.9, contested: false, republicanVotes: 900 });
    expect(byKey.get("upper|3")).toMatchObject({ seats: 2, democraticVotes: 950, republicanVotes: 550, democraticMarginPercentagePoints: 26.7, contested: true });
    expect(byKey.get("lower|rockingham 13")).toMatchObject({ democraticMarginPercentagePoints: 100, contested: false, totalVotes: 0 });
    expect(value.states).toEqual([{ stateCode: "ZZ", sourceIds: [source.id], cycles: [2024], contests: 4, lowerContests: 3, upperContests: 1, uncontested: 2, candidateVotes: 3410 }]);
    expect(value.summary).toEqual({ states: 1, contests: 4, uncontested: 2, candidateVotes: 3410, multiMemberContests: 1 });
  });

  it("fails closed when an adapter reports fewer contests than declared", () => {
    const source = GEORGIA_GENERAL.sources[0]!;
    const adapter: StateGeneralAdapter = { stateCode: "ZZ", authority: "synthetic", sources: [source], expectedContests: { [source.id]: 2 }, parse: () => [{ chamber: "lower", district: "1", candidates: [{ name: "A", rawParty: "D", votes: 1 }] }] };
    expect(() => buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [adapter])).toThrow("STATE_LEG_GENERAL_CONTEST_COUNT");
  });

  it("reads Georgia and Virginia from the retained official files", () => {
    const value = buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [GEORGIA_GENERAL, VIRGINIA_GENERAL]);
    expect(value.states.map((state) => [state.stateCode, state.contests, state.lowerContests, state.upperContests, state.cycles])).toEqual([["GA", 236, 180, 56, [2024]], ["VA", 240, 200, 40, [2023, 2025]]]);
    const ga1 = value.contests.find((contest) => contest.contestId === "ga:state-leg-general:2024:upper:1");
    expect(ga1).toMatchObject({ contested: false, democraticMarginPercentagePoints: -100, candidates: [{ name: "Ben Watson", party: "Republican", votes: 76992 }] });
    const va1 = value.contests.find((contest) => contest.contestId === "va:state-leg-general:2025:lower:1");
    expect(va1).toMatchObject({ totalVotes: 41541, democraticVotes: 33850, republicanVotes: 7595, democraticMarginPercentagePoints: 63.2, contested: true });
    expect(va1?.candidates.find((candidate) => candidate.writeIn)).toMatchObject({ votes: 96, party: "Independent" });
    expect(value.summary.multiMemberContests).toBe(0);
  });

  it("reads California top-two and New York fusion returns", () => {
    const value = buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [CALIFORNIA_GENERAL, NEW_YORK_GENERAL]);
    expect(value.states.map((state) => [state.stateCode, state.contests, state.lowerContests, state.upperContests, state.cycles])).toEqual([["CA", 200, 160, 40, [2022, 2024]], ["NY", 213, 150, 63, [2024]]]);
    const ca = value.contests.filter((contest) => contest.stateCode === "CA");
    expect(ca.filter((contest) => contest.cycleYear === 2024 && contest.chamber === "upper").map((contest) => Number(contest.district) % 2)).toEqual(Array(20).fill(1));
    const sameParty = ca.find((contest) => contest.candidates.length === 2 && contest.candidates.every((candidate) => candidate.party === "Democratic"));
    expect(sameParty).toMatchObject({ contested: true, democraticMarginPercentagePoints: 100 });
    const ramos = value.contests.find((contest) => contest.contestId === "ny:state-leg-general:2024:upper:13");
    expect(ramos).toMatchObject({ contested: false, democraticMarginPercentagePoints: 98.4, candidates: [{ name: "Jessica Ramos", party: "Democratic", votes: 48367 }, { name: "Scattering", writeIn: true, votes: 810 }] });
    const fused = value.contests.flatMap((contest) => contest.candidates).filter((candidate) => candidate.rawParty.includes("also"));
    expect(fused.map((candidate) => [candidate.name, candidate.party])).toEqual([["Kalman Yeger", "Democratic"], ["Jaime R. Williams", "Democratic"], ["Simcha Felder", "Republican"]]);
    expect(value.contests.flatMap((contest) => contest.candidates).some((candidate) => ["Blank", "Void", "Total Votes"].includes(candidate.name))).toBe(false);
  });

  it("matches the pinned artifact", () => {
    const pinned = readStateLegislativeGeneralResults();
    expect(pinned.packageSha256).toBe(buildStateLegislativeGeneralResults().packageSha256);
  });
});
