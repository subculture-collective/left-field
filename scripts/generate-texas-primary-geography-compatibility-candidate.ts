import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { buildTexasPrimaryGeographyCandidate } from "../src/ingestion/elections/texas-primary-geography-compatibility-candidate";

const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const load = async (path: string) => {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
};
const dbf = (path: string, member: string): Buffer =>
  execFileSync("unzip", ["-p", path, member], { maxBuffer: 8 * 1024 * 1024 });

async function main(): Promise<void> {
  const proposal = await load("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json");
  const receipt = await load("data/metadata/texas-house-democratic-primary-results-2022-2026-v1.json");
  const identity = await load("data/metadata/texas-current-incumbent-primary-event-identity-candidate-v1.json");
  const authority = await readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html");
  const cd118Path = "data/source/tiger2022/tl_2022_48_cd118.zip";
  const cd119Path = "data/source/tiger2025/tl_2025_48_cd119.zip";
  const cd118Zip = await readFile(cd118Path);
  const cd119Zip = await readFile(cd119Path);
  const sourceLock = await load("data/source-lock.json");
  const value = buildTexasPrimaryGeographyCandidate({
    proposal: proposal.value,
    proposalFileSha256: proposal.sha256,
    receipt: receipt.value,
    receiptFileSha256: receipt.sha256,
    identity: identity.value,
    identityFileSha256: identity.sha256,
    authorityHtml: authority.toString("utf8"),
    authorityFileSha256: sha256(authority),
    cd118Zip,
    cd118FileSha256: sha256(cd118Zip),
    cd118Dbf: dbf(cd118Path, "tl_2022_48_cd118.dbf"),
    cd119Zip,
    cd119FileSha256: sha256(cd119Zip),
    cd119Dbf: dbf(cd119Path, "tl_2025_48_cd119.dbf"),
    sourceLock: sourceLock.value,
  });
  const output = "data/metadata/texas-primary-geography-compatibility-candidate-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) {
      throw new Error("TEXAS_PRIMARY_GEOGRAPHY_OUTPUT_CONFLICT");
    }
  }
  console.log(JSON.stringify({
    output,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    packageSha256: value.packageSha256,
    rowSetSha256: value.rowSetSha256,
    parentProjectionSha256: value.methodology.parentProjectionSha256,
    summary: value.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
