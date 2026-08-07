import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = {
  id: "tiger-cd118-27",
  url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_27_cd118.zip",
  path: "data/source/tiger2022/tl_2022_27_cd118.zip",
  byteSize: 1_417_044,
  sha256: "4d466968af5759e647552ff99943773dbcde5b6317d4f2d2affa8ed12e09a652",
};
const expectedMembers = ["tl_2022_27_cd118.cpg", "tl_2022_27_cd118.dbf", "tl_2022_27_cd118.prj", "tl_2022_27_cd118.shp", "tl_2022_27_cd118.shp.ea.iso.xml", "tl_2022_27_cd118.shp.iso.xml", "tl_2022_27_cd118.shx"].sort();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cachePath = process.env.DSA_SEATS_MN_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_FILE;

function zipMemberNames(bytes) {
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error("MN_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("MN_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    names.push(bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names.sort();
}

async function acquire() {
  if (cachePath) return readFile(resolve(cachePath));
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "application/zip", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`MN_PRIMARY_GEOGRAPHY_AUTHORITY_FETCH_FAILED:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const bytes = await acquire();
if (bytes.length !== source.byteSize || sha256(bytes) !== source.sha256) throw new Error("MN_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT");
if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || JSON.stringify(zipMemberNames(bytes)) !== JSON.stringify(expectedMembers)) throw new Error("MN_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID");
const output = resolve(source.path);
await mkdir(dirname(output), { recursive: true });
try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("MN_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT"); }
process.stdout.write(`${JSON.stringify({ id: source.id, output, byteSize: bytes.length, sha256: sha256(bytes), members: expectedMembers }, null, 2)}\n`);
