import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyRetainedObject } from "./raw-store";

const bytes = Buffer.from(JSON.stringify({ contest: "HD-01", votes: 42 }));
const digest = createHash("sha256").update(bytes).digest("hex");
let base: string;
let root: string;
const verify = (locator: string, expectedSha256 = digest, expectedBytes = bytes.length) => verifyRetainedObject({ root, locator, expectedSha256, expectedBytes });

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "office-universe-raw-store-"));
  root = join(base, "store");
  await mkdir(join(root, "in", "2024"), { recursive: true });
  await writeFile(join(root, "in", "2024", "results.json"), bytes);
  await writeFile(join(base, "escape.json"), bytes);
  await symlink(join(base, "escape.json"), join(root, "in", "link-out.json"));
  await symlink(join(root, "in", "2024", "results.json"), join(root, "in", "link-in.json"));
  await symlink(base, join(root, "in", "dir-out"));
});
afterAll(async () => { await rm(base, { recursive: true, force: true }); });

describe("verifyRetainedObject", () => {
  it("returns the locator, byte size, and streamed digest for a matching object", async () => {
    await expect(verify("in/2024/results.json")).resolves.toEqual({ locator: "in/2024/results.json", byteSize: bytes.length, sha256: digest });
    await expect(verify("in/link-in.json")).resolves.toMatchObject({ sha256: digest, byteSize: bytes.length });
  });

  it("rejects absolute and traversal locators", async () => {
    for (const locator of ["../escape.json", "in/../../escape.json", join(root, "in/2024/results.json"), "/etc/passwd", "", "in\\2024\\results.json"])
      await expect(verify(locator)).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID");
  });

  it("rejects symlinks that escape the root", async () => {
    await expect(verify("in/link-out.json")).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID");
    await expect(verify("in/dir-out/escape.json")).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID");
  });

  it("rejects missing objects and non-files", async () => {
    await expect(verify("in/2024/missing.json")).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_NOT_FILE");
    await expect(verify("in/2024")).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_NOT_FILE");
  });

  it("rejects an invalid digest string before touching the filesystem", async () => {
    await expect(verify("in/2024/results.json", digest.toUpperCase())).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_SHA256_INVALID");
    await expect(verify("in/2024/results.json", "abc")).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_SHA256_INVALID");
  });

  it("rejects byte-size and hash mismatches", async () => {
    await expect(verify("in/2024/results.json", digest, bytes.length + 1)).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_BYTES_MISMATCH");
    await expect(verify("in/2024/results.json", "a".repeat(64))).rejects.toThrow("OFFICE_UNIVERSE_OBJECT_SHA256_MISMATCH");
  });

  it("never writes or deletes anything in the store", async () => {
    const before = await readdir(root, { recursive: true });
    await verify("in/2024/results.json");
    await verify("in/2024/results.json", "a".repeat(64)).catch(() => undefined);
    expect(await readdir(root, { recursive: true })).toEqual(before);
  });
});
