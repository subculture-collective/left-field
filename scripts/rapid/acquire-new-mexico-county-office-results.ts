import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  { year: 2022, url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=CTY&map=CTY&eid=2827", path: "data/source/rapid/county-office/nm/2022/county-results.csv", bytes: 41053, sha256: "b624b7021f74775fd1d098c2d4d0285695cd6bb77f51b5d309f2b07c07650f28" },
  { year: 2024, url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=CTY&map=CTY&eid=2878", path: "data/source/rapid/county-office/nm/2024/county-results.csv", bytes: 34476, sha256: "84627dda5e6e37d02906eb39228cc63bbf1a1e1aefa183fb6ca290516d8b4063" },
  { year: 2026, url: "https://electionresults.sos.nm.gov/resultsCSV.aspx?text=All&type=CTY&map=CTY", path: "data/source/rapid/county-office/nm/2026/county-results.csv", bytes: 48450, sha256: "fd48137016daea1fe245fcdb4e90d8ca61ba414029b3b5467cb2159e28b7bd4b" },
] as const;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  for (const source of sources) {
    try { const retained = await readFile(source.path); if (retained.length === source.bytes && sha(retained) === source.sha256) continue; throw new Error(`NEW_MEXICO_COUNTY_OFFICE_OUTPUT_CONFLICT:${source.year}`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "dsa-seats factual source acquisition contact=admin@dsaslate.us" } });
    if (!response.ok) throw new Error(`NEW_MEXICO_COUNTY_OFFICE_FETCH_HTTP:${source.year}:${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEW_MEXICO_COUNTY_OFFICE_FETCH_DRIFT:${source.year}`);
    await mkdir(dirname(source.path), { recursive: true }); try { await writeFile(source.path, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(source.path)).equals(bytes)) throw new Error(`NEW_MEXICO_COUNTY_OFFICE_OUTPUT_CONFLICT:${source.year}`); }
  }
  process.stdout.write(`${JSON.stringify({ sources }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "NEW_MEXICO_COUNTY_OFFICE_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
