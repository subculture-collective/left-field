import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  { id: "nm-2022-primary-federal-results-csv", url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=FED&map=CTY&eid=2827", path: "data/source/elections/primary-results/new-mexico/2022/federal-results.csv", bytes: 1101, sha256: "84f5087d62a523f35905bf63c9de2c136e311ed1bdf54eec9ff70ffd297235c9" },
  { id: "nm-2022-election-results-archive", url: "https://www.sos.nm.gov/sos-archive/election-results-archive/2022-election-results/", path: "data/source/elections/primary-results/new-mexico/2022/election-results-archive.html", bytes: 121679, sha256: "8b2198173eeeb6faf26586e68b37795e054c7b6cc20c18c07c87e14e7d510e50" },
  { id: "nm-2024-primary-federal-results-csv", url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=FED&map=CTY&eid=2878", path: "data/source/elections/primary-results/new-mexico/2024/federal-results.csv", bytes: 2578, sha256: "6242f02e83e5b10a510bba2486124aeba1e5c13886f94d1a75066766d90ac4d1" },
  { id: "nm-2024-primary-certification-announcement", url: "https://www.sos.nm.gov/2024/06/25/state-canvass-board-certifies-2024-primary-election-results-orders-automatic-recounts/", path: "data/source/elections/primary-results/new-mexico/2024/certification-announcement.html", bytes: 85869, sha256: "a0a5764058fc9de6913bf0721d56773140977af6a1fb73a91ff7a20c254ef55c" },
  { id: "nm-2026-primary-federal-results-csv", url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=FED&map=CTY", path: "data/source/elections/primary-results/new-mexico/2026/federal-results.csv", bytes: 1413, sha256: "10727ff853f4a435e1b0dd421fbb4dfca17ce1907de4b895c924ef9babaf96ad" },
  { id: "nm-2026-primary-certification-announcement", url: "https://www.sos.nm.gov/2026/06/23/state-canvass-board-certifies-2026-primary-election-results-orders-automatic-recounts/", path: "data/source/elections/primary-results/new-mexico/2026/certification-announcement.html", bytes: 86270, sha256: "dfe726f4fa455da963c4c306a229537d0e7d0d716dec5aa9d359ea5eecc46d58" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "dsa-seats factual source acquisition contact=admin@dsaslate.us" } });
  if (!response.ok) throw new Error(`NEW_MEXICO_PRIMARY_FETCH_HTTP:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_MEXICO_PRIMARY_FETCH_DRIFT:${source.id}`);
  await mkdir(dirname(source.path), { recursive: true });
  try { await writeFile(source.path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(source.path)).equals(bytes)) throw new Error(`NEW_MEXICO_PRIMARY_FETCH_OUTPUT_CONFLICT:${source.id}`); }
}
console.log(JSON.stringify({ sources: sources.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })) }, null, 2));
