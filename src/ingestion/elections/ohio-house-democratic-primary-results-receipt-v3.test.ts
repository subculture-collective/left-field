// @vitest-environment node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildOhioPrimaryResultsReceiptV3,
  parseOhio2022CountyResultV3,
  validateOhioPrimaryResultsReceiptV3,
  type OhioPrimaryResultsReceiptV3,
} from "./ohio-house-democratic-primary-results-receipt-v3";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const ids = new Set([
  "oh-2022-may-primary-warren-official-results",
  "oh-2022-may-primary-erie-official-canvass",
  "oh-2022-may-primary-ottawa-amended-official-summary",
  "oh-2022-may-primary-sandusky-official-canvass",
  "oh-2022-may-primary-williams-official-cumulative",
]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => ids.has(entry.id)).map((entry) => {
  const bytes = readFileSync(resolve(entry.retainedPath));
  const text = entry.retainedPath.endsWith(".pdf")
    ? execFileSync("pdftotext", ["-layout", entry.retainedPath, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
    : bytes.toString("utf8");
  return { entry, bytes, text };
});
const parent = () => {
  const bytes = readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v2.json"));
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
};
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v3.json"), "utf8")) as OhioPrimaryResultsReceiptV3;
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

describe("Ohio 2022 additional county-board result parsing", () => {
  it("extracts five exact whole-county candidate-vote segments", () => {
    expect(inputs().map(({ entry, text }) => parseOhio2022CountyResultV3(entry.id, text))).toEqual([
      { county: "Warren", districtCode: "01", candidates: [{ sourceCandidateName: "Greg Landsman", candidacyKind: "named_candidate", votes: 4_867 }], sourceTotalVotes: 4_867, precinctsReported: 175, precinctsTotal: 175, finalityCaveat: null },
      { county: "Erie", districtCode: "09", candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 3_388 }], sourceTotalVotes: 3_388, precinctsReported: 62, precinctsTotal: 62, finalityCaveat: null },
      { county: "Ottawa", districtCode: "09", candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 2_138 }], sourceTotalVotes: 2_138, precinctsReported: 36, precinctsTotal: 36, finalityCaveat: null },
      { county: "Sandusky", districtCode: "09", candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 2_177 }], sourceTotalVotes: 2_177, precinctsReported: 58, precinctsTotal: 58, finalityCaveat: null },
      { county: "Williams", districtCode: "09", candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 756 }], sourceTotalVotes: 756, precinctsReported: 28, precinctsTotal: 28, finalityCaveat: "official_archive_and_report_label_conflict" },
    ]);
  });

  it("fails closed on event, finality, candidate, or vote drift", () => {
    const source = inputs()[2]!;
    for (const [from, to] of [["May 3, 2022", "August 2, 2022"], ["Amended Official Results", "Unofficial Results"], ["Marcy Kaptur", "Marcy Kapture"], ["2,138", "2,139"], ["36 of 36", "35 of 36"]]) {
      expect(() => parseOhio2022CountyResultV3(source.entry.id, source.text.split(from!).join(to!))).toThrow("Ohio 2022 county results v3 rejected");
    }
    const sandusky = inputs()[3]!;
    expect(() => parseOhio2022CountyResultV3(sandusky.entry.id, sandusky.text.split("58 of 58").join("57 of 58"))).toThrow("Ohio 2022 county results v3 rejected");
  });
});

describe("Ohio Democratic House primary result receipt v3", () => {
  it("adds five county segments while preserving zero unsupported 2022 district totals", () => {
    const receipt = buildOhioPrimaryResultsReceiptV3(inputs(), parent());
    expect(receipt.summary).toEqual(expect.objectContaining({
      targetObservations: 10,
      targetCandidates: 14,
      targetVotes: 540_587,
      countySegmentsRequired2022: 15,
      countySegmentsRetained2022: 10,
      countySegmentsMissing2022: 5,
      countySegmentCandidates2022: 11,
      countySegmentVotes2022: 181_714,
      districtClosureClaims2022: 0,
      districtsPending2022: 5,
    }));
    expect(receipt.contests.some((contest) => (contest.cycleYear as number) === 2022)).toBe(false);
    expect(receipt.countyResultSegments2022).toHaveLength(10);
  });

  it("keeps exact remaining gaps and the Williams finality conflict explicit", () => {
    const receipt = buildOhioPrimaryResultsReceiptV3(inputs(), parent());
    expect(receipt.countyCoverage2022.find(({ districtCode }) => districtCode === "01")?.missing).toEqual([]);
    expect(receipt.countyCoverage2022.find(({ districtCode }) => districtCode === "09")?.missing).toEqual(["Defiance:full", "Fulton:full", "Lucas:full"]);
    expect(receipt.countyResultSegments2022.find(({ county }) => county === "Williams")?.finalityCaveat).toBe("official_archive_and_report_label_conflict");
  });

  it("reproduces canonical bytes and rejects source, lifecycle, and package drift", () => {
    const receipt = buildOhioPrimaryResultsReceiptV3(inputs(), parent());
    expect(receipt).toEqual(stored());
    expect(validateOhioPrimaryResultsReceiptV3(stored())).toEqual(stored());
    const changed = Buffer.from(inputs()[0]!.bytes); changed[20] = changed[20]! ^ 1;
    expect(() => buildOhioPrimaryResultsReceiptV3([{ ...inputs()[0]!, bytes: changed }, ...inputs().slice(1)], parent())).toThrow("SOURCE_RECEIPT_INVALID");
    const lifecycle = structuredClone(stored());
    (lifecycle as unknown as { publicationEligible: boolean }).publicationEligible = true;
    expect(() => validateOhioPrimaryResultsReceiptV3(lifecycle)).toThrow("Ohio primary results v3 rejected");
    const rehashed = structuredClone(stored());
    (rehashed.countyResultSegments2022[5]!.candidates[0] as unknown as { sourceCandidateName: string }).sourceCandidateName = "Tampered Candidate";
    const unsigned = { ...rehashed } as Record<string, unknown>; delete unsigned.packageSha256;
    (rehashed as unknown as { packageSha256: string }).packageSha256 = digest("dsa-seats:oh-house-democratic-primary-result-package:v3\0", unsigned);
    expect(() => validateOhioPrimaryResultsReceiptV3(rehashed)).toThrow("PACKAGE_CANONICAL_HASH_INVALID");
  });
});
