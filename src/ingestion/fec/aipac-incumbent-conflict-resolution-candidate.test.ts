import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAipacIncumbentConflictResolutionCandidate, validateAipacIncumbentConflictResolutionCandidate } from "./aipac-incumbent-conflict-resolution-candidate";

const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const load = async (file: string) => { const bytes = await readFile(resolve("data/metadata", file)); return { value: JSON.parse(bytes.toString("utf8")), sha256: digest(bytes) }; };
const inputs = async () => {
  const proposal = await load("aipac-candidate-seat-mappings-proposal-v1.json");
  const authorityReceipt = await load("aipac-incumbent-fec-authority-receipt-v1.json");
  const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8")) as { entries: Array<{ id: string; retainedStatus: string; sha256: string; byteSize: number; url: string }> };
  return { proposal: proposal.value, proposalFileSha256: proposal.sha256, authorityReceipt: authorityReceipt.value, authorityReceiptFileSha256: authorityReceipt.sha256, sourceLockEntries: sourceLock.entries };
};

describe("AIPAC incumbent conflict resolution candidate", () => {
  it("produces six evidence-specific reviewer decisions without auto-approving any relationship", async () => {
    const candidate = buildAipacIncumbentConflictResolutionCandidate(await inputs());
    expect(candidate.summary).toEqual({ inputConflictRelationships: 6, evidenceSpecificResolutionCandidates: 6, correctedCandidateIds: 2, partyAliasCandidates: 1, sourceScopedAliasOverrideCandidates: 1, officeChangeExclusions: 2, pendingAuthorizedMappingDecisions: 6, automaticallyApprovedRelationships: 0, remainingMethodologyAndPromotionDecisions: 4 });
    expect(candidate.resolutions.map((row) => row.seatCycleId)).toEqual(["seat_house_ca_31_current", "seat_house_ma_06_current", "seat_house_md_04_current", "seat_house_mn_03_current", "seat_house_nh_01_current", "seat_house_ny_04_current"]);
    expect(candidate.resolutions.find((row) => row.seatCycleId === "seat_house_md_04_current")).toMatchObject({ sourceCandidateId: "H2MD04315", canonicalCandidateId: "H2MD04232" });
    expect(candidate.resolutions.find((row) => row.seatCycleId === "seat_house_ny_04_current")).toMatchObject({ sourceCandidateId: "H4NY04158", canonicalCandidateId: "H2NY04244" });
    expect(candidate.resolutions.find((row) => row.seatCycleId === "seat_house_mn_03_current")).toMatchObject({ partyTreatment: "explicit_dfl_alias_required" });
    for (const seat of ["seat_house_ma_06_current", "seat_house_nh_01_current"]) expect(candidate.resolutions.find((row) => row.seatCycleId === seat)?.cycleDispositions.find((cycle) => cycle.cycleYear === 2026)).toEqual(expect.objectContaining({ disposition: "office_changed_to_senate", committeeIds: [], numericUse: "excluded_not_house_candidacy" }));
    expect(candidate.resolutions.every((row) => row.defaultEvaluatorUse === "excluded_pending_authorized_review")).toBe(true);
    expect(validateAipacIncumbentConflictResolutionCandidate(candidate)).toEqual(candidate);
  });

  it("fails closed on parent drift, a missing filing receipt, or a changed source relationship", async () => {
    const input = await inputs();
    expect(() => buildAipacIncumbentConflictResolutionCandidate({ ...input, authorityReceiptFileSha256: "0".repeat(64) })).toThrow("AIPAC_INCUMBENT_RESOLUTION_INPUT_HASH_MISMATCH");
    expect(() => buildAipacIncumbentConflictResolutionCandidate({ ...input, sourceLockEntries: input.sourceLockEntries.filter((entry) => entry.id !== "mn-dfl-about-party-affiliation-20260805") })).toThrow("AIPAC_INCUMBENT_RESOLUTION_PARTY_ALIAS_AUTHORITY_MISMATCH");
    expect(() => buildAipacIncumbentConflictResolutionCandidate({ ...input, sourceLockEntries: input.sourceLockEntries.filter((entry) => entry.id !== "fec-form1-1699615") })).toThrow("AIPAC_INCUMBENT_RESOLUTION_FILING_SOURCE_LOCK_MISMATCH");
    const changed = structuredClone(input.proposal) as { proposedDecisions: Array<{ seatCycleId: string; candidateId: string }> };
    changed.proposedDecisions.find((row) => row.seatCycleId === "seat_house_md_04_current" && row.candidateId === "H2MD04315")!.candidateId = "H0MD00000";
    expect(() => buildAipacIncumbentConflictResolutionCandidate({ ...input, proposal: changed })).toThrow("AIPAC_INCUMBENT_RESOLUTION_SOURCE_RELATIONSHIP_MISMATCH");
  });

  it("fails closed if an office-change cycle is assigned a House committee", async () => {
    const input = await inputs();
    const changed = structuredClone(input.authorityReceipt) as { cases: Array<{ seatCycleId: string; cycleDispositions: Array<{ cycleYear: number; committeeIds: string[] }> }> };
    changed.cases.find((row) => row.seatCycleId === "seat_house_ma_06_current")!.cycleDispositions.find((cycle) => cycle.cycleYear === 2026)!.committeeIds = ["C00547240"];
    expect(() => buildAipacIncumbentConflictResolutionCandidate({ ...input, authorityReceipt: changed })).toThrow("AIPAC_INCUMBENT_RESOLUTION_OFFICE_CHANGE_INVALID");
  });
});
