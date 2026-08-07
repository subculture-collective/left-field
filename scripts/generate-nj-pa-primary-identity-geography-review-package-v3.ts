import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { buildNjPaPrimaryIdentityGeographyReviewPackageV3, validateNjPaPrimaryIdentityGeographyReviewPackageV3 } from "../src/ingestion/elections/nj-pa-primary-identity-geography-review-package-v3";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

async function main(): Promise<void> {
  const [jointV2Json, assessmentJson, sourceLockBytes] = await Promise.all([
    readFile("data/metadata/nj-pa-primary-identity-geography-review-package-v2.json", "utf8"),
    readFile("data/metadata/nj-pa-primary-certification-availability-assessment-v1.json", "utf8"),
    readFile("data/source-lock.json", "utf8"),
  ]);
  const input = { jointV2Json, assessmentJson, sourceLock: JSON.parse(sourceLockBytes) };
  const value = validateNjPaPrimaryIdentityGeographyReviewPackageV3(buildNjPaPrimaryIdentityGeographyReviewPackageV3(input), input);
  const output = "data/metadata/nj-pa-primary-identity-geography-review-package-v3.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NJ_PA_PRIMARY_JOINT_V3_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, reviewRecordSetSha256: value.reviewRecordSetSha256, authorityProjectionSetSha256: value.authorityProjectionSetSha256, parentDecisionReviewSetSha256: value.parentDecisionReviewSetSha256, summary: value.summary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
