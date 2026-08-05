import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const captureDir = process.env.NY_PRIMARY_CERT_CAPTURE_DIR;
if (!captureDir) throw new Error("NY_PRIMARY_CERT_CAPTURE_DIR_REQUIRED");

const sources = [
  { year: 2022, name: "2022.pdf", output: "data/source/elections/primary-results/new-york/2022/official-primary-ballot-certification.pdf", byteSize: 459911, sha256: "ad7c4d99a0a561ac7bff1c4888c776ea921f5b0b08cebb85246f3c7f6cbdb53d" },
  { year: 2024, name: "2024.pdf", output: "data/source/elections/primary-results/new-york/2024/official-primary-ballot-certification.pdf", byteSize: 1369420, sha256: "9b102d07b67f5dea488c22bf4d3be03d6459c39cd7e36b651fd2bbb27982d5eb" },
];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const source of sources) {
  const bytes = await readFile(resolve(captureDir, source.name));
  if (bytes.byteLength !== source.byteSize || sha(bytes) !== source.sha256 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`NY_PRIMARY_CERT_CAPTURE_DRIFT:${source.year}`);
  const output = resolve(source.output);
  await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; if (!(await readFile(output)).equals(bytes)) throw new Error(`NY_PRIMARY_CERT_OUTPUT_CONFLICT:${source.year}`); }
  process.stdout.write(`${JSON.stringify({ ...source, output })}\n`);
}
