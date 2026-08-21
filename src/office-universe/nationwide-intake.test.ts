import { describe, expect, it } from "vitest";

import {
  STATE_CODES,
  assessRawIntake,
  buildNationwideSourceRegistry,
  holderTransitionFromResult,
  selectCalculationInputs,
} from "./nationwide-intake";

const raw = {
  sourceKey: "state-election-authority:IN", snapshotId: "snapshot_in_primary", payloadSha256: "a".repeat(64), payloadLocator: "office-universe/in/primary.json", sourceNaturalKey: "IN:2026:HD-01", kind: "result" as const, observedAt: "2026-05-06T01:00:00Z", payload: { contest: "HD-01", votes: 42 },
};

describe("nationwide office-universe intake", () => {
  it("creates discovery, election, finance, geography, and officeholder slots for every state", () => {
    const registry = buildNationwideSourceRegistry();
    expect(STATE_CODES).toHaveLength(50);
    expect(registry).toHaveLength(250);
    expect(new Set(registry.map((entry) => entry.stateCode))).toEqual(new Set(STATE_CODES));
    expect(registry.filter((entry) => entry.family === "elections" && entry.status === "authority_unavailable")).toHaveLength(50);
  });

  it("quarantines only unsafe intake records and accepts incomplete reported results", () => {
    expect(assessRawIntake(raw)).toEqual({ disposition: "accepted", issues: [] });
    expect(assessRawIntake({ ...raw, payloadLocator: "../escape", payload: { address: "not allowed" } })).toMatchObject({ disposition: "quarantined", issues: expect.arrayContaining([expect.objectContaining({ code: "PAYLOAD_LOCATOR_INVALID" }), expect.objectContaining({ code: "PROHIBITED_PERSONAL_DATA" })]) });
  });

  it("keeps a primary winner pending until a sourced term transition and separates calculation workspaces", () => {
    const result = { contestId: "contest_in_hd01", sourceNaturalKey: "IN:2026:HD-01", observedAt: "2026-05-06T01:00:00Z", maturity: "provisional_winner" as const, winnerCandidateKey: "candidate_new", reportingCompletenessPercent: 100, sourceSnapshotId: "snapshot_in_primary" };
    expect(holderTransitionFromResult(result, "office_in_hd01", "2027-01-01T00:00:00Z")).toMatchObject({ status: "holder_pending_transition", holderId: "candidate_new" });
    const inputs = [
      { officeId: "office_in_hd01", factKey: "primary_result", maturity: "provisional_winner" as const, value: 51, missingReason: null, sourceSnapshotId: "snapshot_in_primary" },
      { officeId: "office_in_hd01", factKey: "certified_result", maturity: "certified_winner" as const, value: 51, missingReason: null, sourceSnapshotId: "snapshot_in_certified" },
      { officeId: "office_in_hd01", factKey: "finance", maturity: "raw" as const, value: null, missingReason: "not_collected", sourceSnapshotId: "snapshot_in_primary" },
    ];
    expect(selectCalculationInputs("provisional", inputs)).toHaveLength(2);
    expect(selectCalculationInputs("certified", inputs)).toEqual([inputs[1]]);
  });
});
