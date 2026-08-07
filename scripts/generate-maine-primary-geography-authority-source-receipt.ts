import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildMainePrimaryGeographyAuthoritySourceReceipt } from "../src/ingestion/elections/maine-primary-geography-authority-source-receipt";

const sha = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const base = "data/source/elections/primary-results/geography/maine";
  const [ld1739StatusBytes, planLawPdfBytes, planLawTextBytes, currentDistrictStatuteBytes, reapportionmentStatuteBytes, cd118MaineAssignmentsBytes, cd119MaineAssignmentsBytes, censusPlanChangeAuthorityBytes, tigerCd119ZipBytes, sourceLockBytes] = await Promise.all([
    readFile(`${base}/authority/ld1739-status.html`),
    readFile(`${base}/authority/pl-2021-c487-congressional-plan.pdf`),
    readFile(`${base}/authority/pl-2021-c487-congressional-plan.txt`),
    readFile(`${base}/authority/mrsa-title21a-section1205-a.html`),
    readFile(`${base}/authority/mrsa-title21a-section1206.html`),
    readFile(`${base}/historical/23_ME_CD118.txt`),
    readFile(`${base}/current/23_ME_CD119.txt`),
    readFile("data/source/elections/primary-results/geography/census-119-congressional-district-bef.html"),
    readFile("data/source/tiger2025/tl_2025_23_cd119.zip"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildMainePrimaryGeographyAuthoritySourceReceipt({
    ld1739StatusBytes,
    planLawPdfBytes,
    planLawTextBytes,
    currentDistrictStatuteBytes,
    reapportionmentStatuteBytes,
    cd118MaineAssignmentsBytes,
    cd119MaineAssignmentsBytes,
    censusPlanChangeAuthorityBytes,
    tigerCd119ZipBytes,
    sourceLock: JSON.parse(sourceLockBytes.toString("utf8")),
  });
  const output = "data/metadata/maine-primary-geography-authority-source-receipt-v1.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try {
    await writeFile(output, bytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("MAINE_PRIMARY_GEOGRAPHY_AUTHORITY_SOURCE_RECEIPT_OUTPUT_CONFLICT");
  }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.byteLength, sha256: sha(bytes), packageSha256: value.packageSha256, cycleDispositionRowSetSha256: value.cycleDispositionRowSetSha256, summary: value.summary }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
