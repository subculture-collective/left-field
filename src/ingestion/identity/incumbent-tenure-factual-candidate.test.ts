import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDsaTargetIncumbentRoster, validateIncumbentTenureFactualCandidate } from "./incumbent-tenure-factual-candidate";

const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(path), "utf8"));
const hashFile = (path: string): string => createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
const rosterPath = "data/metadata/dsa-target-incumbent-roster-20260804-v1.json";
const candidatePath = "data/metadata/incumbent-tenure-factual-candidate-20260804-v1.json";
const sourcePath = "data/source/identity/congress-legislators-current-20260804.json";
const roster = readJson(rosterPath);
const candidate = readJson(candidatePath);
const lock = readJson("data/source-lock.json") as { entries: { id: string; retainedPath: string | null; byteSize: number; sha256: string; kind: string; parentIds: string[] }[] };
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));

describe("incumbent tenure factual candidate", () => {
  it("validates the exact production-derived roster and 212-seat candidate", () => {
    const parsedRoster = validateDsaTargetIncumbentRoster(roster);
    const parsed = validateIncumbentTenureFactualCandidate(candidate);
    expect(parsedRoster.rows).toHaveLength(212);
    expect(parsed.summary).toEqual({ seats: 212, sourceHouseTerms: 1251, values: 212, missing: 0, materiallyInterruptedCareers: 9, districtChangedCareers: 50, priorDelegateCareers: 0, decisions: 1 });
    expect(parsed.facts.every((fact) => fact.selectedEvaluatorValue.status === "derived_candidate" && fact.selectedEvaluatorValue.value === fact.cumulativeHouseServiceYears)).toBe(true);
    expect(parsed.facts.every((fact) => fact.sourceTerms.every((term) => !["AS", "DC", "GU", "MP", "PR", "VI"].includes(term.stateCode)))).toBe(true);
    expect(parsed.decision).toMatchObject({ defaultReversibleAssumption: "use_in_reviewer_only_evaluation_exclude_from_publication", blocksPublication: true, blocksOtherWork: false, resolution: null });
  });

  it("excludes time out of office for every materially interrupted career", () => {
    const parsed = validateIncumbentTenureFactualCandidate(candidate);
    const interrupted = parsed.facts.filter((fact) => fact.materialServiceBreaks.length > 0);
    expect(new Set(interrupted.map((fact) => fact.seatCycleId))).toEqual(new Set([
      "seat_house_ca_31_current", "seat_house_hi_01_current", "seat_house_il_10_current", "seat_house_il_11_current", "seat_house_la_06_current",
      "seat_house_md_07_current", "seat_house_nv_01_current", "seat_house_nv_04_current", "seat_house_ny_03_current",
    ]));
    expect(interrupted.every((fact) => fact.cumulativeHouseServiceYears < fact.elapsedYearsSinceFirstHouseService)).toBe(true);
    const cleoFields = parsed.facts.find((fact) => fact.bioguideId === "F000110")!;
    expect(cleoFields.materialServiceBreaks.map((gap) => gap.days)).toEqual([10227]);
    expect(cleoFields.cumulativeHouseServiceYears).toBe(5.577117);
    expect(cleoFields.elapsedYearsSinceFirstHouseService).toBe(33.580429);
  });

  it("binds the retained source, roster, candidate bytes, and parent closure", () => {
    const source = byId.get("congress-legislators-current-20260804")!;
    const rosterEntry = byId.get("dsa-target-incumbent-roster-20260804-v1")!;
    const candidateEntry = byId.get("incumbent-tenure-factual-candidate-20260804-v1")!;
    expect(source).toMatchObject({ retainedPath: sourcePath, sha256: hashFile(sourcePath), kind: "source" });
    expect(rosterEntry).toMatchObject({ retainedPath: rosterPath, sha256: hashFile(rosterPath), kind: "production_projection_receipt" });
    expect(new Set(rosterEntry.parentIds)).toEqual(new Set(["congress-legislators-current-20260804", "dsa-target-factual-projection-20260804-v1"]));
    expect(candidateEntry).toMatchObject({ retainedPath: candidatePath, sha256: hashFile(candidatePath), byteSize: readFileSync(resolve(candidatePath)).byteLength, kind: "review_proposal" });
    expect(new Set(candidateEntry.parentIds)).toEqual(new Set(["congress-legislators-current-20260804", "dsa-target-incumbent-roster-20260804-v1"]));
  });

  it("rejects mutation and publication", () => {
    expect(() => validateIncumbentTenureFactualCandidate({ ...(candidate as object), publicationEligible: true })).toThrow();
    expect(() => validateIncumbentTenureFactualCandidate({ ...(candidate as object), sourceCutoff: "2026-08-05" })).toThrow();
    const parsed = candidate as { facts: unknown[] };
    expect(() => validateIncumbentTenureFactualCandidate({ ...(candidate as object), facts: parsed.facts.slice(1) })).toThrow();
  });
});
