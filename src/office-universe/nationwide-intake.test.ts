import { describe, expect, it } from "vitest";

import {
  FINANCE_ALLOWLIST_PENDING,
  PUBLIC_OFFICE_PAYLOAD_KEYS,
  STATE_CODES,
  assessRawIntake,
  disallowedKeyPaths,
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

  it("accepts nested public_office_only payloads only through the reviewed key allowlist", () => {
    const nested = { contest: "HD-01", results: [{ candidate: { name: "A", party: "D" }, votes: 10 }, { candidate: { name: "B", party: "R" }, votes: 9 }], source: { url: "https://x.example", observed_at: "2026-05-06T01:00:00Z" } };
    expect(assessRawIntake({ ...raw, payload: nested })).toEqual({ disposition: "accepted", issues: [] });
    expect(assessRawIntake({ ...raw, payload: nested }, { privacyPolicy: "public_office_only" })).toEqual({ disposition: "accepted", issues: [] });
    const leak = { contest: "HD-01", results: [{ candidate: { name: "A", home_address: "1 Main St" }, votes: 10 }] };
    expect(assessRawIntake({ ...raw, payload: leak })).toEqual({ disposition: "quarantined", issues: [{ code: "PROHIBITED_PERSONAL_DATA", diagnostic: 'payload key "results[0].candidate.home_address" is not in the reviewed public_office_only allowlist' }] });
    expect(assessRawIntake({ ...raw, payload: [{ contest: "HD-01" }, { phone: "555" }] })).toMatchObject({ disposition: "quarantined", issues: [expect.objectContaining({ diagnostic: expect.stringContaining('"[1].phone"') })] });
    expect(disallowedKeyPaths({ office: { chamber: "house", email: "x", meta: { votes: 1, ssn: "y" } } }, PUBLIC_OFFICE_PAYLOAD_KEYS)).toEqual(["office.email", "office.meta", "office.meta.ssn"]);
    expect(PUBLIC_OFFICE_PAYLOAD_KEYS.has("address")).toBe(false);
    expect(PUBLIC_OFFICE_PAYLOAD_KEYS.has("contributor")).toBe(false);
  });

  it("rejects every finance_allowlist payload until a reviewed allowlist exists", () => {
    const finance = { office: "HD-01", votes: 1 };
    expect(assessRawIntake({ ...raw, payload: finance }, { privacyPolicy: "finance_allowlist" })).toEqual({ disposition: "quarantined", issues: [{ code: FINANCE_ALLOWLIST_PENDING, diagnostic: expect.stringContaining("finance") }] });
    expect(assessRawIntake({ ...raw, kind: "finance", payload: finance })).toMatchObject({ disposition: "quarantined", issues: [{ code: FINANCE_ALLOWLIST_PENDING }] });
    expect(assessRawIntake({ ...raw, kind: "finance", payload: {} }, { privacyPolicy: "finance_allowlist" })).toMatchObject({ disposition: "quarantined" });
  });

  it("keeps a primary winner pending until a sourced term transition and separates calculation workspaces", () => {
    const result = { contestId: "contest_in_hd01", sourceNaturalKey: "IN:2026:HD-01", observedAt: "2026-05-06T01:00:00Z", maturity: "provisional_winner" as const, winnerCandidateKey: "candidate_new", reportingCompletenessPercent: 100, sourceSnapshotId: "snapshot_in_primary" };
    const certified = { ...result, maturity: "certified_winner" as const, sourceSnapshotId: "snapshot_in_certified" };
    expect(holderTransitionFromResult(certified, "office_in_hd01", "2027-01-01T00:00:00Z")).toEqual({ officeId: "office_in_hd01", holderId: "candidate_new", status: "holder_pending_transition", effectiveAt: "2027-01-01T00:00:00Z", sourceSnapshotId: "snapshot_in_certified" });
    expect(holderTransitionFromResult(result, "office_in_hd01", "2027-01-01T00:00:00Z")).toBeNull();
    for (const maturity of ["raw", "normalized", "reported_result", "superseded"] as const) expect(holderTransitionFromResult({ ...certified, maturity }, "office_in_hd01", "2027-01-01T00:00:00Z")).toBeNull();
    expect(holderTransitionFromResult(certified, "office_in_hd01", null)).toBeNull();
    expect(holderTransitionFromResult(certified, "office_in_hd01", "2027-01-01")).toBeNull();
    expect(holderTransitionFromResult(certified, "office_in_hd01", "2027-01-01T00:00:00-05:00")).toBeNull();
    expect(holderTransitionFromResult({ ...certified, winnerCandidateKey: null }, "office_in_hd01", "2027-01-01T00:00:00Z")).toBeNull();
    expect(holderTransitionFromResult({ ...certified, sourceSnapshotId: "" }, "office_in_hd01", "2027-01-01T00:00:00Z")).toBeNull();
    const inputs = [
      { officeId: "office_in_hd01", factKey: "primary_result", maturity: "provisional_winner" as const, value: 51, missingReason: null, sourceSnapshotId: "snapshot_in_primary" },
      { officeId: "office_in_hd01", factKey: "certified_result", maturity: "certified_winner" as const, value: 51, missingReason: null, sourceSnapshotId: "snapshot_in_certified" },
      { officeId: "office_in_hd01", factKey: "finance", maturity: "raw" as const, value: null, missingReason: "not_collected", sourceSnapshotId: "snapshot_in_primary" },
    ];
    expect(selectCalculationInputs("provisional", inputs)).toHaveLength(2);
    expect(selectCalculationInputs("certified", inputs)).toEqual([inputs[1]]);
  });
});
