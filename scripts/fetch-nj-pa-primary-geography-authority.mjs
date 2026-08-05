import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const sources = [
  {
    id: "census-cd119-plan-change-authority-20260805",
    url: "https://www.census.gov/geographies/mapping-files/2025/dec/rdo/119-congressional-district-bef.html",
    path: "data/source/elections/primary-results/geography/census-119-congressional-district-bef.html",
    cacheName: "census-bef-119.html",
    byteSize: 324827,
    sha256: "66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670",
    contentType: "text/html",
    required: ["redrew their congressional district plans", "Alabama", "Georgia", "Louisiana", "New York", "North Carolina"],
  },
  {
    id: "tiger-cd118-34",
    url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_34_cd118.zip",
    path: "data/source/tiger2022/tl_2022_34_cd118.zip",
    cacheName: "nj118-2022.zip",
    byteSize: 1543710,
    sha256: "f50511a1a6971143732e73b1941a96ad6968d0703f4a5236c597dbb00e0f63cf",
    contentType: "application/zip",
    required: [],
  },
  {
    id: "tiger-cd118-42",
    url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_42_cd118.zip",
    path: "data/source/tiger2022/tl_2022_42_cd118.zip",
    cacheName: "pa118-2022.zip",
    byteSize: 1928107,
    sha256: "3e59d0b48b291c0ab626879b4d286b58506530706bcba6d0cfe767b531728a22",
    contentType: "application/zip",
    required: [],
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cacheDirectory = process.env.DSA_SEATS_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_DIR;

async function acquire(source) {
  if (cacheDirectory) return readFile(resolve(cacheDirectory, source.cacheName));
  const response = await fetch(source.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
    headers: { accept: source.contentType, "user-agent": "dsa-seats-source-lock/1.0" },
  });
  if (!response.ok) throw new Error(`PRIMARY_GEOGRAPHY_AUTHORITY_FETCH_FAILED:${source.id}:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

for (const source of sources) {
  const bytes = await acquire(source);
  if (bytes.byteLength !== source.byteSize || sha256(bytes) !== source.sha256) throw new Error(`PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT:${source.id}`);
  if (source.contentType === "application/zip" && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error(`PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID:${source.id}`);
  if (source.required.some((needle) => !bytes.includes(Buffer.from(needle)))) throw new Error(`PRIMARY_GEOGRAPHY_AUTHORITY_SEMANTICS_INVALID:${source.id}`);
  const output = resolve(source.path);
  await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT:${source.id}`); }
  process.stdout.write(`${JSON.stringify({ id: source.id, output, fileName: basename(output), byteSize: bytes.byteLength, sha256: sha256(bytes) })}\n`);
}
