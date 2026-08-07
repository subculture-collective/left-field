import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildConnecticutPrimaryEvidenceReviewPackageV4, validateConnecticutPrimaryEvidenceReviewPackageV4 } from "../src/ingestion/elections/connecticut-primary-evidence-review-package-v4";

async function main() {
  const [v3Bytes, eventDispositionBytes, v2Bytes, ballotBytes, catalogBytes, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/connecticut-primary-evidence-review-package-v3.json"),
    readFile("data/metadata/connecticut-house-democratic-primary-event-dispositions-2022-2024-v1.json"),
    readFile("data/metadata/connecticut-primary-evidence-review-package-v2.json"),
    readFile("data/metadata/connecticut-final-primary-ballot-receipt-v1.json"),
    readFile("data/source/elections/primary-results/connecticut/ballots/source-catalog-v1.json"),
    readFile("data/source-lock.json"),
  ]);
  const input = { v3Bytes, eventDispositionBytes, v2Bytes, ballotBytes, catalogBytes, sourceLockBytes };
  const value = validateConnecticutPrimaryEvidenceReviewPackageV4(buildConnecticutPrimaryEvidenceReviewPackageV4(input), input);
  const output = "data/metadata/connecticut-primary-evidence-review-package-v4.json";
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CONNECTICUT_PRIMARY_EVIDENCE_REVIEW_V4_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, decisionSetSha256: value.decisionSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
