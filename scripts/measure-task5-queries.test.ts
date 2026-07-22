import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertEvidenceContract, closureMeasurementValues, queryEvidenceMode, writeOrVerifyEvidence } from "./measure-task5-queries";
import { __sql } from "@/repositories/sql/get-seat-profile";

describe("Task 5 query measurement", () => {
  it("accepts only snapshot seeds collected from a complete profile, never a seat scalar", () => {
    expect(closureMeasurementValues("rel_safe", { snapshots: [{ snapshotId: "snap_profile" }], finance: { artifactSnapshotId: "snap_finance" } })).toEqual(["rel_safe", ["snap_finance", "snap_profile"]]);
    expect(() => closureMeasurementValues("rel_safe", "seat_house_ca_01")).toThrow("closure snapshot seeds");
  });

  it("keeps closure measurement scoped to snapshot derivation rather than broad entities", () => {
    expect(__sql.CLOSURE_SQL).toContain("unnest($2::text[])");
    expect(__sql.CLOSURE_SQL).not.toMatch(/\b(?:provenance|contests|coverage_records|seat_cycles)\b/);
  });

  it("defaults evidence mode to write and rejects unknown modes", () => {
    expect(queryEvidenceMode()).toBe("write");
    expect(queryEvidenceMode("verify")).toBe("verify");
    expect(() => queryEvidenceMode("replace")).toThrow("write or verify");
  });

  it("pins the exact hash and getSeatProfile statement contract", () => {
    const contract = { schemaVersion: 1, label: "SYNTHETIC query-shape evidence; not semantic validation or production benchmarking.", rowCounts: { acsObservations: 100_000, acsObservationLineage: 100_000, seats: 541 }, budgets: { statementTimeoutMs: 15_000, listP95Ms: 2_000, profileP95Ms: 8_000, browseMaxRows: 51, listJoinMaxRows: 541, denseProfileMaxFacts: 5_200 }, sourceHashes: { profileSqlSha256: "3cb2c5cbc23a0cea5cd544674a6af94d4ec95823a834444b7e4133fafd7332b2", closureSqlSha256: "51169c6c7efa9a89f0de3cf69f2c2d68e8155415e69c357737983d6f5b792c0c" }, statementCounts: { getSeatProfile: 10 }, closureSeedCount: 1 };
    expect(() => assertEvidenceContract({ ...contract, statementCounts: { getSeatProfile: 9 } }, contract)).toThrow("statementCounts");
    expect(() => assertEvidenceContract({ ...contract, sourceHashes: { ...contract.sourceHashes, profileSqlSha256: "stale" } }, contract)).toThrow("sourceHashes");
    assertEvidenceContract(contract, contract);
  });

  it("verifies without rewriting generated evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "query-evidence-"));
    const path = join(directory, "evidence.json");
    const evidence = { schemaVersion: 1, label: "SYNTHETIC query-shape evidence; not semantic validation or production benchmarking.", rowCounts: { acsObservations: 100_000, acsObservationLineage: 100_000, seats: 541 }, budgets: { statementTimeoutMs: 15_000, listP95Ms: 2_000, profileP95Ms: 8_000, browseMaxRows: 51, listJoinMaxRows: 541, denseProfileMaxFacts: 5_200 }, sourceHashes: { profileSqlSha256: "profile-hash", closureSqlSha256: "closure-hash" }, statementCounts: { getSeatProfile: 10 }, closureSeedCount: 1, generatedAt: "old", timings: { preserved: true }, plans: { preserved: true } };
    try {
      await writeFile(path, `${JSON.stringify(evidence)}\n`);
      const before = await readFile(path, "utf8");
      await writeOrVerifyEvidence("verify", evidence, path);
      expect(await readFile(path, "utf8")).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
