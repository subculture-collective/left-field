import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildMainePrimaryResultsReceipt,
  validateMaineRcvSummaryText,
  validateMainePrimaryResultsReceipt,
  type MainePrimaryResultsReceipt,
} from "./maine-house-democratic-primary-results-receipt";

type SourceEntry = {
  id: string;
  url: string;
  retainedPath: string;
  retainedStatus: string;
  byteSize: number;
  sha256: string;
  kind: string;
  parentIds: string[];
};

const expectedSources = [
  ["maine-2022-election-results-index", "data/source/elections/primary-results/maine/2022/results-index.html", 91_949, "6aa4043e4381dd478001c13dd44cf9cc0cf3b123b6eb69bc00faf7c2bc040c3c"],
  ["maine-2024-election-results-index", "data/source/elections/primary-results/maine/2024/results-index.html", 89_290, "c7629e287de1ad4a54bf6cea39b82f4e5bea15f702b38535a3a4b15241b9acca"],
  ["maine-2026-election-results-index", "data/source/elections/primary-results/maine/2026/results-index.html", 102_103, "9ad0566686fe3d7a8365c07cf1c2ea0af8e975d63e09e4adc770034094b74eb4"],
  ["maine-2022-house-democratic-primary-cd01-results", "data/source/elections/primary-results/maine/2022/democratic-cd01.xlsx", 23_933, "ccc458e06f6e32e0254c72e7f6c5aae1945d002830e59ce0c52af7f81fe4247c"],
  ["maine-2022-house-democratic-primary-cd02-results", "data/source/elections/primary-results/maine/2022/democratic-cd02.xlsx", 39_910, "0862338441e04b99ec6eeafbe38e83bdcc50bc55f595d962df73973bd35e35a3"],
  ["maine-2024-house-democratic-primary-cd01-results", "data/source/elections/primary-results/maine/2024/democratic-cd01.xlsx", 22_841, "d5bc8beab80e6d93b0d46c925b36d604e2168b339545b92a960c928a5061179e"],
  ["maine-2024-house-democratic-primary-cd02-results", "data/source/elections/primary-results/maine/2024/democratic-cd02.xlsx", 29_362, "9b52fa0124f30b6bc3fd296b52d81270720ce49ddcefe4c6ef11412d77ab13d4"],
  ["maine-2026-house-democratic-primary-cd01-results", "data/source/elections/primary-results/maine/2026/democratic-cd01.xlsx", 18_714, "18656f07026c2dd1532f8597f920295f13700ca7ab7b1e7e841c805f0a16c11a"],
  ["maine-2026-house-democratic-primary-cd02-first-choice-results", "data/source/elections/primary-results/maine/2026/democratic-cd02-first-choice.xlsx", 42_349, "6f0df9d41a38bff5180ef9bbee6b048f87092aada34343b6ff474b9ba6b2dea5"],
  ["maine-2026-house-democratic-primary-cd02-rcv-summary", "data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.pdf", 36_422, "d308d461baf07b2ca4ebaab087eea30ad118710e19a67c3c9c54cb8fcad2ad38"],
  ["maine-2026-house-democratic-primary-cd02-rcv-summary-layout-text", "data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.txt", 949, "64a534b9204e1291a2fb567d7d70adcdc302dac1f75c749f6f4c78d8b0719f60"],
] as const;

const sourceIds = new Set(expectedSources.map(([id]) => id));
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: SourceEntry[] };
const inputs = () => lock.entries
  .filter((entry) => sourceIds.has(entry.id as (typeof expectedSources)[number][0]))
  .map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const proposalBytes = readFileSync(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
const proposal = { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes };
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/maine-house-democratic-primary-results-2022-2026-v1.json"), "utf8")) as MainePrimaryResultsReceipt;
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

function rehash(value: MainePrimaryResultsReceipt): MainePrimaryResultsReceipt {
  for (const contest of value.contests) {
    const unsigned = { ...contest } as Record<string, unknown>; delete unsigned.contestSha256;
    (contest as unknown as { contestSha256: string }).contestSha256 = hash("dsa-seats:me-house-democratic-primary-result:v1\0", unsigned);
  }
  for (const row of value.targetObservations) {
    const contest = value.contests.find((item) => item.contestId === row.contestId)!;
    (row as unknown as { contestSha256: string }).contestSha256 = contest.contestSha256;
    const unsigned = { ...row } as Record<string, unknown>; delete unsigned.observationSha256;
    (row as unknown as { observationSha256: string }).observationSha256 = hash("dsa-seats:me-house-primary-target-observation:v1\0", unsigned);
  }
  (value.summary as unknown as { contestSetSha256: string }).contestSetSha256 = hash("dsa-seats:me-house-democratic-primary-result-set:v1\0", value.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
  (value.summary as unknown as { targetObservationSetSha256: string }).targetObservationSetSha256 = hash("dsa-seats:me-house-primary-target-observation-set:v1\0", value.targetObservations.map(({ observationId, observationSha256 }) => ({ observationId, observationSha256 })));
  const unsigned = { ...value } as Record<string, unknown>; delete unsigned.packageSha256;
  (value as unknown as { packageSha256: string }).packageSha256 = hash("dsa-seats:me-house-democratic-primary-result-package:v1\0", unsigned);
  return value;
}

describe("Maine Democratic House primary corpus", () => {
  it("pins the exact official Maine result corpus and closes all six target contests", () => {
    expect(expectedSources.map(([id]) => {
      const entry = lock.entries.find((item) => item.id === id);
      return entry && [entry.id, entry.retainedPath, entry.byteSize, entry.sha256];
    })).toEqual(expectedSources.map((source) => [...source]));

    const receipt = validateMainePrimaryResultsReceipt(buildMainePrimaryResultsReceipt(inputs(), proposal, lock));
    expect(receipt.summary).toEqual(expect.objectContaining({
      contests: 6,
      candidates: 9,
      workbookCandidateVotes: 345_162,
      targetObservations: 6,
      scoreEligibleRows: 0,
      evaluatorNumericValues: 0,
    }));
    expect(receipt.contests.map((contest) => contest.contestId)).toEqual(
      [2022, 2024, 2026].flatMap((year) => ["01", "02"].map((district) => `me:${year}:regular:us-house:${district}:democratic`)),
    );
    expect(receipt.cycles.map((cycle) => [cycle.cycleYear, cycle.contests, cycle.candidates, cycle.workbookCandidateVotes])).toEqual([
      [2022, 2, 2, 68_691],
      [2024, 2, 2, 69_490],
      [2026, 2, 5, 206_981],
    ]);
    expect(receipt.contests.map((contest) => [contest.cycleYear, contest.districtCode, contest.workbookCandidateVotes, contest.blankVotes, contest.totalBallotsCast])).toEqual([
      [2022, "01", 43_007, 2_722, 45_729],
      [2022, "02", 25_684, 2_898, 28_582],
      [2024, "01", 46_307, 2_914, 49_221],
      [2024, "02", 23_183, 1_948, 25_131],
      [2026, "01", 128_257, 10_664, 138_921],
      [2026, "02", 78_724, 4_756, 83_480],
    ]);
  });

  it("preserves the 2026 district 2 workbook and central-count RCV projections without flattening their 81-vote delta", () => {
    const receipt = validateMainePrimaryResultsReceipt(buildMainePrimaryResultsReceipt(inputs(), proposal, lock));
    const contest = receipt.contests.find((item) => item.cycleYear === 2026 && item.districtCode === "02")!;
    expect(contest.candidates.map((candidate) => [candidate.sourceCandidateName, candidate.workbookFirstChoiceVotes])).toEqual([
      ["BALDACCI, JOSEPH M", 24_944],
      ["DUNLAP, MATTHEW G", 22_920],
      ["LOUD, PAIGE", 8_182],
      ["WOOD, JORDAN", 22_678],
    ]);
    expect(contest.rankedChoice).toEqual(expect.objectContaining({
      workbookNamedFirstChoiceVotes: 78_724,
      centralCountRoundOneNamedCandidateVotes: 78_805,
      firstChoiceNamedCandidateDelta: 81,
      threshold: 34_240,
      winnerSourceCandidateName: "Dunlap, Matthew G.",
      reconciliationStatus: "distinct_official_projections_not_flattened",
    }));
    expect(contest.rankedChoice!.rounds).toEqual([
      { round: 1, candidateVotes: { "Baldacci, Joseph M.": 24_966, "Dunlap, Matthew G.": 22_933, "Loud, Paige": 8_194, "Wood, Jordan": 22_712 }, exhaustedBallots: 4_675, eliminated: "Loud, Paige", elected: null },
      { round: 2, candidateVotes: { "Baldacci, Joseph M.": 25_923, "Dunlap, Matthew G.": 25_681, "Loud, Paige": 0, "Wood, Jordan": 25_377 }, exhaustedBallots: 6_499, eliminated: "Wood, Jordan", elected: null },
      { round: 3, candidateVotes: { "Baldacci, Joseph M.": 32_555, "Dunlap, Matthew G.": 35_924, "Loud, Paige": 0, "Wood, Jordan": 0 }, exhaustedBallots: 15_001, eliminated: null, elected: "Dunlap, Matthew G." },
    ]);
    expect(contest.sourceWinnerStatus).toBe("explicit_rcv_summary_winner");
    expect(receipt.contests.filter((item) => item.contestId !== contest.contestId).every((item) => item.sourceWinnerStatus === "not_marked_by_source" && item.winnerSourceCandidateName === null)).toBe(true);
    const text = readFileSync(resolve("data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.txt"), "utf8");
    expect(() => validateMaineRcvSummaryText(text.replace("Eliminated            Loud, Paige", "Eliminated            Wood, Jordan"))).toThrow("RCV_SUMMARY_INVALID");
    expect(() => validateMaineRcvSummaryText(text.replace("Elected                                                                  Dunlap, Matthew G.", "Elected                                                                  Baldacci, Joseph M."))).toThrow("RCV_SUMMARY_INVALID");
  });

  it("rejects source drift, topology drift, and fully rehashed identity or lifecycle escalation", () => {
    const source = inputs(); const changed = Buffer.from(source[3]!.bytes); changed[100] = changed[100]! ^ 1;
    expect(() => buildMainePrimaryResultsReceipt([...source.slice(0, 3), { ...source[3]!, bytes: changed }, ...source.slice(4)], proposal, lock)).toThrow("SOURCE_RECEIPT_INVALID");

    const changedLock = structuredClone(lock), output = changedLock.entries.find((entry) => entry.id === "maine-house-democratic-primary-results-2022-2026-v1")!;
    (output as unknown as { parentIds: string[] }).parentIds = [...output.parentIds].reverse();
    expect(() => buildMainePrimaryResultsReceipt(inputs(), proposal, changedLock)).toThrow("SOURCE_LOCK_MISMATCH");

    const score = structuredClone(stored()); (score.contests[0] as unknown as { scoreEligible: boolean }).scoreEligible = true;
    expect(() => validateMainePrimaryResultsReceipt(rehash(score))).toThrow("PACKAGE_INVARIANT_INVALID");
    const identity = structuredClone(stored()); (identity.targetObservations[0] as unknown as { identityApproved: boolean }).identityApproved = true;
    expect(() => validateMainePrimaryResultsReceipt(rehash(identity))).toThrow("PACKAGE_INVARIANT_INVALID");
    const winner = structuredClone(stored()); (winner.contests[0] as unknown as { sourceWinnerStatus: string }).sourceWinnerStatus = "single_candidate_inferred";
    expect(() => validateMainePrimaryResultsReceipt(rehash(winner))).toThrow("PACKAGE_INVARIANT_INVALID");
    const rcv = structuredClone(stored()); (rcv.contests[5]!.rankedChoice as unknown as { threshold: number }).threshold = 34_239;
    expect(() => validateMainePrimaryResultsReceipt(rehash(rcv))).toThrow("PACKAGE_INVARIANT_INVALID");
    const totals = structuredClone(stored()); (totals.contests[0] as unknown as { workbookCandidateVotes: number }).workbookCandidateVotes += 1;
    expect(() => validateMainePrimaryResultsReceipt(rehash(totals))).toThrow("PACKAGE_INVARIANT_INVALID");
    const linkage = structuredClone(stored()); (linkage.targetObservations[5] as unknown as { sourceCandidateAppearanceStatus: string }).sourceCandidateAppearanceStatus = "source_candidate_observed_identity_not_reviewed";
    expect(() => validateMainePrimaryResultsReceipt(rehash(linkage))).toThrow("PACKAGE_INVARIANT_INVALID");
    const authority = structuredClone(stored()); (authority.contests[0] as unknown as { resultAuthorityStatus: string }).resultAuthorityStatus = "certified_result";
    expect(() => validateMainePrimaryResultsReceipt(rehash(authority))).toThrow("PACKAGE_INVARIANT_INVALID");
    const publication = structuredClone(stored()); (publication as unknown as { publicationEligible: boolean }).publicationEligible = true;
    expect(() => validateMainePrimaryResultsReceipt(rehash(publication))).toThrow("PACKAGE_INVARIANT_INVALID");
    const reviewer = structuredClone(stored()); (reviewer.review as unknown as { reviewer: string | null }).reviewer = "fabricated";
    expect(() => validateMainePrimaryResultsReceipt(rehash(reviewer))).toThrow("PACKAGE_INVARIANT_INVALID");
    const decision = structuredClone(stored()); (decision.inheritedDecisionResolutions[0] as unknown as { resolution: string | null }).resolution = "approved";
    expect(() => validateMainePrimaryResultsReceipt(rehash(decision))).toThrow("PACKAGE_INVARIANT_INVALID");
    const sourcePayload = structuredClone(stored()); (sourcePayload.sources[0] as unknown as { parentIds: string[] }).parentIds = ["fabricated"];
    expect(() => validateMainePrimaryResultsReceipt(rehash(sourcePayload))).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("rebuilds the canonical checked-in artifact exactly", () => {
    expect(validateMainePrimaryResultsReceipt(buildMainePrimaryResultsReceipt(inputs(), proposal, lock))).toEqual(stored());
  });
});
