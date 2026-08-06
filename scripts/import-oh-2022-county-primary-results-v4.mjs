import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.OH_2022_COUNTY_PRIMARY_V4_IMPORT_DIR;
if (!sourceDirectory) throw new Error("OH_2022_COUNTY_PRIMARY_V4_IMPORT_DIR_REQUIRED");

const sources = [
  ["fulton-results-index.html", "data/source/elections/primary-results/ohio/2022/county-boe/fulton-results-index.html", 40770, "1d1a2de563c8be754d55aa78a626a4ba7f75841c94db53b452b9b4fe844be14a"],
  ["fulton-2022-may03-official-results.html", "data/source/elections/primary-results/ohio/2022/county-boe/fulton-official-results-wrapper.html", 633, "88f3569dafed2565e17bc173a7e03ab64dd222a25d2db503e3d414e32c10353e"],
  ["fulton-summary.json", "data/source/elections/primary-results/ohio/2022/county-boe/fulton-official-summary.json", 23285, "37fcf6413875aef655d54f68024fc8e76ba9540d3c326e5bc34804f1231a693c"],
  ["stark-pri22.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/stark-official-tabulation.pdf", 416122, "58de21d502f2946d81b28911eea0e7d98a854fad732f1156ee28f4380ccc576f"],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const acquired = [];
for (const [inputName, retainedPath, byteSize, sha256] of sources) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`OH_2022_COUNTY_PRIMARY_V4_SOURCE_DRIFT:${inputName}`);
  acquired.push({ retainedPath, bytes });
}
for (const { retainedPath, bytes } of acquired) {
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`OH_2022_COUNTY_PRIMARY_V4_OUTPUT_CONFLICT:${retainedPath}`); }
}
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, sourceCutoff: "2026-08-06", lifecycle: "retained_reviewer_only_not_published" })}\n`);
