/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-JSON mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertCaliforniaHouseTopTwoSemanticInvariants, buildCaliforniaHouseTopTwoResultsReceipt, validateCaliforniaHouseTopTwoResultsReceipt } from "./california-house-top-two-results-receipt";

const load = (): any => JSON.parse(readFileSync("data/metadata/california-house-top-two-results-2022-2026-v1.json", "utf8"));
const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const fixture = () => {
  const lock = JSON.parse(readFileSync("data/source-lock.json", "utf8"));
  const entries = lock.entries.filter((entry: any) => entry.retainedPath?.startsWith("data/source/elections/primary-results/california/"));
  const inputs = entries.map((entry: any) => ({ entry, bytes: readFileSync(entry.retainedPath) }));
  const parentBytes = readFileSync("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  return { inputs, parent: { value: JSON.parse(parentBytes.toString("utf8")), fileSha256: hash(parentBytes) } };
};

describe("California House top-two results receipt", () => {
  it("reproduces the complete source-locked proposed receipt", () => {
    const context = fixture(), value = validateCaliforniaHouseTopTwoResultsReceipt(load());
    expect(buildCaliforniaHouseTopTwoResultsReceipt(context.inputs, context.parent)).toEqual(value);
    expect(value.summary).toEqual(expect.objectContaining({ cycles: 3, contests: 156, candidates: 814, votes: 23007877, writeIns: 20, sourceIncumbentMarkers: 45, evaluatorNumericValues: 0, scoreEligibleContests: 0 }));
    expect(value.cycles.map((cycle: any) => [cycle.cycleYear, cycle.contests, cycle.candidates, cycle.votes])).toEqual([[2022, 52, 272, 6896731], [2024, 52, 245, 7283233], [2026, 52, 297, 8827913]]);
  });

  it("preserves top-two party preference without fabricating a Democratic primary metric", () => {
    const value = load();
    expect(value).toEqual(expect.objectContaining({ nominationSystem: "top_two_open_primary", partyFieldMeaning: "candidate_qualified_party_preference", formulaApplicability: "confirmed_incompatible_with_party_primary_metrics" }));
    expect(value.contests.every((contest: any) => contest.selectionStatus === "excluded_formula_incompatible" && contest.sourceWinnerStatus === "not_marked_or_derived" && contest.advancementStatus === "not_derived" && !contest.scoreEligible)).toBe(true);
    expect(value.contests.every((contest: any) => Object.values(contest.evaluatorValues).every((entry) => entry === null))).toBe(true);
    expect(value.contests.flatMap((contest: any) => contest.candidates).some((candidate: any) => candidate.partyPreference === "DEM")).toBe(true);
  });

  it("binds the CD16 recertification and corrected 2026 working-data totals", () => {
    const value = load();
    const cd16 = value.contests.find((contest: any) => contest.cycleYear === 2024 && contest.districtCode === "16");
    expect(cd16).toEqual(expect.objectContaining({ certificationStatus: "certified_statement_of_vote_with_cd16_recertification" }));
    expect(cd16.sourceLockIds).toContain("ca-2024-cd16-primary-recertification");
    expect(cd16.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ sourceCandidateName: "Evan Low", votes: 30261 }), expect.objectContaining({ sourceCandidateName: "Joe Simitian", votes: 30256 })]));
    const cd4 = value.contests.find((contest: any) => contest.cycleYear === 2026 && contest.districtCode === "04");
    expect(cd4.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ sourceCandidateName: "Ray Riehle", votes: 42883 }), expect.objectContaining({ sourceCandidateName: "Chuck Uribe", votes: 7235 }), expect.objectContaining({ sourceCandidateName: "Thomas M Roach", votes: 1527 })]));
    expect(cd4.contestTotalVotes).toBe(206887);
  });

  it("rejects lifecycle, formula, advancement, arithmetic, and evaluator escalation", () => {
    for (const mutate of [
      (value: any) => { value.publicationEligible = true; },
      (value: any) => { value.review.status = "approved"; },
      (value: any) => { value.review.reviewer = "fabricated"; },
      (value: any) => { value.formulaApplicability = "compatible"; },
      (value: any) => { value.contests[0].advancementStatus = "advanced"; },
      (value: any) => { value.contests[0].scoreEligible = true; },
      (value: any) => { value.contests[0].evaluatorValues.priorPrimaryMargin = 1; },
      (value: any) => { value.contests[0].contestTotalVotes += 1; },
    ]) {
      const value = load(); mutate(value);
      expect(() => assertCaliforniaHouseTopTwoSemanticInvariants(value)).toThrow();
    }
  });

  it("fails closed on source, parent, package, and contest-set drift", () => {
    const source = fixture(); source.inputs[0].entry = { ...source.inputs[0].entry, sha256: "0".repeat(64) };
    expect(() => buildCaliforniaHouseTopTwoResultsReceipt(source.inputs, source.parent)).toThrow();
    const parent = fixture(); parent.parent.fileSha256 = "0".repeat(64);
    expect(() => buildCaliforniaHouseTopTwoResultsReceipt(parent.inputs, parent.parent)).toThrow();
    const packageDrift = load(); packageDrift.packageSha256 = "0".repeat(64);
    expect(() => validateCaliforniaHouseTopTwoResultsReceipt(packageDrift)).toThrow();
    const setDrift = load(); setDrift.summary.contestSetSha256 = "0".repeat(64);
    expect(() => validateCaliforniaHouseTopTwoResultsReceipt(setDrift)).toThrow();
  });
});
