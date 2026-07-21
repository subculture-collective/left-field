import { describe, expect, it, vi } from "vitest";

import { assertElectionDecisionEvidencePolicy, finalizeCandidateElectionDecisions, verifyPersistedTask9ElectionCandidate } from "./finalize-elections";
import type { ElectionDecisionEnvelopeV1 } from "./decision-envelope";

const sha = "a".repeat(64);
const options = () => {
  const connect = vi.fn();
  return ({
  pool: { connect } as never,
  rawStore: {} as never,
  candidateReleaseId: "release_candidate",
  sourceReleaseId: "release_source",
  runIds: ["run_1"],
  sourceLockSha256: sha,
  sourceLockEntries: [{ id: "evidence_1", url: "https://example.test/evidence.json", sha256: sha, byteSize: 1 }],
  connect,
}); };

describe("Task 9 election finalizer input contract", () => {
  it("rejects duplicate run IDs before opening a connection", async () => {
    const value = options();
    await expect(finalizeCandidateElectionDecisions({ ...value, runIds: ["run_1", "run_1"] })).rejects.toThrow("ELECTION_FINALIZE_INPUT_INVALID");
    expect(value.connect).not.toHaveBeenCalled();
  });

  it("rejects an inexact source lock before persisted verification", async () => {
    const value = options();
    await expect(verifyPersistedTask9ElectionCandidate({ ...value, sourceLockEntries: [{ ...value.sourceLockEntries[0]!, sha256: "bad" }] })).rejects.toThrow("ELECTION_FINALIZE_INPUT_INVALID");
    expect(value.connect).not.toHaveBeenCalled();
  });

  it("enforces the 158-run nationwide cohort bound", async () => {
    const value = options();
    await expect(finalizeCandidateElectionDecisions({ ...value, runIds: Array.from({ length: 159 }, (_, index) => `run_${index}`) })).rejects.toThrow("ELECTION_FINALIZE_INPUT_INVALID");
    expect(value.connect).not.toHaveBeenCalled();
  });

  it("confines restricted evidence to a decisive licensing failure", () => {
    const passed = (evidenceSnapshotIds: string[]) => ({ outcome: "passed" as const, evidenceSnapshotIds, value: {}, failureReason: null });
    const unassessed = { outcome: "unassessed" as const, evidenceSnapshotIds: [], value: null, failureReason: null };
    const envelope = { decision: { gates: {
      sourceAuthority: passed(["snap_source"]),
      license: { outcome: "failed" as const, evidenceSnapshotIds: ["snap_license"], value: {}, failureReason: "license_unavailable" as const },
      certification: unassessed, reportingUnitGeometry: unassessed, nonGeographicPolicy: unassessed, allocation: unassessed, reconciliation: unassessed, rounding: unassessed, coverage: unassessed,
    } } } as unknown as ElectionDecisionEnvelopeV1;
    expect(assertElectionDecisionEvidencePolicy(envelope, [{ id: "snap_source", usageStatus: "approved" }, { id: "snap_license", usageStatus: "restricted" }])).toBe("unavailable");
    const reused = structuredClone(envelope) as unknown as { decision: { gates: { sourceAuthority: { evidenceSnapshotIds: string[] } } } };
    reused.decision.gates.sourceAuthority.evidenceSnapshotIds.push("snap_license");
    expect(() => assertElectionDecisionEvidencePolicy(reused as unknown as ElectionDecisionEnvelopeV1, [{ id: "snap_source", usageStatus: "approved" }, { id: "snap_license", usageStatus: "restricted" }])).toThrow("ELECTION_FINALIZE_EVIDENCE_INVALID");
    const earlierFailure = structuredClone(envelope) as unknown as { decision: { gates: { sourceAuthority: { outcome: string; value: unknown; failureReason: string } } } };
    earlierFailure.decision.gates.sourceAuthority = { outcome: "failed", value: {}, failureReason: "source_not_authoritative" };
    expect(() => assertElectionDecisionEvidencePolicy(earlierFailure as unknown as ElectionDecisionEnvelopeV1, [{ id: "snap_source", usageStatus: "approved" }, { id: "snap_license", usageStatus: "restricted" }])).toThrow("ELECTION_FINALIZE_EVIDENCE_INVALID");
  });
});
