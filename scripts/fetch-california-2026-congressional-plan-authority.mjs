import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  {
    id: "ca-proposition-50-current-election-use-status-20260806",
    url: "https://www.sos.ca.gov/elections/california-redistricting",
    cacheName: "california-redistricting-status.html",
    retainedName: "california-redistricting-status.html",
    byteSize: 62964,
    sha256: "37c47e69d57a1fa134313ff6a46a5d416d7970881f8d1e6735f94cf27e5a19fd",
  },
  {
    id: "ca-proposition-50-official-voter-guide-2025",
    url: "https://vig.cdn.sos.ca.gov/2025/special/pdf/prop50.pdf",
    cacheName: "prop50-official-voter-guide.pdf",
    retainedName: "prop50-official-voter-guide.pdf",
    byteSize: 4872403,
    sha256: "245e774a9b1f860585043fca34a33602c3c1c07b73d0332b710d217d54e4fd22",
  },
  {
    id: "ca-ab604-official-plan-source-page-20260806",
    url: "https://sdmg.senate.ca.gov/committeehome/2025-congressional-districts",
    cacheName: "2025-congressional-districts.html",
    retainedName: "2025-congressional-districts.html",
    byteSize: 87789,
    sha256: "fab27772b3385efa15bd0c21a23892a513a4ea1426c1d0b5d7d6e9d68bd87a5e",
  },
  {
    id: "ca-ab604-block-equivalency-20250818",
    url: "https://selc.senate.ca.gov/media/604",
    cacheName: "ab604.csv",
    retainedName: "ab604.csv",
    byteSize: 12473355,
    sha256: "ac11292bf0e862a0b2716dc687a9eb91fdc4b480ae115c0a21848f3fbd7173b2",
  },
];
const planExtract = {
  name: "06_CA_CD120_AB604.txt",
  byteSize: 10394472,
  sha256: "280f47703360ac4c9c59341a6a4317fe039ad4d20173cc4f00bfc9438e0505fc",
};
const currentExtract = {
  name: "06_CA_CD119.txt",
  byteSize: 10394472,
  sha256: "f9c68edcf53483aa1c83315180bcc5d88b1db0b55869c443f755e1dcd61fcfc4",
};
const currentBundle = {
  byteSize: 22959130,
  sha256: "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (reason) => { throw new Error(`CA_2026_PLAN_AUTHORITY_${reason}`); };
const bytewise = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

if (process.env.DSA_SEATS_CA_2026_PLAN_AUTHORITY_DESCRIBE === "1") {
  process.stdout.write(`${JSON.stringify({
    verifiedSources: sources.length,
    retainedSources: sources.length,
    derivedExtracts: 2,
    sources: sources.map(({ id, byteSize, sha256 }) => ({ id, byteSize, sha256 })),
  })}\n`);
  process.exit(0);
}

const cache = process.env.DSA_SEATS_CA_2026_PLAN_AUTHORITY_CACHE_DIR;
const overrideOutput = process.env.DSA_SEATS_CA_2026_PLAN_AUTHORITY_OUTPUT_DIR;
const sourceOutput = overrideOutput
  ? resolve(overrideOutput)
  : resolve("data/source/elections/primary-results/geography/california/2026");
const currentOutput = overrideOutput
  ? resolve(overrideOutput)
  : resolve("data/source/elections/primary-results/geography/california/current");
const bytesById = new Map();

for (const source of sources) {
  const bytes = cache
    ? await readFile(resolve(cache, source.cacheName))
    : Buffer.from(await (await fetch(source.url, {
      signal: AbortSignal.timeout(120000),
      headers: { "user-agent": "dsa-seats-source-lock/1.0" },
    })).arrayBuffer());
  if (bytes.length !== source.byteSize || sha(bytes) !== source.sha256) {
    fail(`SOURCE_DRIFT:${source.id}`);
  }
  bytesById.set(source.id, bytes);
  const target = resolve(sourceOutput, source.retainedName);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (error?.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) {
      fail(`OUTPUT_CONFLICT:${source.id}`);
    }
  }
}

const status = bytesById.get(sources[0].id).toString("utf8");
if (
  !status.includes("Proposition 50 was approved by voters at the November 4, 2025, Special Statewide Election")
  || !status.includes("temporarily use legislatively drawn Congressional district maps starting in 2026 and through 2030")
  || !status.includes("2026 primary and general election ballots will include candidates for the new district")
  || !status.includes("until noon on January 3, 2027")
) fail("CURRENT_STATUS_CLAIM_INVALID");

const voterGuide = bytesById.get(sources[1].id);
if (!voterGuide.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
  fail("VOTER_GUIDE_PDF_INVALID");
}

const sourcePage = bytesById.get(sources[2].id).toString("utf8");
if (
  !sourcePage.includes("These <strong>Congressional districts</strong>&nbsp;were established")
  || !sourcePage.includes("passage of")
  || !sourcePage.includes("Proposition 50 (2025)")
  || !sourcePage.includes("AB 604 Districts Equivalency File")
  || !sourcePage.includes("https://selc.senate.ca.gov/media/604")
  || !sourcePage.includes("AB 604 - Chaptered 8/21/2025")
) fail("OFFICIAL_SOURCE_PAGE_CLAIM_INVALID");

const planSourceBytes = bytesById.get(sources[3].id);
const planSourceText = planSourceBytes.toString("utf8");
if (!planSourceText.startsWith("\ufeff") || !planSourceText.endsWith("\r\n")) {
  fail("PLAN_ENCODING_INVALID");
}
const rawPlanLines = planSourceText.replace(/^\ufeff/, "").trimEnd().split(/\r?\n/);
const planAssignments = new Map();
for (const line of rawPlanLines) {
  const match = /^"(06\d{13})","(\d{2})"$/.exec(line);
  if (!match || +match[2] < 1 || +match[2] > 52 || planAssignments.has(match[1])) {
    fail("PLAN_ROW_INVALID");
  }
  planAssignments.set(match[1], match[2]);
}
const planDistricts = new Set(planAssignments.values());
if (planAssignments.size !== 519723 || planDistricts.size !== 52) {
  fail("PLAN_INVENTORY_INVALID");
}
const planRows = [...planAssignments].sort(([left], [right]) => bytewise(left, right));
const planBytes = Buffer.from(`GEOID,CDFP\r\n${planRows.map((row) => row.join(",")).join("\r\n")}\r\n`);
if (planBytes.length !== planExtract.byteSize || sha(planBytes) !== planExtract.sha256) {
  fail("PLAN_EXTRACT_DRIFT");
}

const bundlePath = resolve(process.env.DSA_SEATS_CA_2026_PLAN_AUTHORITY_CD119_BUNDLE
  ?? "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
const bundleBytes = await readFile(bundlePath);
if (bundleBytes.length !== currentBundle.byteSize || sha(bundleBytes) !== currentBundle.sha256) {
  fail("CURRENT_BUNDLE_DRIFT");
}
const national = execFileSync("unzip", ["-p", bundlePath, "NationalCD119.txt"], {
  maxBuffer: 180 * 1024 * 1024,
}).toString("utf8").split(/\r?\n/);
if (national.shift() !== "GEOID,CDFP") fail("CURRENT_HEADER_INVALID");
const californiaRows = national.filter((line) => line.startsWith("06"));
const currentBytes = Buffer.from(`GEOID,CDFP\r\n${californiaRows.join("\r\n")}\r\n`);
if (currentBytes.length !== currentExtract.byteSize || sha(currentBytes) !== currentExtract.sha256) {
  fail("CURRENT_EXTRACT_DRIFT");
}
const currentAssignments = new Map();
for (const line of californiaRows) {
  const match = /^(06\d{13}),(\d{2})$/.exec(line);
  if (!match || +match[2] < 1 || +match[2] > 52 || currentAssignments.has(match[1])) {
    fail("CURRENT_ROW_INVALID");
  }
  currentAssignments.set(match[1], match[2]);
}
const currentDistricts = new Set(currentAssignments.values());
if (currentAssignments.size !== 519723 || currentDistricts.size !== 52) {
  fail("CURRENT_INVENTORY_INVALID");
}
let commonBlocks = 0;
let changedAssignments = 0;
for (const [geoid, district] of planAssignments) {
  const currentDistrict = currentAssignments.get(geoid);
  if (!currentDistrict) fail("BLOCK_UNIVERSE_MISMATCH");
  commonBlocks += 1;
  if (currentDistrict !== district) changedAssignments += 1;
}
if (commonBlocks !== planAssignments.size || currentAssignments.size !== commonBlocks || changedAssignments !== 133426) {
  fail("BLOCK_UNIVERSE_MISMATCH");
}

for (const [dir, item, bytes] of [
  [sourceOutput, planExtract, planBytes],
  [currentOutput, currentExtract, currentBytes],
]) {
  const target = resolve(dir, item.name);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(target, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (error?.code !== "EEXIST" || !(await readFile(target)).equals(bytes)) {
      fail(`OUTPUT_CONFLICT:${item.name}`);
    }
  }
}

process.stdout.write(`${JSON.stringify({
  verifiedSources: sources.length,
  retainedSources: sources.length,
  derivedExtracts: 2,
  planBlocks: planAssignments.size,
  currentBlocks: currentAssignments.size,
  commonBlocks,
  changedAssignments,
  planDistricts: planDistricts.size,
  currentDistricts: currentDistricts.size,
})}\n`);
