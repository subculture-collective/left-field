import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const contests = [
  [2022, "03", "258", 355, "d05f384e9bc6925c79de530bdd57357ac7a9c8ef1bdaa05b0a3d2a67cf05f6c9"],
  [2022, "16", "259", 300, "c073b50ed9dd06436092f0ac26e75dc6df167152d9647abd8577a9a4d284cb88"],
  [2022, "17", "260", 317, "e1b0cd810fce8da96af48c311c6872966c749ed32eef50a9c1ea45a5160287b7"],
  [2022, "18", "263", 303, "a99cd4988b7ed5f77fbc59c5e9a44574b726feb004a0fedc3a08a8d39e1c547c"],
  [2022, "19", "264", 557, "7a768ebd10737d9ff0c79d23ee03e59cd9b18539e4642403e120f5cc5b813136"],
  [2022, "20", "265", 301, "10b997bb0391a3cadd4134ef53400e75bab693be3ed0e76747f229365b0b34f0"],
  [2022, "21", "266", 676, "23841afa411fb9a9b2cc6cd4b46223eae351bead9a7774b9d6c5e1fb255b0580"],
  [2022, "22", "267", 370, "64d12c4a91592a9516e36533e046f672b02a1be26b85be523cfdc9c5a19dc543"],
  [2022, "26", "271", 225, "c6e9d393cf686f57d509aded019f10437a387f8e94cfe33401fd5cf857d0ccce"],
  [2024, "16", "5580", 233, "607ec9216464c5c0a568c4ba44030f8d10a1c229ef402e304dab1aff2218c30a"],
  [2024, "22", "5567", 329, "ae47deb4c60b45cf62b66c6408cb9155dc0e808ec448ad57d94eecd12c9cc620"],
].map(([cycleYear, districtCode, contestAuthorityId, byteSize, sha256]) => ({
  id: `ny-${cycleYear}-house-democratic-primary-cd-${districtCode}-contest-${contestAuthorityId}`,
  url: `https://ny.elstats3.civera.com/api/download_contest/${contestAuthorityId}_table.csv?split_party=false`,
  output: `data/source/elections/primary-results/new-york/${cycleYear}/ny-cd-${districtCode}-contest-${contestAuthorityId}.csv`,
  cycleYear, districtCode, contestAuthorityId, byteSize, sha256,
}));
const documents = [
  { id: "ny-2022-house-primary-official-results-document", url: "https://ny.elstats-staging.com/eng/files/serve/132", output: "data/source/elections/primary-results/new-york/2022/official-primary-results-document.pdf", byteSize: 223185, sha256: "f447e20c9b87a99ec615aef60758f1e3d7136ccb6b05ea84f756ea1fef8ae13d" },
  { id: "ny-2024-house-primary-official-results-document", url: "https://ny.elstats-staging.com/eng/files/serve/472", output: "data/source/elections/primary-results/new-york/2024/official-primary-results-document.pdf", byteSize: 72053, sha256: "0a8fe8217c4d20e66856994b6dee088caadd8b675e7a4312b2dbd2e636603c00" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function writeExact(path, bytes) { await mkdir(dirname(path), { recursive: true }); try { await writeFile(path, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error(`NY_PRIMARY_OUTPUT_CONFLICT:${path}`); } }
async function acquire(source, kind) {
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`NY_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256) throw new Error(`NY_PRIMARY_SOURCE_DRIFT:${source.id}`);
  if (kind === "contest" && bytes.subarray(0, 2).toString("ascii") !== ",,") throw new Error(`NY_PRIMARY_CROSSTAB_INVALID:${source.id}`);
  if (kind === "document" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`NY_PRIMARY_DOCUMENT_INVALID:${source.id}`);
  await writeExact(resolve(source.output), bytes);
  process.stdout.write(`${JSON.stringify({ kind, ...source, output: resolve(source.output) })}\n`);
}
for (const source of contests) await acquire(source, "contest");
for (const source of documents) await acquire(source, "document");
