import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { id: "wa-2022-house-primary-results", url: "https://results.vote.wa.gov/results/20220802/export/20220802_congressional.csv", output: "data/source/elections/primary-results/wa-2022-house-primary.csv", byteSize: 10929, sha256: "e6be25e87a37cf1e577c2678cd172083d860d25b7b9480ea0bd09ca73c72bfa8" },
  { id: "wa-2024-house-primary-results", url: "https://results.vote.wa.gov/results/20240806/export/20240806_congressional.csv", output: "data/source/elections/primary-results/wa-2024-house-primary.csv", byteSize: 9671, sha256: "244c1ebb89a9211e254e1115aacfe814f502b96a97552dff7791942c2eff8135" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function writeExact(path, bytes) { await mkdir(dirname(path), { recursive: true }); try { await writeFile(path, bytes, { mode: 0o644, flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(path)).equals(bytes)) throw new Error(`WA_PRIMARY_RESULT_OUTPUT_CONFLICT:${path}`); } }
for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow" }); if (!response.ok) throw new Error(`WA_PRIMARY_RESULT_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || !bytes.subarray(0, 87).toString("ascii").startsWith('"Race","Candidate","Party","Votes","PercentageOfTotalVotes","JurisdictionName"')) throw new Error(`WA_PRIMARY_RESULT_BYTES_MISMATCH:${source.id}`);
  await writeExact(resolve(source.output), bytes); process.stdout.write(`${JSON.stringify({ id: source.id, output: resolve(source.output), byteSize: bytes.byteLength, sha256: sha(bytes) })}\n`);
}
