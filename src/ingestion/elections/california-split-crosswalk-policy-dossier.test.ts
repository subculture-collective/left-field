/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted-artifact mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildCaliforniaSplitCrosswalkPolicyDossier,
  validateCaliforniaSplitCrosswalkPolicyDossier,
} from "./california-split-crosswalk-policy-dossier";

const artifactPath = "data/metadata/california-split-crosswalk-policy-dossier-v1.json";
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function input() {
  const crosswalkBytes = readFileSync("data/metadata/california-2026-primary-block-crosswalk-candidate-v1.json");
  const geographyBytes = readFileSync("data/metadata/california-primary-geography-compatibility-candidate-v2.json");
  const jointBytes = readFileSync("data/metadata/california-primary-identity-geography-review-package-v2.json");
  return {
    crosswalkJson: crosswalkBytes.toString("utf8"),
    geographyJson: geographyBytes.toString("utf8"),
    jointJson: jointBytes.toString("utf8"),
    sourceLock: JSON.parse(readFileSync("data/source-lock.json", "utf8")),
  };
}

const load = () => JSON.parse(readFileSync(artifactPath, "utf8"));

describe("California split-crosswalk policy dossier", () => {
  it("replays the retained proposal byte-for-byte from its three evidence parents", () => {
    expect(buildCaliforniaSplitCrosswalkPolicyDossier(input())).toEqual(
      validateCaliforniaSplitCrosswalkPolicyDossier(load(), input()),
    );
  });

  it("covers all 48 split relationships and partitions the 38 joint-scope and 10 statewide-only rows", () => {
    const value = load();
    expect(value.summary).toMatchObject({
      splitRelationships: 48,
      currentIncumbentJointScope: 38,
      statewideGeographyOnlyScope: 10,
      exactMembershipRelationshipsExcluded: 4,
      policyApprovals: 0,
      rowApprovals: 0,
      scoreEligibleRows: 0,
    });
    expect(value.rows).toHaveLength(48);
    expect(value.rows.filter((row: any) => row.scope === "current_incumbent_joint_review")).toHaveLength(38);
    expect(value.rows.filter((row: any) => row.scope === "statewide_geography_only")).toHaveLength(10);
    expect(new Set(value.rows.map((row: any) => row.crosswalkRowSha256)).size).toBe(48);
    expect(value.rows.every((row: any) => row.compatibilityDisposition === "crosswalk_review_required")).toBe(true);
    expect(value.rows.find((row: any) => row.districtCode === "12")).toMatchObject({ sourceBlockCount: 8894, targetBlockCount: 8895, sameDistrictBlockCount: 8894, compatibilityCandidate: false });
    expect(value.rows.find((row: any) => row.districtCode === "41")).toMatchObject({ sourceBlockCount: 6975, sameDistrictBlockCount: 0, compatibilityCandidate: false });
  });

  it("separates methodology selection from row approval and preserves the exact-only safe default", () => {
    const value = load();
    expect(value.recommendedDecision).toMatchObject({
      choice: "retain_exact_block_membership_only_rule",
      confidence: "high",
      authorizesRowApproval: false,
    });
    expect(value.alternatives.map((row: any) => row.choice)).toEqual([
      "authorize_separately_specified_crosswalk_methodology",
      "mark_split_historical_comparisons_unavailable_or_incompatible",
    ]);
    expect(value.methodology).toMatchObject({
      populationWeightingUsed: false,
      voterWeightingUsed: false,
      turnoutWeightingUsed: false,
      partisanWeightingUsed: false,
      overlapThresholdUsed: false,
      districtNumberContinuityUsed: false,
      rawGeometryEqualityUsed: false,
      policyResolutionAutomaticallyApprovesRows: false,
      evaluatorNumericValues: 0,
    });
    expect(value.resolution).toEqual({ status: "proposed", decision: null, reviewer: null, reviewedAt: null, rationale: null });
    expect(value.rows.every((row: any) => !row.compatibilityApproved && !row.scoreEligible && !row.publicationEligible && !row.deployed)).toBe(true);
  });

  it("fails closed on parent bytes, source-lock lineage, policy claims, lifecycle escalation, and row drift", () => {
    for (const key of ["crosswalkJson", "geographyJson", "jointJson"] as const) {
      const value = input(); value[key] += " ";
      expect(() => buildCaliforniaSplitCrosswalkPolicyDossier(value)).toThrow(/CA_SPLIT_CROSSWALK_POLICY_INVALID/);
    }
    const lock = input();
    lock.sourceLock.entries.find((entry: any) => entry.id === "california-primary-identity-geography-review-package-v2").parentIds = [];
    expect(() => buildCaliforniaSplitCrosswalkPolicyDossier(lock)).toThrow(/CA_SPLIT_CROSSWALK_POLICY_INVALID/);
    for (const field of ["url", "retainedPath", "byteSize", "kind"] as const) {
      const changed = input();
      const entry = changed.sourceLock.entries.find((candidate: any) => candidate.id === "california-primary-geography-compatibility-candidate-v2");
      entry[field] = field === "byteSize" ? entry.byteSize + 1 : "invented";
      expect(() => buildCaliforniaSplitCrosswalkPolicyDossier(changed)).toThrow(/CA_SPLIT_CROSSWALK_POLICY_INVALID/);
    }

    const base = load();
    const mutations = [
      (value: any) => { value.methodology.populationWeightingUsed = true; },
      (value: any) => { value.methodology.overlapThresholdUsed = true; },
      (value: any) => { value.methodology.policyResolutionAutomaticallyApprovesRows = true; },
      (value: any) => { value.recommendedDecision.authorizesRowApproval = true; },
      (value: any) => { value.resolution.decision = "approved"; },
      (value: any) => { value.rows[0].compatibilityApproved = true; },
      (value: any) => { value.rows[0].scoreEligible = true; },
      (value: any) => { value.rows[0].publicationEligible = true; },
      (value: any) => { value.rows[0].sourceRetentionPpm += 1; },
      (value: any) => { value.packageSha256 = "0".repeat(64); },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(base); mutate(value);
      expect(() => validateCaliforniaSplitCrosswalkPolicyDossier(value, input())).toThrow(/CA_SPLIT_CROSSWALK_POLICY_INVALID/);
    }
  });

  it("keeps the retained artifact registered with exact bytes", () => {
    const bytes = readFileSync(artifactPath);
    const lock = input().sourceLock.entries.find((entry: any) => entry.id === "california-split-crosswalk-policy-dossier-v1");
    expect(lock).toMatchObject({ retainedPath: artifactPath, retainedStatus: "retained", byteSize: bytes.length, sha256: sha(bytes), kind: "review_candidate" });
  });
});
