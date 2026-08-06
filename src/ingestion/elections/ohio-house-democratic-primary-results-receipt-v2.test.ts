// @vitest-environment node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildOhioPrimaryResultsReceiptV2,
  parseOhio2022CountyResult,
  validateOhioPrimaryResultsReceiptV2,
  type OhioPrimaryResultsReceiptV2,
} from "./ohio-house-democratic-primary-results-receipt-v2";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const ids = new Set([
  "oh-2022-may-primary-hamilton-official-cumulative",
  "oh-2022-may-primary-franklin-official-group-detail",
  "oh-2022-may-primary-wood-official-summary",
  "oh-2022-may-primary-cuyahoga-official-results-by-contest",
  "oh-2022-may-primary-summit-amended-official-summary",
]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => ids.has(entry.id)).map((entry) => {
  const bytes = readFileSync(resolve(entry.retainedPath));
  const text = entry.retainedPath.endsWith(".pdf")
    ? execFileSync("pdftotext", ["-layout", entry.retainedPath, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
    : bytes.toString("utf8").replace(/\0+$/u, "");
  return { entry, bytes, text };
});
const parent = () => {
  const bytes = readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v1.json"));
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
};
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v2.json"), "utf8")) as OhioPrimaryResultsReceiptV2;
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

describe("Ohio 2022 county-board official result parsing", () => {
  it("extracts only district-labelled Democratic county segments", () => {
    expect(inputs().map(({ entry, text }) => parseOhio2022CountyResult(entry.id, text))).toEqual([
      { county: "Hamilton", districtCode: "01", candidates: [{ sourceCandidateName: "Greg Landsman", candidacyKind: "named_candidate", votes: 23_463 }], sourceTotalVotes: 23_463, precinctsReported: 374, precinctsTotal: 374 },
      { county: "Franklin", districtCode: "03", candidates: [{ sourceCandidateName: "Joyce Beatty", candidacyKind: "named_candidate", votes: 48_241 }], sourceTotalVotes: 48_241, precinctsReported: 543, precinctsTotal: 543 },
      { county: "Wood", districtCode: "09", candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 2_547 }], sourceTotalVotes: 2_547, precinctsReported: 43, precinctsTotal: 43 },
      { county: "Cuyahoga", districtCode: "11", candidates: [{ sourceCandidateName: "Shontel Brown", candidacyKind: "named_candidate", votes: 44_841 }, { sourceCandidateName: "Nina Turner", candidacyKind: "named_candidate", votes: 22_830 }], sourceTotalVotes: 67_671, precinctsReported: null, precinctsTotal: null },
      { county: "Summit", districtCode: "13", candidates: [{ sourceCandidateName: "Emilia Sykes", candidacyKind: "named_candidate", votes: 26_466 }], sourceTotalVotes: 26_466, precinctsReported: 420, precinctsTotal: 420 },
    ]);
  });

  it("fails closed on event, party, district, finality, candidate, or vote drift", () => {
    const source = inputs()[3]!;
    for (const [from, to] of [["May 3, 2022", "August 2, 2022"], ["Official Results", "Unofficial Results"], ["DEM - UNITED STATES REP 11TH", "REP - UNITED STATES REP 11TH"], ["Shontel Brown", "Shontel Browne"], ["44,841", "44,842"]]) {
      expect(() => parseOhio2022CountyResult(source.entry.id, source.text.replace(from!, to!))).toThrow("Ohio 2022 county results rejected");
    }
  });
});

describe("Ohio Democratic House primary result receipt v2", () => {
  it("retains county-segment progress without emitting unsupported district totals", () => {
    const receipt = buildOhioPrimaryResultsReceiptV2(inputs(), parent());
    expect(receipt.summary).toEqual(expect.objectContaining({
      cyclesWithHouseResults: 2,
      targetObservations: 10,
      targetCandidates: 14,
      targetVotes: 540_587,
      countySegmentsRequired2022: 15,
      countySegmentsRetained2022: 5,
      countySegmentCandidates2022: 6,
      countySegmentVotes2022: 168_388,
      districtClosureClaims2022: 0,
      districtsPending2022: 5,
      evaluatorNumericValues: 0,
      scoreEligibleContests: 0,
    }));
    expect(receipt.contests.filter((contest) => (contest.cycleYear as number) === 2022)).toEqual([]);
    expect(receipt.countyResultSegments2022).toHaveLength(5);
  });

  it("retains the exact 15-segment county closure matrix and never zero-fills gaps", () => {
    const receipt = buildOhioPrimaryResultsReceiptV2(inputs(), parent());
    expect(receipt.countyCoverage2022.map(({ districtCode, required, retained, missing }) => ({ districtCode, required, retained, missing }))).toEqual([
      { districtCode: "01", required: ["Hamilton:partial", "Warren:full"], retained: ["Hamilton:partial"], missing: ["Warren:full"] },
      { districtCode: "03", required: ["Franklin:partial"], retained: ["Franklin:partial"], missing: [] },
      { districtCode: "09", required: ["Defiance:full", "Erie:full", "Fulton:full", "Lucas:full", "Ottawa:full", "Sandusky:full", "Williams:full", "Wood:partial"], retained: ["Wood:partial"], missing: ["Defiance:full", "Erie:full", "Fulton:full", "Lucas:full", "Ottawa:full", "Sandusky:full", "Williams:full"] },
      { districtCode: "11", required: ["Cuyahoga:partial"], retained: ["Cuyahoga:partial"], missing: [] },
      { districtCode: "13", required: ["Portage:partial", "Stark:partial", "Summit:full"], retained: ["Summit:full"], missing: ["Portage:partial", "Stark:partial"] },
    ]);
    expect(receipt.contests.some((contest) => (contest.cycleYear as number) === 2022 && ["01", "09", "13"].includes(contest.districtCode))).toBe(false);
  });

  it("preserves reviewer-only lifecycle and validates canonical bytes", () => {
    const receipt = buildOhioPrimaryResultsReceiptV2(inputs(), parent());
    expect(receipt).toEqual(stored());
    expect(receipt).toEqual(expect.objectContaining({ reviewerOnly: true, publicationEligible: false, review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null } }));
    expect(receipt.contests.every((contest) => !contest.scoreEligible && Object.values(contest.evaluatorValues).every((value) => value === null))).toBe(true);
    expect(validateOhioPrimaryResultsReceiptV2(stored())).toEqual(stored());
  });

  it("rejects source, semantic-extract, lifecycle, and fully rehashed factual tampering", () => {
    const source = inputs();
    const changed = Buffer.from(source[0]!.bytes); changed[20] = changed[20]! ^ 1;
    expect(() => buildOhioPrimaryResultsReceiptV2([{ ...source[0]!, bytes: changed }, ...source.slice(1)], parent())).toThrow("SOURCE_RECEIPT_INVALID");
    expect(() => buildOhioPrimaryResultsReceiptV2([{ ...source[0]!, text: source[0]!.text.replace("Greg Landsman", "Gregory Landsman") }, ...source.slice(1)], parent())).toThrow("SOURCE_TEXT_INVALID");
    const receipt = structuredClone(stored());
    (receipt.contests[0] as unknown as { scoreEligible: boolean }).scoreEligible = true;
    expect(() => validateOhioPrimaryResultsReceiptV2(receipt)).toThrow("Ohio primary results v2 rejected");

    const rehashed = structuredClone(stored());
    (rehashed.contests[0]!.candidates[0] as unknown as { sourceCandidateName: string }).sourceCandidateName = "Tampered Candidate";
    const unsigned = { ...rehashed } as Record<string, unknown>; delete unsigned.packageSha256;
    (rehashed as unknown as { packageSha256: string }).packageSha256 = digest("dsa-seats:oh-house-democratic-primary-result-package:v2\0", unsigned);
    expect(() => validateOhioPrimaryResultsReceiptV2(rehashed)).toThrow("PACKAGE_CANONICAL_HASH_INVALID");
  });
});
