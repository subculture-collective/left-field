import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildCaliforniaPrimaryIdentityGeographyReviewPackageV3, validateCaliforniaPrimaryIdentityGeographyReviewPackageV3 } from "./california-primary-identity-geography-review-package-v3";

const input = () => ({
  jointV2Json: readFileSync("data/metadata/california-primary-identity-geography-review-package-v2.json", "utf8"),
  policyDossierJson: readFileSync("data/metadata/california-split-crosswalk-policy-dossier-v1.json", "utf8"),
  jointV1Json: readFileSync("data/metadata/california-primary-identity-geography-review-package-v1.json", "utf8"),
  geographyV2Json: readFileSync("data/metadata/california-primary-geography-compatibility-candidate-v2.json", "utf8"),
  geographyV1Json: readFileSync("data/metadata/california-primary-geography-compatibility-candidate-v1.json", "utf8"),
  crosswalkJson: readFileSync("data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json", "utf8"),
  currentStatusBytes: readFileSync("data/source/elections/primary-results/geography/california/2026/california-redistricting-status.html"),
  voterGuideBytes: readFileSync("data/source/elections/primary-results/geography/california/2026/prop50-official-voter-guide.pdf"),
  sourcePageBytes: readFileSync("data/source/elections/primary-results/geography/california/2026/2025-congressional-districts.html"),
  planBlocksBytes: readFileSync("data/source/elections/primary-results/geography/california/2026/06_CA_CD120_AB604.txt"),
  currentBlocksBytes: readFileSync("data/source/elections/primary-results/geography/california/current/06_CA_CD119.txt"),
  sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
});

describe("California primary identity/geography review package v3", () => {
  it("attaches split-crosswalk policy evidence to 38 live records without resolving it", () => {
    const value = buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(input());
    expect(value.summary).toEqual({
      reviewRecords: 126,
      identityAndGeographyCandidates: 80,
      geographyCandidateIdentityUnresolved: 8,
      identityCandidateCrosswalkReviewRequired: 34,
      identityUnresolvedCrosswalkReviewRequired: 4,
      identityCandidates: 114,
      geographyCandidates: 88,
      splitPolicyEvidenceAttachedRecords: 38,
      splitPolicyRowsAssessed: 48,
      currentIncumbentJointPolicyRows: 38,
      statewideGeographyOnlyPolicyRows: 10,
      exactMembershipRelationshipsExcludedFromPolicy: 4,
      policyDecisions: 1,
      policyResolutions: 0,
      policyApprovals: 0,
      rowApprovals: 0,
      automaticApprovals: 0,
      jointApprovedRecords: 0,
      scoreEligibleRecords: 0,
      publicationEligibleRecords: 0,
    });
    const records = value.records as Array<Record<string, unknown>>;
    const attached = records.filter((record) => record.splitPolicyEvidence !== null);
    expect(attached.map((record) => record.districtCode)).toEqual(["02", "04", "06", "07", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19", "21", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "38", "39", "42", "44", "45", "46", "47", "49", "50", "51", "52"]);
    expect(records.filter((record) => record.cycleYear === 2026 && (record.geography as Record<string, unknown>).candidate === true).every((record) => record.splitPolicyEvidence === null)).toBe(true);
    expect(value.policyDecision).toMatchObject({ decisionId: "california-split-crosswalk-methodology-v1", inherited: true, createsIndependentDecision: false, resolution: { status: "proposed", decision: null, reviewer: null, reviewedAt: null, rationale: null } });
  }, 15_000);

  it("preserves every v2 record and rebuilds the persisted artifact exactly", () => {
    const source = input();
    const value = buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(source);
    const parent = JSON.parse(source.jointV2Json) as { records: Array<Record<string, unknown>> };
    const parentById = new Map(parent.records.map((record) => [record.reviewRecordId, record]));
    for (const record of value.records as Array<Record<string, unknown>>) {
      const parentRecord = parentById.get(record.reviewRecordId);
      expect(parentRecord).toBeDefined();
      const { rowSha256, ...parentFields } = parentRecord!;
      const parentV2ReviewRecordSha256 = record.parentV2ReviewRecordSha256;
      const v3Fields = { ...record };
      delete v3Fields.rowSha256;
      delete v3Fields.parentV2ReviewRecordSha256;
      delete v3Fields.splitPolicyEvidence;
      expect(parentV2ReviewRecordSha256).toBe(rowSha256);
      expect(v3Fields).toEqual(parentFields);
    }
    expect(`${JSON.stringify(value, null, 2)}\n`).toBe(readFileSync("data/metadata/california-primary-identity-geography-review-package-v3.json", "utf8"));
  }, 15_000);

  it("rejects parent-byte and exact source-lock topology drift", () => {
    const bytes = input(); bytes.policyDossierJson += " "; expect(() => buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(bytes)).toThrow(/parent_bytes/);
    const topology = input(); topology.sourceLock.entries.find((entry: { id: string }) => entry.id === "california-primary-identity-geography-review-package-v3").parentIds.reverse(); expect(() => buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(topology)).toThrow(/source_lock/);
  }, 15_000);

  it("rejects lifecycle, methodology, and policy escalation even when the supplied object is coherent", () => {
    type Mutable = { records: Array<Record<string, unknown>>; policyDecision: Record<string, unknown>; methodology: Record<string, unknown>; review: Record<string, unknown>; inheritedDecisionSupport: { resolutions: Record<string, unknown> }; publicationEligible: boolean; [key: string]: unknown };
    const source = input();
    const base = buildCaliforniaPrimaryIdentityGeographyReviewPackageV3(source);
    const mutations: Array<(value: Mutable) => void> = [
      (value) => { const evidence = value.records.find((record) => record.splitPolicyEvidence !== null)!.splitPolicyEvidence as Record<string, unknown>; evidence.compatibilityCandidate = true; },
      (value) => { const evidence = value.records.find((record) => record.splitPolicyEvidence !== null)!.splitPolicyEvidence as Record<string, unknown>; evidence.compatibilityApproved = true; },
      (value) => { (value.records[0]!.identity as Record<string, unknown>).approved = true; },
      (value) => { (value.records[0]!.geography as Record<string, unknown>).approved = true; },
      (value) => { value.records[0]!.jointApproved = true; },
      (value) => { value.records[0]!.scoreEligible = true; },
      (value) => { value.records[0]!.formulaApplicability = "applicable"; },
      (value) => { value.methodology.populationVoterTurnoutPartisanOrThresholdWeightingUsed = true; },
      (value) => { (value.policyDecision.resolution as Record<string, unknown>).decision = "approved"; },
      (value) => { (value.policyDecision.resolution as Record<string, unknown>).reviewer = "fabricated"; },
      (value) => { value.inheritedDecisionSupport.resolutions.geography = "approved"; },
      (value) => { value.publicationEligible = true; },
      (value) => { value.unexpectedEvaluatorScore = 1; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(base) as unknown as Mutable;
      mutate(changed);
      expect(() => validateCaliforniaPrimaryIdentityGeographyReviewPackageV3(changed as never, source)).toThrow(/semantic_or_hash_drift/);
    }
  }, 45_000);
});
