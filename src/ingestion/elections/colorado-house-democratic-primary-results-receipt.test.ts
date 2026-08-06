import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildColoradoPrimaryResultsReceipt,
  validateColoradoPrimaryResultsReceipt,
  type ColoradoPrimaryResultsReceipt,
} from "./colorado-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";

const ids = new Set([
  "co-2022-primary-certification-announcement",
  "co-2022-primary-signed-statewide-abstract",
  "co-2022-democratic-us-house-official-abstract",
  "co-2024-biennial-certified-abstract",
  "co-2024-democratic-us-house-normalized-transcription",
  "co-2026-primary-signed-statewide-abstract",
  "co-2026-democratic-us-house-normalized-transcription",
]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => ids.has(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/colorado-house-democratic-primary-results-2022-2026-v1.json"), "utf8")) as ColoradoPrimaryResultsReceipt;
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

describe("Colorado Democratic House primary official abstract corpus", () => {
  it("retains every district, county segment, candidate, zero, and total across all three cycles", () => {
    const receipt = validateColoradoPrimaryResultsReceipt(buildColoradoPrimaryResultsReceipt(inputs()));
    expect(receipt.summary).toEqual(expect.objectContaining({
      contests: 24,
      contests2022: 8,
      contests2024: 8,
      contests2026: 8,
      countyRows: 249,
      zeroVoteCountyRows: 7,
      candidates: 39,
      namedWriteInCandidates: 2,
      candidateVotes: 1_800_710,
      evaluatorNumericValues: 0,
      scoreEligibleContests: 0,
    }));
    expect(receipt.contests.map((contest) => contest.contestId)).toEqual(
      [2022, 2024, 2026].flatMap((year) => Array.from({ length: 8 }, (_, index) => `co:${year}:us-house:${String(index + 1).padStart(2, "0")}:democratic`)),
    );
    expect(receipt.contests.every((contest) =>
      contest.countyRows.every((row) => row.votes.reduce((sum, votes) => sum + votes, 0) === row.sourceTotalVotes)
      && contest.candidates.every((candidate, index) => candidate.votes === contest.countyRows.reduce((sum, row) => sum + row.votes[index]!, 0))
      && contest.sourceTotalVotes === contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0),
    )).toBe(true);
  });

  it("records source-specific finality without inventing winner or lifecycle promotion", () => {
    const receipt = stored();
    expect(receipt.cycles).toEqual([
      expect.objectContaining({ cycleYear: 2022, resultAuthorityStatus: "official_secretary_abstract", certificationStatus: "certification_announcement_and_signed_statewide_abstract_retained" }),
      expect.objectContaining({ cycleYear: 2024, resultAuthorityStatus: "official_certified_biennial_abstract", certificationStatus: "certified_publication_no_separate_signed_certificate_retained" }),
      expect.objectContaining({ cycleYear: 2026, resultAuthorityStatus: "signed_secretary_statewide_abstract", certificationStatus: "signed_secretary_certificate_bound_to_abstract" }),
    ]);
    expect(receipt.contests.every((contest) => contest.sourceWinnerStatus === "not_marked_by_source" && contest.winnerSourceCandidateName === null)).toBe(true);
    expect(receipt.contests.every((contest) => contest.currentIdentityStatus === "not_reviewed" && contest.geographyStatus === "not_reviewed" && contest.selectionStatus === "unselected" && !contest.scoreEligible && Object.values(contest.evaluatorValues).every((value) => value === null))).toBe(true);
    expect(receipt.review).toEqual({ status: "proposed", reviewer: null, reviewedAt: null, resolution: null });
    expect(receipt.reviewerOnly).toBe(true);
    expect(receipt.publicationEligible).toBe(false);
  });

  it("rejects source drift and fully rehashed semantic tampering", () => {
    const source = inputs(), changed = Buffer.from(source[0]!.bytes); changed[100] = changed[100]! ^ 1;
    expect(() => buildColoradoPrimaryResultsReceipt([{ ...source[0]!, bytes: changed }, ...source.slice(1)])).toThrow("SOURCE_RECEIPT_INVALID");

    const receipt = structuredClone(stored()), contest = receipt.contests[0]!;
    (contest as unknown as { scoreEligible: boolean }).scoreEligible = true;
    const unsignedContest = { ...contest } as Record<string, unknown>; delete unsignedContest.contestSha256;
    (contest as unknown as { contestSha256: string }).contestSha256 = hash("dsa-seats:co-house-democratic-primary-result:v1\0", unsignedContest);
    (receipt.summary as unknown as { contestSetSha256: string }).contestSetSha256 = hash("dsa-seats:co-house-democratic-primary-result-set:v1\0", receipt.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
    const unsignedPackage = { ...receipt } as Record<string, unknown>; delete unsignedPackage.packageSha256;
    (receipt as unknown as { packageSha256: string }).packageSha256 = hash("dsa-seats:co-house-democratic-primary-result-package:v1\0", unsignedPackage);
    expect(() => validateColoradoPrimaryResultsReceipt(receipt)).toThrow("PACKAGE_INVARIANT_INVALID");
  });

  it("matches the canonical checked-in artifact", () => {
    expect(buildColoradoPrimaryResultsReceipt(inputs())).toEqual(stored());
  });
});
