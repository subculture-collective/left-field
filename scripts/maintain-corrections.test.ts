import { describe, expect, it } from "vitest";
import { correctionMaintenancePoolConfig, executeCorrectionMaintenance, parseCorrectionMaintenanceArguments } from "./maintain-corrections";

describe("correction maintenance CLI", () => {
  it("accepts only the cleanup operation", () => {
    expect(parseCorrectionMaintenanceArguments(["cleanup"])).toEqual({ operation: "cleanup" });
    expect(() => parseCorrectionMaintenanceArguments([])).toThrow("Require cleanup operation");
    expect(() => parseCorrectionMaintenanceArguments(["cleanup", "--force"])).toThrow("Require cleanup operation");
  });

  it("uses only the dedicated maintenance connection", () => {
    expect(() => correctionMaintenancePoolConfig({ CORRECTION_DATABASE_URL: "postgresql://intake@db/app" })).toThrow("CORRECTION_MAINTENANCE_DATABASE_URL is required");
    expect(correctionMaintenancePoolConfig({ CORRECTION_MAINTENANCE_DATABASE_URL: "postgresql://maintenance@db/app" })).toMatchObject({
      connectionString: "postgresql://maintenance@db/app",
      max: 1,
    });
  });

  it("returns bounded deletion counts without correction content", async () => {
    const calls: string[] = [];
    const repository = {
      cleanup: async () => {
        calls.push("cleanup");
        return { idempotencyDeleted: 7, rateBucketsDeleted: 11 };
      },
    };
    await expect(executeCorrectionMaintenance({ operation: "cleanup" }, repository)).resolves.toEqual({
      operation: "cleanup",
      idempotencyDeleted: 7,
      rateBucketsDeleted: 11,
    });
    expect(calls).toEqual(["cleanup"]);
  });

  it("rejects malformed repository results", async () => {
    for (const result of [
      { idempotencyDeleted: -1, rateBucketsDeleted: 0 },
      { idempotencyDeleted: 0.5, rateBucketsDeleted: 0 },
      { idempotencyDeleted: 0, rateBucketsDeleted: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      await expect(executeCorrectionMaintenance({ operation: "cleanup" }, { cleanup: async () => result })).rejects.toThrow("Invalid correction maintenance result");
    }
  });
});
