import { describe, expect, it, vi } from "vitest";
import { defaultRegistry, executeIngest, main, parseIngestArguments } from "./ingest";

describe("ingest CLI", () => {
  it("parses every supported source and rejects duplicate or unknown flags", () => {
    for (const source of ["identity", "tiger", "acs", "fec", "elections"]) expect(parseIngestArguments(["--source", source, "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"])).toMatchObject({ source, dryRun: true });
    expect(() => parseIngestArguments(["--source", "identity", "--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01"])).toThrow();
    expect(() => parseIngestArguments(["--wat"])).toThrow();
  });
  it("registers ACS and FEC while leaving elections unavailable", () => {
    const registry = defaultRegistry({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(registry.acs).toBeTypeOf("function"); expect(registry.fec).toBeTypeOf("function"); expect(registry.elections).toBeUndefined();
  });
  it("uses injected dependencies, requires staging mode, and does not create a pool for unavailable sources", async () => {
    const runner = vi.fn().mockResolvedValue({ runIds: ["run_new"], reusedRunIds: [] }); const getPool = vi.fn(() => ({}));
    await executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: {} as NodeJS.ProcessEnv, getPool: getPool as never, registry: { identity: runner } });
    expect(runner).toHaveBeenCalled();
    await expect(executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01"], { env: { NODE_ENV: "production" }, getPool: getPool as never, registry: { identity: runner } })).rejects.toThrow("only stages");
    await expect(executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: { NODE_ENV: "production", RAW_OBJECT_BUCKET: "raw", DATABASE_URL: "postgres://secret" }, getPool: getPool as never, registry: { identity: runner } })).rejects.toThrow("SOURCE_LOCK_SHA256");
    await expect(executeIngest(["--source", "elections", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: { NODE_ENV: "development" }, getPool: getPool as never })).rejects.toThrow("unavailable");
    expect(getPool).toHaveBeenCalledTimes(1);
  });
  it("routes FEC before generic dry-run rejection without creating the generic pool", async () => {
    const fec = vi.fn().mockResolvedValue({ runIds: ["run_fec"], reusedRunIds: [] }), getPool = vi.fn(() => ({}));
    await expect(executeIngest(["--source", "fec", "--release", "rel_a", "--cutoff", "2026-07-18"], { env: {} as NodeJS.ProcessEnv, getPool: getPool as never, registry: { fec } })).resolves.toMatchObject({ runIds: ["run_fec"] });
    expect(fec).toHaveBeenCalledTimes(1); expect(getPool).not.toHaveBeenCalled();
  });
  it("returns and writes stable handoff JSON including reused validated runs", async () => {
    const runner = vi.fn().mockResolvedValue({ runIds: ["run_new"], reusedRunIds: ["run_reused"] });
    const result = await executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: {} as NodeJS.ProcessEnv, getPool: (() => ({})) as never, registry: { identity: runner } });
    expect(result).toEqual({ source: "identity", release: "rel_a", runIds: ["run_new"], reusedRunIds: ["run_reused"], finalizationRunIds: ["run_new", "run_reused"] });
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await main(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], {} as NodeJS.ProcessEnv, { getPool: (() => ({})) as never, registry: { identity: runner } });
    expect(write).toHaveBeenCalledWith('{"source":"identity","release":"rel_a","runIds":["run_new"],"reusedRunIds":["run_reused"],"finalizationRunIds":["run_new","run_reused"]}\n');
    write.mockRestore();
  });
  it("does not expose environment secrets in configuration errors", async () => {
    await expect(executeIngest(["--source", "identity", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], { env: { NODE_ENV: "production", DATABASE_URL: "postgres://secret" }, getPool: (() => ({})) as never, registry: { identity: vi.fn() } })).rejects.not.toThrow("postgres://secret");
  });
  it("writes nothing and creates no pool when an adapter is unavailable", async () => {
    const getPool = vi.fn(() => ({})); const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await expect(main(["--source", "acs", "--release", "rel_a", "--cutoff", "2025-01-01", "--dry-run"], {} as NodeJS.ProcessEnv, { getPool: getPool as never })).rejects.toThrow("unavailable");
    expect(getPool).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});
