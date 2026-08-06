import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildConnecticutPrimaryEvidenceReviewPackageV3, validateConnecticutPrimaryEvidenceReviewPackageV3 } from "../src/ingestion/elections/connecticut-primary-evidence-review-package-v3";

async function main() {
  const [v2Bytes, ballotBytes, catalogBytes, sourceLockBytes] = await Promise.all([readFile("data/metadata/connecticut-primary-evidence-review-package-v2.json"), readFile("data/metadata/connecticut-final-primary-ballot-receipt-v1.json"), readFile("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json"), readFile("data/source-lock.json")]);
  const input = { v2Bytes, ballotBytes, catalogBytes, sourceLockBytes };
  const value = validateConnecticutPrimaryEvidenceReviewPackageV3(buildConnecticutPrimaryEvidenceReviewPackageV3(input), input);
  const output = "data/metadata/connecticut-primary-evidence-review-package-v3.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CONNECTICUT_PRIMARY_EVIDENCE_REVIEW_V3_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
