/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-JSON and source-lock mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNcPrimarySourcePrecedenceDecision, validateNcPrimarySourcePrecedenceDecision } from "./north-carolina-primary-source-precedence-decision";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const artifact = "data/metadata/north-carolina-primary-source-precedence-decision-v1.json";
const receiptPath = "data/metadata/north-carolina-house-democratic-primary-results-2022-2026-v1.json";
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const packageDigest = (value: any): string => { const unsigned = structuredClone(value); delete unsigned.packageSha256; return createHash("sha256").update("dsa-seats:nc-primary-source-precedence-decision:v1\0", "ascii").update(canonicalJson(unsigned)).digest("hex"); };
const load = (): any => JSON.parse(readFileSync(artifact, "utf8"));
function fixture() {
  const receiptBytes = readFileSync(receiptPath);
  const sourceLock = JSON.parse(readFileSync("data/source-lock.json", "utf8"));
  return { receipt: JSON.parse(receiptBytes.toString("utf8")), receiptFileSha256: sha(receiptBytes), sourceLockEntries: sourceLock.entries };
}

describe("North Carolina primary source-precedence decision", () => {
  it("reproduces the hash-bound proposal", () => {
    expect(buildNcPrimarySourcePrecedenceDecision(fixture())).toEqual(validateNcPrimarySourcePrecedenceDecision(load()));
  });
  it("retains the exact conflict and recommendation", () => {
    const value = load();
    expect(value.evidence).toMatchObject({ archiveVotes: 424306, canvassVotes: 424321, delta: 15, differenceCount: 4 });
    expect(value.evidence.scope).toEqual({ cycleYear: 2022, reportedContestsInSourceCohort: 9, affectedContestIds: ["nc:2022:regular:us-house:03:democratic", "nc:2022:regular:us-house:11:democratic"], conflictingCandidateRows: 4 });
    expect(value.evidence.differences.map((row: any) => [row.sourceCandidateName, row.delta])).toEqual([["Barbara D. Gaskins", 9], ["Joe Swartz", 3], ["Jasmine Beach-Ferrara", 2], ["Jay Carey", 1]]);
    expect(value.recommendedDecision.choice).toBe("use_final_state_canvass_for_certified_2022_candidate_totals");
  });
  it("keeps the safe default and every authority field unresolved", () => {
    const value = load();
    expect(value).toMatchObject({ reviewerOnly: true, publicationEligible: false, scoreEligible: false });
    expect(value.defaultReversibleAssumption).toMatchObject({ choice: "exclude_affected_rows_pending_review", evaluatorUse: "excluded", publicationUse: "excluded" });
    expect(value.resolution).toEqual({ status: "proposed", decision: null, reviewer: null, reviewedAt: null, rationale: null });
    expect(value.blocks.blocksUnrelatedWork).toBe(false);
  });
  it("fails closed on parent, source, evidence, lifecycle, and hash drift", () => {
    const badParent = fixture(); badParent.receiptFileSha256 = "0".repeat(64);
    expect(() => buildNcPrimarySourcePrecedenceDecision(badParent)).toThrow(/RECEIPT_FILE_HASH/);
    const badSource = fixture(); badSource.sourceLockEntries = badSource.sourceLockEntries.map((entry: any) => entry.id === "nc-2022-primary-official-results-archive" ? { ...entry, sha256: "0".repeat(64) } : entry);
    expect(() => buildNcPrimarySourcePrecedenceDecision(badSource)).toThrow(/SOURCE_LOCK/);
    const missingReceipt = fixture(); missingReceipt.sourceLockEntries = missingReceipt.sourceLockEntries.filter((entry: any) => entry.id !== "north-carolina-house-democratic-primary-results-2022-2026-v1");
    expect(() => buildNcPrimarySourcePrecedenceDecision(missingReceipt)).toThrow(/SOURCE_LOCK_CLOSURE/);
    for (const field of ["retainedPath", "kind", "parentIds"] as const) {
      const badMetadata = fixture(); badMetadata.sourceLockEntries = badMetadata.sourceLockEntries.map((entry: any) => entry.id === "nc-2022-primary-official-results-archive" ? { ...entry, [field]: field === "parentIds" ? ["invented"] : "invented" } : entry);
      expect(() => buildNcPrimarySourcePrecedenceDecision(badMetadata)).toThrow(/SOURCE_LOCK/);
    }
    const duplicateRegistry = fixture(); duplicateRegistry.sourceLockEntries.push(duplicateRegistry.sourceLockEntries.find((entry: any) => entry.id === "nc-2022-primary-official-results-archive"));
    expect(() => buildNcPrimarySourcePrecedenceDecision(duplicateRegistry)).toThrow(/SOURCE_LOCK_CLOSURE/);
    for (const mutate of [(value: any) => { value.inputs.sources[1] = structuredClone(value.inputs.sources[0]); }, (value: any) => { value.inputs.sources.reverse(); }]) {
      const value = load(); mutate(value); value.packageSha256 = packageDigest(value); expect(() => validateNcPrimarySourcePrecedenceDecision(value)).toThrow(/SOURCE_SET/);
    }
    for (const mutate of [(value: any) => { value.evidence.differences[0].canvassVotes--; }, (value: any) => { value.evidence.scope.reportedContestsInSourceCohort = 8; }, (value: any) => { value.publicationEligible = true; }, (value: any) => { value.scoreEligible = true; }, (value: any) => { value.resolution.reviewer = "fabricated"; }, (value: any) => { value.resolution.decision = "approved"; }, (value: any) => { value.packageSha256 = "0".repeat(64); }]) {
      const value = load(); mutate(value); expect(() => validateNcPrimarySourcePrecedenceDecision(value)).toThrow();
    }
  });
});
