import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseWashingtonHouseTopTwoResultsReceipt, validateWashingtonHouseTopTwoResultsReceipt } from "./washington-house-top-two-results-receipt";

const input = () => ({
  2022: readFileSync(resolve("data/source/elections/primary-results/wa-2022-house-primary.csv")),
  2024: readFileSync(resolve("data/source/elections/primary-results/wa-2024-house-primary.csv")),
  certification2022: readFileSync(resolve("data/source/elections/primary-results/wa-2022-primary-certification.pdf")),
  certification2024: readFileSync(resolve("data/source/elections/primary-results/wa-2024-primary-certification.pdf")),
});

describe("Washington House top-two raw-results receipt", () => {
  it("pins both retained official exports and retains every House candidate including write-ins", () => {
    const receipt = validateWashingtonHouseTopTwoResultsReceipt(parseWashingtonHouseTopTwoResultsReceipt(input()));
    expect(receipt.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleYear: 2022, byteSize: 10929, fileSha256: "e6be25e87a37cf1e577c2678cd172083d860d25b7b9480ea0bd09ca73c72bfa8" }),
      expect.objectContaining({ cycleYear: 2024, byteSize: 9671, fileSha256: "244c1ebb89a9211e254e1115aacfe814f502b96a97552dff7791942c2eff8135" }),
    ]));
    expect(receipt.summary).toMatchObject({ cycles: 2, contests: 20, evaluatorNumericValues: 0, scoreEligibleContests: 0 });
    expect(new Set(receipt.contests.map((contest) => `${contest.cycleYear}:${contest.districtCode}`)).size).toBe(20);
    expect(receipt.contests.every((contest) => contest.candidates.some((candidate) => candidate.isWriteIn))).toBe(true);
    expect(receipt.contests.every((contest) => contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0) === contest.contestTotalVotes)).toBe(true);
  });

  it("is a reviewer-only top-two receipt with no score-eligible or public evaluator values", () => {
    const receipt = parseWashingtonHouseTopTwoResultsReceipt({ ...input(), 2022: input()[2022].toString("utf8") });
    expect(receipt).toMatchObject({ reviewerOnly: true, publicationEligible: false, originalPublisher: "Washington Secretary of State", certificationStatus: "certified", nominationSystem: "top_two", formulaApplicability: "confirmed_incompatible", methodologyParent: { disposition: "excluded_methodology", packageSha256: "a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb" } });
    expect(receipt.certifications).toHaveLength(2);
    expect(receipt.contests.every((contest) => !contest.scoreEligible && contest.evaluatorValues.priorPrimaryMargin === null && contest.evaluatorValues.priorDemocraticPrimaryVotes === null && contest.evaluatorValues.priorProgressivePrimaryShare === null)).toBe(true);
    expect(new Set(receipt.sources.map((source) => source.sourceSha256)).size).toBe(2);
    expect(new Set(receipt.contests.map((contest) => contest.contestSha256)).size).toBe(20);
  });

  it("fails closed on byte, total, percentage, and package mutations", () => {
    const files = input();
    const altered = Buffer.from(files[2022]); altered[10] ^= 1;
    expect(() => parseWashingtonHouseTopTwoResultsReceipt({ ...files, 2022: altered })).toThrow("SOURCE_FILE_RECEIPT_MISMATCH");
    const alteredCertification = Buffer.from(files.certification2024); alteredCertification[100] ^= 1;
    expect(() => parseWashingtonHouseTopTwoResultsReceipt({ ...files, certification2024: alteredCertification })).toThrow("CERTIFICATION_FILE_RECEIPT_MISMATCH");
    const receipt = parseWashingtonHouseTopTwoResultsReceipt(files);
    const total = structuredClone(receipt); (total.contests[0]! as { contestTotalVotes: number }).contestTotalVotes += 1;
    expect(() => validateWashingtonHouseTopTwoResultsReceipt(total)).toThrow("PACKAGE_INVARIANT_INVALID");
    const percentage = structuredClone(receipt); (percentage.contests[0]!.candidates[0]! as { suppliedPercentage: number }).suppliedPercentage += 1;
    expect(() => validateWashingtonHouseTopTwoResultsReceipt(percentage)).toThrow("PACKAGE_INVARIANT_INVALID");
    expect(createHash("sha256").update(files[2024]).digest("hex")).toBe(receipt.sources.find((source) => source.cycleYear === 2024)!.fileSha256);
  });

  it("binds the generated receipt to both official sources and the excluded methodology parent", () => {
    const artifactPath = "data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json";
    const artifactBytes = readFileSync(resolve(artifactPath));
    const artifact = validateWashingtonHouseTopTwoResultsReceipt(JSON.parse(artifactBytes.toString("utf8")));
    const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
    const entry = lock.entries.find((row) => row.id === "washington-house-top-two-results-receipt-20220802-20240806-v1")!;
    expect(entry).toMatchObject({ retainedPath: artifactPath, byteSize: artifactBytes.byteLength, sha256: createHash("sha256").update(artifactBytes).digest("hex"), kind: "review_proposal" });
    expect(new Set(entry.parentIds)).toEqual(new Set(["wa-2022-house-primary-results", "wa-2024-house-primary-results", "wa-2022-primary-certification", "wa-2024-primary-certification", "house-democratic-primary-source-selection-proposal-20260804-v1"]));
    expect(artifact.packageSha256).toBe("a930a28888f3892f0b4459063b0d0a2c195bfada26960b705757124a403e5e13");
  });
});
