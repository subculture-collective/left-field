import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNewJersey2026CongressionalPlanAuthorityReceipt, validateNewJersey2026CongressionalPlanAuthorityReceipt } from "./new-jersey-2026-congressional-plan-authority";

const input = () => ({
  publicationsBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/division-of-elections-publications.html"),
  mapBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/2022-2031-congressional-map.pdf"),
  mapTextBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/2022-2031-congressional-map.txt"),
  statuteBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/njsa-19-46-12.html"),
  componentsBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/njcd-2022-plan-components-report.pdf"),
  componentsTextBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/2026/njcd-2022-plan-components-report.txt"),
  currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});

describe("New Jersey 2026 congressional plan authority", () => {
  it("retains explicit 2022-2031 plan continuity and a complete twelve-district CD119 block inventory", () => {
    const value = buildNewJersey2026CongressionalPlanAuthorityReceipt(input());
    expect(value.authority).toMatchObject({ currentPlanLabel: "NJ Congressional Districts 2022-2031", adoptedOn: "2021-12-22", continuityStatute: "NJSA 19:46-12" });
    expect(value.blockInventory).toMatchObject({ stateFips: "34", districts: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] });
    expect(value.blockInventory.uniqueBlocks).toBeGreaterThan(100_000);
    expect(value.planComponentsAssessment).toMatchObject({ planName: "NJ_CONG_SUMBIT12222021", explicitBlocks: 11858, matchingCd119Assignments: 11694, mismatchedCd119Assignments: 164, useAsAdoptedMembershipEvidence: false });
    expect(value.lifecycle).toMatchObject({ geographyCandidateCreated: false, automaticallyApprovedRows: 0, scoreEligibleRows: 0, publicationEligible: false });
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/new-jersey-2026-congressional-plan-authority-receipt-v1.json"));
  });

  it("rejects byte drift, source-lineage drift, output-lock drift, false component use, publication, and unknown fields", () => {
    const bytes = input(); bytes.publicationsBytes = Buffer.concat([bytes.publicationsBytes, Buffer.from(" ")]); expect(() => buildNewJersey2026CongressionalPlanAuthorityReceipt(bytes)).toThrow("NEW_JERSEY_2026_PLAN_AUTHORITY_INVALID:input_bytes");
    const sourceLock = input(); sourceLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "nj-congressional-2022-plan-components-report").parentIds = []; expect(() => buildNewJersey2026CongressionalPlanAuthorityReceipt(sourceLock)).toThrow("NEW_JERSEY_2026_PLAN_AUTHORITY_INVALID");
    const outputLock = input(); outputLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "new-jersey-2026-congressional-plan-authority-receipt-v1").parentIds = []; expect(() => buildNewJersey2026CongressionalPlanAuthorityReceipt(outputLock)).toThrow("NEW_JERSEY_2026_PLAN_AUTHORITY_INVALID");
    const currentInput = input();
    const base = buildNewJersey2026CongressionalPlanAuthorityReceipt(currentInput);
    type Mutable = { planComponentsAssessment: Record<string, unknown>; lifecycle: Record<string, unknown>; [key: string]: unknown };
    const mutations: Array<(value: Mutable) => void> = [
      (value) => { value.planComponentsAssessment.useAsAdoptedMembershipEvidence = true; },
      (value) => { value.lifecycle.geographyCandidateCreated = true; },
      (value) => { value.lifecycle.publicationEligible = true; },
      (value) => { value.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base) as unknown as Mutable;
      mutate(value);
      expect(() => validateNewJersey2026CongressionalPlanAuthorityReceipt(value as never, currentInput)).toThrow("NEW_JERSEY_2026_PLAN_AUTHORITY_INVALID:semantic_or_hash_drift");
    }
  });
});
