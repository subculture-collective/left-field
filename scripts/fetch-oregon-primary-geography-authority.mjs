import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = {
  id: "tiger-cd118-41",
  url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_41_cd118.zip",
  path: "data/source/tiger2022/tl_2022_41_cd118.zip",
  byteSize: 1_370_928,
  sha256: "7cb5f032ba20abef66f0395cb7c5e1ec5215fb748024f898458c0bd88533edf3",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cachePath = process.env.DSA_SEATS_OR_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE;

async function acquire() {
  if (cachePath) return readFile(resolve(cachePath));
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "application/zip", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`OR_PRIMARY_GEOGRAPHY_AUTHORITY_FETCH_FAILED:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const bytes = await acquire();
if (bytes.length !== source.byteSize || sha256(bytes) !== source.sha256) throw new Error("OR_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error("OR_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
const output = resolve(source.path);
await mkdir(dirname(output), { recursive: true });
try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OR_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT"); }
process.stdout.write(`${JSON.stringify({ id: source.id, output, byteSize: bytes.length, sha256: sha256(bytes) }, null, 2)}\n`);
