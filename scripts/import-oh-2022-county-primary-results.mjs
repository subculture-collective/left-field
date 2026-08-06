import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.OH_2022_COUNTY_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("OH_2022_COUNTY_PRIMARY_IMPORT_DIR_REQUIRED: provide the exact official county-BOE capture directory");

const sources = [
  ["hamilton-2022-may03-official-cumulative-no-prec-execs.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/hamilton-official-cumulative.pdf", 372037, "43298f4a4f5cf37b3a18a5cc66f88b4bf29c4136fb7ea092268ffa257341ab22"],
  ["franklin-2022-may03-official-group-detail.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/franklin-official-group-detail.pdf", 268555, "d75ce506f457d7974b4a8410b3f82996238bad19f802209494a4099667d1fffa"],
  ["wood-2022-may03-official-summary.pdf", "data/source/elections/primary-results/ohio/2022/county-boe/wood-official-summary.pdf", 192093, "e7d43e9bbf0a471e91b3aae25ffc7ff6c04b409161d057ca7614e207c35e19bb"],
  ["cuyahoga-2022-may03-official-results-by-contest", "data/source/elections/primary-results/ohio/2022/county-boe/cuyahoga-official-results-by-contest.html", 262144, "a88f4724ed265e406fd5d711b402a07c753bb704e1eda4d8e3af97da8ebdbfb6"],
  ["summit-2022-may03-amended-official-summary.html", "data/source/elections/primary-results/ohio/2022/county-boe/summit-amended-official-summary.html", 174228, "c76d2eafd052ff23404c6f4ea259de70e1f56a3c976f9773ad24f9773142abf1"],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const [inputName, retainedPath, byteSize, sha256] of sources) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`OH_2022_COUNTY_PRIMARY_SOURCE_DRIFT:${inputName}`);
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`OH_2022_COUNTY_PRIMARY_OUTPUT_CONFLICT:${retainedPath}`); }
}
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, sourceCutoff: "2026-08-06", lifecycle: "retained_reviewer_only_not_published" })}\n`);
