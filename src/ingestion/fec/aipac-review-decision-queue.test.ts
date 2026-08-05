import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacReviewDecisionQueue, validateAipacReviewDecisionQueue } from "./aipac-review-decision-queue";

const read = (file: string): unknown => JSON.parse(readFileSync(resolve("data/metadata", file), "utf8"));
const inputs = () => ({
  mapping: read("aipac-candidate-seat-mappings-proposal-v1.json"),
  evidenceClosure: read("aipac-evidence-closure-proposal-v1.json"),
  networkClassification: read("org-classification-aipac-network-proposal-v1.json"),
});

describe("AIPAC reviewer decision queue", () => {
  it("builds the complete deterministic nonpublishable queue", () => {
    const first = buildAipacReviewDecisionQueue(inputs());
    const second = buildAipacReviewDecisionQueue(inputs());
    expect(second).toEqual(first);
    expect(first.summary).toEqual({ mappingDecisions: 229, directIncumbentMappings: 212, inferredChallengerMappings: 17, mappingConflicts: 8, candidateSeatAmbiguities: 1, totalDecisions: 231 });
    expect(first.decisions).toHaveLength(231);
    expect(first.decisions.filter((row) => row.component === "candidate_mapping" && row.sourceStatus === "needs_review")).toHaveLength(8);
    expect(first.decisions.filter((row) => row.provenance.rationaleCodes.includes("CANDIDATE_ID_MULTIPLE_SEATS_CONFLICT"))).toHaveLength(2);
    expect(first.decisions.filter((row) => row.provenance.rationaleCodes.includes("CANDIDATE_ID_MULTIPLE_SEATS_CONFLICT")).every((row) => row.recommendedDecision.includes("unique relationship"))).toBe(true);
    expect(first.decisions.filter((row) => row.component === "candidate_mapping" && row.provenance.kind === "inferred")).toHaveLength(17);
    expect(first.decisions.every((row) => row.blocksPublication && row.defaultReversibleAssumption === "exclude_from_scoring_and_publication")).toBe(true);
    expect(first).toMatchObject({ publicationEligible: false, review: { status: "proposed", reviewer: null, reviewedAt: null } });
    expect(() => validateAipacReviewDecisionQueue(first)).not.toThrow();
  });

  it("rejects package mutation and cutoff disagreement", () => {
    const queue = buildAipacReviewDecisionQueue(inputs());
    expect(() => validateAipacReviewDecisionQueue({ ...queue, sourceCutoff: "2026-08-03" })).toThrow("AIPAC_REVIEW_QUEUE_HASH_MISMATCH");
    const mismatched = inputs();
    const closure = mismatched.evidenceClosure as Record<string, unknown>;
    mismatched.evidenceClosure = { ...closure, sourceCutoff: "2026-08-03" };
    expect(() => buildAipacReviewDecisionQueue(mismatched)).toThrow();
  });
});
