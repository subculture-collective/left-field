import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { buildOhioPrimaryGeographyCandidate, validateOhioPrimaryGeographyCandidate } from "../src/ingestion/elections/ohio-primary-geography-compatibility-candidate";
const unzip = promisify(execFile), sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
async function main(): Promise<void> {
  const [proposalBytes, receiptBytes, identityBytes, authorityBytes, layerBytes, lockBytes, extracted] = await Promise.all([
    readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"), readFile("data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json"), readFile("data/metadata/ohio-current-incumbent-primary-linkage-candidate-v1.json"), readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"), readFile("data/source/tiger2025/tl_2025_39_cd119.zip"), readFile("data/source-lock.json"), unzip("unzip", ["-p", "data/source/tiger2025/tl_2025_39_cd119.zip", "*.dbf"], { encoding: "buffer", maxBuffer: 2_000_000 }),
  ]);
  const value = validateOhioPrimaryGeographyCandidate(buildOhioPrimaryGeographyCandidate({ proposal: JSON.parse(proposalBytes.toString("utf8")), proposalFileSha256: sha256(proposalBytes), receipt: JSON.parse(receiptBytes.toString("utf8")), receiptFileSha256: sha256(receiptBytes), identity: JSON.parse(identityBytes.toString("utf8")), identityFileSha256: sha256(identityBytes), authorityHtml: authorityBytes.toString("utf8"), authorityFileSha256: sha256(authorityBytes), oh119Dbf: extracted.stdout as Buffer, oh119FileSha256: sha256(layerBytes), sourceLock: JSON.parse(lockBytes.toString("utf8")) }));
  const output = "data/metadata/ohio-primary-geography-compatibility-candidate-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OHIO_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha256(bytes), packageSha256: value.packageSha256, rowSetSha256: value.rowSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
