import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.OH_2022_COUNTY_PRIMARY_V3_IMPORT_DIR;
if (!sourceDirectory) throw new Error("OH_2022_COUNTY_PRIMARY_V3_IMPORT_DIR_REQUIRED");

const sources = [
  ["warren-live-results.html", "data/source/elections/primary-results/ohio/2022/county-boe/warren-official-results.html", 12570673, "eace77a04275e47919af9dc08c1f8fece729b6b80a58c0497fffb782015fdca0"],
  ["erie-2022-may03-cumulative-results.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/erie-official-canvass.pdf", 160976, "e15821ff0bc19a6b532da77237f879740873869821ad05d4ce1f91ce642ab72a"],
  ["ottawa-amended-official-summary.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/ottawa-amended-official-summary.pdf", 48279, "1ba473a90485d1b35d75076d152556a7883d201ee7ae25d2b77e9c2cb34d576c"],
  ["sandusky-official-canvass-may-2022.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/sandusky-official-canvass.pdf", 212301, "2bdafad3985b1d1960e6e6b2d6c28bd760386af8d58d827832e76cb6711f9c27"],
  ["williams-official-cumulative-may-3-2022.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/williams-official-cumulative.pdf", 370181, "4d6c8a09907a172f60a9bde228a108c66b183c7cf1bfb58d910470ad752fe3c9"],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const [inputName, retainedPath, byteSize, sha256] of sources) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`OH_2022_COUNTY_PRIMARY_V3_SOURCE_DRIFT:${inputName}`);
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`OH_2022_COUNTY_PRIMARY_V3_OUTPUT_CONFLICT:${retainedPath}`); }
}
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, sourceCutoff: "2026-08-06", lifecycle: "retained_reviewer_only_not_published" })}\n`);
