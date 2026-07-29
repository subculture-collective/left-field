import { describe, expect, it, vi } from "vitest";
import { assertFecV2Role, FecV2AcquisitionPersistence, FecV2ReplayVerifierPersistence, lockFecV2Orchestration, unlockFecV2Orchestration } from "./persistence-v2";

describe("FEC V2 acquisition persistence", () => {
  it("finalizes a staged snapshot through the fenced SQL API only", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const persistence = new FecV2AcquisitionPersistence({ query } as never, "release", "plan", "run", "token");

    await persistence.finalizeStagedSnapshot("snapshot");

    expect(query).toHaveBeenCalledWith("SELECT public.finalize_fec_v2_staged_snapshot($1,$2,$3,$4,$5)", ["release", "plan", "run", "token", "snapshot"]);
  });
});

describe("FEC V2 replay verifier persistence", () => {
  it("can only read the exact staged commitment and issue its attestation", async () => {
    const graph = "a".repeat(64), descriptor = "b".repeat(64), transcript = "c".repeat(64);
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ acquisition_graph_sha256: graph, descriptor_sha256: descriptor, descriptor: "{}\n" }] })
      .mockResolvedValueOnce({ rows: [{ issue_fec_v2_replay_attestation: "attestation" }] });
    const verifier = new FecV2ReplayVerifierPersistence({ query } as never, "release", "plan", "run");

    await expect(verifier.stagedCommitment()).resolves.toEqual({ acquisitionGraphSha256: graph, descriptorSha256: descriptor, descriptor: "{}\n" });
    await expect(verifier.issueStagedPromotionAttestation(graph, descriptor, transcript)).resolves.toBe("attestation");
    expect(query).toHaveBeenNthCalledWith(1, "SELECT * FROM public.read_fec_v2_staged_acquisition_commitment($1,$2,$3)", ["release", "plan", "run"]);
    expect(query).toHaveBeenNthCalledWith(2, "SELECT public.issue_fec_v2_replay_attestation($1,$2,$3,$4,$5,$6,$7)", ["release", "plan", "run", "staged_promotion", graph, descriptor, transcript]);
  });
});

describe("FEC V2 safe descriptor boundaries", () => {
  it("uses the database admission routine and parses only canonical bigint text", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ receipt_id: "r", artifact_sha256: "a".repeat(64), artifact_kind: "filing_ledger", canonical_byte_size: "12", upstream_entity_sha256: null, object_key: "k", version_id: "v", etag: "e", byte_size: "12", retrieved_at: "2026-01-01T00:00:00.000Z", snapshot_id: "s" }] });
    const verifier = new FecV2ReplayVerifierPersistence({ query } as never, "release", "plan", "run");
    await assertFecV2Role({ query } as never, "dsa_seats_fec_v2_replay_verifier");
    await expect(verifier.stagedReceiptDescriptors()).resolves.toMatchObject([{ canonicalByteSize: 12, byteSize: 12 }]);
    expect(query).toHaveBeenCalledWith("SELECT public.assert_fec_v2_replay_verifier_admission()");
  });
});

describe("FEC V2 lifecycle persistence", () => {
  it("reads only a token-free active candidate with exact timestamps", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ run_id: "old", status: "running", lease_expires_at: "2026-01-01T00:00:00Z", run_deadline_at: "2026-01-01T01:00:00Z" }] });
    const persistence = new FecV2AcquisitionPersistence({ query } as never, "release", "a".repeat(64), "run", "b".repeat(64));
    await expect(persistence.activeRunCandidate()).resolves.toEqual({ runId: "old", status: "running", leaseExpiresAt: "2026-01-01T00:00:00Z", runDeadlineAt: "2026-01-01T01:00:00Z" });
    expect(query).toHaveBeenCalledWith("SELECT * FROM public.read_fec_v2_active_run_candidate($1,$2)", ["release", "a".repeat(64)]);
  });

  it("holds and verifies the session orchestration lock", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
    await lockFecV2Orchestration({ query } as never, "release", "a".repeat(64));
    await unlockFecV2Orchestration({ query } as never, "release", "a".repeat(64));
    expect(query.mock.calls[0]![0]).toContain("pg_advisory_lock");
    expect(query.mock.calls[1]![0]).toContain("pg_advisory_unlock");
  });

  it("rejects an unlock that did not belong to the session", async () => {
    await expect(unlockFecV2Orchestration({ query: vi.fn().mockResolvedValue({ rows: [{ pg_advisory_unlock: false }] }) } as never, "release", "a".repeat(64))).rejects.toThrow("FEC_V2_ORCHESTRATION_UNLOCK_FAILED");
  });
});
