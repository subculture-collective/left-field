import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNewYork2022BlockAssignmentReceipt, validateNewYork2022BlockAssignmentReceipt } from "./new-york-2022-congressional-block-assignment-receipt";

const input = () => ({ authorityBytes: readFileSync("data/source/elections/primary-results/geography/new-york/2022/latfor-2022-congressional-maps.html"), assignmentBytes: readFileSync("data/source/elections/primary-results/geography/new-york/2022/court-ordered-congressional-block-assignment.dbf"), cd118Bytes: readFileSync("data/source/elections/primary-results/geography/new-york/historical/36_NY_CD118.txt"), sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")) });
describe("New York 2022 congressional block assignment receipt", () => {
  it("retains the exact 288,819-block, 26-district official inventory without continuity claims", () => {
    const value = buildNewYork2022BlockAssignmentReceipt(input());
    expect(value.summary).toEqual({ assignmentRecords: 288819, uniqueBlockGeoids: 288819, districts: 26, duplicateBlockGeoids: 0, malformedBlockGeoids: 0, censusCd118Records: 288819, censusCd118AssignmentDifferences: 0, continuityConclusions: 0, electionConclusions: 0, approvedRows: 0, scoreEligibleRows: 0 });
    expect(value.districts).toHaveLength(26); expect(value.districts[0]).toMatchObject({ districtCode: "01", blockCount: 12915 }); expect(value.districts[25]).toMatchObject({ districtCode: "26", blockCount: 10233 });
    expect(value.districts.every((row) => row.blockCountMeaning === "2020_census_tabulation_blocks_not_population_voters_or_electoral_weight")).toBe(true);
    expect(value.authority).toMatchObject({ reuseLicenseAssessed: false, publicationPermissionAssessed: false });
    expect(value.limitations).toContain("No explicit reuse license was identified on the retained LATFOR page; public availability and governmental provenance are not treated as publication permission or an affirmative license grant.");
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/new-york-2022-congressional-block-assignment-receipt-v1.json"));
  });
  it("rejects assignment bytes, authority claims, and source-lock substitutions", () => {
    const changedDbf = input(); changedDbf.assignmentBytes = Buffer.from(changedDbf.assignmentBytes); changedDbf.assignmentBytes[100] ^= 1; expect(() => buildNewYork2022BlockAssignmentReceipt(changedDbf)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID");
    const changedPage = input(); changedPage.authorityBytes = Buffer.from("substituted"); expect(() => buildNewYork2022BlockAssignmentReceipt(changedPage)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID");
    const changedCd118 = input(); changedCd118.cd118Bytes = Buffer.concat([changedCd118.cd118Bytes, Buffer.from(" ")]); expect(() => buildNewYork2022BlockAssignmentReceipt(changedCd118)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID");
    const changedLock = input(); changedLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "ny-2022-court-ordered-congressional-block-assignment").parentIds = []; expect(() => buildNewYork2022BlockAssignmentReceipt(changedLock)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID");
    const outputDrift = input(); outputDrift.sourceLock.entries.find((entry: { id: string }) => entry.id === "new-york-2022-congressional-block-assignment-receipt-v1").parentIds = []; expect(() => buildNewYork2022BlockAssignmentReceipt(outputDrift)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID");
  });
  it("rejects semantic or lifecycle escalation", () => {
    const currentInput = input(), value = structuredClone(buildNewYork2022BlockAssignmentReceipt(currentInput)) as Record<string, unknown>; value.publicationEligible = true; expect(() => validateNewYork2022BlockAssignmentReceipt(value as never, currentInput)).toThrow("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_INVALID:semantic_or_hash_drift");
  });
});
