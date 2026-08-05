import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  ["nc-2022-primary-official-results-archive", "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_05_17/results_pct_20220517.zip", "data/source/elections/primary-results/north-carolina/2022/official-results.zip", 2181778, "705b203290e4131455d3e1d3bb31cf496260c68c88cbe734b84bda5318ede3c1", "zip"],
  ["nc-2022-primary-state-canvass-by-contest", "https://s3.amazonaws.com/dl.ncsbe.gov/State_Board_Meeting_Docs/2022-06-09/Canvass/State_Composite_Abstract_Report_by_Contest.pdf", "data/source/elections/primary-results/north-carolina/2022/state-canvass-by-contest.pdf", 674350, "113d6104e0d75106f9641888c30e5a029de00a2e8755ddb4006e4f21a804c194", "pdf"],
  ["nc-2024-primary-official-results-archive", "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_03_05/results_pct_20240305.zip", "data/source/elections/primary-results/north-carolina/2024/official-results.zip", 4464845, "0b0475a6df5ecd0d47a21ee51c96782934de768f8ef60eb3a9ae7d83021fea30", "zip"],
  ["nc-2024-primary-state-canvass-by-contest", "https://s3.amazonaws.com/dl.ncsbe.gov/State_Board_Meeting_Docs/2024-03-26/Canvass/Canvass%20Certification%20of%20State%20Jurisdiction%20Contests%20032624.pdf", "data/source/elections/primary-results/north-carolina/2024/state-canvass-by-contest.pdf", 324231, "1c5259b244ee50474d7105c28b1fd50ff3b8ef76c697759a06dbc9d812e20b00", "pdf"],
  ["nc-2026-primary-official-results-archive", "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_03_03/results_pct_20260303.zip", "data/source/elections/primary-results/north-carolina/2026/official-results.zip", 1427371, "d5450bfad8386ab12cf69f558776c79bc2301f89d33cce510de0fb7a26add484", "zip"],
].map(([id, url, output, byteSize, sha256, format]) => ({ id, url, output, byteSize, sha256, format }));

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));

async function writeExact(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) {
    if (error.code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw new Error(`NC_PRIMARY_OUTPUT_CONFLICT:${path}`);
  }
}

for (const source of sources) {
  const entry = byId.get(source.id);
  if (!entry || entry.url !== source.url || entry.retainedPath !== source.output || entry.retainedStatus !== "retained" || entry.byteSize !== source.byteSize || entry.sha256 !== source.sha256 || entry.kind !== "source" || entry.parentIds.length !== 0) throw new Error(`NC_PRIMARY_SOURCE_LOCK_ENTRY_INVALID:${source.id}`);
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { accept: "application/octet-stream", "user-agent": "dsa-seats-source-lock/1.0" } });
  if (!response.ok) throw new Error(`NC_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const signature = source.format === "zip" ? Buffer.from([0x50, 0x4b, 0x03, 0x04]) : Buffer.from("%PDF-", "ascii");
  if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || !bytes.subarray(0, signature.length).equals(signature)) throw new Error(`NC_PRIMARY_SOURCE_DRIFT:${source.id}`);
  await writeExact(resolve(source.output), bytes);
  process.stdout.write(`${JSON.stringify({ id: source.id, url: source.url, output: resolve(source.output), byteSize: bytes.byteLength, sha256: sha(bytes) })}\n`);
}
