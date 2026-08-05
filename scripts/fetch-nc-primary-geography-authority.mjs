import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  {
    id: "ncga-congressional-redistricting-authority-20260805",
    url: "https://www.ncleg.gov/Redistricting",
    path: "data/source/elections/primary-results/geography/north-carolina/ncga-redistricting.html",
    cacheName: "ncga-redistricting.html",
    byteSize: 219_331,
    sha256: "8f11ae03c95c6e19e75cef133390c5e1176dc71d7253f72345fbd480504eb001",
    contentType: "text/html",
    required: ["C2022C_Detail", "used for the 2022 election", "C2023E_Detail", "used for the 2024 election", "C2025E_Detail", "to be used for the 2026 elections"],
  },
  {
    id: "nc-2022-court-congressional-plan-shapefile",
    url: "https://ncleg.gov/Files/GIS/Plans_Main/Congress_2022_Court/2022%20Interim%20Congressional%20-%20Shapefile.zip",
    path: "data/source/elections/primary-results/geography/north-carolina/2022/court-ordered-congressional-plan.zip",
    cacheName: "2022-court.zip",
    byteSize: 2_215_968,
    sha256: "60455cbbf7f75196441f01d38720f27b8b7766b512e889543a17dc54feba3ae5",
    contentType: "application/zip",
    zipMembers: ["Interim Congressional.shp", "Interim Congressional.shx", "Interim Congressional.dbf", "Interim Congressional.prj"],
  },
  {
    id: "nc-2022-court-congressional-plan-block-assignment",
    url: "https://ncleg.gov/Files/GIS/Plans_Main/Congress_2022_Court/2022%20Interim%20Congressional%20-%20Block%20Assignment%20File.zip",
    path: "data/source/elections/primary-results/geography/north-carolina/2022/court-ordered-congressional-block-assignment.zip",
    cacheName: "2022-block.zip",
    byteSize: 482_279,
    sha256: "95b0e6c0bca9bd18932195649fa23406c28b35f975aab9815c64c3d06cf74b4a",
    contentType: "application/zip",
    zipMembers: ["Interim Congressional.csv"],
  },
  {
    id: "nc-2023-enacted-congressional-plan-shapefile",
    url: "https://ncleg.gov/Files/GIS/Plans_Main/Congress_2023/SL%202023-145%20Congress%20-%20Shapefile.zip",
    path: "data/source/elections/primary-results/geography/north-carolina/2024/sl-2023-145-congressional-plan.zip",
    cacheName: "2023-enacted.zip",
    byteSize: 2_593_712,
    sha256: "08356ab4db690e8dea60eba42f6b8490e24cd2b711cbde507d1b33f138cf9da5",
    contentType: "application/zip",
    zipMembers: ["SL 2023-145.shp", "SL 2023-145.shx", "SL 2023-145.dbf", "SL 2023-145.prj"],
  },
  {
    id: "nc-2023-enacted-congressional-plan-block-assignment",
    url: "https://ncleg.gov/Files/GIS/Plans_Main/Congress_2023/SL%202023-145%20Congress%20-%20Block%20Assignment%20File.zip",
    path: "data/source/elections/primary-results/geography/north-carolina/2024/sl-2023-145-congressional-block-assignment.zip",
    cacheName: "2023-block.zip",
    byteSize: 486_332,
    sha256: "9ff24ce1565750e8677c0c4d5d27f5b6c0f28ccc78b1ad93c53c4565c4d35dfe",
    contentType: "application/zip",
    zipMembers: ["SL 2023-145.csv"],
  },
  {
    id: "nc-2025-enacted-congressional-plan-shapefile",
    url: "https://webservices.ncleg.gov/ViewBillDocument/2025/7667/0/SL%202025-95%20-%20Shapefile",
    path: "data/source/elections/primary-results/geography/north-carolina/2026/sl-2025-95-congressional-plan.zip",
    cacheName: "2025-enacted.zip",
    byteSize: 2_644_654,
    sha256: "c21e18d29a0f6dd52636c866ca3b05295a0757c6d6d98ee42ffa0b2eee795897",
    contentType: "application/zip",
    zipMembers: ["SL 2025-95.shp", "SL 2025-95.shx", "SL 2025-95.dbf", "SL 2025-95.prj"],
  },
  {
    id: "nc-2025-enacted-congressional-plan-block-assignment",
    url: "https://webservices.ncleg.gov/ViewBillDocument/2025/7669/0/SL%202025-95%20-%20Block%20Assignment%20File",
    path: "data/source/elections/primary-results/geography/north-carolina/2026/sl-2025-95-congressional-block-assignment.zip",
    cacheName: "2025-block.zip",
    byteSize: 721_849,
    sha256: "f8fc2a273ed86482bd3aec400868f2a47ce91eaab42dd74d3509fc022daf4721",
    contentType: "application/zip",
    zipMembers: ["SL 2025-95.csv"],
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cacheDirectory = process.env.DSA_SEATS_NC_PRIMARY_GEOGRAPHY_AUTHORITY_CACHE_DIR;
const sourceLock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const blockUniverses = [];

for (const source of sources) {
  const matches = sourceLock.entries.filter((entry) => entry.id === source.id);
  if (matches.length !== 1) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_LOCK_CARDINALITY_INVALID:${source.id}`);
  const entry = matches[0];
  const expected = {
    id: source.id,
    url: source.url,
    retainedPath: source.path,
    retainedStatus: "retained",
    byteSize: source.byteSize,
    sha256: source.sha256,
    kind: "source",
    parentIds: [],
  };
  if (JSON.stringify(entry) !== JSON.stringify(expected)) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_LOCK_MISMATCH:${source.id}`);
}

function validateDbfInventory(output, member, sourceId) {
  const bytes = execFileSync("unzip", ["-p", output, member]);
  if (bytes.length < 65) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_DBF_INVALID:${sourceId}`);
  const recordCount = bytes.readUInt32LE(4);
  const headerLength = bytes.readUInt16LE(8);
  const recordLength = bytes.readUInt16LE(10);
  const fields = [];
  for (let offset = 32; offset < headerLength - 1 && bytes[offset] !== 0x0d; offset += 32) {
    fields.push({ name: bytes.subarray(offset, offset + 11).toString("ascii").replace(/\0.*$/, ""), length: bytes[offset + 16] });
  }
  const districtIndex = fields.findIndex((field) => field.name === "DISTRICT");
  if (districtIndex < 0 || recordCount !== 14 || headerLength + recordCount * recordLength > bytes.length) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_DBF_INVALID:${sourceId}`);
  const districtOffset = 1 + fields.slice(0, districtIndex).reduce((sum, field) => sum + field.length, 0);
  const districts = new Set();
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = headerLength + index * recordLength;
    if (bytes[recordOffset] === 0x2a) continue;
    const value = bytes.subarray(recordOffset + districtOffset, recordOffset + districtOffset + fields[districtIndex].length).toString("ascii").trim().replace(/^0+/, "") || "0";
    districts.add(value);
  }
  if (districts.size !== 14 || Array.from({ length: 14 }, (_, index) => String(index + 1)).some((district) => !districts.has(district))) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_DBF_DISTRICTS_INVALID:${sourceId}`);
}

function validateBlockAssignment(output, member, sourceId) {
  const text = execFileSync("unzip", ["-p", output, member], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.shift() !== '"Block","District"') throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_BLOCK_HEADER_INVALID:${sourceId}`);
  const blocks = new Set();
  const districts = new Set();
  for (const line of lines) {
    const match = /^"(\d{15})","(\d{1,2})"$/.exec(line);
    if (!match || blocks.has(match[1])) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_BLOCK_ROW_INVALID:${sourceId}`);
    blocks.add(match[1]);
    districts.add(String(Number(match[2])));
  }
  if (blocks.size !== 236_638 || districts.size !== 14 || Array.from({ length: 14 }, (_, index) => String(index + 1)).some((district) => !districts.has(district))) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_BLOCK_INVENTORY_INVALID:${sourceId}`);
  blockUniverses.push({ sourceId, blocks });
}

async function acquire(source) {
  if (cacheDirectory) return readFile(resolve(cacheDirectory, source.cacheName));
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: source.contentType, "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_FETCH_FAILED:${source.id}:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

for (const source of sources) {
  const bytes = await acquire(source);
  if (bytes.byteLength !== source.byteSize || sha256(bytes) !== source.sha256) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_DRIFT:${source.id}`);
  if (source.contentType === "application/zip" && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_FORMAT_INVALID:${source.id}`);
  if (source.required?.some((needle) => !bytes.includes(Buffer.from(needle)))) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_SEMANTICS_INVALID:${source.id}`);
  const output = resolve(source.path);
  await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_OUTPUT_CONFLICT:${source.id}`); }
  if (source.zipMembers) {
    const members = new Set(execFileSync("unzip", ["-Z1", output], { encoding: "utf8" }).split("\n").filter(Boolean));
    if (source.zipMembers.some((member) => !members.has(member))) throw new Error(`NC_PRIMARY_GEOGRAPHY_AUTHORITY_MEMBERS_INVALID:${source.id}`);
    const dbfMember = source.zipMembers.find((member) => member.endsWith(".dbf"));
    const csvMember = source.zipMembers.find((member) => member.endsWith(".csv"));
    if (dbfMember) validateDbfInventory(output, dbfMember, source.id);
    if (csvMember) validateBlockAssignment(output, csvMember, source.id);
  }
  process.stdout.write(`${JSON.stringify({ id: source.id, output, byteSize: bytes.byteLength, sha256: sha256(bytes) })}\n`);
}

const [baseline, ...comparisons] = blockUniverses;
if (!baseline || comparisons.length !== 2 || comparisons.some(({ blocks }) => blocks.size !== baseline.blocks.size || [...baseline.blocks].some((block) => !blocks.has(block)))) throw new Error("NC_PRIMARY_GEOGRAPHY_AUTHORITY_BLOCK_UNIVERSE_MISMATCH");
