import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { buildGeorgiaPrimaryGeographyCandidate, validateGeorgiaPrimaryGeographyCandidate } from "../src/ingestion/elections/georgia-primary-geography-compatibility-candidate";

const unzip = promisify(execFile), sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
async function main(): Promise<void> {
  const [proposal, receipt, identity, crosswalk, authorityBytes, cd118Bytes, cd119Bytes, tigerBytes, sourceLock, extracted] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), readFile("data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json"), readFile("data/metadata/georgia-current-incumbent-primary-linkage-candidate-v1.json"), readFile("data/metadata/georgia-cd118-cd119-block-crosswalk-candidate-v1.json"), readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"), readFile("data/source/elections/primary-results/geography/georgia/historical/13_GA_CD118.txt"), readFile("data/source/elections/primary-results/geography/georgia/current/13_GA_CD119.txt"), readFile("data/source/tiger2025/tl_2025_13_cd119.zip"), readFile("data/source-lock.json"), unzip("unzip", ["-p", "data/source/tiger2025/tl_2025_13_cd119.zip", "*.dbf"], { encoding: "buffer", maxBuffer: 2_000_000 }),
  ]);
  const value = validateGeorgiaPrimaryGeographyCandidate(buildGeorgiaPrimaryGeographyCandidate({ proposal: JSON.parse(proposal.toString("utf8")), proposalFileSha256: sha(proposal), receipt: JSON.parse(receipt.toString("utf8")), receiptFileSha256: sha(receipt), identity: JSON.parse(identity.toString("utf8")), identityFileSha256: sha(identity), crosswalk: JSON.parse(crosswalk.toString("utf8")), crosswalkFileSha256: sha(crosswalk), authorityBytes, cd118Bytes, cd119Bytes, ga119Dbf: extracted.stdout as Buffer, ga119FileSha256: sha(tigerBytes), sourceLock: JSON.parse(sourceLock.toString("utf8")) }));
  const output = "data/metadata/georgia-primary-geography-compatibility-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("GEORGIA_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
