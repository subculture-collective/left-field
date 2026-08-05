import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = [
  { year: 2022, id: "md-2022-democratic-primary-congressional-breakdown", url: "https://elections.maryland.gov/elections/archive/2022/election_data/GP22_CongressionalBreakDownDemocratic.csv", output: "data/source/elections/primary-results/maryland/2022/democratic-congressional-breakdown.csv", byteSize: 121637, sha256: "b684c50946c5c9222d6a562df7e172fbabfbd5b31deb8d35beeefca9565a95b9" },
  { year: 2024, id: "md-2024-democratic-primary-congressional-breakdown", url: "https://elections.maryland.gov/elections/archive/2024/election_data/PP24_CongressionalBreakDownDemocratic.csv", output: "data/source/elections/primary-results/maryland/2024/democratic-congressional-breakdown.csv", byteSize: 32067, sha256: "6000bfe1ee1f11b34dc64fbe136745cdad88a04132a8a2bed2aab5a3113213d3" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of sources) {
  const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`MD_PRIMARY_FETCH_FAILED:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || !bytes.subarray(0, 64).toString("utf8").startsWith('"County","County Name","Office Name"')) throw new Error(`MD_PRIMARY_SOURCE_DRIFT:${source.id}`);
  const output = resolve(source.output); await mkdir(dirname(output), { recursive: true }); try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(output)).equals(bytes)) throw new Error(`MD_PRIMARY_OUTPUT_CONFLICT:${source.id}`); }
  process.stdout.write(`${JSON.stringify({ ...source, output })}\n`);
}
