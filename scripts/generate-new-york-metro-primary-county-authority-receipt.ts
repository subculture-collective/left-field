import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildNewYorkMetroPrimaryCountyAuthorityReceipt } from "../src/ingestion/elections/new-york-metro-primary-county-authority-receipt";

const text = (path: string) => readFile(path, "utf8");
async function main(): Promise<void> {
  const value = buildNewYorkMetroPrimaryCountyAuthorityReceipt({
    dispositionV2Json: await text("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"),
    cd119Bytes: await readFile("data/source/elections/primary-results/geography/new-york/current/36_NY_CD119.txt"),
    countyCodesBytes: await readFile("data/source/elections/primary-results/geography/new-york/current/census-county-codes.html"),
    indexBytes: await readFile("data/source/elections/primary-results/new-york/suffolk/2024/election-results-index.html"),
    resultBytes: await readFile("data/source/elections/primary-results/new-york/suffolk/2024/cd01-democratic-final-results.html"),
    sourceLock: JSON.parse(await text("data/source-lock.json")),
  });
  const output = "data/metadata/new-york-metro-house-democratic-primary-county-authority-receipt-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NY_METRO_PRIMARY_COUNTY_AUTHORITY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), authorityRowSetSha256: value.authorityRowSetSha256, packageSha256: value.packageSha256, summary: value.summary }, null, 2));
}
void main();
