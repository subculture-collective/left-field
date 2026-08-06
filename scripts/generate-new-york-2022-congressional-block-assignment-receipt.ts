import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildNewYork2022BlockAssignmentReceipt, validateNewYork2022BlockAssignmentReceipt } from "../src/ingestion/elections/new-york-2022-congressional-block-assignment-receipt";
async function main() {
  const [authorityBytes, assignmentBytes, cd118Bytes, sourceLockBytes] = await Promise.all([readFile("data/source/elections/primary-results/geography/new-york/2022/latfor-2022-congressional-maps.html"), readFile("data/source/elections/primary-results/geography/new-york/2022/court-ordered-congressional-block-assignment.dbf"), readFile("data/source/elections/primary-results/geography/new-york/historical/36_NY_CD118.txt"), readFile("data/source-lock.json")]);
  const input = { authorityBytes, assignmentBytes, cd118Bytes, sourceLock: JSON.parse(sourceLockBytes.toString("utf8")) }, value = validateNewYork2022BlockAssignmentReceipt(buildNewYork2022BlockAssignmentReceipt(input), input), output = "data/metadata/new-york-2022-congressional-block-assignment-receipt-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NY_2022_BLOCK_ASSIGNMENT_RECEIPT_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: value.packageSha256, districtSetSha256: value.districtSetSha256, summary: value.summary }, null, 2));
} main().catch((error) => { console.error(error); process.exitCode = 1; });
