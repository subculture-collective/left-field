import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAipacEvidenceFoundationCandidate,
  validateAipacEvidenceFoundationCandidate,
} from "./aipac-evidence-foundation-candidate";
import { canonicalJson } from "./aipac-proposed-packages";

const root = resolve("data/metadata");
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const objectDigest = (domain: string, value: unknown): string => createHash("sha256").update(domain, "utf8").update(canonicalJson(value), "utf8").digest("hex");
const load = async (file: string): Promise<{ value: unknown; sha256: string }> => {
  const bytes = await readFile(resolve(root, file));
  return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) };
};
const inputs = async () => {
  const mapping = await load("aipac-candidate-seat-mappings-proposal-v1.json");
  const evidenceClosure = await load("aipac-evidence-closure-proposal-v1.json");
  const networkClassification = await load("org-classification-aipac-network-proposal-v1.json");
  return { mapping: mapping.value, mappingFileSha256: mapping.sha256, evidenceClosure: evidenceClosure.value, evidenceClosureFileSha256: evidenceClosure.sha256, networkClassification: networkClassification.value, networkClassificationFileSha256: networkClassification.sha256 };
};

describe("AIPAC evidence foundation candidate", () => {
  it("automatically closes deterministic evidence inputs and queues only genuine mapping conflicts", async () => {
    const candidate = buildAipacEvidenceFoundationCandidate(await inputs());
    expect(candidate.summary).toEqual({ targetSeats: 212, inputRelationships: 229, autoVerifiedDirectRelationships: 206, autoInferredCandidateRelationships: 15, usableReviewerCandidateRelationships: 221, unresolvedConflictRelationships: 8, remainingHumanDecisions: 8, numericEvidenceRows: 0, evaluatorRouteSelections: 0 });
    expect(candidate.acquisitionClosure).toMatchObject({ disposition: "auto_verified_derived_candidate", aipacPacFilings: 84, udpFilings: 270, udpScheduleERecords: 1145 });
    expect(candidate.networkClassification).toMatchObject({ subjectCommitteeId: "C00799031", disposition: "auto_verified_direct_candidate", confidence: "high" });
    expect(candidate.relationships.filter((row) => row.evaluatorUse === "reviewer_only_candidate")).toHaveLength(221);
    expect(candidate.relationships.filter((row) => row.evaluatorUse === "excluded_conflict")).toHaveLength(8);
    expect(candidate.remainingDecisionQueue.every((row) => row.blocksOtherWork === false && row.resolution === null && row.reviewer === null)).toBe(true);
    expect(validateAipacEvidenceFoundationCandidate(candidate)).toEqual(candidate);
  });

  it("is deterministic and retains inference labels instead of converting them to direct facts", async () => {
    const input = await inputs();
    const first = buildAipacEvidenceFoundationCandidate(input);
    const second = buildAipacEvidenceFoundationCandidate(input);
    expect(second).toEqual(first);
    expect(first.relationships.filter((row) => row.disposition === "auto_inferred_candidate")).toHaveLength(15);
    expect(first.relationships.filter((row) => row.disposition === "auto_inferred_candidate").every((row) => row.provenanceKind === "inferred" && row.confidence === "medium")).toBe(true);
  });

  it("fails closed on changed input bytes, self-rehash attempts, or invented publication eligibility", async () => {
    const input = await inputs();
    expect(() => buildAipacEvidenceFoundationCandidate({ ...input, mappingFileSha256: "0".repeat(64) })).toThrow("AIPAC_FOUNDATION_INPUT_FILE_HASH_MISMATCH");
    const candidate = buildAipacEvidenceFoundationCandidate(input);
    expect(() => validateAipacEvidenceFoundationCandidate({ ...candidate, publicationEligible: true })).toThrow();
    expect(() => validateAipacEvidenceFoundationCandidate({ ...candidate, packageSha256: "0".repeat(64) })).toThrow("AIPAC_FOUNDATION_PACKAGE_HASH_MISMATCH");
    const changed = structuredClone(candidate);
    changed.relationships[0]!.seatCycleId = "seat_house_xx_00_current";
    expect(() => validateAipacEvidenceFoundationCandidate(changed)).toThrow("AIPAC_FOUNDATION_PACKAGE_HASH_MISMATCH");

    const rehashedParentInput = await inputs();
    const rehashedParent = structuredClone(rehashedParentInput.mapping) as Record<string, unknown> & { proposedDecisions: Array<Record<string, unknown>>; packageSha256: string };
    rehashedParent.proposedDecisions[0]!.candidateId = "H9ZZ99999";
    const parentUnsigned = { ...rehashedParent };
    delete (parentUnsigned as Partial<typeof parentUnsigned>).packageSha256;
    rehashedParent.packageSha256 = objectDigest("dsa-seats:aipac-proposed-package:v1\0", parentUnsigned);
    expect(() => buildAipacEvidenceFoundationCandidate({ ...rehashedParentInput, mapping: rehashedParent })).toThrow("AIPAC_FOUNDATION_INPUT_PACKAGE_HASH_MISMATCH");

    const rehashedChild = structuredClone(candidate);
    rehashedChild.relationships[0]!.seatCycleId = "seat_house_xx_00_current";
    const relationshipUnsigned = { ...rehashedChild.relationships[0]! };
    delete (relationshipUnsigned as Partial<typeof relationshipUnsigned>).relationshipSha256;
    rehashedChild.relationships[0]!.relationshipSha256 = objectDigest("dsa-seats:aipac-auto-relationship:v1\0", relationshipUnsigned);
    const childUnsigned = { ...rehashedChild };
    delete (childUnsigned as Partial<typeof childUnsigned>).packageSha256;
    rehashedChild.packageSha256 = objectDigest("dsa-seats:aipac-evidence-foundation-candidate:v1\0", childUnsigned);
    expect(() => validateAipacEvidenceFoundationCandidate(rehashedChild)).toThrow("AIPAC_FOUNDATION_DERIVATION_SET_MISMATCH");
  });
});
