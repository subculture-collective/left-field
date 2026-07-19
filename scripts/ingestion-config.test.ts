import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRawObjectStore, loadSourceLock, parseSourceLock, sourceId } from "./ingestion-config";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const entry = (changes: Record<string, unknown> = {}) => ({ id: "fixture", url: "https://example.test/fixture", retainedPath: "data/fixture.txt", retainedStatus: "retained", byteSize: 1, sha256: digest("x"), kind: "source", parentIds: [], ...changes });
const lock = (entries: readonly unknown[] = [entry()]) => Buffer.from(JSON.stringify({ version: 1, entries }));
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe("ingestion runtime configuration", () => {
  it("strictly parses version-one locks and rejects malformed entry identity", () => {
    expect(parseSourceLock(lock())).toMatchObject({ version: 1, entries: [entry()] });
    for (const invalid of [
      Buffer.from(JSON.stringify({ version: 2, entries: [entry()] })),
      Buffer.from(JSON.stringify({ version: 1, entries: [entry()], extra: true })),
      lock([{ ...entry(), extra: true }]),
      lock([entry({ retainedStatus: "missing" })]),
      lock([entry({ retainedPath: "data/../fixture.txt" })]),
      lock([entry({ url: "" })]),
      lock([entry({ byteSize: Number.MAX_SAFE_INTEGER + 1 })]),
      lock([entry({ parentIds: ["fixture"] })]),
      lock([entry({ parentIds: ["missing"] })]),
      lock([entry({ id: "first", retainedPath: "data/first.txt", parentIds: ["second"] }), entry({ id: "second", retainedPath: "data/second.txt", parentIds: ["first"] })]),
      lock([entry(), entry({ id: "second" })]),
      lock([entry(), entry({ id: "second", retainedPath: "data/fixture.txt" })]),
    ]) expect(() => parseSourceLock(invalid)).toThrow("SOURCE_LOCK_INVALID");
  });
  it("hashes complete lock bytes in production and realpath-confines the lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "ingestion-lock-")); temporary.push(root);
    const bytes = lock(); await writeFile(join(root, "source-lock.json"), bytes);
    await expect(loadSourceLock(root, { NODE_ENV: "production", SOURCE_LOCK_SHA256: digest(bytes.toString()) })).resolves.toMatchObject({ lock: { version: 1 } });
    await expect(loadSourceLock(root, { NODE_ENV: "production", SOURCE_LOCK_SHA256: "0".repeat(64) })).rejects.toThrow("SOURCE_LOCK_SHA256_REQUIRED_OR_MISMATCH");
    const escaped = await mkdtemp(join(tmpdir(), "ingestion-escaped-")); temporary.push(escaped); await writeFile(join(escaped, "lock.json"), bytes); await rm(join(root, "source-lock.json")); await symlink(join(escaped, "lock.json"), join(root, "source-lock.json"));
    await expect(loadSourceLock(root, {} as NodeJS.ProcessEnv)).rejects.toThrow("INGESTION_PATH_INVALID");
  });
  it("accepts the repository lock without reading its large retained artifacts", async () => {
    await expect(loadSourceLock(join(process.cwd(), "data"), {} as NodeJS.ProcessEnv)).resolves.toMatchObject({ lock: { version: 1 } });
  });
  it("requires an explicit local root and production lock hash without exposing credentials", () => {
    expect(() => createRawObjectStore({ NODE_ENV: "development" })).toThrow("RAW_OBJECT_ROOT");
    expect(() => createRawObjectStore({ NODE_ENV: "production", RAW_OBJECT_BUCKET: "raw", DATABASE_URL: "postgres://secret", AWS_ACCESS_KEY_ID: "key", SOURCE_LOCK_SHA256: "a".repeat(64) })).toThrow("supplied together");
    expect(() => createRawObjectStore({ NODE_ENV: "production", RAW_OBJECT_BUCKET: "raw", DATABASE_URL: "postgres://secret", AWS_ACCESS_KEY_ID: "secret-key", AWS_SECRET_ACCESS_KEY: "secret-value", SOURCE_LOCK_SHA256: "a".repeat(64) })).not.toThrow();
    expect(() => createRawObjectStore({ NODE_ENV: "development", RAW_OBJECT_ROOT: ".raw" })).not.toThrow();
  });
  it("requires exactly one stable-name source row", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rowCount: 2, rows: [{ id: "src_a" }, { id: "src_b" }] }) };
    await expect(sourceId(pool as never, "rel_a", "identity")).rejects.toThrow("exactly one preregistered identity");
    pool.query.mockResolvedValue({ rowCount: 1, rows: [{ id: "src_identity" }] }); await expect(sourceId(pool as never, "rel_a", "identity")).resolves.toBe("src_identity");
  });
});
