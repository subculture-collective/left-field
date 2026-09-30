import { describe, expect, it } from "vitest";

import { readSourceLock } from "./intake/source-lock";
import { buildStateLegislativeGeneralResults, generalPartyOf, readStateLegislativeGeneralResults, type StateGeneralAdapter } from "./state-legislative-general-results";
import { CALIFORNIA_GENERAL } from "./state-general/california";
import { GEORGIA_GENERAL } from "./state-general/georgia";
import { ILLINOIS_GENERAL } from "./state-general/illinois";
import { NEW_YORK_GENERAL } from "./state-general/new-york";
import { PENNSYLVANIA_GENERAL } from "./state-general/pennsylvania";
import { COLORADO_GENERAL } from "./state-general/colorado";
import { CONNECTICUT_GENERAL } from "./state-general/connecticut";
import { MARYLAND_GENERAL } from "./state-general/maryland";
import { NORTH_CAROLINA_GENERAL } from "./state-general/north-carolina";
import { WASHINGTON_GENERAL, washingtonPreference } from "./state-general/washington";
import { VIRGINIA_GENERAL } from "./state-general/virginia";
import { WISCONSIN_GENERAL } from "./state-general/wisconsin";

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

  it("reads Illinois totals and Wisconsin canvass sheets", () => {
    const value = buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [ILLINOIS_GENERAL, WISCONSIN_GENERAL]);
    expect(value.states.map((state) => [state.stateCode, state.contests, state.lowerContests, state.upperContests, state.cycles])).toEqual([["IL", 319, 236, 83, [2022, 2024]], ["WI", 132, 99, 33, [2022, 2024]]]);
    const il31 = value.contests.find((contest) => contest.contestId === "il:state-leg-general:2024:upper:31");
    expect(il31?.candidates.map((candidate) => [candidate.name.toUpperCase(), candidate.party, candidate.votes])).toEqual([["MARY EDLY-ALLEN", "Democratic", 52654], ["ASHLEY JENSEN", "Republican", 37880]]);
    expect(value.contests.filter((contest) => contest.stateCode === "IL").flatMap((contest) => contest.candidates).filter((candidate) => candidate.writeIn).every((candidate) => candidate.rawParty === "" && candidate.votes < 1000)).toBe(true);
    const wi1 = value.contests.find((contest) => contest.contestId === "wi:state-leg-general:2024:lower:1");
    expect(wi1).toMatchObject({ totalVotes: 38929, democraticVotes: 14801, republicanVotes: 24101, contested: true });
    expect(wi1?.candidates.filter((candidate) => candidate.writeIn).map((candidate) => [candidate.name, candidate.votes])).toEqual([["Scattering", 22], ["Milt Swagel", 5]]);
    const wiSenate = value.contests.filter((contest) => contest.stateCode === "WI" && contest.chamber === "upper");
    expect(wiSenate.filter((contest) => contest.cycleYear === 2024).map((contest) => Number(contest.district) % 2)).toEqual(Array(16).fill(0));
    expect(wiSenate.filter((contest) => contest.cycleYear === 2022)).toHaveLength(17);
  });

  it("sums Pennsylvania precinct returns and resolves the listed cross-filed candidate", () => {
    const value = buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [PENNSYLVANIA_GENERAL]);
    expect(value.states.map((state) => [state.stateCode, state.contests, state.lowerContests, state.upperContests, state.cycles])).toEqual([["PA", 456, 406, 50, [2022, 2024]]]);
    expect(value.contests.find((contest) => contest.contestId === "pa:state-leg-general:2024:upper:1")?.candidates).toEqual([{ name: "Nikil Saval", rawParty: "DEM", party: "Democratic", votes: 109193, writeIn: false }]);
    expect(value.contests.find((contest) => contest.contestId === "pa:state-leg-general:2024:lower:32")).toMatchObject({ contested: false, democraticMarginPercentagePoints: 100, candidates: [{ rawParty: "D/R", party: "Democratic", votes: 31207 }] });
    const senate2024 = value.contests.filter((contest) => contest.chamber === "upper" && contest.cycleYear === 2024).map((contest) => Number(contest.district) % 2);
    expect(senate2024).toEqual(Array(25).fill(1));
  });

  it("reads Washington positions, Maryland multi-member districts, Connecticut fusion, Colorado and North Carolina", () => {
    expect(["(Prefers Democratic Party)", "(Prefers GOP Party)", "(States No Party Preference)", "(Prefers Culture Republican Party)"].map(washingtonPreference)).toEqual(["Democratic", "GOP", "No Party Preference", "Culture Republican"]);
    const value = buildStateLegislativeGeneralResults(process.cwd(), readSourceLock(), [COLORADO_GENERAL, CONNECTICUT_GENERAL, MARYLAND_GENERAL, NORTH_CAROLINA_GENERAL, WASHINGTON_GENERAL]);
    expect(value.states.map((state) => [state.stateCode, state.contests, state.lowerContests, state.upperContests])).toEqual([["CO", 165, 130, 35], ["CT", 187, 151, 36], ["MD", 118, 71, 47], ["NC", 170, 120, 50], ["WA", 246, 196, 50]]);
    const wa = value.contests.find((contest) => contest.contestId === "wa:state-leg-general:2024:lower:1:pos-1");
    expect(wa).toMatchObject({ position: "1", democraticVotes: 55168, republicanVotes: 24467, totalVotes: 79741 });
    const md = value.contests.filter((contest) => contest.stateCode === "MD" && contest.chamber === "lower");
    expect(md.reduce((sum, contest) => sum + contest.seats, 0)).toBe(141);
    expect(md.find((contest) => contest.districtKey === "1a")).toMatchObject({ seats: 1, democraticVotes: 2829, republicanVotes: 11971 });
    expect(value.contests.find((contest) => contest.contestId === "ct:state-leg-general:2024:upper:1")).toMatchObject({ totalVotes: 21208, democraticVotes: 18512 });
    expect(value.contests.find((contest) => contest.contestId === "co:state-leg-general:2024:upper:2")).toMatchObject({ democraticMarginPercentagePoints: -23.9 });
    expect(value.contests.find((contest) => contest.contestId === "nc:state-leg-general:2024:lower:1")).toMatchObject({ democraticVotes: 17160, republicanVotes: 31950 });
  });

  it("matches the pinned artifact", () => {
    const pinned = readStateLegislativeGeneralResults();
    expect(pinned.packageSha256).toBe(buildStateLegislativeGeneralResults().packageSha256);
  });
});
