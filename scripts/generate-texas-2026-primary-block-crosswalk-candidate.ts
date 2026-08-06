import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildTexas2026PrimaryBlockCrosswalkCandidate } from "../src/ingestion/elections/texas-2026-primary-block-crosswalk-candidate";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  const [geography, currentStatusBytes, enrolledLawBytes, datasetBytes, planBlocksBytes, currentBlocksBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/texas-primary-geography-compatibility-candidate-v1.json"),
    readFile("data/source/elections/primary-results/geography/texas/2026/texas-current-districts-status.html"),
    readFile("data/source/elections/primary-results/geography/texas/2026/hb4-enrolled.html"),
    readFile("data/source/elections/primary-results/geography/texas/2026/planc2333-dataset.json"),
    readFile("data/source/elections/primary-results/geography/texas/2026/PLANC2333.csv"),
    readFile("data/source/elections/primary-results/geography/texas/current/48_TX_CD119.txt"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildTexas2026PrimaryBlockCrosswalkCandidate({ geographyJson: geography.toString("utf8"), currentStatusBytes, enrolledLawBytes, datasetBytes, planBlocksBytes, currentBlocksBytes, sourceLock: JSON.parse(sourceLockBytes.toString("utf8")) });
  const output = "data/metadata/texas-2026-primary-block-crosswalk-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("TEXAS_2026_PRIMARY_BLOCK_CROSSWALK_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
