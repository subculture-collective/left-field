import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildConnecticutPrimaryEvidenceReviewPackageV2 } from "../src/ingestion/elections/connecticut-primary-evidence-review-package-v2";

const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
async function main() {
  const [jointBytes, generalBytes, statutoryBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/connecticut-primary-identity-geography-review-package-v1.json"),
    readFile("data/metadata/connecticut-general-election-crosscheck-receipt-v1.json"),
    readFile("data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildConnecticutPrimaryEvidenceReviewPackageV2({ jointBytes, generalBytes, statutoryBytes, sourceLockBytes });
  const output = "data/metadata/connecticut-primary-evidence-review-package-v2.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CONNECTICUT_PRIMARY_EVIDENCE_REVIEW_V2_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
