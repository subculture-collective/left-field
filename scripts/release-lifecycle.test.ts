import { describe, expect, it, vi } from "vitest";
import { executeReleaseLifecycle, parseReleaseLifecycleArguments, releaseLifecyclePoolConfigs } from "./release-lifecycle";

const env = { INGEST_DATABASE_URL: "postgres://ingest:x@localhost/db", RELEASE_PREFLIGHT_DATABASE_URL: "postgres://preflight:x@localhost/db", RELEASE_OPERATOR_DATABASE_URL: "postgres://operator:x@localhost/db" };
const runs = (count: number): string[] => Array.from({ length: count }, (_, index) => `run_${index}`);
const proofArgs = (runIds = runs(158), lockIds = ["entry_a"]): string[] => ["promote", "--release", "rel_target", ...runIds.flatMap(id => ["--task9-run", id]), "--election-source-release", "rel_source", ...lockIds.flatMap(id => ["--election-lock-entry", id])];
const store = () => ({ read: vi.fn(), put: vi.fn() });

describe("release lifecycle CLI", () => {
  it("strictly separates rollback and absent proof from proof inputs", () => {
    expect(parseReleaseLifecycleArguments(["rollback"])).toEqual({ operation: "rollback", task9RunIds: [], electionLockEntryIds: [] });
    expect(() => parseReleaseLifecycleArguments(["rollback", "--release", "rel_x"])).toThrow();
    expect(() => parseReleaseLifecycleArguments(["promote", "--release", "wrong"])).toThrow();
    expect(() => parseReleaseLifecycleArguments(["promote", "--release", "rel_x", "--task9-run", "run_1"])).toThrow();
    expect(() => parseReleaseLifecycleArguments(["promote", "--release", "rel_x", "--election-source-release", "rel_source"])).toThrow();
    expect(() => parseReleaseLifecycleArguments(["promote", "--release", "rel_x", "--election-lock-entry", "entry_a"])).toThrow();
  });

  it("requires exactly 158 unique runs and 1..1024 valid unique lock IDs", () => {
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(157)))).toThrow();
    expect(parseReleaseLifecycleArguments(proofArgs())).toMatchObject({ task9RunIds: runs(158), electionLockEntryIds: ["entry_a"] });
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(159)))).toThrow();
    expect(() => parseReleaseLifecycleArguments(proofArgs([...runs(157), "run_0"]))).toThrow();
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(158), []))).toThrow();
    expect(parseReleaseLifecycleArguments(proofArgs(runs(158), Array.from({ length: 1024 }, (_, index) => `entry_${index}`)))).toBeDefined();
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(158), Array.from({ length: 1025 }, (_, index) => `entry_${index}`)))).toThrow();
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(158), ["entry_a", "entry_a"]))).toThrow();
    expect(() => parseReleaseLifecycleArguments(proofArgs(runs(158), ["bad id"]))).toThrow();
    expect(() => parseReleaseLifecycleArguments(proofArgs().map(value => value === "rel_source" ? "rel_target" : value))).toThrow();
  });

  it("uses only the three explicit capability pools", () => {
    const bounds = { max: 3, connectionTimeoutMillis: 5_000, query_timeout: 120_000, statement_timeout: 120_000, lock_timeout: 5_000, idleTimeoutMillis: 30_000 };
    expect(releaseLifecyclePoolConfigs({ ...env, DATABASE_URL: "postgres://owner:secret@localhost/db" })).toEqual({ ingest: { connectionString: env.INGEST_DATABASE_URL, ...bounds }, preflight: { connectionString: env.RELEASE_PREFLIGHT_DATABASE_URL, ...bounds }, operator: { connectionString: env.RELEASE_OPERATOR_DATABASE_URL, ...bounds } });
  });

  it("passes only named configured entries in deterministic byte order", async () => {
    const pools = [0, 1, 2].map(() => ({ end: vi.fn().mockResolvedValue(undefined) })); const createPool = vi.fn(() => pools.shift()!);
    const promote = vi.fn().mockResolvedValue(undefined); const verifySourceLock = vi.fn().mockResolvedValue({ sha256: "a".repeat(64), lock: { entries: [{ id: "entry_z", url: "https://example.test/z", sha256: "b".repeat(64), byteSize: 1 }, { id: "entry_a", url: "https://example.test/a", sha256: "c".repeat(64), byteSize: 2 }, { id: "unselected", url: "https://example.test/u", sha256: "d".repeat(64), byteSize: 3 }] } });
    await executeReleaseLifecycle(proofArgs(runs(158), ["entry_z", "entry_a"]), env, { createPool, promote, verifySourceLock, createRawStore: store, createMapStore: vi.fn() });
    expect(promote).toHaveBeenCalledOnce();
    expect(promote.mock.calls[0]?.[3]).toMatchObject({ sourceReleaseId: "rel_source", runIds: runs(158), sourceLockEntries: [{ id: "entry_a", url: "https://example.test/a", sha256: "c".repeat(64), byteSize: 2 }, { id: "entry_z", url: "https://example.test/z", sha256: "b".repeat(64), byteSize: 1 }] });
    expect(createPool).toHaveBeenCalledTimes(3);
  });

  it("rejects missing or duplicate configured selected entries", async () => {
    const createPool = vi.fn(() => ({ end: vi.fn().mockResolvedValue(undefined) }));
    const dependencies = { createPool, promote: vi.fn().mockResolvedValue(undefined), verifySourceLock: vi.fn().mockResolvedValue({ sha256: "a".repeat(64), lock: { entries: [{ id: "entry_a", url: "https://example.test/a", sha256: "b".repeat(64), byteSize: 1 }, { id: "entry_a", url: "https://example.test/a2", sha256: "c".repeat(64), byteSize: 2 }] } }), createRawStore: store, createMapStore: vi.fn() };
    await expect(executeReleaseLifecycle(proofArgs(), env, dependencies)).rejects.toThrow("Require promote");
    dependencies.verifySourceLock.mockResolvedValueOnce({ sha256: "a".repeat(64), lock: { entries: [] } });
    await expect(executeReleaseLifecycle(proofArgs(), env, dependencies)).rejects.toThrow("Require promote");
  });
});
