import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndianaLocalOfficeResults, validateIndianaLocalOfficeResults } from "./indiana-local-office-results";
describe("Indiana local office primary catalog", () => {
  it("closes all twelve official local categories", () => { const value = buildIndianaLocalOfficeResults(); expect(value.summary).toEqual({ officeCategories: 12, officeRows: 682, partyContests: 816, candidateRows: 1520, candidateVotes: 4232706, sourceMarkedWinnerCandidates: 1049, formulaEligibleContests: 0 }); expect(new Set(value.contests.map((row) => row.officeFamily)).size).toBe(12); expect(value.contests.every((row) => !row.formulaEligible && row.currentHolderIdentity === null)).toBe(true); });
  it("reproduces and rejects score promotion", () => { const stored = JSON.parse(readFileSync("data/metadata/rapid-indiana-local-office-primary-results-v1.json", "utf8")); expect(validateIndianaLocalOfficeResults(stored)).toEqual(buildIndianaLocalOfficeResults()); const changed = structuredClone(stored); changed.contests[0].formulaEligible = true; expect(() => validateIndianaLocalOfficeResults(changed)).toThrow("INDIANA_LOCAL_OFFICE_RESULTS_INVALID"); });
});
