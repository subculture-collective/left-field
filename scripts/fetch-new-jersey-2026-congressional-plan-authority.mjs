import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const sources = [
  ["https://www.nj.gov/state/elections/doe-publications.shtml", "data/source/elections/primary-results/geography/new-jersey/2026/division-of-elections-publications.html", "8467d476299f067bee7730c4d3166815a10c712eb03677a2bc762cb5e850e305"],
  ["https://www.nj.gov/state/elections/assets/pdf/2022-congressional-districts/2022-2031-congressional-map.pdf", "data/source/elections/primary-results/geography/new-jersey/2026/2022-2031-congressional-map.pdf", "50b402ec5e72d748c9a0df0874da47b5033bfef7bc23051b0f1971df1d8d5989"],
  ["https://www.nj.gov/state/dos-statutes-elections-19-40-49.shtml", "data/source/elections/primary-results/geography/new-jersey/2026/njsa-19-46-12.html", "674521be68ed4439af64067039350b3e02d9781acaa89aad806568e8013941d1"],
  ["https://www.nj.gov/state/elections/assets/pdf/2022-congressional-districts/njcd-2022-plan-components-report.pdf", "data/source/elections/primary-results/geography/new-jersey/2026/njcd-2022-plan-components-report.pdf", "2e12b2f7c9ef3537797179ce289ae1141e72eb0222eeda7b6afbf5382b37f994"],
];
const bundle = resolve("data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
const extractPath = resolve("data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function writeCreateOnly(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if (error.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`NEW_JERSEY_2026_SOURCE_OUTPUT_CONFLICT:${path}`);
  }
}

async function main() {
  const cacheIndex = process.argv.indexOf("--cache-dir");
  const cacheDir = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : null;
  if (cacheIndex >= 0 && !cacheDir) throw new Error("NEW_JERSEY_2026_CACHE_DIR_MISSING");
  const retained = [];
  for (const [url, relativePath, expectedSha256] of sources) {
    let bytes;
    if (cacheDir) bytes = await readFile(resolve(cacheDir, basename(relativePath)));
    else {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`NEW_JERSEY_2026_SOURCE_HTTP:${response.status}:${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (sha(bytes) !== expectedSha256) throw new Error(`NEW_JERSEY_2026_SOURCE_DRIFT:${url}`);
    const path = resolve(relativePath);
    await writeCreateOnly(path, bytes);
    retained.push({ url, path: relativePath, byteSize: bytes.length, sha256: sha(bytes) });
  }
  for (const [pdfName, textName] of [["2022-2031-congressional-map.pdf", "2022-2031-congressional-map.txt"], ["njcd-2022-plan-components-report.pdf", "njcd-2022-plan-components-report.txt"]]) {
    const pdfPath = resolve("data/source/elections/primary-results/geography/new-jersey/2026", pdfName);
    const textPath = resolve("data/source/elections/primary-results/geography/new-jersey/2026", textName);
    const bytes = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { maxBuffer: 16 * 1024 * 1024 });
    await writeCreateOnly(textPath, bytes);
    retained.push({ url: `urn:dsa-seats:${pdfName}:pdftotext-layout-26.07.0`, path: `data/source/elections/primary-results/geography/new-jersey/2026/${textName}`, byteSize: bytes.length, sha256: sha(bytes) });
  }
  const national = execFileSync("unzip", ["-p", bundle, "NationalCD119.txt"], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
  const lines = national.split(/\r?\n/);
  if (lines[0] !== "GEOID,CDFP") throw new Error("NEW_JERSEY_2026_CENSUS_HEADER_INVALID");
  const stateLines = lines.slice(1).filter((line) => line.startsWith("34"));
  const extract = Buffer.from(`GEOID,CDFP\r\n${stateLines.join("\r\n")}\r\n`);
  await writeCreateOnly(extractPath, extract);
  retained.push({ url: "urn:dsa-seats:census-cd119-bef:NationalCD119.txt:state-fips-34", path: "data/source/elections/primary-results/geography/new-jersey/current/34_NJ_CD119.txt", byteSize: extract.length, sha256: sha(extract), rows: stateLines.length });
  process.stdout.write(`${JSON.stringify({ retained }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
