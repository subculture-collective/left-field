import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const sources = [
  { id: "maine-2022-election-results-index", url: "https://www.maine.gov/sos/elections-voting/election-results-data/election-results-2022", path: "data/source/elections/primary-results/maine/2022/results-index.html", bytes: 91949, sha256: "6aa4043e4381dd478001c13dd44cf9cc0cf3b123b6eb69bc00faf7c2bc040c3c" },
  { id: "maine-2022-house-democratic-primary-cd01-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/dist1reptocong622.xlsx", path: "data/source/elections/primary-results/maine/2022/democratic-cd01.xlsx", bytes: 23933, sha256: "ccc458e06f6e32e0254c72e7f6c5aae1945d002830e59ce0c52af7f81fe4247c" },
  { id: "maine-2022-house-democratic-primary-cd02-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/dist2reptocong622.xlsx", path: "data/source/elections/primary-results/maine/2022/democratic-cd02.xlsx", bytes: 39910, sha256: "0862338441e04b99ec6eeafbe38e83bdcc50bc55f595d962df73973bd35e35a3" },
  { id: "maine-2024-election-results-index", url: "https://www.maine.gov/sos/elections-voting/election-results-data/election-results-2024", path: "data/source/elections/primary-results/maine/2024/results-index.html", bytes: 89290, sha256: "c7629e287de1ad4a54bf6cea39b82f4e5bea15f702b38535a3a4b15241b9acca" },
  { id: "maine-2024-house-democratic-primary-cd01-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/2-20Rep-20to-20Congress-20Dist-201-20Dem-20--20FINAL.xlsx", path: "data/source/elections/primary-results/maine/2024/democratic-cd01.xlsx", bytes: 22841, sha256: "d5bc8beab80e6d93b0d46c925b36d604e2168b339545b92a960c928a5061179e" },
  { id: "maine-2024-house-democratic-primary-cd02-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/content/assets/3-20Rep-20to-20Congress-20Dist-202-20Dem--20FINAL.xlsx", path: "data/source/elections/primary-results/maine/2024/democratic-cd02.xlsx", bytes: 29362, sha256: "9b52fa0124f30b6bc3fd296b52d81270720ce49ddcefe4c6ef11412d77ab13d4" },
  { id: "maine-2026-election-results-index", url: "https://www.maine.gov/sos/elections-voting/election-results-data", path: "data/source/elections/primary-results/maine/2026/results-index.html", bytes: 102103, sha256: "9ad0566686fe3d7a8365c07cf1c2ea0af8e975d63e09e4adc770034094b74eb4" },
  { id: "maine-2026-house-democratic-primary-cd01-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Rep%20to%20Congress%20Dist%201%20FINAL.xlsx", path: "data/source/elections/primary-results/maine/2026/democratic-cd01.xlsx", bytes: 18714, sha256: "18656f07026c2dd1532f8597f920295f13700ca7ab7b1e7e841c805f0a16c11a" },
  { id: "maine-2026-house-democratic-primary-cd02-first-choice-results", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/Representative%20to%20Congress%20District%202%20-%20Democratic.xlsx", path: "data/source/elections/primary-results/maine/2026/democratic-cd02-first-choice.xlsx", bytes: 42349, sha256: "6f0df9d41a38bff5180ef9bbee6b048f87092aada34343b6ff474b9ba6b2dea5" },
  { id: "maine-2026-house-democratic-primary-cd02-rcv-summary", url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/CG2%20Democratic%20RCV%20Summary%20Report.pdf", path: "data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.pdf", bytes: 36422, sha256: "d308d461baf07b2ca4ebaab087eea30ad118710e19a67c3c9c54cb8fcad2ad38" },
];

const extract = { path: "data/source/elections/primary-results/maine/2026/democratic-cd02-rcv-summary.txt", bytes: 949, sha256: "64a534b9204e1291a2fb567d7d70adcdc302dac1f75c749f6f4c78d8b0719f60" };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const retain = async (path, bytes, code) => {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`${code}_OUTPUT_CONFLICT`); }
};

for (const source of sources) {
  const response = await fetch(source.url, { headers: { "user-agent": "dsa-seats factual source acquisition contact=admin@dsaslate.us" }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`MAINE_PRIMARY_FETCH_HTTP:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`MAINE_PRIMARY_FETCH_DRIFT:${source.id}`);
  await retain(source.path, bytes, `MAINE_PRIMARY_FETCH:${source.id}`);
}

const temp = await mkdtemp(join(tmpdir(), "dsa-seats-maine-rcv-"));
try {
  const path = join(temp, "summary.txt");
  await run("pdftotext", ["-layout", sources.at(-1).path, path]);
  const bytes = await readFile(path);
  if (bytes.length !== extract.bytes || sha(bytes) !== extract.sha256) throw new Error("MAINE_PRIMARY_RCV_EXTRACT_DRIFT");
  await retain(extract.path, bytes, "MAINE_PRIMARY_RCV_EXTRACT");
} finally { await rm(temp, { recursive: true, force: true }); }

console.log(JSON.stringify({ sources: sources.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })), derivedExtract: extract }, null, 2));
