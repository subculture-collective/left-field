import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { SHA256_HEX, isUnsafeLocator } from "./nationwide-intake";

export type VerifiedRetainedObject = Readonly<{ locator: string; byteSize: number; sha256: string }>;
export type VerifyRetainedObjectInput = Readonly<{ root: string; locator: string; expectedSha256: string; expectedBytes: number }>;

const fail = (code: string, detail: string): never => { throw new Error(`${code}: ${detail}`); };
const escapes = (root: string, target: string): boolean => {
  const rel = relative(root, target);
  return rel.length === 0 || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`);
};
const isMissing = (error: unknown): boolean => typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";

/**
 * Read-only receipt verification. Resolves the locator inside `root`, refuses
 * anything that escapes (including through symlinks), and streams the bytes
 * for SHA-256. It never fetches, writes, deletes, or parses the object.
 */
export async function verifyRetainedObject(input: VerifyRetainedObjectInput): Promise<VerifiedRetainedObject> {
  const { root, locator, expectedSha256, expectedBytes } = input;
  if (!SHA256_HEX.test(expectedSha256)) fail("OFFICE_UNIVERSE_OBJECT_SHA256_INVALID", "expected digest is not lowercase sha256 hex");
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) fail("OFFICE_UNIVERSE_OBJECT_BYTES_INVALID", "expected byte size is not a non-negative integer");
  if (isUnsafeLocator(locator) || isAbsolute(locator)) fail("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID", "locator must be a relative path inside the raw store");
  const rootPath = resolve(root);
  const target = resolve(rootPath, locator);
  if (escapes(rootPath, target)) fail("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID", "locator resolves outside the raw store");

  let link;
  try { link = await lstat(target); } catch (error) { if (isMissing(error)) fail("OFFICE_UNIVERSE_OBJECT_NOT_FILE", "retained object does not exist"); throw error; }
  const [realRoot, realTarget] = await Promise.all([realpath(rootPath), realpath(target)]);
  if (escapes(realRoot, realTarget)) fail("OFFICE_UNIVERSE_OBJECT_LOCATOR_INVALID", link.isSymbolicLink() ? "symlink escapes the raw store" : "resolved path escapes the raw store");
  const file = link.isSymbolicLink() ? await stat(realTarget) : link;
  if (!file.isFile()) fail("OFFICE_UNIVERSE_OBJECT_NOT_FILE", "retained object is not a regular file");
  if (file.size !== expectedBytes) fail("OFFICE_UNIVERSE_OBJECT_BYTES_MISMATCH", `expected ${expectedBytes} bytes, found ${file.size}`);

  const hash = createHash("sha256");
  let byteSize = 0;
  for await (const chunk of createReadStream(realTarget)) { hash.update(chunk as Buffer); byteSize += (chunk as Buffer).length; }
  if (byteSize !== expectedBytes) fail("OFFICE_UNIVERSE_OBJECT_BYTES_MISMATCH", `expected ${expectedBytes} bytes, streamed ${byteSize}`);
  const sha256 = hash.digest("hex");
  if (sha256 !== expectedSha256) fail("OFFICE_UNIVERSE_OBJECT_SHA256_MISMATCH", "retained bytes do not match the receipt digest");
  return { locator, byteSize, sha256 };
}
