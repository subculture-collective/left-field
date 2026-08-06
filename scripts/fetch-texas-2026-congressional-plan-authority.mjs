import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { id: "tx-plan-c2333-current-election-use-status-20260806", url: "https://redistricting.capitol.texas.gov/Current-districts", cacheName: "current-districts.html", retainedName: "texas-current-districts-status.html", byteSize: 27609, sha256: "626b36b109ad33163e01063f31bce526ff7e499ac8a85268d992725bf03ae6d8" },
  { id: "tx-hb4-enrolled-plan-c2333-2025", url: "https://capitol.texas.gov/tlodocs/892/billtext/html/HB00004F.htm", cacheName: "hb4-enrolled.html", retainedName: "hb4-enrolled.html", byteSize: 1262192, sha256: "ac6ade738a107c395f61edb78787e1e1cf677081e55d49552fe717b1dffedb1c" },
  { id: "tx-planc2333-dataset-metadata-20260806", url: "https://data.capitol.texas.gov/api/3/action/package_show?id=planc2333", cacheName: "planc2333-dataset.json", retainedName: "planc2333-dataset.json", byteSize: 170392, sha256: "7e0dbec7cd044701772fb6f20de033513337dc2a4331efd93a75d367def64683" },
  { id: "tx-planc2333-block-equivalency-20250818", url: "https://data.capitol.texas.gov/dataset/748c952b-e926-4f44-8d01-a738884b3ec8/resource/bc1ad997-3d59-40f7-8d7f-72a74bb4a5e4/download/planc2333_blk.zip", cacheName: "planc2333-block.zip", retainedName: "PLANC2333_blk.zip", byteSize: 1793530, sha256: "3672811ec032900e911337ac0ec455e786e6350576aa01117aeae2b8de28f80e" },
];
const planExtract = { name: "PLANC2333.csv", byteSize: 14581459, sha256: "ff34cb7e7464f7ed55eff83bd2a86f3812e446167e488456c5e5c2376d8883b5" };
const currentExtract = { name: "48_TX_CD119.txt", byteSize: 13375152, sha256: "4eec50a54cf0dca2e6126a12f84a619bbeadbe68b5b23005030a82c78f5069df" };
const currentBundle = { byteSize: 22959130, sha256: "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6" };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (reason) => { throw new Error(`TX_2026_PLAN_AUTHORITY_${reason}`); };

if (process.env.DSA_SEATS_TX_2026_PLAN_AUTHORITY_DESCRIBE === "1") {
  process.stdout.write(`${JSON.stringify({ verifiedSources: 4, retainedSources: 4, derivedExtracts: 2, sources: sources.map(({ id, byteSize, sha256 }) => ({ id, byteSize, sha256 })) })}\n`);
  process.exit(0);
}

const cache = process.env.DSA_SEATS_TX_2026_PLAN_AUTHORITY_CACHE_DIR;
const overrideOutput = process.env.DSA_SEATS_TX_2026_PLAN_AUTHORITY_OUTPUT_DIR;
const sourceOutput = overrideOutput ? resolve(overrideOutput) : resolve("data/source/elections/primary-results/geography/texas/2026");
const currentOutput = overrideOutput ? resolve(overrideOutput) : resolve("data/source/elections/primary-results/geography/texas/current");
const bytesById = new Map();
for (const source of sources) {
  const bytes = cache
    ? await readFile(resolve(cache, source.cacheName))
    : Buffer.from(await (await fetch(source.url, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } })).arrayBuffer());
  if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256) fail(`SOURCE_DRIFT:${source.id}`);
  bytesById.set(source.id, bytes);
  const target = resolve(sourceOutput, source.retainedName);
  await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) fail(`OUTPUT_CONFLICT:${source.id}`); }
}

const currentStatus = bytesById.get(sources[0].id).toString("utf8");
if (!currentStatus.includes("PlanC2333") || !currentStatus.includes("again in effect for congressional elections") || !currentStatus.includes("beginning with the 2026 primaries") || !currentStatus.includes("pending the Supreme Court’s action on the appeal")) fail("CURRENT_STATUS_CLAIM_INVALID");
const hb4 = bytesById.get(sources[1].id).toString("utf8");
if (!hb4.includes("PLANC2333") || !hb4.includes("H.B.&#xA0;No.&#xA0;4") || !hb4.includes("beginning with the primary ") || !hb4.includes("and general elections in 2026 for members of the 120th Congress")) fail("ENROLLED_AUTHORITY_CLAIM_INVALID");
const metadata = JSON.parse(bytesById.get(sources[2].id).toString("utf8"));
const blockResource = metadata?.result?.resources?.filter((row) => row.id === "bc1ad997-3d59-40f7-8d7f-72a74bb4a5e4");
if (metadata?.success !== true || metadata?.result?.title !== "PLANC2333" || metadata?.result?.notes !== "ENACTED BY 89TH LEGISLATURE, 2ND C.S., 2025" || metadata?.result?.organization?.title !== "Texas Legislative Council" || metadata?.result?.license_id !== null || metadata?.result?.license_title !== null || blockResource?.length !== 1 || blockResource[0].name !== "PLANC2333_blk.zip" || blockResource[0].size !== 1793530) fail("DATASET_METADATA_INVALID");

const zipPath = resolve(sourceOutput, "PLANC2333_blk.zip");
const members = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split(/\r?\n/);
if (JSON.stringify(members) !== JSON.stringify(["PLANC2333.csv"])) fail("PLAN_ARCHIVE_MEMBERS_INVALID");
const planBytes = execFileSync("unzip", ["-p", zipPath, "PLANC2333.csv"], { maxBuffer: 20 * 1024 * 1024 });
if (planBytes.length !== planExtract.byteSize || sha(planBytes) !== planExtract.sha256) fail("PLAN_EXTRACT_DRIFT");
const planLines = planBytes.toString("utf8").trim().split(/\r?\n/);
if (planLines.shift() !== '"SCTBKEY","DISTRICT"') fail("PLAN_HEADER_INVALID");
const planBlocks = new Set(), planDistricts = new Set();
for (const line of planLines) { const match = /^"(48\d{13})",(\d{1,2})$/.exec(line); if (!match || planBlocks.has(match[1]) || +match[2] < 1 || +match[2] > 38) fail("PLAN_ROW_INVALID"); planBlocks.add(match[1]); planDistricts.add(match[2].padStart(2, "0")); }
if (planBlocks.size !== 668757 || planDistricts.size !== 38) fail("PLAN_INVENTORY_INVALID");

const bundlePath = resolve(process.env.DSA_SEATS_TX_2026_PLAN_AUTHORITY_CD119_BUNDLE ?? "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
const bundleBytes = await readFile(bundlePath);
if (bundleBytes.length !== currentBundle.byteSize || sha(bundleBytes) !== currentBundle.sha256) fail("CURRENT_BUNDLE_DRIFT");
const national = execFileSync("unzip", ["-p", bundlePath, "NationalCD119.txt"], { maxBuffer: 180 * 1024 * 1024 }).toString("utf8").split(/\r?\n/);
if (national.shift() !== "GEOID,CDFP") fail("CURRENT_HEADER_INVALID");
const texasRows = national.filter((line) => line.startsWith("48"));
const currentBytes = Buffer.from(`GEOID,CDFP\r\n${texasRows.join("\r\n")}\r\n`);
if (currentBytes.length !== currentExtract.byteSize || sha(currentBytes) !== currentExtract.sha256) fail("CURRENT_EXTRACT_DRIFT");
const currentBlocks = new Set(), currentDistricts = new Set();
for (const line of texasRows) { const match = /^(48\d{13}),(\d{2})$/.exec(line); if (!match || currentBlocks.has(match[1]) || +match[2] < 1 || +match[2] > 38) fail("CURRENT_ROW_INVALID"); currentBlocks.add(match[1]); currentDistricts.add(match[2]); }
if (currentBlocks.size !== 668757 || currentDistricts.size !== 38) fail("CURRENT_INVENTORY_INVALID");

for (const [dir, item, bytes] of [[sourceOutput, planExtract, planBytes], [currentOutput, currentExtract, currentBytes]]) {
  const target = resolve(dir, item.name); await mkdir(dirname(target), { recursive: true });
  try { await writeFile(target, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) fail(`OUTPUT_CONFLICT:${item.name}`); }
}
process.stdout.write(`${JSON.stringify({ verifiedSources: 4, retainedSources: 4, derivedExtracts: 2, planBlocks: planBlocks.size, currentBlocks: currentBlocks.size, planDistricts: planDistricts.size, currentDistricts: currentDistricts.size })}\n`);
