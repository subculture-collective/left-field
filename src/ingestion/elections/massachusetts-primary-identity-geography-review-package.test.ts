/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial persisted package mutations */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import {
  buildMassachusettsPrimaryJointReviewPackage,
  validateMassachusettsPrimaryJointReviewPackage,
} from "./massachusetts-primary-identity-geography-review-package";

const text = (path: string): string => readFileSync(path, "utf8");
const digest = (domain: string, value: unknown): string =>
  createHash("sha256").update(domain, "ascii").update(canonicalJson(value), "utf8").digest("hex");

function build(options?: { identityJson?: string; sourceLockJson?: string }) {
  return buildMassachusettsPrimaryJointReviewPackage({
    proposalJson: text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    identityJson: options?.identityJson ?? text("data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json"),
    geographyJson: text("data/metadata/massachusetts-primary-geography-compatibility-candidate-v1.json"),
    sourceLockJson: options?.sourceLockJson ?? text("data/source-lock.json"),
  });
}

describe("Massachusetts primary identity/geography joint reviewer package", () => {
  it("rebuilds the persisted reviewer package exactly", () => {
    expect(build()).toEqual(validateMassachusettsPrimaryJointReviewPackage(
      JSON.parse(text("data/metadata/massachusetts-primary-identity-geography-review-package-v1.json")),
    ));
  });

  it("joins all eighteen rows into three unresolved independent decisions without approval", () => {
    const value = build();
    expect(value.summary).toEqual({
      reviewRecords: 18,
      identityAndGeographyCandidates: 18,
      identityCandidates: 18,
      geographyCandidates: 18,
      proposedDecisions: 3,
      jointApprovedRecords: 0,
      scoreEligibleRecords: 0,
    });
    expect(value.records).toHaveLength(18);
    expect(value.decisions).toHaveLength(3);
    expect(value.decisions.every((decision) => decision.review.resolution === null)).toBe(true);
    expect(value.records.every((record) =>
      !record.identity.identityApproved && !record.geography.compatibilityApproved &&
      !record.jointApproved && !record.scoreEligible
    )).toBe(true);
    expect(validateMassachusettsPrimaryJointReviewPackage(value)).toEqual(value);
  });

  it("makes every reviewer choice concrete, evidence-bound, and independently reversible", () => {
    const value = build();
    const recordIds = value.records.map((record) => record.reviewRecordId);
    expect(value.decisions.map((decision) => [decision.decisionId, decision.parentDecisionId])).toEqual([
      ["ma-primary:accept-geography-compatibility-v1", "approve-historical-district-cd119-compatibility-v1"],
      ["ma-primary:accept-identity-links-v1", "approve-historic-primary-candidate-identity-resolution-v1"],
      ["ma-primary:retain-single-named-reported-contest-treatment-v1", "decide-nonstandard-primary-disposition-treatment-v1"],
    ]);
    expect(value.decisions.every((decision) =>
      decision.defaultReversibleAssumption === "exclude_affected_records_from_evaluator_and_publication" &&
      decision.alternatives.length === 2 && decision.consequences.length === 2 &&
      decision.evidenceRecordIds.join("\0") === recordIds.join("\0") &&
      decision.blocksAffectedPublication && !decision.blocksOtherWork
    )).toBe(true);
    expect(value.methodology).toMatchObject({
      decisionsReviewedIndependently: true,
      jointPackageApprovesParents: false,
      automaticApprovals: 0,
      evaluatorNumericValues: 0,
    });
  });

  it("rejects parent byte substitution and exact source-lock lineage drift", () => {
    const identityJson = text("data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json");
    expect(() => build({ identityJson: `${identityJson} ` })).toThrow("INPUT_HASH_MISMATCH");

    const sourceLock = JSON.parse(text("data/source-lock.json")) as any;
    sourceLock.entries.find((entry: any) => entry.id === "massachusetts-primary-geography-compatibility-candidate-v1").parentIds = [];
    expect(() => build({ sourceLockJson: JSON.stringify(sourceLock) })).toThrow("SOURCE_LOCK_MISMATCH");

    const outputLineageDrift = JSON.parse(text("data/source-lock.json")) as any;
    outputLineageDrift.entries.find((entry: any) =>
      entry.id === "massachusetts-primary-identity-geography-review-package-v1"
    ).parentIds = [];
    expect(() => build({ sourceLockJson: JSON.stringify(outputLineageDrift) })).toThrow("SOURCE_LOCK_MISMATCH");
  });

  it("rejects fully rehashed drift from joined parent-row facts", () => {
    const drifted = structuredClone(build()) as any;
    drifted.records[0].identity.parentRowSha256 = "0".repeat(64);
    const unsignedRecord = structuredClone(drifted.records[0]);
    delete unsignedRecord.reviewRecordSha256;
    drifted.records[0].reviewRecordSha256 = digest("dsa-seats:ma-primary-joint-review-row:v1\0", unsignedRecord);
    drifted.reviewRecordSetSha256 = digest("dsa-seats:ma-primary-joint-review-row-set:v1\0", drifted.records);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-joint-review-package:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryJointReviewPackage(drifted)).toThrow("PARENT_FACT_INVALID");
  });

  it("rejects fully rehashed unknown decision semantics", () => {
    const drifted = structuredClone(build()) as any;
    drifted.decisions[0].automaticApproval = true;
    drifted.decisionSetSha256 = digest("dsa-seats:ma-primary-joint-review-decision-set:v1\0", drifted.decisions);
    const unsigned = structuredClone(drifted);
    delete unsigned.packageSha256;
    drifted.packageSha256 = digest("dsa-seats:ma-primary-joint-review-package:v1\0", unsigned);
    expect(() => validateMassachusettsPrimaryJointReviewPackage(drifted)).toThrow("DECISION_FIELDS_INVALID");
  });
});
