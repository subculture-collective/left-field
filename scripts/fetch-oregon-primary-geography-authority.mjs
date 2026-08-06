import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const sources = [
  ["https://www.oregonlegislature.gov/redistricting", "data/source/elections/primary-results/geography/oregon/2026/redistricting.html", "6245dc38c5f71b429ac84cd7c522e4abac0d48224883b9d479fbe3d2421e162a"],
  ["https://olis.oregonlegislature.gov/liz/2021S1/Downloads/MeasureDocument/SB881/Enrolled", "data/source/elections/primary-results/geography/oregon/2026/sb881-enrolled.pdf", "6df87e57e01ffcc2f91cea546cff87eb2841d99044e7abb02e1d68f4fa641873"],
  ["https://www.oregonlegislature.gov/lpro/mapsfaqs/Interactive_District_Map_Data.pdf", "data/source/elections/primary-results/geography/oregon/2026/interactive-map-data.pdf", "4638db7a6891d343add13cb82520e8852c5872a72a8a5dd6bb46381b9833b42c"],
];
const bundle = resolve("data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
const outputBase = resolve("data/source/elections/primary-results/geography/oregon/2026");
const extractPath = resolve("data/source/elections/primary-results/geography/oregon/current/41_OR_CD119.txt");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function writeCreateOnly(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (error.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`OREGON_2026_SOURCE_OUTPUT_CONFLICT:${path}`);
  }
}

async function main() {
  const cacheIndex = process.argv.indexOf("--cache-dir");
  const cacheDir = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : null;
  if (cacheIndex >= 0 && !cacheDir) throw new Error("OREGON_2026_CACHE_DIR_MISSING");
  const retained = [];
  for (const [url, relativePath, expectedSha256] of sources) {
    let bytes;
    if (cacheDir) bytes = await readFile(resolve(cacheDir, basename(relativePath)));
    else {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } });
      if (!response.ok) throw new Error(`OREGON_2026_SOURCE_HTTP:${response.status}:${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (sha(bytes) !== expectedSha256) throw new Error(`OREGON_2026_SOURCE_DRIFT:${url}`);
    await writeCreateOnly(resolve(relativePath), bytes);
    retained.push({ url, path: relativePath, byteSize: bytes.length, sha256: sha(bytes) });
  }
  for (const [pdfName, textName, expectedSha256] of [
    ["sb881-enrolled.pdf", "sb881-enrolled.txt", "2a152d43078a07eabe3755f6edb4374f8b18a0761d1d603b60cf59fd7afe2aff"],
    ["interactive-map-data.pdf", "interactive-map-data.txt", "620b4c8c01f9fd573f78686ef82c59b29a16724de3f2a2932bc6fbadfedef06a"],
  ]) {
    const bytes = execFileSync("pdftotext", ["-layout", resolve(outputBase, pdfName), "-"], { maxBuffer: 16 * 1024 * 1024 });
    if (sha(bytes) !== expectedSha256) throw new Error(`OREGON_2026_TEXT_DRIFT:${pdfName}`);
    await writeCreateOnly(resolve(outputBase, textName), bytes);
    retained.push({ url: `urn:dsa-seats:${pdfName}:pdftotext-layout-26.07.0`, path: `data/source/elections/primary-results/geography/oregon/2026/${textName}`, byteSize: bytes.length, sha256: sha(bytes) });
  }
  const national = execFileSync("unzip", ["-p", bundle, "NationalCD119.txt"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
  const lines = national.split(/\r?\n/);
  if (lines[0] !== "GEOID,CDFP") throw new Error("OREGON_2026_CENSUS_HEADER_INVALID");
  const stateLines = lines.slice(1).filter((line) => line.startsWith("41"));
  const extract = Buffer.from(`GEOID,CDFP\r\n${stateLines.join("\r\n")}\r\n`);
  if (stateLines.length !== 130807 || sha(extract) !== "34295664add30fff21d16739e5bbdf2e3a6dd1ba5b96c3f988371963f9625ad5") throw new Error("OREGON_2026_CENSUS_EXTRACT_DRIFT");
  await writeCreateOnly(extractPath, extract);
  retained.push({ url: "urn:dsa-seats:census-cd119-bef:NationalCD119.txt:state-fips-41", path: "data/source/elections/primary-results/geography/oregon/current/41_OR_CD119.txt", byteSize: extract.length, sha256: sha(extract), rows: stateLines.length });
  process.stdout.write(`${JSON.stringify({ retained }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
