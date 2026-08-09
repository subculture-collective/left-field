import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  {
    cycleYear: 2022,
    url: "https://web.archive.org/web/20221012153409id_/https://www.nvsos.gov/SOSelectionPages/results/2022StateWidePrimary/ElectionSummary.aspx",
    path: "data/source/rapid/house-primary/nv/2022/official-statewide-primary-results.html",
    bytes: 151_291,
    sha256: "27ed1dbcb552cb0ff0d3ee279ecdbc23d4ad4a87b8771f06bdcbbadfee56067b",
  },
  {
    cycleYear: 2024,
    url: "https://web.archive.org/web/20241110200634id_/https://www.nvsos.gov/SOSelectionPages/results/2024StateWidePrimary/ElectionSummary.aspx",
    path: "data/source/rapid/house-primary/nv/2024/official-statewide-primary-results.html",
    bytes: 93_196,
    sha256: "86ef6aac14bfa8778a0aca703b6803e19f739604fde9ec716effff8fafc43678",
  },
] as const;

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  for (const source of sources) {
    const response = await fetch(source.url, { headers: { "user-agent": "Mozilla/5.0 dsa-seats factual source acquisition contact=admin@dsaslate.us" } });
    if (!response.ok) throw new Error(`NEVADA_PRIMARY_FETCH_HTTP:${source.cycleYear}:${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`NEVADA_PRIMARY_SOURCE_DRIFT:${source.cycleYear}`);
    await mkdir(dirname(source.path), { recursive: true });
    try { await writeFile(source.path, bytes, { flag: "wx", mode: 0o644 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(source.path)).equals(bytes)) throw new Error(`NEVADA_PRIMARY_OUTPUT_CONFLICT:${source.cycleYear}`); }
  }
  process.stdout.write(`${JSON.stringify({ retained: sources }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "NEVADA_PRIMARY_ACQUISITION_FAILED"}\n`);
  process.exitCode = 1;
});
