import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildNjPaPrimaryGeographyCompatibilityCandidateV2, validateNjPaPrimaryGeographyCompatibilityCandidateV2 } from "./nj-pa-primary-geography-compatibility-candidate-v2";

const input = () => {
  const base = "data/source/elections/primary-results/geography/new-jersey/2026";
  return {
    geographyV1Json: readFileSync("data/metadata/nj-pa-primary-geography-compatibility-candidate-v1.json", "utf8"),
    authorityReceiptJson: readFileSync("data/metadata/new-jersey-2026-congressional-plan-authority-receipt-v1.json", "utf8"),
    publicationsBytes: readFileSync(`${base}/division-of-elections-publications.html`),
    mapBytes: readFileSync(`${base}/2022-2031-congressional-map.pdf`),
    mapTextBytes: readFileSync(`${base}/2022-2031-congressional-map.txt`),
    statuteBytes: readFileSync(`${base}/njsa-19-46-12.html`),
    componentsBytes: readFileSync(`${base}/njcd-2022-plan-components-report.pdf`),
    componentsTextBytes: readFileSync(`${base}/njcd-2022-plan-components-report.txt`),
    currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt"),
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  };
};

describe("NJ/PA primary geography compatibility candidate v2", () => {
  it("replaces only nine New Jersey 2026 pending rows with explicit state-plan continuity candidates", () => {
    const value = buildNjPaPrimaryGeographyCompatibilityCandidateV2(input());
    expect(value.summary).toEqual({ seatCycleObservations: 41, inheritedCandidates: 32, nj2026StatePlanContinuityCandidates: 9, compatibilityCandidates: 41, automaticallyApprovedRows: 0, scoreEligibleRows: 0 });
    const current = value.rows.filter((row) => row.cycleYear === 2026);
    expect(current.map((row) => row.districtCode)).toEqual(["01", "03", "05", "06", "08", "09", "10", "11", "12"]);
    expect(current.every((row) => row.stateCode === "NJ" && row.historicalCongressSession === "120" && row.historicalGeoid === null && row.compatibilityCandidate && row.planContinuityEvidence !== null)).toBe(true);
    expect(value.rows.every((row) => !row.compatibilityApproved && !row.identityApproved && !row.scoreEligible)).toBe(true);
    expect(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)).toEqual(readFileSync("data/metadata/nj-pa-primary-geography-compatibility-candidate-v2.json"));
  });

  it("rejects parent bytes, retained-source drift, parent lineage drift, and output-lock drift", () => {
    const geography = input(); geography.geographyV1Json += " "; expect(() => buildNjPaPrimaryGeographyCompatibilityCandidateV2(geography)).toThrow("NJ_PA_PRIMARY_GEOGRAPHY_V2_INVALID:input_bytes");
    const receipt = input(); receipt.authorityReceiptJson += " "; expect(() => buildNjPaPrimaryGeographyCompatibilityCandidateV2(receipt)).toThrow("NJ_PA_PRIMARY_GEOGRAPHY_V2_INVALID:input_bytes");
    const statute = input(); statute.statuteBytes = Buffer.concat([statute.statuteBytes, Buffer.from(" ")]); expect(() => buildNjPaPrimaryGeographyCompatibilityCandidateV2(statute)).toThrow();
    const parentLock = input(); parentLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "new-jersey-2026-congressional-plan-authority-receipt-v1").parentIds = []; expect(() => buildNjPaPrimaryGeographyCompatibilityCandidateV2(parentLock)).toThrow();
    const outputLock = input(); outputLock.sourceLock.entries.find((entry: { id: string }) => entry.id === "nj-pa-primary-geography-compatibility-candidate-v2").parentIds = []; expect(() => buildNjPaPrimaryGeographyCompatibilityCandidateV2(outputLock)).toThrow("NJ_PA_PRIMARY_GEOGRAPHY_V2_INVALID");
  });

  it("rejects CD120 GEOID invention, component-report use, approvals, scoring, publication, fabricated review, decision closure, and unknown fields", () => {
    const currentInput = input();
    const base = buildNjPaPrimaryGeographyCompatibilityCandidateV2(currentInput);
    type Mutable = { rows: Array<Record<string, unknown>>; methodology: Record<string, unknown>; review: Record<string, unknown>; decisionSupport: Record<string, unknown>; publicationEligible: boolean; [key: string]: unknown };
    const mutations: Array<(value: Mutable) => void> = [
      (value) => { const row = value.rows.find((candidate) => candidate.cycleYear === 2026)!; row.historicalGeoid = row.targetCd119Geoid; },
      (value) => { value.methodology.componentsReportUsedAsMembershipEvidence = true; },
      (value) => { value.rows[0]!.compatibilityApproved = true; },
      (value) => { value.rows[0]!.identityApproved = true; },
      (value) => { value.rows[0]!.scoreEligible = true; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.review.reviewer = "fabricated"; },
      (value) => { value.decisionSupport.reviewerResolution = "approved"; },
      (value) => { value.unexpected = true; },
      (value) => { value.rows[0]!.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base) as unknown as Mutable;
      mutate(value);
      expect(() => validateNjPaPrimaryGeographyCompatibilityCandidateV2(value as never, currentInput)).toThrow("NJ_PA_PRIMARY_GEOGRAPHY_V2_INVALID:semantic_or_hash_drift");
    }
  });
});
