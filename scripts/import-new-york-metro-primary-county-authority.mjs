import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const importDirectory = process.env.NY_METRO_PRIMARY_IMPORT_DIR;
if (!importDirectory) throw new Error("NY_METRO_PRIMARY_IMPORT_DIR_REQUIRED");

const sources = [
  {
    input: "ny-county-codes.html",
    output: "data/source/elections/primary-results/geography/new-york/current/census-county-codes.html",
    byteSize: 44_499,
    sha256: "954a0769119995337c524336cfd021e1bac8166489b5940ea7411e78f2cf03fa",
    required: ["State of New York Counties", "36103", "Suffolk", "Suffolk County"],
  },
  {
    input: "suffolk-election-results-index.html",
    output: "data/source/elections/primary-results/new-york/suffolk/2024/election-results-index.html",
    byteSize: 56_832,
    sha256: "9af10cdb290935248cf871e63d405db5268abde541a0e1a58c2ef44c34116685",
    required: ["Election Results from 2002 onwards", "Final Results", "Primary Election 2024", "https://apps2.suffolkcountyny.gov/boe/eleres/24pe/default.htm"],
  },
  {
    input: "suffolk-2024-cd01-democratic-final-results.html",
    output: "data/source/elections/primary-results/new-york/suffolk/2024/cd01-democratic-final-results.html",
    byteSize: 15_863,
    sha256: "ddfc71580b84aceadae6cd90f8bc2218a58cf0e6056e2234da7abde6f33279f8",
    required: ["Representative in Congress, 1st Congressional District", "561 Election Districts", "Avlon, John P", "Goroff, Nancy S", "27,636 Votes cast"],
  },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const source of sources) {
  const input = resolve(importDirectory, source.input);
  const bytes = await readFile(input);
  if (bytes.byteLength !== source.byteSize || sha256(bytes) !== source.sha256 || source.required.some((needle) => !bytes.includes(Buffer.from(needle)))) throw new Error(`NY_METRO_PRIMARY_IMPORT_SOURCE_INVALID:${source.input}`);
  const output = resolve(source.output);
  await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`NY_METRO_PRIMARY_IMPORT_OUTPUT_CONFLICT:${source.output}`); }
  process.stdout.write(`${JSON.stringify({ input, output, byteSize: bytes.byteLength, sha256: source.sha256 })}\n`);
}
