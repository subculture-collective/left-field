import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacChallengerAmbiguityResolutionCandidate, validateAipacChallengerAmbiguityResolutionCandidate } from "./aipac-challenger-ambiguity-resolution-candidate";

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const load = async (file: string) => { const bytes = await readFile(resolve("data/metadata", file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) }; };
const inputs = async () => { const closure = await load("aipac-evidence-closure-proposal-v1.json"); const foundation = await load("aipac-evidence-foundation-candidate-v1.json"); return { closure: closure.value, closureFileSha256: closure.sha256, foundation: foundation.value, foundationFileSha256: foundation.sha256 }; };

describe("AIPAC challenger ambiguity resolution candidate", () => {
  it("accepts the unique positive Illinois target and rejects the negative-only California adjustment", async () => {
    const candidate = buildAipacChallengerAmbiguityResolutionCandidate(await inputs());
    expect(candidate.summary).toEqual({ inputConflictRelationships: 2, mechanicallyResolvedRelationships: 2, acceptedRelationships: 1, rejectedRelationships: 1, remainingFoundationConflictRelationships: 6, remainingMethodologyAndPromotionDecisions: 4 });
    expect(candidate.dispositions.find((row) => row.seatCycleId === "seat_house_il_07_current")).toMatchObject({ disposition: "auto_accept_unique_positive_target", evaluatorUse: "reviewer_only_candidate", positiveRecordCount: 20, negativeRecordCount: 1 });
    expect(candidate.dispositions.find((row) => row.seatCycleId === "seat_house_ca_47_current")).toMatchObject({ disposition: "auto_reject_negative_adjustment_only_target", evaluatorUse: "excluded_invalid_origin", positiveRecordCount: 0, negativeRecordCount: 1 });
    expect(validateAipacChallengerAmbiguityResolutionCandidate(candidate)).toEqual(candidate);
  });

  it("fails closed if the negative-only row becomes positive or parent bytes are not pinned", async () => {
    const input = await inputs();
    expect(() => buildAipacChallengerAmbiguityResolutionCandidate({ ...input, closureFileSha256: "0".repeat(64) })).toThrow("AIPAC_AMBIGUITY_INPUT_HASH_MISMATCH");
    const changed = structuredClone(input.closure) as { scheduleE: { records: Array<{ candidateId: string | null; candidateOfficeState: string | null; candidateOfficeDistrict: string | null; amount: number }> } };
    const row = changed.scheduleE.records.find((item) => item.candidateId === "H0IL07167" && item.candidateOfficeState === "CA" && item.candidateOfficeDistrict === "47");
    expect(row).toBeDefined();
    row!.amount = Math.abs(row!.amount);
    expect(() => buildAipacChallengerAmbiguityResolutionCandidate({ ...input, closure: changed })).toThrow("AIPAC_AMBIGUITY_UNIQUE_POSITIVE_TARGET_NOT_PROVEN");
  });
});
