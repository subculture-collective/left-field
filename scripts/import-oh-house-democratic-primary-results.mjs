import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.OH_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("OH_PRIMARY_IMPORT_DIR_REQUIRED: provide the exact normal-browser Ohio SOS capture bundle");

const sources = [
  ["files-index.json", "data/source/elections/primary-results/ohio/portal/files-index-20260806.json", 363585, "738eb258e436459b7bb3e5ad6091e9753f60d0a9b3adeb68f7d0fc76be5da056"],
  ["2022-may-03-manifest-extract.json", "data/source/elections/primary-results/ohio/2022/may-03-portal-manifest-extract.json", 5062, "69596596733a6a88b3433a56bd85a777e018ba8851a1f8ae0cd882259c30dc86"],
  ["2022-may-03-democratic-summary.xlsx", "data/source/elections/primary-results/ohio/2022/may-03-democratic-summary.xlsx", 62772, "8ce6af5fce316abea9cfd3477926093e20f1eba4e54edc943a83ec1a5a8a8e9c"],
  ["2024-mar-19-democratic-summary.xlsx", "data/source/elections/primary-results/ohio/2024/march-19-democratic-summary.xlsx", 156100, "94b4ec212bc03bd90d8fe9f0acedac591affbe91a71aa02d63c73e703660ed64"],
  ["2026-may-05-democratic-summary.xlsx", "data/source/elections/primary-results/ohio/2026/may-05-democratic-summary.xlsx", 261632, "d29da75827f0375a92e26a934e37e742a6cb46c1c5638912246312b0a0293118"],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const [inputName, retainedPath, byteSize, sha256] of sources) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`OH_PRIMARY_SOURCE_DRIFT:${inputName}`);
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`OH_PRIMARY_OUTPUT_CONFLICT:${retainedPath}`); }
}
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, sourceCutoff: "2026-08-06", lifecycle: "retained_reviewer_only_not_published" })}\n`);
