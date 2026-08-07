import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { unzipSync } from "fflate";

const run = promisify(execFile);
const sources = [
  { id: "maine-legislature-ld1739-status-20260807", url: "https://legislature.maine.gov/legis/bills/display_ps.asp?paper=HP1305&PID=1456&snum=130", path: "data/source/elections/primary-results/geography/maine/authority/ld1739-status.html", bytes: 23_634, sha256: "c8d2b476ebf95c33de413e836850848fa2bd506902a20d8e698ecd46ee4625d2" },
  { id: "maine-pl-2021-c487-congressional-plan", url: "https://legislature.maine.gov/legis/bills/getPDF.asp?paper=HP1305&item=2&snum=130", path: "data/source/elections/primary-results/geography/maine/authority/pl-2021-c487-congressional-plan.pdf", bytes: 157_014, sha256: "1f8b086dfdc3e93ba6b35dab6383b5a7ec312bf571aa6a3ba391553041f0c291" },
  { id: "maine-mrsa-21a-1205a-congressional-districts-20260807", url: "https://legislature.maine.gov/statutes/21-A/title21-Asec1205-A.html", path: "data/source/elections/primary-results/geography/maine/authority/mrsa-title21a-section1205-a.html", bytes: 10_895, sha256: "558850b897f0fae7a5089d813554c7d891d0d0cedf8b86aea4069f1720225c96" },
  { id: "maine-mrsa-21a-1206-reapportionment-20260807", url: "https://legislature.maine.gov/legis/statutes/21-A/title21-Asec1206.html", path: "data/source/elections/primary-results/geography/maine/authority/mrsa-title21a-section1206.html", bytes: 12_802, sha256: "c597f99128f1b9f0f69891bf53d16219aa0ac540971870c405337a03bcac39d4" },
];

const pdfText = { id: "maine-pl-2021-c487-congressional-plan-text", path: "data/source/elections/primary-results/geography/maine/authority/pl-2021-c487-congressional-plan.txt", bytes: 3_080, sha256: "78a3106078478c2aa58d9cb3702ddbc6470a7e5fbbc30e4008ed4845cb2a5aff" };
const bundles = [
  { id: "census-cd118-maine-block-equivalency-extract-20260807", archivePath: "data/source/elections/primary-results/geography/new-york/historical/census-cd118-block-equivalency-bundle.zip", archiveBytes: 25_922_515, archiveSha256: "a2f38d0dd7c207fa144a88b66df9f59f8a6e5c27e932fbd4a32d1bcf587c5763", member: "23_ME_CD118.txt", path: "data/source/elections/primary-results/geography/maine/historical/23_ME_CD118.txt", bytes: 942_773, sha256: "3f9fea1bde2062980b2a854bbbfe2593184191798a487b7542751e648efef148" },
  { id: "census-cd119-maine-block-equivalency-extract-20260807", archivePath: "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip", archiveBytes: 22_959_130, archiveSha256: "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6", member: "NationalCD119.txt", path: "data/source/elections/primary-results/geography/maine/current/23_ME_CD119.txt", bytes: 942_772, sha256: "7920db5f0c0fb4f7029547f5fb7ee79b4454a811929764dfc795b981f610299e" },
];

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assertPinned = (bytes, expected, code) => {
  if (bytes.length !== expected.bytes || sha(bytes) !== expected.sha256) throw new Error(`${code}_DRIFT`);
};
const retain = async (path, bytes, code) => {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`${code}_OUTPUT_CONFLICT`); }
};

for (const source of sources) {
  let stdout;
  try { ({ stdout } = await run("curl", ["-fsSL", "--max-time", "60", "-A", "dsa-seats factual source acquisition contact=admin@dsaslate.us", source.url], { encoding: null, maxBuffer: 2_000_000 })); }
  catch (error) { throw new Error(`MAINE_GEOGRAPHY_FETCH_HTTP:${source.id}:${String(error)}`); }
  const bytes = Buffer.from(stdout);
  assertPinned(bytes, source, `MAINE_GEOGRAPHY_FETCH:${source.id}`);
  await retain(source.path, bytes, `MAINE_GEOGRAPHY_FETCH:${source.id}`);
}

const temp = await mkdtemp(join(tmpdir(), "dsa-seats-maine-geography-"));
try {
  const path = join(temp, "pl-2021-c487.txt");
  await run("pdftotext", ["-layout", sources[1].path, path]);
  const bytes = await readFile(path);
  assertPinned(bytes, pdfText, "MAINE_GEOGRAPHY_PLAN_TEXT");
  await retain(pdfText.path, bytes, "MAINE_GEOGRAPHY_PLAN_TEXT");
} finally { await rm(temp, { recursive: true, force: true }); }

for (const bundle of bundles) {
  const archive = await readFile(bundle.archivePath);
  if (archive.length !== bundle.archiveBytes || sha(archive) !== bundle.archiveSha256) throw new Error(`MAINE_GEOGRAPHY_PARENT_DRIFT:${bundle.id}`);
  const member = unzipSync(archive)[bundle.member];
  if (!member) throw new Error(`MAINE_GEOGRAPHY_MEMBER_MISSING:${bundle.id}`);
  let bytes = Buffer.from(member);
  if (bundle.member === "NationalCD119.txt") {
    const lines = bytes.toString("utf8").split(/\r?\n/);
    if (lines[0] !== "GEOID,CDFP") throw new Error("MAINE_GEOGRAPHY_CD119_HEADER_INVALID");
    const rows = lines.slice(1).filter((line) => line.startsWith("23"));
    if (rows.length !== 47_138 || rows.some((line) => !/^23\d{13},(?:01|02)$/.test(line))) throw new Error("MAINE_GEOGRAPHY_CD119_PROJECTION_INVALID");
    bytes = Buffer.from(`${lines[0]}\r\n${rows.join("\r\n")}\r\n`, "utf8");
  }
  assertPinned(bytes, bundle, `MAINE_GEOGRAPHY_EXTRACT:${bundle.id}`);
  await retain(bundle.path, bytes, `MAINE_GEOGRAPHY_EXTRACT:${bundle.id}`);
}

console.log(JSON.stringify({ sources: sources.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })), derivedPlanText: pdfText, censusExtracts: bundles.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })) }, null, 2));
