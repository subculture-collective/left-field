import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { buildWashingtonPrimaryGeographyCandidate } from "../src/ingestion/elections/washington-primary-geography-compatibility-candidate";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const load = async (path: string) => { const bytes = await readFile(path); return { bytes, sha256: sha(bytes), json: JSON.parse(bytes.toString("utf8")) }; };
const dbf = (path: string): Buffer => execFileSync("unzip", ["-p", path, "*.dbf"]);

async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = await load("data/metadata/washington-house-top-two-results-receipt-20220802-20240806-v1.json");
  const identity = await load("data/metadata/washington-current-incumbent-top-two-linkage-candidate-v1.json");
  const authority = await readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const cd118Path = "data/source/tiger2022/tl_2022_53_cd118.zip", cd119Path = "data/source/tiger2025/tl_2025_53_cd119.zip";
  const cd118 = await readFile(cd118Path), cd119 = await readFile(cd119Path), sourceLock = JSON.parse(await readFile("data/source-lock.json", "utf8"));
  const value = buildWashingtonPrimaryGeographyCandidate({ proposal: proposal.json, proposalFileSha256: proposal.sha256, receipt: receipt.json, receiptFileSha256: receipt.sha256, identity: identity.json, identityFileSha256: identity.sha256, authorityHtml: authority.toString("utf8"), authorityFileSha256: sha(authority), cd118Zip: cd118, cd118FileSha256: sha(cd118), cd118Dbf: dbf(cd118Path), cd119Zip: cd119, cd119FileSha256: sha(cd119), cd119Dbf: dbf(cd119Path), sourceLock });
  const output = "data/metadata/washington-primary-geography-compatibility-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("WASHINGTON_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
