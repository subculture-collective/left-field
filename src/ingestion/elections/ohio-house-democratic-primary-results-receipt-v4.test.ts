// @vitest-environment node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildOhioPrimaryResultsReceiptV4,
  parseOhio2022CountyResultV4,
  validateOhioPrimaryResultsReceiptV4,
  type OhioPrimaryResultsReceiptV4,
} from "./ohio-house-democratic-primary-results-receipt-v4";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";

const fultonSource = () => readFileSync(
  resolve("data/source/elections/primary-results/ohio/2022/county-boe/fulton-official-summary.json"),
  "utf8",
);
const starkSource = () => execFileSync("pdftotext", [
  "-layout",
  resolve("data/source/elections/primary-results/ohio/2022/county-boe/stark-official-tabulation.pdf"),
  "-",
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const ids = new Set([
  "oh-2022-may-primary-fulton-results-index",
  "oh-2022-may-primary-fulton-official-wrapper",
  "oh-2022-may-primary-fulton-official-summary",
  "oh-2022-may-primary-stark-official-tabulation",
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
  const bytes = readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v3.json"));
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
};
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json"), "utf8")) as OhioPrimaryResultsReceiptV4;
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

describe("Ohio 2022 Fulton county-board result parsing", () => {
  it("extracts the exact official OH-09 candidate-vote segment", () => {
    expect(parseOhio2022CountyResultV4("oh-2022-may-primary-fulton-official-summary", fultonSource())).toEqual({
      county: "Fulton",
      districtCode: "09",
      candidates: [{ sourceCandidateName: "Marcy Kaptur", candidacyKind: "named_candidate", votes: 1_448 }],
      sourceTotalVotes: 1_448,
      precinctsReported: 29,
      precinctsTotal: 29,
      finalityCaveat: null,
    });
  });

  it("fails closed on contest, candidate, vote, or reporting drift", () => {
    const parsed = JSON.parse(fultonSource()) as Array<Record<string, unknown>>;
    const contest = parsed.find((row) => row.C === "For U.S. Representative (9th District) - DEM");
    expect(contest).toBeDefined();
    for (const [key, value] of [
      ["C", "For U.S. Representative (8th District) - DEM"],
      ["CH", ["Marcy Kapture"]],
      ["V", [1_449]],
      ["PR", 28],
    ] as const) {
      const changed = structuredClone(parsed);
      const changedContest = changed.find((row) => row.C === "For U.S. Representative (9th District) - DEM")!;
      changedContest[key] = value;
      expect(() => parseOhio2022CountyResultV4(
        "oh-2022-may-primary-fulton-official-summary",
        JSON.stringify(changed),
      )).toThrow("Ohio 2022 county results v4 rejected: SOURCE_SEMANTICS_INVALID");
    }
  });
});

describe("Ohio 2022 Stark county-board result parsing", () => {
  it("extracts the exact official OH-13 candidate-vote segment", () => {
    expect(parseOhio2022CountyResultV4("oh-2022-may-primary-stark-official-tabulation", starkSource())).toEqual({
      county: "Stark",
      districtCode: "13",
      candidates: [{ sourceCandidateName: "Emilia Sykes", candidacyKind: "named_candidate", votes: 9_664 }],
      sourceTotalVotes: 9_664,
      precinctsReported: 184,
      precinctsTotal: 184,
      finalityCaveat: null,
    });
  });

  it("fails closed on event, finality, candidate, vote, or reporting drift", () => {
    for (const [from, to] of [
      ["May 03, 2022", "August 02, 2022"],
      ["Official Tabulation Results", "Unofficial Tabulation Results"],
      ["Emilia Sykes", "Emilia Sykess"],
      ["9,664", "9,665"],
      ["184 of 184", "183 of 184"],
    ]) {
      expect(() => parseOhio2022CountyResultV4(
        "oh-2022-may-primary-stark-official-tabulation",
        starkSource().split(from!).join(to!),
      )).toThrow("Ohio 2022 county results v4 rejected: SOURCE_SEMANTICS_INVALID");
    }
    const decoyFinality = `${starkSource().split("Official Tabulation Results").join("Unofficial Tabulation Results")}\nOfficial Tabulation Results\n`;
    expect(() => parseOhio2022CountyResultV4("oh-2022-may-primary-stark-official-tabulation", decoyFinality)).toThrow("SOURCE_SEMANTICS_INVALID");
    const adjacentConflict = starkSource().replace("Official Tabulation Results", "Official Tabulation Results\nUnofficial Tabulation Results");
    expect(() => parseOhio2022CountyResultV4("oh-2022-may-primary-stark-official-tabulation", adjacentConflict)).toThrow("SOURCE_SEMANTICS_INVALID");
    const wrongParty = starkSource().replace(
      /(Dem US Representative To Congress - 13th District \(Vote for 1\)\n)DEM/,
      "$1REP",
    );
    expect(() => parseOhio2022CountyResultV4("oh-2022-may-primary-stark-official-tabulation", wrongParty)).toThrow("SOURCE_SEMANTICS_INVALID");
  });
});

describe("Ohio Democratic House primary result receipt v4", () => {
  it("adds two county segments while preserving zero unsupported 2022 district totals", () => {
    const receipt = buildOhioPrimaryResultsReceiptV4(inputs(), parent());
    expect(receipt.summary).toEqual(expect.objectContaining({
      targetObservations: 10,
      targetCandidates: 14,
      targetVotes: 540_587,
      countySegmentsRequired2022: 15,
      countySegmentsRetained2022: 12,
      countySegmentsMissing2022: 3,
      countySegmentCandidates2022: 13,
      countySegmentVotes2022: 192_826,
      districtClosureClaims2022: 0,
      districtsPending2022: 5,
    }));
    expect(receipt.contests.some((contest) => (contest.cycleYear as number) === 2022)).toBe(false);
    expect(receipt.countyResultSegments2022).toHaveLength(12);
  });

  it("keeps the three exact remaining gaps and the inherited Williams conflict explicit", () => {
    const receipt = buildOhioPrimaryResultsReceiptV4(inputs(), parent());
    expect(receipt.countyCoverage2022.find(({ districtCode }) => districtCode === "09")?.missing).toEqual(["Defiance:full", "Lucas:full"]);
    expect(receipt.countyCoverage2022.find(({ districtCode }) => districtCode === "13")?.missing).toEqual(["Portage:partial"]);
    expect(receipt.countyResultSegments2022.find(({ county }) => county === "Williams")?.finalityCaveat).toBe("official_archive_and_report_label_conflict");
  });

  it("reproduces canonical bytes and rejects source, lifecycle, and package drift", () => {
    const receipt = buildOhioPrimaryResultsReceiptV4(inputs(), parent());
    expect(receipt).toEqual(stored());
    expect(validateOhioPrimaryResultsReceiptV4(stored())).toEqual(stored());
    const changed = Buffer.from(inputs()[0]!.bytes); changed[20] = changed[20]! ^ 1;
    expect(() => buildOhioPrimaryResultsReceiptV4([{ ...inputs()[0]!, bytes: changed }, ...inputs().slice(1)], parent())).toThrow("SOURCE_RECEIPT_INVALID");
    const lifecycle = structuredClone(stored());
    (lifecycle as unknown as { publicationEligible: boolean }).publicationEligible = true;
    expect(() => validateOhioPrimaryResultsReceiptV4(lifecycle)).toThrow("Ohio primary results v4 rejected");
    const rehashed = structuredClone(stored());
    (rehashed.countyResultSegments2022[10]!.candidates[0] as unknown as { sourceCandidateName: string }).sourceCandidateName = "Tampered Candidate";
    const unsigned = { ...rehashed } as Record<string, unknown>; delete unsigned.packageSha256;
    (rehashed as unknown as { packageSha256: string }).packageSha256 = digest("dsa-seats:oh-house-democratic-primary-result-package:v4\0", unsigned);
    expect(() => validateOhioPrimaryResultsReceiptV4(rehashed)).toThrow("PACKAGE_CANONICAL_HASH_INVALID");
  });
});

describe("Ohio v4 source importer", () => {
  it("validates the complete four-source unit before writing any retained path", () => {
    const root = mkdtempSync(resolve(tmpdir(), "ohio-v4-import-test-"));
    try {
      const input = resolve(root, "input"), work = resolve(root, "work");
      mkdirSync(input); mkdirSync(work);
      for (const [inputName, retainedName] of [
        ["fulton-results-index.html", "fulton-results-index.html"],
        ["fulton-2022-may03-official-results.html", "fulton-official-results-wrapper.html"],
        ["fulton-summary.json", "fulton-official-summary.json"],
      ]) symlinkSync(resolve("data/source/elections/primary-results/ohio/2022/county-boe", retainedName!), resolve(input, inputName!));
      writeFileSync(resolve(input, "stark-pri22.pdf"), Buffer.alloc(416_122));
      const run = spawnSync("node", [resolve("scripts/import-oh-2022-county-primary-results-v4.mjs")], {
        cwd: work,
        env: { ...process.env, OH_2022_COUNTY_PRIMARY_V4_IMPORT_DIR: input },
        encoding: "utf8",
      });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("OH_2022_COUNTY_PRIMARY_V4_SOURCE_DRIFT:stark-pri22.pdf");
      expect(existsSync(resolve(work, "data"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
