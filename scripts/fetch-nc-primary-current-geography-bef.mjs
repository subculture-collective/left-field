import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const bundle = {
  id: "census-cd119-block-equivalency-bundle-20260805",
  url: "https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/119-congressional-district-befs/cd119.zip",
  retainedPath: "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip",
  retainedStatus: "retained",
  byteSize: 22_959_130,
  sha256: "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6",
  kind: "source",
  parentIds: [],
};
const extract = {
  id: "census-cd119-north-carolina-block-equivalency-extract-20260805",
  url: "urn:dsa-seats:census-cd119-bef:37_NC_CD119.txt",
  retainedPath: "data/source/elections/primary-results/geography/north-carolina/current/37_NC_CD119.txt",
  retainedStatus: "retained",
  byteSize: 4_732_772,
  sha256: "e541c8300ea3a3db4cbe26a91ef95749ff8986076f452dab9af7e92769fbb784",
  kind: "derived_extract",
  parentIds: [bundle.id],
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));

for (const expected of [bundle, extract]) {
  const matches = lock.entries.filter((entry) => entry.id === expected.id);
  if (matches.length !== 1 || JSON.stringify(matches[0]) !== JSON.stringify(expected)) throw new Error(`NC_PRIMARY_CURRENT_BEF_LOCK_MISMATCH:${expected.id}`);
}

const cacheFile = process.env.DSA_SEATS_NC_PRIMARY_CURRENT_BEF_CACHE_FILE;
let bundleBytes;
if (cacheFile) bundleBytes = await readFile(resolve(cacheFile));
else {
  const response = await fetch(bundle.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "application/zip", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`NC_PRIMARY_CURRENT_BEF_FETCH_FAILED:${response.status}`);
  bundleBytes = Buffer.from(await response.arrayBuffer());
}
if (bundleBytes.byteLength !== bundle.byteSize || sha256(bundleBytes) !== bundle.sha256 || !bundleBytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error("NC_PRIMARY_CURRENT_BEF_BUNDLE_DRIFT");

const bundleOutput = resolve(bundle.retainedPath);
await mkdir(dirname(bundleOutput), { recursive: true });
try { await writeFile(bundleOutput, bundleBytes, { flag: "wx", mode: 0o644 }); }
catch (error) { if (error?.code !== "EEXIST" || !(await readFile(bundleOutput)).equals(bundleBytes)) throw new Error("NC_PRIMARY_CURRENT_BEF_BUNDLE_OUTPUT_CONFLICT"); }
const members = execFileSync("unzip", ["-Z1", bundleOutput], { encoding: "utf8" }).split("\n").filter(Boolean);
const expectedMembers = ["01_AL_CD119.txt", "13_GA_CD119.txt", "22_LA_CD119.txt", "36_NY_CD119.txt", "37_NC_CD119.txt", "NationalCD119.txt"];
if (JSON.stringify(members) !== JSON.stringify(expectedMembers)) throw new Error("NC_PRIMARY_CURRENT_BEF_MEMBERS_INVALID");

const extractBytes = execFileSync("unzip", ["-p", bundleOutput, "37_NC_CD119.txt"], { maxBuffer: 8 * 1024 * 1024 });
if (extractBytes.byteLength !== extract.byteSize || sha256(extractBytes) !== extract.sha256) throw new Error("NC_PRIMARY_CURRENT_BEF_EXTRACT_DRIFT");
const lines = extractBytes.toString("utf8").split(/\r?\n/);
if (lines.at(-1) === "") lines.pop();
if (lines.shift() !== "GEOID,CDFP") throw new Error("NC_PRIMARY_CURRENT_BEF_HEADER_INVALID");
const blocks = new Set();
const districts = new Set();
for (const line of lines) {
  const match = /^(\d{15}),(\d{2})$/.exec(line);
  if (!match || blocks.has(match[1])) throw new Error("NC_PRIMARY_CURRENT_BEF_ROW_INVALID");
  blocks.add(match[1]);
  districts.add(match[2]);
}
if (blocks.size !== 236_638 || districts.size !== 14 || Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, "0")).some((district) => !districts.has(district))) throw new Error("NC_PRIMARY_CURRENT_BEF_INVENTORY_INVALID");

const extractOutput = resolve(extract.retainedPath);
await mkdir(dirname(extractOutput), { recursive: true });
try { await writeFile(extractOutput, extractBytes, { flag: "wx", mode: 0o644 }); }
catch (error) { if (error?.code !== "EEXIST" || !(await readFile(extractOutput)).equals(extractBytes)) throw new Error("NC_PRIMARY_CURRENT_BEF_EXTRACT_OUTPUT_CONFLICT"); }
process.stdout.write(`${JSON.stringify({ bundle: { output: bundleOutput, byteSize: bundleBytes.byteLength, sha256: sha256(bundleBytes) }, extract: { output: extractOutput, byteSize: extractBytes.byteLength, sha256: sha256(extractBytes), blocks: blocks.size, districts: districts.size } }, null, 2)}\n`);
