import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = {
  id: "tiger-cd118-25",
  url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_25_cd118.zip",
  path: "data/source/tiger2022/tl_2022_25_cd118.zip",
  byteSize: 758_219,
  sha256: "ca6e9e2c25b06d4ee25fc8894f16c74226fd54a94dee2e70952e0f984a09629e",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cachePath = process.env.DSA_SEATS_MA_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE;

async function acquire() {
  if (cachePath) return readFile(resolve(cachePath));
  const response = await fetch(source.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
    headers: { accept: "application/zip", "user-agent": "dsa-seats-source-lock/1.0" },
  });
  if (!response.ok) throw new Error(`MA_PRIMARY_GEOGRAPHY_AUTHORITY_FETCH_FAILED:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const bytes = await acquire();
if (bytes.length !== source.byteSize || sha256(bytes) !== source.sha256) {
  throw new Error("MA_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
}
if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
  throw new Error("MA_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
}
const output = resolve(source.path);
await mkdir(dirname(output), { recursive: true });
try {
  await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
} catch (error) {
  if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
    throw new Error("MA_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT");
  }
}
process.stdout.write(`${JSON.stringify({ id: source.id, output, byteSize: bytes.length, sha256: sha256(bytes) }, null, 2)}\n`);
