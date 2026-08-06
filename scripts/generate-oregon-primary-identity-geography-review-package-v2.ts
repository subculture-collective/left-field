import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildOregonPrimaryJointPackageV2 } from "../src/ingestion/elections/oregon-primary-identity-geography-review-package-v2";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  const base = "data/source/elections/primary-results/geography/oregon/2026";
  const [jointV1, geographyV2, geographyV1, authorityReceipt, redistrictingPage, enrolledBill, enrolledBillText, mapGuide, mapGuideText, currentBlocks, sourceLock] = await Promise.all([
    readFile("data/metadata/oregon-primary-identity-geography-review-package-v1.json"), readFile("data/metadata/oregon-primary-geography-compatibility-candidate-v2.json"), readFile("data/metadata/oregon-primary-geography-compatibility-candidate-v1.json"), readFile("data/metadata/oregon-2026-congressional-plan-authority-receipt-v1.json"), readFile(`${base}/redistricting.html`), readFile(`${base}/sb881-enrolled.pdf`), readFile(`${base}/sb881-enrolled.txt`), readFile(`${base}/interactive-map-data.pdf`), readFile(`${base}/interactive-map-data.txt`), readFile("data/source/elections/primary-results/geography/oregon/current/41_OR_CD119.txt"), readFile("data/source-lock.json"),
  ]);
  const value = buildOregonPrimaryJointPackageV2({ jointV1Json: jointV1.toString("utf8"), geographyV2Json: geographyV2.toString("utf8"), geographyV1Json: geographyV1.toString("utf8"), authorityReceiptJson: authorityReceipt.toString("utf8"), redistrictingPageBytes: redistrictingPage, enrolledBillBytes: enrolledBill, enrolledBillTextBytes: enrolledBillText, mapGuideBytes: mapGuide, mapGuideTextBytes: mapGuideText, currentBlocksBytes: currentBlocks, sourceLock: JSON.parse(sourceLock.toString("utf8")) });
  const output = "data/metadata/oregon-primary-identity-geography-review-package-v2.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("OREGON_PRIMARY_JOINT_V2_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, summary: value.summary }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
