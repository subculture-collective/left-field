import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildNewYork2022PrimaryBlockCrosswalkCandidate, validateNewYork2022PrimaryBlockCrosswalkCandidate } from "../src/ingestion/elections/new-york-2022-primary-block-crosswalk-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const text = async (path: string): Promise<string> => (await readFile(path)).toString("utf8");

async function main(): Promise<void> {
  const input = {
    geographyJson: await text("data/metadata/new-york-primary-geography-compatibility-candidate-v1.json"),
    receiptJson: await text("data/metadata/new-york-2022-congressional-block-assignment-receipt-v1.json"),
    authorityBytes: await readFile("data/source/elections/primary-results/geography/new-york/2022/latfor-2022-congressional-maps.html"),
    assignmentBytes: await readFile("data/source/elections/primary-results/geography/new-york/2022/court-ordered-congressional-block-assignment.dbf"),
    cd118Bytes: await readFile("data/source/elections/primary-results/geography/new-york/historical/36_NY_CD118.txt"),
    cd119Bytes: await readFile("data/source/elections/primary-results/geography/new-york/current/36_NY_CD119.txt"),
    sourceLock: JSON.parse(await text("data/source-lock.json")),
  };
  const value = validateNewYork2022PrimaryBlockCrosswalkCandidate(buildNewYork2022PrimaryBlockCrosswalkCandidate(input), input);
  const output = "data/metadata/new-york-2022-primary-block-crosswalk-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NY_2022_PRIMARY_BLOCK_CROSSWALK_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
