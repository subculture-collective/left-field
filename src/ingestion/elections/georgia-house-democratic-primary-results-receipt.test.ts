import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import { buildGeorgiaPrimaryResultsReceipt, validateGeorgiaPrimaryResultsReceipt, type GeorgiaPrimaryResultsReceipt } from "./georgia-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";

const sourceIds = new Set([
  "ga-2022-general-primary-election-metadata",
  "ga-2022-general-primary-total-votes-workbook",
  "ga-2024-general-primary-election-metadata",
  "ga-2024-general-primary-total-votes-workbook",
  "ga-2026-general-primary-election-metadata",
  "ga-2026-general-primary-total-votes-workbook",
]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => sourceIds.has(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const proposalBytes = readFileSync(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
const proposal = { value: JSON.parse(proposalBytes.toString("utf8")) as unknown, bytes: proposalBytes };
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json"), "utf8")) as GeorgiaPrimaryResultsReceipt;
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");
function rehash(value: GeorgiaPrimaryResultsReceipt): GeorgiaPrimaryResultsReceipt {
  for (const contest of value.contests) { const unsigned = { ...contest } as Record<string, unknown>; delete unsigned.contestSha256; (contest as unknown as { contestSha256: string }).contestSha256 = hash("dsa-seats:ga-house-democratic-primary-result:v1\0", unsigned); }
  for (const row of value.targetObservations) { const contest = value.contests.find((item) => item.contestId === row.contestId)!; (row as unknown as { contestSha256: string }).contestSha256 = contest.contestSha256; const unsigned = { ...row } as Record<string, unknown>; delete unsigned.observationSha256; (row as unknown as { observationSha256: string }).observationSha256 = hash("dsa-seats:ga-house-primary-target-observation:v1\0", unsigned); }
  (value.summary as unknown as { contestSetSha256: string }).contestSetSha256 = hash("dsa-seats:ga-house-democratic-primary-result-set:v1\0", value.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
  (value.summary as unknown as { targetObservationSetSha256: string }).targetObservationSetSha256 = hash("dsa-seats:ga-house-primary-target-observation-set:v1\0", value.targetObservations.map(({ observationId, observationSha256 }) => ({ observationId, observationSha256 })));
  const unsigned = { ...value } as Record<string, unknown>; delete unsigned.packageSha256; (value as unknown as { packageSha256: string }).packageSha256 = hash("dsa-seats:ga-house-democratic-primary-result-package:v1\0", unsigned); return value;
}

describe("Georgia Democratic House regular-primary corpus", () => {
  it("retains every statewide district contest and projects the twelve current-target observations without rewriting 2022 GA-07", () => {
    const receipt = validateGeorgiaPrimaryResultsReceipt(buildGeorgiaPrimaryResultsReceipt(inputs(), proposal, lock));
    expect(receipt.summary).toEqual(expect.objectContaining({
      contests: 42,
      candidates: 103,
      candidateVotes: 2_230_328,
      targetObservations: 12,
      targetContestCandidates: 22,
      targetContestVotes: 965_634,
    }));
    expect(receipt.contests.map((contest) => contest.contestId)).toEqual(
      [2022, 2024, 2026].flatMap((year) => Array.from({ length: 14 }, (_, index) => `ga:${year}:regular:us-house:${String(index + 1).padStart(2, "0")}:democratic`)),
    );
    expect(receipt.targetObservations.find((row) => row.targetSeatId === "seat_house_ga_06_current" && row.cycleYear === 2022)).toEqual(expect.objectContaining({
      sourceDistrictCode: "07",
      currentTargetDistrictCode: "06",
      sourceTotalVotes: 53_269,
      identityStatus: "not_reviewed",
      geographyStatus: "not_reviewed",
    }));
  });

  it("preserves the portal-official boundary without inventing certification, winners, nominees, or runoff advancement", () => {
    const receipt = validateGeorgiaPrimaryResultsReceipt(buildGeorgiaPrimaryResultsReceipt(inputs(), proposal, lock));
    expect(receipt.cycles.map((cycle) => [cycle.cycleYear, cycle.sourceOfficialResults, cycle.sourceProduction])).toEqual([
      [2022, true, true], [2024, true, true], [2026, true, true],
    ]);
    expect(receipt.contests.every((contest) =>
      contest.resultAuthorityStatus === "secretary_official_results_workbook_retained"
      && contest.certificationStatus === "official_results_flag_retained_no_separate_signed_certificate"
      && contest.sourceWinnerStatus === "not_marked_by_source"
      && contest.winnerSourceCandidateName === null
      && contest.nominationConclusion === null
      && contest.runoffAdvancementConclusion === null,
    )).toBe(true);
    expect(receipt.runoffScope).toBe("regular_primary_only_separate_runoff_elections_not_retained_or_assessed");
    expect(receipt.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null, resolution: null });
    expect(receipt.reviewerOnly).toBe(true);
    expect(receipt.publicationEligible).toBe(false);
  });

  it("fails closed when a retained source byte or official-result flag drifts", () => {
    const source = inputs(), changed = Buffer.from(source[1]!.bytes); changed[100] = changed[100]! ^ 1;
    expect(() => buildGeorgiaPrimaryResultsReceipt([source[0]!, { ...source[1]!, bytes: changed }, ...source.slice(2)], proposal, lock)).toThrow("SOURCE_RECEIPT_INVALID");
    const metadata = JSON.parse(Buffer.from(source[0]!.bytes).toString("utf8")) as Record<string, unknown>;
    metadata.isOfficialResults = false;
    const replacement = Buffer.from(JSON.stringify(metadata));
    expect(() => buildGeorgiaPrimaryResultsReceipt([{ ...source[0]!, bytes: replacement }, ...source.slice(1)], proposal, lock)).toThrow("SOURCE_RECEIPT_INVALID");
  });

  it("rejects source-lock topology drift and fully rehashed lifecycle or geography escalation", () => {
    const changedLock = structuredClone(lock), output = changedLock.entries.find((entry) => entry.id === "georgia-house-democratic-primary-results-2022-2026-v1")!;
    (output as unknown as { parentIds: string[] }).parentIds = [...output.parentIds].reverse();
    expect(() => buildGeorgiaPrimaryResultsReceipt(inputs(), proposal, changedLock)).toThrow("SOURCE_LOCK_MISMATCH");

    const score = structuredClone(stored()); (score.contests[0] as unknown as { scoreEligible: boolean }).scoreEligible = true;
    expect(() => validateGeorgiaPrimaryResultsReceipt(rehash(score))).toThrow("PACKAGE_INVARIANT_INVALID");
    const winner = structuredClone(stored()); (winner.contests[0] as unknown as { sourceWinnerStatus: string }).sourceWinnerStatus = "plurality_inferred"; (winner.contests[0] as unknown as { winnerSourceCandidateName: string | null }).winnerSourceCandidateName = winner.contests[0]!.candidates[0]!.sourceCandidateName;
    expect(() => validateGeorgiaPrimaryResultsReceipt(rehash(winner))).toThrow("PACKAGE_INVARIANT_INVALID");
    const geography = structuredClone(stored()), row = geography.targetObservations.find((item) => item.cycleYear === 2022 && item.currentTargetDistrictCode === "06")!; (row as unknown as { geographyStatus: string }).geographyStatus = "compatible"; (row as unknown as { geographyApproved: boolean }).geographyApproved = true;
    expect(() => validateGeorgiaPrimaryResultsReceipt(rehash(geography))).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("rebuilds the canonical checked-in artifact exactly", () => {
    expect(validateGeorgiaPrimaryResultsReceipt(buildGeorgiaPrimaryResultsReceipt(inputs(), proposal, lock))).toEqual(stored());
  });
});
