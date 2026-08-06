// @vitest-environment node

import { strToU8, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildOhioPrimaryResultsReceipt,
  parseOhioSummaryWorkbook,
  validateOhioPrimaryResultsReceipt,
  type OhioPrimaryResultsReceipt,
} from "./ohio-house-democratic-primary-results-receipt";
import type { NewYorkSourceEntry } from "./new-york-house-democratic-primary-reported-results-receipt";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const xml = (value: string) => strToU8(value);

function workbook(options: { writeIn?: boolean; totalDrift?: boolean; missingDistrict?: boolean } = {}): Buffer {
  const districts = Array.from({ length: options.missingDistrict ? 14 : 15 }, (_, index) => index + 1);
  const shared = ["County Name", "Region Name", "Media Market", "Registered Voters", "Ballots Counted", "Official Voter Turnout", "Total", "Percentage", "Adams", "Franklin"];
  const candidateHeaders: string[] = [];
  const officeHeaders: string[] = [];
  for (const district of districts) {
    officeHeaders.push(`U.S. Representative - District ${district}`);
    candidateHeaders.push(district === 1 && options.writeIn ? "Jane Public (WI)* (D)" : `Candidate ${district} (D)`);
  }
  shared.push(...officeHeaders, ...candidateHeaders);
  const index = (value: string) => shared.indexOf(value);
  const cell = (reference: string, value: string | number, type = typeof value === "number" ? "n" : "s") =>
    `<c r="${reference}" t="${type}"><v>${type === "s" ? index(String(value)) : value}</v></c>`;
  const column = (value: number) => {
    let name = "", current = value;
    while (current > 0) { current--; name = String.fromCharCode(65 + current % 26) + name; current = Math.floor(current / 26); }
    return name;
  };
  const metadata = ["County Name", "Region Name", "Media Market", "Registered Voters", "Ballots Counted", "Official Voter Turnout"];
  const row1 = districts.map((district, offset) => cell(`${column(offset + 7)}1`, `U.S. Representative - District ${district}`)).join("");
  const row2 = metadata.map((header, offset) => cell(`${column(offset + 1)}2`, header)).join("")
    + districts.map((district, offset) => cell(`${column(offset + 7)}2`, district === 1 && options.writeIn ? "Jane Public (WI)* (D)" : `Candidate ${district} (D)`)).join("");
  const total = districts.map((district, offset) => cell(`${column(offset + 7)}3`, district === 1 && options.totalDrift ? 1000 : district * 100)).join("");
  const percentages = districts.map((_, offset) => cell(`${column(offset + 7)}4`, 1)).join("");
  const countyA = districts.map((district, offset) => cell(`${column(offset + 7)}5`, district * 40)).join("");
  const countyB = districts.map((district, offset) => cell(`${column(offset + 7)}6`, district * 60)).join("");
  const merges = districts.map((_, offset) => { const name = column(offset + 7); return `<mergeCell ref="${name}1:${name}1"/>`; }).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="F1" s="1"/>${row1}</row><row r="2">${row2}</row><row r="3">${cell("A3", "Total")}${total}</row><row r="4">${cell("A4", "Percentage")}${percentages}</row><row r="5">${cell("A5", "Adams")}${countyA}</row><row r="6">${cell("A6", "Franklin")}${countyB}</row></sheetData><mergeCells count="${districts.length}">${merges}</mergeCells></worksheet>`;
  const strings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`;
  const book = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Master" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return Buffer.from(zipSync({
    "xl/workbook.xml": xml(book),
    "xl/_rels/workbook.xml.rels": xml(rels),
    "xl/sharedStrings.xml": xml(strings),
    "xl/worksheets/sheet1.xml": xml(sheet),
  }));
}

describe("Ohio Democratic statewide summary workbook", () => {
  it("parses all 15 district blocks and reconciles county rows to statewide totals", () => {
    const result = parseOhioSummaryWorkbook(workbook());
    expect(result.sheetName).toBe("Master");
    expect(result.districts).toHaveLength(15);
    expect(result.districts[0]).toEqual({
      districtCode: "01",
      candidates: [{ sourceCandidateName: "Candidate 1", candidacyKind: "named_candidate", votes: 100 }],
      countyRows: [{ county: "Adams", votes: [40] }, { county: "Franklin", votes: [60] }],
      sourceTotalVotes: 100,
    });
    expect(result.districts[14]?.sourceTotalVotes).toBe(1500);
  });

  it("retains a named write-in without inferring a winner", () => {
    expect(parseOhioSummaryWorkbook(workbook({ writeIn: true })).districts[0]?.candidates[0]).toEqual({
      sourceCandidateName: "Jane Public",
      candidacyKind: "named_write_in",
      votes: 100,
    });
  });

  it("fails closed on incomplete statewide House coverage or vote drift", () => {
    expect(() => parseOhioSummaryWorkbook(workbook({ missingDistrict: true }))).toThrow("DISTRICT_SET_INVALID");
    expect(() => parseOhioSummaryWorkbook(workbook({ totalDrift: true }))).toThrow("VOTE_RECONCILIATION_INVALID");
  });
});

const sourceIds = new Set([
  "oh-election-results-files-index-20260806",
  "oh-2022-may-primary-portal-manifest-extract",
  "oh-2022-may-primary-democratic-summary",
  "oh-2024-march-primary-democratic-summary",
  "oh-2026-may-primary-democratic-summary",
]);
const lock = JSON.parse(readFileSync(resolve("data/source-lock.json"), "utf8")) as { entries: NewYorkSourceEntry[] };
const inputs = () => lock.entries.filter((entry) => sourceIds.has(entry.id)).map((entry) => ({ entry, bytes: readFileSync(resolve(entry.retainedPath)) }));
const parent = () => {
  const bytes = readFileSync(resolve("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"));
  return { value: JSON.parse(bytes.toString("utf8")), bytes };
};
const stored = () => JSON.parse(readFileSync(resolve("data/metadata/ohio-house-democratic-primary-results-2022-2026-v1.json"), "utf8")) as OhioPrimaryResultsReceipt;
const digest = (domain: string, value: unknown) => createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

describe("Ohio Democratic House primary official-result receipt", () => {
  it("retains complete 2024/2026 statewide validation and emits only ten target observations", () => {
    const receipt = buildOhioPrimaryResultsReceipt(inputs(), parent());
    expect(receipt.summary).toEqual(expect.objectContaining({
      cyclesWithHouseResults: 2,
      statewideContestsValidated: 30,
      statewideCandidatesValidated: 71,
      statewideVotesValidated: 1_238_127,
      targetObservations: 10,
      targetCandidates: 14,
      targetVotes: 540_587,
      namedWriteInCandidates: 1,
      evaluatorNumericValues: 0,
      scoreEligibleContests: 0,
    }));
    expect(receipt.contests.map((contest) => contest.contestId)).toEqual(
      [2024, 2026].flatMap((year) => ["01", "03", "09", "11", "13"].map((district) => `oh:${year}:regular:us-house:${district}:democratic`)),
    );
  });

  it("records the complete 2022 portal gap without substituting August or inventing a disposition", () => {
    const receipt = stored();
    expect(receipt.cycles[0]).toEqual(expect.objectContaining({
      cycleYear: 2022,
      electionDate: "2022-05-03",
      resultStatus: "official_portal_inventory_has_no_us_house_result_file",
      manifestFileGroups: 6,
      manifestFiles: 20,
      targetObservations: 0,
    }));
    expect(receipt.contests.some((contest) => (contest.cycleYear as number) === 2022)).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain("2022-08-02");
  });

  it("retains source names and write-ins without inferring winners or lifecycle promotion", () => {
    const receipt = stored(), writeIns = receipt.contests.flatMap((contest) => contest.candidates).filter((candidate) => candidate.candidacyKind === "named_write_in");
    expect(writeIns).toEqual([]);
    expect(receipt.cycles.find((cycle) => cycle.cycleYear === 2026)?.statewideNamedWriteInCandidates).toBe(1);
    expect(receipt.contests.every((contest) => contest.sourceWinnerStatus === "not_marked_by_source" && contest.winnerSourceCandidateName === null)).toBe(true);
    expect(receipt.contests.every((contest) => contest.currentIdentityStatus === "not_reviewed" && contest.geographyStatus === "not_reviewed" && contest.selectionStatus === "unselected" && !contest.scoreEligible && Object.values(contest.evaluatorValues).every((value) => value === null))).toBe(true);
    expect(receipt).toEqual(expect.objectContaining({ reviewerOnly: true, publicationEligible: false, review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null } }));
  });

  it("rejects source drift and fully rehashed lifecycle tampering", () => {
    const source = inputs(), changed = Buffer.from(source[0]!.bytes); changed[20] = changed[20]! ^ 1;
    expect(() => buildOhioPrimaryResultsReceipt([{ ...source[0]!, bytes: changed }, ...source.slice(1)], parent())).toThrow("SOURCE_RECEIPT_INVALID");
    const receipt = structuredClone(stored()), contest = receipt.contests[0]!; (contest as unknown as { scoreEligible: boolean }).scoreEligible = true;
    const unsignedContest = { ...contest } as Record<string, unknown>; delete unsignedContest.contestSha256;
    (contest as unknown as { contestSha256: string }).contestSha256 = digest("dsa-seats:oh-house-democratic-primary-result:v1\0", unsignedContest);
    (receipt.summary as unknown as { contestSetSha256: string }).contestSetSha256 = digest("dsa-seats:oh-house-democratic-primary-result-set:v1\0", receipt.contests.map(({ contestId, contestSha256 }) => ({ contestId, contestSha256 })));
    const unsignedReceipt = { ...receipt } as Record<string, unknown>; delete unsignedReceipt.packageSha256;
    (receipt as unknown as { packageSha256: string }).packageSha256 = digest("dsa-seats:oh-house-democratic-primary-result-package:v1\0", unsignedReceipt);
    expect(() => validateOhioPrimaryResultsReceipt(receipt)).toThrow("SEMANTIC_INVARIANT_INVALID");
  });

  it("matches the canonical checked-in artifact", () => {
    expect(buildOhioPrimaryResultsReceipt(inputs(), parent())).toEqual(stored());
  });
});
