import { describe, expect, it } from "vitest";

import { qualifiedSource, verifiedReceipt } from "./fixtures/qualified-source";
import type { IntakeDecision, SourceDefinition } from "./nationwide-intake";
import { assessRawIntake } from "./nationwide-intake";
import { assessSnapshot, reviewSourceDefinition } from "./source-review";

const codes = (review: { issues: readonly { code: string }[] }) => review.issues.map((issue) => issue.code);
const withField = (patch: Record<string, unknown>) => ({ ...qualifiedSource(), ...patch }) as SourceDefinition;
const accepted: IntakeDecision = { disposition: "accepted", issues: [] };
const rowFault = assessRawIntake({ sourceKey: "state-election-authority:IN", snapshotId: "snapshot_synthetic", payloadSha256: "c".repeat(64), payloadLocator: "../escape", sourceNaturalKey: "IN:2024:HD-01", kind: "result", observedAt: "2026-08-21T00:00:00Z", payload: { contest: "HD-01" } });
const systemic = (code: string): IntakeDecision => ({ disposition: "quarantined", issues: [{ code, diagnostic: code }] });

describe("reviewSourceDefinition", () => {
  it("reviews the synthetic qualified source and a valid draft", () => {
    expect(reviewSourceDefinition(qualifiedSource())).toEqual({ status: "reviewed", issues: [] });
    expect(reviewSourceDefinition(withField({ status: "draft" })).status).toBe("reviewed");
  });

  it("rejects incomplete definitions with one issue per fault", () => {
    expect(codes(reviewSourceDefinition(withField({ authorityScope: [] })))).toEqual(["AUTHORITY_SCOPE_EMPTY"]);
    expect(codes(reviewSourceDefinition(withField({ retentionBasis: null })))).toEqual(["RETENTION_BASIS_MISSING"]);
    expect(codes(reviewSourceDefinition(withField({ allowedKinds: [] })))).toEqual(["ALLOWED_KINDS_INVALID"]);
    expect(codes(reviewSourceDefinition(withField({ allowedKinds: ["result", "result"] })))).toEqual(["ALLOWED_KINDS_INVALID"]);
    expect(codes(reviewSourceDefinition(withField({ precedence: 0 })))).toEqual(["PRECEDENCE_INVALID"]);
    expect(codes(reviewSourceDefinition(withField({ sourceUrl: "http://elections.synthetic.example/results" })))).toEqual(["SOURCE_URL_NOT_HTTPS"]);
    expect(codes(reviewSourceDefinition(withField({ sourceUrl: "not a url" })))).toEqual(["SOURCE_URL_NOT_HTTPS"]);
    expect(codes(reviewSourceDefinition(withField({ id: " ", sourceKey: "", stateCode: "ZZ", family: "results", authorityTier: "national_discovery" })))).toEqual(["SOURCE_ID_MISSING", "STATE_CODE_INVALID", "SOURCE_FAMILY_INVALID", "SOURCE_KEY_MISSING", "AUTHORITY_TIER_INVALID"]);
  });

  it("rejects unreviewed finance and closed statuses", () => {
    expect(codes(reviewSourceDefinition(withField({ family: "finance", privacyPolicy: "finance_allowlist" })))).toEqual(["FINANCE_ALLOWLIST_UNREVIEWED"]);
    expect(codes(reviewSourceDefinition(withField({ family: "finance" })))).toEqual(["FINANCE_POLICY_MISMATCH"]);
    expect(codes(reviewSourceDefinition(withField({ privacyPolicy: "open" })))).toEqual(["PRIVACY_POLICY_INVALID"]);
    expect(codes(reviewSourceDefinition(withField({ status: "rejected" })))).toEqual(["SOURCE_STATUS_CLOSED"]);
    expect(codes(reviewSourceDefinition(withField({ status: "retired" })))).toEqual(["SOURCE_STATUS_CLOSED"]);
  });
});

describe("assessSnapshot", () => {
  const base = { source: qualifiedSource(), expectedParserVersion: "synthetic-results-v1" };

  it("accepts a verified receipt from the reviewed source with no row faults", () => {
    expect(assessSnapshot({ ...base, receipts: [verifiedReceipt()], recordDecisions: [accepted, accepted] })).toEqual({ disposition: "accepted", issues: [], quarantinedRowCount: 0 });
    expect(assessSnapshot({ receipts: [verifiedReceipt()], recordDecisions: [] }).disposition).toBe("accepted");
  });

  it("quarantines only the row for an isolated malformed record", () => {
    expect(rowFault.disposition).toBe("quarantined");
    expect(assessSnapshot({ ...base, receipts: [verifiedReceipt()], recordDecisions: [accepted, rowFault] })).toEqual({ disposition: "accepted_with_row_quarantine", issues: [], quarantinedRowCount: 1 });
  });

  it("quarantines the snapshot on missing, unverified, or malformed receipts", () => {
    expect(assessSnapshot({ ...base, receipts: [], recordDecisions: [accepted] })).toMatchObject({ disposition: "quarantined", issues: [{ code: "RECEIPT_MISSING" }] });
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), verified: false }], recordDecisions: [] }))).toEqual(["RECEIPT_UNVERIFIED"]);
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), sha256: "zz" }], recordDecisions: [] }))).toEqual(["RECEIPT_INVALID"]);
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), locator: "/abs/path" }], recordDecisions: [] }))).toEqual(["RECEIPT_INVALID"]);
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), byteSize: 0 }], recordDecisions: [] }))).toEqual(["RECEIPT_INVALID"]);
  });

  it("quarantines on authority mismatch, draft source, and parser drift", () => {
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), sourceId: "src_other" }], recordDecisions: [] }))).toEqual(["SOURCE_AUTHORITY_MISMATCH"]);
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), finalUrl: "https://mirror.synthetic.example/results" }], recordDecisions: [] }))).toEqual(["SOURCE_AUTHORITY_MISMATCH"]);
    expect(codes(assessSnapshot({ ...base, source: withField({ status: "draft" }), receipts: [verifiedReceipt()], recordDecisions: [] }))).toEqual(["SOURCE_NOT_REVIEWED"]);
    expect(codes(assessSnapshot({ ...base, receipts: [{ ...verifiedReceipt(), parserVersion: "synthetic-results-v2" }], recordDecisions: [] }))).toEqual(["PARSER_DRIFT"]);
    expect(assessSnapshot({ receipts: [verifiedReceipt()], recordDecisions: [accepted, systemic("PARSER_DRIFT")] })).toMatchObject({ disposition: "quarantined", quarantinedRowCount: 1 });
  });

  it("quarantines on reconciliation failure or certification ambiguity even when other rows are fine", () => {
    for (const code of ["RECONCILIATION_FAILED", "CERTIFICATION_AMBIGUOUS"]) {
      const assessment = assessSnapshot({ ...base, receipts: [verifiedReceipt()], recordDecisions: [accepted, rowFault, systemic(code)] });
      expect(assessment).toMatchObject({ disposition: "quarantined", quarantinedRowCount: 2 });
      expect(codes(assessment)).toEqual([code]);
    }
  });
});
