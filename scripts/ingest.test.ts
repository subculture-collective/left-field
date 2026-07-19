import { describe, expect, it, vi } from "vitest";
import { executeIngest, parseIngestArguments } from "./ingest";

describe("ingest CLI", () => {
  it("parses every supported source and rejects duplicate or unknown flags", () => {
    for (const source of ["identity", "tiger", "acs", "fec", "elections"]) expect(parseIngestArguments(["--source", source, "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"])).toMatchObject({ source, dryRun: true });
    expect(() => parseIngestArguments(["--source", "identity", "--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01"])).toThrow();
    expect(() => parseIngestArguments(["--wat"])).toThrow();
  });
  it("uses injected dependencies, does not create a pool for unavailable adapters, and only enforces configuration for production writes", async () => {
    const runner = vi.fn(); const getPool = vi.fn(() => ({}));
    await executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: {} as NodeJS.ProcessEnv, getPool: getPool as never, registry: { identity: runner } });
    expect(runner).toHaveBeenCalled();
    await expect(executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01"], { env: { NODE_ENV: "production" }, getPool: getPool as never })).rejects.toThrow("Production ingestion");
    await expect(executeIngest(["--source", "tiger", "--release", "rel_a", "--cutoff", "2025-01-01"], { env: { NODE_ENV: "development" }, getPool: getPool as never })).rejects.toThrow("Adapter not implemented");
    expect(getPool).toHaveBeenCalledTimes(1);
  });
});
