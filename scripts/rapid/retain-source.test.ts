import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { retainRapidSource } from "./retain-source";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceLockBytes = (entries: unknown[] = []) => Buffer.from(JSON.stringify({ version: 1, entries }));
const temporaryDirectories: string[] = [];
const testRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "dsa-seats-rapid-"));
  temporaryDirectories.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("retainRapidSource", () => {
  it("retains an HTTPS response once and returns a source-lock entry candidate", async () => {
    const root = await testRoot(), body = "official result bytes";
    const result = await retainRapidSource({
      sourceId: "de-2024-primary-results",
      url: "https://example.gov/results.csv",
      outputPath: "delaware/2024/results.csv",
      expectedBytes: Buffer.byteLength(body),
      expectedSha256: sha256(body),
      sourceLockBytes: sourceLockBytes(),
    }, { workingDirectory: root, fetch: async () => new Response(body) });

    expect(await readFile(join(root, "data/source/rapid/delaware/2024/results.csv"), "utf8")).toBe(body);
    expect(result.sourceLockEntryCandidate).toMatchObject({
      id: "de-2024-primary-results",
      url: "https://example.gov/results.csv",
      retainedPath: "data/source/rapid/delaware/2024/results.csv",
      byteSize: Buffer.byteLength(body),
      sha256: sha256(body),
      retainedStatus: "retained",
    });
  });

  it("accepts an idempotent retry only when the retained bytes are exact", async () => {
    const root = await testRoot(), body = "same authoritative bytes";
    const request = { sourceId: "ks-2024-primary-results", url: "https://example.gov/results.xlsx", outputPath: "kansas/2024/results.xlsx", sourceLockBytes: sourceLockBytes(), expectedBytes: Buffer.byteLength(body), expectedSha256: sha256(body) };
    await retainRapidSource(request, { workingDirectory: root, fetch: async () => new Response(body) });
    await expect(retainRapidSource(request, { workingDirectory: root, fetch: async () => new Response(body) })).resolves.toMatchObject({ status: "already_retained" });
    await expect(retainRapidSource({ ...request, expectedSha256: sha256("changed bytes"), expectedBytes: Buffer.byteLength("changed bytes") }, { workingDirectory: root, fetch: async () => new Response("changed bytes") })).rejects.toThrow("RAPID_SOURCE_EXISTING_OUTPUT_MISMATCH");
  });

  it("refuses non-rapid output paths before making a network request", async () => {
    const root = await testRoot();
    await expect(retainRapidSource({ sourceId: "bad-output", url: "https://example.gov/a", outputPath: "../source-lock.json", sourceLockBytes: sourceLockBytes() }, {
      workingDirectory: root,
      fetch: async () => { throw new Error("network must not run"); },
    })).rejects.toThrow("RAPID_SOURCE_OUTPUT_OUTSIDE_RAPID_ROOT");
  });

  it("requires an explicit exact HTTPS destination for redirects", async () => {
    const root = await testRoot();
    const redirected = async (url: string) => url === "https://example.gov/start"
      ? new Response(null, { status: 302, headers: { location: "https://cdn.example.gov/result.csv" } })
      : new Response("bytes");
    const request = { sourceId: "redirected", url: "https://example.gov/start", outputPath: "test/result.csv", sourceLockBytes: sourceLockBytes() };
    await expect(retainRapidSource(request, { workingDirectory: root, fetch: redirected })).rejects.toThrow("RAPID_SOURCE_REDIRECT_NOT_ALLOWED");
    await expect(retainRapidSource({ ...request, allowedFinalUrl: "https://cdn.example.gov/result.csv" }, { workingDirectory: root, fetch: redirected })).resolves.toMatchObject({ finalUrl: "https://cdn.example.gov/result.csv" });
  });

  it("verifies a pre-existing expected artifact without fetching", async () => {
    const root = await testRoot(), body = "offline retained result";
    const output = join(root, "data/source/rapid/offline/result.csv");
    await mkdir(join(output, ".."), { recursive: true });
    await writeFile(output, body);
    await expect(retainRapidSource({ sourceId: "offline", url: "https://example.gov/result.csv", outputPath: "offline/result.csv", expectedBytes: Buffer.byteLength(body), expectedSha256: sha256(body), sourceLockBytes: sourceLockBytes() }, {
      workingDirectory: root,
      fetch: async () => { throw new Error("fetch must not run"); },
    })).resolves.toMatchObject({ status: "already_retained" });
  });

  it("does not accept a pre-existing output without both expected integrity values", async () => {
    const root = await testRoot(), output = join(root, "data/source/rapid/offline/unpinned.csv");
    await mkdir(join(output, ".."), { recursive: true });
    await writeFile(output, "unpinned");
    await expect(retainRapidSource({ sourceId: "unpinned", url: "https://example.gov/unpinned.csv", outputPath: "offline/unpinned.csv", sourceLockBytes: sourceLockBytes() }, { workingDirectory: root, fetch: async () => { throw new Error("fetch must not run"); } })).rejects.toThrow("RAPID_SOURCE_EXISTING_OUTPUT_EXPECTATION_REQUIRED");
  });

  it("rejects source-lock ID and retained-path conflicts before retention", async () => {
    const root = await testRoot(), request = { sourceId: "same-id", url: "https://example.gov/new.csv", outputPath: "new.csv", sourceLockBytes: sourceLockBytes([{ id: "same-id", url: "https://example.gov/old.csv", retainedPath: "data/source/rapid/old.csv", retainedStatus: "retained", byteSize: 1, sha256: "a".repeat(64), kind: "source", parentIds: [] }]) };
    await expect(retainRapidSource(request, { workingDirectory: root, fetch: async () => new Response("x") })).rejects.toThrow("RAPID_SOURCE_LOCK_ID_CONFLICT");
    await expect(retainRapidSource({ ...request, sourceId: "new-id", sourceLockBytes: sourceLockBytes([{ id: "old-id", url: "https://example.gov/old.csv", retainedPath: "data/source/rapid/new.csv", retainedStatus: "retained", byteSize: 1, sha256: "a".repeat(64), kind: "source", parentIds: [] }]) }, { workingDirectory: root, fetch: async () => new Response("x") })).rejects.toThrow("RAPID_SOURCE_LOCK_PATH_CONFLICT");
  });

  it("accepts mixed retained/nonretained ledger entries but rejects promotion of a nonretained ID", async () => {
    const root = await testRoot();
    const mixed = sourceLockBytes([
      { id: "retained-other", url: "https://example.gov/other.csv", retainedPath: "data/source/rapid/other.csv", retainedStatus: "retained", byteSize: 1, sha256: "a".repeat(64), kind: "source", parentIds: [] },
      { id: "nonretained-other", url: "https://example.gov/nonretained.csv", retainedPath: null, retainedStatus: "nonretained", byteSize: 1, sha256: "b".repeat(64), kind: "source", parentIds: [] },
      { id: "nonretained-sparse", url: "https://example.gov/sparse.csv", retainedStatus: "nonretained", kind: "source", parentIds: [] },
    ]);
    await expect(retainRapidSource({ sourceId: "new-source", url: "https://example.gov/new.csv", outputPath: "mixed/new.csv", sourceLockBytes: mixed }, { workingDirectory: root, fetch: async () => new Response("new") })).resolves.toMatchObject({ status: "retained" });
    await expect(retainRapidSource({ sourceId: "nonretained-other", url: "https://example.gov/nonretained.csv", outputPath: "mixed/promoted.csv", sourceLockBytes: mixed }, { workingDirectory: root, fetch: async () => new Response("new") })).rejects.toThrow("RAPID_SOURCE_LOCK_ID_CONFLICT");
  });

  it("parses the repository's current source-lock ledger", async () => {
    const root = await testRoot();
    await expect(retainRapidSource({ sourceId: "rapid-test-new-source", url: "https://example.gov/current-ledger.csv", outputPath: "current-ledger/result.csv", sourceLockBytes: await readFile("data/source-lock.json") }, { workingDirectory: root, fetch: async () => new Response("bytes") })).resolves.toMatchObject({ status: "retained" });
  });

  it("accepts an identical source-lock entry only after streaming the retained bytes", async () => {
    const root = await testRoot(), body = "z".repeat(2 * 1024 * 1024), output = join(root, "data/source/rapid/large/result.bin"), digest = sha256(body);
    await mkdir(join(output, ".."), { recursive: true });
    await writeFile(output, body);
    const entry = { id: "large", url: "https://example.gov/large.bin", retainedPath: "data/source/rapid/large/result.bin", retainedStatus: "retained", byteSize: Buffer.byteLength(body), sha256: digest, kind: "source", parentIds: [] };
    await expect(retainRapidSource({ sourceId: "large", url: entry.url, outputPath: "large/result.bin", expectedBytes: entry.byteSize, expectedSha256: digest, sourceLockBytes: sourceLockBytes([entry]) }, { workingDirectory: root, fetch: async () => { throw new Error("fetch must not run"); } })).resolves.toMatchObject({ status: "already_retained" });
  });
});
