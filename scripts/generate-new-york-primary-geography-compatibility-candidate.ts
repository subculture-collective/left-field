import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { buildNewYorkPrimaryGeographyCandidate } from "../src/ingestion/elections/new-york-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const text = async (path: string): Promise<string> => (await readFile(path)).toString("utf8");
const dbf = (path: string, member: string): Buffer => execFileSync("unzip", ["-p", path, member]);

async function main(): Promise<void> {
  const cd118Path = "data/source/tiger2022/tl_2022_36_cd118.zip", cd119Path = "data/source/tiger2025/tl_2025_36_cd119.zip";
  const value = buildNewYorkPrimaryGeographyCandidate({
    proposalJson: await text("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),
    dispositionsJson: await text("data/metadata/new-york-house-democratic-primary-dispositions-2022-2024-v2.json"),
    identityJson: await text("data/metadata/new-york-current-incumbent-primary-linkage-candidate-v1.json"),
    authorityHtml: await text("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
    cd118Zip: await readFile(cd118Path), cd118Dbf: dbf(cd118Path, "tl_2022_36_cd118.dbf"),
    cd119Zip: await readFile(cd119Path), cd119Dbf: dbf(cd119Path, "tl_2025_36_cd119.dbf"),
    sourceLockJson: await text("data/source-lock.json"),
  });
  const output = "data/metadata/new-york-primary-geography-compatibility-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NEW_YORK_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
