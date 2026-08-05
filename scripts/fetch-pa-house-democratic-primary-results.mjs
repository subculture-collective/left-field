import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { id: "pa-2022-primary-returns-readme", url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/ElectionReturns_2022_Primary_ReadMeFile.txt", output: "data/source/elections/primary-results/pennsylvania/2022/readme.txt", byteSize: 4437, sha256: "4ebc90ca1cd9609f95c06ac9f7faafb5f8e443759e856a75bce91c00f9ff0d66", prefix: "Commonwealth of Pennsylvania" },
  { id: "pa-2022-primary-precinct-returns", url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/ElectionReturns_2022_Primary_PrecinctReturns.txt", output: "data/source/elections/primary-results/pennsylvania/2022/precinct-returns.txt", byteSize: 56032507, sha256: "1086f75db02d6862ef5ed4405c0fe96fe11b1acfceb0234f307d8d65d4b517bb", prefix: '"2022","P",' },
  { id: "pa-2024-primary-returns-readme", url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/electionreturns_2024_primary_readme.txt", output: "data/source/elections/primary-results/pennsylvania/2024/readme.txt", byteSize: 5316, sha256: "18785dce8d2f11be33c117f7d264244a6234291a6396f144523d8da89be98ceb", prefix: "Commonwealth of Pennsylvania" },
  { id: "pa-2024-primary-precinct-returns", url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/electionreturns_2024_primary_precinctreturns.txt", output: "data/source/elections/primary-results/pennsylvania/2024/precinct-returns.txt", byteSize: 63882614, sha256: "98be2859553825262f8f724599a33921960fdb31af5e3549d603e333792eb07b", prefix: "2024.0,P," },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const lock = JSON.parse(await readFile(resolve("data/source-lock.json"), "utf8"));
const byId = new Map(lock.entries.map((entry) => [entry.id, entry]));
for (const source of sources) {
  const entry = byId.get(source.id);
  if (!entry || entry.url !== source.url || entry.retainedPath !== source.output || entry.retainedStatus !== "retained" || entry.byteSize !== source.byteSize || entry.sha256 !== source.sha256 || entry.kind !== "source") throw new Error(`PA_PRIMARY_SOURCE_LOCK_ENTRY_INVALID:${source.id}`);
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`PA_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || !bytes.subarray(0, source.prefix.length).toString("latin1").startsWith(source.prefix)) throw new Error(`PA_PRIMARY_SOURCE_DRIFT:${source.id}`);
  const output = resolve(source.output); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`PA_PRIMARY_OUTPUT_CONFLICT:${source.id}`); }
  process.stdout.write(`${JSON.stringify({ id: source.id, output, byteSize: bytes.byteLength, sha256: sha(bytes) })}\n`);
}
