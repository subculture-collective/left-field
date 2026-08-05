/* eslint-disable @typescript-eslint/no-explicit-any -- adversarial mutation fixtures */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./aipac-proposed-packages";
import { buildAipacIncumbentResolutionDispositionsV3, validateAipacIncumbentResolutionDispositionsV3 } from "./aipac-incumbent-resolution-dispositions-v3";
const load = (path: string) => { const bytes = readFileSync(path); return { value: JSON.parse(bytes.toString()), sha256: createHash("sha256").update(bytes).digest("hex") }; };
const hash = (domain: string, value: unknown) => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const build = () => { const prior = load("data/metadata/aipac-incumbent-resolution-dispositions-v2.json"), receipt = load("data/metadata/ca31-terminal-fec-chain-receipt-v1.json"); return buildAipacIncumbentResolutionDispositionsV3({ dispositionsV2: prior.value, dispositionsV2FileSha256: prior.sha256, receipt: receipt.value, receiptFileSha256: receipt.sha256 }); };
describe("AIPAC incumbent dispositions v3", () => {
  it("mechanically closes CA-31 2024 without resolving H8/H4 identity", () => { const value = build(), ca = value.dispositions.find((row) => row.seatCycleId === "seat_house_ca_31_current")!; expect(ca.cycleDispositions.find((row) => row.cycleYear === 2024)).toMatchObject({ disposition: "auto_verified_house_relationship", evaluatorUse: "reviewer_only_candidate", confidence: "certain" }); expect(ca).toMatchObject({ alternateCandidateIds: [], identityDispositionScope: "canonical_roster_identity_only", identifierMappingResolved: false, unresolvedIdentifierConflict: true, conflictingSignedFormCandidateIds: ["H4CA31170"] }); expect(value.remainingDecisionQueue).toEqual([]); expect(value.automaticEvidenceClosures[0]).toMatchObject({ reviewerAction: false, reviewer: null, reviewedAt: null }); });
  it("rejects an injected reviewer or a one-channel-style pending substitution", () => { const reviewed: any = build(); reviewed.automaticEvidenceClosures[0].reviewer = "fabricated"; expect(() => validateAipacIncumbentResolutionDispositionsV3(reviewed)).toThrow(); const pending: any = build(); pending.dispositions.find((row: any) => row.seatCycleId === "seat_house_ca_31_current").cycleDispositions[0].evaluatorUse = "excluded_pending_review"; expect(() => validateAipacIncumbentResolutionDispositionsV3(pending)).toThrow(); });
  it("rejects a fully rehashed substitution for the exact receipt-bound closure", () => {
    const value: any = build();
    const closure = value.automaticEvidenceClosures[0];
    closure.evidenceSetSha256 = "0".repeat(64);
    const closureUnsigned = { ...closure }; delete closureUnsigned.closureSha256;
    closure.closureSha256 = hash("dsa-seats:aipac-incumbent-automatic-closure:v3\0", closureUnsigned);
    value.derivation.automaticClosureSetSha256 = hash("dsa-seats:aipac-incumbent-automatic-closure-set:v3\0", value.automaticEvidenceClosures);
    const unsigned = { ...value }; delete unsigned.packageSha256;
    value.packageSha256 = hash("dsa-seats:aipac-incumbent-resolution-dispositions:v3\0", unsigned);
    expect(() => validateAipacIncumbentResolutionDispositionsV3(value)).toThrow("AIPAC_INCUMBENT_DISPOSITIONS_V3_CA31_CLOSURE_MISMATCH");
  });
});
