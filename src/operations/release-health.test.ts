import { describe, expect, it, vi } from "vitest";

import { aggregateReleaseHealth, inspectReleaseHealth, isVerifiedRollbackDrillEvidence, type ReleaseHealthCheck } from "./release-health";

const verifiedDrill = { evidenceClass: "local-synthetic", evidenceVersion: 2, verified: true, durationMs: 12, completedAt: new Date().toISOString(), publishedReleaseId: "rel_drill", domains: 7, publicSmokes: 3, operationalSignals: 21, checks: { roleAttestations: true, stalePromotionRejected: true, writerFreezeRejected: true, expiredProofRejected: true, domainInvalidations: ["member", "acs", "finance", "elections", "maps"], immutableFingerprintPreserved: true, rollbackPreserved: true, rollForwardPreserved: true, rollbackPublicSmoke: true, rollForwardPublicSmoke: true, operationalSignalsObserved: true, consumedProofs: 4, ingestHistoryRows: 1, digestRows: 21 } };

const passingRow = (sql: string) => {
  if (sql.includes("pg_auth_members")) return { restricted: true };
  if (sql.includes("total_seats")) return { total_seats: 541, voting_house: 435, delegates: 5, resident_commissioner: 1, senate: 100, senate_class_1: 33, senate_class_2: 33, senate_class_3: 34, vacancies: 4, special_election_seats: 2, jurisdictions: 56, source_cutoff_present: 1 };
  if (sql.includes("house_geometries")) return { geometries: 497, house_geometries: 441, jurisdiction_geometries: 56, invalid: 0 };
  if (sql.includes("review_required")) return { sources: 2, snapshots: 2, approved: 1, restricted: 1, review_required: 0 };
  if (sql.includes("coverage_records")) return { coverage_records: 7, quarantined: 0 };
  if (sql.includes("current_runs")) return { running: 0, failed: 0 };
  return {};
};

function pool(failure?: Error, restricted = true) {
  const client = { query: vi.fn(async (sql: string) => { if (failure && sql.includes("coverage_records")) throw failure; return { rows: [sql.includes("pg_auth_members") ? { restricted } : passingRow(sql)], rowCount: 1 }; }), release: vi.fn() };
  return { pool: { connect: vi.fn().mockResolvedValue(client) }, client };
}

describe("release health", () => {
  it("uses one repeatable-read read-only snapshot and emits no write or row-lock SQL", async () => {
    const fixture = pool();
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe", { rollbackDrill: verifiedDrill as never });
    const sql = fixture.client.query.mock.calls.map(([statement]) => statement as string);
    expect(sql[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(sql[1]).toBe("SET LOCAL statement_timeout = '60000ms'");
    expect(sql).toContain("COMMIT");
    expect(sql.join("\n")).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|FOR\s+(?:UPDATE|SHARE))\b/i);
    expect(report.evidenceClass).toBe("local-postgres");
    expect(report.checks.find((item) => item.name === "production_telemetry")).toEqual(expect.objectContaining({ status: "not_run", evidence: { status: "not_observed" } }));
  });

  it("does not aggregate blocked or not-run checks to green", () => {
    const base = { name: "universe", evidence: {} } as const;
    expect(aggregateReleaseHealth([{ ...base, status: "pass" }, { ...base, status: "blocked" }] as ReleaseHealthCheck[])).toBe("blocked");
    expect(aggregateReleaseHealth([{ ...base, status: "pass" }, { ...base, status: "not_run" }] as ReleaseHealthCheck[])).toBe("not_run");
    expect(aggregateReleaseHealth([])).toBe("fail");
    expect(aggregateReleaseHealth([{ ...base, status: "unknown" }] as never)).toBe("fail");
  });

  it("uses only current release/source/snapshot ingestion attempts", async () => {
    const fixture = pool();
    await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    const ingestionSql = fixture.client.query.mock.calls.map(([statement]) => statement as string).find(sql => sql.includes("current_runs"));
    expect(ingestionSql).toContain("DISTINCT ON (source_id,snapshot_id)");
    expect(ingestionSql).toContain("started_at DESC,id DESC");
    expect(ingestionSql).toContain("snapshot_id IS NOT NULL");
  });

  it("records the complete nationwide universe and geometry without a Cartesian join", async () => {
    const fixture = pool();
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    const universeSql = fixture.client.query.mock.calls.map(([statement]) => statement as string).find(sql => sql.includes("total_seats"))!;
    expect(universeSql).not.toMatch(/CROSS\s+JOIN/i);
    expect(universeSql).toContain("o.id=sc.office_id");
    expect(report.checks.find(item => item.name === "universe")).toEqual(expect.objectContaining({ status: "pass", evidence: { totalSeats: 541, votingHouse: 435, delegates: 5, residentCommissioner: 1, senate: 100, senateClass1: 33, senateClass2: 33, senateClass3: 34, vacancies: 4, specialElectionSeats: 2, jurisdictions: 56, sourceCutoffPresent: 1 } }));
    expect(report.checks.find(item => item.name === "geometry")).toEqual(expect.objectContaining({ status: "pass", evidence: { geometries: 497, houseGeometries: 441, jurisdictionGeometries: 56, invalid: 0 } }));
  });

  it("rejects forged, stale, and wrong-release rollback evidence", () => {
    expect(isVerifiedRollbackDrillEvidence({ verified: true, durationMs: 12 })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, checks: { ...verifiedDrill.checks, rollbackPreserved: false } })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence(verifiedDrill)).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, checks: { ...verifiedDrill.checks, consumedProofs: 3 } })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, checks: { ...verifiedDrill.checks, digestRows: 20 } })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, publicSmokes: 2 })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, durationMs: 0 })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence({ ...verifiedDrill, completedAt: new Date(Date.now() - 600_001).toISOString() })).toBe(false);
    expect(isVerifiedRollbackDrillEvidence(verifiedDrill, "rel_other")).toBe(false);
  });

  it("bounds output and suppresses database failure text", async () => {
    const fixture = pool(new Error("postgres://secret.example/object-key?token=leak"));
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    const rendered = JSON.stringify(report);
    expect(rendered).not.toContain("secret.example");
    expect(rendered).not.toContain("object-key");
    expect(report.checks.find((item) => item.name === "coverage_quarantine")?.status).toBe("fail");
    expect(report.checks.find((item) => item.name === "rollback_drill")?.status).toBe("blocked");
  });

  it("fails without emitting principal details when the session is not the restricted preflight principal", async () => {
    const fixture = pool(undefined, false);
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    expect(report.status).toBe("fail");
    expect(report.checks.find((item) => item.name === "preflight_access")).toEqual({ name: "preflight_access", status: "fail", evidence: { restricted: 0 } });
    expect(JSON.stringify(report)).not.toMatch(/session_user|rolname|membership/i);
    expect(report.checks.map(item => item.name)).toEqual(["preflight_access", "universe", "geometry", "source_provenance", "coverage_quarantine", "ingestion", "validation_gate", "repository_smokes", "rollback_drill", "production_telemetry", "launch_blockers"]);
    expect(new Set(report.checks.map(item => item.name)).size).toBe(report.checks.length);
    expect(report.checks.find(item => item.name === "validation_gate")?.status).toBe("not_run");
  });

  it("leaves database checks not_run after a transaction setup failure without duplicating a validation failure", async () => {
    const client = { query: vi.fn(async (sql: string) => { if (sql.startsWith("BEGIN")) throw new Error("transaction unavailable"); return { rows: [], rowCount: 0 }; }), release: vi.fn() };
    const report = await inspectReleaseHealth({ connect: vi.fn().mockResolvedValue(client) } as never, "rel_safe");
    expect(report.checks).toHaveLength(11);
    expect(new Set(report.checks.map(item => item.name)).size).toBe(11);
    expect(report.checks.slice(0, 8).every(item => item.status === "not_run")).toBe(true);
  });

  it("fails every repository check when the read-only transaction cannot commit", async () => {
    const fixture = pool();
    fixture.client.query.mockImplementation(async (sql: string) => {
      if (sql === "COMMIT") throw new Error("commit unavailable");
      return { rows: [passingRow(sql)], rowCount: 1 };
    });
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    expect(report.repositoryStatus).toBe("fail");
    expect(report.checks.slice(0, 8).every(item => item.status === "fail")).toBe(true);
  });

  it("reports restricted provenance without treating it as invalid evidence", async () => {
    const fixture = pool();
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    expect(report.checks.find((item) => item.name === "source_provenance")).toEqual(expect.objectContaining({
      status: "pass", evidence: expect.objectContaining({ approved: 1, restricted: 1, reviewRequired: 0 }),
    }));
  });

  it("marks the aggregate launch-blocker check blocked while retaining individual causes", async () => {
    const fixture = pool();
    const report = await inspectReleaseHealth(fixture.pool as never, "rel_safe");
    expect(report.checks.find((item) => item.name === "launch_blockers")?.status).toBe("blocked");
    expect(report.status).not.toBe("pass");
  });
});
